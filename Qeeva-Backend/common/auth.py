"""Verification of Supabase Auth access tokens (JWT).

Django never creates users. The identity of the caller is whatever Supabase Auth signed.
A token is accepted only if ALL of these hold:

* the signature matches one of the project's public keys (JWKS);
* the algorithm is ES256 or RS256 (shared-secret HS256 and "none" are refused, which
  blocks algorithm-confusion attacks);
* it is not expired, and its audience and issuer are exactly Supabase's for this project;
* it carries ``sub`` (a UUID), is a real signed-in user (role ``authenticated``) and is
  not a Supabase anonymous sign-in.

Error messages are deliberately generic: they never echo the token or reveal which check failed.
"""

from __future__ import annotations

import uuid
from collections.abc import Mapping
from dataclasses import dataclass
from functools import lru_cache
from typing import Any

import jwt
from django.conf import settings
from rest_framework import status
from rest_framework.authentication import BaseAuthentication, get_authorization_header
from rest_framework.exceptions import APIException, AuthenticationFailed
from rest_framework.request import Request

ALLOWED_ALGORITHMS = ["ES256", "RS256"]
CLOCK_SKEW_SECONDS = 10
REQUIRED_CLAIMS = ["exp", "sub", "aud", "iss"]


class AuthServiceUnavailable(APIException):
    """The public keys could not be fetched. This is our outage, not a bad token."""

    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    default_detail = "Authentication service is temporarily unavailable."
    default_code = "auth_service_unavailable"


@dataclass(frozen=True)
class SupabasePrincipal:
    """The verified caller. ``id`` is the Supabase user id (``auth.users.id``)."""

    id: uuid.UUID
    claims: Mapping[str, Any]

    @property
    def is_authenticated(self) -> bool:
        return True

    @property
    def is_anonymous(self) -> bool:
        return False


@lru_cache(maxsize=1)
def get_jwks_client() -> jwt.PyJWKClient:
    """One shared client that caches the project's public keys for an hour."""
    return jwt.PyJWKClient(
        settings.SUPABASE_JWKS_URL,
        cache_keys=True,
        lifespan=3600,
        timeout=5,
    )


def verify_access_token(token: str) -> dict[str, Any]:
    """Return the verified claims of ``token`` or raise an API error."""
    try:
        signing_key = get_jwks_client().get_signing_key_from_jwt(token)
        claims: dict[str, Any] = jwt.decode(
            token,
            signing_key.key,
            algorithms=ALLOWED_ALGORITHMS,
            audience=settings.SUPABASE_JWT_AUDIENCE,
            issuer=settings.SUPABASE_JWT_ISSUER,
            leeway=CLOCK_SKEW_SECONDS,
            options={"require": REQUIRED_CLAIMS},
        )
    except jwt.PyJWKClientConnectionError as exc:
        raise AuthServiceUnavailable from exc
    except jwt.PyJWTError as exc:
        raise AuthenticationFailed("Invalid or expired token.") from exc

    if claims.get("role") != "authenticated" or claims.get("is_anonymous") is True:
        raise AuthenticationFailed("Invalid or expired token.")
    return claims


class SupabaseJWTAuthentication(BaseAuthentication):
    """DRF authentication using ``Authorization: Bearer <Supabase access token>``."""

    keyword = b"bearer"

    def authenticate(self, request: Request) -> tuple[SupabasePrincipal, str] | None:
        header = get_authorization_header(request).split()
        if not header or header[0].lower() != self.keyword:
            return None  # No Bearer token: let the permission layer answer 401.
        if len(header) != 2:
            raise AuthenticationFailed("Invalid Authorization header.")
        try:
            token = header[1].decode("ascii")
        except UnicodeError as exc:
            raise AuthenticationFailed("Invalid Authorization header.") from exc

        claims = verify_access_token(token)
        try:
            user_id = uuid.UUID(str(claims["sub"]))
        except ValueError as exc:
            raise AuthenticationFailed("Invalid or expired token.") from exc
        return SupabasePrincipal(id=user_id, claims=claims), token

    def authenticate_header(self, request: Request) -> str:
        # Makes DRF answer 401 (not 403) when authentication is missing or wrong.
        return "Bearer"

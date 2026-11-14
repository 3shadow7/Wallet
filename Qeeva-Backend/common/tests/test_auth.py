"""Tests for Supabase token verification. No network and no database are used:
the key server is replaced by a fake that returns our own throwaway public key."""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time
import uuid
from types import SimpleNamespace
from typing import Any

import jwt
import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec
from django.conf import settings
from rest_framework.test import APIClient

from common import auth


@pytest.fixture(scope="module")
def private_key() -> ec.EllipticCurvePrivateKey:
    return ec.generate_private_key(ec.SECP256R1())


@pytest.fixture(autouse=True)
def fake_key_server(
    monkeypatch: pytest.MonkeyPatch, private_key: ec.EllipticCurvePrivateKey
) -> None:
    """Pretend Supabase's key server holds exactly our test public key."""

    class FakeJWKSClient:
        def get_signing_key_from_jwt(self, token: str) -> Any:
            return SimpleNamespace(key=private_key.public_key())

    monkeypatch.setattr(auth, "get_jwks_client", lambda: FakeJWKSClient())


def make_token(key: Any, **overrides: Any) -> str:
    now = int(time.time())
    payload: dict[str, Any] = {
        "sub": str(uuid.uuid4()),
        "aud": settings.SUPABASE_JWT_AUDIENCE,
        "iss": settings.SUPABASE_JWT_ISSUER,
        "role": "authenticated",
        "iat": now,
        "exp": now + 3600,
    }
    payload.update(overrides)
    payload = {name: value for name, value in payload.items() if value is not None}
    return jwt.encode(payload, key, algorithm="ES256", headers={"kid": "test-key"})


def get_me(token: str | None = None, *, header: str | None = None) -> Any:
    client = APIClient()
    if header is not None:
        return client.get("/api/me/", HTTP_AUTHORIZATION=header)
    if token is not None:
        return client.get("/api/me/", HTTP_AUTHORIZATION=f"Bearer {token}")
    return client.get("/api/me/")


class TestValidTokens:
    def test_valid_token_is_accepted_and_returns_the_supabase_user_id(
        self, private_key: ec.EllipticCurvePrivateKey
    ) -> None:
        user_id = uuid.uuid4()
        response = get_me(make_token(private_key, sub=str(user_id)))
        assert response.status_code == 200
        assert response.json() == {"id": str(user_id)}

    def test_small_clock_difference_is_tolerated(
        self, private_key: ec.EllipticCurvePrivateKey
    ) -> None:
        just_expired = int(time.time()) - 5  # within the 10 second allowance
        assert get_me(make_token(private_key, exp=just_expired)).status_code == 200


class TestRejectedTokens:
    def test_no_token_gives_401_with_bearer_challenge(self) -> None:
        response = get_me()
        assert response.status_code == 401
        assert response["WWW-Authenticate"] == "Bearer"

    def test_expired_token(self, private_key: ec.EllipticCurvePrivateKey) -> None:
        assert get_me(make_token(private_key, exp=int(time.time()) - 3600)).status_code == 401

    def test_wrong_audience(self, private_key: ec.EllipticCurvePrivateKey) -> None:
        assert get_me(make_token(private_key, aud="something-else")).status_code == 401

    def test_wrong_issuer(self, private_key: ec.EllipticCurvePrivateKey) -> None:
        assert (
            get_me(make_token(private_key, iss="https://evil.example/auth/v1")).status_code == 401
        )

    def test_signed_by_someone_else(self) -> None:
        attacker_key = ec.generate_private_key(ec.SECP256R1())
        assert get_me(make_token(attacker_key)).status_code == 401

    @pytest.mark.parametrize("missing", ["sub", "exp", "aud", "iss"])
    def test_missing_required_claim(
        self, private_key: ec.EllipticCurvePrivateKey, missing: str
    ) -> None:
        assert get_me(make_token(private_key, **{missing: None})).status_code == 401

    def test_subject_must_be_a_uuid(self, private_key: ec.EllipticCurvePrivateKey) -> None:
        assert get_me(make_token(private_key, sub="not-a-uuid")).status_code == 401

    def test_anonymous_sign_in_users_are_refused(
        self, private_key: ec.EllipticCurvePrivateKey
    ) -> None:
        assert get_me(make_token(private_key, is_anonymous=True)).status_code == 401

    @pytest.mark.parametrize("role", ["anon", "service_role", None])
    def test_role_must_be_authenticated(
        self, private_key: ec.EllipticCurvePrivateKey, role: str | None
    ) -> None:
        assert get_me(make_token(private_key, role=role)).status_code == 401

    def test_alg_none_is_refused(self) -> None:
        now = int(time.time())
        token = jwt.encode(
            {
                "sub": str(uuid.uuid4()),
                "aud": settings.SUPABASE_JWT_AUDIENCE,
                "iss": settings.SUPABASE_JWT_ISSUER,
                "role": "authenticated",
                "exp": now + 3600,
            },
            key=None,  # type: ignore[arg-type]
            algorithm="none",
        )
        assert get_me(token).status_code == 401

    def test_algorithm_confusion_hs256_signed_with_the_public_key_is_refused(
        self, private_key: ec.EllipticCurvePrivateKey
    ) -> None:
        """Classic attack: sign with HS256 using the (public) key as the shared secret."""
        public_pem = private_key.public_key().public_bytes(
            serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo
        )

        def b64(data: bytes) -> bytes:
            return base64.urlsafe_b64encode(data).rstrip(b"=")

        now = int(time.time())
        header = b64(json.dumps({"alg": "HS256", "typ": "JWT", "kid": "test-key"}).encode())
        body = b64(
            json.dumps(
                {
                    "sub": str(uuid.uuid4()),
                    "aud": settings.SUPABASE_JWT_AUDIENCE,
                    "iss": settings.SUPABASE_JWT_ISSUER,
                    "role": "authenticated",
                    "exp": now + 3600,
                }
            ).encode()
        )
        signature = b64(hmac.new(public_pem, header + b"." + body, hashlib.sha256).digest())
        forged = (header + b"." + body + b"." + signature).decode()
        assert get_me(forged).status_code == 401

    def test_garbage_token(self) -> None:
        assert get_me("not.a.jwt").status_code == 401

    @pytest.mark.parametrize(
        "header",
        ["Bearer", "Bearer a b", "Bearer tökén", "Basic dXNlcjpwYXNz", "Token abc"],
    )
    def test_malformed_or_other_authorization_headers(self, header: str) -> None:
        assert get_me(header=header).status_code == 401

    def test_error_responses_never_echo_the_token(
        self, private_key: ec.EllipticCurvePrivateKey
    ) -> None:
        token = make_token(private_key, exp=int(time.time()) - 3600)
        response = get_me(token)
        assert response.status_code == 401
        assert token not in response.content.decode()


class TestKeyServer:
    def test_unknown_signing_key_is_a_401(self, monkeypatch: pytest.MonkeyPatch) -> None:
        class UnknownKeyClient:
            def get_signing_key_from_jwt(self, token: str) -> Any:
                raise jwt.PyJWKClientError("no matching key")

        monkeypatch.setattr(auth, "get_jwks_client", lambda: UnknownKeyClient())
        assert get_me("any.token.here").status_code == 401

    def test_key_server_outage_is_a_503_not_a_401(self, monkeypatch: pytest.MonkeyPatch) -> None:
        class DownClient:
            def get_signing_key_from_jwt(self, token: str) -> Any:
                raise jwt.PyJWKClientConnectionError("cannot reach key server")

        monkeypatch.setattr(auth, "get_jwks_client", lambda: DownClient())
        assert get_me("any.token.here").status_code == 503


class TestPublicAndDefaults:
    def test_health_is_public(self) -> None:
        response = APIClient().get("/api/health/")
        assert response.status_code == 200
        assert response.json() == {"status": "ok"}

    def test_health_ignores_a_broken_authorization_header(self) -> None:
        response = APIClient().get("/api/health/", HTTP_AUTHORIZATION="Bearer garbage")
        assert response.status_code == 200

    def test_the_api_is_closed_by_default(self) -> None:
        """If someone removes this default, every new endpoint would silently become public."""
        rest = settings.REST_FRAMEWORK
        assert rest["DEFAULT_PERMISSION_CLASSES"] == ["rest_framework.permissions.IsAuthenticated"]
        assert rest["DEFAULT_AUTHENTICATION_CLASSES"] == ["common.auth.SupabaseJWTAuthentication"]

    def test_only_asymmetric_algorithms_are_allowed(self) -> None:
        assert auth.ALLOWED_ALGORITHMS == ["ES256", "RS256"]

    def test_issuer_and_key_url_are_derived_from_the_project_url(self) -> None:
        assert settings.SUPABASE_JWT_ISSUER == "https://testproject.supabase.co/auth/v1"
        assert settings.SUPABASE_JWKS_URL == (
            "https://testproject.supabase.co/auth/v1/.well-known/jwks.json"
        )


class TestCookieSecurity:
    def test_cookies_are_https_only_when_debug_is_off(self) -> None:
        assert settings.DEBUG is False
        assert settings.SESSION_COOKIE_SECURE is True
        assert settings.CSRF_COOKIE_SECURE is True

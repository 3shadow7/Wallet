"""Tiny endpoints that exist from day one."""

from __future__ import annotations

from typing import cast

from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response

from common.auth import SupabasePrincipal


@api_view(["GET"])
@authentication_classes([])
@permission_classes([AllowAny])
def health(request: Request) -> Response:
    """Public liveness check for hosting platforms. Touches no database."""
    return Response({"status": "ok"})


@api_view(["GET"])
def me(request: Request) -> Response:
    """Return the id Supabase signed for this token. Handy to test a real login from the app."""
    principal = cast(SupabasePrincipal, request.user)
    return Response({"id": str(principal.id)})

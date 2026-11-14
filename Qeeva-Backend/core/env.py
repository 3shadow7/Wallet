"""Helpers for reading configuration from environment variables.

Kept dependency-free on purpose. Error messages never include values, because a value
may be a secret (for example a database URL that contains a password).
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any
from urllib.parse import parse_qsl, unquote, urlsplit

from django.core.exceptions import ImproperlyConfigured

_TRUE_VALUES = {"1", "true", "yes", "on"}
_FALSE_VALUES = {"0", "false", "no", "off", ""}


def load_env_file(path: Path) -> None:
    """Load KEY=VALUE lines from a local ``.env`` file into ``os.environ``.

    Real environment variables always win over the file, so production settings can never
    be overridden by a forgotten file. A missing file is fine (production has none).
    """
    if not path.is_file():
        return
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in {'"', "'"}:
            value = value[1:-1]
        os.environ.setdefault(key, value)


def env_required(name: str) -> str:
    """Return a mandatory variable, or fail loudly at startup."""
    value = os.environ.get(name, "").strip()
    if not value:
        raise ImproperlyConfigured(f"Missing required environment variable: {name}")
    return value


def env_bool(name: str, *, default: bool = False) -> bool:
    """Read a true/false variable. Unknown words are rejected instead of guessed."""
    raw = os.environ.get(name)
    if raw is None:
        return default
    value = raw.strip().lower()
    if value in _TRUE_VALUES:
        return True
    if value in _FALSE_VALUES:
        return False
    raise ImproperlyConfigured(f"Environment variable {name} must be true or false.")


def env_int(name: str, *, default: int) -> int:
    """Read an integer variable."""
    raw = os.environ.get(name)
    if raw is None or not raw.strip():
        return default
    try:
        return int(raw.strip())
    except ValueError as exc:
        raise ImproperlyConfigured(f"Environment variable {name} must be an integer.") from exc


def env_list(name: str) -> list[str]:
    """Read a comma-separated variable into a clean list (empty entries are dropped)."""
    raw = os.environ.get(name, "")
    return [item.strip() for item in raw.split(",") if item.strip()]


def parse_database_url(url: str) -> dict[str, Any]:
    """Turn ``postgresql://user:pass@host:5432/dbname?sslmode=require`` into a Django config.

    Only PostgreSQL is supported. The user name and password are URL-decoded, so special
    characters in a password must be percent-encoded (``@`` becomes ``%40``).
    """
    try:
        parts = urlsplit(url)
        port = parts.port
    except ValueError as exc:
        raise ImproperlyConfigured("DATABASE_URL is not a valid URL.") from exc

    if parts.scheme not in {"postgres", "postgresql"}:
        raise ImproperlyConfigured("DATABASE_URL must start with postgresql://")
    if not parts.hostname:
        raise ImproperlyConfigured("DATABASE_URL has no host.")
    database_name = unquote(parts.path.lstrip("/"))
    if not database_name:
        raise ImproperlyConfigured("DATABASE_URL has no database name.")

    config: dict[str, Any] = {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": database_name,
        "USER": unquote(parts.username or ""),
        "PASSWORD": unquote(parts.password or ""),
        "HOST": parts.hostname,
        "PORT": str(port) if port else "",
    }
    options = dict(parse_qsl(parts.query))
    if options:
        config["OPTIONS"] = options
    return config

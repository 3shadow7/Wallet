"""Test-suite wiring shared by every app.

* Supabase provides the ``auth.users`` table; a plain PostgreSQL does not. Before the
  migrations run on the throwaway test database we create a minimal stand-in so that the
  real foreign key ``profiles.id -> auth.users.id`` can be created and tested.
* Tests that need a database run only when ``QEEVA_TEST_DATABASE_URL`` points at a
  PostgreSQL server the user can create databases on. Without it they are skipped with a
  clear reason (never silently "passed").
"""

from __future__ import annotations

import os
from typing import Any

import pytest
from django.db.models.signals import pre_migrate

DB_URL_VARIABLE = "QEEVA_TEST_DATABASE_URL"


def _create_supabase_auth_stand_in(using: str, **_: Any) -> None:
    from django.db import connections

    with connections[using].cursor() as cursor:
        cursor.execute("CREATE SCHEMA IF NOT EXISTS auth")
        cursor.execute("CREATE TABLE IF NOT EXISTS auth.users (id uuid PRIMARY KEY)")


pre_migrate.connect(_create_supabase_auth_stand_in, dispatch_uid="qeeva-auth-stand-in")


def pytest_collection_modifyitems(config: pytest.Config, items: list[pytest.Item]) -> None:
    if os.environ.get(DB_URL_VARIABLE):
        return
    skip = pytest.mark.skip(
        reason=f"needs PostgreSQL: set {DB_URL_VARIABLE} (see README, 'Database tests')"
    )
    for item in items:
        if item.get_closest_marker("django_db") is not None:
            item.add_marker(skip)

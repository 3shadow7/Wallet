"""Small builders used by the account tests."""

from __future__ import annotations

import uuid
from typing import Any

from django.db import connection

from apps.accounts.models import Profile, UserSettings


def create_auth_user() -> uuid.UUID:
    """Insert a row into Supabase's ``auth.users`` (a stand-in table in the tests)."""
    user_id = uuid.uuid4()
    with connection.cursor() as cursor:
        cursor.execute("INSERT INTO auth.users (id) VALUES (%s)", [user_id])
    return user_id


def create_profile(username: str = "alice", **fields: Any) -> Profile:
    # ``objects`` is untyped (Any) with the pinned django-stubs, so the result is annotated here.
    profile: Profile = Profile.objects.create(id=create_auth_user(), username=username, **fields)
    return profile


def create_settings(profile: Profile, timezone: str = "Africa/Tripoli") -> UserSettings:
    settings: UserSettings = UserSettings.objects.create(user=profile, timezone=timezone)
    return settings

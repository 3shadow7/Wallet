"""``notifications`` (D-121, D-212): one row per event, never twice."""

from __future__ import annotations

import pytest
from django.db import IntegrityError, connection, transaction
from django.utils import timezone

from apps.accounts.models import Notification, Profile
from apps.accounts.tests.helpers import create_profile
from common.auth import SupabasePrincipal

pytestmark = pytest.mark.django_db


def notify(profile: Profile, key: str = "goal:car:50", kind: str = "goal_progress") -> Notification:
    row: Notification = Notification.objects.create(
        user=profile, kind=kind, dedupe_key=key, payload={"item": "Car fund", "percent": 50}
    )
    return row


def test_a_new_notification_is_unseen() -> None:
    row = notify(create_profile())
    assert row.seen_at is None


def test_the_same_event_is_never_stored_twice() -> None:
    profile = create_profile()
    notify(profile)
    with pytest.raises(IntegrityError), transaction.atomic():
        notify(profile)


def test_even_a_deleted_notification_blocks_its_event() -> None:
    # Dismissing "goal 50%" must not let the same event create it again (D-212).
    profile = create_profile()
    first = notify(profile)
    Notification.objects.filter(pk=first.pk).update(deleted_at=timezone.now())
    with pytest.raises(IntegrityError), transaction.atomic():
        notify(profile)


def test_two_users_can_have_the_same_event_key() -> None:
    notify(create_profile("first_1"))
    notify(create_profile("second_1"))
    assert Notification.objects.count() == 2


@pytest.mark.parametrize(
    ("kind", "key"), [("zakat_due", "k"), ("goal_progress", ""), ("goal_progress", "k" * 201)]
)
def test_the_database_refuses_bad_values(kind: str, key: str) -> None:
    with pytest.raises(IntegrityError), transaction.atomic():
        Notification.objects.create(user=create_profile(), kind=kind, dedupe_key=key)


def test_deleting_the_user_in_supabase_deletes_his_notifications() -> None:
    profile = create_profile()
    notify(profile)
    with connection.cursor() as cursor:  # the database rule, not Django's
        cursor.execute("DELETE FROM auth.users WHERE id = %s", [profile.id])
    assert not Notification.objects.filter(user_id=profile.id).exists()


def test_one_user_never_sees_another_users_notifications() -> None:
    mine, other = create_profile("mine_1"), create_profile("other_1")
    notify(other)
    assert list(Notification.objects.for_user(SupabasePrincipal(id=mine.id, claims={}))) == []

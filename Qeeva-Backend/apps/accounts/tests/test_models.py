"""Database rules of the account tables (run against a real PostgreSQL)."""

from __future__ import annotations

import uuid
from datetime import timedelta

import pytest
from django.core.exceptions import ValidationError
from django.db import IntegrityError, connection, transaction
from django.utils import timezone

from apps.accounts.models import Profile, UsernameReservation, UserSettings
from apps.accounts.tests.helpers import create_auth_user, create_profile, create_settings

pytestmark = pytest.mark.django_db

VALID_USERNAMES = ["abc", "A_1", "a" * 20, "Abc_123", "___"]
INVALID_USERNAMES = [
    "ab",  # too short
    "a" * 21,  # too long
    "bad name",
    "bad-name",
    "name!",
    "نام_عربي",  # not English letters
    "Ünder",
    "abc\n",  # a trailing newline must not slip through
    "",
]


class TestProfile:
    def test_defaults(self) -> None:
        profile = create_profile()
        profile.refresh_from_db()
        assert profile.role == Profile.objects.model._meta.get_field("role").default
        assert profile.role == "user"
        assert profile.status == "active"
        assert profile.display_name is None
        assert profile.username_changed_at is None
        assert profile.deleted_at is None
        assert profile.created_at is not None
        assert profile.updated_at >= profile.created_at

    def test_str_is_the_username(self) -> None:
        assert str(create_profile("Zed_9")) == "Zed_9"

    @pytest.mark.parametrize("username", VALID_USERNAMES)
    def test_valid_usernames_pass_python_and_database(self, username: str) -> None:
        Profile(id=uuid.uuid4(), username=username).full_clean(exclude=["id"])
        assert create_profile(username).username == username

    @pytest.mark.parametrize("username", INVALID_USERNAMES)
    def test_invalid_usernames_rejected_by_python_validation(self, username: str) -> None:
        with pytest.raises(ValidationError) as error:
            Profile(id=uuid.uuid4(), username=username).full_clean(exclude=["id"])
        assert "username" in error.value.message_dict

    @pytest.mark.parametrize("username", INVALID_USERNAMES)
    def test_invalid_usernames_rejected_by_the_database(self, username: str) -> None:
        # Bypasses Python validation on purpose: the database is the last wall.
        with pytest.raises(IntegrityError), transaction.atomic():
            create_profile(username)

    def test_username_unique_ignoring_letter_case(self) -> None:
        create_profile("Bob")
        with pytest.raises(IntegrityError), transaction.atomic():
            create_profile("bOB")

    @pytest.mark.parametrize("name", [None, "A", "x" * 30, "محمد علي", "Anna Maria"])
    def test_display_name_allowed(self, name: str | None) -> None:
        assert create_profile(display_name=name).display_name == name

    @pytest.mark.parametrize("name", ["", "x" * 31])
    def test_display_name_length_rejected_by_database(self, name: str) -> None:
        with pytest.raises(IntegrityError), transaction.atomic():
            create_profile(display_name=name)

    def test_display_name_too_long_rejected_by_python_validation(self) -> None:
        with pytest.raises(ValidationError) as error:
            Profile(id=uuid.uuid4(), username="abc", display_name="x" * 31).full_clean(
                exclude=["id"]
            )
        assert "display_name" in error.value.message_dict

    @pytest.mark.parametrize("role", ["user", "admin"])
    def test_valid_roles(self, role: str) -> None:
        assert create_profile(role=role).role == role

    @pytest.mark.parametrize("status", ["active", "suspended", "pending_deletion"])
    def test_valid_statuses(self, status: str) -> None:
        assert create_profile(status=status).status == status

    @pytest.mark.parametrize(
        ("field", "value"), [("role", "owner"), ("status", "banned"), ("role", "")]
    )
    def test_invalid_role_or_status_rejected_by_database(self, field: str, value: str) -> None:
        with pytest.raises(IntegrityError), transaction.atomic():
            create_profile(**{field: value})

    def test_profile_must_belong_to_a_supabase_user(self) -> None:
        with pytest.raises(IntegrityError), transaction.atomic():
            Profile.objects.create(id=uuid.uuid4(), username="ghost")


class TestUsernameReservation:
    def test_same_name_can_be_reserved_more_than_once_over_time(self) -> None:
        owner = create_profile("newname")
        until = timezone.now() + timedelta(days=30)
        UsernameReservation.objects.create(
            username="old_one", previous_owner=owner, reserved_until=until
        )
        UsernameReservation.objects.create(
            username="old_one", previous_owner=owner, reserved_until=until
        )
        assert UsernameReservation.objects.filter(username="old_one").count() == 2

    @pytest.mark.parametrize("username", ["ab", "bad name", "abc\n", ""])
    def test_username_format_enforced_by_database(self, username: str) -> None:
        with pytest.raises(IntegrityError), transaction.atomic():
            UsernameReservation.objects.create(
                username=username, reserved_until=timezone.now() + timedelta(days=30)
            )

    def test_reserved_until_is_required(self) -> None:
        with pytest.raises(IntegrityError), transaction.atomic():
            UsernameReservation.objects.create(username="old_one", reserved_until=None)

    def test_lookup_index_exists(self) -> None:
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT 1 FROM pg_indexes WHERE tablename = 'username_reservations' "
                "AND indexname = 'username_reservations_lookup'"
            )
            assert cursor.fetchone() is not None


class TestUserSettings:
    def test_defaults(self) -> None:
        settings = create_settings(create_profile())
        settings.refresh_from_db()
        assert settings.experience_mode == "regular"
        assert settings.language == "en"
        assert settings.skip_merge_confirm is False
        assert settings.timezone == "Africa/Tripoli"

    def test_only_one_row_per_user(self) -> None:
        profile = create_profile()
        create_settings(profile)
        with pytest.raises(IntegrityError), transaction.atomic():
            create_settings(profile)

    @pytest.mark.parametrize("mode", ["regular", "advanced"])
    def test_valid_modes(self, mode: str) -> None:
        profile = create_profile()
        assert UserSettings.objects.create(user=profile, timezone="UTC", experience_mode=mode)

    @pytest.mark.parametrize(
        ("field", "value"), [("experience_mode", "expert"), ("language", "ar"), ("language", "")]
    )
    def test_invalid_values_rejected_by_database(self, field: str, value: str) -> None:
        profile = create_profile()
        with pytest.raises(IntegrityError), transaction.atomic():
            UserSettings.objects.create(user=profile, timezone="UTC", **{field: value})

    def test_empty_timezone_rejected_by_database(self) -> None:
        with pytest.raises(IntegrityError), transaction.atomic():
            UserSettings.objects.create(user=create_profile(), timezone="")

    @pytest.mark.parametrize("name", ["UTC", "Africa/Tripoli", "America/Argentina/Buenos_Aires"])
    def test_valid_timezones(self, name: str) -> None:
        UserSettings(user=create_profile(), timezone=name).full_clean(exclude=["user"])

    @pytest.mark.parametrize("name", ["Mars/Base", "", "../etc/passwd", "Africa", "UTC+2 please"])
    def test_invalid_timezones_rejected_by_python_validation(self, name: str) -> None:
        with pytest.raises(ValidationError) as error:
            UserSettings(user=create_profile(), timezone=name).full_clean(exclude=["user"])
        assert "timezone" in error.value.message_dict


class TestDeletingASupabaseUser:
    """Supabase deletes users inside PostgreSQL, so the database itself must cascade."""

    def test_profile_and_settings_are_removed_and_reservations_survive(self) -> None:
        profile = create_profile("leaving")
        create_settings(profile)
        reservation = UsernameReservation.objects.create(
            username="old_name",
            previous_owner=profile,
            reserved_until=timezone.now() + timedelta(days=30),
        )

        with connection.cursor() as cursor:
            cursor.execute("DELETE FROM auth.users WHERE id = %s", [profile.id])

        assert not Profile.objects.filter(pk=profile.pk).exists()
        assert not UserSettings.objects.filter(pk=profile.pk).exists()
        reservation.refresh_from_db()
        assert reservation.previous_owner_id is None  # the old name stays reserved

    def test_foreign_key_unused_user_id_helper(self) -> None:
        # Guards the helper itself: two calls give two different users.
        assert create_auth_user() != create_auth_user()

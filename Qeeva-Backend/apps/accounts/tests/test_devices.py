"""``devices`` and the versioned ``user_settings`` (D-176, D-180, D-185, D-187, D-191, D-213)."""

from __future__ import annotations

from typing import Any

import pytest
from django.db import IntegrityError, connection, transaction

from apps.accounts.models import Device, DeviceAccess, Profile, UserSettings
from apps.accounts.tests.helpers import create_profile, create_settings
from common.auth import SupabasePrincipal

pytestmark = pytest.mark.django_db


def create_device(profile: Profile, name: str = "Chrome on Windows", **fields: Any) -> Device:
    device: Device = Device.objects.create(user=profile, name=name, platform="web", **fields)
    return device


class TestDevices:
    def test_a_new_device_is_full_access_and_not_the_main_one(self) -> None:
        device = create_device(create_profile())
        device.refresh_from_db()
        assert (device.is_primary, device.access_mode) == (False, DeviceAccess.FULL)
        assert device.last_synced_at is None

    def test_only_one_main_device_per_user(self) -> None:
        profile = create_profile()
        create_device(profile, "Phone", is_primary=True)
        create_device(profile, "Laptop")  # a second, not-main device is fine
        with pytest.raises(IntegrityError), transaction.atomic():
            create_device(profile, "Watch", is_primary=True)

    def test_each_user_has_his_own_main_device(self) -> None:
        create_device(create_profile("first_1"), is_primary=True)
        create_device(create_profile("second_1"), is_primary=True)
        assert Device.objects.filter(is_primary=True).count() == 2

    @pytest.mark.parametrize(
        ("field", "value"),
        [("platform", "windows"), ("access_mode", "admin"), ("name", ""), ("name", "x" * 41)],
    )
    def test_the_database_refuses_bad_values(self, field: str, value: str) -> None:
        values = {"name": "Phone", "platform": "android", field: value}
        with pytest.raises(IntegrityError), transaction.atomic():
            Device.objects.create(user=create_profile(), **values)

    def test_deleting_the_user_in_supabase_deletes_his_devices(self) -> None:
        profile = create_profile()
        create_device(profile)
        with connection.cursor() as cursor:  # the database rule, not Django's
            cursor.execute("DELETE FROM auth.users WHERE id = %s", [profile.id])
        assert not Device.objects.filter(user_id=profile.id).exists()

    def test_one_user_never_sees_another_users_devices(self) -> None:
        mine, other = create_profile("mine_1"), create_profile("other_1")
        create_device(other)
        principal = SupabasePrincipal(id=mine.id, claims={})
        assert list(Device.objects.for_user(principal)) == []


class TestVersionedSettings:
    def test_the_database_raises_the_version_on_every_change(self) -> None:
        settings = create_settings(create_profile())
        settings.refresh_from_db()
        assert settings.version == 1
        settings.skip_merge_confirm = True
        settings.save()
        # A bulk update cannot forget it either: the trigger lives in PostgreSQL.
        UserSettings.objects.filter(pk=settings.pk).update(language="en")
        settings.refresh_from_db()
        assert settings.version == 3

    def test_the_last_device_is_remembered_and_cleared_when_it_goes(self) -> None:
        profile = create_profile()
        settings = create_settings(profile)
        phone = create_device(profile, "Phone")
        UserSettings.objects.filter(pk=settings.pk).update(updated_by_device=phone)
        phone.delete()
        settings.refresh_from_db()
        assert settings.updated_by_device_id is None  # the settings row stays

    def test_settings_cannot_name_another_users_device(self) -> None:
        settings = create_settings(create_profile("mine_1"))
        strangers_phone = create_device(create_profile("other_1"))
        with pytest.raises(IntegrityError), transaction.atomic():
            UserSettings.objects.filter(pk=settings.pk).update(updated_by_device=strangers_phone)

from datetime import timedelta

from django.test import TestCase
from django.utils import timezone

from apps.identity.models import Profile, UsernameHistory


class ProfileModelTests(TestCase):
    def test_display_name_falls_back_to_username(self):
        profile = Profile(username="shadow")
        self.assertEqual(profile.effective_display_name, "shadow")

    def test_display_name_is_used_when_present(self):
        profile = Profile(username="shadow", display_name="Shadow")
        self.assertEqual(profile.effective_display_name, "Shadow")


class UsernameHistoryModelTests(TestCase):
    def test_history_can_reference_owner_and_reclaimer(self):
        owner = Profile.objects.create(username="owner_1")
        reclaimer = Profile.objects.create(username="reclaimer_1")
        now = timezone.now()

        record = UsernameHistory.objects.create(
            profile=owner,
            old_username="old_name",
            changed_at=now,
            available_at=now + timedelta(days=90),
            reclaimed_at=now + timedelta(days=91),
            reclaimed_by_profile=reclaimer,
        )

        self.assertEqual(record.profile_id, owner.id)
        self.assertEqual(record.reclaimed_by_profile_id, reclaimer.id)

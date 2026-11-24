"""``user_consents`` (D-202) and the check against the current document versions (D-208)."""

from __future__ import annotations

import pytest
from django.db import IntegrityError, connection, transaction

from apps.accounts.consents import has_accepted_current, latest_consent
from apps.accounts.models import ConsentAction, ConsentKind, Profile, UserConsent
from apps.accounts.tests.helpers import create_profile
from apps.system.models import AppConfigEntry
from common.auth import SupabasePrincipal

pytestmark = pytest.mark.django_db

TERMS, PRIVACY, MARKETING = ConsentKind.TERMS, ConsentKind.PRIVACY, ConsentKind.MARKETING
ACCEPTED, WITHDRAWN = ConsentAction.ACCEPTED, ConsentAction.WITHDRAWN


def principal_for(profile: Profile) -> SupabasePrincipal:
    return SupabasePrincipal(id=profile.id, claims={})


def consent(profile: Profile, kind: str, action: str, version: str = "2026-11") -> UserConsent:
    row: UserConsent = UserConsent.objects.create(
        user=profile, kind=kind, action=action, document_version=version
    )
    return row


class TestCurrentState:
    def test_nothing_answered_means_not_accepted(self) -> None:
        me = principal_for(create_profile())
        assert latest_consent(me, TERMS) is None
        assert not has_accepted_current(me, TERMS)

    def test_accepting_todays_terms_at_sign_up(self) -> None:
        profile = create_profile()
        consent(profile, TERMS, ACCEPTED)
        consent(profile, PRIVACY, ACCEPTED)
        assert has_accepted_current(principal_for(profile), TERMS)
        assert has_accepted_current(principal_for(profile), PRIVACY)

    def test_new_terms_version_asks_again_until_accepted(self) -> None:
        profile = create_profile()
        consent(profile, TERMS, ACCEPTED, "2026-11")
        # The owner publishes new terms in the admin page.
        AppConfigEntry.objects.filter(key="terms_version").update(value="2027-03")
        assert not has_accepted_current(principal_for(profile), TERMS)
        consent(profile, TERMS, ACCEPTED, "2027-03")
        assert has_accepted_current(principal_for(profile), TERMS)

    def test_the_newest_row_wins_for_marketing(self) -> None:
        profile = create_profile()
        consent(profile, MARKETING, ACCEPTED)
        consent(profile, MARKETING, WITHDRAWN)
        me = principal_for(profile)
        assert not has_accepted_current(me, MARKETING)
        newest = latest_consent(me, MARKETING)
        assert newest is not None and newest.action == WITHDRAWN
        # Both rows stay as proof.
        assert UserConsent.objects.for_user(me).filter(kind=MARKETING).count() == 2

    def test_one_user_never_sees_another_users_consents(self) -> None:
        mine, other = create_profile("mine_1"), create_profile("other_1")
        consent(other, TERMS, ACCEPTED)
        assert not has_accepted_current(principal_for(mine), TERMS)
        assert list(UserConsent.objects.for_user(principal_for(mine))) == []


class TestRules:
    def test_a_row_is_never_edited(self) -> None:
        row = consent(create_profile(), MARKETING, ACCEPTED)
        row.action = WITHDRAWN
        with pytest.raises(ValueError, match="never edited"):
            row.save()

    @pytest.mark.parametrize(
        ("field", "value"),
        [
            ("kind", "cookies"),
            ("action", "maybe"),
            ("document_version", ""),
            ("document_version", "x" * 21),
        ],
    )
    def test_the_database_refuses_bad_values(self, field: str, value: str) -> None:
        values = {"kind": TERMS, "action": ACCEPTED, "document_version": "2026-11", field: value}
        with pytest.raises(IntegrityError), transaction.atomic():
            UserConsent.objects.create(user=create_profile(), **values)

    def test_deleting_the_user_in_supabase_deletes_his_consents(self) -> None:
        profile = create_profile()
        consent(profile, TERMS, ACCEPTED)
        with connection.cursor() as cursor:  # the database rule, not Django's
            cursor.execute("DELETE FROM auth.users WHERE id = %s", [profile.id])
        assert not UserConsent.objects.filter(user_id=profile.id).exists()

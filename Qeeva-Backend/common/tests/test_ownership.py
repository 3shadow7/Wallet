"""Guards that keep "a user only sees their own rows" from being forgotten."""

from __future__ import annotations

import uuid
from datetime import timedelta

import pytest
from django.apps import apps
from django.core.exceptions import ImproperlyConfigured
from django.db import connection, models
from django.utils import timezone

from apps.accounts.models import Profile, UsernameReservation, UserSettings
from apps.accounts.tests.helpers import create_profile, create_settings
from common.auth import SupabasePrincipal


def project_models() -> list[type[models.Model]]:
    """Every model that lives in one of our own apps (``apps/<name>``)."""
    return [
        model
        for config in apps.get_app_configs()
        if config.name.startswith("apps.")
        for model in config.get_models()
    ]


def principal_for(profile: Profile) -> SupabasePrincipal:
    return SupabasePrincipal(id=profile.id, claims={})


class TestEveryModelDeclaresItsOwner:
    def test_there_are_project_models_to_check(self) -> None:
        assert len(project_models()) >= 8

    @pytest.mark.parametrize("model", project_models(), ids=lambda m: m.__name__)
    def test_owner_field_is_declared_on_the_model_itself(self, model: type[models.Model]) -> None:
        # Inheriting it by accident does not count: each model must make the choice.
        assert "OWNER_FIELD" in vars(model), f"{model.__name__} must declare OWNER_FIELD"
        owner_field = vars(model)["OWNER_FIELD"]
        if owner_field is not None:  # None = internal table, never read for a user
            assert isinstance(owner_field, str)
            model._meta.get_field(owner_field.removesuffix("_id"))

    @pytest.mark.parametrize("model", project_models(), ids=lambda m: m.__name__)
    def test_default_manager_offers_for_user(self, model: type[models.Model]) -> None:
        assert hasattr(model._default_manager, "for_user")


@pytest.mark.django_db
class TestForUser:
    def test_profile_returns_only_the_callers_row(self) -> None:
        mine, other = create_profile("mine_1"), create_profile("other_1")
        assert list(Profile.objects.for_user(principal_for(mine))) == [mine]
        assert list(Profile.objects.for_user(principal_for(other))) == [other]

    def test_settings_return_only_the_callers_row(self) -> None:
        mine, other = create_profile("mine_1"), create_profile("other_1")
        my_settings, _ = create_settings(mine), create_settings(other)
        assert list(UserSettings.objects.for_user(principal_for(mine))) == [my_settings]

    def test_unknown_caller_sees_nothing(self) -> None:
        create_profile("someone")
        stranger = SupabasePrincipal(id=uuid.uuid4(), claims={})
        assert not Profile.objects.for_user(stranger).exists()
        assert not UserSettings.objects.for_user(stranger).exists()

    def test_internal_tables_refuse_to_be_read_for_a_user(self) -> None:
        owner = create_profile("owner_1")
        UsernameReservation.objects.create(
            username="old_one",
            previous_owner=owner,
            reserved_until=timezone.now() + timedelta(days=30),
        )
        with pytest.raises(ImproperlyConfigured):
            UsernameReservation.objects.for_user(principal_for(owner))


@pytest.mark.django_db
class TestDatabaseIsClosedToThePublicDataApi:
    """Every table in our apps must have Row Level Security on and no policy (see common/db.py)."""

    def test_rls_enabled_and_no_policies(self) -> None:
        tables = sorted(model._meta.db_table for model in project_models())
        assert tables, "no tables found"
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT relname, relrowsecurity FROM pg_class "
                "WHERE relname = ANY(%s) AND relkind = 'r'",
                [tables],
            )
            rls = dict(cursor.fetchall())
            cursor.execute("SELECT tablename FROM pg_policies WHERE tablename = ANY(%s)", [tables])
            policies = cursor.fetchall()
        assert rls == dict.fromkeys(tables, True)
        assert policies == []

"""``app_config``: the filled table, the readers with their safe fallback, and the value checks."""

from __future__ import annotations

import importlib
import logging

import pytest
from django.core.exceptions import ValidationError
from django.db import IntegrityError, connection, transaction

from apps.system.config import KEYS, as_text, check_value, get_bool, get_int, get_text, parse_text
from apps.system.models import AppConfigEntry

# A migration module name starts with a digit, so it is loaded by its dotted name.
first_keys = importlib.import_module("apps.system.migrations.0002_default_values").DEFAULTS
later_keys = importlib.import_module("apps.system.migrations.0004_notifications_keep_days").NEW_KEYS


class TestTheFilledTable:
    def test_the_migrations_and_the_code_list_the_same_keys_and_defaults(self) -> None:
        # Each migration keeps its own copy (D-207); together they must match the code's list.
        assert {key: spec.default for key, spec in KEYS.items()} == {**first_keys, **later_keys}

    def test_there_are_25_keys(self) -> None:
        # 22 keys of D-179/D-206, terms_version and privacy_version (D-208), and
        # notifications_keep_days (D-212).
        assert len(KEYS) == 25

    @pytest.mark.django_db
    def test_every_key_is_in_the_table_with_its_default(self) -> None:
        stored = dict(AppConfigEntry.objects.values_list("key", "value"))
        assert stored == {key: spec.default for key, spec in KEYS.items()}

    @pytest.mark.parametrize("key", list(KEYS))
    def test_every_default_passes_its_own_check(self, key: str) -> None:
        assert check_value(key, KEYS[key].default) == KEYS[key].default


@pytest.mark.django_db
class TestReaders:
    def test_reads_the_value_the_owner_set(self) -> None:
        AppConfigEntry.objects.filter(key="device_limit_free").update(value=2)
        AppConfigEntry.objects.filter(key="signup_open").update(value=True)
        AppConfigEntry.objects.filter(key="terms_version").update(value="2027-03")
        assert get_int("device_limit_free") == 2
        assert get_bool("signup_open") is True
        assert get_text("terms_version") == "2027-03"

    def test_a_missing_row_falls_back_to_the_default(self) -> None:
        AppConfigEntry.objects.filter(key="zakat_silver_grams").delete()
        assert get_int("zakat_silver_grams") == 595

    def test_a_wrong_value_falls_back_to_the_default_and_warns(
        self, caplog: pytest.LogCaptureFixture
    ) -> None:
        # Someone typed text into a number key directly in the database.
        AppConfigEntry.objects.filter(key="deleted_rows_days").update(value="forty")
        with caplog.at_level(logging.WARNING, logger="apps.system.config"):
            assert get_int("deleted_rows_days") == 45
        assert "deleted_rows_days" in caplog.text

    def test_a_number_below_the_minimum_falls_back_to_the_default(self) -> None:
        AppConfigEntry.objects.filter(key="device_limit_free").update(value=0)
        assert get_int("device_limit_free") == 1

    def test_true_is_not_accepted_as_a_number(self) -> None:
        AppConfigEntry.objects.filter(key="invite_code_days").update(value=True)
        assert get_int("invite_code_days") == 7

    def test_an_unknown_key_is_a_bug(self) -> None:
        with pytest.raises(KeyError):
            get_int("no_such_key")

    def test_asking_with_the_wrong_reader_is_a_bug(self) -> None:
        with pytest.raises(TypeError):
            get_bool("device_limit_free")
        with pytest.raises(TypeError):
            get_int("terms_version")
        with pytest.raises(TypeError):
            get_text("signup_open")


class TestWhatTheAdminTypes:
    @pytest.mark.parametrize(
        ("key", "typed", "stored"),
        [
            ("device_limit_free", " 2 ", 2),
            ("signup_open", "true", True),
            ("feature_export_enabled", "False", False),
            ("terms_version", "2027-03", "2027-03"),
            ("guest_signin_prompt_message", "  Keep your data safe.  ", "Keep your data safe."),
        ],
    )
    def test_good_values_become_the_right_type(self, key: str, typed: str, stored: object) -> None:
        assert parse_text(key, typed) == stored

    @pytest.mark.parametrize(
        ("key", "typed", "reason"),
        [
            ("device_limit_free", "two", "whole number"),
            ("device_limit_free", "1.5", "whole number"),
            ("device_limit_free", "0", "at least 1"),
            ("signup_open", "yes", "true or false"),
            ("terms_version", "   ", "cannot be empty"),
            ("no_such_key", "1", "Unknown key"),
        ],
    )
    def test_bad_values_are_refused_with_a_plain_reason(
        self, key: str, typed: str, reason: str
    ) -> None:
        with pytest.raises(ValidationError, match=reason):
            parse_text(key, typed)

    @pytest.mark.parametrize("value", [True, False, 5, 0, "text"])
    def test_as_text_and_parse_text_round_trip(self, value: object) -> None:
        key = {bool: "signup_open", int: "months_ahead_limit", str: "terms_version"}[type(value)]
        assert parse_text(key, as_text(value)) == value  # type: ignore[arg-type]


@pytest.mark.django_db
class TestTheTableItself:
    def test_clean_refuses_a_wrong_type(self) -> None:
        entry = AppConfigEntry.objects.get(key="months_ahead_limit")
        entry.value = "one"
        with pytest.raises(ValidationError, match="whole number"):
            entry.full_clean()

    def test_the_database_refuses_a_badly_formed_key(self) -> None:
        with pytest.raises(IntegrityError), transaction.atomic():
            AppConfigEntry.objects.create(key="Bad Key", value=1)

    def test_deleting_the_admin_account_keeps_the_value(self) -> None:
        from django.contrib.auth.models import User

        admin = User.objects.create_superuser("owner", password="a-long-test-password")
        AppConfigEntry.objects.filter(key="signup_open").update(updated_by=admin, value=True)
        with connection.cursor() as cursor:  # the database rule, not Django's
            cursor.execute("DELETE FROM auth_user WHERE id = %s", [admin.pk])
        entry = AppConfigEntry.objects.get(key="signup_open")
        assert (entry.value, entry.updated_by_id) == (True, None)

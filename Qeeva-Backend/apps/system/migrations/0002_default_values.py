"""Fill ``app_config`` with every key and its default value (D-207).

The owner then changes a value in the Django admin page (D-209). The values are copied here on
purpose instead of being imported from ``apps/system/config.py``: a migration must keep doing the
same thing even after that file changes. A test checks that both lists match today.

Going back removes only these keys.
"""

from __future__ import annotations

from typing import Any

from django.db import migrations

DEFAULTS: dict[str, Any] = {
    "guest_signin_prompt_cards": 5,
    "guest_signin_prompt_message": "Sign in to keep your data safe if you change or lose your phone.",
    "signup_open": False,
    "device_limit_free": 1,
    "device_limit_paid": 5,
    "free_data_viewers": 1,
    "max_data_viewers": 30,
    "invite_code_days": 7,
    "account_deletion_grace_days": 30,
    "audit_log_days": 365,
    "feature_export_enabled": False,
    "terms_version": "2026-11",
    "privacy_version": "2026-11",
    "username_change_days": 14,
    "deleted_rows_days": 45,
    "pending_seen_days": 90,
    "bank_sync_overlap_days": 7,
    "months_ahead_limit": 1,
    "debt_reminder_days_before": 7,
    "zakat_silver_grams": 595,
    "zakat_default_rate_bp": 250,
    "zakat_clear_limit": 1,
    "prices_stale_days": 30,
    "price_update_hours": 24,
}


def add_defaults(apps: Any, schema_editor: Any) -> None:
    entry = apps.get_model("system", "AppConfigEntry")
    # ignore_conflicts: a key that already exists keeps the value the owner gave it.
    entry.objects.bulk_create(
        [entry(key=key, value=value) for key, value in DEFAULTS.items()], ignore_conflicts=True
    )


def remove_defaults(apps: Any, schema_editor: Any) -> None:
    apps.get_model("system", "AppConfigEntry").objects.filter(key__in=DEFAULTS).delete()


class Migration(migrations.Migration):
    dependencies = [("system", "0001_initial")]

    operations = [migrations.RunPython(add_defaults, remove_defaults)]

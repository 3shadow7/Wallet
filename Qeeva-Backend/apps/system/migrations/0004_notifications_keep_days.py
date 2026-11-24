"""Add the key ``notifications_keep_days`` (7) to ``app_config`` (D-212).

A seen notification is erased by the daily cleanup this many days after it was seen. The value is
copied here on purpose (a migration must not change when ``config.py`` changes); a test checks
that every migration's keys together match the code's list.
"""

from __future__ import annotations

from typing import Any

from django.db import migrations

NEW_KEYS: dict[str, Any] = {"notifications_keep_days": 7}


def add_keys(apps: Any, schema_editor: Any) -> None:
    entry = apps.get_model("system", "AppConfigEntry")
    # ignore_conflicts: a key that already exists keeps the value the owner gave it.
    entry.objects.bulk_create(
        [entry(key=key, value=value) for key, value in NEW_KEYS.items()], ignore_conflicts=True
    )


def remove_keys(apps: Any, schema_editor: Any) -> None:
    apps.get_model("system", "AppConfigEntry").objects.filter(key__in=NEW_KEYS).delete()


class Migration(migrations.Migration):
    dependencies = [("system", "0003_lock_django_tables")]

    operations = [migrations.RunPython(add_keys, remove_keys)]

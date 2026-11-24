"""Devices, and the sync columns of ``user_settings`` (D-176, D-180, D-213).

* ``devices``: owner FK to ``profiles`` with ON DELETE CASCADE (SQL); closed to the Data API.
* ``user_settings`` is versioned (``version`` raised by a trigger) and remembers the device of
  the last change; it is never deleted softly, so it gets no ``deleted_at`` (D-213).
"""

import django.core.validators
import django.db.models.deletion
import django.db.models.functions.datetime
import django.db.models.functions.text
import django.db.models.lookups
import uuid
from django.db import migrations, models

from common.db import device_foreign_key, lock_down_table, version_trigger


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0004_user_consents"),
    ]

    operations = [
        migrations.AddField(
            model_name="usersettings",
            name="version",
            field=models.IntegerField(db_default=1, default=1, editable=False),
        ),
        migrations.CreateModel(
            name="Device",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                (
                    "name",
                    models.TextField(
                        validators=[
                            django.core.validators.MinLengthValidator(1),
                            django.core.validators.MaxLengthValidator(40),
                        ]
                    ),
                ),
                (
                    "platform",
                    models.TextField(
                        choices=[("web", "Web"), ("android", "Android"), ("ios", "Ios")]
                    ),
                ),
                ("last_seen_at", models.DateTimeField(blank=True, null=True)),
                ("last_synced_at", models.DateTimeField(blank=True, null=True)),
                ("is_primary", models.BooleanField(db_default=False, default=False)),
                (
                    "access_mode",
                    models.TextField(
                        choices=[("full", "Full"), ("read_only", "Read Only")],
                        db_default="full",
                        default="full",
                    ),
                ),
                (
                    "created_at",
                    models.DateTimeField(
                        auto_now_add=True,
                        db_default=django.db.models.functions.datetime.Now(),
                    ),
                ),
                (
                    "updated_at",
                    models.DateTimeField(
                        auto_now=True,
                        db_default=django.db.models.functions.datetime.Now(),
                    ),
                ),
                (
                    "user",
                    models.ForeignKey(
                        db_constraint=False,
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="devices",
                        to="accounts.profile",
                    ),
                ),
            ],
            options={
                "db_table": "devices",
            },
        ),
        migrations.AddField(
            model_name="usersettings",
            name="updated_by_device",
            field=models.ForeignKey(
                blank=True,
                db_constraint=False,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="+",
                to="accounts.device",
            ),
        ),
        migrations.AddConstraint(
            model_name="device",
            constraint=models.UniqueConstraint(
                fields=("id", "user"), name="devices_id_user_unique"
            ),
        ),
        migrations.AddConstraint(
            model_name="device",
            constraint=models.UniqueConstraint(
                condition=models.Q(("is_primary", True)),
                fields=("user",),
                name="devices_one_primary_per_user",
            ),
        ),
        migrations.AddConstraint(
            model_name="device",
            constraint=models.CheckConstraint(
                condition=models.Q(
                    django.db.models.lookups.GreaterThanOrEqual(
                        django.db.models.functions.text.Length("name"), 1
                    ),
                    django.db.models.lookups.LessThanOrEqual(
                        django.db.models.functions.text.Length("name"), 40
                    ),
                ),
                name="devices_name_length",
            ),
        ),
        migrations.AddConstraint(
            model_name="device",
            constraint=models.CheckConstraint(
                condition=models.Q(("platform__in", ["web", "android", "ios"])),
                name="devices_platform_valid",
            ),
        ),
        migrations.AddConstraint(
            model_name="device",
            constraint=models.CheckConstraint(
                condition=models.Q(("access_mode__in", ["full", "read_only"])),
                name="devices_access_mode_valid",
            ),
        ),
        migrations.RunSQL(
            sql="""
                ALTER TABLE "devices"
                    ADD CONSTRAINT "devices_user_id_profiles_fk"
                    FOREIGN KEY ("user_id") REFERENCES "profiles" ("id") ON DELETE CASCADE;
            """,
            reverse_sql='ALTER TABLE "devices" DROP CONSTRAINT "devices_user_id_profiles_fk";',
        ),
        lock_down_table("devices"),
        device_foreign_key("user_settings", "updated_by_device_id"),
        version_trigger("user_settings"),
    ]

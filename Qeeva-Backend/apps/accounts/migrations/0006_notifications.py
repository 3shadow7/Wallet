"""The table ``notifications`` (D-121, D-212, D-213): its delete rule, sync columns and lock.

Deleting a profile deletes his notifications in the database itself (``ON DELETE CASCADE``).
Synced like the finance tables: ``version`` raised by a trigger, device links tied to the same
user's device. Only the MVP kinds are allowed for now; each later feature adds its own kind.
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
        ("accounts", "0005_devices_and_settings_sync"),
    ]

    operations = [
        migrations.CreateModel(
            name="Notification",
            fields=[
                (
                    "version",
                    models.IntegerField(db_default=1, default=1, editable=False),
                ),
                ("deleted_at", models.DateTimeField(blank=True, null=True)),
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
                    "kind",
                    models.TextField(
                        choices=[
                            ("goal_progress", "Goal Progress"),
                            ("goal_next_month", "Goal Next Month"),
                        ]
                    ),
                ),
                (
                    "dedupe_key",
                    models.TextField(
                        validators=[
                            django.core.validators.MinLengthValidator(1),
                            django.core.validators.MaxLengthValidator(200),
                        ]
                    ),
                ),
                ("payload", models.JSONField(blank=True, null=True)),
                (
                    "created_at",
                    models.DateTimeField(
                        auto_now_add=True,
                        db_default=django.db.models.functions.datetime.Now(),
                    ),
                ),
                ("seen_at", models.DateTimeField(blank=True, null=True)),
                (
                    "deleted_by_device",
                    models.ForeignKey(
                        blank=True,
                        db_constraint=False,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="+",
                        to="accounts.device",
                    ),
                ),
                (
                    "updated_by_device",
                    models.ForeignKey(
                        blank=True,
                        db_constraint=False,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="+",
                        to="accounts.device",
                    ),
                ),
                (
                    "user",
                    models.ForeignKey(
                        db_constraint=False,
                        db_index=False,
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="notifications",
                        to="accounts.profile",
                    ),
                ),
            ],
            options={
                "db_table": "notifications",
                "indexes": [
                    models.Index(
                        fields=["user", "seen_at"], name="notifications_user_seen"
                    )
                ],
                "constraints": [
                    models.UniqueConstraint(
                        fields=("user", "dedupe_key"),
                        name="notifications_user_dedupe_unique",
                    ),
                    models.CheckConstraint(
                        condition=models.Q(
                            ("kind__in", ["goal_progress", "goal_next_month"])
                        ),
                        name="notifications_kind_valid",
                    ),
                    models.CheckConstraint(
                        condition=models.Q(
                            django.db.models.lookups.GreaterThanOrEqual(
                                django.db.models.functions.text.Length("dedupe_key"), 1
                            ),
                            django.db.models.lookups.LessThanOrEqual(
                                django.db.models.functions.text.Length("dedupe_key"),
                                200,
                            ),
                        ),
                        name="notifications_dedupe_key_length",
                    ),
                ],
            },
        ),
        migrations.RunSQL(
            sql="""
                ALTER TABLE "notifications"
                    ADD CONSTRAINT "notifications_user_id_profiles_fk"
                    FOREIGN KEY ("user_id") REFERENCES "profiles" ("id") ON DELETE CASCADE;
            """,
            reverse_sql='ALTER TABLE "notifications" DROP CONSTRAINT "notifications_user_id_profiles_fk";',
        ),
        device_foreign_key("notifications", "deleted_by_device_id"),
        device_foreign_key("notifications", "updated_by_device_id"),
        version_trigger("notifications"),
        lock_down_table("notifications"),
    ]

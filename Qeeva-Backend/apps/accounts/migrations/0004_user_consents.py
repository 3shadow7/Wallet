"""The table ``user_consents`` (D-202): its columns, its delete rule and its lock.

Deleting a profile (also when Supabase deletes the user) deletes his consent rows in the database
itself (``ON DELETE CASCADE``), and the table is closed to the public Data API (D-087).
"""

import django.core.validators
import django.db.models.deletion
import django.db.models.functions.datetime
import django.db.models.functions.text
import django.db.models.lookups
import uuid
from django.db import migrations, models

from common.db import lock_down_table


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0003_row_level_security"),
    ]

    operations = [
        migrations.CreateModel(
            name="UserConsent",
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
                    "kind",
                    models.TextField(
                        choices=[
                            ("terms", "Terms"),
                            ("privacy", "Privacy"),
                            ("marketing", "Marketing"),
                        ]
                    ),
                ),
                (
                    "document_version",
                    models.TextField(validators=[django.core.validators.MaxLengthValidator(20)]),
                ),
                (
                    "action",
                    models.TextField(
                        choices=[("accepted", "Accepted"), ("withdrawn", "Withdrawn")]
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
                    "user",
                    models.ForeignKey(
                        db_constraint=False,
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="consents",
                        to="accounts.profile",
                    ),
                ),
            ],
            options={
                "db_table": "user_consents",
                "indexes": [
                    models.Index(
                        fields=["user", "kind", "-created_at"],
                        name="user_consents_latest",
                    )
                ],
                "constraints": [
                    models.CheckConstraint(
                        condition=models.Q(("kind__in", ["terms", "privacy", "marketing"])),
                        name="user_consents_kind_valid",
                    ),
                    models.CheckConstraint(
                        condition=models.Q(("action__in", ["accepted", "withdrawn"])),
                        name="user_consents_action_valid",
                    ),
                    models.CheckConstraint(
                        condition=models.Q(
                            django.db.models.lookups.GreaterThanOrEqual(
                                django.db.models.functions.text.Length("document_version"),
                                1,
                            ),
                            django.db.models.lookups.LessThanOrEqual(
                                django.db.models.functions.text.Length("document_version"),
                                20,
                            ),
                        ),
                        name="user_consents_document_version_length",
                    ),
                ],
            },
        ),
        migrations.RunSQL(
            sql="""
                ALTER TABLE "user_consents"
                    ADD CONSTRAINT "user_consents_user_id_profiles_fk"
                    FOREIGN KEY ("user_id") REFERENCES "profiles" ("id") ON DELETE CASCADE;
            """,
            reverse_sql='ALTER TABLE "user_consents" DROP CONSTRAINT "user_consents_user_id_profiles_fk";',
        ),
        lock_down_table("user_consents"),
    ]

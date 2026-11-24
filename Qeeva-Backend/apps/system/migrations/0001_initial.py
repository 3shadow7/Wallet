"""The system table ``app_config`` (D-179): its columns, its delete rule and its lock.

* ``updated_by`` points at the Django admin account that changed a value (D-209); deleting that
  account keeps the value and clears the link (``ON DELETE SET NULL``, enforced by PostgreSQL).
* The table is closed to Supabase's public Data API like every other table (D-087).
"""

import django.db.models.deletion
import django.db.models.functions.datetime
from django.conf import settings
from django.db import migrations, models

from common.db import lock_down_table


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="AppConfigEntry",
            fields=[
                ("key", models.TextField(primary_key=True, serialize=False)),
                ("value", models.JSONField()),
                (
                    "updated_at",
                    models.DateTimeField(
                        auto_now=True,
                        db_default=django.db.models.functions.datetime.Now(),
                    ),
                ),
                (
                    "updated_by",
                    models.ForeignKey(
                        blank=True,
                        db_constraint=False,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="+",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "verbose_name": "app config value",
                "db_table": "app_config",
                "ordering": ["key"],
                "constraints": [
                    models.CheckConstraint(
                        condition=models.Q(("key__regex", "^[a-z][a-z0-9_]{0,63}$")),
                        name="app_config_key_format",
                    )
                ],
            },
        ),
        migrations.RunSQL(
            sql="""
                ALTER TABLE "app_config"
                    ADD CONSTRAINT "app_config_updated_by_auth_user_fk"
                    FOREIGN KEY ("updated_by_id") REFERENCES "auth_user" ("id") ON DELETE SET NULL;
            """,
            reverse_sql='ALTER TABLE "app_config" DROP CONSTRAINT "app_config_updated_by_auth_user_fk";',
        ),
        lock_down_table("app_config"),
    ]

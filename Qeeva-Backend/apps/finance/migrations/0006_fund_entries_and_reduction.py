"""The funds ledger ``fund_entries`` (D-118, D-215) and ``month_items.reduction_minor`` (D-117).

Delete rules, enforced by PostgreSQL:
* user -> his entries go (CASCADE);
* month -> NO ACTION: a month that still has entries cannot be erased (D-123);
* item -> CASCADE: deleting a saving item deletes its moves, so its money is free again.
Every key is composite with ``user_id``, so an entry can never point at another user's month,
item or device. Synced like the other finance tables (D-213) and closed to the Data API.
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
        ("accounts", "0006_notifications"),
        ("finance", "0005_sync_columns"),
    ]

    operations = [
        migrations.CreateModel(
            name="FundEntry",
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
                            ("opening", "Opening"),
                            ("add", "Add"),
                            ("withdraw", "Withdraw"),
                            ("to_item", "To Item"),
                            ("from_item", "From Item"),
                        ]
                    ),
                ),
                (
                    "amount_minor",
                    models.BigIntegerField(
                        validators=[django.core.validators.MinValueValidator(1)]
                    ),
                ),
                (
                    "note",
                    models.TextField(
                        blank=True,
                        null=True,
                        validators=[
                            django.core.validators.MinLengthValidator(1),
                            django.core.validators.MaxLengthValidator(60),
                        ],
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
            ],
            options={
                "verbose_name_plural": "fund entries",
                "db_table": "fund_entries",
            },
        ),
        migrations.AddField(
            model_name="monthitem",
            name="reduction_minor",
            field=models.BigIntegerField(
                blank=True,
                null=True,
                validators=[django.core.validators.MinValueValidator(0)],
            ),
        ),
        migrations.AddConstraint(
            model_name="monthitem",
            constraint=models.CheckConstraint(
                condition=models.Q(
                    ("reduction_minor__isnull", True),
                    models.Q(
                        ("reduction_minor__gte", 0),
                        ("reduction_minor__lte", models.F("amount_minor")),
                    ),
                    _connector="OR",
                ),
                name="month_items_reduction_within_amount",
            ),
        ),
        migrations.AddField(
            model_name="fundentry",
            name="deleted_by_device",
            field=models.ForeignKey(
                blank=True,
                db_constraint=False,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="+",
                to="accounts.device",
            ),
        ),
        migrations.AddField(
            model_name="fundentry",
            name="item",
            field=models.ForeignKey(
                blank=True,
                db_column="item_id",
                db_constraint=False,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="fund_entries",
                to="finance.item",
            ),
        ),
        migrations.AddField(
            model_name="fundentry",
            name="month",
            field=models.ForeignKey(
                db_column="month_id",
                db_constraint=False,
                on_delete=django.db.models.deletion.DO_NOTHING,
                related_name="fund_entries",
                to="finance.month",
            ),
        ),
        migrations.AddField(
            model_name="fundentry",
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
        migrations.AddField(
            model_name="fundentry",
            name="user",
            field=models.ForeignKey(
                db_column="user_id",
                db_constraint=False,
                db_index=False,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="+",
                to="accounts.profile",
            ),
        ),
        migrations.AddIndex(
            model_name="fundentry",
            index=models.Index(fields=["user", "kind"], name="fund_entries_user_kind"),
        ),
        migrations.AddIndex(
            model_name="fundentry",
            index=models.Index(fields=["month"], name="fund_entries_month"),
        ),
        migrations.AddConstraint(
            model_name="fundentry",
            constraint=models.CheckConstraint(
                condition=models.Q(
                    ("kind__in", ["opening", "add", "withdraw", "to_item", "from_item"])
                ),
                name="fund_entries_kind_valid",
            ),
        ),
        migrations.AddConstraint(
            model_name="fundentry",
            constraint=models.CheckConstraint(
                condition=models.Q(("amount_minor__gt", 0)),
                name="fund_entries_amount_positive",
            ),
        ),
        migrations.AddConstraint(
            model_name="fundentry",
            constraint=models.CheckConstraint(
                condition=models.Q(
                    models.Q(
                        ("kind__in", ("to_item", "from_item")), ("item__isnull", False)
                    ),
                    models.Q(
                        models.Q(("kind__in", ("to_item", "from_item")), _negated=True),
                        ("item__isnull", True),
                    ),
                    _connector="OR",
                ),
                name="fund_entries_item_only_for_item_kinds",
            ),
        ),
        migrations.AddConstraint(
            model_name="fundentry",
            constraint=models.CheckConstraint(
                condition=models.Q(
                    ("note__isnull", True),
                    models.Q(
                        django.db.models.lookups.GreaterThanOrEqual(
                            django.db.models.functions.text.Length("note"), 1
                        ),
                        django.db.models.lookups.LessThanOrEqual(
                            django.db.models.functions.text.Length("note"), 60
                        ),
                    ),
                    _connector="OR",
                ),
                name="fund_entries_note_length",
            ),
        ),
        migrations.AddConstraint(
            model_name="fundentry",
            constraint=models.UniqueConstraint(
                condition=models.Q(("deleted_at__isnull", True), ("kind", "opening")),
                fields=("user",),
                name="fund_entries_one_opening_per_user",
            ),
        ),
        migrations.RunSQL(
            sql="""
                ALTER TABLE "fund_entries" ADD CONSTRAINT "fund_entries_user_id_profiles_fk"
                    FOREIGN KEY ("user_id") REFERENCES "profiles" ("id") ON DELETE CASCADE;
                ALTER TABLE "fund_entries" ADD CONSTRAINT "fund_entries_month_owner_fk"
                    FOREIGN KEY ("month_id", "user_id") REFERENCES "months" ("id", "user_id")
                    ON DELETE NO ACTION;
                ALTER TABLE "fund_entries" ADD CONSTRAINT "fund_entries_item_owner_fk"
                    FOREIGN KEY ("item_id", "user_id") REFERENCES "items" ("id", "user_id")
                    ON DELETE CASCADE;
            """,
            reverse_sql="""
                ALTER TABLE "fund_entries" DROP CONSTRAINT "fund_entries_item_owner_fk";
                ALTER TABLE "fund_entries" DROP CONSTRAINT "fund_entries_month_owner_fk";
                ALTER TABLE "fund_entries" DROP CONSTRAINT "fund_entries_user_id_profiles_fk";
            """,
        ),
        device_foreign_key("fund_entries", "deleted_by_device_id"),
        device_foreign_key("fund_entries", "updated_by_device_id"),
        version_trigger("fund_entries"),
        lock_down_table("fund_entries"),
    ]

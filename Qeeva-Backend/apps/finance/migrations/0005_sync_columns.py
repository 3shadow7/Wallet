"""The sync columns of the five finance tables (D-176, D-180, D-213).

Each row gets ``deleted_at`` and ``deleted_by_device`` (soft delete, erased for good 45 days later),
``version`` (raised by a trigger on every change) and ``updated_by_device``. The device links are
composite foreign keys to the SAME user's device, cleared (only that column) if the device goes.
The "one per user" rules now count only rows that are not deleted, so a deleted month or item
waiting for its 45 days never blocks making it again.
"""

import django.db.models.deletion
from django.db import migrations, models

from common.db import device_foreign_key, version_trigger


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0005_devices_and_settings_sync"),
        ("finance", "0004_money_in_thousandths"),
    ]

    operations = [
        migrations.RemoveConstraint(
            model_name="item",
            name="items_user_name_key_type_unique",
        ),
        migrations.RemoveConstraint(
            model_name="itemmergedismissal",
            name="item_merge_dismissals_pair_unique",
        ),
        migrations.RemoveConstraint(
            model_name="month",
            name="months_user_month_unique",
        ),
        migrations.RemoveConstraint(
            model_name="monthitem",
            name="month_items_month_item_importance_unique",
        ),
        migrations.AddField(
            model_name="item",
            name="deleted_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="item",
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
            model_name="item",
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
            model_name="item",
            name="version",
            field=models.IntegerField(db_default=1, default=1, editable=False),
        ),
        migrations.AddField(
            model_name="itemmergedismissal",
            name="deleted_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="itemmergedismissal",
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
            model_name="itemmergedismissal",
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
            model_name="itemmergedismissal",
            name="version",
            field=models.IntegerField(db_default=1, default=1, editable=False),
        ),
        migrations.AddField(
            model_name="month",
            name="deleted_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="month",
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
            model_name="month",
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
            model_name="month",
            name="version",
            field=models.IntegerField(db_default=1, default=1, editable=False),
        ),
        migrations.AddField(
            model_name="monthincome",
            name="deleted_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="monthincome",
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
            model_name="monthincome",
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
            model_name="monthincome",
            name="version",
            field=models.IntegerField(db_default=1, default=1, editable=False),
        ),
        migrations.AddField(
            model_name="monthitem",
            name="deleted_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="monthitem",
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
            model_name="monthitem",
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
            model_name="monthitem",
            name="version",
            field=models.IntegerField(db_default=1, default=1, editable=False),
        ),
        migrations.AddConstraint(
            model_name="item",
            constraint=models.UniqueConstraint(
                condition=models.Q(("deleted_at__isnull", True)),
                fields=("user", "name_key", "type"),
                name="items_user_name_key_type_unique",
            ),
        ),
        migrations.AddConstraint(
            model_name="itemmergedismissal",
            constraint=models.UniqueConstraint(
                condition=models.Q(("deleted_at__isnull", True)),
                fields=("item_a", "item_b"),
                name="item_merge_dismissals_pair_unique",
            ),
        ),
        migrations.AddConstraint(
            model_name="month",
            constraint=models.UniqueConstraint(
                condition=models.Q(("deleted_at__isnull", True)),
                fields=("user", "month_start"),
                name="months_user_month_unique",
            ),
        ),
        migrations.AddConstraint(
            model_name="monthitem",
            constraint=models.UniqueConstraint(
                condition=models.Q(("deleted_at__isnull", True)),
                fields=("month", "item", "importance"),
                name="month_items_month_item_importance_unique",
            ),
        ),
        device_foreign_key("months", "deleted_by_device_id"),
        device_foreign_key("months", "updated_by_device_id"),
        version_trigger("months"),
        device_foreign_key("month_incomes", "deleted_by_device_id"),
        device_foreign_key("month_incomes", "updated_by_device_id"),
        version_trigger("month_incomes"),
        device_foreign_key("items", "deleted_by_device_id"),
        device_foreign_key("items", "updated_by_device_id"),
        version_trigger("items"),
        device_foreign_key("month_items", "deleted_by_device_id"),
        device_foreign_key("month_items", "updated_by_device_id"),
        version_trigger("month_items"),
        device_foreign_key("item_merge_dismissals", "deleted_by_device_id"),
        device_foreign_key("item_merge_dismissals", "updated_by_device_id"),
        version_trigger("item_merge_dismissals"),
    ]

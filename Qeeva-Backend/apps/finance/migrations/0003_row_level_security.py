"""Close the finance tables to Supabase's public Data API (RLS on, no policies)."""

from django.db import migrations

from common.db import lock_down_table


class Migration(migrations.Migration):
    dependencies = [("finance", "0002_database_foreign_keys")]

    operations = [
        lock_down_table("months"),
        lock_down_table("month_incomes"),
        lock_down_table("items"),
        lock_down_table("month_items"),
        lock_down_table("item_merge_dismissals"),
    ]

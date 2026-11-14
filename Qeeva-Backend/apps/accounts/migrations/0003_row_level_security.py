"""Close the account tables to Supabase's public Data API (RLS on, no policies)."""

from django.db import migrations

from common.db import lock_down_table


class Migration(migrations.Migration):
    dependencies = [("accounts", "0002_database_foreign_keys")]

    operations = [
        lock_down_table("profiles"),
        lock_down_table("username_reservations"),
        lock_down_table("user_settings"),
    ]

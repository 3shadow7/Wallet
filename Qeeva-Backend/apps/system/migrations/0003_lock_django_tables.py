"""Close Django's own tables to Supabase's public Data API too (D-210).

Our tables are locked in their own migrations (D-087). Django's tables (the admin login in
``auth_user``, sessions, the admin history...) are created by Django itself, so they are locked
here, the same way: Row Level Security on with no policies, and the browser-facing roles'
privileges revoked where those roles exist. Plain PostgreSQL features: this works the same on any
PostgreSQL server, inside Supabase or not (D-211).

``django_migrations`` already exists before any migration runs, so it can be locked here as well.
"""

from django.db import migrations

from common.db import lock_down_table

DJANGO_TABLES = (
    "auth_group",
    "auth_group_permissions",
    "auth_permission",
    "auth_user",
    "auth_user_groups",
    "auth_user_user_permissions",
    "django_admin_log",
    "django_content_type",
    "django_migrations",
    "django_session",
)


class Migration(migrations.Migration):
    # The latest migration of each Django app whose tables are locked here.
    dependencies = [
        ("system", "0002_default_values"),
        ("admin", "0003_logentry_add_action_flag_choices"),
        ("auth", "0012_alter_user_first_name_max_length"),
        ("contenttypes", "0002_remove_content_type_name"),
        ("sessions", "0001_initial"),
    ]

    operations = [lock_down_table(table) for table in DJANGO_TABLES]

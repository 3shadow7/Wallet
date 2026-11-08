import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from django.db import connection

with connection.cursor() as cursor:
    cursor.execute("SELECT current_database(), current_user")
    print("Database:", cursor.fetchone())

    cursor.execute("SELECT to_regclass('auth.users')")
    print("Supabase Auth:", cursor.fetchone()[0])

    cursor.execute("""
        SELECT
            has_schema_privilege(current_user, 'public', 'CREATE'),
            has_schema_privilege(current_user, 'auth', 'USAGE')
    """)
    print("Privileges:", cursor.fetchone())
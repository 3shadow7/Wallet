"""Foreign keys whose delete rules must live in the database itself.

When a user is deleted in Supabase Auth, PostgreSQL removes the matching ``profiles`` row
without Django being involved. So the rules below are enforced by the database:

* ``auth.users`` -> ``profiles``: delete the profile.
* ``profiles`` -> ``user_settings``: delete the settings.
* ``profiles`` -> ``username_reservations``: keep the reservation, clear the old owner.

The first one needs Supabase's ``auth`` schema; the tests create a minimal stand-in for it
(see ``conftest.py``).
"""

from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [("accounts", "0001_initial")]

    operations = [
        migrations.RunSQL(
            sql="""
                ALTER TABLE "profiles"
                    ADD CONSTRAINT "profiles_id_auth_users_fk"
                    FOREIGN KEY ("id") REFERENCES "auth"."users" ("id") ON DELETE CASCADE;
                ALTER TABLE "user_settings"
                    ADD CONSTRAINT "user_settings_user_id_profiles_fk"
                    FOREIGN KEY ("user_id") REFERENCES "profiles" ("id") ON DELETE CASCADE;
                ALTER TABLE "username_reservations"
                    ADD CONSTRAINT "username_reservations_previous_owner_profiles_fk"
                    FOREIGN KEY ("previous_owner_id") REFERENCES "profiles" ("id")
                    ON DELETE SET NULL;
            """,
            reverse_sql="""
                ALTER TABLE "username_reservations"
                    DROP CONSTRAINT "username_reservations_previous_owner_profiles_fk";
                ALTER TABLE "user_settings" DROP CONSTRAINT "user_settings_user_id_profiles_fk";
                ALTER TABLE "profiles" DROP CONSTRAINT "profiles_id_auth_users_fk";
            """,
        )
    ]

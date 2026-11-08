import uuid

from django.db import migrations, models
import django.db.models.deletion
from django.db.models import F, Q
from django.db.models.functions import Lower
import django.core.validators


def add_supabase_auth_user_fk(apps, schema_editor):
    """Link profiles.id to Supabase auth.users.id on Supabase PostgreSQL only."""
    if schema_editor.connection.vendor != "postgresql":
        return

    with schema_editor.connection.cursor() as cursor:
        cursor.execute("SELECT to_regclass('auth.users')")
        if cursor.fetchone()[0] is None:
            return

        cursor.execute(
            """
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1
                    FROM pg_constraint
                    WHERE conname = 'fk_profiles_auth_users'
                ) THEN
                    ALTER TABLE public.profiles
                    ADD CONSTRAINT fk_profiles_auth_users
                    FOREIGN KEY (id)
                    REFERENCES auth.users (id)
                    ON DELETE CASCADE;
                END IF;
            END
            $$;
            """
        )


def remove_supabase_auth_user_fk(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return

    with schema_editor.connection.cursor() as cursor:
        cursor.execute(
            """
            ALTER TABLE public.profiles
            DROP CONSTRAINT IF EXISTS fk_profiles_auth_users;
            """
        )


class Migration(migrations.Migration):
    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="Profile",
            fields=[
                ("id", models.UUIDField(editable=False, primary_key=True, serialize=False)),
                (
                    "username",
                    models.CharField(
                        max_length=20,
                        validators=[
                            django.core.validators.RegexValidator(
                                regex="^[a-z0-9_]{3,20}$",
                                message=(
                                    "Username must be 3–20 characters and contain only lowercase "
                                    "English letters, numbers, and underscores."
                                ),
                            )
                        ],
                    ),
                ),
                ("display_name", models.CharField(blank=True, max_length=50, null=True)),
                ("avatar_path", models.CharField(blank=True, max_length=512, null=True)),
                ("bio", models.CharField(blank=True, max_length=160, null=True)),
                (
                    "role",
                    models.CharField(
                        choices=[("user", "User"), ("admin", "Admin")],
                        default="user",
                        max_length=10,
                    ),
                ),
                ("country_code", models.CharField(blank=True, max_length=2, null=True)),
                ("username_changed_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "db_table": "profiles",
                "constraints": [
                    models.UniqueConstraint(Lower("username"), name="uq_profiles_username_ci"),
                    models.CheckConstraint(
                        condition=Q(username__regex="^[a-z0-9_]{3,20}$"),
                        name="ck_profiles_username_format",
                    ),
                    models.CheckConstraint(
                        condition=Q(role__in=["user", "admin"]),
                        name="ck_profiles_role_valid",
                    ),
                    models.CheckConstraint(
                        condition=Q(country_code__isnull=True)
                        | Q(country_code__regex="^[A-Z]{2}$"),
                        name="ck_profiles_country_code_format",
                    ),
                ],
            },
        ),
        migrations.CreateModel(
            name="UsernameHistory",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                (
    "old_username",
    models.CharField(
        max_length=20,
        validators=[
            django.core.validators.RegexValidator(
                regex="^[a-z0-9_]{3,20}$",
                message=(
                    "Username must be 3–20 characters and contain only lowercase "
                    "English letters, numbers, and underscores."
                ),
            )
        ],
    ),
),
                ("changed_at", models.DateTimeField()),
                ("available_at", models.DateTimeField()),
                ("reclaimed_at", models.DateTimeField(blank=True, null=True)),
                (
                    "profile",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="username_history",
                        to="identity.profile",
                    ),
                ),
                (
                    "reclaimed_by_profile",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="reclaimed_usernames",
                        to="identity.profile",
                    ),
                ),
            ],
            options={
                "db_table": "username_history",
                "constraints": [
                    models.CheckConstraint(
                        condition=Q(old_username__regex="^[a-z0-9_]{3,20}$"),
                        name="ck_username_history_name_format",
                    ),
                    models.CheckConstraint(
                        condition=Q(available_at__gt=F("changed_at")),
                        name="ck_username_history_available_after_change",
                    ),
                    models.UniqueConstraint(
                        Lower("old_username"),
                        condition=Q(reclaimed_at__isnull=True),
                        name="uq_username_history_active_reservation",
                    ),
                ],
                "indexes": [
                    models.Index(fields=["profile", "-changed_at"], name="ix_username_hist_profile_date"),
                    models.Index(fields=["available_at"], name="ix_username_hist_available"),
                ],
            },
        ),
        migrations.RunPython(
            add_supabase_auth_user_fk,
            remove_supabase_auth_user_fk,
        ),
    ]

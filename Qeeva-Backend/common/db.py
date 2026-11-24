"""Helpers for migrations that touch PostgreSQL / Supabase specifics."""

from __future__ import annotations

from django.db import migrations


def lock_down_table(table: str) -> migrations.RunSQL:
    """Close a table to Supabase's public Data API.

    * Row Level Security is switched on and **no policy is created**, so every request that
      arrives as ``anon`` or ``authenticated`` (the browser-facing roles) sees nothing.
    * Their table privileges are revoked as a second wall. This only runs when those roles
      exist, so the same migration also works on a plain local PostgreSQL used by the tests.

    Django itself connects with the owner role, which is how our API reads and writes data.
    ``table`` is always a constant written in a migration, never user input.
    """
    quoted = f'"{table}"'
    return migrations.RunSQL(
        sql=[
            f"ALTER TABLE {quoted} ENABLE ROW LEVEL SECURITY;",
            f"""
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
                    EXECUTE 'REVOKE ALL ON TABLE {quoted} FROM anon';
                END IF;
                IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
                    EXECUTE 'REVOKE ALL ON TABLE {quoted} FROM authenticated';
                END IF;
            END
            $$;
            """,  # noqa: S608 - ``table`` is a constant from a migration, never user input
        ],
        # Reversing only turns RLS off; it does not hand privileges back to public roles.
        reverse_sql=f"ALTER TABLE {quoted} DISABLE ROW LEVEL SECURITY;",
    )


# One shared trigger function: before every UPDATE of a synced row, raise its version by one.
_BUMP_VERSION_FUNCTION = """
    CREATE OR REPLACE FUNCTION qeeva_bump_version() RETURNS trigger
    LANGUAGE plpgsql AS $$
    BEGIN
        NEW.version := OLD.version + 1;
        RETURN NEW;
    END;
    $$;
"""


def version_trigger(table: str) -> migrations.RunSQL:
    """Make PostgreSQL raise ``version`` on every change of a row of ``table`` (D-180).

    Done in the database, not in Python, so a bulk ``QuerySet.update()`` or a change made by a
    later script cannot forget it. The version can never go below 1. Going back removes the
    trigger and the check; the shared function stays (other tables may still use it).
    ``table`` is always a constant written in a migration, never user input.
    """
    quoted = f'"{table}"'
    return migrations.RunSQL(
        sql=[
            _BUMP_VERSION_FUNCTION,
            f'ALTER TABLE {quoted} ADD CONSTRAINT "{table}_version_positive" CHECK (version >= 1);',
            f'CREATE TRIGGER "{table}_bump_version" BEFORE UPDATE ON {quoted} '
            "FOR EACH ROW EXECUTE FUNCTION qeeva_bump_version();",
        ],
        reverse_sql=[
            f'DROP TRIGGER "{table}_bump_version" ON {quoted};',
            f'ALTER TABLE {quoted} DROP CONSTRAINT "{table}_version_positive";',
        ],
    )


def device_foreign_key(table: str, column: str) -> migrations.RunSQL:
    """Tie ``table.column`` to the SAME user's device, and clear only that column if it goes.

    The key is composite, ``(column, user_id) -> devices (id, user_id)``, so a row can never
    name another user's device. Deleting the device keeps the row and sets just ``column`` to
    NULL (PostgreSQL 15+ ``SET NULL (column)``), never the owner.
    """
    name = f"{table}_{column}_devices_fk"
    return migrations.RunSQL(
        sql=f'ALTER TABLE "{table}" ADD CONSTRAINT "{name}" '
        f'FOREIGN KEY ("{column}", "user_id") REFERENCES "devices" ("id", "user_id") '
        f'ON DELETE SET NULL ("{column}");',
        reverse_sql=f'ALTER TABLE "{table}" DROP CONSTRAINT "{name}";',
    )

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

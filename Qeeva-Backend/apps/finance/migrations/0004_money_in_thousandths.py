"""Store money in thousandths (3 decimals) instead of cents (2 decimals), for every user (D-149).

The columns stay ``bigint``; only the meaning of the number changes. 12.34 was stored as ``1234``
(cents) and is now stored as ``12340`` (thousandths), so every stored amount is multiplied by 10.
How many decimals a user SEES (2 or 3) is a display setting and never touches these numbers.

This is a ONE-TIME change made by the developers. It never runs when a user changes a setting.
No real data exists yet (nothing has been applied to Supabase, D-084), so in practice it converts
nothing; it is still written to be correct on real rows.

Going back (cents again) divides by 10, but only when no amount uses the third decimal: otherwise
it stops with an error, so a thousandth is never lost silently.
"""

from django.db import migrations

# Every built money column, as (table, column). NULL stays NULL in both directions.
MONEY_COLUMNS = (
    ("month_incomes", "amount_minor"),
    ("month_incomes", "hourly_rate_manual_minor"),
    ("items", "target_minor"),
    ("month_items", "amount_minor"),
    ("month_items", "unit_price_minor"),
)


def _multiply_sql() -> str:
    return "\n".join(
        f'UPDATE "{table}" SET "{column}" = "{column}" * 10 WHERE "{column}" IS NOT NULL;'
        for table, column in MONEY_COLUMNS
    )


def _divide_sql() -> str:
    # First refuse if any amount has a third decimal (not a multiple of 10), then divide.
    uses_third_decimal = " OR ".join(
        f'EXISTS (SELECT 1 FROM "{table}" WHERE "{column}" % 10 <> 0)'
        for table, column in MONEY_COLUMNS
    )
    divide = "\n".join(
        f'UPDATE "{table}" SET "{column}" = "{column}" / 10 WHERE "{column}" IS NOT NULL;'
        for table, column in MONEY_COLUMNS
    )
    return f"""
        DO $$
        BEGIN
            IF {uses_third_decimal} THEN
                RAISE EXCEPTION 'Cannot go back to cents: some amounts use the third decimal.';
            END IF;
        END
        $$;
        {divide}
    """


class Migration(migrations.Migration):
    dependencies = [("finance", "0003_row_level_security")]

    operations = [
        # Table and column names are constants of this file, never user input.
        migrations.RunSQL(sql=_multiply_sql(), reverse_sql=_divide_sql()),
    ]

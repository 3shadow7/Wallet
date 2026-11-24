"""The one-time move of money from cents to thousandths (D-149, migration ``finance 0004``).

These tests run the REAL migration on the test database: they step back to ``0003`` (cents),
write rows, step forward to ``0004`` and check every money column. Moving between migrations
needs real commits, so they use a transactional database and always end on the latest migration.
"""

from __future__ import annotations

from collections.abc import Iterator

import pytest
from django.db import DatabaseError, connection
from django.db.migrations.executor import MigrationExecutor

from apps.accounts.tests.helpers import create_profile
from apps.finance.models import Item, MonthIncome, MonthItem
from apps.finance.tests.helpers import create_card, create_income, create_item, create_month

CENTS = [("finance", "0003_row_level_security")]
THOUSANDTHS = [("finance", "0004_money_in_thousandths")]


def migrate_to(targets: list[tuple[str, str]]) -> None:
    """Run the migrations forward or backward until ``targets`` is the last applied one."""
    MigrationExecutor(connection).migrate(targets)


def applied_finance_migrations() -> set[str]:
    executor = MigrationExecutor(connection)
    return {name for app, name in executor.recorder.applied_migrations() if app == "finance"}


@pytest.fixture
def back_to_latest() -> Iterator[None]:
    """Whatever a test does, leave the database on the newest migration of every app."""
    yield
    executor = MigrationExecutor(connection)
    executor.migrate(executor.loader.graph.leaf_nodes())


# A transactional test empties every table when it ends. serialized_rollback makes each of these
# tests start from the rows that migrations wrote (the app_config defaults, D-207), not from an
# empty database, so the migrations run on realistic data.
pytestmark = [
    pytest.mark.django_db(transaction=True, serialized_rollback=True),
    pytest.mark.usefixtures("back_to_latest"),
]


def test_every_money_column_is_multiplied_by_ten() -> None:
    migrate_to(CENTS)
    profile = create_profile("cents_1")
    month = create_month(profile)
    # Salary 500.00 with a typed hourly rate of 12.50; a bonus line with no hourly rate.
    salary = create_income(month, 50_000, name="Salary", hourly_rate_manual_minor=1_250)
    bonus = create_income(month, 7_500, name="Bonus")
    # A saving item with a goal of 14,000.00 and a card of 4 x 25.00 = 100.00.
    fund = create_item(profile, "Car fund", "saving", target_minor=1_400_000)
    card = create_card(month, fund, 10_000, quantity=4, unit_price_minor=2_500)
    # A spending item with no goal and a card with no unit price.
    rent = create_item(profile, "Rent", "burn")
    rent_card = create_card(month, rent, 30_000)

    migrate_to(THOUSANDTHS)

    salary_after = MonthIncome.objects.get(pk=salary.pk)
    assert (salary_after.amount_minor, salary_after.hourly_rate_manual_minor) == (500_000, 12_500)
    bonus_after = MonthIncome.objects.get(pk=bonus.pk)
    assert (bonus_after.amount_minor, bonus_after.hourly_rate_manual_minor) == (75_000, None)
    assert Item.objects.get(pk=fund.pk).target_minor == 14_000_000
    assert Item.objects.get(pk=rent.pk).target_minor is None
    card_after = MonthItem.objects.get(pk=card.pk)
    assert (card_after.amount_minor, card_after.unit_price_minor, card_after.quantity) == (
        100_000,
        25_000,
        4,  # a count is not money: it does not change
    )
    rent_card_after = MonthItem.objects.get(pk=rent_card.pk)
    assert (rent_card_after.amount_minor, rent_card_after.unit_price_minor) == (300_000, None)


def test_going_back_divides_by_ten_when_no_third_decimal_is_used() -> None:
    profile = create_profile("thousandths_1")
    month = create_month(profile)
    income = create_income(month, 12_340)  # 12.340

    migrate_to(CENTS)

    assert MonthIncome.objects.get(pk=income.pk).amount_minor == 1_234  # 12.34


def test_going_back_refuses_to_lose_a_thousandth() -> None:
    profile = create_profile("thousandths_2")
    month = create_month(profile)
    income = create_income(month, 12_345)  # 12.345: the 5 has no place in cents

    with pytest.raises(DatabaseError, match="third decimal"):
        migrate_to(CENTS)

    # Nothing changed: the amount is intact and 0004 is still applied.
    assert MonthIncome.objects.get(pk=income.pk).amount_minor == 12_345
    assert "0004_money_in_thousandths" in applied_finance_migrations()

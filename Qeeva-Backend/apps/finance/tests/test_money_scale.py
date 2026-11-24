"""The one-time move of money from cents to thousandths (D-149, migration ``finance 0004``).

These tests run the REAL migration on the test database: they step back to ``0003`` (cents),
write rows, step forward to ``0004`` and check every money column. Moving between migrations
needs real commits, so they use a transactional database and always end on the latest migration.

The finance tables of today have more columns (the sync columns of ``0005``), so the rows are
written and read with the HISTORICAL models of the migration being tested, the way Django's own
data migrations do it, never with today's models.
"""

from __future__ import annotations

from collections.abc import Iterator
from datetime import date
from typing import Any

import pytest
from django.db import DatabaseError, connection
from django.db.migrations.executor import MigrationExecutor

from apps.accounts.tests.helpers import create_profile

CENTS = [("finance", "0003_row_level_security")]
THOUSANDTHS = [("finance", "0004_money_in_thousandths")]


def migrate_to(targets: list[tuple[str, str]]) -> None:
    """Run the migrations forward or backward until ``targets`` is the last applied one."""
    MigrationExecutor(connection).migrate(targets)


def models_at(targets: list[tuple[str, str]]) -> Any:
    """The finance models exactly as they were at ``targets`` (Django's historical models)."""
    return MigrationExecutor(connection).loader.project_state(targets).apps


def applied_finance_migrations() -> set[str]:
    executor = MigrationExecutor(connection)
    return {name for app, name in executor.recorder.applied_migrations() if app == "finance"}


def new_month(apps: Any, owner_id: object) -> Any:
    return apps.get_model("finance", "Month").objects.create(
        user_id=owner_id, month_start=date(2026, 11, 1)
    )


def new_income(apps: Any, month: Any, amount: int, **fields: Any) -> Any:
    return apps.get_model("finance", "MonthIncome").objects.create(
        user_id=month.user_id, month=month, amount_minor=amount, **fields
    )


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
    old = models_at(CENTS)
    profile = create_profile("cents_1")
    month = new_month(old, profile.id)
    # Salary 500.00 with a typed hourly rate of 12.50; a bonus line with no hourly rate.
    salary = new_income(old, month, 50_000, name="Salary", hourly_rate_manual_minor=1_250)
    bonus = new_income(old, month, 7_500, name="Bonus")
    item_model = old.get_model("finance", "Item")
    card_model = old.get_model("finance", "MonthItem")
    # A saving item with a goal of 14,000.00 and a card of 4 x 25.00 = 100.00.
    fund = item_model.objects.create(
        user_id=profile.id, name="Car fund", name_key="car fund", type="saving",
        target_minor=1_400_000,
    )  # fmt: skip
    card = card_model.objects.create(
        user_id=profile.id, month=month, item=fund, amount_minor=10_000, quantity=4,
        unit_price_minor=2_500,
    )  # fmt: skip
    # A spending item with no goal and a card with no unit price.
    rent = item_model.objects.create(user_id=profile.id, name="Rent", name_key="rent", type="burn")
    rent_card = card_model.objects.create(
        user_id=profile.id, month=month, item=rent, amount_minor=30_000
    )

    migrate_to(THOUSANDTHS)
    new = models_at(THOUSANDTHS)
    income_model = new.get_model("finance", "MonthIncome")
    item_model = new.get_model("finance", "Item")
    card_model = new.get_model("finance", "MonthItem")

    salary_after = income_model.objects.get(pk=salary.pk)
    assert (salary_after.amount_minor, salary_after.hourly_rate_manual_minor) == (500_000, 12_500)
    bonus_after = income_model.objects.get(pk=bonus.pk)
    assert (bonus_after.amount_minor, bonus_after.hourly_rate_manual_minor) == (75_000, None)
    assert item_model.objects.get(pk=fund.pk).target_minor == 14_000_000
    assert item_model.objects.get(pk=rent.pk).target_minor is None
    card_after = card_model.objects.get(pk=card.pk)
    assert (card_after.amount_minor, card_after.unit_price_minor, card_after.quantity) == (
        100_000,
        25_000,
        4,  # a count is not money: it does not change
    )
    rent_card_after = card_model.objects.get(pk=rent_card.pk)
    assert (rent_card_after.amount_minor, rent_card_after.unit_price_minor) == (300_000, None)


def test_going_back_divides_by_ten_when_no_third_decimal_is_used() -> None:
    migrate_to(THOUSANDTHS)
    new = models_at(THOUSANDTHS)
    profile = create_profile("thousandths_1")
    income = new_income(new, new_month(new, profile.id), 12_340)  # 12.340

    migrate_to(CENTS)

    old = models_at(CENTS)
    assert old.get_model("finance", "MonthIncome").objects.get(pk=income.pk).amount_minor == 1_234


def test_going_back_refuses_to_lose_a_thousandth() -> None:
    migrate_to(THOUSANDTHS)
    new = models_at(THOUSANDTHS)
    profile = create_profile("thousandths_2")
    income = new_income(new, new_month(new, profile.id), 12_345)  # 12.345: the 5 has no place

    with pytest.raises(DatabaseError, match="third decimal"):
        migrate_to(CENTS)

    # Nothing changed: the amount is intact and 0004 is still applied.
    after = models_at(THOUSANDTHS).get_model("finance", "MonthIncome")
    assert after.objects.get(pk=income.pk).amount_minor == 12_345
    assert "0004_money_in_thousandths" in applied_finance_migrations()

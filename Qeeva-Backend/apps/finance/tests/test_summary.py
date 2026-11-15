"""Reading a month from the database and calculating it (``summarize_month_from_db``)."""

from __future__ import annotations

from datetime import date

import pytest

from apps.accounts.tests.helpers import create_profile
from apps.finance.summary import summarize_month_from_db
from apps.finance.tests.helpers import create_card, create_income, create_item, create_month

pytestmark = pytest.mark.django_db


def test_month_without_anything_is_all_zero() -> None:
    summary = summarize_month_from_db(create_month(create_profile()))
    assert summary.total_income_minor == 0
    assert summary.planned_outflow_minor == 0
    assert summary.free_money_minor == 0


def test_income_lines_are_added_up() -> None:
    month = create_month(create_profile())
    create_income(month, 40_000, name="Salary")
    create_income(month, 10_000, name="Side job")
    assert summarize_month_from_db(month).total_income_minor == 50_000


def test_the_owners_example_from_the_database() -> None:
    profile = create_profile()
    month = create_month(profile)
    create_income(month, 50_000)
    create_card(month, create_item(profile, "Groceries", "burn"), 45_000)
    create_card(month, create_item(profile, "Car fund", "saving", target_minor=1_400_000), 10_000)
    summary = summarize_month_from_db(month)
    assert summary.free_money_minor == -5_000
    assert summary.actual_saved_minor == 5_000
    assert summary.saving_shortfall_minor == 5_000
    assert summary.overspend_minor == 0


def test_all_three_kinds_are_counted_in_their_own_totals() -> None:
    profile = create_profile()
    month = create_month(profile)
    create_income(month, 100_000)
    create_card(month, create_item(profile, "Rent", "burn"), 30_000)
    create_card(month, create_item(profile, "Income tax", "tax"), 5_000)
    create_card(month, create_item(profile, "Fund", "saving"), 10_000)
    summary = summarize_month_from_db(month)
    assert (summary.burn_minor, summary.tax_minor, summary.saving_target_minor) == (
        30_000,
        5_000,
        10_000,
    )


def test_ignored_cards_are_left_out_and_come_back_when_not_ignored() -> None:
    profile = create_profile()
    month = create_month(profile)
    create_income(month, 50_000)
    card = create_card(month, create_item(profile, "Rent", "burn"), 20_000, is_ignored=True)
    assert summarize_month_from_db(month).real_expense_minor == 0
    card.is_ignored = False
    card.save()
    assert summarize_month_from_db(month).real_expense_minor == 20_000


def test_several_cards_of_the_same_item_in_a_month_are_all_counted() -> None:
    profile = create_profile()
    month = create_month(profile)
    item = create_item(profile, "Food", "burn")
    create_card(month, item, 1_000, importance="want")
    create_card(month, item, 2_000, importance="must")
    assert summarize_month_from_db(month).burn_minor == 3_000


def test_other_months_and_other_users_are_not_mixed_in() -> None:
    mine, other = create_profile("mine_1"), create_profile("other_1")
    my_month = create_month(mine, date(2026, 11, 1))
    create_income(my_month, 10_000)
    create_card(my_month, create_item(mine, "Rent", "burn"), 4_000)
    # Another month of the same user, and the same month of another user.
    other_month_same_user = create_month(mine, date(2026, 10, 1))
    create_income(other_month_same_user, 999_999)
    create_card(other_month_same_user, create_item(mine, "Old", "burn"), 888_888)
    their_month = create_month(other, date(2026, 11, 1))
    create_income(their_month, 777_777)
    create_card(their_month, create_item(other, "Rent", "burn"), 666_666)

    summary = summarize_month_from_db(my_month)
    assert summary.total_income_minor == 10_000
    assert summary.real_expense_minor == 4_000


def test_it_uses_a_fixed_number_of_queries(django_assert_num_queries: object) -> None:
    profile = create_profile()
    month = create_month(profile)
    create_income(month, 1_000)
    for index in range(5):
        create_card(month, create_item(profile, f"Item {index}", "burn"), 100)
    # One query for the income total and one for all cards, however many cards there are.
    with django_assert_num_queries(2):  # type: ignore[operator]
        summarize_month_from_db(month)

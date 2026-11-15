"""The month formulas: shared vectors, the owner's examples, and rules that must always hold.

No database is needed here, so these tests also run when ``QEEVA_TEST_DATABASE_URL`` is not set.
"""

from __future__ import annotations

import json
import random
from pathlib import Path
from typing import Any

import pytest

from apps.finance.calculations import CardAmount, MonthSummary, summarize_month
from apps.finance.models import ItemType

VECTORS = json.loads((Path(__file__).parent / "vectors" / "month_summary.json").read_text())[
    "cases"
]

# Vector key -> MonthSummary field.
FIELDS = {
    "planned_outflow": "planned_outflow_minor",
    "free_money": "free_money_minor",
    "real_expense": "real_expense_minor",
    "savings_balance": "savings_balance_minor",
    "actual_saved": "actual_saved_minor",
    "overspend": "overspend_minor",
    "saving_shortfall": "saving_shortfall_minor",
}


def cards_from(vector_cards: list[dict[str, Any]]) -> list[CardAmount]:
    return [
        CardAmount(c["type"], c["amount"], is_ignored=c.get("ignored", False)) for c in vector_cards
    ]


@pytest.mark.parametrize("case", VECTORS, ids=[case["name"] for case in VECTORS])
def test_shared_vectors(case: dict[str, Any]) -> None:
    summary = summarize_month(case["income"], cards_from(case["cards"]))
    actual = {key: getattr(summary, attribute) for key, attribute in FIELDS.items()}
    assert actual == case["expected"]


def test_vectors_cover_every_formula_edge() -> None:
    # A reminder to add a vector when a new edge appears: each of these must occur at least once.
    summaries = [summarize_month(c["income"], cards_from(c["cards"])) for c in VECTORS]
    assert any(s.free_money_minor < 0 for s in summaries)
    assert any(s.savings_balance_minor < 0 for s in summaries)
    assert any(s.overspend_minor > 0 for s in summaries)
    assert any(s.saving_shortfall_minor > 0 for s in summaries)
    assert any(s.saving_shortfall_minor == 0 and s.saving_target_minor > 0 for s in summaries)


class TestOwnersExamples:
    """The example from the project description, read with the approved formulas.

    Income 500.00, saving goal 100.00, planned outflow 550.00 (so spending + taxes = 450.00).
    """

    def test_planned_outflow_bigger_than_income_but_spending_is_covered(self) -> None:
        summary = summarize_month(
            50_000, [CardAmount("burn", 45_000), CardAmount("saving", 10_000)]
        )
        assert summary.free_money_minor == -5_000  # the plan is 50.00 over the income
        assert summary.actual_saved_minor == 5_000  # 50.00 really saved
        assert summary.saving_shortfall_minor == 5_000  # the goal is missed by 50.00
        assert summary.overspend_minor == 0  # real spending is not over the income
        assert summary.is_over_budget
        assert summary.missed_saving_goal
        assert not summary.is_overspent

    def test_real_spending_over_income_saves_nothing(self) -> None:
        summary = summarize_month(
            50_000, [CardAmount("burn", 55_000), CardAmount("saving", 10_000)]
        )
        assert summary.overspend_minor == 5_000
        assert summary.savings_balance_minor == -5_000  # shown as negative
        assert summary.actual_saved_minor == 0
        assert summary.saving_shortfall_minor == 10_000  # the whole target is missed
        assert summary.is_overspent


class TestIgnoredCards:
    def test_ignored_cards_change_nothing(self) -> None:
        base = [CardAmount("burn", 1_000), CardAmount("saving", 500)]
        with_ignored = [*base, *(CardAmount(t, 7_777, is_ignored=True) for t in ItemType.values)]
        assert summarize_month(5_000, with_ignored) == summarize_month(5_000, base)

    def test_toggling_ignore_back_restores_the_numbers(self) -> None:
        card = CardAmount("burn", 2_000)
        counted = summarize_month(5_000, [card])
        ignored = summarize_month(5_000, [CardAmount("burn", 2_000, is_ignored=True)])
        assert counted.real_expense_minor == 2_000
        assert ignored.real_expense_minor == 0


class TestInvalidInput:
    def test_negative_income(self) -> None:
        with pytest.raises(ValueError, match="income"):
            summarize_month(-1, [])

    def test_negative_card_amount(self) -> None:
        with pytest.raises(ValueError, match="negative"):
            summarize_month(100, [CardAmount("burn", -1)])

    def test_negative_amount_is_rejected_even_when_ignored(self) -> None:
        # A negative amount is a bug whether or not the card counts, so it must not hide.
        with pytest.raises(ValueError, match="negative"):
            summarize_month(100, [CardAmount("burn", -1, is_ignored=True)])

    @pytest.mark.parametrize("item_type", ["", "income", "Burn", "debit"])
    def test_unknown_item_type(self, item_type: str) -> None:
        with pytest.raises(ValueError, match="unknown item type"):
            summarize_month(100, [CardAmount(item_type, 1)])

    def test_accepts_any_iterable_of_cards(self) -> None:
        summary = summarize_month(1_000, (CardAmount("burn", 100) for _ in range(3)))
        assert summary.burn_minor == 300


class TestFormulaIdentities:
    """Rules that hold for every input. A seeded random run checks them on many months."""

    @staticmethod
    def random_month(rng: random.Random) -> tuple[int, list[CardAmount]]:
        income = rng.choice([0, rng.randint(0, 1_000_000)])
        cards = [
            CardAmount(
                rng.choice(ItemType.values), rng.randint(0, 500_000), is_ignored=rng.random() < 0.2
            )
            for _ in range(rng.randint(0, 12))
        ]
        return income, cards

    def check(self, income: int, summary: MonthSummary) -> None:
        # The two ways of writing the plan agree.
        assert (
            summary.planned_outflow_minor
            == summary.real_expense_minor + summary.saving_target_minor
        )
        assert summary.free_money_minor == income - summary.planned_outflow_minor
        assert summary.savings_balance_minor == income - summary.real_expense_minor
        # Free money is the saving balance minus the saving target.
        assert (
            summary.free_money_minor == summary.savings_balance_minor - summary.saving_target_minor
        )
        # Nothing here can be negative except the two "can be negative" numbers.
        assert summary.actual_saved_minor >= 0
        assert summary.overspend_minor >= 0
        assert 0 <= summary.saving_shortfall_minor <= summary.saving_target_minor
        # Overspending means nothing is saved and the whole target is missed.
        if summary.overspend_minor > 0:
            assert summary.actual_saved_minor == 0
            assert summary.saving_shortfall_minor == summary.saving_target_minor
        # Overspend and real savings can never both exist in one month.
        assert not (summary.overspend_minor > 0 and summary.actual_saved_minor > 0)
        # The saving goal is met exactly when the saved amount reaches the target.
        assert (summary.saving_shortfall_minor == 0) == (
            summary.actual_saved_minor >= summary.saving_target_minor
        )
        # A positive free money means the whole plan fits, so the goal is met too.
        if summary.free_money_minor >= 0:
            assert summary.saving_shortfall_minor == 0
            assert not summary.is_overspent

    def test_identities_hold_for_many_random_months(self) -> None:
        rng = random.Random(20261115)  # noqa: S311  (test data, not security; fixed seed)
        for _ in range(2_000):
            income, cards = self.random_month(rng)
            self.check(income, summarize_month(income, cards))

    def test_order_of_cards_does_not_matter(self) -> None:
        rng = random.Random(7)  # noqa: S311  (test data, not security)
        income, cards = self.random_month(rng)
        shuffled = cards[:]
        rng.shuffle(shuffled)
        assert summarize_month(income, cards) == summarize_month(income, shuffled)

    def test_adding_a_saving_card_never_changes_real_expense_or_overspend(self) -> None:
        # Saving cards are plans, not real expenses (spec): they only move the plan numbers.
        base = summarize_month(1_000, [CardAmount("burn", 1_500)])
        with_saving = summarize_month(1_000, [CardAmount("burn", 1_500), CardAmount("saving", 300)])
        assert with_saving.real_expense_minor == base.real_expense_minor
        assert with_saving.overspend_minor == base.overspend_minor
        assert with_saving.savings_balance_minor == base.savings_balance_minor
        assert with_saving.planned_outflow_minor == base.planned_outflow_minor + 300


def test_summary_is_immutable() -> None:
    summary = summarize_month(100, [])
    with pytest.raises(AttributeError):
        summary.free_money_minor = 5  # type: ignore[misc]

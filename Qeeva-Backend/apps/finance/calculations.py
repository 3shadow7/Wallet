"""The month formulas (the numbers on the dashboard cards), as pure Python.

"Pure" means: no database, no Django, no clock. Numbers go in, numbers come out. That makes the
formulas easy to test, and it is the one place where they are written in the backend (D-032:
the app only calculates, it never invents or changes a value).

Rules (approved dashboard spec; they also equal the Angular ``FinancialCalculatorService``):

* Ignored cards are left out of everything (they stay visible in the app, but do not count).
* Only three kinds of item exist: ``burn`` (normal spending), ``tax`` and ``saving``.
* A saving card is a *plan* ("I want to put this aside"), not a real expense.

    planned_outflow = burn + tax + saving_target      (what the user plans to send out)
    free_money      = income - planned_outflow        (can be negative)
    real_expense    = burn + tax                      (money really spent)
    savings_balance = income - real_expense           (can be negative)
    actual_saved    = max(0, savings_balance)         (what is really left to save)
    overspend       = max(0, real_expense - income)   (spent more than earned)
    saving_shortfall = max(0, saving_target - actual_saved)   (saving goal that was missed)

If burn + tax is more than the income, nothing is saved that month, so the whole saving target is
the shortfall. All amounts are integers in minor units (cents, D-033), so there is no rounding.
"""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass

from apps.finance.models import ItemType


@dataclass(frozen=True, slots=True)
class CardAmount:
    """What the formulas need to know about one card: its kind, its amount and whether it counts."""

    item_type: str  # "burn", "tax" or "saving"
    amount_minor: int
    is_ignored: bool = False


@dataclass(frozen=True, slots=True)
class MonthSummary:
    """The numbers of one month. Every amount is in minor units."""

    total_income_minor: int
    burn_minor: int
    tax_minor: int
    saving_target_minor: int
    planned_outflow_minor: int
    free_money_minor: int
    real_expense_minor: int
    savings_balance_minor: int
    actual_saved_minor: int
    overspend_minor: int
    saving_shortfall_minor: int

    @property
    def is_over_budget(self) -> bool:
        """The plan (spending + taxes + saving targets) is bigger than the income."""
        return self.free_money_minor < 0

    @property
    def is_overspent(self) -> bool:
        """Real spending (without saving) is bigger than the income."""
        return self.overspend_minor > 0

    @property
    def missed_saving_goal(self) -> bool:
        """The month could not save the whole saving target."""
        return self.saving_shortfall_minor > 0


def summarize_month(income_minor: int, cards: Iterable[CardAmount]) -> MonthSummary:
    """Calculate the month numbers from the total income and the month's cards.

    Raises ``ValueError`` for a negative amount or an unknown item type: the database never
    stores those, so seeing one means a bug that must not turn into a plausible-looking number.
    """
    if income_minor < 0:
        raise ValueError("income must not be negative")

    totals = dict.fromkeys(ItemType.values, 0)
    for card in cards:
        if card.item_type not in totals:
            raise ValueError(f"unknown item type: {card.item_type!r}")
        if card.amount_minor < 0:
            raise ValueError("a card amount must not be negative")
        if card.is_ignored:
            continue  # ignored cards do not count anywhere
        totals[card.item_type] += card.amount_minor

    burn, tax, saving_target = totals["burn"], totals["tax"], totals["saving"]
    planned_outflow = burn + tax + saving_target
    real_expense = burn + tax
    savings_balance = income_minor - real_expense
    actual_saved = max(0, savings_balance)

    return MonthSummary(
        total_income_minor=income_minor,
        burn_minor=burn,
        tax_minor=tax,
        saving_target_minor=saving_target,
        planned_outflow_minor=planned_outflow,
        free_money_minor=income_minor - planned_outflow,
        real_expense_minor=real_expense,
        savings_balance_minor=savings_balance,
        actual_saved_minor=actual_saved,
        overspend_minor=max(0, real_expense - income_minor),
        saving_shortfall_minor=max(0, saving_target - actual_saved),
    )

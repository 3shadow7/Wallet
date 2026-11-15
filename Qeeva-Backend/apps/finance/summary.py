"""Read one month from the database and calculate its numbers.

This is the bridge between the tables and the pure formulas in ``calculations.py``.

The caller must have loaded the month with ``Month.objects.for_user(principal)``. The cards and
income lines are found through the month, and the database guarantees (composite foreign keys)
that they belong to the same user as the month, so no other user's row can be mixed in.
"""

from __future__ import annotations

from django.db.models import Sum

from apps.finance.calculations import CardAmount, MonthSummary, summarize_month
from apps.finance.models import Month, MonthIncome, MonthItem


def summarize_month_from_db(month: Month) -> MonthSummary:
    """Return the dashboard numbers of ``month`` (income lines added up, ignored cards left out)."""
    # SUM over no rows is NULL in SQL, which Django returns as None: a month without income is 0.
    income_total = MonthIncome.objects.filter(month=month).aggregate(total=Sum("amount_minor"))[
        "total"
    ]
    # One query for all cards of the month; the item gives the kind (burn / tax / saving).
    rows = MonthItem.objects.filter(month=month).values_list(
        "item__type", "amount_minor", "is_ignored"
    )
    cards = [CardAmount(item_type=t, amount_minor=a, is_ignored=i) for t, a, i in rows]
    return summarize_month(income_total or 0, cards)

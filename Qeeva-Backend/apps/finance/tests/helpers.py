"""Small builders used by the finance tests."""

from __future__ import annotations

from datetime import date
from typing import Any

from apps.accounts.models import Profile
from apps.finance.models import Item, ItemType, Month, MonthIncome, MonthItem


def create_month(profile: Profile, month_start: date = date(2026, 11, 1), **fields: Any) -> Month:
    # ``objects`` is untyped (Any) with the pinned django-stubs, so the result is annotated here.
    month: Month = Month.objects.create(user=profile, month_start=month_start, **fields)
    return month


def create_item(
    profile: Profile, name: str = "Rent", type: str = ItemType.BURN, **fields: Any
) -> Item:
    item: Item = Item.objects.create(user=profile, name=name, type=type, **fields)
    return item


def create_income(month: Month, amount_minor: int = 50_000, **fields: Any) -> MonthIncome:
    income: MonthIncome = MonthIncome.objects.create(
        user_id=month.user_id, month=month, amount_minor=amount_minor, **fields
    )
    return income


def create_card(month: Month, item: Item, amount_minor: int = 10_000, **fields: Any) -> MonthItem:
    """A card for ``item`` in ``month``. The owner is taken from the month."""
    card: MonthItem = MonthItem.objects.create(
        user_id=month.user_id, month=month, item=item, amount_minor=amount_minor, **fields
    )
    return card

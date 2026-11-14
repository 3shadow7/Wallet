"""``for_user`` returns only the caller's rows, for every finance table."""

from __future__ import annotations

import uuid
from datetime import date
from typing import Any

import pytest
from django.core.exceptions import ImproperlyConfigured

from apps.accounts.models import Profile
from apps.accounts.tests.helpers import create_profile
from apps.finance.models import Item, ItemMergeDismissal, Month, MonthIncome, MonthItem
from apps.finance.tests.helpers import create_card, create_income, create_item, create_month
from common.auth import SupabasePrincipal

pytestmark = pytest.mark.django_db


def principal_for(profile: Profile) -> SupabasePrincipal:
    return SupabasePrincipal(id=profile.id, claims={})


def fill(profile: Profile) -> None:
    month, car, flat = (
        create_month(profile),
        create_item(profile, "Car", "saving"),
        create_item(profile),
    )
    create_income(month)
    create_card(month, car)
    create_card(month, flat)
    first, second = (car, flat) if car.pk < flat.pk else (flat, car)
    ItemMergeDismissal.objects.create(user=profile, item_a=first, item_b=second)


@pytest.mark.parametrize("model", [Month, MonthIncome, Item, MonthItem, ItemMergeDismissal])
def test_for_user_returns_only_the_callers_rows(model: Any) -> None:
    mine, other = create_profile("mine_1"), create_profile("other_1")
    fill(mine)
    fill(other)
    rows = list(model.objects.for_user(principal_for(mine)))
    assert rows, f"{model.__name__}: the caller must see their own rows"
    assert {row.user_id for row in rows} == {mine.id}
    assert model.objects.count() > len(rows), "the other user's rows must exist but stay hidden"


@pytest.mark.parametrize("model", [Month, MonthIncome, Item, MonthItem, ItemMergeDismissal])
def test_an_unknown_caller_sees_nothing(model: Any) -> None:
    fill(create_profile("someone"))
    stranger = SupabasePrincipal(id=uuid.uuid4(), claims={})
    assert not model.objects.for_user(stranger).exists()


def test_every_finance_model_is_scoped_by_user_id() -> None:
    for model in (Month, MonthIncome, Item, MonthItem, ItemMergeDismissal):
        assert model.OWNER_FIELD == "user_id"


def test_for_user_works_for_a_month_lookup_by_date() -> None:
    mine, other = create_profile("mine_1"), create_profile("other_1")
    create_month(mine, date(2026, 1, 1))
    create_month(other, date(2026, 1, 1))
    found = Month.objects.for_user(principal_for(mine)).get(month_start=date(2026, 1, 1))
    assert found.user_id == mine.id


def test_a_model_without_owner_cannot_be_read_for_a_user() -> None:
    # Sanity check of the shared rule (accounts has the real internal table; this keeps the
    # finance suite honest if OWNER_FIELD is ever set to None by mistake).
    original = Month.OWNER_FIELD
    try:
        Month.OWNER_FIELD = None  # type: ignore[assignment]
        with pytest.raises(ImproperlyConfigured):
            Month.objects.for_user(SupabasePrincipal(id=uuid.uuid4(), claims={}))
    finally:
        Month.OWNER_FIELD = original

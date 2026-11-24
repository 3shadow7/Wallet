"""The funds ledger ``fund_entries`` (D-118, D-123, D-215) and the card's ``reduction_minor``
(D-117)."""

from __future__ import annotations

from typing import Any

import pytest
from django.core.exceptions import ValidationError
from django.db import IntegrityError, connection, transaction
from django.utils import timezone

from apps.accounts.models import Profile
from apps.accounts.tests.helpers import create_profile
from apps.finance.models import FundEntry, Month, MonthItem
from apps.finance.tests.helpers import create_card, create_item, create_month
from common.auth import SupabasePrincipal

pytestmark = pytest.mark.django_db


def entry(profile: Profile, kind: str = "add", amount: int = 1_000, **fields: Any) -> FundEntry:
    month = fields.pop("month", None) or create_month(profile)
    row: FundEntry = FundEntry.objects.create(
        user=profile, month=month, kind=kind, amount_minor=amount, **fields
    )
    return row


def refused() -> Any:
    """The database must refuse the write; the savepoint keeps the test transaction usable."""
    return pytest.raises(IntegrityError)


class TestFundEntries:
    def test_the_owners_example_opening_then_a_move_into_a_saving_item(self) -> None:
        profile = create_profile()
        month = create_month(profile)
        car = create_item(profile, "Car fund", "saving")
        entry(profile, "opening", 2_000_000, month=month)  # 2,000 counted
        entry(profile, "to_item", 500_000, month=month, item=car)  # 500 of it for the car
        kinds = list(FundEntry.objects.filter(user=profile).values_list("kind", flat=True))
        assert sorted(kinds) == ["opening", "to_item"]

    def test_only_one_first_count_per_user(self) -> None:
        profile = create_profile()
        first = entry(profile, "opening")
        with refused(), transaction.atomic():
            entry(profile, "opening", month=first.month)
        # After the first one is deleted (a fresh start), a new first count is allowed.
        FundEntry.objects.filter(pk=first.pk).update(deleted_at=timezone.now())
        entry(profile, "opening", month=first.month)

    def test_each_user_has_his_own_first_count(self) -> None:
        entry(create_profile("first_1"), "opening")
        entry(create_profile("second_1"), "opening")
        assert FundEntry.objects.filter(kind="opening").count() == 2

    @pytest.mark.parametrize("kind", ["to_item", "from_item"])
    def test_item_moves_need_an_item(self, kind: str) -> None:
        with refused(), transaction.atomic():
            entry(create_profile(), kind)

    @pytest.mark.parametrize("kind", ["opening", "add", "withdraw"])
    def test_other_kinds_never_carry_an_item(self, kind: str) -> None:
        profile = create_profile()
        with refused(), transaction.atomic():
            entry(profile, kind, item=create_item(profile, "Car fund", "saving"))

    @pytest.mark.parametrize(
        ("field", "value"),
        [
            ("kind", "gift"),
            ("kind", "bonus"),
            ("amount_minor", 0),
            ("amount_minor", -5),
            ("note", ""),
        ],
    )
    def test_the_database_refuses_bad_values(self, field: str, value: object) -> None:
        values: dict[str, Any] = {"kind": "add", "amount_minor": 1_000, field: value}
        profile = create_profile()
        with refused(), transaction.atomic():
            FundEntry.objects.create(user=profile, month=create_month(profile), **values)

    def test_a_long_note_is_refused(self) -> None:
        with refused(), transaction.atomic():
            entry(create_profile(), note="x" * 61)

    def test_only_a_saving_item_can_hold_funds(self) -> None:
        profile = create_profile()
        rent = create_item(profile, "Rent", "burn")
        row = FundEntry(
            user=profile, month=create_month(profile), kind="to_item", amount_minor=1, item=rent
        )
        with pytest.raises(ValidationError, match="saving item"):
            row.full_clean()

    def test_a_month_with_entries_cannot_be_erased(self) -> None:
        profile = create_profile()
        month = create_month(profile)
        entry(profile, month=month)
        with refused(), transaction.atomic(), connection.cursor() as cursor:
            cursor.execute("DELETE FROM months WHERE id = %s", [month.pk])
        assert Month.objects.filter(pk=month.pk).exists()

    def test_deleting_a_saving_item_frees_its_money(self) -> None:
        profile = create_profile()
        car = create_item(profile, "Car fund", "saving")
        move = entry(profile, "to_item", item=car)
        with connection.cursor() as cursor:  # the database rule, not Django's
            cursor.execute("DELETE FROM items WHERE id = %s", [car.pk])
        assert not FundEntry.objects.filter(pk=move.pk).exists()

    def test_an_entry_cannot_use_another_users_month_or_item(self) -> None:
        mine, other = create_profile("mine_1"), create_profile("other_1")
        with refused(), transaction.atomic():
            FundEntry.objects.create(
                user=mine, month=create_month(other), kind="add", amount_minor=1
            )
        with refused(), transaction.atomic():
            FundEntry.objects.create(
                user=mine,
                month=create_month(mine),
                kind="to_item",
                amount_minor=1,
                item=create_item(other, "Car fund", "saving"),
            )

    def test_deleting_the_user_in_supabase_deletes_his_entries(self) -> None:
        profile = create_profile()
        entry(profile, "opening")
        with connection.cursor() as cursor:
            cursor.execute("DELETE FROM auth.users WHERE id = %s", [profile.id])
        assert not FundEntry.objects.filter(user_id=profile.id).exists()

    def test_one_user_never_sees_another_users_entries(self) -> None:
        mine, other = create_profile("mine_1"), create_profile("other_1")
        entry(other)
        principal = SupabasePrincipal(id=mine.id, claims={})
        assert list(FundEntry.objects.for_user(principal)) == []


class TestReduction:
    def test_not_chosen_is_empty_and_a_choice_up_to_the_card_is_kept(self) -> None:
        profile = create_profile()
        card = create_card(
            create_month(profile), create_item(profile, "Car fund", "saving"), 100_000
        )
        assert card.reduction_minor is None  # not chosen: shared pro-rata (D-119)
        MonthItem.objects.filter(pk=card.pk).update(reduction_minor=100_000)
        assert MonthItem.objects.get(pk=card.pk).reduction_minor == 100_000

    @pytest.mark.parametrize("value", [-1, 100_001])
    def test_a_reduction_outside_the_card_is_refused(self, value: int) -> None:
        profile = create_profile()
        card = create_card(
            create_month(profile), create_item(profile, "Car fund", "saving"), 100_000
        )
        with refused(), transaction.atomic():
            MonthItem.objects.filter(pk=card.pk).update(reduction_minor=value)

    def test_only_a_saving_card_can_be_reduced(self) -> None:
        profile = create_profile()
        card = create_card(create_month(profile), create_item(profile, "Rent", "burn"), 100_000)
        card.reduction_minor = 10_000
        with pytest.raises(ValidationError, match="saving card"):
            card.full_clean()

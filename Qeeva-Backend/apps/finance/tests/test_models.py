"""Database rules of the finance tables (run against a real PostgreSQL).

Each rule is tested through the database on purpose: ``create()`` does not run Python
validation, so a failure here proves the database itself says no.
"""

from __future__ import annotations

import uuid
from datetime import date
from decimal import Decimal

import pytest
from django.core.exceptions import ValidationError
from django.db import IntegrityError, connection, transaction
from django.db.models import RestrictedError

from apps.accounts.models import Profile
from apps.accounts.tests.helpers import create_profile
from apps.finance.models import Item, ItemMergeDismissal, Month, MonthIncome, MonthItem
from apps.finance.tests.helpers import create_card, create_income, create_item, create_month

pytestmark = pytest.mark.django_db


def rejected() -> pytest.RaisesExc[IntegrityError]:
    """``with rejected():`` = the database must refuse this write."""
    return pytest.raises(IntegrityError)


class TestMonth:
    def test_defaults(self) -> None:
        month = create_month(create_profile())
        month.refresh_from_db()
        assert month.totals_mode == "auto"
        assert month.created_at is not None
        assert month.updated_at >= month.created_at
        assert str(month) == "2026-11"

    @pytest.mark.parametrize("day", [2, 15, 28, 31])
    def test_month_must_start_on_the_first_day_in_the_database(self, day: int) -> None:
        with rejected(), transaction.atomic():
            create_month(create_profile(), date(2026, 12, day))

    def test_month_start_python_validation(self) -> None:
        with pytest.raises(ValidationError) as error:
            Month(user=create_profile(), month_start=date(2026, 12, 5)).full_clean(exclude=["user"])
        assert "month_start" in error.value.message_dict

    @pytest.mark.parametrize("mode", ["auto", "included", "excluded"])
    def test_valid_totals_modes(self, mode: str) -> None:
        assert create_month(create_profile(), totals_mode=mode).totals_mode == mode

    @pytest.mark.parametrize("mode", ["", "yes", "Auto"])
    def test_invalid_totals_mode_rejected(self, mode: str) -> None:
        with rejected(), transaction.atomic():
            create_month(create_profile(), totals_mode=mode)

    def test_one_month_per_user(self) -> None:
        profile = create_profile()
        create_month(profile)
        with rejected(), transaction.atomic():
            create_month(profile)

    def test_two_users_can_have_the_same_month(self) -> None:
        create_month(create_profile("first_user"))
        create_month(create_profile("second_user"))
        assert Month.objects.count() == 2

    def test_month_must_belong_to_a_real_profile(self) -> None:
        with rejected(), transaction.atomic():
            Month.objects.create(user_id=uuid.uuid4(), month_start=date(2026, 11, 1))


class TestMonthIncome:
    def test_defaults(self) -> None:
        income = create_income(create_month(create_profile()))
        income.refresh_from_db()
        assert income.name is None
        assert income.hours_per_day == Decimal("8.00")
        assert income.days_per_week == 5
        assert income.work_hours_override is None
        assert income.hourly_rate_manual_minor is None

    def test_a_month_can_have_several_income_lines(self) -> None:
        month = create_month(create_profile())
        create_income(month, name="Salary")
        create_income(month, name="Freelance")
        assert month.incomes.count() == 2

    @pytest.mark.parametrize("name", ["S", "x" * 30])
    def test_name_length_allowed(self, name: str) -> None:
        assert create_income(create_month(create_profile()), name=name).name == name

    @pytest.mark.parametrize("name", ["", "x" * 31])
    def test_name_length_rejected(self, name: str) -> None:
        with rejected(), transaction.atomic():
            create_income(create_month(create_profile()), name=name)

    def test_amount_may_be_zero_but_not_negative(self) -> None:
        month = create_month(create_profile())
        assert create_income(month, amount_minor=0).amount_minor == 0
        with rejected(), transaction.atomic():
            create_income(month, amount_minor=-1)

    @pytest.mark.parametrize("hours", [Decimal("0"), Decimal("7.5"), Decimal("24")])
    def test_hours_per_day_allowed(self, hours: Decimal) -> None:
        assert (
            create_income(create_month(create_profile()), hours_per_day=hours).hours_per_day
            == hours
        )

    @pytest.mark.parametrize("hours", [Decimal("-0.5"), Decimal("24.01")])
    def test_hours_per_day_rejected(self, hours: Decimal) -> None:
        with rejected(), transaction.atomic():
            create_income(create_month(create_profile()), hours_per_day=hours)

    @pytest.mark.parametrize("days", [1, 7])
    def test_days_per_week_allowed(self, days: int) -> None:
        assert (
            create_income(create_month(create_profile()), days_per_week=days).days_per_week == days
        )

    @pytest.mark.parametrize("days", [0, 8, -1])
    def test_days_per_week_rejected(self, days: int) -> None:
        with rejected(), transaction.atomic():
            create_income(create_month(create_profile()), days_per_week=days)

    @pytest.mark.parametrize("hours", [1, 160, 744])
    def test_work_hours_override_allowed(self, hours: int) -> None:
        income = create_income(create_month(create_profile()), work_hours_override=hours)
        assert income.work_hours_override == hours

    @pytest.mark.parametrize("hours", [0, 745, -5])
    def test_work_hours_override_rejected(self, hours: int) -> None:
        with rejected(), transaction.atomic():
            create_income(create_month(create_profile()), work_hours_override=hours)

    def test_manual_hourly_rate_must_be_positive(self) -> None:
        month = create_month(create_profile())
        assert create_income(month, hourly_rate_manual_minor=1).hourly_rate_manual_minor == 1
        for bad in (0, -100):
            with rejected(), transaction.atomic():
                create_income(month, hourly_rate_manual_minor=bad)

    def test_income_cannot_point_at_another_users_month(self) -> None:
        mine, other = create_profile("mine_1"), create_profile("other_1")
        their_month = create_month(other)
        with rejected(), transaction.atomic():
            MonthIncome.objects.create(user=mine, month=their_month, amount_minor=100)

    def test_deleting_a_month_deletes_its_income_lines(self) -> None:
        month = create_month(create_profile())
        create_income(month)
        month.delete()
        assert MonthIncome.objects.count() == 0

    def test_large_amounts_fit(self) -> None:
        income = create_income(create_month(create_profile()), amount_minor=9_000_000_000_000)
        assert income.amount_minor == 9_000_000_000_000


class TestItem:
    def test_name_key_is_filled_in_on_save(self) -> None:
        item = create_item(create_profile(), "  Phone Bill".strip())
        item.refresh_from_db()
        assert item.name == "Phone Bill"
        assert item.name_key == "phone bill"
        assert str(item) == "Phone Bill"

    def test_name_key_follows_a_rename(self) -> None:
        item = create_item(create_profile(), "Rent")
        item.name = "Flat Rent"
        item.save()
        item.refresh_from_db()
        assert item.name_key == "flat rent"

    def test_name_key_is_saved_even_with_update_fields(self) -> None:
        item = create_item(create_profile(), "Rent")
        item.name = "Flat Rent"
        item.save(update_fields=["name"])
        item.refresh_from_db()
        assert item.name_key == "flat rent"

    def test_same_name_and_type_is_one_item_ignoring_case(self) -> None:
        profile = create_profile()
        create_item(profile, "Rent")
        with rejected(), transaction.atomic():
            create_item(profile, "RENT")

    def test_same_name_with_different_arabic_spelling_is_one_item(self) -> None:
        profile = create_profile()
        create_item(profile, "أجارة")  # alef-hamza + teh marbuta
        with rejected(), transaction.atomic():
            create_item(profile, "اجاره")  # plain alef + heh

    def test_same_name_with_a_different_type_is_a_different_item(self) -> None:
        profile = create_profile()
        create_item(profile, "Car", "burn")
        create_item(profile, "Car", "saving")
        assert Item.objects.count() == 2

    def test_two_users_can_have_the_same_item(self) -> None:
        create_item(create_profile("first_user"), "Rent")
        create_item(create_profile("second_user"), "Rent")
        assert Item.objects.count() == 2

    @pytest.mark.parametrize("name", ["a", "x" * 40, "Phone bill", "إيجار"])
    def test_valid_names(self, name: str) -> None:
        Item(user=create_profile(), name=name, type="burn").full_clean(exclude=["user", "name_key"])
        assert create_item(create_profile("another_one"), name).name == name

    @pytest.mark.parametrize("name", ["", "x" * 41, " Rent", "Rent ", "Phone  bill"])
    def test_names_rejected_by_the_database(self, name: str) -> None:
        with rejected(), transaction.atomic():
            create_item(create_profile(), name)

    @pytest.mark.parametrize("name", ["", "x" * 41, " Rent", "Rent ", "Phone  bill", "Rent!"])
    def test_names_rejected_by_python_validation(self, name: str) -> None:
        with pytest.raises(ValidationError) as error:
            Item(user=create_profile(), name=name, type="burn").full_clean(
                exclude=["user", "name_key"]
            )
        assert "name" in error.value.message_dict

    def test_empty_name_key_rejected_by_the_database(self) -> None:
        profile = create_profile()
        with rejected(), transaction.atomic(), connection.cursor() as cursor:
            cursor.execute(
                "INSERT INTO items (id, user_id, name, name_key, type) "
                "VALUES (%s, %s, 'x', '', 'burn')",
                [uuid.uuid4(), profile.id],
            )

    @pytest.mark.parametrize("item_type", ["burn", "tax", "saving"])
    def test_valid_types(self, item_type: str) -> None:
        assert create_item(create_profile(), "Thing", item_type).type == item_type

    @pytest.mark.parametrize("item_type", ["", "income", "Burn"])
    def test_invalid_type_rejected(self, item_type: str) -> None:
        with rejected(), transaction.atomic():
            create_item(create_profile(), "Thing", item_type)

    def test_saving_item_may_have_a_target(self) -> None:
        item = create_item(create_profile(), "Car", "saving", target_minor=1_400_000)
        item.refresh_from_db()
        assert item.target_minor == 1_400_000

    @pytest.mark.parametrize("item_type", ["burn", "tax"])
    def test_only_saving_items_may_have_a_target(self, item_type: str) -> None:
        with rejected(), transaction.atomic():
            create_item(create_profile(), "Thing", item_type, target_minor=100)

    @pytest.mark.parametrize("target", [0, -1])
    def test_target_must_be_positive(self, target: int) -> None:
        with rejected(), transaction.atomic():
            create_item(create_profile(), "Car", "saving", target_minor=target)

    def test_item_must_belong_to_a_real_profile(self) -> None:
        with rejected(), transaction.atomic():
            Item.objects.create(user_id=uuid.uuid4(), name="Ghost", type="burn")


class TestMonthItem:
    def test_defaults(self) -> None:
        profile = create_profile()
        card = create_card(create_month(profile), create_item(profile))
        card.refresh_from_db()
        assert card.importance == "want"
        assert card.quantity == 1
        assert card.unit_price_minor is None  # +1 / +N buttons locked (D-065)
        assert card.quantity_needs_review is False
        assert card.is_ignored is False

    def test_there_is_no_is_reducible_column(self) -> None:
        # D-097: the column is not built yet; this guards against adding it by accident.
        assert "is_reducible" not in {field.name for field in MonthItem._meta.get_fields()}

    def test_same_item_and_importance_in_a_month_is_one_card(self) -> None:
        profile = create_profile()
        month, item = create_month(profile), create_item(profile)
        create_card(month, item, importance="want")
        with rejected(), transaction.atomic():
            create_card(month, item, importance="want")

    def test_same_item_with_another_importance_is_another_card(self) -> None:
        profile = create_profile()
        month, item = create_month(profile), create_item(profile)
        for importance in ("want", "must", "emergency", "gift"):
            create_card(month, item, importance=importance)
        assert month.cards.count() == 4

    def test_same_item_in_another_month_is_allowed(self) -> None:
        profile = create_profile()
        item = create_item(profile)
        create_card(create_month(profile, date(2026, 10, 1)), item)
        create_card(create_month(profile, date(2026, 11, 1)), item)
        assert item.cards.count() == 2

    @pytest.mark.parametrize("importance", ["", "urgent", "Want"])
    def test_invalid_importance_rejected(self, importance: str) -> None:
        profile = create_profile()
        with rejected(), transaction.atomic():
            create_card(create_month(profile), create_item(profile), importance=importance)

    def test_amount_may_be_zero_but_not_negative(self) -> None:
        profile = create_profile()
        month, item = create_month(profile), create_item(profile)
        assert create_card(month, item, amount_minor=0).amount_minor == 0
        with rejected(), transaction.atomic():
            create_card(month, item, amount_minor=-1, importance="must")

    @pytest.mark.parametrize("quantity", [0, -3])
    def test_quantity_must_be_at_least_one(self, quantity: int) -> None:
        profile = create_profile()
        with rejected(), transaction.atomic():
            create_card(create_month(profile), create_item(profile), quantity=quantity)

    def test_unit_price_may_be_null_or_zero_or_more_but_not_negative(self) -> None:
        profile = create_profile()
        month = create_month(profile)
        assert create_card(month, create_item(profile, "A"), unit_price_minor=None)
        assert create_card(month, create_item(profile, "B"), unit_price_minor=0)
        assert create_card(month, create_item(profile, "C"), unit_price_minor=250)
        with rejected(), transaction.atomic():
            create_card(month, create_item(profile, "D"), unit_price_minor=-1)

    def test_card_cannot_point_at_another_users_month(self) -> None:
        mine, other = create_profile("mine_1"), create_profile("other_1")
        with rejected(), transaction.atomic():
            MonthItem.objects.create(
                user=mine, month=create_month(other), item=create_item(mine), amount_minor=1
            )

    def test_card_cannot_point_at_another_users_item(self) -> None:
        mine, other = create_profile("mine_1"), create_profile("other_1")
        with rejected(), transaction.atomic():
            MonthItem.objects.create(
                user=mine, month=create_month(mine), item=create_item(other), amount_minor=1
            )

    def test_deleting_a_month_deletes_its_cards_but_keeps_the_items(self) -> None:
        profile = create_profile()
        month, item = create_month(profile), create_item(profile)
        create_card(month, item)
        month.delete()
        assert MonthItem.objects.count() == 0
        assert Item.objects.filter(pk=item.pk).exists()

    def test_an_item_with_cards_cannot_be_deleted_through_django(self) -> None:
        profile = create_profile()
        item = create_item(profile)
        create_card(create_month(profile), item)
        with pytest.raises(RestrictedError):
            item.delete()

    def test_an_item_with_cards_cannot_be_deleted_in_the_database(self) -> None:
        profile = create_profile()
        item = create_item(profile)
        create_card(create_month(profile), item)
        with rejected(), transaction.atomic(), connection.cursor() as cursor:
            cursor.execute("DELETE FROM items WHERE id = %s", [item.pk])

    def test_an_item_without_cards_can_be_deleted(self) -> None:
        item = create_item(create_profile())
        item.delete()
        assert Item.objects.count() == 0


class TestItemMergeDismissal:
    @staticmethod
    def two_items(profile: Profile) -> tuple[Item, Item]:
        first, second = create_item(profile, "Car", "burn"), create_item(profile, "Car", "saving")
        return (first, second) if first.pk < second.pk else (second, first)

    def test_ordered_pair_puts_the_smaller_id_first(self) -> None:
        small, big = uuid.UUID(int=1), uuid.UUID(int=2)
        assert ItemMergeDismissal.ordered_pair(big, small) == (small, big)
        assert ItemMergeDismissal.ordered_pair(small, big) == (small, big)

    def test_dismissal_is_stored(self) -> None:
        profile = create_profile()
        low, high = self.two_items(profile)
        dismissal = ItemMergeDismissal.objects.create(user=profile, item_a=low, item_b=high)
        dismissal.refresh_from_db()
        assert dismissal.created_at is not None
        assert str(dismissal) == f"{low.pk} + {high.pk}"

    def test_pair_stored_the_wrong_way_round_is_rejected(self) -> None:
        profile = create_profile()
        low, high = self.two_items(profile)
        with rejected(), transaction.atomic():
            ItemMergeDismissal.objects.create(user=profile, item_a=high, item_b=low)

    def test_an_item_cannot_be_dismissed_against_itself(self) -> None:
        profile = create_profile()
        item = create_item(profile)
        with rejected(), transaction.atomic():
            ItemMergeDismissal.objects.create(user=profile, item_a=item, item_b=item)

    def test_the_same_pair_cannot_be_stored_twice(self) -> None:
        profile = create_profile()
        low, high = self.two_items(profile)
        ItemMergeDismissal.objects.create(user=profile, item_a=low, item_b=high)
        with rejected(), transaction.atomic():
            ItemMergeDismissal.objects.create(user=profile, item_a=low, item_b=high)

    def test_dismissal_cannot_use_another_users_item(self) -> None:
        mine, other = create_profile("mine_1"), create_profile("other_1")
        mine_item, other_item = create_item(mine, "Car"), create_item(other, "Car", "saving")
        item_a, item_b = (
            (mine_item, other_item) if mine_item.pk < other_item.pk else (other_item, mine_item)
        )
        with rejected(), transaction.atomic():
            ItemMergeDismissal.objects.create(user=mine, item_a=item_a, item_b=item_b)

    @pytest.mark.parametrize("which", ["first", "second"])
    def test_deleting_either_item_deletes_the_dismissal(self, which: str) -> None:
        profile = create_profile()
        low, high = self.two_items(profile)
        ItemMergeDismissal.objects.create(user=profile, item_a=low, item_b=high)
        (low if which == "first" else high).delete()
        assert ItemMergeDismissal.objects.count() == 0


class TestDeletingAUser:
    """Deleting a Supabase user (the ``auth.users`` row) must remove everything that user owns."""

    @staticmethod
    def fill(profile: Profile) -> None:
        month, item, saving = (
            create_month(profile),
            create_item(profile),
            create_item(profile, "Car", "saving", target_minor=500),
        )
        create_income(month)
        create_card(month, item)
        create_card(month, saving)
        low, high = (item, saving) if item.pk < saving.pk else (saving, item)
        ItemMergeDismissal.objects.create(user=profile, item_a=low, item_b=high)

    def test_everything_of_the_user_goes_and_other_users_stay(self) -> None:
        gone, stays = create_profile("goes_away"), create_profile("stays_here")
        self.fill(gone)
        self.fill(stays)
        with connection.cursor() as cursor:
            cursor.execute("DELETE FROM auth.users WHERE id = %s", [gone.id])
        for model in (Month, MonthIncome, Item, MonthItem, ItemMergeDismissal):
            assert not model.objects.filter(user_id=gone.id).exists(), model.__name__
            assert model.objects.filter(user_id=stays.id).exists(), model.__name__

    def test_deleting_the_profile_through_django_also_works(self) -> None:
        profile = create_profile()
        self.fill(profile)
        profile.delete()
        for model in (Month, MonthIncome, Item, MonthItem, ItemMergeDismissal):
            assert model.objects.count() == 0, model.__name__

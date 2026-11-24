"""The sync columns of every synced table: finance and notifications (D-176, D-180, D-213).

Every row: ``version`` raised by PostgreSQL on each change, ``updated_by_device`` and
``deleted_by_device`` tied to the SAME user's device, ``deleted_at`` for a soft delete that does
not block making the same month or item again.
"""

from __future__ import annotations

from collections.abc import Callable

import pytest
from django.db import IntegrityError, transaction
from django.utils import timezone

from apps.accounts.models import Device, Notification, Profile, SyncedModel
from apps.accounts.tests.helpers import create_profile
from apps.finance.models import FundEntry, Item, ItemMergeDismissal, Month, MonthIncome, MonthItem
from apps.finance.tests.helpers import create_card, create_income, create_item, create_month

pytestmark = pytest.mark.django_db


def create_device(profile: Profile, name: str = "Phone") -> Device:
    device: Device = Device.objects.create(user=profile, name=name, platform="android")
    return device


def a_dismissal(profile: Profile) -> ItemMergeDismissal:
    low, high = sorted(
        [create_item(profile, "Rent"), create_item(profile, "Rentt")], key=lambda i: i.pk
    )
    dismissal: ItemMergeDismissal = ItemMergeDismissal.objects.create(
        user=profile, item_a=low, item_b=high
    )
    return dismissal


# One way to make a row of each synced finance table.
ROW_MAKERS: dict[str, Callable[[Profile], SyncedModel]] = {
    "months": lambda p: create_month(p),
    "month_incomes": lambda p: create_income(create_month(p)),
    "items": lambda p: create_item(p),
    "month_items": lambda p: create_card(create_month(p), create_item(p)),
    "item_merge_dismissals": a_dismissal,
    "fund_entries": lambda p: FundEntry.objects.create(
        user=p, month=create_month(p), kind="add", amount_minor=1_000
    ),
    "notifications": lambda p: Notification.objects.create(
        user=p, kind="goal_progress", dedupe_key="goal:x:50"
    ),
}


@pytest.mark.parametrize("table", list(ROW_MAKERS))
class TestEverySyncedTable:
    def test_version_starts_at_1_and_rises_on_every_change(self, table: str) -> None:
        row = ROW_MAKERS[table](create_profile())
        model = type(row)
        assert model._default_manager.get(pk=row.pk).version == 1
        model._default_manager.filter(pk=row.pk).update(deleted_at=None)  # any change counts
        model._default_manager.filter(pk=row.pk).update(deleted_at=timezone.now())  # a soft delete
        assert model._default_manager.get(pk=row.pk).version == 3

    def test_a_deleted_device_clears_only_its_columns(self, table: str) -> None:
        profile = create_profile()
        row = ROW_MAKERS[table](profile)
        phone = create_device(profile)
        model = type(row)
        model._default_manager.filter(pk=row.pk).update(
            updated_by_device=phone, deleted_by_device=phone, deleted_at=timezone.now()
        )
        phone.delete()
        after = model._default_manager.get(pk=row.pk)  # the row stays, with its owner
        assert (after.updated_by_device_id, after.deleted_by_device_id) == (None, None)
        assert after.deleted_at is not None

    @pytest.mark.parametrize("column", ["updated_by_device", "deleted_by_device"])
    def test_a_row_cannot_name_another_users_device(self, table: str, column: str) -> None:
        row = ROW_MAKERS[table](create_profile("mine_1"))
        strangers_phone = create_device(create_profile("other_1"))
        with pytest.raises(IntegrityError), transaction.atomic():
            type(row)._default_manager.filter(pk=row.pk).update(**{column: strangers_phone})


class TestSoftDeleteDoesNotBlock:
    def test_a_deleted_month_can_be_made_again(self) -> None:
        profile = create_profile()
        old = create_month(profile)
        Month.objects.filter(pk=old.pk).update(deleted_at=timezone.now())
        create_month(profile)  # the same month, made again while the old one waits 45 days
        assert Month.objects.filter(user=profile).count() == 2

    def test_two_active_months_are_still_refused(self) -> None:
        profile = create_profile()
        create_month(profile)
        with pytest.raises(IntegrityError), transaction.atomic():
            create_month(profile)

    def test_a_deleted_item_name_can_be_used_again(self) -> None:
        profile = create_profile()
        old = create_item(profile, "Rent")
        Item.objects.filter(pk=old.pk).update(deleted_at=timezone.now())
        create_item(profile, "Rent")
        with pytest.raises(IntegrityError), transaction.atomic():
            create_item(profile, "rent")  # the active "Rent" still blocks a duplicate

    def test_a_deleted_card_does_not_block_a_new_one(self) -> None:
        profile = create_profile()
        month, item = create_month(profile), create_item(profile)
        old = create_card(month, item)
        MonthItem.objects.filter(pk=old.pk).update(deleted_at=timezone.now())
        create_card(month, item)
        assert MonthItem.objects.filter(month=month).count() == 2

    def test_a_deleted_income_line_stays_until_the_cleanup(self) -> None:
        income = create_income(create_month(create_profile()))
        MonthIncome.objects.filter(pk=income.pk).update(deleted_at=timezone.now())
        assert MonthIncome.objects.get(pk=income.pk).deleted_at is not None

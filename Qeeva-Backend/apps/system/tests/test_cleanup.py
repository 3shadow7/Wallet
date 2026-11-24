"""The daily cleanup (D-214): what is old enough goes, everything else stays."""

from __future__ import annotations

from datetime import datetime, timedelta
from io import StringIO

import pytest
from django.core.management import call_command
from django.utils import timezone

from apps.accounts.models import Notification, Profile
from apps.accounts.tests.helpers import create_profile
from apps.finance.models import FundEntry, Item, ItemMergeDismissal, Month, MonthIncome, MonthItem
from apps.finance.tests.helpers import create_card, create_income, create_item, create_month
from apps.system.cleanup import run_cleanup
from apps.system.models import AppConfigEntry

pytestmark = pytest.mark.django_db

NOW = timezone.now()


def days_ago(days: int) -> datetime:
    return NOW - timedelta(days=days)


def delete_softly(model: type, pk: object, days: int) -> None:
    model._default_manager.filter(pk=pk).update(deleted_at=days_ago(days))  # type: ignore[attr-defined]


def notify(profile: Profile, key: str, seen_days_ago: int | None) -> Notification:
    seen = None if seen_days_ago is None else days_ago(seen_days_ago)
    row: Notification = Notification.objects.create(
        user=profile, kind="goal_progress", dedupe_key=key, seen_at=seen
    )
    return row


class TestDeletedRows:
    def test_a_month_deleted_46_days_ago_goes_with_its_cards_and_income(self) -> None:
        profile = create_profile()
        month = create_month(profile)
        create_income(month)
        create_card(month, create_item(profile))
        delete_softly(Month, month.pk, 46)
        erased = run_cleanup(NOW)
        assert erased["months"] == 1
        assert not Month.objects.filter(pk=month.pk).exists()
        assert not MonthItem.objects.filter(month_id=month.pk).exists()
        assert not MonthIncome.objects.filter(month_id=month.pk).exists()

    def test_a_month_deleted_44_days_ago_waits(self) -> None:
        month = create_month(create_profile())
        delete_softly(Month, month.pk, 44)
        run_cleanup(NOW)
        assert Month.objects.filter(pk=month.pk).exists()  # still restorable

    def test_rows_that_are_not_deleted_are_never_touched(self) -> None:
        profile = create_profile()
        month = create_month(profile)
        create_card(month, create_item(profile))
        run_cleanup(NOW)
        assert Month.objects.count() == 1 and MonthItem.objects.count() == 1

    def test_a_month_that_still_has_funds_entries_is_skipped(self) -> None:
        profile = create_profile()
        month = create_month(profile)
        FundEntry.objects.create(user=profile, month=month, kind="add", amount_minor=1_000)
        delete_softly(Month, month.pk, 50)
        erased = run_cleanup(NOW)  # no error: it is simply tried again tomorrow
        assert erased["months"] == 0
        assert Month.objects.filter(pk=month.pk).exists()

    def test_an_item_that_still_has_cards_is_skipped(self) -> None:
        profile = create_profile()
        item = create_item(profile)
        create_card(create_month(profile), item)
        delete_softly(Item, item.pk, 50)
        assert run_cleanup(NOW)["items"] == 0
        assert Item.objects.filter(pk=item.pk).exists()

    def test_old_deleted_children_go_first_then_their_item(self) -> None:
        profile = create_profile()
        month = create_month(profile)
        item = create_item(profile, "Car fund", "saving")
        card = create_card(month, item)
        move = FundEntry.objects.create(
            user=profile, month=month, kind="to_item", amount_minor=1, item=item
        )
        other = create_item(profile, "Car funds", "saving")
        low, high = sorted([item, other], key=lambda i: i.pk)
        dismissal = ItemMergeDismissal.objects.create(user=profile, item_a=low, item_b=high)
        for model, pk in ((MonthItem, card.pk), (FundEntry, move.pk), (Item, item.pk)):
            delete_softly(model, pk, 46)
        delete_softly(ItemMergeDismissal, dismissal.pk, 46)
        erased = run_cleanup(NOW)
        assert (erased["month_items"], erased["fund_entries"], erased["items"]) == (1, 1, 1)
        assert erased["item_merge_dismissals"] == 1
        assert Item.objects.filter(pk=other.pk).exists()

    def test_the_owner_can_change_the_45_days(self) -> None:
        AppConfigEntry.objects.filter(key="deleted_rows_days").update(value=10)
        month = create_month(create_profile())
        delete_softly(Month, month.pk, 11)
        assert run_cleanup(NOW)["months"] == 1


class TestNotifications:
    def test_seen_more_than_7_days_ago_goes_the_rest_stays(self) -> None:
        profile = create_profile()
        notify(profile, "old_seen", 8)
        notify(profile, "fresh_seen", 6)
        notify(profile, "never_seen", None)
        assert run_cleanup(NOW)["notifications"] == 1
        keys = set(Notification.objects.values_list("dedupe_key", flat=True))
        assert keys == {"fresh_seen", "never_seen"}

    def test_an_old_unseen_notification_stays_until_seen(self) -> None:
        row = notify(create_profile(), "waiting", None)
        Notification.objects.filter(pk=row.pk).update(created_at=days_ago(400))
        run_cleanup(NOW)
        assert Notification.objects.filter(pk=row.pk).exists()

    def test_a_deleted_notification_goes_after_45_days(self) -> None:
        row = notify(create_profile(), "dismissed", None)
        delete_softly(Notification, row.pk, 46)
        assert run_cleanup(NOW)["notifications"] == 1


def test_running_twice_erases_nothing_more() -> None:
    month = create_month(create_profile())
    delete_softly(Month, month.pk, 46)
    run_cleanup(NOW)
    assert all(count == 0 for count in run_cleanup(NOW).values())


def test_the_command_reports_one_line_per_table() -> None:
    month = create_month(create_profile())
    delete_softly(Month, month.pk, 46)
    out = StringIO()
    call_command("daily_cleanup", stdout=out)
    text = out.getvalue()
    assert "months: 1 erased" in text
    assert "Daily cleanup done." in text

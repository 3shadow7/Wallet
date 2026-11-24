"""The daily cleanup (D-214): erase what the app keeps only for a while.

* Rows deleted softly more than ``app_config.deleted_rows_days`` (45) days ago, in every synced
  table (D-176, D-213). Until then they stay, so other devices learn about the delete and the
  user can restore them.
* Notifications seen more than ``app_config.notifications_keep_days`` (7) days ago (D-212).

Children are erased before their parents, and a parent that still has rows the database
protects is skipped (it is tried again the next day):
* an item that still has cards (cards point at items with NO ACTION);
* a month that still has funds entries (D-123: NO ACTION).
Erasing a month also erases its cards and income lines (CASCADE), as deleting a month does.

Later features add their own lines here (remembered pending ids after 90 days, resolved sync
conflicts after 45 days). Running it twice is safe: it only erases what is old enough.
"""

from __future__ import annotations

from datetime import datetime, timedelta

from django.db import transaction
from django.db.models import Exists, OuterRef

from apps.accounts.models import Notification
from apps.finance.models import (
    FundEntry,
    Item,
    ItemMergeDismissal,
    Month,
    MonthIncome,
    MonthItem,
)
from apps.system.config import get_int


def run_cleanup(now: datetime) -> dict[str, int]:
    """Erase everything old enough at ``now``; return how many rows each table lost."""
    deleted_before = now - timedelta(days=get_int("deleted_rows_days"))
    seen_before = now - timedelta(days=get_int("notifications_keep_days"))
    erased: dict[str, int] = {}

    def erase(name: str, count: int) -> None:
        erased[name] = erased.get(name, 0) + count

    # One transaction: either the whole day's cleanup happens or none of it.
    with transaction.atomic():
        # Notifications: seen long enough ago, or deleted long enough ago.
        count, _ = Notification.objects.filter(seen_at__lt=seen_before).delete()
        erase("notifications", count)
        count, _ = Notification.objects.filter(deleted_at__lt=deleted_before).delete()
        erase("notifications", count)

        # The children first.
        for model, name in (
            (FundEntry, "fund_entries"),
            (MonthItem, "month_items"),
            (MonthIncome, "month_incomes"),
            (ItemMergeDismissal, "item_merge_dismissals"),
        ):
            count, _ = model._default_manager.filter(deleted_at__lt=deleted_before).delete()
            erase(name, count)

        # Items: only those with no card left (deleting one also deletes its funds moves and
        # merge dismissals, which Django counts in the total; we report the items alone).
        items = Item.objects.filter(deleted_at__lt=deleted_before).exclude(
            Exists(MonthItem.objects.filter(item=OuterRef("pk")))
        )
        erase("items", len(items.values_list("pk", flat=True)))
        items.delete()

        # Months: only those with no funds entry left (their cards and income lines go too).
        months = Month.objects.filter(deleted_at__lt=deleted_before).exclude(
            Exists(FundEntry.objects.filter(month=OuterRef("pk")))
        )
        erase("months", len(months.values_list("pk", flat=True)))
        months.delete()

    return erased

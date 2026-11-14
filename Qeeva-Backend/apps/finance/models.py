"""The money log: months, income lines, items, monthly cards and merge dismissals.

Design: ``Qeeva-Backend/docs/database/schema-blueprint.md`` (decisions D-036 to D-081).

Rules that apply to every table here:

* Every row carries ``user_id`` (the owner). Reads go through ``Model.objects.for_user(principal)``.
* Money is stored as integer minor units (``bigint``), never as a float (D-033).
* A card can never point at another user's month or item: the database enforces this with
  composite foreign keys such as ``(month_id, user_id)`` -> ``months (id, user_id)``
  (migration 0002), not only our code.
* Django 5.2 cannot express a database-level ``ON DELETE`` rule, so every foreign key is declared
  here with ``db_constraint=False`` and created in migration 0002 as SQL. The ``on_delete`` given
  to Django matches that SQL, so deleting through the ORM and through the database agree.
* Nothing derived is stored: item groups, monthly hours, hourly rate, free money and so on are
  calculated when needed (D-075).
"""

from __future__ import annotations

import uuid
from datetime import date, datetime

from django.core.exceptions import ValidationError
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.db.models import F, Q
from django.db.models.functions import Length, Now, Trim
from django.db.models.functions.datetime import ExtractDay
from django.db.models.lookups import Exact, GreaterThanOrEqual, LessThanOrEqual

from apps.accounts.models import Profile
from apps.finance.naming import NAME_MAX, NAME_MIN, make_name_key, validate_item_name
from common.ownership import OwnedManager

INCOME_NAME_MIN = 1
INCOME_NAME_MAX = 30
MAX_HOURS_PER_DAY = 24
MAX_MONTHLY_HOURS = 744  # 31 days x 24 hours


class TotalsMode(models.TextChoices):
    """Whether a month counts in the long-term totals (D-037)."""

    AUTO = "auto"
    INCLUDED = "included"
    EXCLUDED = "excluded"


class ItemType(models.TextChoices):
    """What an item is. It never changes after the item is created (D-047)."""

    BURN = "burn"
    TAX = "tax"
    SAVING = "saving"


class Importance(models.TextChoices):
    """How much the user needs the thing; only used to sort priority."""

    WANT = "want"
    MUST = "must"
    EMERGENCY = "emergency"
    GIFT = "gift"


def validate_first_day_of_month(value: date) -> None:
    if value.day != 1:
        raise ValidationError("A month starts on the 1st (calendar month).")


def owner_foreign_key(*, db_index: bool = True) -> models.ForeignKey[Profile]:
    """The ``user`` column every table has: the owner of the row.

    ``db_constraint=False``: the real foreign key (``ON DELETE CASCADE`` to ``profiles``) is
    created in migration 0002. ``db_index=False`` is used where a unique constraint that starts
    with ``user_id`` already makes lookups by user fast.
    """
    return models.ForeignKey(
        Profile,
        on_delete=models.CASCADE,
        db_constraint=False,
        db_column="user_id",
        related_name="+",
        db_index=db_index,
    )


def created_at_field() -> models.DateTimeField[datetime, datetime]:
    return models.DateTimeField(auto_now_add=True, db_default=Now())


def updated_at_field() -> models.DateTimeField[datetime, datetime]:
    return models.DateTimeField(auto_now=True, db_default=Now())


# ---------------------------------------------------------------------------------------------
# months
# ---------------------------------------------------------------------------------------------


class MonthManager(OwnedManager["Month"]):
    """Typed manager: lets mypy know which model ``for_user`` returns."""


class Month(models.Model):
    """One calendar month of one user. ``month_start`` is always the 1st."""

    OWNER_FIELD = "user_id"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = owner_foreign_key(db_index=False)  # (user, month_start) is unique and starts with user
    month_start = models.DateField(validators=[validate_first_day_of_month])
    totals_mode = models.TextField(
        choices=TotalsMode.choices, default=TotalsMode.AUTO, db_default=TotalsMode.AUTO
    )
    created_at = created_at_field()
    updated_at = updated_at_field()

    objects = MonthManager()

    class Meta:
        db_table = "months"
        constraints = [
            models.UniqueConstraint(
                fields=["user", "month_start"], name="months_user_month_unique"
            ),
            # Child tables point at (id, user_id): a child can never name a stranger's month.
            models.UniqueConstraint(fields=["id", "user"], name="months_id_user_unique"),
            models.CheckConstraint(
                condition=Q(Exact(ExtractDay("month_start"), 1)),
                name="months_starts_on_first_day",
            ),
            models.CheckConstraint(
                condition=Q(totals_mode__in=TotalsMode.values), name="months_totals_mode_valid"
            ),
        ]

    def __str__(self) -> str:
        return f"{self.month_start:%Y-%m}"


# ---------------------------------------------------------------------------------------------
# month_incomes
# ---------------------------------------------------------------------------------------------


class MonthIncomeManager(OwnedManager["MonthIncome"]):
    """Typed manager: lets mypy know which model ``for_user`` returns."""


class MonthIncome(models.Model):
    """One income line of a month (D-041: a month may have several; Regular mode adds them up).

    Not stored, because they follow from these columns: monthly hours (the override, else
    ``hours_per_day x days_per_week x 4``) and the hourly rate (the manual rate, else
    ``amount / monthly hours``).
    """

    OWNER_FIELD = "user_id"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = owner_foreign_key()
    # The pair (month, user) is tied to months (id, user_id) by a composite foreign key (0002).
    month = models.ForeignKey(
        Month,
        on_delete=models.CASCADE,
        db_constraint=False,
        db_column="month_id",
        related_name="incomes",
    )
    # NULL means "no name"; an empty string is forbidden by a database check (see Meta).
    name = models.TextField(null=True, blank=True)  # noqa: DJ001
    amount_minor = models.BigIntegerField(validators=[MinValueValidator(0)])
    hours_per_day = models.DecimalField(
        max_digits=4,
        decimal_places=2,
        default=8,
        db_default=8,
        validators=[MinValueValidator(0), MaxValueValidator(MAX_HOURS_PER_DAY)],
    )
    days_per_week = models.SmallIntegerField(
        default=5, db_default=5, validators=[MinValueValidator(1), MaxValueValidator(7)]
    )
    # Manual monthly working hours; when set it replaces hours_per_day x days_per_week x 4.
    work_hours_override = models.IntegerField(
        null=True,
        blank=True,
        validators=[MinValueValidator(1), MaxValueValidator(MAX_MONTHLY_HOURS)],
    )
    # Manual hourly rate; when set it replaces amount / monthly hours.
    hourly_rate_manual_minor = models.BigIntegerField(
        null=True, blank=True, validators=[MinValueValidator(1)]
    )
    created_at = created_at_field()
    updated_at = updated_at_field()

    objects = MonthIncomeManager()

    class Meta:
        db_table = "month_incomes"
        constraints = [
            models.CheckConstraint(
                condition=Q(name__isnull=True)
                | Q(
                    GreaterThanOrEqual(Length("name"), INCOME_NAME_MIN),
                    LessThanOrEqual(Length("name"), INCOME_NAME_MAX),
                ),
                name="month_incomes_name_length",
            ),
            models.CheckConstraint(
                condition=Q(amount_minor__gte=0), name="month_incomes_amount_not_negative"
            ),
            models.CheckConstraint(
                condition=Q(hours_per_day__gte=0, hours_per_day__lte=MAX_HOURS_PER_DAY),
                name="month_incomes_hours_per_day_range",
            ),
            models.CheckConstraint(
                condition=Q(days_per_week__gte=1, days_per_week__lte=7),
                name="month_incomes_days_per_week_range",
            ),
            models.CheckConstraint(
                condition=Q(work_hours_override__isnull=True)
                | Q(work_hours_override__gte=1, work_hours_override__lte=MAX_MONTHLY_HOURS),
                name="month_incomes_work_hours_override_range",
            ),
            models.CheckConstraint(
                condition=Q(hourly_rate_manual_minor__isnull=True)
                | Q(hourly_rate_manual_minor__gt=0),
                name="month_incomes_hourly_rate_positive",
            ),
        ]

    def __str__(self) -> str:
        return self.name or "income"


# ---------------------------------------------------------------------------------------------
# items
# ---------------------------------------------------------------------------------------------


class ItemManager(OwnedManager["Item"]):
    """Typed manager: lets mypy know which model ``for_user`` returns."""


class Item(models.Model):
    """A thing the user tracks across months (a rent, a tax, a saving). Cards point at it.

    Same name and same type is the same item (D-055); the comparison uses ``name_key``.
    """

    OWNER_FIELD = "user_id"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = owner_foreign_key(db_index=False)  # (user, name_key, type) is unique, starts with user
    name = models.TextField(validators=[validate_item_name])
    # What ``name`` is compared by (see ``apps/finance/naming.py``). Filled in by ``save()``.
    name_key = models.TextField(editable=False)
    type = models.TextField(choices=ItemType.choices)
    # Long-term goal in minor units. Saving items only (a goal for Tax is deferred, D-073).
    target_minor = models.BigIntegerField(null=True, blank=True, validators=[MinValueValidator(1)])
    created_at = created_at_field()
    updated_at = updated_at_field()

    objects = ItemManager()

    class Meta:
        db_table = "items"
        constraints = [
            models.UniqueConstraint(
                fields=["user", "name_key", "type"], name="items_user_name_key_type_unique"
            ),
            models.UniqueConstraint(fields=["id", "user"], name="items_id_user_unique"),
            models.CheckConstraint(
                condition=Q(
                    GreaterThanOrEqual(Length("name"), NAME_MIN),
                    LessThanOrEqual(Length("name"), NAME_MAX),
                ),
                name="items_name_length",
            ),
            # No leading/trailing space and no two spaces in a row (D-056).
            models.CheckConstraint(
                condition=Q(name=Trim("name")) & ~Q(name__contains="  "),
                name="items_name_spacing",
            ),
            models.CheckConstraint(condition=~Q(name_key=""), name="items_name_key_not_empty"),
            models.CheckConstraint(condition=Q(type__in=ItemType.values), name="items_type_valid"),
            models.CheckConstraint(
                condition=Q(target_minor__isnull=True)
                | (Q(target_minor__gt=0) & Q(type=ItemType.SAVING)),
                name="items_target_only_for_saving",
            ),
        ]

    def __str__(self) -> str:
        return self.name

    def save(self, *args: object, **kwargs: object) -> None:
        # The key always follows the name, so the two can never disagree when saving through
        # Django. (``bulk_create`` skips ``save()``; do not use it for items.)
        self.name_key = make_name_key(self.name)
        update_fields = kwargs.get("update_fields")
        if update_fields is not None:
            kwargs["update_fields"] = {*update_fields, "name_key"}  # type: ignore[misc]
        super().save(*args, **kwargs)  # type: ignore[arg-type]


# ---------------------------------------------------------------------------------------------
# month_items (the cards)
# ---------------------------------------------------------------------------------------------


class MonthItemManager(OwnedManager["MonthItem"]):
    """Typed manager: lets mypy know which model ``for_user`` returns."""


class MonthItem(models.Model):
    """A card: one item inside one month, with its importance, amount and quantity.

    The same item with different importances makes several cards; the "group" the screen shows
    is calculated, not stored (D-075). There is no ``is_reducible`` column (D-097).
    """

    OWNER_FIELD = "user_id"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = owner_foreign_key()
    # Both foreign keys below are composite in the database: (month_id, user_id) -> months and
    # (item_id, user_id) -> items (migration 0002), so a card cannot mix two users' data.
    # (month, item, importance) is unique and starts with month, so month needs no extra index.
    month = models.ForeignKey(
        Month,
        on_delete=models.CASCADE,
        db_constraint=False,
        db_column="month_id",
        related_name="cards",
        db_index=False,
    )
    # An item that still has cards cannot be deleted (RESTRICT here, NO ACTION in the database);
    # merging moves the cards first. RESTRICT (not PROTECT) still lets a whole user be deleted,
    # because their cards go in the same operation (see migration 0002).
    item = models.ForeignKey(
        Item,
        on_delete=models.RESTRICT,
        db_constraint=False,
        db_column="item_id",
        related_name="cards",
    )
    importance = models.TextField(
        choices=Importance.choices, default=Importance.WANT, db_default=Importance.WANT
    )
    amount_minor = models.BigIntegerField(validators=[MinValueValidator(0)])
    quantity = models.IntegerField(default=1, db_default=1, validators=[MinValueValidator(1)])
    # NULL means the "+1" / "+N" buttons are locked (D-065); a number means they add this much.
    unit_price_minor = models.BigIntegerField(
        null=True, blank=True, validators=[MinValueValidator(0)]
    )
    # Set when a merge made the quantity unreliable and the user should look at it.
    quantity_needs_review = models.BooleanField(default=False, db_default=False)
    # Ignored cards stay visible but are left out of totals, history and charts.
    is_ignored = models.BooleanField(default=False, db_default=False)
    created_at = created_at_field()
    updated_at = updated_at_field()

    objects = MonthItemManager()

    class Meta:
        db_table = "month_items"
        constraints = [
            models.UniqueConstraint(
                fields=["month", "item", "importance"],
                name="month_items_month_item_importance_unique",
            ),
            models.CheckConstraint(
                condition=Q(importance__in=Importance.values), name="month_items_importance_valid"
            ),
            models.CheckConstraint(
                condition=Q(amount_minor__gte=0), name="month_items_amount_not_negative"
            ),
            models.CheckConstraint(condition=Q(quantity__gte=1), name="month_items_quantity_min_1"),
            models.CheckConstraint(
                condition=Q(unit_price_minor__isnull=True) | Q(unit_price_minor__gte=0),
                name="month_items_unit_price_not_negative",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.item_id} / {self.importance}"


# ---------------------------------------------------------------------------------------------
# item_merge_dismissals
# ---------------------------------------------------------------------------------------------


class ItemMergeDismissalManager(OwnedManager["ItemMergeDismissal"]):
    """Typed manager: lets mypy know which model ``for_user`` returns."""


class ItemMergeDismissal(models.Model):
    """The user said "do not suggest merging these two items again" (D-053).

    The pair is stored in one fixed order (``item_a`` has the smaller id), so "A with B" and
    "B with A" are the same row. Use ``ordered_pair`` to put two ids in that order.
    """

    OWNER_FIELD = "user_id"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = owner_foreign_key()
    # Composite foreign keys (item_a_id, user_id) and (item_b_id, user_id) -> items (0002).
    # Deleting either item also deletes the dismissal: there is nothing left to suggest.
    item_a = models.ForeignKey(
        Item,
        on_delete=models.CASCADE,
        db_constraint=False,
        db_column="item_a_id",
        related_name="+",
        db_index=False,  # the unique pair below starts with item_a
    )
    item_b = models.ForeignKey(
        Item,
        on_delete=models.CASCADE,
        db_constraint=False,
        db_column="item_b_id",
        related_name="+",
    )
    created_at = created_at_field()

    objects = ItemMergeDismissalManager()

    class Meta:
        db_table = "item_merge_dismissals"
        constraints = [
            models.UniqueConstraint(
                fields=["item_a", "item_b"], name="item_merge_dismissals_pair_unique"
            ),
            # One fixed order, so the pair cannot be stored twice the other way round, and an
            # item cannot be dismissed against itself.
            models.CheckConstraint(
                condition=Q(item_a__lt=F("item_b")), name="item_merge_dismissals_ordered_pair"
            ),
        ]

    def __str__(self) -> str:
        return f"{self.item_a_id} + {self.item_b_id}"

    @staticmethod
    def ordered_pair(first: uuid.UUID, second: uuid.UUID) -> tuple[uuid.UUID, uuid.UUID]:
        """Return the two item ids as (smaller, larger), the order the table requires."""
        return (first, second) if first < second else (second, first)

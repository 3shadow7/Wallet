"""System tables: no owner, the same for every user (D-179).

``app_config`` holds numbers, texts and switches the owner can change without a new app version.
The list of keys, their types and their defaults lives in ``apps/system/config.py``; the table is
filled with those defaults by migration 0002 (D-207) and edited in the Django admin page (D-209).
"""

from __future__ import annotations

from django.conf import settings
from django.db import models
from django.db.models import Q
from django.db.models.functions import Now

from apps.system.config import check_value
from common.ownership import OwnedManager

# A key is a short snake_case name, for example ``device_limit_free``.
KEY_PATTERN = r"^[a-z][a-z0-9_]{0,63}$"


class AppConfigEntryManager(OwnedManager["AppConfigEntry"]):
    """Typed manager: lets mypy know which model ``for_user`` returns (it always refuses here)."""


class AppConfigEntry(models.Model):
    """One value of ``app_config``: a key and its value, for example ``device_limit_free`` = 1."""

    # Nobody owns these rows: they are never read on behalf of a user, so ``for_user`` refuses.
    OWNER_FIELD = None

    key = models.TextField(primary_key=True)
    # jsonb keeps the type: 5 is a number, true is a switch, "text" is text.
    value = models.JSONField()
    updated_at = models.DateTimeField(auto_now=True, db_default=Now())
    # The Django admin account that made the last change (D-209). The foreign key with
    # ON DELETE SET NULL is created in migration 0001 by SQL, like our other delete rules.
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        db_constraint=False,
        related_name="+",
    )

    objects = AppConfigEntryManager()

    class Meta:
        db_table = "app_config"
        verbose_name = "app config value"
        ordering = ["key"]
        constraints = [
            models.CheckConstraint(
                condition=Q(key__regex=KEY_PATTERN), name="app_config_key_format"
            ),
        ]

    def __str__(self) -> str:
        return self.key

    def clean(self) -> None:
        # Refuse a value of the wrong type before it is saved (the admin form calls this).
        self.value = check_value(self.key, self.value)

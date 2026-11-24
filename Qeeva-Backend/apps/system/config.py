"""Every ``app_config`` key the code knows, with its type, its default and what it controls.

The owner changes these values in the Django admin page without a new app version (D-179, D-209).
This file is the code's copy of the defaults: a migration fills the table with the same values
(D-207), and the readers below fall back to them when a row is missing or holds a value of the
wrong type, so a typo in the admin page can never stop the app.

Read values with :func:`get_int`, :func:`get_bool` or :func:`get_text`; asking for a key that is
not listed here is a bug and raises ``KeyError``.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

from django.core.exceptions import ValidationError

logger = logging.getLogger(__name__)

ConfigValue = int | bool | str


@dataclass(frozen=True)
class ConfigKey:
    """One key: its default (whose type is the key's type), what it does, and its smallest value."""

    default: ConfigValue
    about: str
    minimum: int | None = None  # whole-number keys only


KEYS: dict[str, ConfigKey] = {
    # Guests and sign-in (D-178, D-199)
    "guest_signin_prompt_cards": ConfigKey(
        5, "A guest who adds more cards than this is asked to sign in (D-178).", minimum=1
    ),
    "guest_signin_prompt_message": ConfigKey(
        "Sign in to keep your data safe if you change or lose your phone.",
        "The text of that sign-in suggestion (D-178).",
    ),
    "signup_open": ConfigKey(
        False, "false = only invited emails can create an account (the MVP gate, D-199)."
    ),
    # Devices and read-only viewers (D-183 to D-191)
    "device_limit_free": ConfigKey(1, "Devices allowed on the free plan (D-185).", minimum=1),
    "device_limit_paid": ConfigKey(
        5, "Devices allowed on a paid plan; a placeholder until the plans are decided.", minimum=1
    ),
    "free_data_viewers": ConfigKey(1, "Read-only viewers included for free (D-186).", minimum=0),
    "max_data_viewers": ConfigKey(30, "The most read-only viewers one user can have.", minimum=0),
    "invite_code_days": ConfigKey(7, "Days an invite code stays valid (D-191).", minimum=1),
    # The account (D-195, D-196, D-198, D-202, D-208)
    "account_deletion_grace_days": ConfigKey(
        30, "Days before a deleted account is erased for good (D-195).", minimum=0
    ),
    "audit_log_days": ConfigKey(365, "Days an audit log row is kept (D-196).", minimum=1),
    "feature_export_enabled": ConfigKey(False, "Shows the Excel export button (D-198)."),
    "terms_version": ConfigKey(
        "2026-11", "The current terms; changing it asks every user to accept again (D-208)."
    ),
    "privacy_version": ConfigKey(
        "2026-11", "The current privacy policy; changing it asks every user again (D-208)."
    ),
    "username_change_days": ConfigKey(
        14, "Days to wait between two username changes (D-206).", minimum=0
    ),
    # Sync and the pending list (D-176, D-180, D-201 to D-204)
    "deleted_rows_days": ConfigKey(
        45, "Days before a deleted row or a resolved conflict is erased (D-176).", minimum=1
    ),
    "pending_seen_days": ConfigKey(
        90, "Days a confirmed or dismissed bank entry is remembered (D-203).", minimum=1
    ),
    "bank_sync_overlap_days": ConfigKey(
        7, "Days each bank import reads again, for late entries (D-204).", minimum=0
    ),
    # Months and debts (D-150, D-159)
    "months_ahead_limit": ConfigKey(
        1, "How many months ahead a user may create (D-150).", minimum=0
    ),
    "debt_reminder_days_before": ConfigKey(
        7, "Days before a debt's due day for the first reminder (D-159).", minimum=1
    ),
    # Zakat (D-137, D-142, D-162, D-169)
    "zakat_silver_grams": ConfigKey(595, "Grams of silver in the threshold (D-162).", minimum=1),
    "zakat_default_rate_bp": ConfigKey(
        250, "The Zakat rate a new user starts with, in hundredths of a percent (D-137).", minimum=1
    ),
    "zakat_clear_limit": ConfigKey(
        1, "How many times a user may delete his old Zakat (D-169).", minimum=0
    ),
    "prices_stale_days": ConfigKey(
        30, "Days without a fresh price before the reminder (D-142).", minimum=1
    ),
    "price_update_hours": ConfigKey(
        24, "Hours between two automatic price updates (D-142).", minimum=1
    ),
}


def _type_name(spec: ConfigKey) -> str:
    if isinstance(spec.default, bool):  # bool first: in Python a bool is also an int
        return "true or false"
    if isinstance(spec.default, int):
        return "a whole number"
    return "text"


def check_value(key: str, value: object) -> ConfigValue:
    """Return ``value`` when it fits ``key``; otherwise raise ``ValidationError`` with a reason."""
    spec = KEYS.get(key)
    if spec is None:
        raise ValidationError(f"Unknown key {key!r}: the code does not use it.")
    if isinstance(spec.default, bool):
        if isinstance(value, bool):
            return value
    elif isinstance(spec.default, int):
        if isinstance(value, int) and not isinstance(value, bool):
            if spec.minimum is not None and value < spec.minimum:
                raise ValidationError(f"{key} must be at least {spec.minimum}.")
            return value
    elif isinstance(value, str):
        if not value.strip():
            raise ValidationError(f"{key} cannot be empty.")
        return value
    raise ValidationError(f"{key} must be {_type_name(spec)}.")


def parse_text(key: str, text: str) -> ConfigValue:
    """Turn what the admin typed ("3", "true", a sentence) into the key's type, then check it."""
    spec = KEYS.get(key)
    if spec is None:
        raise ValidationError(f"Unknown key {key!r}: the code does not use it.")
    cleaned = text.strip()
    if isinstance(spec.default, bool):
        words = {"true": True, "false": False}
        if cleaned.lower() not in words:
            raise ValidationError(f"{key} must be true or false.")
        return words[cleaned.lower()]
    if isinstance(spec.default, int):
        try:
            number = int(cleaned)
        except ValueError:
            raise ValidationError(f"{key} must be a whole number.") from None
        return check_value(key, number)
    return check_value(key, cleaned)


def as_text(value: ConfigValue) -> str:
    """The reverse of :func:`parse_text`: how a stored value is shown in the admin form."""
    if isinstance(value, bool):
        return "true" if value else "false"
    return str(value)


def _read(key: str) -> ConfigValue:
    spec = KEYS[key]  # an unknown key is a bug in the caller: fail loudly
    # Imported here, not at the top: models.py imports this module, so a top import would loop.
    from apps.system.models import AppConfigEntry

    stored = AppConfigEntry.objects.filter(key=key).values_list("value", flat=True).first()
    if stored is None:
        return spec.default
    try:
        return check_value(key, stored)
    except ValidationError:
        logger.warning("app_config %s holds an invalid value %r; using the default.", key, stored)
        return spec.default


def get_int(key: str) -> int:
    value = _read(key)
    if not isinstance(value, int) or isinstance(value, bool):
        raise TypeError(f"{key} is not a whole-number key")
    return value


def get_bool(key: str) -> bool:
    value = _read(key)
    if not isinstance(value, bool):
        raise TypeError(f"{key} is not a true-or-false key")
    return value


def get_text(key: str) -> str:
    value = _read(key)
    if not isinstance(value, str):
        raise TypeError(f"{key} is not a text key")
    return value

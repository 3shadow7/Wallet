"""Who the user is: profile, reserved old usernames, and personal settings.

These tables follow the design approved in the project. The user's login
(email, password, tokens) lives in Supabase Auth; ``profiles.id`` is the same uuid as
``auth.users.id`` and is tied to it by a database foreign key (see migration 0002).
"""

from __future__ import annotations

import uuid
from zoneinfo import ZoneInfo

from django.core.exceptions import ValidationError
from django.core.validators import MaxLengthValidator, MinLengthValidator, RegexValidator
from django.db import models
from django.db.models import Q
from django.db.models.functions import Length, Lower, Now
from django.db.models.lookups import GreaterThanOrEqual, LessThanOrEqual

from common.ownership import OwnedManager

# English letters, digits and underscore only, 3 to 20 characters.
USERNAME_PATTERN = r"^[A-Za-z0-9_]{3,20}\Z"  # \Z, not $: "abc\n" must not match
DISPLAY_NAME_MIN = 1
DISPLAY_NAME_MAX = 30

username_validator = RegexValidator(
    USERNAME_PATTERN,
    message="Username must be 3-20 characters: English letters, numbers or underscore.",
)


def validate_timezone(value: str) -> None:
    """Accept only real IANA names such as ``Africa/Tripoli``."""
    try:
        ZoneInfo(value)
    except (ValueError, OSError):
        # ZoneInfoNotFoundError is a KeyError subclass in some versions; ValueError covers
        # malformed keys, OSError covers keys that point at a folder or a non-zone file.
        raise ValidationError(f"'{value}' is not a valid time zone name.") from None
    except KeyError:
        raise ValidationError(f"'{value}' is not a valid time zone name.") from None


class ProfileRole(models.TextChoices):
    USER = "user"
    ADMIN = "admin"


class ProfileStatus(models.TextChoices):
    ACTIVE = "active"
    SUSPENDED = "suspended"
    PENDING_DELETION = "pending_deletion"


class ExperienceMode(models.TextChoices):
    REGULAR = "regular"
    ADVANCED = "advanced"


class Language(models.TextChoices):
    ENGLISH = "en"


class ProfileManager(OwnedManager["Profile"]):
    """Typed manager: lets mypy know which model ``for_user`` returns."""


class Profile(models.Model):
    """One row per person. The primary key is the Supabase user id."""

    # A user's own rows are the ones whose primary key equals their Supabase id.
    OWNER_FIELD = "id"

    id = models.UUIDField(primary_key=True, editable=False)
    username = models.TextField(validators=[username_validator])
    # NULL means "not set"; an empty string is forbidden by a database check (see Meta).
    display_name = models.TextField(  # noqa: DJ001
        null=True,
        blank=True,
        validators=[
            MinLengthValidator(DISPLAY_NAME_MIN),
            MaxLengthValidator(DISPLAY_NAME_MAX),
        ],
    )
    role = models.TextField(
        choices=ProfileRole.choices, default=ProfileRole.USER, db_default=ProfileRole.USER
    )
    status = models.TextField(
        choices=ProfileStatus.choices,
        default=ProfileStatus.ACTIVE,
        db_default=ProfileStatus.ACTIVE,
    )
    # Start of the 14-day wait before the next username change. Null = never changed.
    username_changed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_default=Now())
    updated_at = models.DateTimeField(auto_now=True, db_default=Now())
    # When the user asked to delete the account. Not the time of the real deletion.
    deleted_at = models.DateTimeField(null=True, blank=True)

    objects = ProfileManager()

    class Meta:
        db_table = "profiles"
        constraints = [
            # "Bob" and "bob" are the same name, so uniqueness ignores letter case.
            models.UniqueConstraint(Lower("username"), name="profiles_username_ci_unique"),
            models.CheckConstraint(
                condition=Q(username__regex=USERNAME_PATTERN),
                name="profiles_username_format",
            ),
            models.CheckConstraint(
                condition=Q(display_name__isnull=True)
                | Q(
                    GreaterThanOrEqual(Length("display_name"), DISPLAY_NAME_MIN),
                    LessThanOrEqual(Length("display_name"), DISPLAY_NAME_MAX),
                ),
                name="profiles_display_name_length",
            ),
            models.CheckConstraint(
                condition=Q(role__in=ProfileRole.values), name="profiles_role_valid"
            ),
            models.CheckConstraint(
                condition=Q(status__in=ProfileStatus.values), name="profiles_status_valid"
            ),
        ]

    def __str__(self) -> str:
        return self.username


class UsernameReservationManager(OwnedManager["UsernameReservation"]):
    """Typed manager: lets mypy know which model ``for_user`` returns."""


class UsernameReservation(models.Model):
    """An old username that nobody else may take until ``reserved_until`` (30 days).

    This is an internal table: it is never read on behalf of a user, so it has no owner.
    Whether a name is free is decided by the username service, not by a unique constraint,
    because the same name can legitimately be reserved again in the future.
    """

    OWNER_FIELD = None

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    username = models.TextField(validators=[username_validator])
    # If the old owner deletes the account the reservation must survive, so we keep the row
    # and clear the link instead of cascading the delete.
    previous_owner = models.ForeignKey(
        Profile,
        null=True,
        on_delete=models.SET_NULL,
        # The foreign key itself is created in migration 0002 so that the database (not only
        # Django) knows the delete rule: deleting a Supabase user deletes the profile in SQL.
        db_constraint=False,
        related_name="released_usernames",
    )
    reserved_until = models.DateTimeField()

    objects = UsernameReservationManager()

    class Meta:
        db_table = "username_reservations"
        constraints = [
            models.CheckConstraint(
                condition=Q(username__regex=USERNAME_PATTERN),
                name="username_reservations_username_format",
            ),
        ]
        indexes = [
            # The username service asks "is this name reserved right now?" (case-insensitive).
            models.Index(
                Lower("username"),
                "reserved_until",
                name="username_reservations_lookup",
            ),
        ]

    def __str__(self) -> str:
        return self.username


class DevicePlatform(models.TextChoices):
    WEB = "web"
    ANDROID = "android"
    IOS = "ios"


class DeviceAccess(models.TextChoices):
    FULL = "full"
    READ_ONLY = "read_only"


class DeviceManager(OwnedManager["Device"]):
    """Typed manager: lets mypy know which model ``for_user`` returns."""


class Device(models.Model):
    """A phone, a browser or a watch where the user opened his account (D-176, D-182 to D-191).

    Rows that sync remember which device changed or deleted them last. The free plan allows one
    device (``app_config.device_limit_free``); the main device (``is_primary``) keeps working when
    a paid plan ends (D-187).
    """

    OWNER_FIELD = "user_id"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        Profile,
        on_delete=models.CASCADE,
        db_constraint=False,  # created in migration 0005 with ON DELETE CASCADE
        related_name="devices",
    )
    # Shown to the user, for example "Chrome on Windows" or "Ali's phone".
    name = models.TextField(validators=[MinLengthValidator(1), MaxLengthValidator(40)])
    platform = models.TextField(choices=DevicePlatform.choices)
    last_seen_at = models.DateTimeField(null=True, blank=True)
    last_synced_at = models.DateTimeField(null=True, blank=True)  # shown in Settings (D-182)
    is_primary = models.BooleanField(default=False, db_default=False)
    # A read-only device of the owner never writes and uses a viewer slot (D-191).
    access_mode = models.TextField(
        choices=DeviceAccess.choices, default=DeviceAccess.FULL, db_default=DeviceAccess.FULL
    )
    created_at = models.DateTimeField(auto_now_add=True, db_default=Now())
    updated_at = models.DateTimeField(auto_now=True, db_default=Now())

    objects = DeviceManager()

    class Meta:
        db_table = "devices"
        constraints = [
            # Synced rows point at (device id, user id): a row can never name a stranger's device.
            models.UniqueConstraint(fields=["id", "user"], name="devices_id_user_unique"),
            # At most one main device per user (D-187).
            models.UniqueConstraint(
                fields=["user"], condition=Q(is_primary=True), name="devices_one_primary_per_user"
            ),
            models.CheckConstraint(
                condition=GreaterThanOrEqual(Length("name"), 1)
                & LessThanOrEqual(Length("name"), 40),
                name="devices_name_length",
            ),
            models.CheckConstraint(
                condition=Q(platform__in=DevicePlatform.values), name="devices_platform_valid"
            ),
            models.CheckConstraint(
                condition=Q(access_mode__in=DeviceAccess.values), name="devices_access_mode_valid"
            ),
        ]

    def __str__(self) -> str:
        return self.name


class VersionedModel(models.Model):
    """Columns for a row that several devices may change (D-180).

    ``version`` starts at 1 and the DATABASE raises it on every update (a trigger made by
    ``common.db.version_trigger``), so even a bulk update cannot forget it. A device sends the
    version it started from; a different number means another device changed the row first.
    """

    version = models.IntegerField(default=1, db_default=1, editable=False)
    # The device of the last change. The composite foreign key (device, owner) with
    # ON DELETE SET NULL is created by SQL in the migration (common.db.device_foreign_key).
    updated_by_device = models.ForeignKey(
        Device,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        db_constraint=False,
        related_name="+",
    )

    class Meta:
        abstract = True


class SyncedModel(VersionedModel):
    """A versioned row that is deleted softly (D-176): it stays 45 days so other devices learn
    about the delete and the user can restore it, then a daily cleanup erases it for good
    (``app_config.deleted_rows_days``)."""

    deleted_at = models.DateTimeField(null=True, blank=True)
    deleted_by_device = models.ForeignKey(
        Device,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        db_constraint=False,
        related_name="+",
    )

    class Meta:
        abstract = True


class UserSettingsManager(OwnedManager["UserSettings"]):
    """Typed manager: lets mypy know which model ``for_user`` returns."""


class UserSettings(VersionedModel):
    """Personal preferences. Exactly one row per user (the user id is the primary key).

    Versioned but never deleted softly: the row lives as long as the account (D-213).
    """

    OWNER_FIELD = "user_id"

    user = models.OneToOneField(
        Profile,
        primary_key=True,
        on_delete=models.CASCADE,
        db_constraint=False,  # created in migration 0002 with ON DELETE CASCADE
        related_name="settings",
        db_column="user_id",
    )
    experience_mode = models.TextField(
        choices=ExperienceMode.choices,
        default=ExperienceMode.REGULAR,
        db_default=ExperienceMode.REGULAR,
    )
    # Taken from the device at sign-up. Checked against the IANA list in Python because a
    # database CHECK cannot look inside PostgreSQL's time-zone table.
    timezone = models.TextField(validators=[validate_timezone])
    language = models.TextField(
        choices=Language.choices, default=Language.ENGLISH, db_default=Language.ENGLISH
    )
    # Advanced mode only: merge same-named items without asking.
    skip_merge_confirm = models.BooleanField(default=False, db_default=False)
    created_at = models.DateTimeField(auto_now_add=True, db_default=Now())
    updated_at = models.DateTimeField(auto_now=True, db_default=Now())

    objects = UserSettingsManager()

    class Meta:
        db_table = "user_settings"
        verbose_name_plural = "user settings"
        constraints = [
            models.CheckConstraint(
                condition=Q(experience_mode__in=ExperienceMode.values),
                name="user_settings_experience_mode_valid",
            ),
            models.CheckConstraint(
                condition=Q(language__in=Language.values),
                name="user_settings_language_valid",
            ),
            # Django would otherwise store "" when no time zone is given.
            models.CheckConstraint(
                condition=~Q(timezone=""), name="user_settings_timezone_not_empty"
            ),
        ]

    def __str__(self) -> str:
        return f"settings of {self.user_id}"


class ConsentKind(models.TextChoices):
    TERMS = "terms"
    PRIVACY = "privacy"
    MARKETING = "marketing"


class ConsentAction(models.TextChoices):
    ACCEPTED = "accepted"
    WITHDRAWN = "withdrawn"


class UserConsentManager(OwnedManager["UserConsent"]):
    """Typed manager: lets mypy know which model ``for_user`` returns."""


class UserConsent(models.Model):
    """One consent action, kept as proof (D-202): who accepted or withdrew which document version.

    Rows are never edited: a new action is a new row, and the current state of a kind is its
    newest row. Example: accepted terms ``2026-11`` at sign-up, then terms ``2027-03`` after the
    owner changed ``app_config.terms_version`` (D-208).
    """

    OWNER_FIELD = "user_id"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        Profile,
        on_delete=models.CASCADE,
        db_constraint=False,  # created in migration 0004 with ON DELETE CASCADE
        related_name="consents",
    )
    kind = models.TextField(choices=ConsentKind.choices)
    # The version of the document he saw, for example "2026-11".
    document_version = models.TextField(validators=[MaxLengthValidator(20)])
    action = models.TextField(choices=ConsentAction.choices)
    created_at = models.DateTimeField(auto_now_add=True, db_default=Now())

    objects = UserConsentManager()

    class Meta:
        db_table = "user_consents"
        constraints = [
            models.CheckConstraint(
                condition=Q(kind__in=ConsentKind.values), name="user_consents_kind_valid"
            ),
            models.CheckConstraint(
                condition=Q(action__in=ConsentAction.values), name="user_consents_action_valid"
            ),
            models.CheckConstraint(
                condition=GreaterThanOrEqual(Length("document_version"), 1)
                & LessThanOrEqual(Length("document_version"), 20),
                name="user_consents_document_version_length",
            ),
        ]
        indexes = [
            # "What is his newest action for this kind?" reads only this index.
            models.Index(fields=["user", "kind", "-created_at"], name="user_consents_latest"),
        ]

    def __str__(self) -> str:
        return f"{self.kind} {self.document_version} {self.action}"

    def save(self, *args: object, **kwargs: object) -> None:
        # Proof must not change after the fact: only new rows may be saved.
        if not self._state.adding:
            raise ValueError("A consent row is never edited; save a new row instead.")
        super().save(*args, **kwargs)  # type: ignore[arg-type]

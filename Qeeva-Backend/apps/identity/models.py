import uuid

from django.core.validators import RegexValidator
from django.db import models
from django.db.models import F, Q
from django.db.models.functions import Lower


username_validator = RegexValidator(
    regex=r"^[a-z0-9_]{3,20}$",
    message=(
        "Username must be 3–20 characters and contain only lowercase "
        "English letters, numbers, and underscores."
    ),
)


class Profile(models.Model):
    class Role(models.TextChoices):
        USER = "user", "User"
        ADMIN = "admin", "Admin"

    # Supabase Auth owns auth.users. The matching FK is installed by a
    # PostgreSQL-only migration operation; Django does not own that table.
    id = models.UUIDField(primary_key=True, editable=False)
    username = models.CharField(
        max_length=20,
        validators=[username_validator],
    )
    display_name = models.CharField(max_length=50, blank=True, null=True)
    avatar_path = models.CharField(max_length=512, blank=True, null=True)
    bio = models.CharField(max_length=160, blank=True, null=True)
    role = models.CharField(max_length=10, choices=Role.choices, default=Role.USER)
    country_code = models.CharField(max_length=2, blank=True, null=True)
    username_changed_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "profiles"
        constraints = [
            models.UniqueConstraint(
                Lower("username"),
                name="uq_profiles_username_ci",
            ),
            models.CheckConstraint(
                condition=Q(username__regex=r"^[a-z0-9_]{3,20}$"),
                name="ck_profiles_username_format",
            ),
            models.CheckConstraint(
                condition=Q(role__in=["user", "admin"]),
                name="ck_profiles_role_valid",
            ),
            models.CheckConstraint(
                condition=Q(country_code__isnull=True)
                | Q(country_code__regex=r"^[A-Z]{2}$"),
                name="ck_profiles_country_code_format",
            ),
        ]

    @property
    def effective_display_name(self):
        """Display name fallback; the fallback is not duplicated in storage."""
        return self.display_name or self.username

    def __str__(self):
        return f"@{self.username}"


class UsernameHistory(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    profile = models.ForeignKey(
        Profile,
        on_delete=models.CASCADE,
        related_name="username_history",
    )
    old_username = models.CharField(
        max_length=20,
        validators=[username_validator],
    )
    changed_at = models.DateTimeField()
    available_at = models.DateTimeField()
    reclaimed_at = models.DateTimeField(blank=True, null=True)
    reclaimed_by_profile = models.ForeignKey(
        Profile,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name="reclaimed_usernames",
    )

    class Meta:
        db_table = "username_history"
        constraints = [
            models.CheckConstraint(
                condition=Q(old_username__regex=r"^[a-z0-9_]{3,20}$"),
                name="ck_username_history_name_format",
            ),
            models.CheckConstraint(
                condition=Q(available_at__gt=F("changed_at")),
                name="ck_username_history_available_after_change",
            ),
            models.UniqueConstraint(
                Lower("old_username"),
                condition=Q(reclaimed_at__isnull=True),
                name="uq_username_history_active_reservation",
            ),
        ]
        indexes = [
            models.Index(fields=["profile", "-changed_at"], name="ix_username_hist_profile_date"),
            models.Index(fields=["available_at"], name="ix_username_hist_available"),
        ]

    def __str__(self):
        return f"@{self.old_username} (profile={self.profile_id})"

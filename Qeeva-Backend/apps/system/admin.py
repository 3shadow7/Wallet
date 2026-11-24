"""The admin page for ``app_config`` (D-209): the only table the Django admin shows.

The owner signs in with a Django admin account (``python manage.py createsuperuser``), which is
separate from his Supabase account. He can change values, never add or delete keys: a key the
code does not know would do nothing, and a missing key falls back to its default anyway.
No user's data is registered here (admin features stay deferred, D-080).
"""

from __future__ import annotations

from typing import Any

from django import forms
from django.contrib import admin
from django.http import HttpRequest

from apps.system.config import KEYS, as_text, parse_text
from apps.system.models import AppConfigEntry


class AppConfigEntryForm(forms.ModelForm):  # type: ignore[type-arg]
    # A plain text box instead of raw JSON: the admin types 3, true or a sentence, no quotes.
    value = forms.CharField(widget=forms.Textarea(attrs={"rows": 2, "cols": 60}))

    class Meta:
        model = AppConfigEntry
        fields = ("value",)

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        if self.instance.pk is not None:
            # Show the stored value the way it is typed (true, not True; text without quotes).
            self.initial["value"] = as_text(self.instance.value)

    def clean_value(self) -> object:
        # Turn the text into the key's type; a wrong value shows a plain reason and is not saved.
        return parse_text(self.instance.key, self.cleaned_data["value"])


@admin.register(AppConfigEntry)
class AppConfigEntryAdmin(admin.ModelAdmin):  # type: ignore[type-arg]
    form = AppConfigEntryForm
    list_display = ("key", "shown_value", "about", "updated_at", "updated_by")
    search_fields = ("key",)
    readonly_fields = ("key", "about", "default", "updated_at", "updated_by")
    fields = ("key", "about", "value", "default", "updated_at", "updated_by")

    @admin.display(description="value")
    def shown_value(self, entry: AppConfigEntry) -> str:
        return as_text(entry.value)

    @admin.display(description="what it does")
    def about(self, entry: AppConfigEntry) -> str:
        spec = KEYS.get(entry.key)
        return spec.about if spec else "Unknown key: the code does not use it."

    @admin.display(description="default")
    def default(self, entry: AppConfigEntry) -> str:
        spec = KEYS.get(entry.key)
        return as_text(spec.default) if spec else "-"

    def has_add_permission(self, request: HttpRequest) -> bool:
        return False

    def has_delete_permission(self, request: HttpRequest, obj: Any = None) -> bool:
        return False

    def save_model(
        self, request: HttpRequest, obj: AppConfigEntry, form: Any, change: bool
    ) -> None:
        # Remember who changed it; Django's own history (django_admin_log) records the change too.
        obj.updated_by = request.user  # type: ignore[assignment]
        super().save_model(request, obj, form, change)

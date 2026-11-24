from django.apps import AppConfig


class SystemConfig(AppConfig):
    """Tables that belong to nobody and are the same for every user (D-179)."""

    name = "apps.system"
    label = "system"
    verbose_name = "System"
    default_auto_field = "django.db.models.BigAutoField"

from django.db import models
from django.conf import settings
import uuid

class Expense(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="expenses")
    name = models.CharField(max_length=200)
    category = models.CharField(max_length=100, blank=True, null=True)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    unit_price = models.DecimalField(max_digits=12, decimal_places=2, default=0.0)
    quantity = models.IntegerField(default=1)
    is_ignored = models.BooleanField(default=False)
    type = models.CharField(max_length=50, default="Burning")
    priority = models.CharField(max_length=50, default="Must Have")
    month = models.CharField(max_length=20) 
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} - {self.amount}"

class UserIncome(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="income_profile")
    monthly_income = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    work_hours_per_month = models.IntegerField(default=160)
    hourly_rate = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    is_hourly_manual = models.BooleanField(default=False)
    calculation_method = models.CharField(max_length=20, default="weekly")
    hours_per_day = models.DecimalField(max_digits=5, decimal_places=2, default=8.00)
    days_per_week = models.DecimalField(max_digits=5, decimal_places=2, default=5.00)
    updated_at = models.DateTimeField(auto_now=True)


class UserBackup(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="backup")
    data = models.JSONField(default=dict, blank=True)
    revision = models.CharField(max_length=36, default=uuid.uuid4, editable=False)
    updated_at = models.DateTimeField(auto_now=True)

    def bump_revision(self):
        self.revision = str(uuid.uuid4())
        return self.revision


class OperationLog(models.Model):
    """Record client operations to make server-side processing idempotent.

    Each operation submitted by a client should include a unique `op_id`.
    The server stores the op and the result so repeated submissions are
    safely ignored or return the original result.
    """
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="operation_logs")
    device_id = models.CharField(max_length=100, blank=True, default="")
    op_id = models.CharField(max_length=100)
    resource = models.CharField(max_length=50)
    op_type = models.CharField(max_length=20)
    client_resource_id = models.CharField(max_length=100, null=True, blank=True)
    resource_pk = models.IntegerField(null=True, blank=True)
    result = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    processed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = (('user', 'op_id'),)

    def mark_processed(self, result):
        self.result = result
        from django.utils import timezone
        self.processed_at = timezone.now()
        self.save(update_fields=['result', 'processed_at'])


class SyncDeviceState(models.Model):
    """Track sync activity per browser/device for the same authenticated user.

    The user still owns the money data; this table only records which device
    last talked to the sync backend so retries and conflict handling stay predictable.
    """
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="sync_devices")
    device_id = models.CharField(max_length=100)
    last_seen_at = models.DateTimeField(auto_now=True)
    last_sync_at = models.DateTimeField(null=True, blank=True)
    last_backup_revision = models.CharField(max_length=36, blank=True, default="")

    class Meta:
        unique_together = (("user", "device_id"),)

    def mark_seen(self):
        from django.utils import timezone
        self.last_seen_at = timezone.now()
        self.save(update_fields=["last_seen_at"])


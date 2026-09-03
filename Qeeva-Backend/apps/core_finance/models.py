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
    updated_at = models.DateTimeField(auto_now=True)


class UserBackup(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="backup")
    data = models.JSONField(default=dict, blank=True)
    revision = models.CharField(max_length=36, default=uuid.uuid4, editable=False)
    updated_at = models.DateTimeField(auto_now=True)

    def bump_revision(self):
        self.revision = str(uuid.uuid4())
        return self.revision


from rest_framework import serializers

from .models import Expense, UserBackup, UserIncome


class ExpenseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Expense
        fields = ["id", "name", "category", "amount", "unit_price", "quantity", "is_ignored", "type", "priority", "month"]
        read_only_fields = ["user"]

    def validate_month(self, value):
        # Use YYYY-MM to keep filtering predictable across frontend and backend.
        if not isinstance(value, str) or len(value) != 7 or value[4] != "-":
            raise serializers.ValidationError("month must use YYYY-MM format")
        year, month = value.split("-", 1)
        if not year.isdigit() or not month.isdigit() or not (1 <= int(month) <= 12):
            raise serializers.ValidationError("month must use YYYY-MM format")
        return value

    def validate_quantity(self, value):
        if value < 1:
            raise serializers.ValidationError("quantity must be at least 1")
        return value

    def validate(self, attrs):
        amount = attrs.get("amount")
        unit_price = attrs.get("unit_price")
        if amount is not None and amount < 0:
            raise serializers.ValidationError({"amount": "amount must be non-negative"})
        if unit_price is not None and unit_price < 0:
            raise serializers.ValidationError({"unit_price": "unit_price must be non-negative"})
        return attrs

class UserIncomeSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserIncome
        fields = [
            "monthly_income",
            "work_hours_per_month",
            "hourly_rate",
            "is_hourly_manual",
            "calculation_method",
            "hours_per_day",
            "days_per_week",
            "updated_at",
        ]
        read_only_fields = ["updated_at"]

    def validate_monthly_income(self, value):
        if value < 0:
            raise serializers.ValidationError("monthly_income must be non-negative")
        return value

    def validate_work_hours_per_month(self, value):
        if value < 1:
            raise serializers.ValidationError("work_hours_per_month must be at least 1")
        return value

    def validate_hourly_rate(self, value):
        if value < 0:
            raise serializers.ValidationError("hourly_rate must be non-negative")
        return value

    def validate_hours_per_day(self, value):
        if value < 0 or value > 24:
            raise serializers.ValidationError("hours_per_day must be between 0 and 24")
        return value

    def validate_days_per_week(self, value):
        if value < 0 or value > 7:
            raise serializers.ValidationError("days_per_week must be between 0 and 7")
        return value

    def validate_calculation_method(self, value):
        if value not in {"weekly", "manual"}:
            raise serializers.ValidationError("calculation_method must be weekly or manual")
        return value


class UserBackupSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserBackup
        fields = ["data", "revision", "updated_at"]
        read_only_fields = ["revision", "updated_at"]


from rest_framework import serializers
from .models import Expense, UserIncome

class ExpenseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Expense
        fields = ["id", "name", "category", "amount", "unit_price", "quantity", "is_ignored", "type", "priority", "month"]
        read_only_fields = ["user"]

class UserIncomeSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserIncome
        fields = ["monthly_income"]


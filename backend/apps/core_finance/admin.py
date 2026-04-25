from django.contrib import admin

from .models import Expense, UserBackup, UserIncome


@admin.register(Expense)
class ExpenseAdmin(admin.ModelAdmin):
	"""Expose expense records in a searchable, finance-focused table."""

	list_display = ("name", "user", "category", "amount", "type", "priority", "month", "is_ignored", "created_at")
	list_filter = ("type", "priority", "is_ignored", "month", "category")
	search_fields = ("name", "category", "user__username", "user__email")
	ordering = ("-created_at",)
	list_select_related = ("user",)


@admin.register(UserIncome)
class UserIncomeAdmin(admin.ModelAdmin):
	"""Show each user's income profile as a quick admin review row."""

	list_display = ("user", "monthly_income", "updated_at")
	search_fields = ("user__username", "user__email")
	ordering = ("-updated_at",)
	list_select_related = ("user",)


@admin.register(UserBackup)
class UserBackupAdmin(admin.ModelAdmin):
	"""Keep the backup payload visible so sync/debug review stays transparent."""

	list_display = ("user", "revision", "updated_at")
	search_fields = ("user__username", "user__email", "revision")
	readonly_fields = ("revision", "updated_at")
	ordering = ("-updated_at",)
	list_select_related = ("user",)

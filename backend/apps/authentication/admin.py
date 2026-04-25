from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.contrib.auth.models import User

from apps.core_finance.models import Expense, UserBackup, UserIncome


class ExpenseInline(admin.TabularInline):
	"""Show a user's expenses directly on the user detail page."""

	model = Expense
	extra = 0
	fields = ("name", "amount", "category", "type", "priority", "month", "is_ignored")
	readonly_fields = ()


class UserIncomeInline(admin.StackedInline):
	"""Expose the single income profile beside the user account."""

	model = UserIncome
	extra = 0
	can_delete = False


class UserBackupInline(admin.StackedInline):
	"""Keep the backup payload available for inspection from the user page."""

	model = UserBackup
	extra = 0
	can_delete = False


class MyWalletUserAdmin(UserAdmin):
	"""Extend Django's user admin with finance context for faster review."""

	inlines = [ExpenseInline, UserIncomeInline, UserBackupInline]


# Friendly admin labels clarify the purpose of the custom admin console.
admin.site.site_header = "MyWallet Admin"
admin.site.site_title = "MyWallet Admin Portal"
admin.site.index_title = "Manage users, tokens, and finance data"


admin.site.unregister(User)
admin.site.register(User, MyWalletUserAdmin)

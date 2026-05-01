from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from .models import Expense, UserIncome
from django.utils import timezone


class UserBackupApiTests(APITestCase):
	def setUp(self):
		user_model = get_user_model()
		self.user = user_model.objects.create_user(
			username="backup_user",
			email="backup@example.com",
			password="StrongPass123!",
		)
		self.client.force_authenticate(user=self.user)
		self.url = reverse("backup")

	def test_put_backup_bumps_revision(self):
		first = self.client.put(self.url, {"data": {"k": "v1"}}, format="json")
		self.assertEqual(first.status_code, status.HTTP_200_OK)
		first_revision = first.data["revision"]

		second = self.client.put(self.url, {"data": {"k": "v2"}}, format="json")
		self.assertEqual(second.status_code, status.HTTP_200_OK)
		self.assertNotEqual(first_revision, second.data["revision"])
		self.assertEqual(second.data["data"]["k"], "v2")

	def test_put_backup_rejects_stale_expected_revision(self):
		first = self.client.put(self.url, {"data": {"k": "v1"}}, format="json")
		self.assertEqual(first.status_code, status.HTTP_200_OK)
		stale_revision = first.data["revision"]

		second = self.client.put(self.url, {"data": {"k": "v2"}}, format="json")
		self.assertEqual(second.status_code, status.HTTP_200_OK)

		stale_write = self.client.put(
			self.url,
			{"data": {"k": "stale"}, "expected_revision": stale_revision},
			format="json",
		)
		self.assertEqual(stale_write.status_code, status.HTTP_409_CONFLICT)
		self.assertIn("detail", stale_write.data)
		self.assertIn("revision", stale_write.data)

		latest = self.client.get(self.url)
		self.assertEqual(latest.status_code, status.HTTP_200_OK)
		self.assertEqual(latest.data["data"]["k"], "v2")


class SyncOpsApiTests(APITestCase):
	def setUp(self):
		user_model = get_user_model()
		self.user = user_model.objects.create_user(
			username="ops_user",
			email="ops@example.com",
			password="StrongPass123!",
		)
		self.client.force_authenticate(user=self.user)
		self.url = reverse("sync_ops")

	def test_create_op_idempotent(self):
		op = {
			"op_id": "op-create-1",
			"type": "create",
			"resource": "expense",
			"payload": {
				"name": "Coffee",
				"amount": "3.50",
				"unit_price": "3.50",
				"quantity": 1,
				"month": "2026-05",
			},
		}

		resp1 = self.client.post(self.url, {"ops": [op]}, format="json")
		self.assertEqual(resp1.status_code, status.HTTP_200_OK)
		results = resp1.data.get("results")
		self.assertEqual(len(results), 1)
		self.assertEqual(results[0]["status"], "ok")

		# second submission of same op must not create duplicate expense
		resp2 = self.client.post(self.url, {"ops": [op]}, format="json")
		self.assertEqual(resp2.status_code, status.HTTP_200_OK)
		self.assertEqual(Expense.objects.filter(user=self.user, name="Coffee").count(), 1)

	def test_income_conflict_returns_conflict_status(self):
		seed = {
			"op_id": "income-seed",
			"type": "update",
			"resource": "income",
			"payload": {
				"monthly_income": "1000.00",
				"work_hours_per_month": 160,
				"calculation_method": "weekly",
			},
		}
		resp1 = self.client.post(self.url, {"ops": [seed]}, format="json")
		self.assertEqual(resp1.status_code, status.HTTP_200_OK)
		income = UserIncome.objects.get(user=self.user)
		expected = (income.updated_at - timezone.timedelta(seconds=30)).isoformat()

		stale = {
			"op_id": "income-stale",
			"type": "update",
			"resource": "income",
			"payload": {
				"monthly_income": "1500.00",
				"expected_updated_at": expected,
			},
		}
		resp2 = self.client.post(self.url, {"ops": [stale]}, format="json")
		self.assertEqual(resp2.status_code, status.HTTP_200_OK)
		self.assertEqual(resp2.data["results"][0]["status"], "conflict")
		self.assertIn("conflict", resp2.data["results"][0])
		income.refresh_from_db()
		self.assertEqual(str(income.monthly_income), "1000.00")


class MultiDeviceSyncTests(APITestCase):
	def setUp(self):
		user_model = get_user_model()
		self.user = user_model.objects.create_user(
			username="multi_user",
			email="multi@example.com",
			password="StrongPass123!",
		)
		self.client.force_authenticate(user=self.user)
		self.url = reverse("sync_ops")

	def test_two_devices_create_offline_and_flush(self):
		# Simulate Device A creates Coffee
		op_a = {
			"op_id": "devA-create-1",
			"type": "create",
			"resource": "expense",
			"payload": {
				"name": "Coffee-A",
				"amount": "4.00",
				"unit_price": "4.00",
				"quantity": 1,
				"month": "2026-05",
			},
		}

		# Simulate Device B creates Sandwich
		op_b = {
			"op_id": "devB-create-1",
			"type": "create",
			"resource": "expense",
			"payload": {
				"name": "Sandwich-B",
				"amount": "6.50",
				"unit_price": "6.50",
				"quantity": 1,
				"month": "2026-05",
			},
		}

		# Device A flushes
		resp_a = self.client.post(self.url, {"ops": [op_a]}, format="json")
		self.assertEqual(resp_a.status_code, status.HTTP_200_OK)

		# Device B flushes later
		resp_b = self.client.post(self.url, {"ops": [op_b]}, format="json")
		self.assertEqual(resp_b.status_code, status.HTTP_200_OK)

		# Both items should exist without duplication
		names = list(Expense.objects.filter(user=self.user).values_list('name', flat=True))
		self.assertIn('Coffee-A', names)
		self.assertIn('Sandwich-B', names)
		self.assertEqual(Expense.objects.filter(user=self.user).count(), 2)

	def test_out_of_order_retries_do_not_duplicate(self):
		op = {
			"op_id": "retry-op-1",
			"type": "create",
			"resource": "expense",
			"payload": {
				"name": "Milk",
				"amount": "2.00",
				"unit_price": "2.00",
				"quantity": 1,
				"month": "2026-05",
			},
		}

		# Submit twice in quick succession to simulate retry from another device
		r1 = self.client.post(self.url, {"ops": [op]}, format="json")
		r2 = self.client.post(self.url, {"ops": [op]}, format="json")
		self.assertEqual(r1.status_code, status.HTTP_200_OK)
		self.assertEqual(r2.status_code, status.HTTP_200_OK)
		self.assertEqual(Expense.objects.filter(user=self.user, name='Milk').count(), 1)

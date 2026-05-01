from rest_framework import permissions, status, viewsets
from rest_framework.views import APIView
from rest_framework.response import Response
from .models import Expense, UserBackup, UserIncome, OperationLog, SyncDeviceState
from .serializers import ExpenseSerializer, UserBackupSerializer, UserIncomeSerializer
from django.db import transaction
from django.utils import timezone
from django.utils.dateparse import parse_datetime


def _parse_expected_updated_at(value):
    """Parse optional expected_updated_at strings for conflict checks."""
    if not value:
        return None
    dt = parse_datetime(value)
    if not dt:
        return None
    if timezone.is_naive(dt):
        dt = timezone.make_aware(dt, timezone.get_current_timezone())
    return dt


def _get_device_id(request):
    device_id = request.headers.get("X-Device-ID") or request.data.get("device_id")
    return str(device_id).strip() if device_id else ""


def _touch_device_state(user, device_id, backup_revision=None, synced=False):
    if not device_id:
        return None

    defaults = {}
    if backup_revision is not None:
        defaults["last_backup_revision"] = str(backup_revision)

    device_state, _ = SyncDeviceState.objects.get_or_create(
        user=user,
        device_id=device_id,
        defaults=defaults,
    )

    updates = ["last_seen_at"]
    device_state.last_seen_at = timezone.now()
    if synced:
        device_state.last_sync_at = timezone.now()
        updates.append("last_sync_at")
    if backup_revision is not None:
        device_state.last_backup_revision = str(backup_revision)
        updates.append("last_backup_revision")
    device_state.save(update_fields=updates)
    return device_state

class ExpenseViewSet(viewsets.ModelViewSet):
    serializer_class = ExpenseSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = Expense.objects.filter(user=self.request.user)
        month = self.request.query_params.get('month', None)
        if month is not None:
            queryset = queryset.filter(month=month)
        # Newest-first ordering keeps dashboard/history lists stable and predictable.
        return queryset.order_by('-created_at')

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

class UserIncomeViewSet(viewsets.ViewSet):
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        obj, created = UserIncome.objects.get_or_create(user=self.request.user)
        return obj

    def list(self, request):
        obj = self.get_object()
        _touch_device_state(request.user, _get_device_id(request))
        serializer = UserIncomeSerializer(obj)
        return Response(serializer.data)

    def update(self, request, pk=None):
        obj = self.get_object()
        _touch_device_state(request.user, _get_device_id(request))
        expected_updated_at = _parse_expected_updated_at(request.data.get("expected_updated_at"))
        if expected_updated_at and obj.updated_at and obj.updated_at > expected_updated_at:
            return Response(
                {
                    "detail": "Income was updated on another device. Pull latest income before saving.",
                    "server_income": UserIncomeSerializer(obj).data,
                    "server_updated_at": obj.updated_at.isoformat() if obj.updated_at else None,
                },
                status=status.HTTP_409_CONFLICT,
            )

        payload = request.data.copy()
        payload.pop("expected_updated_at", None)
        payload.pop("force", None)
        serializer = UserIncomeSerializer(obj, data=payload)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class UserBackupView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self, user):
        backup, _ = UserBackup.objects.get_or_create(user=user)
        return backup

    def get(self, request):
        backup = self.get_object(request.user)
        _touch_device_state(request.user, _get_device_id(request), backup.revision)
        serializer = UserBackupSerializer(backup)
        return Response(serializer.data)

    def put(self, request):
        backup = self.get_object(request.user)
        device_id = _get_device_id(request)
        _touch_device_state(request.user, device_id, backup.revision)

        # Optional optimistic concurrency token from client.
        # If supplied, reject stale writes so one device does not silently
        # overwrite a newer cloud snapshot written by another device.
        expected_revision = request.data.get("expected_revision")
        if expected_revision and str(expected_revision) != str(backup.revision):
            return Response(
                {
                    "detail": "Cloud backup was updated on another device. Pull latest backup before pushing.",
                    "revision": backup.revision,
                    "updated_at": backup.updated_at,
                },
                status=status.HTTP_409_CONFLICT,
            )

        payload = request.data.copy()
        payload.pop("expected_revision", None)
        serializer = UserBackupSerializer(backup, data=payload)
        if serializer.is_valid():
            instance = serializer.save()
            instance.bump_revision()
            instance.save(update_fields=["data", "revision", "updated_at"])
            _touch_device_state(request.user, device_id, instance.revision)
            return Response(UserBackupSerializer(instance).data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    patch = put


class SyncOpsView(APIView):
    """Accept a batch of client operations and apply them idempotently.

    Expected payload:
    {
      "ops": [
         {"op_id": "uuid", "type": "create|update|delete", "resource": "expense|income", "client_id": "optional", "payload": {...} },
      ]
    }

    Returns per-op results and ignores duplicate `op_id`s.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        ops = request.data.get('ops') or []
        device_id = _get_device_id(request)
        results = []
        for op in ops:
            op_id = op.get('op_id')
            if not op_id:
                results.append({"op_id": None, "status": "error", "error": "missing op_id"})
                continue

            # Check for existing processed op
            existing = OperationLog.objects.filter(user=request.user, op_id=op_id).first()
            if existing and existing.processed_at:
                if isinstance(existing.result, dict) and existing.result.get("conflict"):
                    results.append({"op_id": op_id, "status": "conflict", "conflict": existing.result.get("conflict"), "processed_at": existing.processed_at})
                else:
                    results.append({"op_id": op_id, "status": "ok", "result": existing.result, "processed_at": existing.processed_at})
                continue

            # Create OperationLog stub
            log = OperationLog.objects.create(
                user=request.user,
                device_id=device_id,
                op_id=op_id,
                resource=op.get('resource', ''),
                op_type=op.get('type', ''),
                client_resource_id=op.get('client_id')
            )

            try:
                with transaction.atomic():
                    res = self._apply_op(request.user, op, log)
                    log.mark_processed(res)
                    if isinstance(res, dict) and res.get("conflict"):
                        results.append({"op_id": op_id, "status": "conflict", "conflict": res.get("conflict"), "processed_at": log.processed_at})
                    else:
                        results.append({"op_id": op_id, "status": "ok", "result": res, "processed_at": log.processed_at})
            except Exception as e:
                # record error result but keep the op log so retries don't reapply partially
                err = {"error": str(e)}
                log.mark_processed(err)
                results.append({"op_id": op_id, "status": "error", "error": str(e), "processed_at": log.processed_at})

        _touch_device_state(request.user, device_id, synced=True)
        return Response({"results": results})

    def _apply_op(self, user, op, log):
        typ = op.get('type')
        resource = op.get('resource')
        payload = op.get('payload') or {}

        if resource == 'expense':
            if typ == 'create':
                serializer = ExpenseSerializer(data=payload)
                if serializer.is_valid(raise_exception=True):
                    expense = serializer.save(user=user)
                    log.resource_pk = expense.id
                    log.save(update_fields=['resource_pk'])
                    return ExpenseSerializer(expense).data
            elif typ == 'update':
                # accept server id in payload.id
                pk = payload.get('id')
                if not pk:
                    raise ValueError('update expense requires id')
                expense = Expense.objects.get(id=pk, user=user)
                serializer = ExpenseSerializer(expense, data=payload, partial=True)
                if serializer.is_valid(raise_exception=True):
                    expense = serializer.save()
                    return {'id': expense.id}
            elif typ == 'delete':
                pk = payload.get('id')
                if not pk:
                    raise ValueError('delete expense requires id')
                Expense.objects.filter(id=pk, user=user).delete()
                return {'deleted_id': pk}

        if resource == 'income':
            # income is singleton
            if typ in ('create', 'update'):
                obj, _ = UserIncome.objects.get_or_create(user=user)
                expected_updated_at = _parse_expected_updated_at(payload.get("expected_updated_at"))
                force = bool(payload.get("force"))
                if expected_updated_at and obj.updated_at and obj.updated_at > expected_updated_at and not force:
                    return {
                        "conflict": {
                            "resource": "income",
                            "reason": "stale_income_update",
                            "server_income": UserIncomeSerializer(obj).data,
                            "server_updated_at": obj.updated_at.isoformat() if obj.updated_at else None,
                            "expected_updated_at": payload.get("expected_updated_at"),
                        }
                    }

                # Strip conflict-only fields before serializer validation.
                income_payload = {
                    key: value
                    for key, value in payload.items()
                    if key in {
                        "monthly_income",
                        "work_hours_per_month",
                        "hourly_rate",
                        "is_hourly_manual",
                        "calculation_method",
                        "hours_per_day",
                        "days_per_week",
                    }
                }
                serializer = UserIncomeSerializer(obj, data=income_payload, partial=True)
                if serializer.is_valid(raise_exception=True):
                    serializer.save()
                    return {'income': UserIncomeSerializer(obj).data}

        raise ValueError('unsupported op')

from rest_framework import permissions, status, viewsets
from rest_framework.views import APIView
from rest_framework.response import Response
from .models import Expense, UserBackup, UserIncome
from .serializers import ExpenseSerializer, UserBackupSerializer, UserIncomeSerializer

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
        serializer = UserIncomeSerializer(obj)
        return Response(serializer.data)

    def update(self, request, pk=None):
        obj = self.get_object()
        serializer = UserIncomeSerializer(obj, data=request.data)
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
        serializer = UserBackupSerializer(backup)
        return Response(serializer.data)

    def put(self, request):
        backup = self.get_object(request.user)
        serializer = UserBackupSerializer(backup, data=request.data)
        if serializer.is_valid():
            instance = serializer.save()
            instance.bump_revision()
            instance.save(update_fields=["data", "revision", "updated_at"])
            return Response(UserBackupSerializer(instance).data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    patch = put

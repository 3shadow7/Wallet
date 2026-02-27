from rest_framework import viewsets, permissions, status
from rest_framework.response import Response
from .models import Expense, UserIncome
from .serializers import ExpenseSerializer, UserIncomeSerializer

class ExpenseViewSet(viewsets.ModelViewSet):
    serializer_class = ExpenseSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = Expense.objects.filter(user=self.request.user)
        month = self.request.query_params.get('month', None)
        if month is not None:
            queryset = queryset.filter(month=month)
        return queryset

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

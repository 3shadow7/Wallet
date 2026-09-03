from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ExpenseViewSet, UserIncomeViewSet

router = DefaultRouter()
router.register(r"expenses", ExpenseViewSet, basename="expenses")
# income is a singleton per user, using basename but standard router for simplicity
urlpatterns = [
    path("", include(router.urls)),
    path("income/", UserIncomeViewSet.as_view({"get": "list", "put": "update", "patch": "update"}), name="income"),
]

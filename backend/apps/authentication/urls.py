from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from .views import register_user, CustomTokenObtainPairView, current_user

urlpatterns = [
    path('register/', register_user, name='auth_register'),
    path('login/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('me/', current_user, name='current_user'),
]

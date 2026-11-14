from django.urls import path

from common import views

urlpatterns = [
    path("health/", views.health, name="health"),
    path("me/", views.me, name="me"),
]

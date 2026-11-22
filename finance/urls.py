from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    CategoryViewSet,
    TransactionViewSet,
    DashboardSummaryView,
    MonthlySummaryView,
)

router = DefaultRouter()
router.register("categories", CategoryViewSet, basename="category")
router.register("transactions", TransactionViewSet, basename="transaction")

urlpatterns = [
    path("dashboard/summary/", DashboardSummaryView.as_view()),
    path("dashboard/monthly-summary/", MonthlySummaryView.as_view()),
] + router.urls
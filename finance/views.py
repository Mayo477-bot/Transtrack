from django.db.models import Sum, Q
from django.db.models.functions import TruncMonth
from django.utils.dateparse import parse_date

from rest_framework import viewsets
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from rest_framework.response import Response

from .models import Category, Transaction
from .serializers import CategorySerializer, TransactionSerializer


class CategoryViewSet(viewsets.ModelViewSet):
    serializer_class = CategorySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Category.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class TransactionViewSet(viewsets.ModelViewSet):
    serializer_class = TransactionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = Transaction.objects.filter(user=self.request.user)
        params = self.request.query_params

        transaction_type = params.get("type")
        if transaction_type:
            if transaction_type not in ["income", "expense"]:
                raise ValidationError({"type": "Use income or expense."})
            queryset = queryset.filter(transaction_type=transaction_type)

        currency = params.get("currency")
        if currency:
            currency = currency.upper()
            if len(currency) != 3:
                raise ValidationError({"currency": "Use a three-letter currency code."})
            queryset = queryset.filter(currency=currency)

        category = params.get("category")
        if category:
            try:
                category_id = int(category)
                if category_id <= 0:
                    raise ValueError
            except ValueError:
                raise ValidationError({"category": "Enter a valid category ID."})
            queryset = queryset.filter(category_id=category_id)

        date_from = params.get("date_from")
        date_to = params.get("date_to")

        start_date = parse_date(date_from) if date_from else None
        end_date = parse_date(date_to) if date_to else None

        if date_from and not start_date:
            raise ValidationError({"date_from": "Use YYYY-MM-DD format."})

        if date_to and not end_date:
            raise ValidationError({"date_to": "Use YYYY-MM-DD format."})

        if start_date and end_date and start_date > end_date:
            raise ValidationError("Start date cannot be after end date.")

        if start_date:
            queryset = queryset.filter(transaction_date__gte=start_date)

        if end_date:
            queryset = queryset.filter(transaction_date__lte=end_date)

        return queryset

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class DashboardSummaryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        transactions = Transaction.objects.filter(user=request.user)

        summary = transactions.values("currency").annotate(
            total_income=Sum(
                "amount",
                filter=Q(transaction_type="income")
            ),
            total_expenses=Sum(
                "amount",
                filter=Q(transaction_type="expense")
            ),
        ).order_by("currency")

        results = []

        for item in summary:
            income = item["total_income"] or 0
            expenses = item["total_expenses"] or 0

            results.append({
                "currency": item["currency"],
                "total_income": income,
                "total_expenses": expenses,
                "balance": income - expenses,
            })

        return Response(results)


class MonthlySummaryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        transactions = Transaction.objects.filter(user=request.user)
        monthly_data = (
            transactions
            .annotate(month=TruncMonth("transaction_date"))
            .values("month", "currency")
            .annotate(
                total_income=Sum(
                    "amount",
                    filter=Q(transaction_type="income")
                ),
                total_expenses=Sum(
                    "amount",
                    filter=Q(transaction_type="expense")
                ),
            )
            .order_by("month", "currency")
        )

        results = []

        for item in monthly_data:
            income = item["total_income"] or 0
            expenses = item["total_expenses"] or 0

            results.append({
                "month": item["month"].strftime("%Y-%m"),
                "currency": item["currency"],
                "total_income": income,
                "total_expenses": expenses,
                "balance": income - expenses,
            })

        return Response(results)
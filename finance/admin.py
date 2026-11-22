from django.contrib import admin
from .models import Category, Transaction


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "user", "category_type", "created_at")
    list_filter = ("category_type",)
    search_fields = ("name",)


@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = (
        "user",
        "category",
        "amount",
        "currency",
        "transaction_type",
        "transaction_date",
    )
    list_filter = ("transaction_type", "currency", "transaction_date")
    search_fields = ("description",)
    date_hierarchy = "transaction_date"
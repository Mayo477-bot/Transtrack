from rest_framework import serializers
from .models import Category, Transaction


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ["id", "name", "category_type", "created_at"]
        read_only_fields = ["id", "created_at"]


class TransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Transaction
        fields = [
            "id",
            "category",
            "transaction_type",
            "amount",
            "currency",
            "description",
            "transaction_date",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate_category(self, category):
        user = self.context["request"].user

        if category.user_id != user.id:
            raise serializers.ValidationError(
                "You cannot use another user's category."
            )

        return category

    def validate(self, attrs):
        category = attrs.get(
            "category",
            getattr(self.instance, "category", None)
        )
        transaction_type = attrs.get(
            "transaction_type",
            getattr(self.instance, "transaction_type", None)
        )

        if category and category.category_type != transaction_type:
            raise serializers.ValidationError({
                "category": "Category type must match transaction type."
            })

        return attrs
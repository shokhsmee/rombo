from decimal import Decimal

from rest_framework import serializers

from apps.clients.models import Client
from apps.core.serializers import RefSerializer
from apps.employees.models import Employee
from apps.inventory.models import Category, MoveType, Product, StockMove, Warehouse
from apps.pricing.models import PriceListItem
from apps.projects.models import Project

# ------------------------------------------------------------------ warehouses


class WarehouseRefSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    name = serializers.CharField(read_only=True)


class WarehouseSerializer(serializers.ModelSerializer):
    responsible = RefSerializer(read_only=True)
    responsible_id = serializers.PrimaryKeyRelatedField(
        source="responsible", queryset=Employee.objects.all(), required=False, allow_null=True
    )
    has_moves = serializers.BooleanField(read_only=True, default=False)

    class Meta:
        model = Warehouse
        fields = [
            "id",
            "name",
            "address",
            "responsible",
            "responsible_id",
            "is_default",
            "is_active",
            "has_moves",
            "updated_at",
        ]


# ------------------------------------------------------------------ products


class ProductRefSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    code = serializers.CharField(read_only=True, allow_null=True)
    name = serializers.CharField(read_only=True)
    sku = serializers.CharField(read_only=True)
    unit = serializers.CharField(read_only=True)
    category = serializers.CharField(read_only=True)


class ProductSerializer(serializers.ModelSerializer):
    category = serializers.ChoiceField(choices=Category.choices, required=False)
    price_item_id = serializers.PrimaryKeyRelatedField(
        source="price_item", queryset=PriceListItem.objects.all(), required=False, allow_null=True
    )
    price_item = serializers.SerializerMethodField()
    default_cost = serializers.DecimalField(
        max_digits=18, decimal_places=2, required=False, min_value=Decimal("0")
    )
    qty_on_hand = serializers.SerializerMethodField()
    value_on_hand = serializers.SerializerMethodField()
    avg_cost = serializers.SerializerMethodField()
    qty_in_warehouse = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            "id",
            "code",
            "name",
            "sku",
            "unit",
            "category",
            "default_cost",
            "price_item_id",
            "price_item",
            "is_active",
            "notes",
            "qty_on_hand",
            "value_on_hand",
            "avg_cost",
            "qty_in_warehouse",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["code"]

    def get_qty_in_warehouse(self, obj) -> str | None:
        """Quantity in the `?warehouse=` of the list (the move form's picker), else null."""
        hand = self.context.get("in_warehouse")
        return None if hand is None else str(hand.get(obj.pk, Decimal("0")))

    def get_price_item(self, obj):
        it = obj.price_item
        return None if it is None else {"id": it.pk, "name": it.name, "price_list": it.price_list_id}

    def _hand(self, obj):
        hand = self.context.get("on_hand")
        if hand is None:
            from apps.inventory.selectors import products_on_hand

            hand = products_on_hand([obj.pk])
        return hand.get(obj.pk, (Decimal("0"), Decimal("0")))

    def get_qty_on_hand(self, obj) -> str:
        return str(self._hand(obj)[0])

    def get_value_on_hand(self, obj) -> str:
        return str(self._hand(obj)[1])

    def get_avg_cost(self, obj) -> str | None:
        q, v = self._hand(obj)
        return str((v / q).quantize(Decimal("0.01"))) if q > 0 else None


# ------------------------------------------------------------------ moves


class StockMoveListSerializer(serializers.ModelSerializer):
    product = ProductRefSerializer(read_only=True)
    warehouse = WarehouseRefSerializer(read_only=True)
    to_warehouse = WarehouseRefSerializer(read_only=True)
    project = RefSerializer(read_only=True)
    partner = RefSerializer(read_only=True)
    entry_code = serializers.CharField(source="entry.code", read_only=True, default=None)
    entry_id = serializers.IntegerField(read_only=True)

    class Meta:
        model = StockMove
        fields = [
            "id",
            "code",
            "type",
            "status",
            "date",
            "product",
            "warehouse",
            "to_warehouse",
            "qty",
            "unit_cost",
            "amount",
            "project",
            "partner",
            "source_model",
            "source_id",
            "source_label",
            "entry_code",
            "entry_id",
            "notes",
            "created_at",
        ]


class StockMoveSerializer(StockMoveListSerializer):
    type = serializers.ChoiceField(choices=MoveType.choices)
    date = serializers.DateField(required=False)
    product_id = serializers.PrimaryKeyRelatedField(source="product", queryset=Product.objects.all())
    warehouse_id = serializers.PrimaryKeyRelatedField(
        source="warehouse", queryset=Warehouse.objects.all(), required=False, allow_null=True
    )
    to_warehouse_id = serializers.PrimaryKeyRelatedField(
        source="to_warehouse", queryset=Warehouse.objects.all(), required=False, allow_null=True
    )
    project_id = serializers.PrimaryKeyRelatedField(
        source="project", queryset=Project.objects.all(), required=False, allow_null=True
    )
    partner_id = serializers.PrimaryKeyRelatedField(
        source="partner", queryset=Client.objects.all(), required=False, allow_null=True
    )
    qty = serializers.DecimalField(max_digits=14, decimal_places=3)
    unit_cost = serializers.DecimalField(max_digits=18, decimal_places=2, required=False, allow_null=True)
    amount = serializers.DecimalField(max_digits=18, decimal_places=2, read_only=True)
    on_hand = serializers.SerializerMethodField()
    posted_by = serializers.CharField(source="posted_by.full_name", read_only=True, default="")
    created_by = serializers.CharField(source="created_by.full_name", read_only=True, default="")
    allowed_statuses = serializers.ListField(read_only=True)

    class Meta(StockMoveListSerializer.Meta):
        fields = [
            *StockMoveListSerializer.Meta.fields,
            "product_id",
            "warehouse_id",
            "to_warehouse_id",
            "project_id",
            "partner_id",
            "on_hand",
            "posted_at",
            "posted_by",
            "created_by",
            "allowed_statuses",
            "updated_at",
        ]

    def get_on_hand(self, obj) -> dict | None:
        """What the warehouse holds now and the product's average — the form shows it next to the qty."""
        if obj.pk is None or obj.status != "draft":
            return None
        from apps.inventory import selectors

        avg = selectors.average_cost(obj.product)
        return {
            "qty": str(selectors.warehouse_qty(obj.product, obj.warehouse)),
            "avg_cost": None if avg is None else str(avg),
        }


class CancelSerializer(serializers.Serializer):
    comment = serializers.CharField(allow_blank=True, required=False, default="", max_length=500)
    date = serializers.DateField(required=False, allow_null=True)


class StockQuerySerializer(serializers.Serializer):
    warehouse = serializers.IntegerField(required=False, allow_null=True)
    category = serializers.ChoiceField(choices=Category.choices, required=False, allow_blank=True)
    q = serializers.CharField(required=False, allow_blank=True, default="")
    nonzero = serializers.BooleanField(required=False, default=True)

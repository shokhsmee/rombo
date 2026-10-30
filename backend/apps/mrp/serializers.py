from decimal import Decimal

from rest_framework import serializers

from apps.inventory.models import Product
from apps.inventory.serializers import ProductRefSerializer
from apps.mrp import selectors, services
from apps.mrp.models import Basis, Bom, BomLine
from apps.projects.models import ProjectCalc


class BomLineSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(required=False)
    component = ProductRefSerializer(read_only=True)
    component_id = serializers.PrimaryKeyRelatedField(source="component", queryset=Product.objects.all())
    basis = serializers.ChoiceField(choices=Basis.choices, required=False)
    qty = serializers.DecimalField(max_digits=14, decimal_places=4, min_value=Decimal("0.0001"))
    waste_pct = serializers.DecimalField(max_digits=5, decimal_places=2, min_value=Decimal("0"), required=False)

    class Meta:
        model = BomLine
        fields = ["id", "component", "component_id", "qty", "basis", "waste_pct", "note"]


class BomListSerializer(serializers.ModelSerializer):
    product = ProductRefSerializer(read_only=True)
    lines_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Bom
        fields = ["id", "code", "product", "name", "version", "is_active", "lines_count", "updated_at"]


class BomSerializer(BomListSerializer):
    product_id = serializers.PrimaryKeyRelatedField(source="product", queryset=Product.objects.all())
    lines = BomLineSerializer(many=True, required=False)
    previous_code = serializers.CharField(source="previous.code", read_only=True, default=None)
    in_use = serializers.SerializerMethodField()
    cost = serializers.SerializerMethodField()

    class Meta(BomListSerializer.Meta):
        fields = [*BomListSerializer.Meta.fields, "product_id", "lines", "notes", "previous_code", "in_use", "cost",
                  "created_at"]

    def get_in_use(self, obj) -> bool:
        return services.bom_in_use(obj)

    def get_cost(self, obj) -> dict:
        c = selectors.bom_cost(obj)
        return {"per_piece": str(c["per_piece"]), "per_m2": str(c["per_m2"]), "lines": c["lines"]}


class BomLineImportSerializer(serializers.ModelSerializer):
    """One row of the BOM-lines Excel import: the BOM is named by its code or by its product."""

    bom_id = serializers.PrimaryKeyRelatedField(source="bom", queryset=Bom.objects.all())
    component = ProductRefSerializer(read_only=True)
    component_id = serializers.PrimaryKeyRelatedField(source="component", queryset=Product.objects.all())
    bom_code = serializers.CharField(source="bom.code", read_only=True)
    product_name = serializers.CharField(source="bom.product.name", read_only=True)
    basis = serializers.ChoiceField(choices=Basis.choices, required=False)
    waste_pct = serializers.DecimalField(max_digits=5, decimal_places=2, min_value=Decimal("0"), required=False)

    class Meta:
        model = BomLine
        fields = ["id", "bom_id", "bom_code", "product_name", "component", "component_id", "qty", "basis", "waste_pct",
                  "note"]


class ItemProductSerializer(serializers.Serializer):
    position = serializers.IntegerField(min_value=0)
    product_id = serializers.PrimaryKeyRelatedField(source="product", queryset=Product.objects.all(),
                                                    allow_null=True)


class FillCalcSerializer(serializers.Serializer):
    calc_id = serializers.PrimaryKeyRelatedField(source="calc", queryset=ProjectCalc.objects.all())


class ToIssueSerializer(serializers.Serializer):
    warehouse_id = serializers.IntegerField(required=False, allow_null=True)


class PlanQuerySerializer(serializers.Serializer):
    project = serializers.IntegerField(required=False, allow_null=True)
    category = serializers.CharField(required=False, allow_blank=True)
    deadline_before = serializers.DateField(required=False, allow_null=True)
    only_short = serializers.BooleanField(required=False, default=False)


class ToRequestsSerializer(serializers.Serializer):
    product_ids = serializers.ListField(child=serializers.IntegerField(), min_length=1)

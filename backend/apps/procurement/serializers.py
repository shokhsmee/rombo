from decimal import Decimal

from rest_framework import serializers

from apps.clients.models import Client, ClientKind
from apps.core.serializers import RefSerializer, UserRefSerializer
from apps.pricing.models import PriceListItem
from apps.procurement import selectors
from apps.procurement.models import (
    Currency,
    GoodsReceipt,
    GoodsReceiptLine,
    PurchaseOrder,
    PurchaseOrderLine,
    PurchaseRequest,
    PurchaseRequestLine,
    SentVia,
)
from apps.projects.models import Project, ProjectCalc

MONEY = dict(max_digits=18, decimal_places=2, read_only=True)
QTY = dict(max_digits=12, decimal_places=2, read_only=True)


class DocRefSerializer(serializers.Serializer):
    """{"id": 3, "code": "XB-00003"} — a document has a code, not a name."""

    id = serializers.IntegerField(read_only=True)
    code = serializers.CharField(read_only=True, allow_null=True)


class TotalsSerializer(serializers.Serializer):
    net = serializers.DecimalField(**MONEY)
    vat = serializers.DecimalField(**MONEY)
    gross = serializers.DecimalField(**MONEY)
    net_uzs = serializers.DecimalField(**MONEY)
    vat_uzs = serializers.DecimalField(**MONEY)
    gross_uzs = serializers.DecimalField(**MONEY)


class CommentSerializer(serializers.Serializer):
    comment = serializers.CharField(required=False, allow_blank=True, default="")


# ------------------------------------------------------------------ purchase request


class RequestLineSerializer(serializers.ModelSerializer):
    item_id = serializers.PrimaryKeyRelatedField(source="item", queryset=PriceListItem.objects.all(),
                                                 allow_null=True, required=False)
    remaining_qty = serializers.DecimalField(**QTY)

    class Meta:
        model = PurchaseRequestLine
        fields = ["id", "item_id", "name", "unit", "qty", "note", "ordered_qty", "remaining_qty"]
        read_only_fields = ["ordered_qty"]
        extra_kwargs = {"qty": {"min_value": Decimal("0.01")}}


class RequestListSerializer(serializers.ModelSerializer):
    project = RefSerializer(read_only=True)
    requester = UserRefSerializer(read_only=True)
    lines_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = PurchaseRequest
        fields = ["id", "code", "status", "project", "requester", "needed_by", "lines_count", "created_at"]


class RequestSerializer(RequestListSerializer):
    project_id = serializers.PrimaryKeyRelatedField(source="project", queryset=Project.objects.all())
    lines = RequestLineSerializer(many=True, required=False)
    approved_by = UserRefSerializer(read_only=True)
    allowed_statuses = serializers.ListField(child=serializers.CharField(), read_only=True)
    project_status = serializers.CharField(source="project.status", read_only=True)

    class Meta(RequestListSerializer.Meta):
        fields = [*RequestListSerializer.Meta.fields, "project_id", "project_status", "notes", "lines",
                  "submitted_at", "approved_at", "approved_by", "allowed_statuses", "updated_at"]


class FromCalcSerializer(serializers.Serializer):
    calc_id = serializers.PrimaryKeyRelatedField(source="calc", queryset=ProjectCalc.objects.all())


# ------------------------------------------------------------------ purchase order


class OrderLineSerializer(serializers.ModelSerializer):
    request_line_id = serializers.PrimaryKeyRelatedField(source="request_line",
                                                         queryset=PurchaseRequestLine.objects.all(),
                                                         allow_null=True, required=False)
    item_id = serializers.PrimaryKeyRelatedField(source="item", queryset=PriceListItem.objects.all(),
                                                 allow_null=True, required=False)
    project = RefSerializer(read_only=True)
    request_code = serializers.CharField(source="request_line.request.code", read_only=True, default=None)
    name = serializers.CharField(max_length=200, required=False, allow_blank=True)
    unit = serializers.CharField(max_length=20, required=False, allow_blank=True)
    price = serializers.DecimalField(max_digits=14, decimal_places=2, min_value=0, required=False,
                                     allow_null=True)
    vat_rate = serializers.DecimalField(max_digits=5, decimal_places=2, min_value=0, max_value=100,
                                        required=False,
                                        allow_null=True)
    remaining_qty = serializers.DecimalField(**QTY)
    net = serializers.DecimalField(**MONEY)
    vat = serializers.DecimalField(**MONEY)
    gross = serializers.DecimalField(**MONEY)

    class Meta:
        model = PurchaseOrderLine
        fields = ["id", "request_line_id", "request_code", "project", "item_id", "name", "unit", "qty",
                  "price",
                  "vat_rate", "received_qty", "remaining_qty", "net", "vat", "gross"]
        read_only_fields = ["received_qty"]
        extra_kwargs = {"qty": {"min_value": Decimal("0.01")}}


class OrderListSerializer(serializers.ModelSerializer):
    supplier = RefSerializer(read_only=True)
    project = RefSerializer(read_only=True)
    totals = serializers.SerializerMethodField()

    class Meta:
        model = PurchaseOrder
        fields = ["id", "code", "status", "supplier", "project", "date", "expected_date", "currency", "rate",
                  "sent_at", "sent_via", "totals", "created_at"]

    def get_totals(self, obj) -> dict:
        return TotalsSerializer(obj.totals()).data


class OrderSerializer(OrderListSerializer):
    supplier_id = serializers.PrimaryKeyRelatedField(source="supplier",
                                                     queryset=Client.objects.filter(kind=ClientKind.SUPPLIER))
    project_id = serializers.PrimaryKeyRelatedField(source="project", queryset=Project.objects.all(),
                                                    allow_null=True, required=False)
    supplier_email = serializers.CharField(source="supplier.email", read_only=True)
    supplier_balance = serializers.SerializerMethodField()
    lines = OrderLineSerializer(many=True, required=False)
    sent_by = UserRefSerializer(read_only=True)
    allowed_statuses = serializers.ListField(child=serializers.CharField(), read_only=True)
    receipts = DocRefSerializer(many=True, read_only=True)
    date = serializers.DateField(required=False)

    class Meta(OrderListSerializer.Meta):
        fields = [*OrderListSerializer.Meta.fields, "supplier_id", "supplier_email", "supplier_balance",
                  "project_id", "notes", "lines", "sent_by", "sent_to", "receipts", "allowed_statuses",
                  "updated_at"]

    def get_supplier_balance(self, obj) -> dict:
        b = selectors.supplier_balance(obj.supplier)
        return {"balance_uzs": str(b["balance_uzs"]),
                "balance_cur": None if b["balance_cur"] is None else str(b["balance_cur"])}


class SendSerializer(serializers.Serializer):
    via = serializers.ChoiceField(choices=SentVia.choices)
    to = serializers.CharField(required=False, allow_blank=True, default="", max_length=200)
    note = serializers.CharField(required=False, allow_blank=True, default="", max_length=500)


class FromRequestsLineSerializer(serializers.Serializer):
    request_line_id = serializers.PrimaryKeyRelatedField(source="request_line",
                                                         queryset=PurchaseRequestLine.objects.all())
    supplier_id = serializers.PrimaryKeyRelatedField(source="supplier",
                                                     queryset=Client.objects.filter(kind=ClientKind.SUPPLIER))
    qty = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal("0.01"),
                                   required=False, allow_null=True)


class FromRequestsSerializer(serializers.Serializer):
    lines = FromRequestsLineSerializer(many=True)
    expected_date = serializers.DateField(required=False, allow_null=True)
    notes = serializers.CharField(required=False, allow_blank=True, default="")


# ------------------------------------------------------------------ goods receipt


class ReceiptLineSerializer(serializers.ModelSerializer):
    order_line_id = serializers.PrimaryKeyRelatedField(source="order_line",
                                                       queryset=PurchaseOrderLine.objects.all())
    name = serializers.CharField(source="order_line.name", read_only=True)
    unit = serializers.CharField(source="order_line.unit", read_only=True)
    project = RefSerializer(source="order_line.project", read_only=True)
    ordered_qty = serializers.DecimalField(source="order_line.qty", **QTY)
    order_received_qty = serializers.DecimalField(source="order_line.received_qty", **QTY)
    price = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)
    vat_rate = serializers.DecimalField(max_digits=5, decimal_places=2, read_only=True)
    net = serializers.DecimalField(**MONEY)
    vat = serializers.DecimalField(**MONEY)
    gross = serializers.DecimalField(**MONEY)

    class Meta:
        model = GoodsReceiptLine
        fields = ["id", "order_line_id", "name", "unit", "project", "ordered_qty", "order_received_qty",
                  "qty",
                  "price", "vat_rate", "net", "vat", "gross"]
        extra_kwargs = {"qty": {"min_value": Decimal("0.01")}}


class ReceiptListSerializer(serializers.ModelSerializer):
    order = DocRefSerializer(read_only=True)
    supplier = RefSerializer(read_only=True)
    storekeeper = UserRefSerializer(read_only=True)
    currency = serializers.CharField(source="order.currency", read_only=True)
    totals = serializers.SerializerMethodField()

    class Meta:
        model = GoodsReceipt
        fields = ["id", "code", "status", "order", "supplier", "date", "storekeeper", "invoice_number",
                  "currency",
                  "totals", "created_at"]

    def get_totals(self, obj) -> dict:
        return TotalsSerializer(obj.totals()).data


class ReceiptSerializer(ReceiptListSerializer):
    order_id = serializers.PrimaryKeyRelatedField(source="order", queryset=PurchaseOrder.objects.all())
    project = RefSerializer(source="order.project", read_only=True)
    rate = serializers.DecimalField(source="order.rate", max_digits=12, decimal_places=2, read_only=True)
    date = serializers.DateField(required=False)
    lines = ReceiptLineSerializer(many=True, required=False)
    posted_by = UserRefSerializer(read_only=True)
    allowed_statuses = serializers.ListField(child=serializers.CharField(), read_only=True)

    class Meta(ReceiptListSerializer.Meta):
        fields = [*ReceiptListSerializer.Meta.fields, "order_id", "project", "rate", "invoice_date",
                  "invoice_total",
                  "notes", "lines", "posted_at", "posted_by", "entry_id", "allowed_statuses", "updated_at"]
        read_only_fields = ["entry_id"]


# ------------------------------------------------------------------ suppliers (clients of kind supplier)


class SupplierSerializer(serializers.ModelSerializer):
    kind = serializers.CharField(read_only=True)
    price_currency = serializers.ChoiceField(choices=Currency.choices, required=False)
    balance_uzs = serializers.SerializerMethodField()
    balance_cur = serializers.SerializerMethodField()
    orders_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Client
        fields = ["id", "code", "kind", "name", "tin", "contact_person", "phone", "phone_extra", "email",
                  "region",
                  "address", "bank_account", "bank_name", "mfo", "price_currency", "prepay_percent",
                  "credit_days", "notes", "is_active", "balance_uzs", "balance_cur", "orders_count",
                  "created_at", "updated_at"]

    def _balance(self, obj) -> dict:
        cache = self.context.setdefault("_balances", {})
        if obj.pk not in cache:
            cache[obj.pk] = selectors.supplier_balance(obj)
        return cache[obj.pk]

    def get_balance_uzs(self, obj) -> str:
        return str(self._balance(obj)["balance_uzs"])

    def get_balance_cur(self, obj) -> str | None:
        cur = self._balance(obj)["balance_cur"]
        return None if cur is None else str(cur)

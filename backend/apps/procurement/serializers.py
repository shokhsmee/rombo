from decimal import Decimal

from rest_framework import serializers

from apps.access.models import Role
from apps.access.registry import Action, Pages
from apps.access.services import has_permission
from apps.clients.models import Client, ClientKind
from apps.core.serializers import RefSerializer, UserRefSerializer
from apps.inventory.models import Category, MoveStatus, Product, StockMove, Warehouse
from apps.pricing.models import PriceListItem
from apps.procurement import selectors, services
from apps.procurement.models import (
    ApprovalStep,
    Currency,
    Decision,
    GoodsReceipt,
    GoodsReceiptLine,
    PurchaseOrder,
    PurchaseOrderLine,
    PurchaseRequest,
    PurchaseRequestLine,
    RequestApproval,
    RequestStatus,
    SentVia,
)
from apps.projects.models import Project, ProjectCalc

MONEY = dict(max_digits=18, decimal_places=2, read_only=True)
QTY = dict(max_digits=12, decimal_places=2, read_only=True)


class ProductRefSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    code = serializers.CharField(read_only=True, allow_null=True)
    name = serializers.CharField(read_only=True)
    unit = serializers.CharField(read_only=True)
    category = serializers.CharField(read_only=True)


def product_field():
    """Writable `product_id` of a purchase line (improve-product-selection)."""
    return serializers.PrimaryKeyRelatedField(source="product", queryset=Product.objects.all(),
                                              allow_null=True, required=False)


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
    product_id = product_field()
    product = ProductRefSerializer(read_only=True)

    class Meta:
        model = PurchaseRequestLine
        fields = ["id", "item_id", "product_id", "product", "name", "unit", "qty", "note", "ordered_qty",
                  "remaining_qty"]
        read_only_fields = ["ordered_qty"]
        extra_kwargs = {"qty": {"min_value": Decimal("0.01")}}


class RequestListSerializer(serializers.ModelSerializer):
    project = RefSerializer(read_only=True)
    requester = UserRefSerializer(read_only=True)
    lines_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = PurchaseRequest
        fields = ["id", "code", "status", "project", "requester", "needed_by", "lines_count", "created_at"]


class ApprovalSerializer(serializers.ModelSerializer):
    user = UserRefSerializer(read_only=True)

    class Meta:
        model = RequestApproval
        fields = ["id", "step_id", "step_name", "decision", "user", "comment", "created_at"]


class RequestSerializer(RequestListSerializer):
    project_id = serializers.PrimaryKeyRelatedField(source="project", queryset=Project.objects.all())
    lines = RequestLineSerializer(many=True, required=False)
    approved_by = UserRefSerializer(read_only=True)
    allowed_statuses = serializers.ListField(child=serializers.CharField(), read_only=True)
    project_status = serializers.CharField(source="project.status", read_only=True)
    approval_step = serializers.SerializerMethodField()
    approvals = ApprovalSerializer(many=True, read_only=True)
    steps = serializers.SerializerMethodField()
    can_approve = serializers.SerializerMethodField()

    class Meta(RequestListSerializer.Meta):
        fields = [*RequestListSerializer.Meta.fields, "project_id", "project_status", "notes", "lines",
                  "submitted_at", "approved_at", "approved_by", "approval_step", "approvals", "steps",
                  "can_approve", "allowed_statuses", "updated_at"]

    def get_approval_step(self, obj) -> dict | None:
        s = obj.approval_step
        return {"id": s.pk, "name": s.name, "role": s.role.name} if s else None

    def get_steps(self, obj) -> list[dict]:
        """All active steps with their state for this request's latest round: done / current / pending
        (rejected for the step that turned it down)."""
        since = obj.submitted_at
        decided = {}
        if since is not None:
            for a in obj.approvals.all():
                if a.step_id and a.created_at >= since:
                    decided[a.step_id] = a.decision
        out = []
        for s in services.active_steps():
            if obj.approval_step_id == s.pk:
                state = "current"
            elif decided.get(s.pk) == Decision.REJECTED:
                state = "rejected"
            elif decided.get(s.pk) == Decision.APPROVED:
                state = "done"
            else:
                state = "pending"
            out.append({"id": s.pk, "name": s.name, "role": s.role.name, "state": state})
        return out

    def get_can_approve(self, obj) -> bool:
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if obj.status != RequestStatus.SUBMITTED or user is None:
            return False
        if not has_permission(user, Pages.PURCHASE_APPROVE, Action.UPDATE):
            return False
        return obj.approval_step is None or services.can_decide_step(user, obj.approval_step)


class FromCalcSerializer(serializers.Serializer):
    calc_id = serializers.PrimaryKeyRelatedField(source="calc", queryset=ProjectCalc.objects.all())


class FromProjectSerializer(serializers.Serializer):
    project_id = serializers.PrimaryKeyRelatedField(source="project", queryset=Project.objects.all())


class ApprovalStepSerializer(serializers.ModelSerializer):
    role_id = serializers.PrimaryKeyRelatedField(source="role", queryset=Role.objects.all())
    role = RefSerializer(read_only=True)

    class Meta:
        model = ApprovalStep
        fields = ["id", "sequence", "name", "role_id", "role", "is_active", "updated_at"]


class RequestMoneySerializer(serializers.Serializer):
    amount = serializers.DecimalField(max_digits=18, decimal_places=2, min_value=Decimal("0.01"),
                                      required=False, allow_null=True)
    note = serializers.CharField(required=False, allow_blank=True, default="", max_length=1000)


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
    product_id = product_field()
    product = ProductRefSerializer(read_only=True)

    class Meta:
        model = PurchaseOrderLine
        fields = ["id", "request_line_id", "request_code", "project", "item_id", "product_id", "product",
                  "name", "unit", "qty",
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
    payment_request = serializers.SerializerMethodField()

    class Meta(OrderListSerializer.Meta):
        fields = [*OrderListSerializer.Meta.fields, "supplier_id", "supplier_email", "supplier_balance",
                  "project_id", "notes", "lines", "sent_by", "sent_to", "receipts", "payment_request",
                  "allowed_statuses", "updated_at"]

    def get_payment_request(self, obj) -> dict | None:
        state = services.money_state(obj)
        if state is None:
            return None
        return {**state, "amount": str(state["amount"]), "paid": str(state["paid"])}

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
    product_id = product_field()
    product = ProductRefSerializer(read_only=True)
    new_category = serializers.ChoiceField(choices=Category.choices, required=False, allow_blank=True)
    match = serializers.SerializerMethodField()

    class Meta:
        model = GoodsReceiptLine
        fields = ["id", "order_line_id", "name", "unit", "project", "ordered_qty", "order_received_qty",
                  "qty", "price", "vat_rate", "net", "vat", "gross", "product_id", "product", "new_category",
                  "match"]
        extra_kwargs = {"qty": {"min_value": Decimal("0.01")}}

    def get_match(self, obj) -> dict:
        """The product posting will use: chosen here, else the order line's, else found, else a new one."""
        from apps.inventory import services as inv

        ol = obj.order_line
        if obj.product_id:
            source, p = "receipt", obj.product
        elif ol.product_id:
            source, p = "order", ol.product
        else:
            source, p = "found", inv.product_match(item=ol.item, name=ol.name, unit=ol.unit)
        if p is None:
            category = obj.new_category or inv.guess_category(ol.name)
            return {"source": "new", "product": None, "category": category}
        return {"source": source, "product": ProductRefSerializer(p).data, "category": p.category}


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
    entry_id = serializers.IntegerField(read_only=True)
    entry_code = serializers.CharField(source="entry.code", read_only=True, default=None)
    allowed_statuses = serializers.ListField(child=serializers.CharField(), read_only=True)
    warehouse = RefSerializer(read_only=True)
    warehouse_id = serializers.PrimaryKeyRelatedField(source="warehouse", queryset=Warehouse.objects.all(),
                                                      required=False, allow_null=True)
    stock_moves = serializers.SerializerMethodField()

    class Meta(ReceiptListSerializer.Meta):
        fields = [*ReceiptListSerializer.Meta.fields, "order_id", "project", "rate", "invoice_date",
                  "invoice_total", "warehouse", "warehouse_id", "stock_moves",
                  "notes", "lines", "posted_at", "posted_by", "entry_id", "entry_code", "allowed_statuses",
                  "updated_at"]


    def get_stock_moves(self, obj) -> int:
        """Posted kirim rows this receipt put into the warehouse (add-inventory)."""
        return StockMove.objects.filter(source_model="procurement.goodsreceipt", source_id=obj.pk,
                                        status=MoveStatus.POSTED).count()


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

from decimal import Decimal

from rest_framework import serializers

from apps.accounting.models import Account, Invoice
from apps.accounting.serializers import AccountRefSerializer
from apps.clients.models import Client
from apps.core.serializers import RefSerializer
from apps.employees.models import Employee
from apps.kassa import selectors
from apps.kassa.models import AccountKind, CashAccount, CashOrder, OrderKind, PaymentPurpose
from apps.projects.models import Currency, Project

# ------------------------------------------------------------------ accounts


class CashAccountRefSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    name = serializers.CharField(read_only=True)
    kind = serializers.CharField(read_only=True)
    currency = serializers.CharField(read_only=True)
    responsible = RefSerializer(read_only=True)  # the kassir, printed on PKO / RKO


class CashAccountSerializer(serializers.ModelSerializer):
    kind = serializers.ChoiceField(choices=AccountKind.choices, required=False)
    currency = serializers.ChoiceField(choices=Currency.choices, required=False)
    account = AccountRefSerializer(read_only=True)
    account_id = serializers.PrimaryKeyRelatedField(source="account", queryset=Account.objects.filter(is_active=True),
                                                    required=False, allow_null=True)
    responsible = RefSerializer(read_only=True)
    responsible_id = serializers.PrimaryKeyRelatedField(source="responsible", queryset=Employee.objects.all(),
                                                        required=False, allow_null=True)
    balance = serializers.SerializerMethodField()
    balance_uzs = serializers.SerializerMethodField()
    has_orders = serializers.BooleanField(read_only=True)

    class Meta:
        model = CashAccount
        fields = ["id", "name", "kind", "currency", "account", "account_id", "bank_name", "mfo", "account_number",
                  "responsible", "responsible_id", "cash_limit", "is_active", "balance", "balance_uzs", "has_orders",
                  "updated_at"]

    def _pair(self, obj):
        cache = self.context.setdefault("_balances", {})
        if obj.pk not in cache:
            cache[obj.pk] = selectors.account_balance_pair(obj)
        return cache[obj.pk]

    def get_balance(self, obj) -> str:
        return str(self._pair(obj)[0])

    def get_balance_uzs(self, obj) -> str:
        return str(self._pair(obj)[1])


class PurposeSerializer(serializers.ModelSerializer):
    class Meta:
        model = PaymentPurpose
        fields = ["id", "name", "direction", "posting", "account_role", "requires_partner", "requires_employee",
                  "is_active", "sort_order"]


# ------------------------------------------------------------------ orders


class PurposeRefSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    name = serializers.CharField(read_only=True)
    posting = serializers.CharField(read_only=True)


class InvoiceRefSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    code = serializers.CharField(read_only=True)
    gross = serializers.DecimalField(max_digits=18, decimal_places=2, read_only=True)
    currency = serializers.CharField(read_only=True)


class CashOrderListSerializer(serializers.ModelSerializer):
    account = CashAccountRefSerializer(read_only=True)
    to_account = CashAccountRefSerializer(read_only=True)
    purpose = PurposeRefSerializer(read_only=True)
    partner = RefSerializer(read_only=True)
    project = RefSerializer(read_only=True)
    employee = RefSerializer(read_only=True)
    amount_uzs = serializers.DecimalField(max_digits=18, decimal_places=2, read_only=True)
    entry_code = serializers.CharField(source="entry.code", read_only=True, default=None)

    class Meta:
        model = CashOrder
        fields = ["id", "code", "kind", "status", "date", "account", "to_account", "amount", "currency", "rate",
                  "amount_uzs", "purpose", "partner", "project", "employee", "basis", "entry_code", "created_at"]


class CashOrderSerializer(CashOrderListSerializer):
    kind = serializers.ChoiceField(choices=OrderKind.choices)
    date = serializers.DateField(required=False)
    account_id = serializers.PrimaryKeyRelatedField(source="account", queryset=CashAccount.objects.all())
    to_account_id = serializers.PrimaryKeyRelatedField(source="to_account", queryset=CashAccount.objects.all(),
                                                       required=False, allow_null=True)
    purpose_id = serializers.PrimaryKeyRelatedField(source="purpose", queryset=PaymentPurpose.objects.all(),
                                                    required=False, allow_null=True)
    partner_id = serializers.PrimaryKeyRelatedField(source="partner", queryset=Client.objects.all(),
                                                    required=False, allow_null=True)
    project_id = serializers.PrimaryKeyRelatedField(source="project", queryset=Project.objects.all(),
                                                    required=False, allow_null=True)
    employee_id = serializers.PrimaryKeyRelatedField(source="employee", queryset=Employee.objects.all(),
                                                     required=False, allow_null=True)
    invoice_id = serializers.PrimaryKeyRelatedField(source="invoice", queryset=Invoice.objects.all(),
                                                    required=False, allow_null=True)
    invoice = InvoiceRefSerializer(read_only=True)
    rate = serializers.DecimalField(max_digits=14, decimal_places=4, required=False, allow_null=True,
                                    min_value=Decimal("0.0001"))
    account_role = serializers.CharField(required=False, allow_blank=True, max_length=40)
    entry_id = serializers.IntegerField(read_only=True)
    posted_by = serializers.CharField(source="posted_by.full_name", read_only=True, default="")
    created_by = serializers.CharField(source="created_by.full_name", read_only=True, default="")
    allowed_statuses = serializers.ListField(child=serializers.CharField(), read_only=True)

    class Meta(CashOrderListSerializer.Meta):
        fields = [*CashOrderListSerializer.Meta.fields, "account_id", "to_account_id", "purpose_id", "account_role",
                  "partner_id", "project_id", "employee_id", "invoice_id", "invoice", "received_from", "issued_to",
                  "notes", "entry_id", "posted_at", "posted_by", "created_by", "allowed_statuses", "updated_at"]
        read_only_fields = ["status", "currency"]
        extra_kwargs = {"amount": {"min_value": Decimal("0.01")}}


class CancelSerializer(serializers.Serializer):
    comment = serializers.CharField(required=False, allow_blank=True, default="", max_length=1000)
    date = serializers.DateField(required=False, allow_null=True)


class BookQuerySerializer(serializers.Serializer):
    account = serializers.PrimaryKeyRelatedField(queryset=CashAccount.objects.all())
    date = serializers.DateField()

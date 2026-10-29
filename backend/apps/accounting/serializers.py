from decimal import Decimal

from rest_framework import serializers

from apps.accounting.models import (
    Account,
    AccountRole,
    ExchangeRate,
    Invoice,
    InvoiceKind,
    InvoiceLine,
    JournalEntry,
    JournalLine,
)
from apps.clients.models import Client
from apps.core.serializers import RefSerializer
from apps.projects.models import Currency, Project


class AccountRefSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    code = serializers.CharField(read_only=True)
    name = serializers.CharField(read_only=True)


# ------------------------------------------------------------------ chart, roles, rates


class AccountSerializer(serializers.ModelSerializer):
    parent_id = serializers.PrimaryKeyRelatedField(source="parent", queryset=Account.objects.all(),
                                                   allow_null=True, required=False)
    has_lines = serializers.BooleanField(read_only=True)
    roles = serializers.SlugRelatedField(slug_field="key", many=True, read_only=True)

    class Meta:
        model = Account
        fields = ["id", "code", "name", "kind", "parent_id", "is_active", "allow_posting", "has_lines", "roles",
                  "updated_at"]


class RoleSerializer(serializers.ModelSerializer):
    account = AccountRefSerializer(read_only=True)
    account_id = serializers.PrimaryKeyRelatedField(source="account", queryset=Account.objects.filter(is_active=True))

    class Meta:
        model = AccountRole
        fields = ["id", "key", "label", "account", "account_id"]
        read_only_fields = ["key", "label"]


class RateSerializer(serializers.ModelSerializer):
    currency = serializers.ChoiceField(choices=[c for c in Currency.choices if c[0] != Currency.UZS])

    class Meta:
        model = ExchangeRate
        fields = ["id", "date", "currency", "rate", "source", "updated_at"]
        read_only_fields = ["source", "updated_at"]
        extra_kwargs = {"rate": {"min_value": Decimal("0.0001")}}
        validators = []  # posting the same day again updates the rate (services.rate_set), not a 400


# ------------------------------------------------------------------ journal


class LineSerializer(serializers.ModelSerializer):
    account = AccountRefSerializer(read_only=True)
    partner = RefSerializer(read_only=True)
    project = RefSerializer(read_only=True)

    class Meta:
        model = JournalLine
        fields = ["id", "account", "debit", "credit", "partner", "project", "currency", "amount_cur", "rate", "memo"]


class EntryListSerializer(serializers.ModelSerializer):
    source_label = serializers.CharField(read_only=True)
    reversed_by_code = serializers.CharField(source="reversed_by.code", read_only=True, default=None)
    posted_by = serializers.CharField(source="posted_by.full_name", read_only=True, default="")

    class Meta:
        model = JournalEntry
        fields = ["id", "code", "date", "memo", "source_model", "source_id", "source_label", "source_kind", "status",
                  "reversed_by_code", "total_debit", "posted_by", "posted_at"]


class EntrySerializer(EntryListSerializer):
    lines = LineSerializer(many=True, read_only=True)
    reversal_of_code = serializers.CharField(source="reversal_of.code", read_only=True, default=None)

    class Meta(EntryListSerializer.Meta):
        fields = [*EntryListSerializer.Meta.fields, "reversal_of_code", "total_credit", "lines"]


class LineInputSerializer(serializers.Serializer):
    account_id = serializers.PrimaryKeyRelatedField(source="account", queryset=Account.objects.filter(is_active=True))
    debit = serializers.DecimalField(max_digits=18, decimal_places=2, required=False, default=0, min_value=0)
    credit = serializers.DecimalField(max_digits=18, decimal_places=2, required=False, default=0, min_value=0)
    partner_id = serializers.PrimaryKeyRelatedField(source="partner", queryset=Client.objects.all(),
                                                    allow_null=True, required=False)
    project_id = serializers.PrimaryKeyRelatedField(source="project", queryset=Project.objects.all(),
                                                    allow_null=True, required=False)
    currency = serializers.ChoiceField(choices=Currency.choices, required=False, default=Currency.UZS)
    amount_cur = serializers.DecimalField(max_digits=18, decimal_places=2, required=False, allow_null=True)
    rate = serializers.DecimalField(max_digits=14, decimal_places=4, required=False, allow_null=True)
    memo = serializers.CharField(required=False, allow_blank=True, default="", max_length=300)


class ManualEntrySerializer(serializers.Serializer):
    date = serializers.DateField()
    memo = serializers.CharField(max_length=300)
    lines = LineInputSerializer(many=True)


class ReverseSerializer(serializers.Serializer):
    date = serializers.DateField(required=False, allow_null=True)
    memo = serializers.CharField(required=False, allow_blank=True, default="", max_length=300)


# ------------------------------------------------------------------ invoices


class InvoiceLineSerializer(serializers.ModelSerializer):
    net = serializers.DecimalField(max_digits=18, decimal_places=2, read_only=True)
    vat = serializers.DecimalField(max_digits=18, decimal_places=2, read_only=True)
    gross = serializers.DecimalField(max_digits=18, decimal_places=2, read_only=True)
    vat_rate = serializers.DecimalField(max_digits=5, decimal_places=2, required=False, allow_null=True, min_value=0)
    role = serializers.CharField(required=False, allow_blank=True, default="", max_length=40)

    class Meta:
        model = InvoiceLine
        fields = ["id", "name", "unit", "qty", "price", "vat_rate", "role", "net", "vat", "gross"]
        extra_kwargs = {"unit": {"required": False}}


class InvoiceListSerializer(serializers.ModelSerializer):
    partner = RefSerializer(read_only=True)
    project = RefSerializer(read_only=True)
    entry_code = serializers.CharField(source="entry.code", read_only=True, default=None)

    class Meta:
        model = Invoice
        fields = ["id", "code", "kind", "status", "partner", "project", "date", "external_number", "external_date",
                  "currency", "rate", "net", "vat", "gross", "entry_code", "created_at"]


class InvoiceSerializer(InvoiceListSerializer):
    partner_id = serializers.PrimaryKeyRelatedField(source="partner", queryset=Client.objects.all())
    project_id = serializers.PrimaryKeyRelatedField(source="project", queryset=Project.objects.all(),
                                                    allow_null=True, required=False)
    kind = serializers.ChoiceField(choices=InvoiceKind.choices)
    date = serializers.DateField(required=False)
    lines = InvoiceLineSerializer(many=True, required=False)
    entry_id = serializers.IntegerField(read_only=True)

    class Meta(InvoiceListSerializer.Meta):
        fields = [*InvoiceListSerializer.Meta.fields, "partner_id", "project_id", "notes", "lines", "entry_id",
                  "updated_at"]
        read_only_fields = ["status"]


class CancelSerializer(serializers.Serializer):
    date = serializers.DateField(required=False, allow_null=True)


# ------------------------------------------------------------------ reports (query params)
# the URL says ?from=&to= ; views.report_query() renames them to date_from / date_to before validation


class PeriodQuerySerializer(serializers.Serializer):
    date_from = serializers.DateField(required=False, allow_null=True, default=None)
    date_to = serializers.DateField(required=False, allow_null=True, default=None)


class AccountCardQuerySerializer(PeriodQuerySerializer):
    account = serializers.PrimaryKeyRelatedField(queryset=Account.objects.all())
    partner = serializers.PrimaryKeyRelatedField(queryset=Client.objects.all(), required=False, allow_null=True,
                                                 default=None)
    project = serializers.PrimaryKeyRelatedField(queryset=Project.objects.all(), required=False, allow_null=True,
                                                 default=None)


class ReconciliationQuerySerializer(PeriodQuerySerializer):
    partner = serializers.PrimaryKeyRelatedField(queryset=Client.objects.all())

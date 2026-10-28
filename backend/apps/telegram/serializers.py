from rest_framework import serializers

from apps.clients.models import Client
from apps.core.serializers import RefSerializer
from apps.telegram import client as tg
from apps.telegram.models import Account, Chat


class AccountSerializer(serializers.ModelSerializer):
    owner = serializers.SerializerMethodField()
    own_api = serializers.SerializerMethodField()
    chats = serializers.SerializerMethodField()
    live = serializers.SerializerMethodField()
    connected = serializers.BooleanField(read_only=True)

    class Meta:
        model = Account
        fields = ["id", "owner", "name", "phone", "status", "error", "connected", "tg_name", "tg_username",
                  "auto_clients", "crm_leads", "active", "last_sync", "own_api", "api_id", "chats", "live"]

    def get_owner(self, obj) -> dict:
        return {"id": obj.owner_id, "full_name": obj.owner.full_name}

    def get_own_api(self, obj) -> bool:
        return bool(obj.api_id and obj.api_hash)

    def get_chats(self, obj) -> int:
        return obj.chats.filter(active=True).count()

    def get_live(self, obj) -> bool:
        return tg.listener_alive(obj.pk)


class AccountWriteSerializer(serializers.Serializer):
    phone = serializers.CharField(max_length=32, required=False)
    name = serializers.CharField(max_length=100, required=False, allow_blank=True)
    api_id = serializers.IntegerField(required=False, allow_null=True, min_value=1)
    api_hash = serializers.CharField(max_length=64, required=False, allow_blank=True, write_only=True)
    auto_clients = serializers.BooleanField(required=False)
    crm_leads = serializers.BooleanField(required=False)
    active = serializers.BooleanField(required=False)


class SignInSerializer(serializers.Serializer):
    code = serializers.CharField(max_length=10, required=False, allow_blank=True, default="")
    password = serializers.CharField(max_length=200, required=False, allow_blank=True, default="")


class ChatSerializer(serializers.ModelSerializer):
    client = RefSerializer(read_only=True)
    lead = serializers.SerializerMethodField()
    photo = serializers.SerializerMethodField()
    account_id = serializers.IntegerField(read_only=True)

    class Meta:
        model = Chat
        fields = ["id", "account_id", "chat_id", "kind", "name", "username", "phone", "client", "lead", "unread",
                  "last_read_out", "last_at", "last_out", "photo", "active"]

    def get_lead(self, obj) -> dict | None:
        ld = obj.lead
        return {"id": ld.pk, "code": ld.code, "name": ld.title} if ld else None

    def get_photo(self, obj) -> int | None:
        """A cache key for /chats/{id}/photo/ (the bytes are fetched separately)."""
        return int(obj.photo_at.timestamp()) if obj.photo_at else None


class ChatClientSerializer(serializers.Serializer):
    client_id = serializers.PrimaryKeyRelatedField(source="client", queryset=Client.objects.all(), allow_null=True,
                                                   required=False)
    new = serializers.BooleanField(required=False, default=False)


class TextSerializer(serializers.Serializer):
    text = serializers.CharField(max_length=4096, allow_blank=True)


class FileSerializer(serializers.Serializer):
    file = serializers.FileField()
    caption = serializers.CharField(max_length=1024, required=False, allow_blank=True, default="")

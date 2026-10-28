from django.db import transaction

from apps.clients.models import Client
from apps.core.exceptions import Conflict
from apps.core.models import assign_code


def _check_tin(tin: str, exclude_id: int | None = None) -> None:
    if not tin:
        return
    qs = Client.objects.filter(tin=tin)
    if exclude_id:
        qs = qs.exclude(pk=exclude_id)
    if qs.exists():
        raise Conflict("Bu STIR bilan mijoz mavjud", field="tin")


@transaction.atomic
def client_create(*, actor, **fields) -> Client:
    _check_tin(fields.get("tin", ""))
    client = Client(**fields)
    client.stamp(actor, created=True)
    client.save()
    assign_code(client, "MJ")
    return client


@transaction.atomic
def client_update(client: Client, *, actor, **fields) -> Client:
    if "tin" in fields:
        _check_tin(fields["tin"], exclude_id=client.pk)
    for key, value in fields.items():
        setattr(client, key, value)
    client.stamp(actor)
    client.save()
    return client


def client_delete(client: Client, *, actor) -> None:
    if client.projects.filter(deleted_at__isnull=True).exists():
        raise Conflict("Mijozda loyihalar bor — o'chirish o'rniga nofaol qiling")
    client.soft_delete()

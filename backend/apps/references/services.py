from django.db import IntegrityError, transaction
from django.db.models import ProtectedError

from apps.core.exceptions import Conflict
from apps.references.models import RefItem


def _save(item: RefItem) -> RefItem:
    try:
        with transaction.atomic():
            item.save()
    except IntegrityError as e:
        raise Conflict("Bu ro'yxatda shunday nom bor", field="name") from e
    return item


def refitem_create(*, actor, **fields) -> RefItem:
    item = RefItem(**fields)
    item.stamp(actor, created=True)
    return _save(item)


def refitem_update(item: RefItem, *, actor, **fields) -> RefItem:
    fields.pop("kind", None)  # an item never moves to another list
    for key, value in fields.items():
        setattr(item, key, value)
    item.stamp(actor)
    return _save(item)


def refitem_delete(item: RefItem, *, actor) -> None:
    try:
        item.delete()
    except ProtectedError as e:
        raise Conflict("Bu qiymat yozuvlarda ishlatilgan — o'chirish o'rniga nofaol qiling") from e

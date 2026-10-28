from django.db import IntegrityError, transaction

from apps.chatter.services import event
from apps.core.exceptions import Conflict
from apps.pricing.models import PriceList, PriceListItem


def _save(pl: PriceList) -> None:
    try:
        with transaction.atomic():
            pl.save()
    except IntegrityError as e:
        raise Conflict("Bunday nomli narx ro'yxati bor", field="name") from e


def _sync_items(pl: PriceList, items: list[dict], *, actor) -> None:
    """Upsert by id: rows with an id are updated, new rows created, missing rows deleted.
    Calculation lines keep their own copy of name/unit/price, so this never re-prices an existing order."""
    keep, changed = [], 0
    for i, row in enumerate(items):
        row = {**row, "sort_order": (i + 1) * 10}
        item_id = row.pop("id", None)
        obj = pl.items.filter(pk=item_id).first() if item_id else None
        if obj:
            if any(getattr(obj, k) != v for k, v in row.items()):
                for k, v in row.items():
                    setattr(obj, k, v)
                obj.save()
                changed += 1
        else:
            obj = PriceListItem.objects.create(price_list=pl, **row)
            changed += 1
        keep.append(obj.pk)
    removed = pl.items.exclude(pk__in=keep)
    n_removed = removed.count()
    removed.delete()
    if changed or n_removed:
        event(pl, f"Narxlar yangilandi: {changed} qator o'zgardi" + (f", {n_removed} ta o'chirildi" if n_removed else ""),
              actor=actor)


@transaction.atomic
def pricelist_create(*, actor, items: list[dict] | None = None, **fields) -> PriceList:
    pl = PriceList(**fields)
    pl.stamp(actor, created=True)
    _save(pl)
    for i, row in enumerate(items or []):
        row = {k: v for k, v in row.items() if k != "id"}
        PriceListItem.objects.create(price_list=pl, sort_order=(i + 1) * 10, **row)
    return pl


@transaction.atomic
def pricelist_update(pl: PriceList, *, actor, items: list[dict] | None = None, **fields) -> PriceList:
    for k, v in fields.items():
        setattr(pl, k, v)
    pl.stamp(actor)
    _save(pl)
    if items is not None:
        _sync_items(pl, items, actor=actor)
    return pl


def pricelist_delete(pl: PriceList, *, actor) -> None:
    pl.delete()  # calculations keep their own copies; their link is SET_NULL

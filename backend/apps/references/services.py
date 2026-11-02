from decimal import Decimal

from django.db import IntegrityError, transaction
from django.db.models import ProtectedError

from apps.core.exceptions import Conflict, ValidationFailed
from apps.references.models import RefItem, Uom, UomCategory, norm_unit


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


# ------------------------------------------------------------------ units of measure (add-units-of-measure)


def uom_resolve(text: str) -> Uom | None:
    """The unit a piece of text means: by name or alias, ignoring case, dots and spaces ("Шт." → dona).
    Inactive units resolve too: stock already counted in them still converts."""
    key = norm_unit(text)
    if not key:
        return None
    for u in Uom.objects.all():
        if key in u.spellings():
            return u
    return None


def uom_require(text: str, *, field: str = "unit", keep: str = "") -> Uom:
    """`text` as a unit to choose. An inactive unit is refused for a new choice but stays valid where it is
    already used (`keep`: the value the record has now)."""
    u = uom_resolve(text)
    if u is None:
        known = ", ".join(Uom.objects.filter(is_active=True).values_list("name", flat=True))
        raise ValidationFailed(f"«{text}» o'lchov birligi noma'lum. Bor birliklar: {known}. Yangisini "
                               f"Sozlamalar → O'lchov birliklari'da qo'shing", field=field)
    if not u.is_active and u.name != keep:
        raise ValidationFailed(f"«{u.name}» nofaol — boshqa birlikni tanlang yoki uni Sozlamalar → O'lchov "
                               f"birliklari'da faollashtiring", field=field)
    return u


def uom_ratio(src: Uom, dst: Uom) -> Decimal | None:
    """How many `dst` are in one `src`, or None when they don't convert (different category, or "other")."""
    if src.pk == dst.pk:
        return Decimal(1)
    if src.category != dst.category or src.category == UomCategory.OTHER:
        return None
    return src.ratio / dst.ratio


def _clean_uom(fields: dict, u: Uom | None = None) -> dict:
    if "aliases" in fields:  # one spelling per comma, no empties: "шт,  ta," → "шт, ta"
        fields["aliases"] = ", ".join(a.strip() for a in fields["aliases"].split(",") if a.strip())
    if fields.get("category") == UomCategory.OTHER:
        fields["ratio"] = Decimal(1)
    probe = Uom(name=fields.get("name", u.name if u else ""), aliases=fields.get("aliases", u.aliases if u else ""))
    for other in Uom.objects.exclude(pk=u.pk if u else None):
        clash = probe.spellings() & other.spellings()
        if clash:
            raise Conflict(f"«{sorted(clash)[0]}» allaqachon «{other.name}» birligida bor", field="aliases")
    return fields


def _uom_in_use(u: Uom) -> bool:
    from apps.inventory.models import Product  # inventory sits above references; asked lazily

    return Product.all_objects.filter(unit=u.name).exists() or Product.all_objects.filter(
        purchase_unit=u.name).exists()


@transaction.atomic
def uom_create(*, actor, **fields) -> Uom:
    u = Uom(**_clean_uom(fields))
    u.stamp(actor, created=True)
    try:
        with transaction.atomic():
            u.save()
    except IntegrityError as e:
        raise Conflict("Bunday birlik bor", field="name") from e
    return u


@transaction.atomic
def uom_update(u: Uom, *, actor, **fields) -> Uom:
    changes_meaning = any(k in fields and fields[k] != getattr(u, k) for k in ("name", "category", "ratio"))
    if changes_meaning and _uom_in_use(u):
        raise Conflict(f"«{u.name}» mahsulotlarda ishlatilgan — nomi, turkumi va nisbati o'zgarmaydi. "
                       f"Boshqa yozilishini «Boshqa yozilishi»ga qo'shing", field="name")
    for k, v in _clean_uom(fields, u).items():
        setattr(u, k, v)
    u.stamp(actor)
    u.save()
    return u


def uom_delete(u: Uom, *, actor) -> None:
    if _uom_in_use(u):
        raise Conflict(f"«{u.name}» mahsulotlarda ishlatilgan — o'chirish o'rniga nofaol qiling")
    u.delete()

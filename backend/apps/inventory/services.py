"""All writes of the inventory (add-inventory, ADR 0010). Every function takes `actor`.

Public contract — procurement imports these; keep names and keyword-only signatures:

    product_match(*, item=None, name, unit) -> Product | None
        The existing product a purchase line means: by price-list item, else by name + unit
        (case-insensitive).
    product_for(*, actor, item=None, name, unit, category=None) -> Product
        product_match, else a new product (`category`, else guessed from the name).
    guess_category(name) -> str
    stock_role(product) -> str
        The ledger role holding the product's value: "finished_goods" for `tayyor`, else "materials".
    source_moves_post(*, actor, source, date, warehouse=None, partner=None, rows) -> list[StockMove]
        Posted kirim rows for a document that already wrote its own entry (the KR). Each row is a dict with
        `product`, `qty`, `amount` (UZS), optional `project`, `notes`.
    source_moves_cancel(*, actor, source, comment="") -> None
        Cancels the posted rows of `source`; Conflict when the stock is no longer there.
"""

from __future__ import annotations

import datetime as dt
from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from apps.chatter.services import event
from apps.core.exceptions import Conflict, ValidationFailed
from apps.core.models import assign_code
from apps.inventory import selectors
from apps.inventory.models import (
    MANUAL_TYPES,
    NEEDS_PROJECT,
    ZERO,
    Category,
    MoveStatus,
    MoveType,
    Product,
    StockMove,
    Warehouse,
    q2,
)

T = MoveType
DEFAULT_WAREHOUSE = "Asosiy ombor"


def _ledger():
    """The accounting write/read API (ADR 0007): inventory imports accounting, never the reverse."""
    from apps.accounting import services as acc

    return acc


def _label_of(obj) -> str:
    return f"{obj._meta.app_label}.{obj._meta.model_name}"


def fmt_qty(value) -> str:
    s = f"{Decimal(value).normalize():f}"
    return s.replace(".", ",")


def fmt_money(value) -> str:
    s = f"{q2(value):,.2f}".replace(",", " ").replace(".", ",")
    return s[:-3] if s.endswith(",00") else s


# ------------------------------------------------------------------ warehouses


def default_warehouse() -> Warehouse:
    """The default warehouse; "Asosiy ombor" is created the first time one is needed."""
    w = (
        Warehouse.objects.filter(is_default=True, is_active=True).first()
        or Warehouse.objects.filter(is_active=True).first()
    )
    if w is not None:
        return w
    w, _ = Warehouse.objects.get_or_create(name=DEFAULT_WAREHOUSE, defaults={"is_default": True})
    if not (w.is_active and w.is_default):
        w.is_active = w.is_default = True
        w.save(update_fields=["is_active", "is_default", "updated_at"])
    return w


def _one_default(w: Warehouse) -> None:
    if w.is_default:
        Warehouse.objects.exclude(pk=w.pk).filter(is_default=True).update(is_default=False)


@transaction.atomic
def warehouse_create(*, actor, **fields) -> Warehouse:
    if not Warehouse.objects.exists():
        fields["is_default"] = True
    w = Warehouse(**fields)
    w.stamp(actor, created=True)
    w.save()
    _one_default(w)
    return w


@transaction.atomic
def warehouse_update(w: Warehouse, *, actor, **fields) -> Warehouse:
    if fields.get("is_active") is False and fields.get("is_default", w.is_default):
        raise ValidationFailed(
            "Asosiy omborni nofaol qilib bo'lmaydi — avval boshqasini asosiy qiling", field="is_active"
        )
    if fields.get("is_default") is False and w.is_default:
        raise ValidationFailed("Boshqa omborni asosiy qiling", field="is_default")
    for k, v in fields.items():
        setattr(w, k, v)
    w.stamp(actor)
    w.save()
    _one_default(w)
    return w


def warehouse_delete(w: Warehouse, *, actor) -> None:
    if (
        StockMove.all_objects.filter(warehouse=w).exists()
        or StockMove.all_objects.filter(to_warehouse=w).exists()
    ):
        raise Conflict("Omborda harakatlar bor — o'chirib bo'lmaydi, nofaol qiling")
    if w.is_default:
        raise Conflict("Asosiy omborni o'chirib bo'lmaydi")
    w.delete()


# ------------------------------------------------------------------ products

CATEGORY_WORDS = {
    Category.PROFIL: ("profil", "профил", "shtapik", "impost", "armatur"),
    Category.OYNA: ("oyna", "shisha", "steklo", "стекло", "paket", "пакет"),
    Category.FURNITURA: ("furnitura", "фурнитур", "ruchka", "ручк", "petlya", "петл", "qulf", "zamok"),
}


def guess_category(name: str) -> str:
    low = (name or "").lower()
    for cat, words in CATEGORY_WORDS.items():
        if any(w in low for w in words):
            return cat
    return Category.MATERIAL


@transaction.atomic
def product_create(*, actor, **fields) -> Product:
    p = Product(**fields)
    p.stamp(actor, created=True)
    p.save()
    assign_code(p, "MH")
    return p


@transaction.atomic
def product_update(p: Product, *, actor, **fields) -> Product:
    if (
        "category" in fields
        and fields["category"] != p.category
        and p.moves.filter(status=MoveStatus.POSTED).exists()
    ):
        # the category decides the ledger account holding the value (1010 / 2810)
        raise Conflict(
            "Harakati bor mahsulotning turkumi o'zgarmaydi — hisob (1010 / 2810) unga bog'liq",
            field="category",
        )
    for k, v in fields.items():
        setattr(p, k, v)
    p.stamp(actor)
    p.save()
    return p


def product_delete(p: Product, *, actor) -> None:
    if p.moves.filter(status=MoveStatus.DRAFT).exists():
        raise Conflict("Mahsulotning qoralama harakatlari bor — avval ularni o'chiring")
    qty, _ = selectors.product_totals(p)
    if qty != 0:
        raise Conflict(f"Omborda {fmt_qty(qty)} {p.unit} bor — arxivlab bo'lmaydi")
    p.soft_delete()  # archived: posted rows keep pointing to it


def product_match(*, item=None, name: str, unit: str) -> Product | None:
    """The existing product a purchase line means: by price-list item, else by name + unit."""
    name, unit = (name or "").strip(), (unit or "").strip() or "dona"
    p = None
    if item is not None:
        p = Product.objects.filter(price_item=item).first()
    if p is None:
        p = Product.objects.filter(name__iexact=name, unit__iexact=unit).first()
    return p


def product_for(*, actor, item=None, name: str, unit: str, category: str | None = None) -> Product:
    p = product_match(item=item, name=name, unit=unit)
    if p is None:
        name, unit = (name or "").strip(), (unit or "").strip() or "dona"
        if category not in Category.values:
            category = guess_category(name)
        # no default cost: price-list prices are often in USD; the receipt gives the real cost
        p = product_create(actor=actor, name=name, unit=unit, category=category, price_item=item)
    return p


def stock_role(product: Product) -> str:
    return product.stock_role


# ------------------------------------------------------------------ moves: drafts


def _check_shape(m: StockMove) -> None:
    if m.type not in T.values:
        raise ValidationFailed("Turi noto'g'ri", field="type")
    if m.type == T.ADJUST:
        if not m.qty:
            raise ValidationFailed("Miqdor noldan farq qilsin", field="qty")
    elif m.qty is None or m.qty <= 0:
        raise ValidationFailed("Miqdor noldan katta bo'lsin", field="qty")
    if m.type in NEEDS_PROJECT and m.project_id is None:
        raise ValidationFailed("Loyihani tanlang", field="project")
    if m.type == T.OUTPUT and m.product.category != Category.TAYYOR:
        raise ValidationFailed(
            "Ishlab chiqarishga faqat «Tayyor mahsulot» turkumidagi mahsulot kiradi", field="product"
        )
    if m.type == T.TRANSFER:
        if m.to_warehouse_id is None:
            raise ValidationFailed("Qaysi omborga ko'chirilishini tanlang", field="to_warehouse")
        if m.to_warehouse_id == m.warehouse_id:
            raise ValidationFailed("Boshqa omborni tanlang", field="to_warehouse")
    if m.unit_cost is not None and m.unit_cost < 0:
        raise ValidationFailed("Tannarx manfiy bo'lmaydi", field="unit_cost")


def _normalize(m: StockMove) -> None:
    if m.type != T.TRANSFER:
        m.to_warehouse = None
    if m.type == T.DELIVERY and m.partner_id is None and m.project_id is not None:
        m.partner_id = m.project.client_id
    if not (m.type == T.OUTPUT or (m.type == T.ADJUST and m.qty and m.qty > 0)):
        m.unit_cost = None  # outgoing rows take the average when posted


@transaction.atomic
def move_create(*, actor, **fields) -> StockMove:
    if fields.get("type") not in MANUAL_TYPES:
        raise ValidationFailed("Kirim faqat ta'minot kirimidan (KR) keladi — Ta'minot → Kirim", field="type")
    fields.setdefault("date", timezone.localdate())
    if fields.get("warehouse") is None:
        fields["warehouse"] = default_warehouse()
    m = StockMove(**fields)
    _normalize(m)
    _check_shape(m)
    m.stamp(actor, created=True)
    m.save()
    assign_code(m, "OM")
    return m


@transaction.atomic
def move_update(m: StockMove, *, actor, **fields) -> StockMove:
    if m.status != MoveStatus.DRAFT:
        if set(fields) - {"notes"}:
            raise Conflict("O'tkazilgan harakat o'zgartirilmaydi — bekor qilib yangisini kiriting")
    if "type" in fields and fields["type"] != m.type and fields["type"] not in MANUAL_TYPES:
        raise ValidationFailed("Kirim faqat ta'minot kirimidan (KR) keladi", field="type")
    for k, v in fields.items():
        setattr(m, k, v)
    if m.warehouse_id is None:
        m.warehouse = default_warehouse()
    if m.status == MoveStatus.DRAFT:
        _normalize(m)
        _check_shape(m)
    m.stamp(actor)
    m.save()
    return m


def move_delete(m: StockMove, *, actor) -> None:
    if m.status != MoveStatus.DRAFT:
        raise Conflict("Faqat qoralamani o'chirish mumkin. O'tkazilganini bekor qiling.")
    m.soft_delete()


# ------------------------------------------------------------------ moves: posting


def _not_enough(product: Product, warehouse: Warehouse, have: Decimal) -> Conflict:
    return Conflict(
        f"Omborda yetarli emas: {product.name} — «{warehouse.name}»da {fmt_qty(have)} {product.unit} bor",
        field="qty",
    )


def _outgoing_value(product: Product, qty: Decimal) -> Decimal:
    """Weighted average; taking everything that is left takes all the value (no kopecks left behind)."""
    total_q, total_v = selectors.product_totals(product)
    if total_q <= 0:
        return ZERO
    if qty >= total_q:
        return total_v
    return q2(total_v * qty / total_q)


def _entry_lines(m: StockMove, amount: Decimal) -> list[dict]:
    p = m.product
    role = p.stock_role
    memo = f"{p.name} {fmt_qty(abs(m.qty))} {p.unit}"
    proj = m.project
    if m.type == T.ISSUE:
        return [
            {"role": "wip", "debit": amount, "project": proj, "memo": memo},
            {"role": role, "credit": amount, "project": proj, "memo": memo},
        ]
    if m.type == T.OUTPUT:
        return [
            {"role": "finished_goods", "debit": amount, "project": proj, "memo": memo},
            {"role": "wip", "credit": amount, "project": proj, "memo": memo},
        ]
    if m.type == T.DELIVERY:
        return [
            {"role": "cogs_products", "debit": amount, "project": proj, "partner": m.partner, "memo": memo},
            {"role": role, "credit": amount, "project": proj, "memo": memo},
        ]
    if m.type == T.ADJUST and m.qty > 0:
        return [
            {"role": role, "debit": amount, "project": proj, "memo": memo},
            {"role": "other_op_income", "credit": amount, "project": proj, "memo": f"Ortiqcha: {memo}"},
        ]
    if m.type == T.ADJUST:
        return [
            {"role": "other_op_expense", "debit": amount, "project": proj, "memo": f"Kamomad: {memo}"},
            {"role": role, "credit": amount, "project": proj, "memo": memo},
        ]
    return []  # transfer: same account


@transaction.atomic
def move_post(m: StockMove, *, actor) -> StockMove:
    m = (
        StockMove.objects.select_for_update()
        .select_related("product", "warehouse", "to_warehouse", "project", "partner")
        .get(pk=m.pk)
    )
    if m.status != MoveStatus.DRAFT:
        raise Conflict(f"Harakat allaqachon «{MoveStatus(m.status).label}»")
    _normalize(m)
    _check_shape(m)
    acc = _ledger()
    acc.check_open(m.date)
    product = Product.all_objects.select_for_update().get(pk=m.product_id)  # serialises average-cost reads
    m.product = product
    if not m.warehouse.is_active or (m.to_warehouse is not None and not m.to_warehouse.is_active):
        raise Conflict("Ombor nofaol")
    if m.type == T.ADJUST and m.qty > 0 and not product.is_active:
        raise Conflict("Mahsulot nofaol")

    qty = abs(m.qty)
    outgoing = m.type in (T.ISSUE, T.DELIVERY, T.TRANSFER) or (m.type == T.ADJUST and m.qty < 0)
    if outgoing:
        have = selectors.warehouse_qty(product, m.warehouse)
        if have < qty:
            raise _not_enough(product, m.warehouse, have)
        amount = _outgoing_value(product, qty)
    elif m.type == T.OUTPUT:
        wip = selectors.project_wip(m.project)
        amount = q2(m.unit_cost * qty) if m.unit_cost else wip
        if amount <= 0:
            raise Conflict(
                "Loyihada tugallanmagan ishlab chiqarish (2010) yo'q — avval materiallarni chiqim qiling",
                field="unit_cost",
            )
        if amount > wip:
            raise Conflict(
                f"Loyihaning 2010 qoldig'i {fmt_money(wip)} so'm — undan ko'p kirim qilib bo'lmaydi",
                field="unit_cost",
            )
    else:  # surplus
        cost = m.unit_cost or selectors.average_cost(product) or product.default_cost
        if not cost or cost <= 0:
            raise ValidationFailed("Tannarxni kiriting", field="unit_cost")
        amount = q2(cost * qty)

    m.unit_cost = q2(amount / qty) if qty else ZERO
    m.amount = -amount if (m.type == T.ADJUST and m.qty < 0) else amount
    lines = _entry_lines(m, amount)
    entry = None
    if lines and amount > 0:
        label = MoveType(m.type).label
        entry = acc.entry_post(
            actor=actor, date=m.date, memo=f"{m.code} · {label} · {product.name}", lines=lines, source=m
        )
    m.entry = entry
    m.status = MoveStatus.POSTED
    m.posted_at, m.posted_by = timezone.now(), actor if getattr(actor, "pk", None) else None
    m.stamp(actor)
    m.save()  # tracked: "Holat: Qoralama → O'tkazilgan"
    if entry is not None:
        event(m, f"Jurnalga o'tkazildi: {entry.code} — {fmt_money(amount)} so'm", actor=actor)
    if m.project_id is not None:
        event(
            m.project,
            f"{MoveType(m.type).label} {m.code}: {product.name} {fmt_qty(qty)} {product.unit}"
            f" · {fmt_money(amount)} so'm",
            actor=actor,
        )
    return m


def _cancel_one(m: StockMove, *, actor, comment: str, date: dt.date | None = None) -> None:
    product = Product.all_objects.select_for_update().get(pk=m.product_id)
    qty = abs(m.qty)
    # reversing an incoming row takes the goods back out: they must still be there
    back_from = (
        m.to_warehouse
        if m.type == T.TRANSFER
        else m.warehouse
        if m.type in (T.RECEIPT, T.OUTPUT) or (m.type == T.ADJUST and m.qty > 0)
        else None
    )
    if back_from is not None:
        have = selectors.warehouse_qty(product, back_from)
        if have < qty:
            raise Conflict(
                f"{m.code}: {product.name} ishlatilgan — «{back_from.name}»da {fmt_qty(have)} "
                f"{product.unit} qolgan, {fmt_qty(qty)} kerak",
                field="status",
            )
    if m.entry_id:
        from apps.accounting.models import EntryStatus

        if m.entry.status == EntryStatus.POSTED:
            mirror = _ledger().entry_reverse(
                m.entry, actor=actor, date=date, memo=f"Storno {m.entry.code} · {m.code}"
            )
            event(m, f"O'tkazma storno qilindi: {mirror.code}", actor=actor)
    m.status = MoveStatus.CANCELLED
    m.stamp(actor)
    m.save()
    event(m, f"Bekor qilindi: {comment}", actor=actor)
    if m.project_id is not None:
        event(m.project, f"{MoveType(m.type).label} {m.code} bekor qilindi: {comment}", actor=actor)


@transaction.atomic
def move_cancel(m: StockMove, *, actor, comment: str = "", date: dt.date | None = None) -> StockMove:
    m = (
        StockMove.objects.select_for_update()
        .select_related("product", "warehouse", "to_warehouse", "entry", "project")
        .get(pk=m.pk)
    )
    if m.status == MoveStatus.CANCELLED:
        raise Conflict("Harakat allaqachon bekor qilingan")
    if m.status != MoveStatus.POSTED:
        raise Conflict("Qoralama bekor qilinmaydi — uni o'chiring")
    if m.source_model:
        raise Conflict(
            f"Bu qator {m.source_label or m.source_model} hujjatidan — o'sha hujjatni bekor qiling"
        )
    comment = (comment or "").strip()
    if not comment:
        raise ValidationFailed("Bekor qilish sababini yozing", field="comment")
    _ledger().check_open(date or m.date)
    _cancel_one(m, actor=actor, comment=comment, date=date)
    return m


# ------------------------------------------------------------------ documents of other apps (KR)


@transaction.atomic
def source_moves_post(
    *, actor, source, date, warehouse=None, partner=None, rows: list[dict]
) -> list[StockMove]:
    warehouse = warehouse or default_warehouse()
    if not warehouse.is_active:
        raise Conflict(f"«{warehouse.name}» ombori nofaol", field="warehouse")
    now, who = timezone.now(), actor if getattr(actor, "pk", None) else None
    out = []
    for row in rows:
        qty, amount = Decimal(row["qty"]), q2(row["amount"])
        m = StockMove(
            type=T.RECEIPT,
            status=MoveStatus.POSTED,
            date=date,
            product=row["product"],
            warehouse=warehouse,
            qty=qty,
            unit_cost=q2(amount / qty) if qty else ZERO,
            amount=amount,
            project=row.get("project"),
            partner=partner,
            source_model=_label_of(source),
            source_id=source.pk,
            source_label=str(source),
            notes=row.get("notes", ""),
            posted_at=now,
            posted_by=who,
        )
        m.stamp(actor, created=True)
        m.save()
        assign_code(m, "OM")
        out.append(m)
    return out


@transaction.atomic
def source_moves_cancel(*, actor, source, comment: str = "") -> None:
    moves = (
        StockMove.objects.select_for_update()
        .select_related("product", "warehouse", "to_warehouse", "entry", "project")
        .filter(source_model=_label_of(source), source_id=source.pk, status=MoveStatus.POSTED)
        .order_by("id")
    )
    for m in moves:
        _cancel_one(m, actor=actor, comment=comment or f"{source} bekor qilindi")

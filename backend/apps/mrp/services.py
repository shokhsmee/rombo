"""All writes of MRP (ADR 0012). Other apps are reached only through their services:
projects (calc quantities), procurement (purchase requests), inventory (draft issue moves)."""

from __future__ import annotations

from collections import defaultdict
from decimal import Decimal

from django.db import transaction

from apps.chatter.services import event
from apps.core.exceptions import Conflict, ValidationFailed
from apps.core.models import assign_code
from apps.inventory.models import Category, MoveStatus, MoveType, Product, StockMove
from apps.mrp import selectors
from apps.mrp.models import Bom, BomLine, ItemSpec, ProjectMaterial

ZERO = Decimal("0")
MADE = (Category.TAYYOR, Category.YARIM)
CYCLE = "Tarkib o'zini o'z ichiga oladi"


# ------------------------------------------------------------------ BOM


def _check_product(product: Product) -> None:
    if product.category not in MADE:
        raise ValidationFailed("Tarkib faqat tayyor yoki yarim tayyor mahsulotga yoziladi", field="product")


def _check_lines(product: Product, lines: list[dict]) -> None:
    seen = set()
    for ln in lines:
        comp = ln["component"]
        if comp.pk in seen:
            raise ValidationFailed(f"{comp.name} ikki marta yozilgan — bitta qatorga jamlang", field="lines")
        seen.add(comp.pk)
        if selectors.contains(product.pk, comp.pk):
            raise ValidationFailed(CYCLE, field="lines")


def _write_lines(bom: Bom, lines: list[dict]) -> None:
    bom.lines.all().delete()
    BomLine.objects.bulk_create(
        BomLine(bom=bom, sort_order=i, **{k: v for k, v in ln.items() if k != "id"}) for i, ln in enumerate(lines))


def _activate(bom: Bom) -> None:
    if bom.is_active:
        Bom.objects.filter(product=bom.product, is_active=True).exclude(pk=bom.pk).update(is_active=False)


def bom_in_use(bom: Bom) -> bool:
    """Used by a confirmed Loyiha: one with frozen materials whose items mean this BOM's product."""
    frozen = ProjectMaterial.objects.values("project_id")
    return bom.is_active and ItemSpec.objects.filter(product=bom.product, project_id__in=frozen).exists()


@transaction.atomic
def bom_create(*, actor, lines: list[dict] | None = None, **fields) -> Bom:
    product = fields["product"]
    _check_product(product)
    fields.setdefault("name", product.name)
    fields.setdefault("version", (Bom.all_objects.filter(product=product).order_by("-version")
                                  .values_list("version", flat=True).first() or 0) + 1)
    bom = Bom(**fields)
    bom.stamp(actor, created=True)
    bom.save()
    assign_code(bom, "BM")
    _activate(bom)
    if lines:
        _check_lines(product, lines)
        _write_lines(bom, lines)
    return bom


@transaction.atomic
def bom_update(bom: Bom, *, actor, lines: list[dict] | None = None, **fields) -> Bom:
    """Edits in place, or — when a confirmed Loyiha relies on it — saves the edit as a new version."""
    if "product" in fields and fields["product"].pk != bom.product_id:
        raise ValidationFailed("Tarkibning mahsuloti o'zgarmaydi — yangi tarkib oching", field="product")
    fields.pop("product", None)
    if lines is not None and bom_in_use(bom):
        new = bom_create(actor=actor, product=bom.product, name=fields.get("name", bom.name),
                         notes=fields.get("notes", bom.notes), previous=bom, is_active=True,
                         lines=lines)
        event(bom, f"Tasdiqlangan loyihada ishlatilgani uchun yangi versiya ochildi: {new}", actor=actor)
        return new
    for k, v in fields.items():
        setattr(bom, k, v)
    bom.stamp(actor)
    bom.save()
    _activate(bom)
    if lines is not None:
        _check_lines(bom.product, lines)
        _write_lines(bom, lines)
    return bom


def bom_delete(bom: Bom, *, actor) -> None:
    if bom_in_use(bom):
        raise Conflict("Tasdiqlangan loyihada ishlatilgan — o'chirmang, nofaol qiling")
    bom.soft_delete()


@transaction.atomic
def bomline_create(*, actor, bom: Bom, **fields) -> BomLine:
    """One line (Excel import of BOM lines). Same checks as the lines editor."""
    if bom.lines.filter(component=fields["component"]).exists():
        raise ValidationFailed(f"{fields['component'].name} bu tarkibda bor", field="component")
    if selectors.contains(bom.product_id, fields["component"].pk):
        raise ValidationFailed(CYCLE, field="component")
    fields.setdefault("sort_order", bom.lines.count())
    return BomLine.objects.create(bom=bom, **fields)


def bomline_delete(line: BomLine, *, actor) -> None:
    line.delete()


# ------------------------------------------------------------------ Loyiha items → products


@transaction.atomic
def item_product_set(project, *, actor, position: int, product: Product | None) -> None:
    if selectors.frozen(project):
        raise Conflict("Materiallar tasdiqlanganda muzlatilgan — avval «Qayta hisoblash»")
    items = list(project.items.select_related("product_type").order_by("id"))
    if not 0 <= position < len(items):
        raise ValidationFailed("Bunday buyum yo'q", field="position")
    item = items[position]
    if product is None:
        ItemSpec.objects.filter(project=project, position=position).delete()
        return
    _check_product(product)
    ItemSpec.objects.update_or_create(project=project, position=position,
                                      defaults={"product": product, "product_type": item.product_type})
    event(project, f"Buyum {position + 1} ({item.product_type.name}): {product.name}", actor=actor)


# ------------------------------------------------------------------ freeze (design D4)


@transaction.atomic
def materials_freeze(project, *, actor) -> int:
    """Store the explosion. Re-freezing is allowed until something has been issued for the Loyiha."""
    if selectors.issued_of(project):
        raise Conflict("Loyihaga chiqim qilingan — materiallar endi qayta hisoblanmaydi")
    need = selectors.live_need(project)
    ProjectMaterial.objects.filter(project=project).delete()
    ProjectMaterial.objects.bulk_create(ProjectMaterial(project=project, product_id=pid, qty=q)
                                        for pid, q in need.items())
    if need:
        event(project, f"Materiallar ro'yxati qayd etildi: {len(need)} xil material", actor=actor)
    return len(need)


def on_status(project, old: str, new: str, actor) -> None:
    """projects.extensions listener: freeze on confirm, unfreeze when sent back to draft."""
    if new == "confirmed" and old == "draft" and not selectors.frozen(project):
        materials_freeze(project, actor=actor)
    elif new == "draft" and not selectors.issued_of(project):
        ProjectMaterial.objects.filter(project=project).delete()


# ------------------------------------------------------------------ documents from materials


def _remaining(project) -> dict[int, Decimal]:
    need, issued = selectors.need_of(project), selectors.issued_of(project)
    return {pid: n - issued.get(pid, ZERO) for pid, n in need.items() if n - issued.get(pid, ZERO) > 0}


@transaction.atomic
def fill_calc(project, *, actor, calc) -> dict:
    """"BOM'dan to'ldirish": calc line qty = the material need of the product linked to its price-list item."""
    from apps.projects import services as projects

    if calc.project_id != project.pk:
        raise ValidationFailed("Hisob-kitob boshqa loyihaniki", field="calc_id")
    need = selectors.need_of(project)
    if not need:
        raise Conflict("Materiallar yo'q — buyumlarga mahsulot tanlang (tarkibi bor)")
    by_item = {p.price_item_id: p.pk for p in Product.objects.filter(pk__in=need, price_item__isnull=False)}
    rows, matched = [], set()
    for ln in calc.lines.all():
        pid = by_item.get(ln.item_id)
        if pid is not None:
            rows.append({"id": ln.pk, "qty": need[pid].quantize(Decimal("0.01"))})
            matched.add(pid)
    projects.calc_update(calc, actor=actor, lines=rows)
    missing = [{"id": p.pk, "code": p.code, "name": p.name} for p in Product.objects.filter(pk__in=set(need) - matched)]
    return {"filled": len(rows), "missing": missing}


@transaction.atomic
def to_request(project, *, actor):
    """A purchase request for what is left to issue minus what is already requested for this Loyiha."""
    from apps.procurement import services as procurement

    asked = selectors.requested_of(project)
    rows = []
    for pid, q in _remaining(project).items():
        q = q - asked.get(pid, ZERO)
        if q > 0:
            rows.append((pid, q))
    if not rows:
        raise Conflict("So'raladigan material qolmagan — hammasi so'ralgan yoki chiqim qilingan")
    products = {p.pk: p for p in Product.objects.filter(pk__in=[pid for pid, _ in rows])}
    lines = [{"product": products[pid], "item": products[pid].price_item, "name": products[pid].name,
              "unit": products[pid].unit, "qty": q.quantize(Decimal("0.01"), rounding="ROUND_UP")}
             for pid, q in sorted(rows, key=lambda r: products[r[0]].name)]
    req = procurement.request_create(actor=actor, project=project, lines=lines)
    event(req, f"Loyiha materiallaridan: {len(lines)} qator", actor=actor)
    return req


@transaction.atomic
def to_issue(project, *, actor, warehouse=None) -> list[StockMove]:
    """Draft issue moves for the remaining materials; products that already have a draft issue are skipped."""
    from apps.inventory import services as inventory

    drafts = set(StockMove.objects.filter(project=project, type=MoveType.ISSUE, status=MoveStatus.DRAFT)
                 .values_list("product_id", flat=True))
    out = []
    for pid, q in _remaining(project).items():
        if pid in drafts:
            continue
        out.append(inventory.move_create(actor=actor, type=MoveType.ISSUE, product=Product.objects.get(pk=pid),
                                         qty=q, project=project, warehouse=warehouse,
                                         notes="Loyiha materiallaridan"))
    if not out:
        raise Conflict("Chiqim qilinadigan material qolmagan")
    event(project, f"Chiqim qoralamalari: {len(out)} ta", actor=actor)
    return out


# ------------------------------------------------------------------ MRP → purchase requests (design D6)


@transaction.atomic
def plan_to_requests(*, actor, product_ids: list[int]) -> list:
    """One request per Loyiha for the shortage of the chosen products, earliest deadline first, rounded
    up to the purchase multiple on the first Loyiha that takes the product."""
    from apps.procurement import services as procurement
    from apps.projects.models import Project

    plan = selectors.plan()
    wanted = {int(i) for i in product_ids}
    per_project: dict[int, list] = defaultdict(list)
    for r in plan["rows"]:
        pid = r["product"]["id"]
        if pid not in wanted or Decimal(r["shortage"]) <= 0:
            continue
        extra = Decimal(r["to_buy"]) - Decimal(r["shortage"])  # rounding to the bar goes to the first taker
        for a in r["projects"]:
            q = Decimal(a["short"])
            if q > 0:
                per_project[a["project"]["id"]].append((pid, q + extra))
                extra = ZERO
    if not per_project:
        raise Conflict("Tanlangan mahsulotlarda kamomad yo'q")
    products = {p.pk: p for p in Product.objects.filter(pk__in=wanted)}
    out = []
    for proj_id, rows in per_project.items():
        project = Project.objects.get(pk=proj_id)
        lines = [{"product": products[pid], "item": products[pid].price_item, "name": products[pid].name,
                  "unit": products[pid].unit, "qty": q.quantize(Decimal("0.01"), rounding="ROUND_UP")}
                 for pid, q in rows]
        req = procurement.request_create(actor=actor, project=project, lines=lines, notes="MRP kamomadi")
        event(req, f"MRP: {len(lines)} qator", actor=actor)
        out.append(req)
    return out

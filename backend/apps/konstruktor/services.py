"""Writes and rules of the window constructor (add-window-constructor).

Chain: construction design → engine (pieces, glass, counts) → per price-list item quantity (bars after
cutting for profiles, m / m² / pcs × factor for the rest) → the Loyiha's hisob-kitob (projects.calc_fill).
"""

import math
from collections import defaultdict
from decimal import Decimal

from django.db import IntegrityError, transaction

from apps.chatter.services import event
from apps.core.exceptions import Conflict, ValidationFailed
from apps.core.models import assign_code
from apps.konstruktor import engine
from apps.konstruktor.models import (
    BAR_ROLES,
    LENGTH_ROLES,
    Construction,
    ProfileSystem,
    ProfileSystemItem,
    Role,
    role_unit,
)
from apps.pricing.models import PriceListItem
from apps.projects import services as project_services
from apps.projects.models import EDITABLE_STATUSES, ProjectStatus, round_sum

ZERO = Decimal("0")
PARAM_FIELDS = ("frame_width", "mullion_width", "sash_width", "weld_allowance", "mullion_allowance",
                "sash_overlap", "glass_deduction_fixed", "glass_deduction_sash", "bead_allowance")


# ------------------------------------------------------------------ profile systems


def params_of(system: ProfileSystem) -> engine.Params:
    return engine.Params(**{f: float(getattr(system, f)) for f in PARAM_FIELDS})


def _check_items(system: ProfileSystem, items: list[dict]) -> None:
    seen, bar_roles = set(), set()
    for i, row in enumerate(items):
        it = row["price_list_item"]
        if it.price_list_id != system.price_list_id:
            raise ValidationFailed(f"«{it.name}» boshqa narx ro'yxatidan — «{system.price_list.name}» dan tanlang",
                                   field=f"items.{i}.price_list_item")
        key = (row["role"], it.pk)
        if key in seen:
            raise ValidationFailed(f"«{it.name}» shu vazifaga ikki marta bog'langan", field=f"items.{i}.role")
        seen.add(key)
        if row["role"] in BAR_ROLES:
            if row["role"] in bar_roles:
                raise ValidationFailed(f"«{Role(row['role']).label}» faqat bitta profilga bog'lanadi",
                                       field=f"items.{i}.role")
            bar_roles.add(row["role"])


def _check_glass(system: ProfileSystem) -> None:
    g = system.default_glass
    if g is not None and g.price_list_id != system.price_list_id:
        raise ValidationFailed("Asosiy oyna shu tizimning narx ro'yxatidan bo'lsin", field="default_glass")


def _save_system(system: ProfileSystem) -> None:
    try:
        with transaction.atomic():
            system.save()
    except IntegrityError as e:
        raise Conflict("Bunday nomli profil tizimi bor", field="name") from e


def _sync_items(system: ProfileSystem, items: list[dict], *, actor) -> None:
    before = {(r.role, r.price_list_item_id, r.factor, r.round_up) for r in system.items.all()}
    system.items.all().delete()
    ProfileSystemItem.objects.bulk_create(
        ProfileSystemItem(system=system, sort_order=(i + 1) * 10, role=r["role"], price_list_item=r["price_list_item"],
                          factor=r.get("factor", Decimal("1")), round_up=r.get("round_up", False))
        for i, r in enumerate(items))
    after = {(r.role, r.price_list_item_id, r.factor, r.round_up) for r in system.items.all()}
    if before != after:
        event(system, f"Bog'lanishlar yangilandi: {len(after)} ta", actor=actor)


@transaction.atomic
def system_create(*, actor, items: list[dict] | None = None, **fields) -> ProfileSystem:
    system = ProfileSystem(**fields)
    _check_glass(system)
    system.stamp(actor, created=True)
    _save_system(system)
    if items:
        _check_items(system, items)
        _sync_items(system, items, actor=actor)
    return system


@transaction.atomic
def system_update(system: ProfileSystem, *, actor, items: list[dict] | None = None, **fields) -> ProfileSystem:
    for k, v in fields.items():
        setattr(system, k, v)
    _check_glass(system)
    system.stamp(actor)
    _save_system(system)
    if items is not None:
        _check_items(system, items)
        _sync_items(system, items, actor=actor)
    return system


def system_delete(system: ProfileSystem, *, actor) -> None:
    if system.constructions.filter(deleted_at__isnull=True).exists():
        raise Conflict("Tizim konstruksiyalarda ishlatilgan — o'chirish o'rniga nofaol qiling")
    system.soft_delete()


# ------------------------------------------------------------------ engine + pricing


def evaluate(system: ProfileSystem, design: dict) -> dict:
    """Engine output as stored on a construction. Errors become 400 on `design` with the cell path."""
    try:
        res = engine.calculate(design, params_of(system))
    except engine.EngineError as e:
        raise ValidationFailed(e.message, field=f"design.{e.path}" if e.path else "design") from e
    out = res.as_dict()
    default_glass = system.default_glass_id
    for g in out["glass"]:
        g["item"] = g["item"] or default_glass
    return out


def _q(v) -> Decimal:
    return Decimal(str(v))


def price_lines(entries: list[tuple]) -> dict:
    """entries = [(system, engine result, count[, code])] → what they need, priced from the systems' price lists.

    Profiles of all entries are pooled per price-list item and cut together (design D5). Returns
    {lines: [...], cut: {item_id: plan}, unmapped: [...], totals: {currency: sum}, area_m2, count}."""
    entries = [(*e, "")[:4] for e in entries]
    systems = {e[0].pk: e[0] for e in entries}
    maps = defaultdict(list)  # (system id, role) → [ProfileSystemItem]
    for it in ProfileSystemItem.objects.filter(system_id__in=systems).select_related("price_list_item"):
        maps[(it.system_id, it.role)].append(it)

    qty: dict[int, Decimal] = defaultdict(lambda: ZERO)
    why: dict[int, set] = defaultdict(set)
    pieces: dict[int, list] = defaultdict(list)  # price item → pieces to cut
    bar_of: dict[int, ProfileSystem] = {}
    unmapped: dict[str, dict] = {}
    area, count_total = ZERO, 0

    def miss(key, label, amount, unit):
        row = unmapped.setdefault(key, {"label": label, "qty": ZERO, "unit": unit})
        row["qty"] += amount

    for system, res, count, code in entries:
        count_total += count
        area += _q(res["area_m2"]) * count
        sources = {**res["counts"], **res["lengths_m"], "sash_count": res["counts"]["sash"],
                   "mullion_count": res["counts"]["mullion"]}
        # profiles → pieces per mapped item
        for role in BAR_ROLES:
            role_pieces = [p for p in res["pieces"] if p["role"] == role]
            if not role_pieces:
                continue
            mapped = maps.get((system.pk, role))
            if not mapped:
                miss(f"{system.pk}:{role}", f"{Role(role).label} ({system.name})",
                     _q(sum(p["length"] for p in role_pieces)) / 1000 * count, "m")
                continue
            item = mapped[0].price_list_item
            bar_of[item.pk] = system
            why[item.pk].add(Role(role).label)
            tag = f"{code} · " if code else ""
            for k in range(count):
                n = f" #{k + 1}" if count > 1 else ""
                pieces[item.pk].extend({**p, "label": f"{tag}{p['label']}{n}"} for p in role_pieces)
        # glass per chosen item
        for g in res["glass"]:
            if g["item"]:
                qty[g["item"]] += _q(g["m2"]) * count
                why[g["item"]].add("Oyna")
            else:
                miss(f"{system.pk}:glass", f"Oyna — tanlanmagan ({system.name})", _q(g["m2"]) * count, "m²")
        # everything else: source quantity × factor
        for (sid, role), mapped in maps.items():
            if sid != system.pk or role in BAR_ROLES:
                continue
            base = _q(sources.get(role, 0)) * count
            if not base:
                continue
            for m in mapped:
                q = base * m.factor
                if role in LENGTH_ROLES:
                    q *= 1 + system.junk_pct / 100
                qty[m.price_list_item_id] += q
                why[m.price_list_item_id].add(Role(role).label)

    cut_plans = {}
    for item_id, ps in pieces.items():
        s = bar_of[item_id]
        try:
            plan = engine.cut(ps, bar_length=float(s.bar_length_mm), kerf=float(s.kerf_mm), trim=float(s.trim_mm))
        except engine.CutError as e:
            raise ValidationFailed(e.message, field="design") from e
        cut_plans[item_id] = plan
        qty[item_id] += plan["count"]

    rounding = {m.price_list_item_id: m.round_up for ms in maps.values() for m in ms}
    items = {it.pk: it for it in PriceListItem.objects.filter(pk__in=qty).select_related("price_list")}
    lines, totals = [], defaultdict(lambda: ZERO)
    for item_id, q in qty.items():
        it = items.get(item_id)
        if it is None:
            continue
        if rounding.get(item_id):
            q = Decimal(math.ceil(q - Decimal("0.0001")))
        q = q.quantize(Decimal("0.01"))
        s = round_sum(q, it.price)
        totals[it.price_list.currency] += s
        lines.append({"item_id": it.pk, "name": it.name, "unit": it.unit, "price": str(it.price), "qty": str(q),
                      "sum": str(s), "price_list_id": it.price_list_id, "sort_order": it.sort_order,
                      "from": sorted(why[item_id]), "bars": item_id in cut_plans})
    lines.sort(key=lambda r: (r["price_list_id"], r["sort_order"], r["item_id"]))
    return {
        "lines": lines,
        "cut": {str(k): {**v, "item": items[k].name if k in items else ""} for k, v in cut_plans.items()},
        "unmapped": [{**v, "qty": str(v["qty"].quantize(Decimal("0.01")))} for v in unmapped.values()],
        "totals": {k: str(v) for k, v in totals.items()},
        "area_m2": str(area.quantize(Decimal("0.01"))),
        "count": count_total,
    }


def preview(*, system: ProfileSystem, design: dict, count: int = 1) -> dict:
    res = evaluate(system, design)
    return {"result": res, **price_lines([(system, res, count)])}


# ------------------------------------------------------------------ constructions


def _check_editable(project) -> None:
    if project.status not in EDITABLE_STATUSES:
        raise Conflict(f"Loyiha «{ProjectStatus(project.status).label}» bosqichida — konstruksiyalar qulflangan")


def _size_label(res: dict) -> str:
    cells = len(res["cells"])
    return f"{res['w']:g} × {res['h']:g}" + (f", {cells} katak" if cells > 1 else "")


def _apply(c: Construction) -> None:
    if not c.system.is_active and c._state.adding:
        raise ValidationFailed("Profil tizimi nofaol", field="system")
    c.result = evaluate(c.system, c.design)
    c.area_m2 = _q(c.result["area_m2"])
    c.size_label = _size_label(c.result)
    if c.product_type_id is None:
        c.product_type_id = c.system.product_type_id
    if c.product_type_id is None:
        raise ValidationFailed("Buyurtma turini tanlang", field="product_type")


def sync_items(project, *, actor) -> None:
    """The Loyiha's lines (type · m² · count) follow its constructions (design D6)."""
    groups: dict[int, list] = {}
    for c in project.constructions.filter(deleted_at__isnull=True).select_related("product_type"):
        g = groups.setdefault(c.product_type_id, [c.product_type, ZERO, 0])
        g[1] += c.area_m2 * c.count
        g[2] += c.count
    items = [{"product_type": pt, "area_m2": area.quantize(Decimal("0.01")), "quantity": n}
             for pt, area, n in groups.values()]
    project_services.items_replace(project, actor=actor, items=items)


@transaction.atomic
def construction_create(*, actor, project, **fields) -> Construction:
    _check_editable(project)
    c = Construction(project=project, **fields)
    if not c.sort_order:
        last = project.constructions.order_by("-sort_order").values_list("sort_order", flat=True).first()
        c.sort_order = (last or 0) + 10
    _apply(c)
    c.stamp(actor, created=True)
    c.save()
    assign_code(c, "KS")
    if not c.name:
        c.name = f"Konstruksiya {project.constructions.filter(deleted_at__isnull=True).count()}"
        c.save(update_fields=["name"])
    event(project, f"Konstruksiya qo'shildi: {c.code} {c.size_label} × {c.count}", actor=actor)
    sync_items(project, actor=actor)
    return c


@transaction.atomic
def construction_update(c: Construction, *, actor, **fields) -> Construction:
    _check_editable(c.project)
    fields.pop("project", None)
    for k, v in fields.items():
        setattr(c, k, v)
    _apply(c)
    c.stamp(actor)
    c.save()
    sync_items(c.project, actor=actor)
    return c


@transaction.atomic
def construction_duplicate(c: Construction, *, actor) -> Construction:
    return construction_create(actor=actor, project=c.project, system=c.system, product_type=c.product_type,
                               name=f"{c.name} (nusxa)"[:150], count=c.count, design=c.design, notes=c.notes,
                               sort_order=c.sort_order + 1)


@transaction.atomic
def construction_delete(c: Construction, *, actor) -> None:
    _check_editable(c.project)
    c.soft_delete()
    event(c.project, f"Konstruksiya o'chirildi: {c.code}", actor=actor)
    sync_items(c.project, actor=actor)


# ------------------------------------------------------------------ the Loyiha as a whole


def project_entries(project) -> list[tuple[ProfileSystem, dict, int]]:
    return [(c.system, c.result, c.count, c.code)
            for c in project.constructions.filter(deleted_at__isnull=True).select_related("system")]


def project_summary(project) -> dict:
    return price_lines(project_entries(project))


@transaction.atomic
def fill_calc(project, *, actor) -> list:
    """"Hisob-kitobga o'tkazish": one calc per price list of the constructions' systems, created when the
    Loyiha has none for it, its quantities set from the pooled cut plan (projects.calc_fill)."""
    entries = project_entries(project)
    if not entries:
        raise ValidationFailed("Loyihada konstruksiya yo'q")
    summary = price_lines(entries)
    by_list: dict[int, dict] = defaultdict(dict)
    items = {it.pk: it for it in PriceListItem.objects.filter(pk__in=[ln["item_id"] for ln in summary["lines"]])}
    for ln in summary["lines"]:
        by_list[ln["price_list_id"]][items[ln["item_id"]]] = Decimal(ln["qty"])
    lists = {e[0].price_list_id: e[0].price_list for e in entries}
    calcs = []
    for pl_id, pl in lists.items():
        calc = project.calcs.filter(price_list_id=pl_id).order_by("-id").first()
        if calc is None:
            calc = project_services.calc_create(project, actor=actor, price_list=pl)
        calcs.append(project_services.calc_fill(calc, actor=actor, quantities=by_list.get(pl_id, {})))
    return calcs

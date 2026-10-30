"""All writes of procurement. Every function takes `actor`; HTTP never reaches this module."""

from collections import defaultdict
from decimal import Decimal

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.db import transaction
from django.template.loader import render_to_string
from django.utils import timezone

from apps.access.registry import Action, Pages
from apps.access.services import has_permission
from apps.chatter.services import diff, event, muted, post
from apps.clients.models import ClientKind
from apps.company.models import Company
from apps.core.exceptions import Conflict, ValidationFailed
from apps.core.models import assign_code
from apps.procurement import selectors
from apps.procurement.models import (
    ORDER_TRANSITIONS,
    RECEIPT_TRANSITIONS,
    RECEIVING_STATUSES,
    REQUEST_TRANSITIONS,
    ApprovalStep,
    Currency,
    Decision,
    GoodsReceipt,
    GoodsReceiptLine,
    OrderStatus,
    PurchaseOrder,
    PurchaseOrderLine,
    PurchaseRequest,
    PurchaseRequestLine,
    ReceiptStatus,
    RequestApproval,
    RequestStatus,
    SentVia,
    money,
)
from apps.projects.models import ProjectStatus
from apps.projects.services import project_change_status

ZERO = Decimal("0")
LINES_LOCKED = "Yuborilgan buyurtma o'zgartirilmaydi — bekor qilib yangisini oching"


# ------------------------------------------------------------------ shared


def _move(obj, transitions: dict, status: str, *, actor, comment: str = "", labels) -> None:
    """Status change with the row locked, one chatter line (the comment + the tracked change)."""
    current = obj.status
    if status not in transitions[current]:
        raise ValidationFailed(f"'{labels(current).label}' holatidan '{labels(status).label}' holatiga "
                               "o'tib bo'lmaydi",
                               field="status")
    before = {"status": current}
    obj.status = status
    obj.stamp(actor)
    with muted():
        obj.save(update_fields=["status", "updated_by", "updated_at"])
    post(obj, comment, kind="track", changes=diff(obj, before, {"status": "Holat"}), actor=actor)


def _lines_text(lines) -> str:
    return "; ".join(f"{ln.name} {ln.qty.normalize():f} {ln.unit}" for ln in lines) or "—"


def _default_vat_rate(supplier) -> Decimal:
    """Company VAT rate when the company is a VAT payer (fields come with add-accounting), else 0."""
    company = Company.get()
    if getattr(company, "vat_payer", False):
        return Decimal(str(getattr(company, "vat_rate", 12)))
    return ZERO


# ------------------------------------------------------------------ purchase request


def _check_request_draft(req: PurchaseRequest) -> None:
    if req.status != RequestStatus.DRAFT:
        raise Conflict("Faqat qoralama so'rov o'zgartiriladi")


def _set_request_lines(req: PurchaseRequest, lines: list[dict], *, actor) -> None:
    before = list(req.lines.all())
    req.lines.all().delete()
    PurchaseRequestLine.objects.bulk_create(
        PurchaseRequestLine(request=req, sort_order=i, **ln) for i, ln in enumerate(lines))
    after = list(req.lines.all())
    if _lines_text(before) != _lines_text(after):
        post(req, kind="track", actor=actor,
             changes=[{"field": "lines", "label": "Qatorlar", "old": _lines_text(before),
                       "new": _lines_text(after)}])


@transaction.atomic
def request_create(*, actor, lines: list[dict] | None = None, **fields) -> PurchaseRequest:
    fields.setdefault("requester", actor if getattr(actor, "pk", None) else None)
    req = PurchaseRequest(**fields)
    req.stamp(actor, created=True)
    req.save()  # chatter: "Xarid so'rovi yaratildi"
    assign_code(req, "XS")
    if lines:
        PurchaseRequestLine.objects.bulk_create(
            PurchaseRequestLine(request=req, sort_order=i, **ln) for i, ln in enumerate(lines))
    return req


@transaction.atomic
def request_update(req: PurchaseRequest, *, actor, lines: list[dict] | None = None,
                   **fields) -> PurchaseRequest:
    _check_request_draft(req)
    for k, v in fields.items():
        setattr(req, k, v)
    req.stamp(actor)
    req.save()
    if lines is not None:
        _set_request_lines(req, lines, actor=actor)
    return req


@transaction.atomic
def request_from_calc(req: PurchaseRequest, *, actor, calc) -> PurchaseRequest:
    """"Hisob-kitobdan olish": append the calculation's lines (those with a quantity) to the request."""
    _check_request_draft(req)
    if calc.project_id != req.project_id:
        raise ValidationFailed("Hisob-kitob boshqa loyihaniki", field="calc_id")
    rows = _calc_rows(calc)
    if not rows:
        raise ValidationFailed("Hisob-kitobda miqdori bor qator yo'q", field="calc_id")
    _append_calc_rows(req, rows)
    event(req, f"Hisob-kitobdan olindi: {calc.title} — {len(rows)} qator", actor=actor)
    return req


def _calc_rows(calc) -> list:
    return [ln for ln in calc.lines.select_related("item") if ln.qty > 0]


def _append_calc_rows(req: PurchaseRequest, rows: list) -> None:
    start = req.lines.count()
    PurchaseRequestLine.objects.bulk_create(
        PurchaseRequestLine(request=req, item=ln.item, sort_order=start + i, name=ln.name, unit=ln.unit,
                            qty=ln.qty)
        for i, ln in enumerate(rows))


@transaction.atomic
def request_from_project(*, actor, project) -> PurchaseRequest:
    """"Xaridga yuborish" on the Loyiha card: a draft request with the lines of all its calculations."""
    calcs = list(project.calcs.all())
    rows = [ln for calc in calcs for ln in _calc_rows(calc)]
    if not rows:
        raise ValidationFailed("Loyiha hisob-kitobida miqdori bor qator yo'q", field="project_id")
    req = request_create(actor=actor, project=project)
    _append_calc_rows(req, rows)
    titles = ", ".join(c.title for c in calcs if c.title) or "hisob-kitob"
    event(req, f"Loyihadan olindi: {titles} — {len(rows)} qator", actor=actor)
    return req


# ------------------------------------------------------------------ approval steps


def active_steps() -> list[ApprovalStep]:
    return list(ApprovalStep.objects.filter(is_active=True).select_related("role").order_by("sequence", "id"))


def _next_step(step: ApprovalStep) -> ApprovalStep | None:
    for s in active_steps():
        if (s.sequence, s.pk) > (step.sequence, step.pk):
            return s
    return None


def can_decide_step(user, step: ApprovalStep) -> bool:
    if not user or not getattr(user, "is_authenticated", False):
        return False
    return bool(user.is_superuser or step.role.users.filter(pk=user.pk, is_active=True).exists())


def _check_step_member(step: ApprovalStep, actor) -> None:
    if not can_decide_step(actor, step):
        raise Conflict(f"Bu bosqichni «{step.role.name}» tasdiqlaydi")


def _record(req: PurchaseRequest, step: ApprovalStep | None, decision: str, *, actor, comment: str) -> None:
    RequestApproval.objects.create(request=req, step=step, step_name=step.name if step else "",
                                   decision=decision, user=actor if getattr(actor, "pk", None) else None,
                                   comment=comment)


@transaction.atomic
def approval_step_create(*, actor, **fields) -> ApprovalStep:
    step = ApprovalStep(**fields)
    step.stamp(actor, created=True)
    step.save()
    return step


@transaction.atomic
def approval_step_update(step: ApprovalStep, *, actor, **fields) -> ApprovalStep:
    for k, v in fields.items():
        setattr(step, k, v)
    step.stamp(actor)
    step.save()
    return step


def approval_step_delete(step: ApprovalStep, *, actor) -> None:
    if step.waiting_requests.filter(status=RequestStatus.SUBMITTED).exists():
        raise Conflict("Bu bosqichda kutayotgan so'rovlar bor — o'chirish o'rniga nofaol qiling")
    step.delete()


def _derive_request_status(req: PurchaseRequest, *, actor) -> None:
    """approved ↔ ordered from the lines' ordered_qty (in the same transaction as the order change)."""
    if req.status not in (RequestStatus.APPROVED, RequestStatus.ORDERED):
        return
    lines = list(req.lines.all())
    done = bool(lines) and all(ln.ordered_qty >= ln.qty for ln in lines)
    target = RequestStatus.ORDERED if done else RequestStatus.APPROVED
    if target != req.status:
        before = {"status": req.status}
        req.status = target
        req.stamp(actor)
        with muted():
            req.save(update_fields=["status", "updated_by", "updated_at"])
        post(req, kind="track", changes=diff(req, before, {"status": "Holat"}), actor=actor)


@transaction.atomic
def request_submit(req: PurchaseRequest, *, actor) -> PurchaseRequest:
    req = PurchaseRequest.objects.select_for_update().get(pk=req.pk)
    if not req.lines.exists():
        raise ValidationFailed("So'rovda qator yo'q", field="lines")
    _move(req, REQUEST_TRANSITIONS, RequestStatus.SUBMITTED, actor=actor, labels=RequestStatus)
    req.submitted_at = timezone.now()
    steps = active_steps()
    req.approval_step = steps[0] if steps else None
    with muted():
        req.save(update_fields=["submitted_at", "approval_step"])
    if steps:  # multi-level: waits at the first step, nobody skips it (design.md)
        event(req, f"Tasdiqlashda: {steps[0].name}", actor=actor)
        return req
    # a buyer who is also the approver does not click twice (design.md)
    if has_permission(actor, Pages.PURCHASE_APPROVE, Action.UPDATE):
        return request_approve(req, actor=actor)
    return req


def _finish_approval(req: PurchaseRequest, *, actor, comment: str = "") -> None:
    _move(req, REQUEST_TRANSITIONS, RequestStatus.APPROVED, actor=actor, comment=comment,
          labels=RequestStatus)
    req.approved_at, req.approved_by = timezone.now(), actor if getattr(actor, "pk", None) else None
    req.approval_step = None
    with muted():
        req.save(update_fields=["approved_at", "approved_by", "approval_step"])


@transaction.atomic
def request_approve(req: PurchaseRequest, *, actor, comment: str = "") -> PurchaseRequest:
    req = PurchaseRequest.objects.select_for_update().get(pk=req.pk)
    comment = (comment or "").strip()
    step = req.approval_step
    if step is None:  # single level (no active steps when it was submitted)
        _finish_approval(req, actor=actor, comment=comment)
        _record(req, None, Decision.APPROVED, actor=actor, comment=comment)
        event(req, "Tasdiqlandi", actor=actor)
        return req

    if req.status != RequestStatus.SUBMITTED:
        raise Conflict("So'rov tasdiqlashda emas")
    _check_step_member(step, actor)
    _record(req, step, Decision.APPROVED, actor=actor, comment=comment)
    event(req, f"{step.name}: tasdiqlandi" + (f" — {comment}" if comment else ""), actor=actor)
    nxt = _next_step(step)
    if nxt is not None:
        req.approval_step = nxt
        req.stamp(actor)
        with muted():
            req.save(update_fields=["approval_step", "updated_by", "updated_at"])
        return req
    _finish_approval(req, actor=actor)
    return req


@transaction.atomic
def request_reject(req: PurchaseRequest, *, actor, comment: str = "") -> PurchaseRequest:
    comment = (comment or "").strip()
    if not comment:
        raise ValidationFailed("Rad etish sababini yozing", field="comment")
    req = PurchaseRequest.objects.select_for_update().get(pk=req.pk)
    step = req.approval_step
    if step is None:
        _move(req, REQUEST_TRANSITIONS, RequestStatus.REJECTED, actor=actor, comment=f"Rad etildi: {comment}",
              labels=RequestStatus)
        _record(req, None, Decision.REJECTED, actor=actor, comment=comment)
        return req
    if req.status != RequestStatus.SUBMITTED:
        raise Conflict("So'rov tasdiqlashda emas")
    _check_step_member(step, actor)
    _record(req, step, Decision.REJECTED, actor=actor, comment=comment)
    _move(req, REQUEST_TRANSITIONS, RequestStatus.REJECTED, actor=actor, labels=RequestStatus)
    event(req, f"{step.name}: rad etildi — {comment}", actor=actor)
    req.approval_step = None
    with muted():
        req.save(update_fields=["approval_step"])
    return req


@transaction.atomic
def request_reopen(req: PurchaseRequest, *, actor) -> PurchaseRequest:
    """submitted / rejected → draft, to fix the lines and submit again (from step one)."""
    req = PurchaseRequest.objects.select_for_update().get(pk=req.pk)
    _move(req, REQUEST_TRANSITIONS, RequestStatus.DRAFT, actor=actor, labels=RequestStatus)
    if req.approval_step_id is not None:
        req.approval_step = None
        with muted():
            req.save(update_fields=["approval_step"])
    return req


@transaction.atomic
def request_cancel(req: PurchaseRequest, *, actor, comment: str = "") -> PurchaseRequest:
    req = PurchaseRequest.objects.select_for_update().get(pk=req.pk)
    if req.lines.filter(ordered_qty__gt=0).exists():
        raise Conflict("So'rov bo'yicha buyurtma bor — avval buyurtmani bekor qiling")
    _move(req, REQUEST_TRANSITIONS, RequestStatus.CANCELLED, actor=actor, comment=comment,
          labels=RequestStatus)
    return req


def request_delete(req: PurchaseRequest, *, actor) -> None:
    if req.status != RequestStatus.DRAFT:
        raise Conflict("Faqat qoralama so'rovni o'chirish mumkin. Boshqalarini bekor qiling.")
    req.soft_delete()


# ------------------------------------------------------------------ purchase order


def _check_supplier(supplier) -> None:
    if supplier is not None and supplier.kind != ClientKind.SUPPLIER:
        raise ValidationFailed("Faqat yetkazib beruvchi tanlanadi", field="supplier_id")


def _check_rate(order: PurchaseOrder) -> None:
    if order.currency != Currency.UZS and not order.rate:
        raise ValidationFailed("Valyuta kursini kiriting", field="rate")


def _accounting_rate(date, currency) -> Decimal | None:
    """The Central Bank rate of the day as the default; none for that day → the buyer types one."""
    if currency == Currency.UZS:
        return None
    from apps.accounting import selectors as accsel

    try:
        return accsel.rate_for(date, currency)
    except Conflict:
        return None


def _release_request_lines(lines, *, actor) -> None:
    """Give the ordered quantities back to the request lines (order cancelled or lines replaced)."""
    touched: dict[int, PurchaseRequest] = {}
    for ln in lines:
        rl = ln.request_line
        if rl is None:
            continue
        rl.ordered_qty = max(rl.ordered_qty - ln.qty, ZERO)
        rl.save(update_fields=["ordered_qty"])
        touched[rl.request_id] = rl.request
    for req in touched.values():
        _derive_request_status(req, actor=actor)


def _take_request_lines(lines: list[dict], *, actor) -> None:
    """Raise ordered_qty on the request lines these order lines come from; a line cannot take more
    than what is left of the request line."""
    touched: dict[int, PurchaseRequest] = {}
    for ln in lines:
        rl = ln.get("request_line")
        if rl is None:
            continue
        rl.refresh_from_db(fields=["ordered_qty"])
        if rl.request.status not in (RequestStatus.APPROVED, RequestStatus.ORDERED):
            raise Conflict(f"{rl.request.code}: so'rov tasdiqlanmagan")
        if ln["qty"] > rl.remaining_qty:
            raise ValidationFailed(f"{rl.name}: so'rovda {rl.remaining_qty.normalize():f} {rl.unit} qolgan",
                                   field="lines")
        rl.ordered_qty += ln["qty"]
        rl.save(update_fields=["ordered_qty"])
        touched[rl.request_id] = rl.request
    for req in touched.values():
        _derive_request_status(req, actor=actor)


def _prepare_order_lines(order: PurchaseOrder, lines: list[dict]) -> list[dict]:
    out = []
    for i, ln in enumerate(lines):
        row = {**ln, "sort_order": i}
        rl = row.get("request_line")
        if rl is not None:
            row.setdefault("item", rl.item)
            row.setdefault("name", rl.name)
            row.setdefault("unit", rl.unit)
            row["project"] = rl.request.project
        row.setdefault("project", order.project)
        if row.get("vat_rate") is None:
            row["vat_rate"] = _default_vat_rate(order.supplier)
        if row.get("price") is None:
            last = selectors.last_price(order.supplier, row.get("item"))
            row["price"] = last[0] if last and last[1] == order.currency else ZERO
        if not row.get("name"):
            raise ValidationFailed("Qator nomini kiriting", field="lines")
        out.append(row)
    return out


def _set_order_lines(order: PurchaseOrder, lines: list[dict], *, actor) -> None:
    before = list(order.lines.select_related("request_line__request"))
    _release_request_lines(before, actor=actor)
    order.lines.all().delete()
    rows = _prepare_order_lines(order, lines)
    _take_request_lines(rows, actor=actor)
    PurchaseOrderLine.objects.bulk_create(PurchaseOrderLine(order=order, **row) for row in rows)
    after = list(order.lines.all())
    if _lines_text(before) != _lines_text(after):
        post(order, kind="track", actor=actor,
             changes=[{"field": "lines", "label": "Qatorlar", "old": _lines_text(before),
                       "new": _lines_text(after)}])


@transaction.atomic
def order_create(*, actor, lines: list[dict] | None = None, **fields) -> PurchaseOrder:
    _check_supplier(fields.get("supplier"))
    fields.setdefault("date", timezone.localdate())
    if not fields.get("currency"):
        fields["currency"] = fields["supplier"].price_currency or Currency.UZS
    if fields.get("rate") is None:
        fields["rate"] = _accounting_rate(fields["date"], fields["currency"])
    order = PurchaseOrder(**fields)
    order.stamp(actor, created=True)
    order.save()  # chatter: "Buyurtma yaratildi"
    assign_code(order, "XB")
    if lines:
        rows = _prepare_order_lines(order, lines)
        _take_request_lines(rows, actor=actor)
        PurchaseOrderLine.objects.bulk_create(PurchaseOrderLine(order=order, **row) for row in rows)
    return order


@transaction.atomic
def order_create_from_requests(*, actor, lines: list[dict], expected_date=None,
                               notes: str = "") -> list[PurchaseOrder]:
    """"Buyurtma yaratish": one draft order per supplier from approved request lines.
    `lines` = [{request_line, supplier, qty?}] — qty defaults to what is left of the request line."""
    by_supplier: dict[int, list[dict]] = defaultdict(list)
    suppliers = {}
    for row in lines:
        rl, supplier = row["request_line"], row["supplier"]
        _check_supplier(supplier)
        qty = row.get("qty") or rl.remaining_qty
        if qty <= 0:
            raise ValidationFailed(f"{rl.name}: so'rov qatori to'liq buyurtma qilingan", field="lines")
        suppliers[supplier.pk] = supplier
        by_supplier[supplier.pk].append({"request_line": rl, "qty": qty})
    if not by_supplier:
        raise ValidationFailed("Qator tanlanmagan", field="lines")
    orders = []
    for sid, rows in by_supplier.items():
        projects = {r["request_line"].request.project_id for r in rows}
        project = rows[0]["request_line"].request.project if len(projects) == 1 else None
        orders.append(order_create(actor=actor, supplier=suppliers[sid], project=project,
                                   expected_date=expected_date, notes=notes, lines=rows))
    return orders


@transaction.atomic
def order_update(order: PurchaseOrder, *, actor, lines: list[dict] | None = None, **fields) -> PurchaseOrder:
    order = PurchaseOrder.objects.select_for_update().get(pk=order.pk)
    if order.status != OrderStatus.DRAFT:
        locked = set(fields) - {"notes", "expected_date"}
        if locked or lines is not None:
            if order.status == OrderStatus.CANCELLED:
                raise Conflict("Bekor qilingan buyurtma o'zgartirilmaydi")
            raise Conflict(LINES_LOCKED)
    if "supplier" in fields:
        _check_supplier(fields["supplier"])
    for k, v in fields.items():
        setattr(order, k, v)
    if ("currency" in fields or "date" in fields) and "rate" not in fields and order.currency != Currency.UZS:
        order.rate = order.rate or _accounting_rate(order.date, order.currency)
    order.stamp(actor)
    order.save()
    if lines is not None:
        _set_order_lines(order, lines, actor=actor)
    return order


def email_configured() -> bool:
    return bool(settings.EMAIL_HOST)


def order_email_html(order: PurchaseOrder) -> str:
    return render_to_string("procurement/order_email.html", {
        "order": order, "company": Company.get(), "lines": list(order.lines.all()), "totals": order.totals(),
    })


def _send_order_email(order: PurchaseOrder, to: str) -> None:
    company = Company.get()
    subject = f"Buyurtma {order.code} — {company.name}"
    html = order_email_html(order)
    text = "\n".join(f"{ln.name}: {ln.qty.normalize():f} {ln.unit} × {ln.price} {order.currency}"
                     for ln in order.lines.all())
    msg = EmailMultiAlternatives(subject, f"{subject}\n\n{text}", settings.DEFAULT_FROM_EMAIL, [to])
    msg.attach_alternative(html, "text/html")
    try:
        msg.send()
    except Exception as e:  # SMTP down, refused address…: nothing is marked sent
        raise Conflict(f"Email yuborilmadi: {e}") from e


@transaction.atomic
def order_send(order: PurchaseOrder, *, actor, via: str, to: str = "", note: str = "") -> PurchaseOrder:
    """The step the business asked for: who, when, how. draft → sent; a sent order may be sent again."""
    order = PurchaseOrder.objects.select_related("supplier").select_for_update().get(pk=order.pk)
    if order.status not in (OrderStatus.DRAFT, OrderStatus.SENT):
        raise Conflict(f"«{OrderStatus(order.status).label}» buyurtma yuborilmaydi")
    if not order.lines.exists():
        raise ValidationFailed("Buyurtmada qator yo'q", field="lines")
    _check_rate(order)
    to = (to or "").strip()
    if via == SentVia.EMAIL:
        to = to or order.supplier.email
        if not to:
            raise ValidationFailed("Yetkazib beruvchining emaili yo'q — manzilni kiriting", field="to")
        if not email_configured():
            raise Conflict("Email sozlanmagan")

    if order.status == OrderStatus.DRAFT:  # the gate (ADR 0009): kassa approved the money first
        state = money_state(order)
        if state is None or state["status"] not in MONEY_OK:
            raise Conflict("Kassa pul so'rovini tasdiqlamagan")

    order.sent_at, order.sent_by, order.sent_via, order.sent_to = timezone.now(), actor, via, to[:200]
    order.stamp(actor)
    with muted():
        order.save(update_fields=["sent_at", "sent_by", "sent_via", "sent_to", "updated_by", "updated_at"])
    if order.status == OrderStatus.DRAFT:
        _move(order, ORDER_TRANSITIONS, OrderStatus.SENT, actor=actor, labels=OrderStatus)
    body = f"Yuborildi: {SentVia(via).label}" + (f" → {to}" if to else "")
    event(order, f"{body}. {note.strip()}" if note.strip() else body, actor=actor)

    # the first order of a confirmed Loyiha moves it to Xaridda (projects.services keeps the rules)
    for project in {ln.project for ln in order.lines.select_related("project") if ln.project}:
        if project.status == ProjectStatus.CONFIRMED:
            project_change_status(project, actor=actor, status=ProjectStatus.PROCUREMENT)

    if via == SentVia.EMAIL:
        _send_order_email(order, to)  # last: a failed send rolls everything back
    return order


@transaction.atomic
def order_cancel(order: PurchaseOrder, *, actor, comment: str = "") -> PurchaseOrder:
    order = PurchaseOrder.objects.select_for_update().get(pk=order.pk)
    if order.receipts.filter(status=ReceiptStatus.POSTED).exists():
        raise Conflict("Buyurtma bo'yicha kirim o'tkazilgan — bekor qilib bo'lmaydi")
    _move(order, ORDER_TRANSITIONS, OrderStatus.CANCELLED, actor=actor, comment=comment, labels=OrderStatus)
    _release_request_lines(order.lines.select_related("request_line__request"), actor=actor)
    _release_money(order, actor=actor)
    return order


def order_delete(order: PurchaseOrder, *, actor) -> None:
    if order.status != OrderStatus.DRAFT:
        raise Conflict("Faqat qoralama buyurtmani o'chirish mumkin. Boshqalarini bekor qiling.")
    with transaction.atomic():
        _release_request_lines(order.lines.select_related("request_line__request"), actor=actor)
        _release_money(order, actor=actor)
        order.soft_delete()


# ------------------------------------------------------------------ money request (ADR 0009)

MONEY_OPEN = ("submitted", "approved", "paid")  # a live request: no second one
MONEY_OK = ("approved", "paid")  # the order may be sent
MONEY_RELEASABLE = ("draft", "submitted", "approved")  # cancelled together with the order


def _kassa():
    """kassa write/read API (ADR 0009): procurement imports kassa, never the reverse."""
    from apps.kassa import selectors as kassa_sel
    from apps.kassa import services as kassa

    return kassa, kassa_sel


def money_state(order: PurchaseOrder) -> dict | None:
    if order.payment_request_id is None:
        return None
    _, kassa_sel = _kassa()
    return kassa_sel.payment_request_state(order.payment_request)


def _release_money(order: PurchaseOrder, *, actor) -> None:
    if order.payment_request_id is None:
        return
    req = order.payment_request
    if req.status in MONEY_RELEASABLE:
        kassa, _ = _kassa()
        kassa.payment_request_cancel(req, actor=actor, comment=f"Buyurtma {order.code} bekor qilindi")


@transaction.atomic
def order_request_money(order: PurchaseOrder, *, actor, amount: Decimal | None = None,
                        note: str = "") -> PurchaseOrder:
    """"Pul so'rash": a submitted kassa money request for the order (default: its gross) linked to it."""
    order = PurchaseOrder.objects.select_related("supplier", "project").select_for_update().get(pk=order.pk)
    if order.status != OrderStatus.DRAFT:
        raise Conflict("Pul faqat qoralama buyurtma uchun so'raladi")
    lines = list(order.lines.select_related("project"))
    if not lines:
        raise ValidationFailed("Buyurtmada qator yo'q", field="lines")
    state = money_state(order)
    if state is not None and state["status"] in MONEY_OPEN:
        raise Conflict(f"Pul so'rovi allaqachon bor: {state['code']}")
    _check_rate(order)
    amount = order.totals()["gross"] if amount is None else amount
    if amount <= 0:
        raise ValidationFailed("Summa noldan katta bo'lsin", field="amount")
    project = order.project or next((ln.project for ln in lines if ln.project), None)
    kassa, kassa_sel = _kassa()
    req = kassa.payment_request_create(
        actor=actor, source=order, partner=order.supplier, project=project, amount=amount,
        currency=order.currency, rate=order.rate if order.currency != Currency.UZS else None,
        purpose=kassa_sel.supplier_payment_purpose(), basis=f"Buyurtma {order.code}",
        needed_by=order.expected_date, notes=(note or "").strip())
    kassa.payment_request_submit(req, actor=actor)
    order.payment_request = req
    order.stamp(actor)
    with muted():
        order.save(update_fields=["payment_request", "updated_by", "updated_at"])
    unit = "so'm" if order.currency == Currency.UZS else order.currency
    total = f"{amount:,.2f}".replace(",", " ")
    event(order, f"Kassadan pul so'raldi: {req.code} — {total} {unit}", actor=actor)
    return order


def _derive_order_status(order: PurchaseOrder, *, actor) -> None:
    """sent / partially_received / received from the lines' received_qty."""
    if order.status not in RECEIVING_STATUSES:
        return
    lines = list(order.lines.all())
    if lines and all(ln.received_qty >= ln.qty for ln in lines):
        target = OrderStatus.RECEIVED
    elif any(ln.received_qty > 0 for ln in lines):
        target = OrderStatus.PARTIALLY_RECEIVED
    else:
        target = OrderStatus.SENT
    if target != order.status:
        before = {"status": order.status}
        order.status = target
        order.stamp(actor)
        with muted():
            order.save(update_fields=["status", "updated_by", "updated_at"])
        post(order, kind="track", changes=diff(order, before, {"status": "Holat"}), actor=actor)


# ------------------------------------------------------------------ goods receipt


def _check_receipt_lines(receipt: GoodsReceipt | None, order: PurchaseOrder, lines: list[dict]) -> list[dict]:
    """Each line receives at most what is left of its order line (other posted receipts counted)."""
    rows = []
    for ln in lines:
        ol = ln["order_line"]
        if ol.order_id != order.pk:
            raise ValidationFailed("Qator boshqa buyurtmaniki", field="lines")
        ol.refresh_from_db(fields=["received_qty"])
        if ln["qty"] > ol.remaining_qty:
            raise ValidationFailed(f"{ol.name}: buyurtmada {ol.remaining_qty.normalize():f} {ol.unit} qolgan",
                                   field="lines")
        rows.append({"order_line": ol, "qty": ln["qty"], "price": ol.price, "vat_rate": ol.vat_rate})
    return rows


@transaction.atomic
def receipt_create_from_order(*, actor, order: PurchaseOrder, lines: list[dict] | None = None,
                              **fields) -> GoodsReceipt:
    """"Kirim qilish": a draft receipt pre-filled with what is still to come."""
    if order.status not in (OrderStatus.SENT, OrderStatus.PARTIALLY_RECEIVED):
        raise Conflict(f"«{OrderStatus(order.status).label}» buyurtmaga kirim qilinmaydi")
    if lines is None:
        lines = [{"order_line": ol,
                  "qty": ol.remaining_qty} for ol in order.lines.all() if ol.remaining_qty > 0]
    rows = _check_receipt_lines(None, order, lines)
    fields.setdefault("date", timezone.localdate())
    fields.setdefault("storekeeper", actor if getattr(actor, "pk", None) else None)
    receipt = GoodsReceipt(order=order, supplier=order.supplier, **fields)
    receipt.stamp(actor, created=True)
    receipt.save()  # chatter: "Kirim yaratildi"
    assign_code(receipt, "KR")
    GoodsReceiptLine.objects.bulk_create(GoodsReceiptLine(receipt=receipt, **row) for row in rows)
    return receipt


@transaction.atomic
def receipt_update(receipt: GoodsReceipt, *, actor, lines: list[dict] | None = None,
                   **fields) -> GoodsReceipt:
    if receipt.status != ReceiptStatus.DRAFT:
        if set(fields) - {"notes", "invoice_number", "invoice_date", "invoice_total"} or lines is not None:
            raise Conflict("O'tkazilgan kirim o'zgartirilmaydi — bekor qilib yangisini oching")
    for k, v in fields.items():
        setattr(receipt, k, v)
    receipt.stamp(actor)
    receipt.save()
    if lines is not None:
        rows = _check_receipt_lines(receipt, receipt.order, lines)
        receipt.lines.all().delete()
        GoodsReceiptLine.objects.bulk_create(GoodsReceiptLine(receipt=receipt, **row) for row in rows)
    return receipt


def _inventory():
    """The inventory write API (ADR 0010): procurement imports inventory, never the reverse."""
    from apps.inventory import services as inv

    return inv


def _ledger():
    """The accounting write/read API (ADR 0007): procurement imports accounting, never the reverse."""
    from apps.accounting import selectors as accsel
    from apps.accounting import services as acc

    return acc, accsel


@transaction.atomic
def receipt_post(receipt: GoodsReceipt, *, actor) -> GoodsReceipt:
    """Dt materials (net) + Dt vat_input (VAT)  Kt ap_suppliers (gross); then the prepayment offset."""
    receipt = GoodsReceipt.objects.select_related("order", "supplier").select_for_update().get(pk=receipt.pk)
    if receipt.status != ReceiptStatus.DRAFT:
        raise ValidationFailed("Faqat qoralama kirim o'tkaziladi", field="status")
    order = PurchaseOrder.objects.select_for_update().get(pk=receipt.order_id)
    if order.status not in (OrderStatus.SENT, OrderStatus.PARTIALLY_RECEIVED):
        raise Conflict(f"Buyurtma «{OrderStatus(order.status).label}» holatida — kirim o'tkazilmaydi")
    lines = list(receipt.lines.select_related("order_line__project"))
    if not lines:
        raise ValidationFailed("Kirimda qator yo'q", field="lines")
    _check_receipt_lines(receipt, order, [{"order_line": ln.order_line, "qty": ln.qty} for ln in lines])

    acc, accsel = _ledger()
    acc.check_open(receipt.date)
    currency = order.currency
    rate = order.uzs_rate
    if currency != Currency.UZS and not order.rate:
        rate = accsel.rate_for(receipt.date, currency)
    cur = None if currency == Currency.UZS else currency

    inv = _inventory()
    entry_lines, stock_rows = [], []
    gross_total = ZERO
    for ln in lines:
        ol = ln.order_line
        net_uzs, vat_uzs = money(ln.net * rate), money(ln.vat * rate)
        memo = f"{ol.name} {ln.qty.normalize():f} {ol.unit}"
        # the product the line brings decides the stock account (1010 / 2810), so stock value = ledger
        product = inv.product_for(actor=actor, item=ol.item, name=ol.name, unit=ol.unit)
        stock_rows.append({"product": product, "qty": ln.qty, "amount": net_uzs, "project": ol.project})
        entry_lines.append({"role": inv.stock_role(product), "debit": net_uzs, "partner": receipt.supplier,
                            "project": ln.order_line.project, "currency": cur,
                            "amount_cur": ln.net if cur else None, "rate": order.rate if cur else None,
                            "memo": memo})
        if vat_uzs:
            entry_lines.append({"role": "vat_input", "debit": vat_uzs, "partner": receipt.supplier,
                                "project": ln.order_line.project, "currency": cur,
                                "amount_cur": ln.vat if cur else None, "rate": order.rate if cur else None,
                                "memo": f"QQS {memo}"})
        gross_total += net_uzs + vat_uzs
    totals = receipt.totals()
    entry_lines.append({"role": "ap_suppliers", "credit": gross_total, "partner": receipt.supplier,
                        "project": order.project, "currency": cur,
                        "amount_cur": totals["gross"] if cur else None,
                        "rate": order.rate if cur else None,
                        "memo": f"{receipt.supplier.name} {receipt.invoice_number or receipt.code}".strip()})
    entry_lines += acc.advance_offset_lines(partner=receipt.supplier, side="supplier", amount=gross_total,
                                            project=order.project)
    entry = acc.entry_post(actor=actor, date=receipt.date, memo=f"Kirim {receipt.code} ({order.code})",
                           lines=entry_lines, source=receipt)
    warehouse = receipt.warehouse or inv.default_warehouse()
    moves = inv.source_moves_post(actor=actor, source=receipt, date=receipt.date, warehouse=warehouse,
                                  partner=receipt.supplier, rows=stock_rows)

    for ln in lines:
        ol = ln.order_line
        ol.received_qty += ln.qty
        ol.save(update_fields=["received_qty"])
    receipt.posted_at, receipt.posted_by, receipt.entry = timezone.now(), actor, entry
    receipt.warehouse = warehouse
    with muted():
        receipt.save(update_fields=["posted_at", "posted_by", "entry", "warehouse"])
    _move(receipt, RECEIPT_TRANSITIONS, ReceiptStatus.POSTED, actor=actor, labels=ReceiptStatus)
    total = f"{gross_total:,.2f}".replace(",", " ")
    event(receipt, f"Jurnalga o'tkazildi: {entry.code} — {total} so'm", actor=actor)
    event(receipt, f"Omborga kirim: «{warehouse.name}», {len(moves)} qator", actor=actor)
    _derive_order_status(order, actor=actor)
    return receipt


@transaction.atomic
def receipt_cancel(receipt: GoodsReceipt, *, actor, comment: str = "") -> GoodsReceipt:
    """posted → cancelled: a reversing entry, quantities rolled back, order status derived again."""
    receipt = GoodsReceipt.objects.select_related("order").select_for_update().get(pk=receipt.pk)
    order = PurchaseOrder.objects.select_for_update().get(pk=receipt.order_id)
    if order.status == OrderStatus.CANCELLED:
        raise Conflict("Buyurtma bekor qilingan — kirimni bekor qilib bo'lmaydi")
    if receipt.status != ReceiptStatus.POSTED:
        raise ValidationFailed("Faqat o'tkazilgan kirim bekor qilinadi", field="status")
    acc, _ = _ledger()
    # the goods leave the warehouse first: 409 when some of them were already issued
    _inventory().source_moves_cancel(actor=actor, source=receipt, comment=comment or f"{receipt.code} bekor qilindi")
    if receipt.entry_id:
        reversal = acc.entry_reverse(receipt.entry, actor=actor, memo=f"Storno {receipt.code}")
        event(receipt, f"Storno: {reversal.code}", actor=actor)
    for ln in receipt.lines.select_related("order_line"):
        ol = ln.order_line
        ol.received_qty = max(ol.received_qty - ln.qty, ZERO)
        ol.save(update_fields=["received_qty"])
    _move(receipt, RECEIPT_TRANSITIONS, ReceiptStatus.CANCELLED, actor=actor, comment=comment,
          labels=ReceiptStatus)
    _derive_order_status(order, actor=actor)
    return receipt


def receipt_delete(receipt: GoodsReceipt, *, actor) -> None:
    if receipt.status != ReceiptStatus.DRAFT:
        raise Conflict("Faqat qoralama kirimni o'chirish mumkin. O'tkazilganini bekor qiling.")
    receipt.soft_delete()

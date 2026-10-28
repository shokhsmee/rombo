"""Who is this number, and which lead is theirs? Shared by calls, lead sources, amoCRM and Telegram
(uzbridge crm/routing.py).

unknown:   create_lead (a lead with the number — the client is made when the lead becomes a Loyiha) |
           create_contact (a Mijoz, no lead) | nothing
duplicate: open_lead (write into their open lead) | always_new | contact_only (link the client, no lead)
"""

from dataclasses import dataclass

from apps.chatter.services import event
from apps.clients.models import Client, ClientKind
from apps.clients.services import client_create
from apps.crm import phones, selectors
from apps.crm.models import Lead, Pipeline, Stage
from apps.crm.services.leads import lead_create


@dataclass
class Routed:
    client: Client | None = None
    lead: Lead | None = None
    created_client: bool = False
    created_lead: bool = False
    duplicate: bool = False  # the number / email was already known


def _pipeline_stage(pipeline_id=None, stage_id=None) -> tuple[Pipeline | None, Stage | None]:
    if stage_id:
        st = Stage.objects.filter(pk=stage_id, is_won=False, is_lost=False).select_related("pipeline").first()
        if st and st.pipeline.is_active:
            return st.pipeline, st
    p = Pipeline.objects.filter(pk=pipeline_id, is_active=True).first() if pipeline_id else None
    return p, None


def new_lead(*, title, phone="", name="", client=None, pipeline_id=None, stage_id=None, manager=None, source=None,
             tags=None, note="", actor=None) -> Lead:
    p, st = _pipeline_stage(pipeline_id, stage_id)
    lead = lead_create(actor=actor, pipeline=p, stage=st, title=(title or "Yangi lid")[:200], phone=phone,
                       contact_name=name[:200], client=client, manager=manager, auto_manager=manager is None,
                       source=source, tags=tags or [])
    if note:
        event(lead, note, actor=actor)
    return lead


def route(*, phone=None, name="", email="", unknown="create_lead", duplicate="open_lead", title="",
          pipeline_id=None, stage_id=None, manager=None, source=None, tags=None, note="", actor=None) -> Routed:
    out = Routed()
    number = phones.normalize(phone)
    client = selectors.client_by_phone(number) if number else None
    if client is None and email:
        client = Client.objects.filter(email__iexact=email.strip()).first()
    lead_kw = dict(pipeline_id=pipeline_id, stage_id=stage_id, manager=manager, source=source, tags=tags, note=note,
                   actor=actor)
    open_lead = selectors.open_lead_by_phone(number) if number else None
    if open_lead is None and client is not None:
        open_lead = Lead.objects.filter(client=client, status="open").order_by("-updated_at", "-id").first()
    if client is not None or open_lead is not None:
        out.client, out.duplicate = client or (open_lead.client if open_lead else None), True
        if duplicate == "contact_only":
            return out
        if duplicate == "open_lead" and open_lead is not None:
            out.lead = open_lead
            return out
        out.lead = new_lead(title=title or (client.name if client else phones.pretty(number)), phone=number,
                            name=name, client=out.client, **lead_kw)
        out.created_lead = True
        return out
    if unknown == "nothing" or not (number or email or name):
        return out
    if unknown == "create_contact":
        out.client = client_create(actor=actor, kind=ClientKind.INDIVIDUAL,
                                   name=(name or phones.pretty(number) or email or "Yangi mijoz")[:255],
                                   phone=phones.pretty(number), email=(email or "")[:254],
                                   source=source.name if source else "")
        out.created_client = True
        return out
    out.lead = new_lead(title=title or name or phones.pretty(number) or email, phone=number, name=name, **lead_kw)
    out.created_lead = True
    return out

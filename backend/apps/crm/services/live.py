"""What the CRM pushes to open browsers (apps.core.realtime): board refreshes, calls to their operator,
notifications (uzbridge notifications.crm_lead_assigned / crm_task_due, as a toast with a link)."""

from apps.core.realtime import publish


def board(pipeline_id: int | None = None) -> None:
    publish({"type": "crm", "pipeline_id": pipeline_id})


def call(call) -> None:
    """A call to its operator (popup) and a refresh of everyone's call log."""
    from apps.crm.serializers import CallSerializer

    data = CallSerializer(call).data
    if call.user_id:
        publish({"type": "call", "call": data}, [call.user_id])
    if not data["live"]:
        publish({"type": "calls"})


def sync_done(conn_id: int, result: dict) -> None:
    publish({"type": "sync", "connection_id": conn_id, **result})


def notify(user_ids: list[int], title: str, body: str = "", link: str = "") -> None:
    ids = [u for u in user_ids if u]
    if ids:
        publish({"type": "notify", "title": title, "body": body, "link": link}, ids)


def lead_assigned(lead, *, by=None) -> None:
    """The lead's manager hears about it, unless they assigned it to themselves."""
    user_id = lead.manager.user_id if lead.manager_id and lead.manager else None
    if not user_id or (by is not None and getattr(by, "pk", None) == user_id):
        return
    notify([user_id], f"Sizga yangi lid: {lead.title}",
           f"Manba: {lead.source.name}" if lead.source_id else "", f"/crm/leads/{lead.pk}")

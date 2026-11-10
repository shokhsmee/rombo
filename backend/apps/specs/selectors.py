import re

from django.db.models import Q, QuerySet

from apps.specs import openspec
from apps.specs.models import DocKind, FixIdea, SpecDocument


def documents() -> QuerySet[SpecDocument]:
    return SpecDocument.objects.all()


def search(query: str, *, kinds: list[str] | None = None, limit: int = 20) -> list[dict]:
    """Documents whose path, title or content contain every word, with a few matching lines each."""
    words = [w for w in query.split() if w]
    if not words:
        return []
    qs = SpecDocument.objects.all()
    if kinds:
        qs = qs.filter(kind__in=kinds)
    for w in words:
        qs = qs.filter(Q(path__icontains=w) | Q(title__icontains=w) | Q(content__icontains=w))
    pattern = re.compile("|".join(re.escape(w) for w in words), re.I)
    out = []
    for doc in qs.order_by("kind", "path")[:limit]:
        lines = [ln.strip() for ln in doc.content.splitlines() if pattern.search(ln)]
        out.append({"path": doc.path, "kind": doc.kind, "ref": doc.ref, "title": doc.title,
                    "matches": [ln[:300] for ln in lines[:5]]})
    return out


def db_problems() -> list[str]:
    """OpenSpec consistency over the synced copy (same rules as the repo test)."""
    return openspec.problems(dict(SpecDocument.objects.values_list("path", "content")))


def capabilities() -> list[dict]:
    return [{"capability": d.ref, "title": d.title, "requirements": d.requirements, "path": d.path}
            for d in SpecDocument.objects.filter(kind=DocKind.SPEC).order_by("ref")]


def changes(*, archived: bool = False) -> list[dict]:
    kind = DocKind.ARCHIVED if archived else DocKind.CHANGE
    out: dict[str, dict] = {}
    for d in SpecDocument.objects.filter(kind=kind).order_by("ref", "path").only("path", "ref", "title"):
        row = out.setdefault(d.ref, {"change": d.ref, "title": "", "files": []})
        row["files"].append(d.path)
        if d.path.endswith("/proposal.md"):
            row["title"] = d.title
    return list(out.values())


def idea_proposal_markdown(idea: FixIdea) -> str:
    """An OpenSpec proposal.md draft; the developer still creates the change folder and the spec delta."""
    change_id = idea.change_id or _slug(f"{'fix' if idea.kind == 'fix' else 'add'} {idea.title}")
    impact = idea.impact.strip() or (f"- Capability: `{idea.capability}`" if idea.capability else "- TODO")
    return (
        f"# Change: {change_id}\n\n"
        f"> From idea {idea.code} ({idea.get_kind_display()}, {idea.get_priority_display()}).\n\n"
        f"## Why\n{idea.problem.strip()}\n\n"
        f"## What changes\n{idea.proposal.strip() or '- TODO'}\n\n"
        f"## Impact\n{impact}\n"
    )


def _slug(text: str) -> str:
    text = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return text[:60].rstrip("-") or "change"

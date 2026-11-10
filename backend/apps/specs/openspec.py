"""Reading the OpenSpec folder layout. Pure functions over `{relative_path: text}`, so the same checks run on
the files in the repo (tests, `specs_sync`) and on the copy in the database (MCP tool `specs_check`)."""

from __future__ import annotations

import re
from collections.abc import Mapping
from pathlib import Path

from apps.specs.models import DocKind

REQUIREMENT_RE = re.compile(r"^### Requirement:\s*(.+?)\s*$", re.M)
DELTA_RE = re.compile(r"^## (ADDED|MODIFIED|REMOVED|RENAMED) Requirements\s*$", re.M)
TITLE_RE = re.compile(r"^#\s+(.+?)\s*$", re.M)


def read_tree(root: Path) -> dict[str, str]:
    """Every markdown file under `root`, keyed by its posix path relative to `root`."""
    return {p.relative_to(root).as_posix(): p.read_text(encoding="utf-8")
            for p in sorted(root.rglob("*.md")) if p.is_file()}


def classify(path: str) -> tuple[str, str] | None:
    """(kind, ref) of a file, or None for files we don't keep (READMEs, stray notes)."""
    parts = path.split("/")
    if path == "project.md":
        return DocKind.PROJECT, ""
    if parts[0] == "specs" and len(parts) == 3 and parts[2] == "spec.md":
        return DocKind.SPEC, parts[1]
    if parts[0] == "changes" and len(parts) >= 3:
        if parts[1] == "archive":
            return (DocKind.ARCHIVED, parts[2]) if len(parts) >= 4 else None
        return DocKind.CHANGE, parts[1]
    return None


def title_of(text: str, fallback: str) -> str:
    m = TITLE_RE.search(text)
    return (m.group(1) if m else fallback)[:300]


def requirements(text: str) -> list[str]:
    return REQUIREMENT_RE.findall(text)


def requirement_blocks(text: str) -> dict[str, str]:
    """{name: body} for every requirement; the body runs to the next requirement or `## ` heading."""
    out = {}
    matches = list(REQUIREMENT_RE.finditer(text))
    for i, m in enumerate(matches):
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        body = text[m.end():end]
        cut = re.search(r"^## ", body, re.M)
        out[m.group(1)] = body[:cut.start()] if cut else body
    return out


def delta_sections(text: str) -> list[tuple[str, list[str]]]:
    """[(ADDED|MODIFIED|REMOVED|RENAMED, [requirement names])] of a change's spec delta."""
    parts = DELTA_RE.split(text)
    return [(parts[i], requirements(parts[i + 1])) for i in range(1, len(parts), 2)]


def problems(tree: Mapping[str, str]) -> list[str]:
    """What `openspec validate` would complain about, plus deltas archived without being merged."""
    out: list[str] = []
    kinds = {path: classify(path) for path in tree}
    specs = {k[1]: tree[path] for path, k in kinds.items() if k and k[0] == DocKind.SPEC}
    spec_reqs = {cap: set(requirements(text)) for cap, text in specs.items()}

    for cap, text in sorted(specs.items()):
        for name, body in requirement_blocks(text).items():
            if "#### Scenario:" not in body:
                out.append(f"specs/{cap}: requirement '{name}' has no scenario")

    for path, text in sorted(tree.items()):
        parts = path.split("/")
        if not (len(parts) == 6 and parts[:2] == ["changes", "archive"] and parts[3] == "specs"
                and parts[5] == "spec.md"):
            continue
        change, cap = parts[2], parts[4]
        if cap not in spec_reqs:
            out.append(f"{change}: capability '{cap}' has no openspec/specs/{cap}/spec.md")
            continue
        for kind, names in delta_sections(text):
            for name in names:
                present = name in spec_reqs[cap]
                if kind in ("ADDED", "MODIFIED") and not present:
                    out.append(f"{change}: {kind} requirement '{name}' is not in specs/{cap}")
                elif kind == "REMOVED" and present:
                    out.append(f"{change}: REMOVED requirement '{name}' is still in specs/{cap}")

    active = {k[1] for k in kinds.values() if k and k[0] == DocKind.CHANGE}
    for change in sorted(active):
        for need in ("proposal.md", "tasks.md"):
            if f"changes/{change}/{need}" not in tree:
                out.append(f"changes/{change}: missing {need}")
    return out

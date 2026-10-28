"""Resolve 'both sides added lines' conflicts: keep ours then theirs, or a hand-written union."""
import re
import sys
from pathlib import Path

HUNK = re.compile(r"<<<<<<< [^\n]*\n(.*?)=======\n(.*?)>>>>>>> [^\n]*\n", re.S)


def union(path):
    p = Path(path)
    s = HUNK.sub(lambda m: m.group(1) + m.group(2), p.read_text(encoding="utf-8"))
    p.write_text(s, encoding="utf-8", newline="\n")


def replace_hunk(path, text):
    p = Path(path)
    s, n = HUNK.subn(lambda m: text, p.read_text(encoding="utf-8"), count=1)
    assert n == 1, path
    p.write_text(s, encoding="utf-8", newline="\n")


step = sys.argv[1]
if step == "crm":
    union("frontend/src/components/Shell.tsx")
    union("CHANGELOG.md")
    replace_hunk("frontend/src/auth/AuthProvider.tsx",
                 '  | "dashboard" | "projects" | "clients" | "procurement" | "mrp" | "employees" | "users" | "roles" | "references"\n'
                 '  | "pricing" | "company" | "crm" | "telephony";\n')
    replace_hunk("backend/apps/core/management/commands/seed.py",
                 "        Pages.USERS: FULL, Pages.ROLES: FULL, Pages.REFERENCES: FULL, Pages.PRICING: FULL,\n"
                 "        Pages.COMPANY: dict(can_view=True, can_update=True), Pages.PROCUREMENT: FULL, Pages.MRP: FULL,\n"
                 "        Pages.CRM: FULL, Pages.TELEPHONY: FULL,\n"
                 "    }),\n"
                 '    "Savdo menejeri": ("Loyiha va mijozlar bilan ishlaydi", {\n'
                 "        Pages.DASHBOARD: VIEW, Pages.PROJECTS: EDIT, Pages.CLIENTS: EDIT, Pages.EMPLOYEES: VIEW,\n"
                 "        Pages.PRICING: VIEW, Pages.CRM: EDIT, Pages.TELEPHONY: VIEW,\n")
elif step == "map":
    for f in sys.argv[2:]:
        union(f)
print("ok")

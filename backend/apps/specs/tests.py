from pathlib import Path

import pytest
from django.conf import settings
from django.core.management import call_command

from apps.access.models import Role
from apps.access.services import effective_permissions
from apps.specs import openspec
from apps.specs.models import FixIdea, SpecDocument
from conftest import API, login

SPECS = f"{API}/specs"


def _user_with(api, admin, username, pages: dict[str, list[str]]):
    role = admin.post(f"{API}/access/roles/", {
        "name": f"Rol {username}",
        "permissions": [{"page_key": p, **{f"can_{a}": True for a in actions}} for p, actions in pages.items()],
    }, format="json").json()
    admin.post(f"{API}/users/", {"username": username, "first_name": "Test", "password": "password123",
                                 "role_ids": [role["id"]]}, format="json")
    return login(api, username, "password123")


def _tree(tmp_path: Path, files: dict[str, str]) -> Path:
    root = tmp_path / "openspec"
    for rel, text in files.items():
        p = root / rel
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(text, encoding="utf-8")
    return root


SPEC_OK = "# x\n\n## Requirements\n\n### Requirement: A\nSHALL a.\n\n#### Scenario: a\n- WHEN a\n- THEN b\n"


# --------------------------------------------------------------- the repo's own openspec/


def test_repo_openspec_is_consistent():
    """Archived deltas are merged, removed requirements are gone, every requirement has a scenario,
    every active change has proposal + tasks. Fails with the list of what to fix."""
    problems = openspec.problems(openspec.read_tree(Path(settings.OPENSPEC_DIR)))
    assert problems == [], "\n".join(problems)


def test_problems_name_the_unmerged_change_and_requirement():
    tree = {
        "specs/inv/spec.md": SPEC_OK,
        "changes/archive/2026-01-01-add-b/specs/inv/spec.md":
            "## ADDED Requirements\n\n### Requirement: B\nx\n\n#### Scenario: b\n- WHEN\n- THEN\n",
        "changes/archive/2026-01-02-drop-a/specs/inv/spec.md": "## REMOVED Requirements\n\n### Requirement: A\n",
        "changes/half-done/proposal.md": "# Change",
    }
    assert openspec.problems(tree) == [
        "2026-01-01-add-b: ADDED requirement 'B' is not in specs/inv",
        "2026-01-02-drop-a: REMOVED requirement 'A' is still in specs/inv",
        "changes/half-done: missing tasks.md",
    ]
    no_scenario = {"specs/inv/spec.md": "### Requirement: A\nSHALL a.\n\n## Other\n#### Scenario: not mine\n"}
    assert openspec.problems(no_scenario) == ["specs/inv: requirement 'A' has no scenario"]


# --------------------------------------------------------------- sync


def test_sync_is_idempotent_and_follows_deletes(db, tmp_path):
    root = _tree(tmp_path, {
        "project.md": "# Project context\n",
        "specs/inv/spec.md": SPEC_OK,
        "changes/add-x/proposal.md": "# Change: add-x\n",
        "changes/archive/2026-01-01-add-y/tasks.md": "# Tasks\n",
        "README.md": "ignored",
    })
    call_command("specs_sync", dir=str(root), verbosity=0)
    docs = {d.path: d for d in SpecDocument.objects.all()}
    assert set(docs) == {"project.md", "specs/inv/spec.md", "changes/add-x/proposal.md",
                         "changes/archive/2026-01-01-add-y/tasks.md"}
    assert (docs["specs/inv/spec.md"].kind, docs["specs/inv/spec.md"].ref, docs["specs/inv/spec.md"].requirements) \
        == ("spec", "inv", 1)
    assert docs["changes/archive/2026-01-01-add-y/tasks.md"].ref == "2026-01-01-add-y"

    from apps.specs.services import specs_sync

    assert specs_sync(root) == {"created": 0, "updated": 0, "unchanged": 4, "deleted": 0}
    (root / "changes/add-x/proposal.md").unlink()
    (root / "specs/inv/spec.md").write_text(SPEC_OK + "\n### Requirement: B\nx\n", encoding="utf-8")
    assert specs_sync(root) == {"created": 0, "updated": 1, "unchanged": 2, "deleted": 1}
    assert SpecDocument.objects.get(path="specs/inv/spec.md").requirements == 2


def test_sync_refuses_a_missing_folder_and_keeps_rows(db, tmp_path):
    from django.core.management.base import CommandError

    root = _tree(tmp_path, {"specs/inv/spec.md": SPEC_OK})
    call_command("specs_sync", dir=str(root), verbosity=0)
    with pytest.raises(CommandError):
        call_command("specs_sync", dir=str(tmp_path / "nope"), verbosity=0)
    assert SpecDocument.objects.count() == 1


def test_repo_sync_and_documents_api(api, admin):
    call_command("specs_sync", verbosity=0)
    r = admin.get(f"{SPECS}/documents/", {"kind": "spec", "size": 100})
    assert r.status_code == 200
    items = r.json()["items"]
    assert {"access-control", "procurement"} <= {i["ref"] for i in items}
    assert "content" not in items[0]
    one = admin.get(f"{SPECS}/documents/{items[0]['id']}/").json()
    assert one["content"].startswith("#")
    assert admin.get(f"{SPECS}/documents/check/").json() == {"problems": []}
    assert admin.post(f"{SPECS}/documents/", {}, format="json").status_code in (403, 405)  # read-only

    nobody = _user_with(api, admin, "nospecs", {"dashboard": ["view"]})
    assert nobody.get(f"{SPECS}/documents/").status_code == 403


# --------------------------------------------------------------- roles


def test_admin_and_analyst_roles_get_the_new_pages(api):
    admin_role = Role.objects.get(name="Administrator")
    analyst = Role.objects.get(name="MCP tahlilchi")
    assert analyst.is_system
    by_page = {p.page_key: p for p in analyst.permissions.all()}
    assert by_page["specs"].can_view and by_page["mcp"].can_create and by_page["fix_ideas"].can_create
    assert not by_page["fix_ideas"].can_delete
    assert admin_role.permissions.get(page_key="fix_ideas").can_delete


def test_migration_grants_pages_to_an_existing_administrator(db):
    """A database seeded before this change: the data migration adds the pages and the analyst role."""
    from importlib import import_module

    from django.apps import apps as global_apps

    from apps.access.models import RolePermission

    admin_role = Role.objects.create(name="Administrator", is_system=True)
    RolePermission.objects.create(role=admin_role, page_key="clients", can_view=True)
    import_module("apps.specs.migrations.0002_mcp_pages_and_role").grant(global_apps, None)
    from apps.users.models import User

    u = User.objects.create(username="old-admin")
    u.roles.add(admin_role)
    perms = effective_permissions(u)
    assert perms["specs"] == ["view"] and "create" in perms["mcp"]
    assert Role.objects.filter(name="MCP tahlilchi").exists()


# --------------------------------------------------------------- ideas


def test_idea_flow(api, admin):
    r = admin.post(f"{SPECS}/ideas/", {"title": "KR summasi noto'g'ri", "kind": "fix", "capability": "Procurement",
                                       "problem": "Spec: ... API: ...", "proposal": "- hisobni tuzatish"},
                   format="json")
    assert r.status_code == 201, r.content
    idea = r.json()
    assert (idea["code"], idea["status"], idea["source"], idea["capability"]) == \
        ("TK-0001", "new", "manual", "procurement")
    assert sorted(idea["allowed_statuses"]) == ["accepted", "rejected"]
    url = f"{SPECS}/ideas/{idea['id']}"

    assert admin.post(f"{url}/status/", {"status": "done"}, format="json").status_code == 409
    assert admin.post(f"{url}/status/", {"status": "rejected"}, format="json").status_code == 400  # needs a reason
    assert admin.post(f"{url}/status/", {"status": "accepted"}, format="json").json()["status"] == "accepted"
    assert admin.delete(f"{url}/").status_code == 409  # only new ideas are deleted

    md = admin.get(f"{url}/proposal/").json()["markdown"]
    assert md.startswith("# Change: fix-kr-summasi-noto-g-ri")
    assert "## Why\nSpec: ... API: ..." in md and "## What changes" in md and "## Impact" in md

    assert admin.post(f"{url}/status/", {"status": "done", "comment": "fix-kr-sum"}, format="json").status_code == 200
    assert admin.post(f"{url}/status/", {"status": "new"}, format="json").status_code == 409
    assert admin.patch(f"{url}/", {"title": "boshqa"}, format="json").status_code == 409
    assert FixIdea.objects.get().resolution == "fix-kr-sum"

    hist = admin.get(f"{API}/chatter/", {"model": "specs.fixidea", "res_id": idea["id"]})
    assert hist.status_code == 200


def test_idea_permissions(api, admin):
    viewer = _user_with(api, admin, "ideaview", {"fix_ideas": ["view"]})
    assert viewer.get(f"{SPECS}/ideas/").status_code == 200
    assert viewer.post(f"{SPECS}/ideas/", {"title": "abc", "problem": "x"}, format="json").status_code == 403

import json

import pytest
from django.core.management import call_command
from rest_framework.test import APIClient

from apps.chatter.models import Message
from apps.maintenance.models import Master
from apps.mcp.models import McpToken
from apps.specs.models import FixIdea
from conftest import API, login

MCP = f"{API}/mcp/"


def _user_with(api, admin, username, pages: dict[str, list[str]]):
    role = admin.post(f"{API}/access/roles/", {
        "name": f"Rol {username}",
        "permissions": [{"page_key": p, **{f"can_{a}": True for a in actions}} for p, actions in pages.items()],
    }, format="json").json()
    user = admin.post(f"{API}/users/", {"username": username, "first_name": "Test", "password": "password123",
                                        "role_ids": [role["id"]]}, format="json").json()
    return login(api, username, "password123"), user


def _token(client, scope="read", **extra) -> dict:
    r = client.post(f"{API}/mcp/tokens/", {"name": "Claude Desktop", "scope": scope, **extra}, format="json")
    assert r.status_code == 201, r.content
    return r.json()


class Mcp:
    """A bare MCP client: JSON-RPC over POST with the bearer token."""

    def __init__(self, secret: str, url: str = MCP):
        self.c = APIClient()
        self.secret, self.url, self.n = secret, url, 0

    def raw(self, payload, *, auth=True):
        headers = {"HTTP_AUTHORIZATION": f"Bearer {self.secret}"} if auth else {}
        return self.c.post(self.url, data=json.dumps(payload), content_type="application/json", **headers)

    def rpc(self, method, params=None):
        self.n += 1
        r = self.raw({"jsonrpc": "2.0", "id": self.n, "method": method, "params": params or {}})
        assert r.status_code == 200, r.content
        return r.json()

    def tools(self) -> set[str]:
        return {t["name"] for t in self.rpc("tools/list")["result"]["tools"]}

    def call(self, name, **args) -> tuple[object, bool]:
        res = self.rpc("tools/call", {"name": name, "arguments": args})["result"]
        text = res["content"][0]["text"]
        try:
            return json.loads(text), res["isError"]
        except ValueError:
            return text, res["isError"]


@pytest.fixture
def admin_mcp(admin):
    return Mcp(_token(admin, "write")["token"])


# --------------------------------------------------------------- tokens


def test_secret_shown_once_and_hashed(admin):
    t = _token(admin, expires_days=30)
    assert t["token"].startswith("rmb_") and t["prefix"] == t["token"][:8]
    assert t["endpoint"].endswith("/api/v1/mcp/") and t["connector_url"].endswith(f"/mcp/t/{t['token']}/")
    listed = admin.get(f"{API}/mcp/tokens/").json()["items"]
    assert listed[0]["prefix"] == t["prefix"] and "token" not in listed[0]
    row = McpToken.objects.get()
    assert t["token"] not in row.key_hash and row.expires_at is not None


def test_revoked_token_and_others_tokens(api, admin):
    t = _token(admin)
    other, _ = _user_with(api, admin, "other", {"mcp": ["view", "create", "delete"]})
    assert other.delete(f"{API}/mcp/tokens/{t['id']}/").status_code == 404  # not visible to others
    assert admin.delete(f"{API}/mcp/tokens/{t['id']}/").status_code == 204
    assert Mcp(t["token"]).raw({"jsonrpc": "2.0", "id": 1, "method": "ping"}).status_code == 401


def test_password_change_kills_tokens(api, admin):
    client, user = _user_with(api, admin, "pw", {"mcp": ["view", "create"]})
    m = Mcp(_token(client)["token"])
    assert m.rpc("ping")["result"] == {}
    admin.patch(f"{API}/users/{user['id']}/", {"password": "newpassword123"}, format="json")
    assert m.raw({"jsonrpc": "2.0", "id": 1, "method": "ping"}).status_code == 401


def test_without_mcp_page_no_tokens_no_endpoint(api, admin):
    client, user = _user_with(api, admin, "nomcp", {"clients": ["view"]})
    assert client.post(f"{API}/mcp/tokens/", {"name": "x"}, format="json").status_code == 403


# --------------------------------------------------------------- protocol


def test_protocol_basics(admin):
    m = Mcp(_token(admin)["token"])
    r = m.raw({"jsonrpc": "2.0", "id": 1, "method": "ping"}, auth=False)
    assert r.status_code == 401 and r["WWW-Authenticate"].startswith("Bearer")

    init = m.rpc("initialize", {"protocolVersion": "2025-06-18", "capabilities": {},
                                "clientInfo": {"name": "test", "version": "1"}})["result"]
    assert init["protocolVersion"] == "2025-06-18"
    assert init["serverInfo"]["name"] == "rombo-erp" and "tools" in init["capabilities"]
    assert "Loyiha" in init["instructions"]
    assert m.rpc("initialize", {"protocolVersion": "1999-01-01"})["result"]["protocolVersion"] == "2025-06-18"

    assert m.raw({"jsonrpc": "2.0", "method": "notifications/initialized"}).status_code == 202
    assert m.c.get(MCP, HTTP_AUTHORIZATION=f"Bearer {m.secret}").status_code == 405
    assert m.rpc("nope/nope")["error"]["code"] == -32601
    bad = m.c.post(MCP, data="{", content_type="application/json", HTTP_AUTHORIZATION=f"Bearer {m.secret}")
    assert bad.status_code == 400 and bad.json()["error"]["code"] == -32700

    batch = m.raw([{"jsonrpc": "2.0", "id": 7, "method": "ping"}, {"jsonrpc": "2.0", "method": "notifications/x"}])
    assert batch.json() == [{"jsonrpc": "2.0", "id": 7, "result": {}}]

    # no trailing slash, and the URL-token form used by claude.ai connectors
    assert Mcp(m.secret, url=f"{API}/mcp").rpc("ping")["result"] == {}
    url_form = Mcp("", url=f"{API}/mcp/t/{m.secret}/")
    assert url_form.raw({"jsonrpc": "2.0", "id": 1, "method": "ping"}, auth=False).status_code == 200


def test_read_token_cannot_write(admin):
    m = Mcp(_token(admin, "read")["token"])
    assert "api_write" not in m.tools() and {"api_get", "whoami", "spec_read", "idea_create"} <= m.tools()
    out, err = m.call("api_write", method="POST", path="maintenance/masters/", body={"name": "Ali", "phone": "+998901112233"})
    assert err and Master.objects.count() == 0


# --------------------------------------------------------------- acting as the user


def test_write_goes_through_the_real_api_as_the_user(admin_mcp):
    out, err = admin_mcp.call("api_write", method="POST", path="/api/v1/maintenance/masters",
                              body={"name": "Ali Usta", "phone": "+998 90 111 22 33"})
    assert not err, out
    assert out["status"] == 201 and out["data"]["code"] == "US-0001"
    master = Master.objects.get()
    assert master.created_by.username == "admin"
    assert Message.objects.filter(model="maintenance.master", res_id=master.pk).exclude(author="").exists()

    out, err = admin_mcp.call("api_get", path="maintenance/masters/", params={"q": "Ali"})
    assert not err and out["data"]["total"] == 1

    out, err = admin_mcp.call("api_write", method="POST", path="maintenance/masters/", body={"name": "x"})
    assert err and out["status"] == 400  # validation errors come back as they are


def test_permissions_are_the_users(api, admin):
    client, _ = _user_with(api, admin, "viewer", {"mcp": ["view", "create"], "service_masters": ["view"]})
    m = Mcp(_token(client, "write")["token"])
    out, err = m.call("api_write", method="POST", path="maintenance/masters/", body={"name": "Ali", "phone": "+998901112233"})
    assert err and out["status"] == 403
    assert Master.objects.count() == 0
    out, err = m.call("api_get", path="clients/")
    assert err and out["status"] == 403

    resources, _ = m.call("list_resources")
    pages = {r["page"] for r in resources["resources"]}
    assert pages == {"service_masters"}
    eps = resources["resources"][0]["endpoints"]
    assert {e["method"] for e in eps} == {"GET"}  # can only view

    tools = m.tools()
    assert "spec_read" not in tools and "idea_create" not in tools  # no specs / fix_ideas pages
    assert m.call("spec_read", capability="mcp")[1] is True


@pytest.mark.parametrize("path", ["auth/me/", "mcp/tokens/", "schema/", "maintenance/bot/client/webhook/",
                                  "maintenance/app/client/me/", "telephony/recordings/google/callback/", "../etc"])
def test_closed_paths(admin_mcp, path):
    out, err = admin_mcp.call("api_get", path=path)
    assert err, out


def test_chatter_is_reachable(admin_mcp):
    admin_mcp.call("api_write", method="POST", path="maintenance/masters/", body={"name": "Ali", "phone": "+998901112233"})
    mid = Master.objects.get().pk
    out, err = admin_mcp.call("api_get", path="chatter/", params={"model": "maintenance.master", "res_id": mid})
    assert not err, out


def test_whoami_and_describe(admin_mcp):
    me, _ = admin_mcp.call("whoami")
    assert me["user"]["username"] == "admin" and me["token"]["scope"] == "write"
    assert "view" in me["permissions"]["clients"]["actions"]
    desc, err = admin_mcp.call("describe_endpoint", path="maintenance/masters/", method="POST")
    assert not err, desc
    assert "name" in desc["request_body"]["properties"]


# --------------------------------------------------------------- specs and ideas


def test_spec_tools_and_idea_from_claude(admin_mcp):
    call_command("specs_sync", verbosity=0)
    listed, _ = admin_mcp.call("specs_list")
    assert any(c["capability"] == "procurement" for c in listed["capabilities"])
    spec, err = admin_mcp.call("spec_read", capability="access-control")
    assert not err and "### Requirement:" in spec["content"]
    found, _ = admin_mcp.call("specs_search", query="token_version")
    assert any(r["ref"] == "access-control" for r in found["results"])
    ch, err = admin_mcp.call("change_read", change="add-mrp")  # archived, by bare id
    assert not err and ch["kind"] == "archived"
    check, _ = admin_mcp.call("specs_check")
    assert check == {"in_sync": True, "problems": []}

    out, err = admin_mcp.call("idea_create", title="Ombor qoldig'i manfiy", kind="fix", capability="nope",
                              problem="x")
    assert err  # unknown capability
    out, err = admin_mcp.call("idea_create", title="Ombor qoldig'i manfiy", kind="fix", capability="inventory",
                              priority="high", problem="Spec: qoldiq ≥ 0. API: -3.")
    assert not err, out
    idea = FixIdea.objects.get()
    assert (idea.code, idea.source, idea.created_by.username) == ("TK-0001", "mcp", "admin")
    got, _ = admin_mcp.call("idea_get", idea="tk-0001")
    assert got["problem"].startswith("Spec:")
    assert admin_mcp.call("ideas_list", status="new")[0]["total"] == 1

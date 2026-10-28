import pytest
from django.core.management import call_command
from rest_framework.test import APIClient

API = "/api/v1"
TEST_ENCRYPTION_KEY = "q0Bxh0ZcRZ2h0kq3m6m9tC3a0Yb4uV7wX2zA5cD8eF0="  # tests only (pytest runs with DEBUG=False)


@pytest.fixture(autouse=True)
def _encryption_key(settings):
    from apps.core import crypto

    if not settings.FIELD_ENCRYPTION_KEY:
        settings.FIELD_ENCRYPTION_KEY = TEST_ENCRYPTION_KEY
    crypto._fernet.cache_clear()
    yield
    crypto._fernet.cache_clear()


@pytest.fixture
def api(db) -> APIClient:
    call_command("seed", verbosity=0)
    return APIClient()


def login(api: APIClient, username: str, password: str) -> APIClient:
    r = api.post(f"{API}/auth/login/", {"username": username, "password": password}, format="json")
    assert r.status_code == 200, r.content
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {r.json()['access']}")
    return client


@pytest.fixture
def admin(api) -> APIClient:
    return login(api, "admin", "admin12345")


class FakeHttp:
    """Provider HTTP in tests: route (method, url prefix) → handler or response; every request is recorded.
    Nothing reaches the network: an unrouted request fails the test."""

    def __init__(self):
        self.routes: list[tuple[str, str, object]] = []
        self.requests = []

    def on(self, method: str, url: str, reply):
        self.routes.insert(0, (method.upper(), url, reply))
        return self

    def handler(self, request):
        import httpx

        self.requests.append(request)
        for method, url, reply in self.routes:
            if request.method == method and str(request.url).startswith(url):
                out = reply(request) if callable(reply) else reply
                if isinstance(out, httpx.Response):
                    return out
                status, body = out if isinstance(out, tuple) else (200, out)
                if isinstance(body, bytes):
                    return httpx.Response(status, content=body)
                return httpx.Response(status, json=body)
        raise AssertionError(f"unexpected request {request.method} {request.url}")


@pytest.fixture
def fake_http(monkeypatch) -> FakeHttp:
    import httpx

    from apps.crm.providers import http

    fake = FakeHttp()
    monkeypatch.setattr(http, "TRANSPORT", httpx.MockTransport(fake.handler))
    return fake


@pytest.fixture(autouse=True)
def _no_network(monkeypatch):
    """A provider call without fake_http must fail loudly, never go out."""
    import httpx

    from apps.crm.providers import http

    def refuse(request):
        raise AssertionError(f"network call in a test: {request.method} {request.url}")

    monkeypatch.setattr(http, "TRANSPORT", httpx.MockTransport(refuse))

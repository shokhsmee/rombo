import pytest
from django.core.management import call_command
from rest_framework.test import APIClient

API = "/api/v1"


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

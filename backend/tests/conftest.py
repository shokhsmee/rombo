import os
import tempfile

# Must be set before `app` is imported (settings are read once).
_db_file = os.path.join(tempfile.mkdtemp(), "test.db")
os.environ["ROMBO_DATABASE_URL"] = f"sqlite:///{_db_file}"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.cli import seed  # noqa: E402
from app.core.database import engine  # noqa: E402
from app.main import app  # noqa: E402
from app.shared.models import Base  # noqa: E402

API = "/api/v1"


@pytest.fixture(scope="session", autouse=True)
def _schema():
    Base.metadata.create_all(engine)
    seed()
    yield
    engine.dispose()


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


def login(client: TestClient, username: str, password: str) -> dict:
    r = client.post(f"{API}/auth/login", data={"username": username, "password": password})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.fixture
def admin(client) -> dict:
    return login(client, "admin", "admin12345")

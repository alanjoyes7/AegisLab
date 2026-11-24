import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool
from app.core import Base, get_db
from app.main import app


@pytest.fixture()
def client():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)

    def override_db():
        with Session(engine) as session:
            yield session

    app.dependency_overrides[get_db] = override_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
    engine.dispose()


def test_project_roundtrip(client):
    created = client.post("/api/v1/projects", json={"name": "  Local lab  "})
    assert created.status_code == 201
    project = created.json()
    assert project["name"] == "Local lab"
    assert project["environment"] == "local_lab"
    assert client.get("/api/v1/projects").json()[0]["id"] == project["id"]
    assert client.get(f'/api/v1/projects/{project["id"]}').status_code == 200
    result = client.patch(f'/api/v1/projects/{project["id"]}', json={"name": "Updated lab"})
    assert result.json()["name"] == "Updated lab"


@pytest.mark.parametrize("body", [{"name": ""}, {"name": "   "}, {"name": "a" * 81}, {"name": "x", "environment": "internet"}, {"name": "x", "execute": "whoami"}])
def test_invalid_projects(client, body):
    assert client.post("/api/v1/projects", json=body).status_code == 422


def test_live_scanning_is_disabled(client):
    response = client.post("/api/v1/projects/00000000-0000-0000-0000-000000000001/scans", json={"target": "https://google.com"})
    assert response.status_code == 409
    assert "disabled" in response.json()["detail"]


def test_unknown_project(client):
    assert client.get("/api/v1/projects/00000000-0000-0000-0000-000000000001").status_code == 404


def test_dns_rebinding_host_blocked(client):
    assert client.get("/api/v1/projects", headers={"host": "attacker.example"}).status_code == 400


def test_health_has_real_dependency_status(client):
    response = client.get("/health")
    assert response.status_code in (200, 503)
    assert response.json()["services"]["database"] == "healthy"
    assert response.json()["scanner"] == "disabled"

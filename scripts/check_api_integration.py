"""Exercise real PostgreSQL, Redis, and API persistence after migrations."""
import sys
from pathlib import Path
from uuid import uuid4
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "apps" / "api"))
from fastapi.testclient import TestClient  # noqa: E402
from app.main import app  # noqa: E402
from app.core import SessionLocal  # noqa: E402
from app.models import Project  # noqa: E402

with TestClient(app) as client:
    health = client.get("/health")
    assert health.status_code == 200, health.text
    assert health.json()["services"] == {"database": "healthy", "redis": "healthy"}
    response = client.post("/api/v1/projects", json={"name": f"Integration test {uuid4()}"})
    assert response.status_code == 201, response.text
    project_id = response.json()["id"]
    assert client.get(f"/api/v1/projects/{project_id}").status_code == 200
    # Remove only the isolated record created by this test.
    from uuid import UUID
    with SessionLocal() as db:
        record = db.get(Project, UUID(project_id))
        assert record is not None
        db.delete(record)
        db.commit()
print("PASS: PostgreSQL migration, API project persistence, Redis health, and test-record cleanup")

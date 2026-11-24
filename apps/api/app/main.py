from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID
import redis
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import select, text
from sqlalchemy.orm import Session
from .core import get_db, settings
from .models import Project

app = FastAPI(title="AegisLab Local API", version="0.1.0", description="Local-only API foundation. Hosted evidence workspaces use browser storage. Live scanning is disabled.")
app.add_middleware(TrustedHostMiddleware, allowed_hosts=["localhost", "127.0.0.1", "[::1]", "api", "testserver"])
DB = Annotated[Session, Depends(get_db)]


class ProjectCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(min_length=1, max_length=80)
    description: str = Field(default="", max_length=2000)
    environment: Literal["local_lab", "development", "staging_evidence", "production_evidence"] = "local_lab"

    @field_validator("name")
    @classmethod
    def trim_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Project name cannot be blank")
        return value


class ProjectRead(ProjectCreate):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    status: str
    created_at: datetime
    updated_at: datetime


@app.get("/health")
@app.get("/api/v1/health")
def health(db: DB):
    checks = {"database": "unavailable", "redis": "unavailable"}
    try:
        db.execute(text("SELECT 1"))
        checks["database"] = "healthy"
    except Exception:
        db.rollback()
    try:
        with redis.Redis.from_url(settings.redis_url, socket_connect_timeout=1, socket_timeout=1) as client:
            client.ping()
            checks["redis"] = "healthy"
    except redis.RedisError:
        pass
    healthy = all(value == "healthy" for value in checks.values())
    return JSONResponse({"status": "healthy" if healthy else "degraded", "version": "0.1.0", "services": checks, "scanner": "disabled", "mode": "local_lab_only"}, status_code=200 if healthy else 503)


@app.get("/api/v1/projects", response_model=list[ProjectRead])
def projects(db: DB):
    return db.scalars(select(Project).order_by(Project.created_at.desc())).all()


@app.post("/api/v1/projects", response_model=ProjectRead, status_code=201)
def create_project(body: ProjectCreate, db: DB):
    project = Project(**body.model_dump())
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


@app.get("/api/v1/projects/{project_id}", response_model=ProjectRead)
def get_project(project_id: UUID, db: DB):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    return project


@app.patch("/api/v1/projects/{project_id}", response_model=ProjectRead)
def update_project(project_id: UUID, body: ProjectCreate, db: DB):
    project = get_project(project_id, db)
    for key, value in body.model_dump().items():
        setattr(project, key, value)
    db.commit()
    db.refresh(project)
    return project


@app.post("/api/v1/projects/{project_id}/scans")
def disabled_scan(project_id: UUID):
    raise HTTPException(409, "Live scanner execution is disabled in this release. Import a ZAP report in the evidence workspace. No target request was sent.")

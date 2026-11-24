# Release status — 2026-11-24

## Completed

- Responsive React/TypeScript evidence workspace with dark/light themes.
- Browser-persistent projects, assets, scope rules, findings, remediation, and local audit records.
- Clearly labeled synthetic lab, deterministic fixture replay, and separate real-evidence projects.
- ZAP JSON parsing, confidence normalization, safe text rendering, pattern redaction, exact-key deduplication, redacted snapshot hashes, and immutable import history.
- Explainable priority calculation with visible factors; inferred shared-origin graph with link provenance and underlying data.
- JSON/CSV/print reports, backup export/validated restore, and preservation of unreadable local data for recovery.
- Local Python 3.13 / FastAPI / SQLAlchemy / Alembic API foundation with project CRUD and real health checks.
- PostgreSQL 17 and Redis 7 running in Docker, with published ports bound to loopback.
- Non-root API container, dropped capabilities, no Docker socket, Host allowlist, and disabled live scan endpoint.
- GitHub CI for formatting, TypeScript build, frontend/domain tests, Ruff, mypy, migrations, API tests, and PostgreSQL/Redis integration.

## Verified in this workspace

| Check | Result |
| --- | --- |
| Frontend and domain tests | 58 passed |
| TypeScript and Vite production build | Passed |
| Prettier source formatting | Passed |
| npm dependency audit | 0 vulnerabilities reported |
| Python API tests | 10 passed on Python 3.13 |
| Ruff | Passed |
| mypy | Passed, 4 source files |
| Alembic initial migration on PostgreSQL | Applied successfully |
| Real API create/read and database persistence | Passed; isolated test record removed |
| Redis dependency check | Healthy |
| GET /health | HTTP 200; PostgreSQL and Redis healthy; scanner disabled |

The environment's HTTPS proxy certificate was mounted as a build secret for the local Docker build. It was not committed or baked into the image. Disposable task build cache was removed after the constrained workspace ran out of disk. The normal Dockerfile remains suitable for standard Docker environments.

## Verification limits and release boundary

Browser visual/mobile QA could not run: `sites-preview` timed out waiting for relay readiness and the browser tool returned “the gaas-browser node_repl sandbox cannot be disabled.” Component tests exercise actual React workflows in jsdom, including ZAP file import, backup restore, scope preview, project creation, remediation persistence, and local API health display. They do not replace real-browser visual or end-to-end validation.

No live scanner traffic was generated. Live ZAP/Celery orchestration, DNS and redirect enforcement in a worker, external authorization workflows, authenticated shared persistence, raw artifact storage, automated fix verification, PCAP analysis, and Nmap are not implemented. The research experiment has not been run; no precision, recall, or security-improvement claims are made.

The deployed workspace uses this browser's local storage. The local API database is separate and is not deployed to Sites. No production-hardening or full seven-phase platform completion is claimed. No release tag is created while browser QA and live-lab validation remain outstanding.

## Next milestone

Build authenticated durable application storage and an isolated passive ZAP worker; enforce authorization and scope again in the worker, test DNS/redirect escape and lifecycle recovery, and verify vulnerable/patched fixtures with explicit coverage before exposing a scan-launch control.

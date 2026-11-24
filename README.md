# AegisLab

A local-first security evidence and remediation workspace for authorized environments.

## Delivered release

The hosted app is an operational **browser-local evidence workspace**. It supports project and asset management, explicit local scope preview, real OWASP ZAP JSON imports, redaction, deduplication, explainable priority, relationship exploration, remediation tracking, audit history, and JSON/CSV/print reports. It starts with a clearly labeled synthetic demo. Create a new project to import real evidence.

**Live scanning and automatic fix verification are disabled.** There is no hidden scanner or simulated live progress. The included local API is a foundation with project CRUD, migrations, and dependency health; its records are separate from the browser workspace.

## Run the web app

Requirements: Node.js 22.12+ and npm.

```sh
npm ci
npm run dev
```

Open the Vite URL printed in the terminal. Use **Settings → Export full backup** to preserve your browser data; **Restore a backup** validates and restores it after explicit replacement confirmation. Browser data does not sync between devices, origins, or user accounts. Clearing site data removes it.

```sh
npm test
npm run build
npm run format:check
```

The production static build is `dist/`. The tracked `.openai/hosting.json` associates this checkout with its deployed Site. Forks must remove that project identity before registering their own Site.

## Run the local API foundation

Requirements: Docker Engine with Compose v2. Ports 5432, 6379, and 8090 must be available locally.

```sh
cp .env.example .env
docker compose up -d --build
curl http://127.0.0.1:8090/health
```

The API container applies Alembic migrations before starting. Expected health response: `status: healthy`, PostgreSQL and Redis `healthy`, scanner `disabled`. OpenAPI: <http://127.0.0.1:8090/docs>. Start Vite separately and use **Settings → Check local API** to inspect real dependency health through `/api/v1/health`.

```sh
docker compose exec api python -m pytest -q
docker compose exec api ruff check --no-cache app tests alembic
docker compose exec api mypy app --ignore-missing-imports --cache-dir=/tmp/aegislab-mypy
docker compose down
```

`docker compose down` preserves database volumes. Do not expose this unauthenticated development API, Redis, or PostgreSQL publicly. The example database password is only for an isolated local development environment.

## Workflow

1. Explore **Juice Shop Lab**, which contains only synthetic fixtures.
2. Create your own project. Register assets and review criticality and scope.
3. Use **New assessment → Import a ZAP report** to process a JSON export up to 5 MB. Imported assets are unapproved by default; an import never sends traffic to its targets.
4. Review severity, confidence, evidence, and contextual priority. Confidence is the normalized ZAP confidence code, not an exploitation probability.
5. Record owner, remediation status, and rationale. “Fixed” is unavailable without a verified comparison engine.
6. Export JSON for full evidence context, CSV for triage, or print to PDF for a review summary.

Reports remain in the browser. Common credential, session, token, and email patterns are redacted, but review every export for sensitive details. Original raw scanner files remain your responsibility; AegisLab retains a redacted normalized snapshot and hashes that snapshot.

## Priority and relationships

Formula v1: `min(100, round(severity baseline + 3 × asset criticality + 5 × confidence))`.

Severity baselines: critical 85, high 65, medium 40, low 15, informational 0. Asset criticality is 1–5; confidence is 0–1. This is **not CVSS**. No CVSS scores are fabricated. The UI shows every factor.

Graph edges infer a shared canonical asset origin. They establish context, not an exploitable attack chain. Click a link for its rule, source, and confidence. The data table exposes the same relationships.

## Layout

- `apps/web/src`: interface, domain logic, fixtures, unit and component tests.
- `apps/api`: local FastAPI app, SQLAlchemy models, Alembic migration, API tests.
- `infrastructure/docker`: restricted API container definition.
- `docker-compose.yml`: PostgreSQL, Redis, and local API.
- `docs/decisions/001-release-boundary.md`: architecture, scope, and security boundaries.
- `docs/STATUS.md`: verified checks and outstanding limitations.
- `.github/workflows/ci.yml`: frontend and API validation.

See the release boundary document before extending scanner functionality. This is an evidence-workspace release, not the entire seven-phase research platform and not a production-hardened scanning service.

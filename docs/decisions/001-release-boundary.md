# ADR 001: deploy an evidence workspace; isolate scanner execution

The supplied brief describes a multi-phase platform and ends with a Week 1 foundation. The user explicitly requested a deployed application and allowed features to change. This release therefore delivers a complete browser-based evidence workflow plus a local Python API foundation, rather than claiming a hosted scanner can reach an operator's local Docker network.

## Hosted release

React + TypeScript + Vite, Lucide, and React Flow. Hash navigation keeps static hosting portable. Plain React state and pure domain functions are sufficient for a single-user browser store; Router, Zustand, TanStack Query, and Recharts are omitted because there is no remote application state or need for them yet. All charts expose their counts or a data table. Google Fonts are optional presentation resources; reports never leave the browser during import.

The workspace supports projects, inventory, local scope preview, ZAP JSON report import, redacted evidence snapshots with SHA-256, deduplication, contextual priority, inferred shared-origin relationships, remediation, audit events, JSON/CSV/print exports, and backup export/restore. Demo records are explicitly synthetic. Browser storage is not a restricted artifact store, a shared database, or a tamper-proof audit log.

The original report is not retained. Keep it in an operator-controlled restricted artifact store. A redacted normalized snapshot is retained; its hash covers that snapshot, not the original raw file. Pattern redaction is best effort and needs human review before sharing.

## Local foundation

FastAPI, SQLAlchemy, Alembic, PostgreSQL 17, Redis 7, Python 3.13, and Docker Compose. Project CRUD and real dependency health are implemented. Vite proxies `/api` to the local API for the Settings health check. The API project store and the hosted browser store are intentionally separate in v0.1.0. There is no browser-to-database synchronization or user authentication yet.

The API is bound to loopback, enforces a Host allowlist, and must not be publicly exposed. No Docker socket is mounted. The API runs without root and drops Linux capabilities. Redis and PostgreSQL publish only on loopback. Single-user loopback is a development boundary, not a production authorization system.

## Scanner boundary

No Celery worker or executable scanner is claimed. Live scan API requests return 409. The UI cannot launch live scans. Public-domain approval, active external testing, arbitrary commands, PCAP collection, and attack execution are absent. Scope preview only checks stored rules; it does not claim DNS or redirect validation. Those must be independently implemented and tested in a future isolated worker before enabling scanning.

No finding can be manually marked fixed. Absence from an imported report does not prove verification coverage. Reappearance of an already verified record is modeled as regression, but the hosted UI cannot create a verified-fixed record. Explicit review states require rationale.

## Next release gate

Implement authenticated persistence, a restricted raw artifact store, Celery lifecycle recovery, an isolated ZAP baseline worker with DNS/redirect/endpoint revalidation, and vulnerable/patched coverage-aware verification. Then conduct a security review and live local-lab end-to-end test before enabling actual scanner traffic.

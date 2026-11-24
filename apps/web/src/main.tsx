import React, { useState, useEffect, useRef, useMemo } from "react";
import { createRoot } from "react-dom/client";
import {
  Shield,
  LayoutDashboard,
  FolderKanban,
  Layers,
  Radar,
  Bug,
  GitBranch,
  Wrench,
  FileText,
  Settings,
  ChevronDown,
  ChevronRight,
  ArrowUpRight,
  ArrowRight,
  Plus,
  Search,
  Bell,
  HelpCircle,
  Upload,
  Download,
  X,
  Check,
  CheckCircle2,
  Clock,
  Circle,
  ShieldCheck,
  FlaskConical,
  Activity,
  ExternalLink,
  Moon,
  Sun,
  Menu,
  Filter,
  MoreHorizontal,
  AlertTriangle,
  Database,
  LockKeyhole,
  Terminal,
  RefreshCw,
  Eye,
  Copy,
} from "lucide-react";
import {
  ReactFlow,
  Background,
  Controls,
  MarkerType,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  type Workspace,
  type Finding,
  type Asset,
  type Project,
  type FindingStatus,
  severities,
  statuses,
  label,
  uid,
  priority,
  isOpen,
  scopePreview,
  safeURL,
  isLocalHost,
  redact,
  parseZap,
  mergeFindings,
  hashText,
  demoWorkspace,
  emptyWorkspace,
  validateBackup,
} from "./domain";
import "./style.css";
const KEY = "aegislab.workspace.v1";
const nav = [
  { id: "overview", name: "Overview", icon: LayoutDashboard },
  { id: "projects", name: "Projects", icon: FolderKanban },
  { id: "assets", name: "Assets & scope", icon: Layers },
  { id: "scans", name: "Assessments", icon: Radar },
  { id: "findings", name: "Findings", icon: Bug },
  { id: "paths", name: "Relationships", icon: GitBranch },
  { id: "remediation", name: "Remediation", icon: Wrench },
  { id: "reports", name: "Reports", icon: FileText },
];
function download(name: string, content: string, type = "application/json") {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([content], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: string;
}) {
  return (
    <span className={"badge " + tone}>
      <i />
      {children}
    </span>
  );
}
function Empty({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty">
      <Shield size={30} />
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}
function Modal({
  title,
  children,
  close,
  wide = false,
}: {
  title: string;
  children: React.ReactNode;
  close: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
    const dialog = ref.current;
    const onCancel = (e: Event) => {
      e.preventDefault();
      close();
    };
    dialog?.addEventListener("cancel", onCancel);
    return () => dialog?.removeEventListener("cancel", onCancel);
  }, [close]);
  return (
    <dialog ref={ref} className={wide ? "modal wide" : "modal"}>
      <header>
        <h2>{title}</h2>
        <button
          className="icon-button"
          aria-label="Close dialog"
          onClick={close}
        >
          <X size={20} />
        </button>
      </header>
      {children}
    </dialog>
  );
}
export function App() {
  const [storageError, setStorageError] = useState("");
  const [initial] = useState<{ data: Workspace; recovery: string | null }>(
    () => {
      let saved: string | null = null;
      try {
        saved = localStorage.getItem(KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (validateBackup(parsed)) return { data: parsed, recovery: null };
        } else return { data: demoWorkspace(), recovery: null };
      } catch {}
      return { data: demoWorkspace(), recovery: saved };
    },
  );
  const [w, setW] = useState<Workspace>(initial.data);
  const [recovery, setRecovery] = useState(initial.recovery);
  const [page, setPage] = useState(location.hash.slice(1) || "overview");
  const [projectId, setProjectId] = useState(w.projects[0]?.id || "");
  const [modal, setModal] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [severity, setSeverity] = useState("all");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("priority");
  const [tablePage, setTablePage] = useState(1);
  const [toast, setToast] = useState("");
  const [mobile, setMobile] = useState(false);
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem("aegislab.theme") || "dark";
    } catch {
      return "dark";
    }
  });
  useEffect(() => {
    if (recovery) {
      setStorageError(
        "Saved data could not be loaded. The original is preserved. Download it for recovery, then restore a valid backup in Settings. Current changes are not being saved.",
      );
      return;
    }
    try {
      localStorage.setItem(KEY, JSON.stringify(w));
      setStorageError("");
    } catch {
      setStorageError(
        "Browser storage is full or unavailable. Export a backup now; changes may not survive a reload.",
      );
    }
  }, [w, recovery]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("aegislab.theme", theme);
    } catch {}
  }, [theme]);
  useEffect(() => {
    const fn = () => {
      setPage(location.hash.slice(1) || "overview");
      setMobile(false);
      setSearch("");
      setTablePage(1);
    };
    window.addEventListener("hashchange", fn);
    return () => window.removeEventListener("hashchange", fn);
  }, []);
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(""), 5000);
      return () => clearTimeout(t);
    }
  }, [toast]);
  useEffect(() => setTablePage(1), [search, severity, status, projectId]);
  const project = w.projects.find((p) => p.id === projectId);
  const findings = w.findings.filter((f) => f.projectId === projectId);
  const assets = w.assets.filter((a) => a.projectId === projectId);
  const scans = w.scans.filter((s) => s.projectId === projectId);
  const open = findings.filter(isOpen);
  const filtered = findings
    .filter(
      (f) =>
        (severity === "all" || f.severity === severity) &&
        (status === "all" || f.status === status) &&
        `${f.title} ${f.endpoint} ${f.check}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    )
    .sort((a, b) =>
      sort === "title"
        ? a.title.localeCompare(b.title)
        : sort === "recent"
          ? b.lastSeen.localeCompare(a.lastSeen)
          : priority(b) - priority(a),
    );
  const current = findings.find((f) => f.id === selected);
  const risk = open.length
    ? Math.round(open.reduce((v, f) => v + priority(f), 0) / open.length)
    : 0;
  const go = (p: string) => {
    location.hash = p;
  };
  const notify = (s: string) => setToast(s);
  function event(
    state: Workspace,
    action: string,
    detail: string,
    pid = projectId,
  ) {
    return {
      ...state,
      audit: [
        {
          id: uid(),
          projectId: pid,
          time: new Date().toISOString(),
          action,
          detail,
        },
        ...state.audit,
      ],
    };
  }
  function updateFinding(id: string, patch: Partial<Finding>) {
    setW((prev) =>
      event(
        {
          ...prev,
          findings: prev.findings.map((f) =>
            f.id === id ? { ...f, ...patch } : f,
          ),
        },
        "Remediation updated",
        `${prev.findings.find((f) => f.id === id)?.title}: ${patch.status ? label(patch.status) : "assignment or notes updated"}`,
      ),
    );
    notify("Remediation saved");
  }
  const report = () => ({
    schema: "aegislab.report.v1",
    generatedAt: new Date().toISOString(),
    project,
    limitations: [
      "No active tests are performed by the hosted application.",
      "Scanner observations require analyst validation.",
      "Relationship links are inferred, not proof of exploitability.",
      "Absence from a later report does not establish a verified fix.",
    ],
    priorityFormula:
      "v1: min(100, severity baseline + 3 × criticality (1–5) + 5 × confidence (0–1)); baselines: critical 85, high 65, medium 40, low 15, info 0. Not CVSS.",
    assets,
    findings: findings.map((f) => ({ ...f, contextualPriority: priority(f) })),
    assessments: scans.map(({ raw, ...s }) => s),
  });
  function exportReport(format: string) {
    if (format === "json")
      download("aegislab-report.json", JSON.stringify(report(), null, 2));
    else if (format === "csv") {
      const keys = [
        "title",
        "severity",
        "status",
        "asset",
        "endpoint",
        "source",
        "synthetic",
        "owner",
      ];
      const cell = (v: unknown) => {
        let text = String(v ?? "");
        if (/^[=+@\-\t\r]/.test(text)) text = "'" + text;
        return '"' + text.replaceAll('"', '""') + '"';
      };
      download(
        "aegislab-findings.csv",
        [
          keys.join(","),
          ...findings.map((f) =>
            keys.map((k) => cell(f[k as keyof Finding])).join(","),
          ),
        ].join("\r\n"),
        "text/csv",
      );
    }
    notify("Report exported");
  }
  async function importZap(file: File) {
    if (file.size > 5 * 1024 * 1024)
      throw Error("Reports must be 5 MB or smaller.");
    if (!project) throw Error("Create or select a project first.");
    if (project.synthetic)
      throw Error(
        "Create a real project first to keep imported evidence separate from synthetic data.",
      );
    const original = await file.text();
    let parsed;
    try {
      parsed = JSON.parse(original);
    } catch {
      throw Error(
        "This file is not valid JSON. Export a ZAP JSON report and try again.",
      );
    }
    const scanId = uid();
    const result = parseZap(parsed, projectId, scanId);
    result.findings = result.findings.map((f) => ({
      ...f,
      criticality:
        assets.find((a) => new URL(a.url).origin === f.asset)?.criticality ?? 3,
    }));
    const raw = JSON.stringify(
      {
        source: "OWASP ZAP",
        version: result.version,
        sites: result.assets.map((a) => a.url),
        observations: result.findings.map((f) => ({
          check: f.check,
          endpoint: f.endpoint,
          evidence: f.evidence,
          description: f.description,
          solution: f.solution,
        })),
      },
      null,
      2,
    );
    const hash = await hashText(raw);
    setW((prev) =>
      event(
        {
          ...prev,
          assets: [
            ...prev.assets,
            ...result.assets.filter(
              (a) =>
                !prev.assets.some(
                  (e) => e.projectId === projectId && e.url === a.url,
                ),
            ),
          ],
          findings: mergeFindings(prev.findings, result.findings),
          scans: [
            {
              id: scanId,
              projectId,
              date: new Date().toISOString(),
              name: file.name,
              source: "OWASP ZAP " + result.version,
              status: "imported",
              findings: result.findings.length,
              hash,
              synthetic: false,
              raw,
            },
            ...prev.scans,
          ],
        },
        "ZAP report imported",
        `${result.findings.length} normalized observations. Redacted evidence SHA-256: ${hash}`,
      ),
    );
    setModal("");
    notify(`${result.findings.length} observations imported and deduplicated`);
    go("findings");
  }
  function replay() {
    const base = demoWorkspace();
    const scanId = uid();
    const now = new Date().toISOString();
    const newFindings = base.findings.map((f) => ({
      ...f,
      id: uid(),
      projectId,
      scanId,
      firstSeen: now,
      lastSeen: now,
    }));
    setW((prev) =>
      event(
        {
          ...prev,
          findings: mergeFindings(prev.findings, newFindings),
          scans: [
            {
              ...base.scans[0],
              id: scanId,
              projectId,
              date: now,
              name: "Deterministic fixture replay",
            },
            ...prev.scans,
          ],
        },
        "Fixture replayed",
        "12 synthetic observations loaded. No scanner or network request was launched.",
      ),
    );
    setModal("");
    notify("Fixture replay complete • no network requests");
  }
  const FindingTable = ({ compact = false }: { compact?: boolean }) => (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Finding</th>
            <th>Severity</th>
            {!compact && <th>Asset</th>}
            <th>
              Priority <span className="dim">↓</span>
            </th>
            <th>Status</th>
            <th aria-label="Details" />
          </tr>
        </thead>
        <tbody>
          {(compact
            ? [...open].sort((a, b) => priority(b) - priority(a)).slice(0, 4)
            : filtered.slice((tablePage - 1) * 8, tablePage * 8)
          ).map((f) => (
            <tr key={f.id} onClick={() => setSelected(f.id)}>
              <td>
                <button
                  className="finding-link"
                  onClick={() => setSelected(f.id)}
                >
                  {f.title}
                </button>
                <small>
                  {f.synthetic ? "SYNTHETIC · " : ""}
                  {f.check} <span>·</span> {new URL(f.endpoint).pathname}
                </small>
              </td>
              <td>
                <Badge tone={f.severity}>{label(f.severity)}</Badge>
              </td>
              {!compact && (
                <td className="mono dim">{new URL(f.asset).host}</td>
              )}
              <td>
                <div className="priority">
                  <span>{priority(f)}</span>
                  <i>
                    <b style={{ width: priority(f) + "%" }} />
                  </i>
                </div>
              </td>
              <td>
                <span className={"status " + f.status}>
                  <Circle size={10} />
                  {label(f.status)}
                </span>
              </td>
              <td>
                <ChevronRight size={15} className="dim" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!(compact ? open : filtered).length && (
        <Empty title="No findings here">
          Try different filters or import a ZAP report.
        </Empty>
      )}
    </div>
  );
  return (
    <div className="app">
      <aside className={"sidebar " + (mobile ? "mobile-open" : "")}>
        <a href="#overview" className="brand">
          <div className="brand-icon">
            <Shield size={25} />
            <Activity size={14} />
          </div>
          <span>
            Aegis<span className="brand-light">Lab</span>
          </span>
          <span className="version">BETA</span>
        </a>
        <div className="workspace-select">
          <div className="avatar">A</div>
          <div>
            <strong>Security workspace</strong>
            <small>Local-first · Personal</small>
          </div>
          <ChevronDown size={15} />
        </div>
        <div className="nav-label">WORKSPACE</div>
        <nav>
          {nav.map((n) => (
            <a
              href={"#" + n.id}
              key={n.id}
              className={page === n.id ? "active" : ""}
            >
              <n.icon size={18} />
              <span>{n.name}</span>
              {n.id === "findings" && findings.length > 0 && (
                <span className="nav-count">{findings.length}</span>
              )}
            </a>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="lab-card">
            <div>
              <ShieldCheck size={17} />
              <strong>Local lab only</strong>
              <span className="green-dot" />
            </div>
            <p>
              Your scope. Your environment.
              <br />
              Assessment stays intentional.
            </p>
            <button className="text-link" onClick={() => setModal("scopeHelp")}>
              View safety controls <ArrowUpRight size={14} />
            </button>
          </div>
          <a href="#audit" className={page === "audit" ? "active" : ""}>
            <Activity size={18} />
            Audit trail
          </a>
          <a href="#settings" className={page === "settings" ? "active" : ""}>
            <Settings size={18} />
            Settings
          </a>
          <button className="profile" onClick={() => go("settings")}>
            <div className="avatar purple">AL</div>
            <div>
              <strong>Lab operator</strong>
              <small>Browser workspace</small>
            </div>
            <MoreHorizontal size={18} />
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <button
            className="icon-button mobile-toggle"
            aria-label="Open navigation"
            onClick={() => setMobile(!mobile)}
          >
            <Menu size={20} />
          </button>
          <div className="breadcrumb">
            Workspace <ChevronRight size={14} />
            <strong>
              {nav.find((n) => n.id === page)?.name || label(page)}
            </strong>
          </div>
          <div className="topbar-right">
            <span className="local-indicator">
              <span className="green-dot" />
              Local storage
            </span>
            <span className="separator" />
            <button
              className="icon-button"
              aria-label="Help"
              onClick={() => setModal("help")}
            >
              <HelpCircle size={18} />
            </button>
            <button
              className="icon-button"
              aria-label="View activity"
              onClick={() => go("audit")}
            >
              <Bell size={18} />
            </button>
            <div className="avatar small purple">AL</div>
          </div>
        </header>
        <main>
          <div className="project-line">
            <label className="project-picker">
              <FolderKanban size={15} />
              <select
                aria-label="Current project"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
              >
                {!w.projects.length && <option value="">No projects</option>}
                {w.projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.synthetic ? " · Demo" : ""}
                  </option>
                ))}
              </select>
            </label>
            <Badge tone={project?.synthetic ? "purple" : "green"}>
              {project?.synthetic ? "Demo environment" : "Personal workspace"}
            </Badge>
          </div>
          {storageError && (
            <div role="alert" className="notice danger">
              {storageError}
              {recovery && (
                <button
                  className="button small-button"
                  onClick={() => download("aegislab-recovery.json", recovery)}
                >
                  Download original data
                </button>
              )}
            </div>
          )}
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                {page === "overview"
                  ? "SECURITY POSTURE"
                  : page === "paths"
                    ? "EVIDENCE & CONTEXT"
                    : "AEGISLAB WORKSPACE"}
              </div>
              <h1>
                {page === "overview"
                  ? "Security overview"
                  : nav.find((n) => n.id === page)?.name || label(page)}
              </h1>
              <p>
                {
                  (
                    {
                      overview: "Know your exposure. Focus on what matters.",
                      projects:
                        "Organize your environments and keep evidence in context.",
                      assets:
                        "Define exactly what belongs inside your testing boundary.",
                      scans:
                        "Import real scanner output or explore a controlled fixture.",
                      findings:
                        "Every observation, with the evidence behind it.",
                      paths:
                        "Explore relationships without assuming exploitability.",
                      remediation:
                        "Turn security observations into actionable improvements.",
                      reports:
                        "Evidence-backed exports for your next security review.",
                      settings: "Your workspace, preferences, and data.",
                      audit:
                        "A chronological record of actions in this browser.",
                    } as Record<string, string>
                  )[page]
                }
              </p>
            </div>
            <div className="heading-actions">
              {page === "projects" ? (
                <button
                  className="button primary"
                  onClick={() => setModal("project")}
                >
                  <Plus size={16} />
                  New project
                </button>
              ) : page === "assets" ? (
                <button
                  className="button primary"
                  onClick={() => setModal("asset")}
                  disabled={!project}
                >
                  <Plus size={16} />
                  Add asset
                </button>
              ) : page === "reports" ? (
                <button
                  className="button primary"
                  onClick={() => exportReport("json")}
                  disabled={!project}
                >
                  <Download size={16} />
                  Export report
                </button>
              ) : ["overview", "findings", "scans"].includes(page) ? (
                <>
                  <button
                    className="button"
                    onClick={() => {
                      go("reports");
                    }}
                  >
                    <Download size={16} />
                    Export report
                  </button>
                  <button
                    className="button primary"
                    onClick={() => setModal("assessment")}
                    disabled={!project}
                  >
                    <Plus size={17} />
                    New assessment
                  </button>
                </>
              ) : null}
            </div>
          </div>
          {project?.synthetic && page !== "settings" && (
            <div className="demo-banner">
              <FlaskConical size={17} />
              <span>
                <strong>You’re exploring a demo lab.</strong> All findings and
                evidence are synthetic. No live scans have run.
              </span>
              <button onClick={() => setModal("project")}>
                Create your project <ArrowRight size={14} />
              </button>
            </div>
          )}
          {page === "overview" && (
            <>
              <div className="stats">
                <Stat
                  title="Open findings"
                  value={open.length}
                  icon={<Bug size={18} />}
                  foot={
                    <>
                      <span className="red-dot" />
                      {
                        open.filter((f) =>
                          ["critical", "high"].includes(f.severity),
                        ).length
                      }{" "}
                      need priority review
                    </>
                  }
                />
                <Stat
                  title="Contextual risk"
                  value={risk}
                  suffix="/ 100"
                  icon={<Activity size={18} />}
                  foot={<>Average priority across open findings</>}
                />
                <Stat
                  title="Assets in scope"
                  value={assets.filter((a) => a.approved).length}
                  icon={<Layers size={18} />}
                  foot={
                    <>
                      <span className="green-dot" />
                      {assets.length} assets in this project
                    </>
                  }
                />
                <Stat
                  title="Remediation progress"
                  value={
                    findings.filter((f) => f.status === "in_progress").length
                  }
                  icon={<Wrench size={18} />}
                  foot={
                    <>
                      {findings.filter((f) => f.status === "fixed").length}{" "}
                      verified fixed ·{" "}
                      {
                        findings.filter((f) => f.status === "in_progress")
                          .length
                      }{" "}
                      in progress
                    </>
                  }
                />
              </div>
              <div className="overview-middle">
                <section className="panel distribution">
                  <PanelTitle
                    title="Findings by severity"
                    detail="Open observations in this project"
                    right={
                      <span className="muted text-small">
                        {open.length} total
                      </span>
                    }
                  />
                  <div className="distribution-body">
                    <div
                      className="donut"
                      role="img"
                      aria-label={severities
                        .map(
                          (s) =>
                            `${s}: ${open.filter((f) => f.severity === s).length}`,
                        )
                        .join(",")}
                      style={{ background: donutGradient(open) }}
                    >
                      <div>
                        <strong>{open.length}</strong>
                        <span>open findings</span>
                      </div>
                    </div>
                    <div className="severity-legend">
                      {severities.map((s) => (
                        <button
                          key={s}
                          onClick={() => {
                            setSeverity(s);
                            go("findings");
                          }}
                        >
                          <span className={"severity-dot " + s} />
                          <span>{label(s)}</span>
                          <strong>
                            {open.filter((f) => f.severity === s).length}
                          </strong>
                          <span className="percent">
                            {open.length
                              ? Math.round(
                                  (open.filter((f) => f.severity === s).length /
                                    open.length) *
                                    100,
                                )
                              : 0}
                            %
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="panel-footer">
                    <Shield size={14} /> Severity comes from the source;
                    priority adds context.
                  </div>
                </section>
                <section className="panel focus-panel">
                  <PanelTitle
                    title="Your next best actions"
                    detail="Small steps. Meaningful risk reduction."
                  />
                  <div className="next-actions">
                    <button
                      onClick={() => {
                        setSeverity("all");
                        setStatus("all");
                        go("findings");
                      }}
                    >
                      <div className="action-icon red">
                        <Bug size={18} />
                      </div>
                      <div>
                        <strong>Review high-priority findings</strong>
                        <span>
                          {open.filter((f) => priority(f) >= 70).length}{" "}
                          observations deserve a closer look
                        </span>
                      </div>
                      <ArrowUpRight size={17} />
                    </button>
                    <button onClick={() => go("remediation")}>
                      <div className="action-icon purple">
                        <Wrench size={18} />
                      </div>
                      <div>
                        <strong>Move remediation forward</strong>
                        <span>
                          {
                            findings.filter((f) => f.status === "in_progress")
                              .length
                          }{" "}
                          fixes currently in progress
                        </span>
                      </div>
                      <ArrowUpRight size={17} />
                    </button>
                    <button onClick={() => go("assets")}>
                      <div className="action-icon green">
                        <ShieldCheck size={18} />
                      </div>
                      <div>
                        <strong>Keep your scope intentional</strong>
                        <span>Review asset approvals and exclusions</span>
                      </div>
                      <ArrowUpRight size={17} />
                    </button>
                  </div>
                </section>
              </div>
              <section className="panel">
                <PanelTitle
                  title="Priority findings"
                  detail="Ranked by severity, asset criticality, and confidence"
                  right={
                    <button
                      className="text-link"
                      onClick={() => {
                        setSeverity("all");
                        go("findings");
                      }}
                    >
                      View all findings <ArrowRight size={14} />
                    </button>
                  }
                />
                <FindingTable compact />
              </section>
              <div className="bottom-grid">
                <section className="panel">
                  <PanelTitle
                    title="Latest assessment"
                    right={<Radar size={17} className="dim" />}
                  />
                  {scans[0] ? (
                    <div className="latest-assessment">
                      <div className="assessment-symbol">
                        <CheckCircle2 size={23} />
                      </div>
                      <div>
                        <strong>{scans[0].name}</strong>
                        <p>
                          {scans[0].source} ·{" "}
                          {new Date(scans[0].date).toLocaleDateString()}
                        </p>
                        <Badge tone="green">{label(scans[0].status)}</Badge>
                      </div>
                      <button
                        className="icon-button"
                        aria-label="View assessment history"
                        onClick={() => go("scans")}
                      >
                        <ArrowUpRight size={18} />
                      </button>
                    </div>
                  ) : (
                    <Empty title="Ready when you are">
                      Import your first ZAP JSON report.
                    </Empty>
                  )}
                </section>
                <section className="panel philosophy">
                  <div className="philosophy-icon">
                    <GitBranch size={25} />
                  </div>
                  <div>
                    <h3>Evidence before assumptions.</h3>
                    <p>
                      Explore how findings relate, with clear provenance and
                      confidence for every connection.
                    </p>
                    <button className="text-link" onClick={() => go("paths")}>
                      Explore relationships <ArrowRight size={14} />
                    </button>
                  </div>
                </section>
              </div>
            </>
          )}
          {page === "projects" && (
            <div className="project-grid">
              {w.projects.map((p) => (
                <button
                  className={
                    "project-card panel " +
                    (p.id === projectId ? "selected" : "")
                  }
                  key={p.id}
                  onClick={() => {
                    setProjectId(p.id);
                    go("overview");
                  }}
                >
                  <div className="project-card-top">
                    <div className="action-icon purple">
                      <FolderKanban size={22} />
                    </div>
                    <Badge tone={p.synthetic ? "purple" : "green"}>
                      {p.synthetic ? "Synthetic demo" : p.environment}
                    </Badge>
                  </div>
                  <h3>{p.name}</h3>
                  <p>
                    {p.description ||
                      "A dedicated space for your assessment evidence."}
                  </p>
                  <div className="project-card-stats">
                    <span>
                      <Layers size={14} />
                      {w.assets.filter((a) => a.projectId === p.id).length}{" "}
                      assets
                    </span>
                    <span>
                      <Bug size={14} />
                      {
                        w.findings.filter(
                          (f) => f.projectId === p.id && isOpen(f),
                        ).length
                      }{" "}
                      open findings
                    </span>
                    <ArrowUpRight size={17} />
                  </div>
                </button>
              ))}
              <button
                className="new-project-card"
                onClick={() => setModal("project")}
              >
                <Plus size={25} />
                <strong>Create a project</strong>
                <span>Start with an authorized environment</span>
              </button>
            </div>
          )}
          {page === "assets" && (
            <>
              <div className="notice">
                <ShieldCheck size={18} />
                <span>
                  <strong>Explicit scope, every time.</strong> Approvals apply
                  to an exact origin, port, and path. Public targets cannot be
                  scanned in this release.
                </span>
                <button
                  className="text-link"
                  onClick={() => setModal("preview")}
                >
                  Preview scope <ArrowRight size={14} />
                </button>
              </div>
              <section className="panel">
                <PanelTitle
                  title="Asset inventory"
                  detail={`${assets.length} registered assets`}
                />
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Asset</th>
                        <th>Base URL</th>
                        <th>Criticality</th>
                        <th>Scope</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {assets.map((a) => (
                        <tr key={a.id}>
                          <td>
                            <strong>{a.name}</strong>
                            <small>
                              {a.exclusions.length
                                ? `Excluded: ${a.exclusions.join(", ")}`
                                : "No excluded paths"}
                            </small>
                          </td>
                          <td className="mono">{a.url}</td>
                          <td>{a.criticality} / 5</td>
                          <td>
                            <Badge tone={a.approved ? "green" : "amber"}>
                              {a.approved ? "Approved local lab" : "Unapproved"}
                            </Badge>
                          </td>
                          <td>
                            <button
                              className="button small-button"
                              onClick={() => setModal("editasset:" + a.id)}
                            >
                              Edit scope
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!assets.length && (
                    <Empty
                      title="Build your asset inventory"
                      action={
                        <button
                          className="button"
                          onClick={() => setModal("asset")}
                        >
                          Add an asset
                        </button>
                      }
                    >
                      Start with a local lab URL or import a report to discover
                      its assets.
                    </Empty>
                  )}
                </div>
              </section>
            </>
          )}
          {page === "scans" && (
            <>
              <div className="stats three">
                <Stat
                  title="Assessments recorded"
                  value={scans.length}
                  icon={<Radar size={18} />}
                  foot="Immutable import history"
                />
                <Stat
                  title="Imported reports"
                  value={scans.filter((s) => !s.synthetic).length}
                  icon={<Upload size={18} />}
                  foot="Real scanner observations"
                />
                <Stat
                  title="Live scanner"
                  value="Offline"
                  icon={<Terminal size={18} />}
                  foot="Hosted mode does not execute scanners"
                />
              </div>
              <section className="panel">
                <PanelTitle
                  title="Assessment history"
                  detail="Imported evidence and explicit fixture replays"
                />
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Assessment</th>
                        <th>Source</th>
                        <th>Status</th>
                        <th>Observations</th>
                        <th>Evidence</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scans.map((s) => (
                        <tr key={s.id}>
                          <td>
                            <strong>{s.name}</strong>
                            <small>{new Date(s.date).toLocaleString()}</small>
                          </td>
                          <td>{s.source}</td>
                          <td>
                            <Badge tone={s.synthetic ? "purple" : "green"}>
                              {label(s.status)}
                            </Badge>
                          </td>
                          <td>{s.findings}</td>
                          <td>
                            <button
                              className="button small-button"
                              onClick={() => {
                                download(
                                  `aegislab-evidence-${s.id}.json`,
                                  s.raw,
                                );
                                notify("Redacted evidence exported");
                              }}
                            >
                              <Download size={14} />
                              Export
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!scans.length && (
                    <Empty title="No assessments yet">
                      Import a ZAP JSON report to populate findings.
                    </Empty>
                  )}
                </div>
              </section>
              <div className="notice">
                <LockKeyhole size={18} />
                <span>
                  Live scan execution is disabled. A report import never sends
                  traffic to its targets. Original raw reports stay with you;
                  the workspace retains a redacted, normalized evidence
                  snapshot.
                </span>
              </div>
            </>
          )}
          {page === "findings" && (
            <section className="panel">
              <div className="filterbar">
                <div className="search-field">
                  <Search size={16} />
                  <input
                    aria-label="Search findings"
                    placeholder="Search findings, endpoints, check IDs…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <select
                  aria-label="Filter by severity"
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value)}
                >
                  <option value="all">All severities</option>
                  {severities.map((s) => (
                    <option key={s} value={s}>
                      {label(s)}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Filter by status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="all">All statuses</option>
                  {statuses.map((s) => (
                    <option key={s} value={s}>
                      {label(s)}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Sort findings"
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                >
                  <option value="priority">Priority ↓</option>
                  <option value="recent">Last seen</option>
                  <option value="title">Title A–Z</option>
                </select>
              </div>
              <FindingTable />
              <div className="pagination">
                <span>
                  {filtered.length} findings · Page {tablePage} of{" "}
                  {Math.max(1, Math.ceil(filtered.length / 8))}
                </span>
                <div>
                  <button
                    className="button small-button"
                    disabled={tablePage === 1}
                    onClick={() => setTablePage((p) => p - 1)}
                  >
                    Previous
                  </button>
                  <button
                    className="button small-button"
                    disabled={tablePage * 8 >= filtered.length}
                    onClick={() => setTablePage((p) => p + 1)}
                  >
                    Next
                  </button>
                </div>
              </div>
            </section>
          )}
          {page === "paths" && (
            <RelationshipGraph
              findings={findings}
              onSelect={setSelected}
              theme={theme}
            />
          )}
          {page === "remediation" && (
            <>
              <div className="notice">
                <ShieldCheck size={18} />
                <span>
                  Move work forward with an owner and notes. “Fixed” requires
                  verified comparison evidence; manual closure is disabled in
                  this release.
                </span>
              </div>
              <div className="kanban">
                {[
                  {
                    title: "To review",
                    states: ["new", "confirmed", "regressed"],
                    color: "purple",
                  },
                  {
                    title: "In progress",
                    states: ["in_progress"],
                    color: "amber",
                  },
                  {
                    title: "Reviewed",
                    states: [
                      "accepted_risk",
                      "false_positive",
                      "inconclusive",
                      "fixed",
                    ],
                    color: "green",
                  },
                ].map((col) => (
                  <section className="kanban-column" key={col.title}>
                    <div className="kanban-title">
                      <span className={"severity-dot " + col.color} />
                      <h3>{col.title}</h3>
                      <span className="count">
                        {
                          findings.filter((f) => col.states.includes(f.status))
                            .length
                        }
                      </span>
                    </div>
                    {findings
                      .filter((f) => col.states.includes(f.status))
                      .map((f) => (
                        <button
                          className="remediation-card"
                          key={f.id}
                          onClick={() => setSelected(f.id)}
                        >
                          <div>
                            <Badge tone={f.severity}>{label(f.severity)}</Badge>
                            <span className="dim mono">{f.check}</span>
                          </div>
                          <h4>{f.title}</h4>
                          <p>{new URL(f.endpoint).pathname}</p>
                          <footer>
                            <span className="small-avatar">
                              {f.owner ? f.owner[0].toUpperCase() : "–"}
                            </span>
                            <span>{f.owner || "Unassigned"}</span>
                            <ChevronRight size={14} />
                          </footer>
                        </button>
                      ))}
                    {!findings.some((f) => col.states.includes(f.status)) && (
                      <div className="kanban-empty">
                        No findings in this stage
                      </div>
                    )}
                  </section>
                ))}
              </div>
            </>
          )}
          {page === "reports" && (
            <>
              <div className="report-hero panel">
                <div className="report-art">
                  <FileText size={52} />
                  <ShieldCheck size={25} />
                </div>
                <div>
                  <span className="eyebrow">ASSESSMENT REPORT</span>
                  <h2>{project?.name || "Select a project"}</h2>
                  <p>
                    A portable snapshot of findings, provenance, scope, and
                    remediation progress.
                  </p>
                  <div className="report-meta">
                    <Badge tone={project?.synthetic ? "purple" : "green"}>
                      {project?.synthetic
                        ? "Contains synthetic data"
                        : "Imported evidence"}
                    </Badge>
                    <span>{findings.length} findings</span>
                    <span>{assets.length} assets</span>
                  </div>
                </div>
              </div>
              <div className="report-options">
                {[
                  {
                    name: "JSON evidence report",
                    desc: "Complete findings, contextual factors, provenance, and limitations.",
                    format: "json",
                    icon: Database,
                  },
                  {
                    name: "CSV findings register",
                    desc: "A spreadsheet-ready register for triage and remediation planning.",
                    format: "csv",
                    icon: Layers,
                  },
                  {
                    name: "Printable summary",
                    desc: "A clean assessment summary. Save as PDF using your browser.",
                    format: "print",
                    icon: FileText,
                  },
                ].map((r) => (
                  <section className="panel" key={r.format}>
                    <r.icon size={26} className="accent" />
                    <h3>{r.name}</h3>
                    <p>{r.desc}</p>
                    <button
                      className="button"
                      disabled={!project}
                      onClick={() =>
                        r.format === "print"
                          ? window.print()
                          : exportReport(r.format)
                      }
                    >
                      <Download size={15} />
                      {r.format === "print"
                        ? "Print / Save PDF"
                        : "Export " + r.format.toUpperCase()}
                    </button>
                  </section>
                ))}
              </div>
              <section className="panel report-summary">
                <PanelTitle
                  title="Report summary"
                  detail="Current project • all observation states"
                />
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Severity</th>
                        <th>Total</th>
                        <th>Open</th>
                        <th>In progress</th>
                      </tr>
                    </thead>
                    <tbody>
                      {severities.map((s) => (
                        <tr key={s}>
                          <td>
                            <Badge tone={s}>{label(s)}</Badge>
                          </td>
                          <td>
                            {findings.filter((f) => f.severity === s).length}
                          </td>
                          <td>{open.filter((f) => f.severity === s).length}</td>
                          <td>
                            {
                              findings.filter(
                                (f) =>
                                  f.severity === s &&
                                  f.status === "in_progress",
                              ).length
                            }
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="print-only">
                  {findings.map((f) => (
                    <article key={f.id}>
                      <h3>
                        {f.title} — {label(f.severity)}
                      </h3>
                      <p>
                        {f.endpoint} · {label(f.status)} · Priority{" "}
                        {priority(f)}
                      </p>
                      <p>{f.description}</p>
                      <p>{f.solution}</p>
                    </article>
                  ))}
                </div>
              </section>
              <p className="footnote">
                Priority formula v1: severity baseline + 3 × asset criticality +
                5 × confidence, capped at 100. This is not a CVSS score.
                Synthetic records are explicitly marked in exported reports.
              </p>
            </>
          )}
          {page === "audit" && (
            <section className="panel">
              <PanelTitle
                title="Workspace activity"
                detail="Local audit history · not tamper-proof or multi-user"
              />
              {w.audit.length ? (
                w.audit
                  .filter((a) => !projectId || a.projectId === projectId)
                  .map((a) => (
                    <div className="audit-row" key={a.id}>
                      <div className="timeline-dot" />
                      <div>
                        <strong>{a.action}</strong>
                        <p>{a.detail}</p>
                        <small>
                          {new Date(a.time).toLocaleString()} · Lab operator
                        </small>
                      </div>
                    </div>
                  ))
              ) : (
                <Empty title="No activity yet">
                  Actions will appear here as you use the workspace.
                </Empty>
              )}
            </section>
          )}
          {page === "settings" && (
            <div className="settings-grid">
              <section className="panel settings-panel">
                <h3>Appearance</h3>
                <p>Choose the theme that fits your environment.</p>
                <div className="theme-options">
                  <button
                    className={"button " + (theme === "dark" ? "primary" : "")}
                    onClick={() => setTheme("dark")}
                  >
                    <Moon size={17} />
                    Dark
                  </button>
                  <button
                    className={"button " + (theme === "light" ? "primary" : "")}
                    onClick={() => setTheme("light")}
                  >
                    <Sun size={17} />
                    Light
                  </button>
                </div>
                <hr />
                <h3>Workspace storage</h3>
                <p>
                  Your data is saved in this browser on this device. It is not
                  synced to a server or to other devices. Export backups
                  regularly.
                </p>
                <button
                  className="button"
                  onClick={() => {
                    download(
                      "aegislab-workspace-backup.json",
                      JSON.stringify(w, null, 2),
                    );
                    notify("Workspace backup exported");
                  }}
                >
                  <Download size={16} />
                  Export full backup
                </button>
                <button
                  className="button restore-button"
                  onClick={() => setModal("restore")}
                >
                  <Upload size={16} />
                  Restore a backup
                </button>
                <hr />
                <h3>Demo lab</h3>
                <p>
                  Explore a controlled set of synthetic findings without making
                  network requests.
                </p>
                <button
                  className="button"
                  onClick={() => {
                    if (w.projects.some((p) => p.id === "demo")) {
                      setProjectId("demo");
                      go("overview");
                      return;
                    }
                    const d = demoWorkspace();
                    setW((prev) => ({
                      ...prev,
                      projects: [...prev.projects, ...d.projects],
                      assets: [...prev.assets, ...d.assets],
                      findings: [...prev.findings, ...d.findings],
                      scans: [...prev.scans, ...d.scans],
                      audit: [...d.audit, ...prev.audit],
                    }));
                    setProjectId("demo");
                    go("overview");
                  }}
                >
                  <FlaskConical size={16} />
                  Open demo lab
                </button>
              </section>
              <section className="panel settings-panel">
                <h3>System capabilities</h3>
                <div className="capability">
                  <span>Evidence import & analysis</span>
                  <Badge tone="green">Available</Badge>
                </div>
                <div className="capability">
                  <span>Browser persistence</span>
                  <Badge tone={storageError ? "high" : "green"}>
                    {storageError ? "Error" : "Available"}
                  </Badge>
                </div>
                <div className="capability">
                  <span>Live scanner worker</span>
                  <Badge>Not connected</Badge>
                </div>
                <div className="capability">
                  <span>External active testing</span>
                  <Badge>Disabled</Badge>
                </div>
                <div className="capability">
                  <span>Automated fix verification</span>
                  <Badge>Not available</Badge>
                </div>
                <LocalApiHealth />
                <hr />
                <h3>About AegisLab</h3>
                <p>
                  v0.1.0 · Evidence workspace release
                  <br />
                  Built for authorized security assessment and careful,
                  explainable triage.
                </p>
                <button className="text-link" onClick={() => setModal("help")}>
                  Read the workflow guide <ArrowUpRight size={14} />
                </button>
              </section>
            </div>
          )}
          <footer className="page-footer">
            <span>
              <Shield size={13} /> AegisLab · Evidence-led security
            </span>
            <span>
              Browser-local workspace <span className="green-dot" />
            </span>
          </footer>
        </main>
      </div>
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={18} />
          {toast}
        </div>
      )}
      {modal === "project" && (
        <ProjectModal
          close={() => setModal("")}
          onSave={(p) => {
            setW((prev) =>
              event(
                { ...prev, projects: [...prev.projects, p] },
                "Project created",
                p.name,
                p.id,
              ),
            );
            setProjectId(p.id);
            setModal("");
            go("assets");
            notify("Project created. Add your first asset.");
          }}
        />
      )}
      {(modal === "asset" || modal.startsWith("editasset:")) && (
        <AssetModal
          asset={w.assets.find((a) => a.id === modal.split(":")[1])}
          projectId={projectId}
          close={() => setModal("")}
          onSave={(a) => {
            if (
              w.assets.some(
                (x) =>
                  x.id !== a.id && x.projectId === projectId && x.url === a.url,
              )
            )
              throw Error("This asset URL is already registered.");
            setW((prev) =>
              event(
                {
                  ...prev,
                  assets: prev.assets.some((x) => x.id === a.id)
                    ? prev.assets.map((x) => (x.id === a.id ? a : x))
                    : [...prev.assets, a],
                  findings: prev.findings.map((f) =>
                    f.projectId === projectId &&
                    f.asset === new URL(a.url).origin
                      ? { ...f, criticality: a.criticality }
                      : f,
                  ),
                },
                "Asset scope updated",
                `${a.url} · ${a.approved ? "approved local lab" : "unapproved"}`,
              ),
            );
            setModal("");
            notify("Asset and scope saved");
          }}
        />
      )}
      {modal === "assessment" && (
        <Modal title="New assessment" close={() => setModal("")}>
          <div className="modal-body">
            <p className="muted">
              Choose how to bring evidence into {project?.name}.
            </p>
            <button
              className="option-card"
              disabled={project?.synthetic}
              onClick={() => setModal("import")}
            >
              <div className="action-icon purple">
                <Upload size={22} />
              </div>
              <div>
                <strong>Import a ZAP report</strong>
                <p>Normalize, redact, and deduplicate a JSON report.</p>
                {project?.synthetic && (
                  <small>
                    Create a real project to import scanner evidence.
                  </small>
                )}
              </div>
              <ChevronRight size={18} />
            </button>
            {project?.synthetic && (
              <button className="option-card" onClick={replay}>
                <div className="action-icon green">
                  <FlaskConical size={22} />
                </div>
                <div>
                  <strong>Replay synthetic fixture</strong>
                  <p>Load 12 deterministic observations. No network traffic.</p>
                </div>
                <ChevronRight size={18} />
              </button>
            )}
            <button className="option-card" onClick={() => setModal("preview")}>
              <div className="action-icon">
                <ShieldCheck size={22} />
              </div>
              <div>
                <strong>Preview target scope</strong>
                <p>Check the approved origin, port, path, and exclusions.</p>
              </div>
              <ChevronRight size={18} />
            </button>
            <div className="notice">
              <Terminal size={18} />
              <span>
                Live scanner execution requires an isolated local worker and is
                disabled in this hosted release.
              </span>
            </div>
          </div>
        </Modal>
      )}
      {modal === "restore" && (
        <BackupModal
          close={() => setModal("")}
          onRestore={(backup) => {
            setRecovery(null);
            setW(backup);
            setProjectId(backup.projects[0]?.id || "");
            setModal("");
            go("overview");
            notify("Workspace restored from backup");
          }}
        />
      )}
      {modal === "import" && (
        <ImportModal close={() => setModal("")} onImport={importZap} />
      )}
      {modal === "preview" && (
        <PreviewModal assets={assets} close={() => setModal("")} />
      )}
      {selected && current && (
        <FindingModal
          finding={current}
          close={() => setSelected(null)}
          save={(patch) => updateFinding(current.id, patch)}
        />
      )}
      {["help", "scopeHelp"].includes(modal) && (
        <Modal
          title={
            modal === "help"
              ? "Your evidence-led workflow"
              : "Local lab safety controls"
          }
          close={() => setModal("")}
        >
          <div className="modal-body prose">
            {modal === "help" ? (
              <>
                <p>
                  AegisLab turns scanner output into a focused security review.
                  Your workspace stays in your browser.
                </p>
                <ol>
                  <li>
                    <strong>Create a project.</strong> Keep real evidence
                    separate from the synthetic demo.
                  </li>
                  <li>
                    <strong>Register assets.</strong> Set criticality and
                    explicitly approve local lab scope.
                  </li>
                  <li>
                    <strong>Import ZAP JSON.</strong> Reports are normalized and
                    deduplicated. Sensitive patterns are redacted; review
                    evidence before sharing.
                  </li>
                  <li>
                    <strong>Triage findings.</strong> Inspect source evidence,
                    assign an owner, and track remediation.
                  </li>
                  <li>
                    <strong>Export your review.</strong> Download JSON, CSV, or
                    a printable summary.
                  </li>
                </ol>
                <p>
                  Relationships show shared context only. A missing alert is not
                  proof of a fix. Active scanning and automated verification are
                  not enabled.
                </p>
              </>
            ) : (
              <>
                <p>
                  The hosted app sends no traffic to assessment targets. Typing
                  a URL never launches a scan.
                </p>
                <ul>
                  <li>
                    Only localhost, loopback, and named lab services can be
                    approved.
                  </li>
                  <li>
                    Scope matches exact origins and ports, plus explicit path
                    boundaries.
                  </li>
                  <li>Excluded paths override approvals.</li>
                  <li>External active testing is disabled.</li>
                  <li>
                    A future live worker must independently check resolved IPs,
                    redirects, rate limits, and authorization before execution.
                  </li>
                </ul>
                <p>
                  Importing a report does not authorize a target. Newly
                  discovered assets are unapproved.
                </p>
              </>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
function Stat({
  title,
  value,
  suffix,
  icon,
  foot,
}: {
  title: string;
  value: string | number;
  suffix?: string;
  icon: React.ReactNode;
  foot: React.ReactNode;
}) {
  return (
    <section className="stat panel">
      <div className="stat-top">
        <span>{title}</span>
        {icon}
      </div>
      <div className="stat-value">
        {value}
        {suffix && <span>{suffix}</span>}
      </div>
      <div className="stat-foot">{foot}</div>
    </section>
  );
}
function PanelTitle({
  title,
  detail,
  right,
}: {
  title: string;
  detail?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="panel-title">
      <div>
        <h2>{title}</h2>
        {detail && <p>{detail}</p>}
      </div>
      {right}
    </div>
  );
}
function donutGradient(findings: Finding[]) {
  const colors = ["#f06c7a", "#ec9869", "#dfbc62", "#84a9ed", "#85909e"];
  let n = 0;
  return findings.length
    ? "conic-gradient(" +
        severities
          .map((s, i) => {
            const from = n;
            n +=
              (findings.filter((f) => f.severity === s).length /
                findings.length) *
              100;
            return `${colors[i]} ${from}% ${n}%`;
          })
          .join(",") +
        ")"
    : "var(--border)";
}
function ProjectModal({
  close,
  onSave,
}: {
  close: () => void;
  onSave: (p: Project) => void;
}) {
  return (
    <Modal title="Create a project" close={close}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const d = new FormData(e.currentTarget);
          const name = String(d.get("name")).trim();
          if (!name) return;
          onSave({
            id: uid(),
            name,
            description: String(d.get("description")).trim(),
            environment: String(d.get("environment")),
            createdAt: new Date().toISOString(),
            synthetic: false,
          });
        }}
      >
        <div className="modal-body form-stack">
          <label>
            Project name
            <input
              name="name"
              required
              maxLength={80}
              placeholder="e.g. Internal application lab"
              autoFocus
            />
          </label>
          <label>
            Description
            <textarea
              name="description"
              maxLength={500}
              rows={3}
              placeholder="What are you assessing?"
            />
          </label>
          <label>
            Environment
            <select name="environment">
              <option>Local lab</option>
              <option>Development</option>
              <option>Staging evidence</option>
              <option>Production evidence</option>
            </select>
          </label>
          <div className="notice">
            <ShieldCheck size={18} />
            <span>
              External environments support evidence import only. Creating a
              project does not authorize active tests.
            </span>
          </div>
        </div>
        <div className="modal-footer">
          <button className="button" type="button" onClick={close}>
            Cancel
          </button>
          <button className="button primary">Create project</button>
        </div>
      </form>
    </Modal>
  );
}
function AssetModal({
  asset,
  projectId,
  close,
  onSave,
}: {
  asset?: Asset;
  projectId: string;
  close: () => void;
  onSave: (a: Asset) => void;
}) {
  const [error, setError] = useState("");
  return (
    <Modal title={asset ? "Edit asset & scope" : "Add an asset"} close={close}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError("");
          try {
            const d = new FormData(e.currentTarget);
            const u = safeURL(String(d.get("url")).trim());
            const approved = d.get("approved") === "on";
            if (approved && !isLocalHost(u.hostname))
              throw Error(
                "Only localhost, loopback, and named lab services may be approved. External assets can be recorded for evidence review.",
              );
            const exclusions = String(d.get("exclusions"))
              .split("\n")
              .map((s) => s.trim())
              .filter(Boolean);
            if (
              exclusions.some(
                (p) =>
                  !p.startsWith("/") ||
                  p.includes("?") ||
                  p.includes("#") ||
                  p.includes(".."),
              )
            )
              throw Error(
                "Exclusions must be absolute paths without traversal, query strings, or fragments.",
              );
            onSave({
              id: asset?.id || uid(),
              projectId,
              name: String(d.get("name")).trim(),
              url: u.href.replace(/\/$/, u.pathname === "/" ? "" : "/"),
              criticality: Number(d.get("criticality")),
              approved,
              exclusions,
            });
          } catch (err) {
            setError((err as Error).message);
          }
        }}
      >
        <div className="modal-body form-stack">
          <label>
            Asset name
            <input
              name="name"
              required
              maxLength={80}
              defaultValue={asset?.name}
              placeholder="Juice Shop"
              autoFocus
            />
          </label>
          <label>
            Base URL (including port and scope path)
            <input
              name="url"
              type="url"
              required
              defaultValue={asset?.url}
              placeholder="http://localhost:3000"
            />
          </label>
          <label>
            Asset criticality
            <select name="criticality" defaultValue={asset?.criticality || 3}>
              {[1, 2, 3, 4, 5].map((n) => (
                <option value={n} key={n}>
                  {n} —{" "}
                  {["Minimal", "Low", "Moderate", "High", "Essential"][n - 1]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Excluded paths (one per line)
            <textarea
              name="exclusions"
              defaultValue={asset?.exclusions.join("\n")}
              rows={3}
              placeholder={"/logout\n/admin/delete"}
            />
          </label>
          <label className="checkbox-label">
            <input
              name="approved"
              type="checkbox"
              defaultChecked={asset?.approved}
            />
            <span>
              I own or have explicit permission to assess this local lab asset.
            </span>
          </label>
          {error && (
            <div className="notice danger" role="alert">
              {error}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button type="button" className="button" onClick={close}>
            Cancel
          </button>
          <button className="button primary">Save asset</button>
        </div>
      </form>
    </Modal>
  );
}
function PreviewModal({
  assets,
  close,
}: {
  assets: Asset[];
  close: () => void;
}) {
  const [target, setTarget] = useState(
    assets[0]?.url || "http://localhost:3000",
  );
  const [result, setResult] = useState<ReturnType<typeof scopePreview> | null>(
    null,
  );
  return (
    <Modal title="Preview target scope" close={close}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setResult(scopePreview(target, assets));
        }}
      >
        <div className="modal-body form-stack">
          <p className="muted">
            This checks scope rules locally. It does not resolve DNS or send any
            requests.
          </p>
          <label>
            Target URL
            <input
              type="url"
              required
              value={target}
              onChange={(e) => {
                setTarget(e.target.value);
                setResult(null);
              }}
            />
          </label>
          {result && (
            <div
              className={
                "scope-result " + (result.allowed ? "allowed" : "blocked")
              }
              role="status"
            >
              {result.allowed ? (
                <ShieldCheck size={25} />
              ) : (
                <Shield size={25} />
              )}
              <h3>{result.allowed ? "Scope match" : "Target blocked"}</h3>
              <p>{result.reason}</p>
              <small>Live execution remains disabled.</small>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="button" type="button" onClick={close}>
            Close
          </button>
          <button className="button primary">
            <Eye size={16} />
            Check scope
          </button>
        </div>
      </form>
    </Modal>
  );
}
function ImportModal({
  close,
  onImport,
}: {
  close: () => void;
  onImport: (f: File) => Promise<void>;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Modal title="Import ZAP evidence" close={close}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!file) return;
          setBusy(true);
          setError("");
          try {
            await onImport(file);
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="modal-body form-stack">
          <div className="upload-zone">
            <Upload size={30} />
            <strong>Choose a ZAP JSON report</strong>
            <p>Up to 5 MB · Processed in your browser</p>
            <input
              aria-label="ZAP JSON report"
              type="file"
              accept=".json,application/json"
              required
              onChange={(e) => {
                setFile(e.target.files?.[0] || null);
                setError("");
              }}
            />
          </div>
          <div className="notice">
            <LockKeyhole size={18} />
            <span>
              Only a redacted, normalized snapshot is retained. Keep your
              original report in restricted storage. Pattern-based redaction is
              not a guarantee; review evidence before sharing.
            </span>
          </div>
          {error && (
            <div className="notice danger" role="alert">
              {error}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button
            type="button"
            className="button"
            disabled={busy}
            onClick={close}
          >
            Cancel
          </button>
          <button className="button primary" disabled={!file || busy}>
            {busy ? "Processing…" : "Import report"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
function FindingModal({
  finding: f,
  close,
  save,
}: {
  finding: Finding;
  close: () => void;
  save: (p: Partial<Finding>) => void;
}) {
  const [tab, setTab] = useState("evidence");
  const [error, setError] = useState("");
  return (
    <Modal title="Finding details" close={close} wide>
      <div className="finding-detail-header">
        <div>
          <Badge tone={f.severity}>{label(f.severity)}</Badge>
          <Badge tone={f.synthetic ? "purple" : "neutral"}>
            {f.synthetic ? "Synthetic fixture" : "Scanner observation"}
          </Badge>
        </div>
        <h2>{f.title}</h2>
        <code>{f.endpoint}</code>
        <div className="detail-meta">
          <span>{f.source}</span>
          <span>Check {f.check}</span>
          <span>Confidence {Math.round(f.confidence * 100)}%</span>
        </div>
      </div>
      <div className="tabs">
        {["evidence", "priority", "remediation"].map((t) => (
          <button
            key={t}
            className={tab === t ? "active" : ""}
            onClick={() => setTab(t)}
          >
            {label(t)}
          </button>
        ))}
      </div>
      <div className="modal-body">
        {tab === "evidence" && (
          <div className="prose">
            <h3>Observation</h3>
            <p>{f.description}</p>
            <h3>Redacted evidence</h3>
            <pre>{f.evidence}</pre>
            <div className="evidence-provenance">
              <ShieldCheck size={16} />
              <span>
                Assessment reference: <code>{f.scanId}</code>
              </span>
            </div>
            <h3>Recommended remediation</h3>
            <p>{f.solution}</p>
            <p className="footnote">
              First seen {new Date(f.firstSeen).toLocaleString()} · Last seen{" "}
              {new Date(f.lastSeen).toLocaleString()}
            </p>
          </div>
        )}
        {tab === "priority" && (
          <div className="prose">
            <div className="priority-explainer">
              <strong>
                {priority(f)}
                <small>/ 100</small>
              </strong>
              <div>
                <h3>Contextual priority</h3>
                <p>Formula v1 · Separate from CVSS</p>
              </div>
            </div>
            <div className="factor-row">
              <span>Severity baseline · {f.severity}</span>
              <strong>
                {
                  { critical: 85, high: 65, medium: 40, low: 15, info: 0 }[
                    f.severity
                  ]
                }
              </strong>
            </div>
            <div className="factor-row">
              <span>Asset criticality · {f.criticality}/5 × 3</span>
              <strong>+{f.criticality * 3}</strong>
            </div>
            <div className="factor-row">
              <span>Scanner confidence · {f.confidence.toFixed(2)} × 5</span>
              <strong>+{(f.confidence * 5).toFixed(1)}</strong>
            </div>
            <p>
              Rounded to a whole number and capped at 100. This score helps
              order review; it does not establish exploitability or estimate
              financial impact.
            </p>
            <div className="notice">
              CVSS: not supplied. AegisLab does not invent CVSS vectors or
              scores.
            </div>
          </div>
        )}
        {tab === "remediation" && (
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              const d = new FormData(e.currentTarget);
              const status = String(d.get("status")) as FindingStatus;
              const note = redact(String(d.get("note")).trim());
              if (
                ["accepted_risk", "false_positive", "confirmed"].includes(
                  status,
                ) &&
                !note
              ) {
                setError(
                  "Record your rationale or validation evidence for this decision.",
                );
                return;
              }
              save({ status, owner: String(d.get("owner")).trim(), note });
              setError("");
            }}
          >
            <label>
              Lifecycle status
              <select name="status" defaultValue={f.status}>
                {statuses
                  .filter((s) => s !== "fixed" && s !== "regressed")
                  .map((s) => (
                    <option key={s} value={s}>
                      {label(s)}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Owner
              <input
                name="owner"
                defaultValue={f.owner}
                placeholder="Team or person responsible"
                maxLength={80}
              />
            </label>
            <label>
              Decision / remediation notes
              <textarea
                name="note"
                rows={4}
                defaultValue={f.note}
                maxLength={4000}
                placeholder="Record the rationale, work performed, and supporting evidence."
              />
            </label>
            <div className="notice">
              <ShieldCheck size={18} />
              <span>
                Verified closure is unavailable. Use “Inconclusive” when
                evidence is insufficient; importing a clean report does not
                automatically close findings.
              </span>
            </div>
            {error && (
              <p className="error-text" role="alert">
                {error}
              </p>
            )}
            <button className="button primary">
              <Check size={16} />
              Save remediation
            </button>
          </form>
        )}
      </div>
    </Modal>
  );
}
function RelationshipGraph({
  findings,
  onSelect,
  theme,
}: {
  findings: Finding[];
  onSelect: (s: string) => void;
  theme: string;
}) {
  const [edgeId, setEdgeId] = useState<string | null>(null);
  const [showData, setShowData] = useState(false);
  const active = findings
    .filter(isOpen)
    .sort((a, b) => priority(b) - priority(a))
    .slice(0, 6);
  const { nodes, edges } = useMemo(() => {
    const assetNames = [...new Set(active.map((f) => f.asset))];
    const ns: Node[] = assetNames.map((a, i) => ({
      id: "asset-" + i,
      position: { x: 40, y: 90 + i * 200 },
      data: {
        label: (
          <div className="graph-node asset-node">
            <Layers size={19} />
            <span>SHARED ASSET</span>
            <strong>{new URL(a).host}</strong>
          </div>
        ),
      },
      style: { width: 190 },
    }));
    const es: Edge[] = [];
    active.forEach((f, i) => {
      ns.push({
        id: f.id,
        position: { x: 380 + (i % 2) * 310, y: 25 + Math.floor(i / 2) * 150 },
        data: {
          label: (
            <div className="graph-node">
              <span className={"severity-dot " + f.severity} />
              <span>
                {label(f.severity)} · Priority {priority(f)}
              </span>
              <strong>{f.title}</strong>
              <small>{new URL(f.endpoint).pathname}</small>
            </div>
          ),
        },
        style: { width: 245 },
      });
      es.push({
        id: "edge-" + f.id,
        source: "asset-" + assetNames.indexOf(f.asset),
        target: f.id,
        type: "default",
        style: { stroke: "#8a77b7", strokeDasharray: "5 5" },
        markerEnd: { type: MarkerType.ArrowClosed, color: "#8a77b7" },
        label: "Inferred",
        labelStyle: { fill: "#a395c1", fontSize: 10 },
        labelBgStyle: { fill: theme === "dark" ? "#18191e" : "#fff" },
        data: { finding: f },
      });
    });
    return { nodes: ns, edges: es };
  }, [findings, theme]);
  const selected = edges.find((e) => e.id === edgeId)?.data?.finding as
    | Finding
    | undefined;
  return (
    <>
      <div className="notice">
        <GitBranch size={18} />
        <span>
          <strong>Connections are context, not attack chains.</strong> Dashed
          links infer shared-asset relationships. They do not prove
          exploitability.
        </span>
      </div>
      <section className="panel graph-panel">
        <PanelTitle
          title="Finding relationships"
          detail="Top 6 open findings · click a finding for evidence or a link for provenance"
          right={<Badge tone="purple">Inferred relationships</Badge>}
        />
        {active.length ? (
          <div className="graph-canvas">
            <ReactFlow
              key={nodes.map((n) => n.id).join(",")}
              nodes={nodes}
              edges={edges}
              fitView
              minZoom={0.3}
              maxZoom={1.7}
              nodesDraggable={false}
              onNodeClick={(_, n) => {
                if (!n.id.startsWith("asset-")) onSelect(n.id);
              }}
              onEdgeClick={(_, e) => setEdgeId(e.id)}
              colorMode={theme === "dark" ? "dark" : "light"}
            >
              <Background gap={22} size={1} />
              <Controls showInteractive={false} />
            </ReactFlow>
          </div>
        ) : (
          <Empty title="No relationships yet">
            Import findings to explore shared assets and evidence.
          </Empty>
        )}
        {selected && (
          <div className="edge-detail">
            <GitBranch size={20} />
            <div>
              <strong>Inferred: same canonical asset origin</strong>
              <p>
                {selected.title} belongs to {selected.asset}. Rule:
                shared-origin-v1. Confidence: 100% in the source association;
                exploitability is unverified. Provenance: {selected.source},
                check {selected.check}.
              </p>
            </div>
            <button
              className="icon-button"
              aria-label="Close relationship details"
              onClick={() => setEdgeId(null)}
            >
              <X size={16} />
            </button>
          </div>
        )}
      </section>
      <button
        className="text-link data-toggle"
        onClick={() => setShowData(!showData)}
      >
        {showData ? "Hide" : "Show"} relationship data <ChevronDown size={15} />
      </button>
      {showData && (
        <section className="panel">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Asset</th>
                  <th>Finding</th>
                  <th>Relationship</th>
                  <th>Basis</th>
                </tr>
              </thead>
              <tbody>
                {active.map((f) => (
                  <tr key={f.id}>
                    <td>{f.asset}</td>
                    <td>{f.title}</td>
                    <td>Inferred</td>
                    <td>Exact shared origin · {f.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
const rootElement = document.getElementById("root");
if (rootElement)
  createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
function LocalApiHealth() {
  const [result, setResult] = useState("Not checked");
  const [busy, setBusy] = useState(false);
  return (
    <div className="local-api">
      <h3>Local API foundation</h3>
      <p>
        For local development only. Its project database is separate from this
        browser workspace.
      </p>
      <button
        className="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            const r = await fetch("/api/v1/health", {
              signal: AbortSignal.timeout(4000),
            });
            if (!r.headers.get("content-type")?.includes("application/json"))
              throw Error();
            const d = await r.json();
            if (!d.services || d.version !== "0.1.0") throw Error();
            setResult(
              `API ${d.status} · PostgreSQL ${d.services.database} · Redis ${d.services.redis} · scanner ${d.scanner}`,
            );
          } catch {
            setResult(
              "Not connected. Run the local Docker stack and Vite development server to check API health.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <RefreshCw size={15} />
        {busy ? "Checking…" : "Check local API"}
      </button>
      <p role="status">{result}</p>
    </div>
  );
}
function BackupModal({
  close,
  onRestore,
}: {
  close: () => void;
  onRestore: (w: Workspace) => void;
}) {
  const [backup, setBackup] = useState<Workspace | null>(null);
  const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  return (
    <Modal title="Restore workspace backup" close={close}>
      <div className="modal-body form-stack">
        <p className="muted">
          Choose a backup previously exported from AegisLab.
        </p>
        <input
          aria-label="Workspace backup JSON"
          type="file"
          accept=".json,application/json"
          onChange={async (e) => {
            setError("");
            setBackup(null);
            setConfirmed(false);
            const file = e.target.files?.[0];
            if (!file) return;
            try {
              if (file.size > 5 * 1024 * 1024)
                throw Error("Backup exceeds the 5 MB limit.");
              const data = JSON.parse(await file.text());
              if (!validateBackup(data))
                throw Error(
                  "This is not a valid AegisLab v1 workspace backup.",
                );
              setBackup(data);
            } catch (err) {
              setError((err as Error).message);
            }
          }}
        />
        {backup && (
          <>
            <div className="notice">
              Backup contains {backup.projects.length} projects,{" "}
              {backup.findings.length} findings, and {backup.scans.length}{" "}
              assessments.
            </div>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
              <span>
                Replace this browser workspace with the backup. I have exported
                any current data I want to keep.
              </span>
            </label>
          </>
        )}
        {error && (
          <div role="alert" className="notice danger">
            {error}
          </div>
        )}
      </div>
      <div className="modal-footer">
        <button className="button" onClick={close}>
          Cancel
        </button>
        <button
          className="button primary"
          disabled={!backup || !confirmed}
          onClick={() => backup && onRestore(backup)}
        >
          Restore workspace
        </button>
      </div>
    </Modal>
  );
}

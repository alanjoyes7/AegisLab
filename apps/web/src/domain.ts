export type Severity = "critical" | "high" | "medium" | "low" | "info";
export type FindingStatus =
  | "new"
  | "confirmed"
  | "in_progress"
  | "accepted_risk"
  | "false_positive"
  | "inconclusive"
  | "fixed"
  | "regressed";
export type Finding = {
  id: string;
  projectId: string;
  asset: string;
  endpoint: string;
  title: string;
  description: string;
  severity: Severity;
  confidence: number;
  status: FindingStatus;
  check: string;
  evidence: string;
  solution: string;
  source: string;
  scanId: string;
  firstSeen: string;
  lastSeen: string;
  owner: string;
  note: string;
  synthetic: boolean;
  criticality: number;
};
export type Project = {
  id: string;
  name: string;
  description: string;
  environment: string;
  createdAt: string;
  synthetic: boolean;
};
export type Asset = {
  id: string;
  projectId: string;
  url: string;
  name: string;
  criticality: number;
  approved: boolean;
  exclusions: string[];
};
export type Scan = {
  id: string;
  projectId: string;
  date: string;
  name: string;
  source: string;
  status: "imported" | "fixture_replayed";
  findings: number;
  hash: string;
  synthetic: boolean;
  raw: string;
};
export type Audit = {
  id: string;
  time: string;
  action: string;
  detail: string;
  projectId: string;
};
export type Workspace = {
  version: 1;
  projects: Project[];
  assets: Asset[];
  findings: Finding[];
  scans: Scan[];
  audit: Audit[];
};
export const severities: Severity[] = [
  "critical",
  "high",
  "medium",
  "low",
  "info",
];
export const statuses: FindingStatus[] = [
  "new",
  "confirmed",
  "in_progress",
  "accepted_risk",
  "false_positive",
  "inconclusive",
  "fixed",
  "regressed",
];
export const uid = () => crypto.randomUUID();
export const label = (s: string) =>
  s.replaceAll("_", " ").replace(/^./, (c) => c.toUpperCase());
export const isOpen = (f: Finding) =>
  !["fixed", "false_positive", "accepted_risk"].includes(f.status);
export function priority(
  f: Pick<Finding, "severity" | "criticality" | "confidence">,
) {
  const base = { critical: 85, high: 65, medium: 40, low: 15, info: 0 }[
    f.severity
  ];
  return Math.min(100, Math.round(base + f.criticality * 3 + f.confidence * 5));
}
export function redact(input: string) {
  return input
    .replace(
      /((?:authorization|proxy-authorization|cookie|set-cookie)\s*[:=]\s*)[^\r\n]+/gi,
      "$1[REDACTED]",
    )
    .replace(
      /((?:password|passwd|token|api[_-]?key|secret|session(?:id)?)\s*["']?\s*[:=]\s*["']?)[^\s"'&,;}<]+/gi,
      "$1[REDACTED]",
    )
    .replace(
      /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
      "[REDACTED JWT]",
    )
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[REDACTED EMAIL]");
}
export function safeURL(input: string) {
  try {
    const u = new URL(input);
    if (
      !["http:", "https:"].includes(u.protocol) ||
      u.username ||
      u.password ||
      u.search ||
      u.hash ||
      u.pathname.includes("%")
    )
      throw Error();
    return u;
  } catch {
    throw new Error(
      "Use an HTTP(S) URL without credentials, encoded paths, query parameters, or a fragment.",
    );
  }
}
export function isLocalHost(host: string) {
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "[::1]" ||
    ["juice-shop", "webgoat", "dvwa"].includes(host)
  );
}
export function scopePreview(target: string, assets: Asset[]) {
  try {
    const u = safeURL(target);
    if (!isLocalHost(u.hostname))
      return {
        allowed: false,
        reason:
          "External targets are disabled in this release. Use an explicitly approved local lab asset.",
      };
    const asset = assets.find((a) => {
      try {
        const s = safeURL(a.url);
        return (
          a.approved &&
          s.origin === u.origin &&
          (u.pathname === s.pathname ||
            u.pathname.startsWith(
              s.pathname.endsWith("/") ? s.pathname : s.pathname + "/",
            )) &&
          !a.exclusions.some(
            (p) =>
              u.pathname === p ||
              u.pathname.startsWith(p.endsWith("/") ? p : p + "/"),
          )
        );
      } catch {
        return false;
      }
    });
    return asset
      ? {
          allowed: true,
          reason:
            "Matches an approved local lab origin, port, and path. No request was sent. A local worker must revalidate DNS and redirects before any live scan.",
        }
      : {
          allowed: false,
          reason:
            "No approved scope matches this origin, port, and path, or the path is excluded.",
        };
  } catch (e) {
    return { allowed: false, reason: (e as Error).message };
  }
}
export function fingerprint(f: Pick<Finding, "asset" | "endpoint" | "check">) {
  return JSON.stringify([f.asset, f.endpoint, f.check]);
}
export function mergeFindings(existing: Finding[], incoming: Finding[]) {
  const result = [...existing];
  for (const f of incoming) {
    const i = result.findIndex(
      (e) => e.projectId === f.projectId && fingerprint(e) === fingerprint(f),
    );
    if (i < 0) result.push(f);
    else
      result[i] = {
        ...f,
        id: result[i].id,
        firstSeen: result[i].firstSeen,
        owner: result[i].owner,
        note: result[i].note,
        status: result[i].status === "fixed" ? "regressed" : result[i].status,
      };
  }
  return result;
}
const plain = (v: unknown) =>
  redact(
    String(v ?? "")
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .trim(),
  ).slice(0, 20000);
export function parseZap(
  input: unknown,
  projectId: string,
  scanId: string,
): { findings: Finding[]; assets: Asset[]; version: string } {
  if (
    !input ||
    typeof input !== "object" ||
    !("site" in input) ||
    !Array.isArray(input.site) ||
    input.site.length === 0
  )
    throw new Error("Expected a ZAP JSON report with a nonempty site array.");
  const findings: Finding[] = [];
  const assets: Asset[] = [];
  const now = new Date().toISOString();
  for (const site of input.site) {
    if (!site || typeof site !== "object" || !Array.isArray(site.alerts))
      throw new Error("Each ZAP site must contain an alerts array.");
    const url = safeURL(String(site["@name"] || ""));
    assets.push({
      id: uid(),
      projectId,
      url: url.origin,
      name: url.hostname,
      criticality: 3,
      approved: false,
      exclusions: [],
    });
    for (const alert of site.alerts) {
      if (!alert || typeof alert !== "object" || !alert.pluginid || !alert.name)
        throw new Error("A ZAP alert is missing its pluginid or name.");
      const risk = Number(alert.riskcode);
      if (![0, 1, 2, 3].includes(risk))
        throw new Error("ZAP riskcode must be between 0 and 3.");
      const instances = alert.instances ?? [];
      if (!Array.isArray(instances))
        throw new Error("Alert instances must be an array.");
      for (const instance of instances.length
        ? instances
        : [{ uri: url.href }]) {
        if (findings.length >= 10000)
          throw new Error(
            "Report exceeds 10,000 findings. Split the report before importing.",
          );
        const endpoint = new URL(String(instance.uri || url.href));
        if (
          !["http:", "https:"].includes(endpoint.protocol) ||
          endpoint.origin !== url.origin ||
          endpoint.username ||
          endpoint.password
        )
          throw new Error("An alert endpoint does not match its report site.");
        endpoint.search = "";
        endpoint.hash = "";
        findings.push({
          id: uid(),
          projectId,
          asset: url.origin,
          endpoint: endpoint.href,
          title: plain(alert.name),
          description: plain(alert.desc),
          severity: (["info", "low", "medium", "high"] as Severity[])[risk],
          confidence: Math.max(
            0,
            Math.min(4, Number(alert.confidence) || 0) / 4,
          ),
          status: "new",
          check: String(alert.pluginid),
          evidence: plain(
            instance.evidence ||
              alert.otherinfo ||
              "No evidence text supplied by this scanner.",
          ),
          solution: plain(
            alert.solution ||
              "Review the scanner reference and validate this finding.",
          ),
          source:
            "OWASP ZAP " +
            plain(
              (input as Record<string, unknown>)["@version"] ||
                "unknown version",
            ),
          scanId,
          firstSeen: now,
          lastSeen: now,
          owner: "",
          note: "",
          synthetic: false,
          criticality: 3,
        });
      }
    }
  }
  return {
    findings: mergeFindings([], findings),
    assets: [...new Map(assets.map((a) => [a.url, a])).values()],
    version: plain((input as Record<string, unknown>)["@version"] || "unknown"),
  };
}
export async function hashText(text: string) {
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text),
  );
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
export function emptyWorkspace(): Workspace {
  return {
    version: 1,
    projects: [],
    assets: [],
    findings: [],
    scans: [],
    audit: [],
  };
}
export function validateBackup(value: unknown): value is Workspace {
  try {
    if (!value || typeof value !== "object") return false;
    const w = value as Workspace;
    const text = (v: unknown) => typeof v === "string";
    const date = (v: unknown) =>
      text(v) && Number.isFinite(Date.parse(v as string));
    const url = (v: unknown) => {
      if (!text(v)) return false;
      const u = new URL(v as string);
      return (
        ["http:", "https:"].includes(u.protocol) && !u.username && !u.password
      );
    };
    const bounded = (v: unknown, min: number, max: number) =>
      typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
    if (
      w.version !== 1 ||
      ![w.projects, w.assets, w.findings, w.scans, w.audit].every(Array.isArray)
    )
      return false;
    const unique = (rows: { id: string }[]) =>
      rows.every((r) => r && text(r.id)) &&
      new Set(rows.map((r) => r.id)).size === rows.length;
    if (![w.projects, w.assets, w.findings, w.scans, w.audit].every(unique))
      return false;
    const projects = new Set(w.projects.map((p) => p.id));
    return (
      w.projects.every(
        (p) =>
          text(p.name) &&
          text(p.description) &&
          text(p.environment) &&
          date(p.createdAt) &&
          typeof p.synthetic === "boolean",
      ) &&
      w.assets.every(
        (a) =>
          projects.has(a.projectId) &&
          url(a.url) &&
          text(a.name) &&
          bounded(a.criticality, 1, 5) &&
          typeof a.approved === "boolean" &&
          (!a.approved || isLocalHost(new URL(a.url).hostname)) &&
          Array.isArray(a.exclusions) &&
          a.exclusions.every((e) => text(e) && e.startsWith("/")),
      ) &&
      w.findings.every(
        (f) =>
          projects.has(f.projectId) &&
          url(f.asset) &&
          url(f.endpoint) &&
          severities.includes(f.severity) &&
          statuses.includes(f.status) &&
          bounded(f.confidence, 0, 1) &&
          bounded(f.criticality, 1, 5) &&
          [
            f.title,
            f.description,
            f.check,
            f.evidence,
            f.solution,
            f.source,
            f.scanId,
            f.owner,
            f.note,
          ].every(text) &&
          date(f.firstSeen) &&
          date(f.lastSeen) &&
          typeof f.synthetic === "boolean",
      ) &&
      w.scans.every(
        (s) =>
          projects.has(s.projectId) &&
          date(s.date) &&
          [s.name, s.source, s.hash, s.raw].every(text) &&
          ["imported", "fixture_replayed"].includes(s.status) &&
          typeof s.synthetic === "boolean" &&
          bounded(s.findings, 0, 10000),
      ) &&
      w.audit.every(
        (a) =>
          text(a.projectId) && date(a.time) && text(a.action) && text(a.detail),
      )
    );
  } catch {
    return false;
  }
}
export function demoWorkspace(): Workspace {
  const w = emptyWorkspace();
  const date = "2026-11-24T09:42:00.000Z";
  w.projects = [
    {
      id: "demo",
      name: "Juice Shop Lab",
      description:
        "An isolated OWASP Juice Shop training environment. All findings in this project are synthetic fixtures.",
      environment: "Local lab",
      createdAt: date,
      synthetic: true,
    },
  ];
  w.assets = [
    {
      id: "demo-asset-1",
      projectId: "demo",
      name: "Juice Shop",
      url: "http://localhost:3000",
      criticality: 4,
      approved: true,
      exclusions: ["/logout"],
    },
    {
      id: "demo-asset-2",
      projectId: "demo",
      name: "WebGoat",
      url: "http://localhost:8088",
      criticality: 3,
      approved: true,
      exclusions: [],
    },
  ];
  const rows: [string, Severity, string, string, FindingStatus, string][] = [
    [
      "SQL injection indicator",
      "critical",
      "/rest/products/search",
      "AEG-001",
      "new",
      "Use parameterized queries and enforce server-side input validation.",
    ],
    [
      "Content Security Policy header missing",
      "medium",
      "/",
      "10038",
      "in_progress",
      "Define a Content-Security-Policy header. Begin with report-only mode and remove unsafe-inline.",
    ],
    [
      "Cross-domain configuration",
      "high",
      "/rest/user/whoami",
      "10098",
      "new",
      "Allow only specific trusted origins. Never combine credentials with a wildcard origin.",
    ],
    [
      "Session cookie without HttpOnly",
      "medium",
      "/rest/user/login",
      "10010",
      "confirmed",
      "Set the HttpOnly attribute on session cookies to reduce exposure to client-side scripts.",
    ],
    [
      "Missing anti-clickjacking header",
      "medium",
      "/login",
      "10020",
      "in_progress",
      "Set frame-ancestors in CSP and X-Frame-Options: DENY where appropriate.",
    ],
    [
      "Server version disclosed",
      "low",
      "/api/Products",
      "10036",
      "new",
      "Remove version information from HTTP response headers and default error pages.",
    ],
    [
      "Sensitive data in URL",
      "high",
      "/profile",
      "10024",
      "confirmed",
      "Move sensitive values out of URLs; use request bodies and redact application logs.",
    ],
    [
      "X-Content-Type-Options missing",
      "low",
      "/assets/main.js",
      "10021",
      "new",
      "Send X-Content-Type-Options: nosniff on every HTTP response.",
    ],
    [
      "Cache control requires review",
      "low",
      "/rest/user/whoami",
      "10015",
      "accepted_risk",
      "Apply Cache-Control: no-store to authenticated responses.",
    ],
    [
      "Information disclosure in comments",
      "info",
      "/",
      "10027",
      "new",
      "Remove internal development comments from production responses.",
    ],
    [
      "Session cookie without Secure flag",
      "medium",
      "/login",
      "10011",
      "in_progress",
      "Enable HTTPS and add Secure to session cookies.",
    ],
    [
      "Timestamp disclosure",
      "info",
      "/api/Products",
      "10096",
      "false_positive",
      "Review whether the disclosed timestamp has security significance.",
    ],
  ];
  w.findings = rows.map((r, i) => ({
    id: "demo-f-" + i,
    projectId: "demo",
    asset: "http://localhost:3000",
    endpoint: "http://localhost:3000" + r[2],
    title: r[0],
    description:
      i === 0
        ? "A deterministic training fixture illustrating a potential query injection. This is not a live scanner result and does not establish exploitability."
        : "Synthetic training evidence for " +
          r[0].toLowerCase() +
          ". Validate the condition in an authorized local environment before treating it as confirmed.",
    severity: r[1],
    confidence: i === 0 ? 0.75 : 0.8,
    status: r[4],
    check: r[3],
    evidence:
      i === 0
        ? '[SYNTHETIC FIXTURE]\nGET /rest/products/search\nHTTP/1.1 500 Internal Server Error\n{"error":"SQLITE_ERROR: near expression"}'
        : "[SYNTHETIC FIXTURE]\nGET " +
          r[2] +
          "\nHTTP/1.1 200 OK\nObservation: " +
          r[0] +
          "\nAuthorization: [REDACTED]",
    solution: r[5],
    source:
      i === 0 ? "AegisLab training fixture" : "ZAP-format training fixture",
    scanId: "demo-scan-1",
    firstSeen: date,
    lastSeen: date,
    owner: i === 1 || i === 4 ? "Lab maintainer" : "",
    note: "",
    synthetic: true,
    criticality: 4,
  }));
  w.scans = [
    {
      id: "demo-scan-1",
      projectId: "demo",
      date,
      name: "Juice Shop baseline fixture",
      source: "Synthetic fixture • v1",
      status: "fixture_replayed",
      findings: w.findings.length,
      hash: "",
      synthetic: true,
      raw: JSON.stringify(
        { synthetic: true, fixtureVersion: 1, checks: rows.map((r) => r[3]) },
        null,
        2,
      ),
    },
  ];
  w.audit = [
    {
      id: "demo-event-1",
      projectId: "demo",
      time: date,
      action: "Demo workspace loaded",
      detail:
        "12 synthetic findings. No network requests or scans were performed.",
    },
  ];
  return w;
}

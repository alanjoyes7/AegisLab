import { describe, it, expect } from "vitest";
import {
  demoWorkspace,
  scopePreview,
  parseZap,
  redact,
  priority,
  mergeFindings,
  safeURL,
  isLocalHost,
  emptyWorkspace,
  validateBackup,
} from "./domain";
const demo = demoWorkspace();
function zap(override: Record<string, unknown> = {}) {
  return {
    "@version": "2.16.0",
    site: [
      {
        "@name": "http://localhost:3000",
        alerts: [
          {
            pluginid: "10038",
            name: "CSP missing",
            riskcode: "2",
            confidence: "3",
            desc: "<p>Missing header</p>",
            solution: "Set CSP",
            instances: [
              {
                uri: "http://localhost:3000/login",
                evidence: "Authorization: Bearer abc\nCookie: session=secret",
              },
            ],
            ...override,
          },
        ],
      },
    ],
  };
}
describe("scope boundary checks", () => {
  it("permits an approved exact local origin", () =>
    expect(
      scopePreview("http://localhost:3000/products", demo.assets).allowed,
    ).toBe(true));
  it.each([
    "https://google.com",
    "http://192.168.1.1",
    "http://169.254.169.254",
    "http://localhost.evil.test",
    "http://localhost:3001",
    "http://localhost:3000/logout",
    "http://localhost:3000/logout/child",
    "http://localhost:3000/a/../logout",
    "http://localhost:3000/%6cogout",
    "http://localhost:3000/%2e%2e/logout",
    "http://localhost:3000/logout%2fchild",
    "http://localhost:3000/?token=secret",
    "http://user:secret@localhost:3000",
    "file:///etc/passwd",
    "javascript:alert(1)",
    "http://localhost:3000/#fragment",
  ])("blocks %s", (target) =>
    expect(scopePreview(target, demo.assets).allowed).toBe(false),
  );
  it("does not approve an unapproved asset", () =>
    expect(
      scopePreview(
        "http://localhost:3000",
        demo.assets.map((a) => ({ ...a, approved: false })),
      ).allowed,
    ).toBe(false));
  it("requires path boundaries", () => {
    const assets = [{ ...demo.assets[0], url: "http://localhost:3000/app" }];
    expect(
      scopePreview("http://localhost:3000/application", assets).allowed,
    ).toBe(false);
    expect(
      scopePreview("http://localhost:3000/app/login", assets).allowed,
    ).toBe(true);
  });
  it("does not expand localhost matching", () =>
    expect(isLocalHost("localhost.attacker.test")).toBe(false));
});
describe("normalization and evidence", () => {
  it("maps severity and confidence without inventing CVSS", () => {
    const result = parseZap(zap(), "p", "s");
    expect(result.findings[0]).toMatchObject({
      severity: "medium",
      confidence: 0.75,
      source: "OWASP ZAP 2.16.0",
      synthetic: false,
      description: "Missing header",
    });
    expect(result.assets[0].approved).toBe(false);
    expect(result.findings[0]).not.toHaveProperty("cvss");
  });
  it("redacts headers, secrets, tokens and email patterns", () => {
    const result = redact(
      "Authorization: Bearer abc\nCookie: session=abc\npassword=pw&token=xyz\nuser@example.com",
    );
    expect(result).not.toContain("Bearer abc");
    expect(result).not.toContain("session=abc");
    expect(result).not.toContain("pw");
    expect(result).not.toContain("xyz");
    expect(result).not.toContain("user@example.com");
  });
  it("redacts imported evidence", () =>
    expect(parseZap(zap(), "p", "s").findings[0].evidence).not.toContain(
      "secret",
    ));
  it.each([
    {},
    null,
    { site: [] },
    { site: [{}] },
    zap({ riskcode: 9 }),
    zap({ instances: "invalid" }),
    zap({ pluginid: "" }),
  ])("rejects malformed report %j", (input) =>
    expect(() => parseZap(input, "p", "s")).toThrow(),
  );
  it("rejects cross-origin endpoints", () =>
    expect(() =>
      parseZap(zap({ instances: [{ uri: "http://external.test" }] }), "p", "s"),
    ).toThrow());
  it("rejects credential URLs", () =>
    expect(() => safeURL("http://user:password@localhost:3000")).toThrow());
  it("keeps imported HTML inert as text", () =>
    expect(
      parseZap(zap({ desc: "<script>alert(1)</script><p>hello</p>" }), "p", "s")
        .findings[0].description,
    ).not.toContain("<"));
  it("deduplicates within a report", () =>
    expect(
      parseZap(
        zap({
          instances: [
            { uri: "http://localhost:3000" },
            { uri: "http://localhost:3000" },
          ],
        }),
        "p",
        "s",
      ).findings,
    ).toHaveLength(1));
  it("deduplicates across imports while preserving remediation", () => {
    const first = parseZap(zap(), "p", "s").findings;
    first[0].status = "in_progress";
    first[0].owner = "Team";
    const second = parseZap(zap(), "p", "s2").findings;
    const merged = mergeFindings(first, second);
    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({
      id: first[0].id,
      status: "in_progress",
      owner: "Team",
      scanId: "s2",
    });
  });
  it("detects reappearance of a previously verified finding", () => {
    const first = parseZap(zap(), "p", "s").findings;
    first[0].status = "fixed";
    expect(
      mergeFindings(first, parseZap(zap(), "p", "s2").findings)[0].status,
    ).toBe("regressed");
  });
  it("does not mark missing findings fixed", () => {
    const first = parseZap(zap(), "p", "s").findings;
    expect(mergeFindings(first, [])[0].status).toBe("new");
  });
  it("never merges between projects", () =>
    expect(
      mergeFindings(
        parseZap(zap(), "p", "s").findings,
        parseZap(zap(), "other", "s").findings,
      ),
    ).toHaveLength(2));
});
describe("priority and demo integrity", () => {
  it("uses the documented formula", () =>
    expect(
      priority({ severity: "high", criticality: 4, confidence: 0.8 }),
    ).toBe(81));
  it("caps priority at 100", () =>
    expect(
      priority({ severity: "critical", criticality: 5, confidence: 1 }),
    ).toBe(100));
  it("marks all demo findings synthetic", () =>
    expect(demo.findings.every((f) => f.synthetic)).toBe(true));
  it("has no fake completed scans", () =>
    expect(demo.scans.every((s) => s.status === "fixture_replayed")).toBe(
      true,
    ));
  it("validates the default workspace", () =>
    expect(validateBackup(demo)).toBe(true));
  it("provides an empty workspace", () =>
    expect(emptyWorkspace().findings).toEqual([]));
});
describe("backup validation", () => {
  it("rejects unsafe persisted URLs", () => {
    const data = demoWorkspace();
    data.findings[0].endpoint = "javascript:alert(1)";
    expect(validateBackup(data)).toBe(false);
  });
  it("rejects inconsistent project references", () => {
    const data = demoWorkspace();
    data.findings[0].projectId = "missing";
    expect(validateBackup(data)).toBe(false);
  });
  it("rejects malformed shapes without throwing", () => {
    expect(
      validateBackup({
        version: 1,
        projects: [null],
        assets: [],
        findings: [],
        scans: [],
        audit: [],
      }),
    ).toBe(false);
  });
  it("rejects approved public targets in backups", () => {
    const data = demoWorkspace();
    data.assets[0].url = "https://google.com";
    expect(validateBackup(data)).toBe(false);
  });
});

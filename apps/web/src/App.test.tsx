// @vitest-environment jsdom
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import {
  render,
  screen,
  cleanup,
  fireEvent,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "./main";
beforeEach(() => {
  localStorage.clear();
  location.hash = "overview";
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
});
afterEach(cleanup);
describe("workspace interactions", () => {
  it("labels synthetic data and renders computed metrics", () => {
    render(<App />);
    expect(
      screen.getByText(
        "All findings and evidence are synthetic. No live scans have run.",
        { exact: false },
      ),
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "Security overview" }),
    ).toBeTruthy();
    expect(screen.getByText("SQL injection indicator")).toBeTruthy();
  });
  it("creates a real project and persists it", async () => {
    const u = userEvent.setup();
    render(<App />);
    await u.click(screen.getByText("Create your project"));
    await u.type(screen.getByLabelText("Project name"), "My authorized lab");
    await u.click(screen.getByRole("button", { name: "Create project" }));
    await waitFor(() =>
      expect(
        JSON.parse(
          localStorage.getItem("aegislab.workspace.v1")!,
        ).projects.some(
          (p: { name: string; synthetic: boolean }) =>
            p.name === "My authorized lab" && !p.synthetic,
        ),
      ).toBe(true),
    );
    expect(
      screen.getByText("Project created. Add your first asset."),
    ).toBeTruthy();
  });
  it("rejects public scope in the preview", async () => {
    location.hash = "assets";
    const u = userEvent.setup();
    render(<App />);
    await u.click(screen.getByText("Preview scope"));
    const target = screen.getByLabelText("Target URL");
    await u.clear(target);
    await u.type(target, "https://google.com");
    await u.click(screen.getByRole("button", { name: "Check scope" }));
    expect(screen.getByText("Target blocked")).toBeTruthy();
    expect(screen.getByText("Live execution remains disabled.")).toBeTruthy();
  });
  it("saves remediation without offering manual fixed state", async () => {
    const u = userEvent.setup();
    render(<App />);
    await u.click(screen.getByText("SQL injection indicator"));
    await u.click(screen.getByRole("button", { name: "Remediation" }));
    expect(screen.queryByRole("option", { name: "Fixed" })).toBeNull();
    await u.selectOptions(
      screen.getByLabelText("Lifecycle status"),
      "in_progress",
    );
    await u.type(screen.getByLabelText("Owner"), "Security team");
    await u.click(screen.getByRole("button", { name: "Save remediation" }));
    await waitFor(() => {
      const w = JSON.parse(localStorage.getItem("aegislab.workspace.v1")!);
      expect(w.findings[0].status).toBe("in_progress");
      expect(w.findings[0].owner).toBe("Security team");
    });
  });
  it("requires rationale for accepted risk", async () => {
    const u = userEvent.setup();
    render(<App />);
    await u.click(screen.getByText("SQL injection indicator"));
    await u.click(screen.getByRole("button", { name: "Remediation" }));
    await u.selectOptions(
      screen.getByLabelText("Lifecycle status"),
      "accepted_risk",
    );
    await u.click(screen.getByRole("button", { name: "Save remediation" }));
    expect(screen.getByRole("alert").textContent).toContain("rationale");
  });
  it("filters findings and restores persisted state", async () => {
    location.hash = "findings";
    render(<App />);
    fireEvent.change(screen.getByLabelText("Filter by severity"), {
      target: { value: "critical" },
    });
    expect(screen.getByText("SQL injection indicator")).toBeTruthy();
    expect(screen.queryByText("Server version disclosed")).toBeNull();
    expect(screen.getByText("1 findings · Page 1 of 1")).toBeTruthy();
  });
});
describe("evidence import and recovery", () => {
  it("imports a real ZAP report into a non-demo project", async () => {
    const { webcrypto } = await import("node:crypto");
    vi.stubGlobal("crypto", webcrypto);
    const { emptyWorkspace } = await import("./domain");
    const w = emptyWorkspace();
    w.projects = [
      {
        id: "real",
        name: "Real lab",
        description: "",
        environment: "Local lab",
        createdAt: new Date().toISOString(),
        synthetic: false,
      },
    ];
    localStorage.setItem("aegislab.workspace.v1", JSON.stringify(w));
    location.hash = "scans";
    const u = userEvent.setup();
    render(<App />);
    await u.click(screen.getByRole("button", { name: "New assessment" }));
    await u.click(screen.getByText("Import a ZAP report"));
    const report = {
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
              desc: "Header not present",
              solution: "Set CSP",
              instances: [
                {
                  uri: "http://localhost:3000/",
                  evidence: "Cookie: secret-value",
                },
              ],
            },
          ],
        },
      ],
    };
    const file = new File([JSON.stringify(report)], "report.json", {
      type: "application/json",
    });
    Object.defineProperty(file, "text", {
      value: async () => JSON.stringify(report),
    });
    await u.upload(screen.getByLabelText("ZAP JSON report"), file);
    // jsdom does not update its internal file constraint state from userEvent upload.
    fireEvent.submit(
      screen.getByRole("button", { name: "Import report" }).closest("form")!,
    );
    await waitFor(() => {
      const saved = JSON.parse(localStorage.getItem("aegislab.workspace.v1")!);
      expect(screen.queryByRole("alert")?.textContent).toBeUndefined();
      expect(saved.findings).toHaveLength(1);
      expect(saved.findings[0].synthetic).toBe(false);
      expect(saved.findings[0].confidence).toBe(0.75);
      expect(saved.scans[0].hash).toHaveLength(64);
      expect(saved.scans[0].raw).not.toContain("secret-value");
      expect(saved.assets[0].approved).toBe(false);
    });
    vi.unstubAllGlobals();
  });
  it("requires explicit replacement confirmation to restore a backup", async () => {
    const { demoWorkspace } = await import("./domain");
    location.hash = "settings";
    const u = userEvent.setup();
    render(<App />);
    await u.click(screen.getByRole("button", { name: "Restore a backup" }));
    const data = JSON.stringify(demoWorkspace());
    const file = new File([data], "backup.json", { type: "application/json" });
    Object.defineProperty(file, "text", { value: async () => data });
    await u.upload(screen.getByLabelText("Workspace backup JSON"), file);
    await waitFor(() =>
      expect(screen.getByText(/Backup contains/)).toBeTruthy(),
    );
    expect(
      (
        screen.getByRole("button", {
          name: "Restore workspace",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    await u.click(screen.getByRole("checkbox"));
    expect(
      (
        screen.getByRole("button", {
          name: "Restore workspace",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
    await u.click(screen.getByRole("button", { name: "Restore workspace" }));
    expect(screen.getByText("Workspace restored from backup")).toBeTruthy();
  });
  it("shows real dependency status from the local health endpoint", async () => {
    location.hash = "settings";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            status: "healthy",
            version: "0.1.0",
            services: { database: "healthy", redis: "healthy" },
            scanner: "disabled",
          }),
          { headers: { "content-type": "application/json" } },
        ),
      ),
    );
    const u = userEvent.setup();
    render(<App />);
    await u.click(screen.getByRole("button", { name: "Check local API" }));
    await waitFor(() =>
      expect(
        screen.getByText(
          "API healthy · PostgreSQL healthy · Redis healthy · scanner disabled",
        ),
      ).toBeTruthy(),
    );
    vi.unstubAllGlobals();
  });
});
it("preserves corrupt saved data instead of overwriting it", async () => {
  localStorage.setItem("aegislab.workspace.v1", "{bad-json");
  render(<App />);
  await waitFor(() =>
    expect(screen.getByRole("alert").textContent).toContain(
      "original is preserved",
    ),
  );
  expect(localStorage.getItem("aegislab.workspace.v1")).toBe("{bad-json");
  expect(
    screen.getByRole("button", { name: "Download original data" }),
  ).toBeTruthy();
});

import { describe, expect, it } from "vitest";
import manifest from "../src/manifest.js";

describe("source graph routes", () => {
  it("exposes tracked artifact and event routing APIs", () => {
    expect(manifest.apiRoutes).toBeDefined();
    const routes = new Map(
      manifest.apiRoutes?.map((route) => [route.routeKey, route.path]) ?? [],
    );

    expect(routes.get("tracked-artifacts")).toBe("/tracked-artifacts");
    expect(routes.get("source-events")).toBe("/events");
    expect(routes.get("set-event-status")).toBe("/event-status");
    expect(routes.get("ingest-event")).toBe("/source-events");
    expect(routes.has("backfill-pull-request")).toBe(false);
    expect(routes.has("backfill-open-pull-requests")).toBe(false);
    expect(routes.has("reconcile-active-surfaces")).toBe(false);
    expect(manifest.capabilities).not.toContain("secrets.read-ref");
    expect(manifest.capabilities).not.toContain("jobs.schedule");
    expect(manifest.jobs ?? []).toHaveLength(0);
    expect(
      Object.keys(manifest.instanceConfigSchema?.properties ?? {}),
    ).not.toContain("githubTokenSecretRef");
  });

  it("exposes the source graph page through an icon sidebar slot", () => {
    const sidebarSlot = manifest.ui?.slots?.find(
      (entry) => entry.id === "github-pr-feedback-sidebar",
    );

    expect(manifest.capabilities).toContain("ui.sidebar.register");
    expect(sidebarSlot).toMatchObject({
      type: "sidebar",
      displayName: "GitHub PR Feedback",
      exportName: "GitHubSidebarLink",
    });
  });
});

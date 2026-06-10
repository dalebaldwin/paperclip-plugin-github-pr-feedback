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
    expect(routes.get("backfill-pull-request")).toBe("/backfill/pull-request");
    expect(routes.get("backfill-open-pull-requests")).toBe(
      "/backfill/open-pull-requests",
    );
    expect(routes.get("reconcile-active-surfaces")).toBe(
      "/reconcile/active-surfaces",
    );
  });

  it("exposes the source graph page through the sidebar", () => {
    const launcher = manifest.ui?.launchers?.find(
      (entry) => entry.id === "github-pr-feedback-sidebar",
    );

    expect(manifest.capabilities).toContain("ui.sidebar.register");
    expect(launcher).toMatchObject({
      displayName: "GitHub PR Feedback",
      placementZone: "sidebar",
      action: {
        type: "navigate",
        target: "github-pr-feedback",
      },
    });
  });
});

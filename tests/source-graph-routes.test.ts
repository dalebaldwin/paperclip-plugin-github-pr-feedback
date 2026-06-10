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
  });
});

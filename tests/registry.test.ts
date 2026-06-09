import { describe, expect, it } from "vitest";
import {
  expectedSurfacesForArtifact,
  normalizeArtifactInput,
  normalizeEdgeInput,
  normalizeLifecycleInput,
  normalizeListActiveSurfacesInput,
  normalizeSurfaceInput,
} from "../src/registry.js";

describe("GitHub source artifact registry", () => {
  it("normalizes artifact registration with active lifecycle default", () => {
    const artifact = normalizeArtifactInput({
      companyId: " company-1 ",
      source: "github",
      artifactKind: "pull_request",
      externalId: " Sojournii/sojournii-monorepo#1161 ",
      repository: " Sojournii/sojournii-monorepo ",
      title: " Storybook deploy flow ",
    });

    expect(artifact).toMatchObject({
      companyId: "company-1",
      source: "github",
      artifactKind: "pull_request",
      externalId: "Sojournii/sojournii-monorepo#1161",
      repository: "Sojournii/sojournii-monorepo",
      title: "Storybook deploy flow",
      status: "active",
    });
  });

  it("normalizes edges between registered artifact refs", () => {
    const edge = normalizeEdgeInput({
      companyId: "company-1",
      from: {
        source: "github",
        artifactKind: "pull_request",
        externalId: "Sojournii/sojournii-monorepo#1161",
      },
      to: {
        source: "github",
        artifactKind: "check_suite",
        externalId: "suite-1",
      },
      relationship: "ci_status",
    });

    expect(edge.relationship).toBe("ci_status");
    expect(edge.to.externalId).toBe("suite-1");
  });

  it("requires valid GitHub source surfaces", () => {
    expect(() =>
      normalizeSurfaceInput({
        companyId: "company-1",
        artifact: {
          source: "github",
          artifactKind: "pull_request",
          externalId: "Sojournii/sojournii-monorepo#1161",
        },
        surface: "pull_request_review_threads",
      }),
    ).not.toThrow();

    expect(() =>
      normalizeSurfaceInput({
        companyId: "company-1",
        artifact: {
          source: "github",
          artifactKind: "pull_request",
          externalId: "Sojournii/sojournii-monorepo#1161",
        },
        surface: "jira_comments" as never,
      }),
    ).toThrow(/unsupported source surface/);
  });

  it("normalizes lifecycle updates", () => {
    const lifecycle = normalizeLifecycleInput({
      companyId: "company-1",
      artifact: {
        source: "github",
        artifactKind: "pull_request",
        externalId: "Sojournii/sojournii-monorepo#1161",
      },
      status: "grace",
      reason: "PR merged; keep a late feedback grace window.",
    });

    expect(lifecycle.status).toBe("grace");
  });

  it("defaults active surface listing to watchable lifecycle states", () => {
    const input = normalizeListActiveSurfacesInput({ companyId: "company-1" });

    expect(input.statuses).toEqual([
      "registered",
      "active",
      "grace",
      "reopened",
    ]);
  });

  it("declares expected GitHub surfaces by artifact kind", () => {
    expect(expectedSurfacesForArtifact("pull_request")).toEqual([
      "pull_request_comments",
      "pull_request_reviews",
      "pull_request_review_threads",
      "check_runs",
      "workflow_runs",
    ]);
    expect(expectedSurfacesForArtifact("issue")).toEqual(["issue_comments"]);
  });
});

import type {
  ListActiveSurfacesInput,
  RegisterSourceArtifactEdgeInput,
  RegisterSourceArtifactInput,
  RegisterSourceSurfaceInput,
  SetSourceArtifactLifecycleInput,
  SourceArtifactKind,
  SourceArtifactLifecycleStatus,
  SourceArtifactRef,
  SourceSurface,
} from "./types.js";

export const DEFAULT_ACTIVE_LIFECYCLE_STATUSES: SourceArtifactLifecycleStatus[] =
  ["registered", "active", "grace", "reopened"];

export const LIFECYCLE_STATUSES = new Set<SourceArtifactLifecycleStatus>([
  "registered",
  "active",
  "grace",
  "closed",
  "archived",
  "reopened",
]);

export const GITHUB_SURFACES = new Set<SourceSurface>([
  "issue_comments",
  "pull_request_comments",
  "pull_request_reviews",
  "pull_request_review_threads",
  "check_runs",
  "check_suites",
  "workflow_runs",
]);

export function normalizeArtifactInput(
  input: RegisterSourceArtifactInput,
): RegisterSourceArtifactInput {
  const companyId = requiredString(input.companyId, "companyId");
  if (input.source !== "github") {
    throw new Error("source must be github");
  }
  validateArtifactKind(input.artifactKind);
  const status = input.status ?? "active";
  validateLifecycleStatus(status);

  return {
    companyId,
    source: "github",
    artifactKind: input.artifactKind,
    externalId: requiredString(input.externalId, "externalId"),
    repository: optionalString(input.repository),
    url: optionalString(input.url),
    title: optionalString(input.title),
    status,
    ownerLane: optionalString(input.ownerLane),
    discoveredFrom: optionalString(input.discoveredFrom),
  };
}

export function normalizeArtifactRef(ref: SourceArtifactRef): SourceArtifactRef {
  if (optionalString(ref.id)) {
    return { id: optionalString(ref.id) };
  }
  if (ref.source !== "github") {
    throw new Error("artifact source must be github");
  }
  validateArtifactKind(ref.artifactKind);
  return {
    source: "github",
    artifactKind: ref.artifactKind,
    externalId: requiredString(ref.externalId, "artifact.externalId"),
  };
}

export function normalizeEdgeInput(
  input: RegisterSourceArtifactEdgeInput,
): RegisterSourceArtifactEdgeInput {
  return {
    companyId: requiredString(input.companyId, "companyId"),
    from: normalizeArtifactRef(input.from),
    to: normalizeArtifactRef(input.to),
    relationship: requiredString(input.relationship, "relationship"),
  };
}

export function normalizeSurfaceInput(
  input: RegisterSourceSurfaceInput,
): RegisterSourceSurfaceInput {
  validateSurface(input.surface);
  return {
    companyId: requiredString(input.companyId, "companyId"),
    artifact: normalizeArtifactRef(input.artifact),
    surface: input.surface,
    cursorExternalId: optionalString(input.cursorExternalId),
    cursorVersion:
      input.cursorVersion === undefined ? undefined : String(input.cursorVersion),
    lastScanAt: optionalString(input.lastScanAt),
  };
}

export function normalizeLifecycleInput(
  input: SetSourceArtifactLifecycleInput,
): SetSourceArtifactLifecycleInput {
  validateLifecycleStatus(input.status);
  return {
    companyId: requiredString(input.companyId, "companyId"),
    artifact: normalizeArtifactRef(input.artifact),
    status: input.status,
    reason: optionalString(input.reason),
  };
}

export function normalizeListActiveSurfacesInput(
  input: ListActiveSurfacesInput,
): ListActiveSurfacesInput {
  const statuses = input.statuses?.length
    ? input.statuses
    : DEFAULT_ACTIVE_LIFECYCLE_STATUSES;
  for (const status of statuses) {
    validateLifecycleStatus(status);
  }
  return {
    companyId: requiredString(input.companyId, "companyId"),
    statuses,
  };
}

export function expectedSurfacesForArtifact(
  artifactKind: SourceArtifactKind,
): SourceSurface[] {
  if (artifactKind === "pull_request") {
    return [
      "pull_request_comments",
      "pull_request_reviews",
      "pull_request_review_threads",
      "check_runs",
      "workflow_runs",
    ];
  }
  if (artifactKind === "issue") {
    return ["issue_comments"];
  }
  if (artifactKind === "check_suite") {
    return ["check_suites", "check_runs"];
  }
  if (artifactKind === "check_run") {
    return ["check_runs"];
  }
  if (artifactKind === "review_thread") {
    return ["pull_request_review_threads"];
  }
  return [];
}

function validateArtifactKind(value: SourceArtifactKind | undefined) {
  if (
    value !== "repository" &&
    value !== "issue" &&
    value !== "pull_request" &&
    value !== "review_thread" &&
    value !== "check_suite" &&
    value !== "check_run"
  ) {
    throw new Error("unsupported artifactKind");
  }
}

function validateLifecycleStatus(status: SourceArtifactLifecycleStatus) {
  if (!LIFECYCLE_STATUSES.has(status)) {
    throw new Error(`unsupported artifact lifecycle status: ${status}`);
  }
}

function validateSurface(surface: SourceSurface) {
  if (!GITHUB_SURFACES.has(surface)) {
    throw new Error(`unsupported source surface: ${surface}`);
  }
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${field} is required`);
  }
  return value.trim();
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== ""
    ? value.trim()
    : undefined;
}

export type SourceSystem = "github";

export type SourceArtifactKind =
  | "repository"
  | "issue"
  | "pull_request"
  | "review_thread"
  | "check_suite"
  | "check_run";

export type SourceSurface =
  | "issue_comments"
  | "pull_request_comments"
  | "pull_request_reviews"
  | "pull_request_review_threads"
  | "check_runs"
  | "check_suites"
  | "workflow_runs";

export type SourceEventStatus = "new" | "routed" | "ignored" | "blocked";

export type SourceArtifactLifecycleStatus =
  | "registered"
  | "active"
  | "grace"
  | "closed"
  | "archived"
  | "reopened";

export interface SourceArtifactRef {
  id?: string;
  source?: SourceSystem;
  artifactKind?: SourceArtifactKind;
  externalId?: string;
}

export interface RegisterSourceArtifactInput {
  companyId: string;
  source: SourceSystem;
  artifactKind: SourceArtifactKind;
  externalId: string;
  repository?: string;
  url?: string;
  title?: string;
  status?: SourceArtifactLifecycleStatus;
  ownerLane?: string;
  discoveredFrom?: string;
}

export interface RegisterSourceArtifactEdgeInput {
  companyId: string;
  from: SourceArtifactRef;
  to: SourceArtifactRef;
  relationship: string;
}

export interface RegisterSourceSurfaceInput {
  companyId: string;
  artifact: SourceArtifactRef;
  surface: SourceSurface;
  cursorExternalId?: string;
  cursorVersion?: string | number;
  lastScanAt?: string;
}

export interface SetSourceArtifactLifecycleInput {
  companyId: string;
  artifact: SourceArtifactRef;
  status: SourceArtifactLifecycleStatus;
  reason?: string;
}

export interface ListActiveSurfacesInput {
  companyId: string;
  statuses?: SourceArtifactLifecycleStatus[];
}

export interface SourceEventInput {
  companyId: string;
  source: SourceSystem;
  artifactKind: SourceArtifactKind;
  artifactExternalId: string;
  repository?: string;
  artifactUrl?: string;
  artifactTitle?: string;
  surface: SourceSurface;
  externalEventId: string;
  externalParentId?: string;
  version?: string | number;
  authorLogin?: string;
  authorType?: "human" | "agent" | "bot" | "unknown";
  createdAt?: string;
  updatedAt?: string;
  bodyText?: string;
  bodyHash?: string;
  raw?: unknown;
}

export interface NormalizedSourceEvent {
  companyId: string;
  source: SourceSystem;
  artifactKind: SourceArtifactKind;
  artifactExternalId: string;
  repository: string | null;
  artifactUrl: string | null;
  artifactTitle: string | null;
  surface: SourceSurface;
  externalEventId: string;
  externalParentId: string | null;
  version: string;
  authorLogin: string | null;
  authorType: "human" | "agent" | "bot" | "unknown";
  createdAt: string | null;
  updatedAt: string | null;
  bodyText: string | null;
  bodyHash: string;
  raw: unknown;
}

export interface WebhookEnvelope {
  source: SourceSystem;
  eventType: string;
  webhookEventId: string;
  payload: unknown;
}

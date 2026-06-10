import { expectedSurfacesForArtifact } from "./registry.js";
import type {
  RegisterSourceArtifactInput,
  SourceArtifactLifecycleStatus,
  SourceEventInput,
  SourceSurface,
} from "./types.js";

export interface GitHubWebhookIngestPlan {
  artifact: RegisterSourceArtifactInput;
  surfaces: SourceSurface[];
  events: SourceEventInput[];
}

export function buildGitHubWebhookIngestPlans(input: {
  companyId: string;
  eventType: string;
  deliveryId: string;
  payload: unknown;
}): GitHubWebhookIngestPlan[] {
  const payload = recordValue(input.payload);
  const repository = stringValue(recordValue(payload.repository).full_name);
  if (!repository) return [];

  if (input.eventType === "pull_request") {
    const pullRequest = recordValue(payload.pull_request);
    const number = numberValue(pullRequest.number);
    if (!number) return [];
    return [
      {
        artifact: pullRequestArtifact({
          companyId: input.companyId,
          repository,
          pullRequest,
          status: statusForPullRequestAction(stringValue(payload.action)),
          discoveredFrom: `webhook:${input.deliveryId}`,
        }),
        surfaces: expectedSurfacesForArtifact("pull_request"),
        events: [],
      },
    ];
  }

  if (input.eventType === "issue_comment") {
    const issue = recordValue(payload.issue);
    if (!isRecord(issue.pull_request)) return [];
    const number = numberValue(issue.number);
    const comment = recordValue(payload.comment);
    if (!number || !stringValue(comment.id)) return [];
    const pullRequest = {
      number,
      title: issue.title,
      html_url: stringValue(issue.html_url)?.replace("/issues/", "/pull/"),
    };
    return [
      {
        artifact: pullRequestArtifact({
          companyId: input.companyId,
          repository,
          pullRequest,
          discoveredFrom: `webhook:${input.deliveryId}`,
        }),
        surfaces: expectedSurfacesForArtifact("pull_request"),
        events: [
          sourceEvent({
            companyId: input.companyId,
            repository,
            pullRequest,
            surface: "pull_request_comments",
            externalEventId: requiredString(comment.id, "comment.id"),
            version: stringValue(comment.updated_at) ?? stringValue(comment.created_at) ?? "1",
            authorLogin: stringValue(recordValue(comment.user).login),
            createdAt: stringValue(comment.created_at),
            updatedAt: stringValue(comment.updated_at),
            bodyText: stringValue(comment.body),
            raw: comment,
          }),
        ],
      },
    ];
  }

  if (input.eventType === "pull_request_review") {
    const pullRequest = recordValue(payload.pull_request);
    const review = recordValue(payload.review);
    if (!numberValue(pullRequest.number) || !stringValue(review.id)) return [];
    return [
      {
        artifact: pullRequestArtifact({
          companyId: input.companyId,
          repository,
          pullRequest,
          discoveredFrom: `webhook:${input.deliveryId}`,
        }),
        surfaces: expectedSurfacesForArtifact("pull_request"),
        events: [
          sourceEvent({
            companyId: input.companyId,
            repository,
            pullRequest,
            surface: "pull_request_reviews",
            externalEventId: requiredString(review.id, "review.id"),
            version: stringValue(review.submitted_at) ?? "1",
            authorLogin: stringValue(recordValue(review.user).login),
            createdAt: stringValue(review.submitted_at),
            updatedAt: stringValue(review.submitted_at),
            bodyText: [stringValue(review.state), stringValue(review.body)]
              .filter(Boolean)
              .join(": "),
            raw: review,
          }),
        ],
      },
    ];
  }

  if (input.eventType === "pull_request_review_comment") {
    const pullRequest = recordValue(payload.pull_request);
    const comment = recordValue(payload.comment);
    if (!numberValue(pullRequest.number) || !stringValue(comment.id)) return [];
    return [
      {
        artifact: pullRequestArtifact({
          companyId: input.companyId,
          repository,
          pullRequest,
          discoveredFrom: `webhook:${input.deliveryId}`,
        }),
        surfaces: expectedSurfacesForArtifact("pull_request"),
        events: [
          sourceEvent({
            companyId: input.companyId,
            repository,
            pullRequest,
            surface: "pull_request_comments",
            externalEventId: requiredString(comment.id, "reviewComment.id"),
            externalParentId:
              stringValue(comment.in_reply_to_id) ??
              stringValue(comment.pull_request_review_id) ??
              undefined,
            version: stringValue(comment.updated_at) ?? stringValue(comment.created_at) ?? "1",
            authorLogin: stringValue(recordValue(comment.user).login),
            createdAt: stringValue(comment.created_at),
            updatedAt: stringValue(comment.updated_at),
            bodyText: stringValue(comment.body),
            raw: comment,
          }),
        ],
      },
    ];
  }

  if (input.eventType === "check_run") {
    const checkRun = recordValue(payload.check_run);
    return plansForPullRequestArray({
      companyId: input.companyId,
      repository,
      deliveryId: input.deliveryId,
      pullRequests: arrayValue(checkRun.pull_requests),
      surface: "check_runs",
      event: checkRun,
      externalEventField: "id",
      version:
        stringValue(checkRun.completed_at) ??
        stringValue(checkRun.started_at) ??
        stringValue(checkRun.status) ??
        "1",
      authorLogin: stringValue(recordValue(checkRun.app).slug),
      authorType: "bot",
      bodyText: [stringValue(checkRun.name), stringValue(checkRun.status), stringValue(checkRun.conclusion)]
        .filter(Boolean)
        .join(": "),
      createdAt: stringValue(checkRun.started_at),
      updatedAt: stringValue(checkRun.completed_at),
    });
  }

  if (input.eventType === "workflow_run") {
    const workflowRun = recordValue(payload.workflow_run);
    return plansForPullRequestArray({
      companyId: input.companyId,
      repository,
      deliveryId: input.deliveryId,
      pullRequests: arrayValue(workflowRun.pull_requests),
      surface: "workflow_runs",
      event: workflowRun,
      externalEventField: "id",
      version:
        stringValue(workflowRun.updated_at) ??
        stringValue(workflowRun.created_at) ??
        stringValue(workflowRun.status) ??
        "1",
      authorLogin: stringValue(recordValue(workflowRun.actor).login),
      bodyText: [
        stringValue(workflowRun.name),
        stringValue(workflowRun.status),
        stringValue(workflowRun.conclusion),
      ]
        .filter(Boolean)
        .join(": "),
      createdAt: stringValue(workflowRun.created_at),
      updatedAt: stringValue(workflowRun.updated_at),
    });
  }

  return [];
}

function plansForPullRequestArray(input: {
  companyId: string;
  repository: string;
  deliveryId: string;
  pullRequests: Record<string, unknown>[];
  surface: SourceSurface;
  event: Record<string, unknown>;
  externalEventField: string;
  version: string;
  authorLogin: string | null;
  authorType?: "human" | "agent" | "bot" | "unknown";
  bodyText: string;
  createdAt: string | null;
  updatedAt: string | null;
}): GitHubWebhookIngestPlan[] {
  const externalEventId = stringValue(input.event[input.externalEventField]);
  if (!externalEventId) return [];
  return input.pullRequests
    .map((pullRequest) => {
      if (!numberValue(pullRequest.number)) return null;
      return {
        artifact: pullRequestArtifact({
          companyId: input.companyId,
          repository: input.repository,
          pullRequest,
          discoveredFrom: `webhook:${input.deliveryId}`,
        }),
        surfaces: expectedSurfacesForArtifact("pull_request"),
        events: [
          sourceEvent({
            companyId: input.companyId,
            repository: input.repository,
            pullRequest,
            surface: input.surface,
            externalEventId,
            version: input.version,
            authorLogin: input.authorLogin,
            authorType: input.authorType,
            createdAt: input.createdAt,
            updatedAt: input.updatedAt,
            bodyText: input.bodyText,
            raw: input.event,
          }),
        ],
      };
    })
    .filter((plan): plan is GitHubWebhookIngestPlan => plan !== null);
}

function pullRequestArtifact(input: {
  companyId: string;
  repository: string;
  pullRequest: Record<string, unknown>;
  status?: SourceArtifactLifecycleStatus;
  discoveredFrom?: string;
}): RegisterSourceArtifactInput {
  const number = requiredString(input.pullRequest.number, "pull_request.number");
  return {
    companyId: input.companyId,
    source: "github",
    artifactKind: "pull_request",
    externalId: `${input.repository}#${number}`,
    repository: input.repository,
    url: stringValue(input.pullRequest.html_url) ?? undefined,
    title: stringValue(input.pullRequest.title) ?? `PR #${number}`,
    status: input.status ?? "active",
    discoveredFrom: input.discoveredFrom,
  };
}

function sourceEvent(input: {
  companyId: string;
  repository: string;
  pullRequest: Record<string, unknown>;
  surface: SourceSurface;
  externalEventId: string;
  externalParentId?: string;
  version: string;
  authorLogin: string | null;
  authorType?: "human" | "agent" | "bot" | "unknown";
  createdAt: string | null;
  updatedAt: string | null;
  bodyText: string | null;
  raw: Record<string, unknown>;
}): SourceEventInput {
  const number = requiredString(input.pullRequest.number, "pull_request.number");
  return {
    companyId: input.companyId,
    source: "github",
    artifactKind: "pull_request",
    artifactExternalId: `${input.repository}#${number}`,
    repository: input.repository,
    artifactUrl: stringValue(input.pullRequest.html_url) ?? undefined,
    artifactTitle: stringValue(input.pullRequest.title) ?? `PR #${number}`,
    surface: input.surface,
    externalEventId: input.externalEventId,
    externalParentId: input.externalParentId,
    version: input.version,
    authorLogin: input.authorLogin ?? undefined,
    authorType: input.authorType ?? "human",
    createdAt: input.createdAt ?? undefined,
    updatedAt: input.updatedAt ?? undefined,
    bodyText: input.bodyText ?? undefined,
    raw: input.raw,
  };
}

function statusForPullRequestAction(action: string | null): SourceArtifactLifecycleStatus {
  if (action === "closed") return "closed";
  if (action === "reopened") return "reopened";
  return "active";
}

function requiredString(value: unknown, field: string): string {
  const result = stringValue(value);
  if (!result) throw new Error(`${field} is required`);
  return result;
}

function stringValue(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function numberValue(value: unknown): number | null {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function recordValue(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function arrayValue(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => isRecord(item))
    : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

import type { PluginContext } from "@paperclipai/plugin-sdk";
import type { SourceEventInput } from "./types.js";

type RecordSourceEvent = (input: SourceEventInput) => Promise<unknown>;

export type BackfillPullRequestInput = {
  companyId: string;
  repository: string;
  pullRequestNumber: number;
};

export type BackfillOpenPullRequestsInput = {
  companyId: string;
  repository: string;
  maxPullRequests?: number;
};

type GitHubConfig = {
  githubTokenSecretRef?: string;
};

type BackfillResult = {
  artifact: string;
  scannedSurfaces: string[];
  recordedEvents: number;
  scannedPullRequests?: number;
};

export async function backfillPullRequest(
  ctx: PluginContext,
  input: BackfillPullRequestInput,
  record: RecordSourceEvent,
): Promise<BackfillResult> {
  const companyId = required(input.companyId, "companyId");
  const repository = normalizeRepository(input.repository);
  const pullRequestNumber = normalizePullRequestNumber(input.pullRequestNumber);
  const token = await githubToken(ctx);
  const pullRequest = await githubJson<Record<string, unknown>>(
    ctx,
    `/repos/${repository}/pulls/${pullRequestNumber}`,
    token,
  );
  const title = stringValue(pullRequest.title) ?? `PR #${pullRequestNumber}`;
  const url = stringValue(pullRequest.html_url) ?? null;
  const artifactExternalId = `${repository}#${pullRequestNumber}`;
  const headSha = stringValue(recordValue(pullRequest.head).sha);

  const [issueComments, reviewComments, reviews, checkRuns, workflowRuns] =
    await Promise.all([
      githubPaged(ctx, `/repos/${repository}/issues/${pullRequestNumber}/comments?per_page=100`, token),
      githubPaged(ctx, `/repos/${repository}/pulls/${pullRequestNumber}/comments?per_page=100`, token),
      githubPaged(ctx, `/repos/${repository}/pulls/${pullRequestNumber}/reviews?per_page=100`, token),
      headSha
        ? githubJson<Record<string, unknown>>(
            ctx,
            `/repos/${repository}/commits/${headSha}/check-runs?per_page=100`,
            token,
          ).then((page) => arrayValue(page.check_runs))
        : Promise.resolve([]),
      headSha
        ? githubPaged(ctx, `/repos/${repository}/actions/runs?head_sha=${encodeURIComponent(headSha)}&per_page=100`, token)
        : Promise.resolve([]),
    ]);

  let recordedEvents = 0;
  for (const comment of issueComments) {
    recordedEvents += await recordGitHubEvent(record, {
      companyId,
      repository,
      artifactExternalId,
      title,
      url,
      surface: "pull_request_comments",
      externalEventId: required(stringValue(comment.id), "comment.id"),
      version: stringValue(comment.updated_at) ?? stringValue(comment.created_at) ?? "1",
      authorLogin: stringValue(recordValue(comment.user).login),
      createdAt: stringValue(comment.created_at),
      updatedAt: stringValue(comment.updated_at),
      bodyText: stringValue(comment.body),
      raw: comment,
    });
  }

  for (const comment of reviewComments) {
    recordedEvents += await recordGitHubEvent(record, {
      companyId,
      repository,
      artifactExternalId,
      title,
      url,
      surface: "pull_request_comments",
      externalEventId: required(stringValue(comment.id), "reviewComment.id"),
      externalParentId: stringValue(comment.in_reply_to_id) ?? undefined,
      version: stringValue(comment.updated_at) ?? stringValue(comment.created_at) ?? "1",
      authorLogin: stringValue(recordValue(comment.user).login),
      createdAt: stringValue(comment.created_at),
      updatedAt: stringValue(comment.updated_at),
      bodyText: stringValue(comment.body),
      raw: comment,
    });
  }

  for (const review of reviews) {
    recordedEvents += await recordGitHubEvent(record, {
      companyId,
      repository,
      artifactExternalId,
      title,
      url,
      surface: "pull_request_reviews",
      externalEventId: required(stringValue(review.id), "review.id"),
      version: stringValue(review.submitted_at) ?? "1",
      authorLogin: stringValue(recordValue(review.user).login),
      createdAt: stringValue(review.submitted_at),
      updatedAt: stringValue(review.submitted_at),
      bodyText: [stringValue(review.state), stringValue(review.body)]
        .filter(Boolean)
        .join(": "),
      raw: review,
    });
  }

  for (const checkRun of checkRuns) {
    recordedEvents += await recordGitHubEvent(record, {
      companyId,
      repository,
      artifactExternalId,
      title,
      url,
      surface: "check_runs",
      externalEventId: required(stringValue(checkRun.id), "checkRun.id"),
      version:
        stringValue(checkRun.completed_at) ??
        stringValue(checkRun.started_at) ??
        stringValue(checkRun.status) ??
        "1",
      authorLogin: stringValue(recordValue(checkRun.app).slug),
      authorType: "bot",
      createdAt: stringValue(checkRun.started_at),
      updatedAt: stringValue(checkRun.completed_at),
      bodyText: [
        stringValue(checkRun.name),
        stringValue(checkRun.status),
        stringValue(checkRun.conclusion),
      ]
        .filter(Boolean)
        .join(": "),
      raw: checkRun,
    });
  }

  for (const workflowRun of workflowRuns) {
    recordedEvents += await recordGitHubEvent(record, {
      companyId,
      repository,
      artifactExternalId,
      title,
      url,
      surface: "workflow_runs",
      externalEventId: required(stringValue(workflowRun.id), "workflowRun.id"),
      version:
        stringValue(workflowRun.updated_at) ??
        stringValue(workflowRun.created_at) ??
        stringValue(workflowRun.status) ??
        "1",
      authorLogin: stringValue(recordValue(workflowRun.actor).login),
      createdAt: stringValue(workflowRun.created_at),
      updatedAt: stringValue(workflowRun.updated_at),
      bodyText: [
        stringValue(workflowRun.name),
        stringValue(workflowRun.status),
        stringValue(workflowRun.conclusion),
      ]
        .filter(Boolean)
        .join(": "),
      raw: workflowRun,
    });
  }

  return {
    artifact: artifactExternalId,
    scannedSurfaces: [
      "pull_request_comments",
      "pull_request_reviews",
      "check_runs",
      "workflow_runs",
    ],
    recordedEvents,
  };
}

export async function backfillOpenPullRequests(
  ctx: PluginContext,
  input: BackfillOpenPullRequestsInput,
  record: RecordSourceEvent,
): Promise<BackfillResult> {
  const companyId = required(input.companyId, "companyId");
  const repository = normalizeRepository(input.repository);
  const maxPullRequests = Math.max(1, Math.min(input.maxPullRequests ?? 25, 100));
  const token = await githubToken(ctx);
  const pulls = (
    await githubPaged(
      ctx,
      `/repos/${repository}/pulls?state=open&sort=updated&direction=desc&per_page=100`,
      token,
    )
  ).slice(0, maxPullRequests);

  let recordedEvents = 0;
  for (const pull of pulls) {
    const number = Number(pull.number);
    if (!Number.isFinite(number)) continue;
    const result = await backfillPullRequest(
      ctx,
      { companyId, repository, pullRequestNumber: number },
      record,
    );
    recordedEvents += result.recordedEvents;
  }

  return {
    artifact: repository,
    scannedSurfaces: [
      "pull_request_comments",
      "pull_request_reviews",
      "check_runs",
      "workflow_runs",
    ],
    recordedEvents,
    scannedPullRequests: pulls.length,
  };
}

async function recordGitHubEvent(
  record: RecordSourceEvent,
  input: {
    companyId: string;
    repository: string;
    artifactExternalId: string;
    title: string;
    url: string | null;
    surface:
      | "pull_request_comments"
      | "pull_request_reviews"
      | "check_runs"
      | "workflow_runs";
    externalEventId: string;
    externalParentId?: string;
    version: string;
    authorLogin: string | null;
    authorType?: "human" | "agent" | "bot" | "unknown";
    createdAt: string | null;
    updatedAt: string | null;
    bodyText: string | null;
    raw: Record<string, unknown>;
  },
) {
  await record({
    companyId: input.companyId,
    source: "github",
    artifactKind: "pull_request",
    artifactExternalId: input.artifactExternalId,
    repository: input.repository,
    artifactUrl: input.url ?? undefined,
    artifactTitle: input.title,
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
  });
  return 1;
}

async function githubToken(ctx: PluginContext): Promise<string> {
  const config = (await ctx.config.get()) as GitHubConfig;
  const secretRef = required(config.githubTokenSecretRef, "githubTokenSecretRef");
  return ctx.secrets.resolve(secretRef);
}

async function githubPaged(
  ctx: PluginContext,
  path: string,
  token: string,
): Promise<Record<string, unknown>[]> {
  const results: Record<string, unknown>[] = [];
  let nextUrl: string | null = `https://api.github.com${path}`;
  while (nextUrl) {
    const response = await githubFetch(ctx, nextUrl, token);
    const page = (await response.json()) as unknown;
    if (Array.isArray(page)) {
      results.push(...arrayValue(page));
    } else if (isRecord(page)) {
      results.push(...arrayValue(page.workflow_runs));
    }
    nextUrl = nextLink(response.headers.get("link"));
  }
  return results;
}

async function githubJson<T>(
  ctx: PluginContext,
  path: string,
  token: string,
): Promise<T> {
  const response = await githubFetch(ctx, `https://api.github.com${path}`, token);
  return (await response.json()) as T;
}

async function githubFetch(ctx: PluginContext, url: string, token: string) {
  const response = await ctx.http.fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "paperclip-plugin-github-pr-feedback",
    },
  });
  if (!response.ok) {
    throw new Error(`GitHub request failed (${response.status}): ${url}`);
  }
  return response;
}

function nextLink(header: string | null): string | null {
  if (!header) return null;
  for (const part of header.split(",")) {
    const [urlPart, relPart] = part.split(";").map((value) => value.trim());
    if (relPart === 'rel="next"') {
      return urlPart?.replace(/^<|>$/g, "") ?? null;
    }
  }
  return null;
}

function normalizeRepository(value: unknown): string {
  const repository = required(value, "repository");
  if (!/^[^/]+\/[^/]+$/.test(repository)) {
    throw new Error("repository must be in owner/name format");
  }
  return repository;
}

function normalizePullRequestNumber(value: unknown): number {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(number) || number < 1) {
    throw new Error("pullRequestNumber must be a positive integer");
  }
  return number;
}

function required(value: unknown, field: string): string {
  const result = stringValue(value);
  if (!result) throw new Error(`${field} is required`);
  return result;
}

function stringValue(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
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

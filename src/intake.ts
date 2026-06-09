import { createHash } from "node:crypto";
import type {
  NormalizedSourceEvent,
  SourceEventInput,
  SourceSurface,
  WebhookEnvelope,
} from "./types.js";
import { GITHUB_SURFACES } from "./registry.js";

export function stableHash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function isThreadedSurface(surface: SourceSurface): boolean {
  return surface === "pull_request_review_threads";
}

export function normalizeSourceEvent(
  input: SourceEventInput,
): NormalizedSourceEvent {
  const missing = [
    ["companyId", input.companyId],
    ["source", input.source],
    ["artifactKind", input.artifactKind],
    ["artifactExternalId", input.artifactExternalId],
    ["surface", input.surface],
    ["externalEventId", input.externalEventId],
  ].filter(([, value]) => typeof value !== "string" || value.trim() === "");

  if (missing.length > 0) {
    throw new Error(
      `Missing required source event field(s): ${missing
        .map(([key]) => key)
        .join(", ")}`,
    );
  }

  if (input.source !== "github") {
    throw new Error("source must be github");
  }

  if (!GITHUB_SURFACES.has(input.surface)) {
    throw new Error(`Unsupported source surface: ${input.surface}`);
  }

  if (isThreadedSurface(input.surface) && !input.externalParentId) {
    throw new Error(`${input.surface} events must include externalParentId`);
  }

  const bodyText = input.bodyText?.trim() || null;
  const bodyHash = input.bodyHash || stableHash(bodyText ?? "");

  return {
    companyId: input.companyId.trim(),
    source: "github",
    artifactKind: input.artifactKind,
    artifactExternalId: input.artifactExternalId.trim(),
    repository: input.repository?.trim() || null,
    artifactUrl: input.artifactUrl?.trim() || null,
    artifactTitle: input.artifactTitle?.trim() || null,
    surface: input.surface,
    externalEventId: input.externalEventId.trim(),
    externalParentId: input.externalParentId?.trim() || null,
    version: String(input.version ?? "1"),
    authorLogin: input.authorLogin?.trim() || null,
    authorType: input.authorType ?? "unknown",
    createdAt: input.createdAt ?? null,
    updatedAt: input.updatedAt ?? null,
    bodyText,
    bodyHash,
    raw: input.raw ?? null,
  };
}

export function parseGitHubWebhook(
  requestId: string,
  headers: Record<string, string | string[]>,
  parsedBody: unknown,
): WebhookEnvelope {
  const eventType =
    stringHeader(headers["x-github-event"]) ??
    stringField(isRecord(parsedBody) ? parsedBody.action : undefined) ??
    "unknown";
  const webhookEventId = stringHeader(headers["x-github-delivery"]) ?? requestId;
  return {
    source: "github",
    eventType,
    webhookEventId,
    payload: parsedBody ?? null,
  };
}

export function stringField(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }
  return null;
}

export function stringHeader(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    return stringField(value[0]);
  }
  return stringField(value);
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

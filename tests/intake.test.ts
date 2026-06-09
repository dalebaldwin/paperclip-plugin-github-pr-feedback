import { describe, expect, it } from "vitest";
import {
  isThreadedSurface,
  normalizeSourceEvent,
  parseGitHubWebhook,
  stableHash,
} from "../src/intake.js";

describe("GitHub source intake", () => {
  it("normalizes pull request comment events", () => {
    const event = normalizeSourceEvent({
      companyId: "company-1",
      source: "github",
      artifactKind: "pull_request",
      artifactExternalId: "Sojournii/sojournii-monorepo#1161",
      repository: "Sojournii/sojournii-monorepo",
      surface: "pull_request_comments",
      externalEventId: "comment-1",
      authorLogin: "coderabbitai",
      authorType: "bot",
      bodyText: "Mobile viewport proof is missing.",
    });

    expect(event.bodyHash).toBe(stableHash("Mobile viewport proof is missing."));
    expect(event.externalParentId).toBeNull();
    expect(event.version).toBe("1");
    expect(event.repository).toBe("Sojournii/sojournii-monorepo");
  });

  it("requires parent ids for review thread events", () => {
    expect(() =>
      normalizeSourceEvent({
        companyId: "company-1",
        source: "github",
        artifactKind: "pull_request",
        artifactExternalId: "Sojournii/sojournii-monorepo#1161",
        surface: "pull_request_review_threads",
        externalEventId: "thread-comment-1",
        bodyText: "This needs to stay attached to a review thread.",
      }),
    ).toThrow(/externalParentId/);
  });

  it("accepts review thread events when the parent id is present", () => {
    const event = normalizeSourceEvent({
      companyId: "company-1",
      source: "github",
      artifactKind: "pull_request",
      artifactExternalId: "Sojournii/sojournii-monorepo#1161",
      surface: "pull_request_review_threads",
      externalEventId: "thread-comment-1",
      externalParentId: "thread-1",
      bodyText: "This should become a source event.",
    });

    expect(isThreadedSurface(event.surface)).toBe(true);
    expect(event.externalParentId).toBe("thread-1");
  });

  it("normalizes GitHub webhook envelopes", () => {
    const envelope = parseGitHubWebhook(
      "request-1",
      {
        "x-github-event": "pull_request_review_comment",
        "x-github-delivery": "delivery-1",
      },
      { action: "created" },
    );

    expect(envelope).toMatchObject({
      source: "github",
      eventType: "pull_request_review_comment",
      webhookEventId: "delivery-1",
    });
  });
});

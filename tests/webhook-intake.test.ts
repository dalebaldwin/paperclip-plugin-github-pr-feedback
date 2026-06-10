import { describe, expect, it } from "vitest";
import { buildGitHubWebhookIngestPlans } from "../src/webhook-intake.js";

describe("GitHub webhook intake plans", () => {
  it("registers a pull request artifact when a PR is opened", () => {
    const plans = buildGitHubWebhookIngestPlans({
      companyId: "company-1",
      eventType: "pull_request",
      deliveryId: "delivery-1",
      payload: {
        action: "opened",
        repository: { full_name: "Sojournii/sojournii-monorepo" },
        pull_request: {
          number: 1292,
          title: "SJI-1292: Fix comments",
          html_url: "https://github.com/Sojournii/sojournii-monorepo/pull/1292",
        },
      },
    });

    expect(plans).toHaveLength(1);
    expect(plans[0]?.artifact).toMatchObject({
      companyId: "company-1",
      source: "github",
      artifactKind: "pull_request",
      externalId: "Sojournii/sojournii-monorepo#1292",
      repository: "Sojournii/sojournii-monorepo",
      status: "active",
      discoveredFrom: "webhook:delivery-1",
    });
    expect(plans[0]?.surfaces).toEqual([
      "pull_request_comments",
      "pull_request_reviews",
      "pull_request_review_threads",
      "check_runs",
      "workflow_runs",
    ]);
    expect(plans[0]?.events).toEqual([]);
  });

  it("records a PR issue comment as a pull request comment event", () => {
    const plans = buildGitHubWebhookIngestPlans({
      companyId: "company-1",
      eventType: "issue_comment",
      deliveryId: "delivery-2",
      payload: {
        action: "created",
        repository: { full_name: "Sojournii/sojournii-monorepo" },
        issue: {
          number: 1292,
          title: "SJI-1292: Fix comments",
          html_url: "https://github.com/Sojournii/sojournii-monorepo/issues/1292",
          pull_request: {
            url: "https://api.github.com/repos/Sojournii/sojournii-monorepo/pulls/1292",
          },
        },
        comment: {
          id: 987,
          body: "This still needs a follow-up.",
          created_at: "2026-06-10T10:00:00Z",
          updated_at: "2026-06-10T10:00:00Z",
          user: { login: "dalebaldwin" },
        },
      },
    });

    expect(plans).toHaveLength(1);
    expect(plans[0]?.events[0]).toMatchObject({
      companyId: "company-1",
      source: "github",
      artifactKind: "pull_request",
      artifactExternalId: "Sojournii/sojournii-monorepo#1292",
      repository: "Sojournii/sojournii-monorepo",
      artifactUrl: "https://github.com/Sojournii/sojournii-monorepo/pull/1292",
      surface: "pull_request_comments",
      externalEventId: "987",
      version: "2026-06-10T10:00:00Z",
      authorLogin: "dalebaldwin",
      authorType: "human",
      bodyText: "This still needs a follow-up.",
    });
  });
});

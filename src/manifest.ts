import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

const manifest: PaperclipPluginManifestV1 = {
  id: "paperclip.github-pr-feedback",
  apiVersion: 1,
  version: "0.1.3",
  displayName: "GitHub PR Feedback",
  description:
    "Builds a canonical GitHub pull request feedback, review, and check-run graph for Paperclip.",
  author: "Dale Baldwin",
  categories: ["connector", "automation", "ui"],
  capabilities: [
    "api.routes.register",
    "database.namespace.migrate",
    "database.namespace.read",
    "database.namespace.write",
    "http.outbound",
    "secrets.read-ref",
    "jobs.schedule",
    "webhooks.receive",
    "issues.read",
    "issues.create",
    "issues.wakeup",
    "issue.relations.read",
    "issue.relations.write",
    "projects.managed",
    "routines.managed",
    "agents.managed",
    "skills.managed",
    "instance.settings.register",
    "ui.dashboardWidget.register",
    "ui.page.register",
  ],
  entrypoints: {
    worker: "./dist/worker.js",
    ui: "./dist/ui",
  },
  instanceConfigSchema: {
    type: "object",
    properties: {
      githubTokenSecretRef: {
        type: "string",
        title: "GitHub token secret ref",
      },
      webhookSecretRef: {
        type: "string",
        title: "Webhook verification secret ref",
      },
      repositories: {
        type: "array",
        title: "Repositories",
        items: { type: "string" },
        default: [],
      },
      ignoredAuthorPatterns: {
        type: "array",
        title: "Ignored author patterns",
        items: { type: "string" },
        default: ["bot", "automation", "coderabbit"],
      },
    },
  },
  database: {
    namespaceSlug: "github_pr_feedback",
    migrationsDir: "migrations",
    coreReadTables: ["issues", "issue_comments", "agents", "projects"],
  },
  webhooks: [
    {
      endpointKey: "github",
      displayName: "GitHub webhook",
      description: "Receives GitHub pull request, review, issue, and check webhooks.",
    },
  ],
  jobs: [
    {
      jobKey: "hourly-reconcile",
      displayName: "Hourly GitHub reconciliation",
      description:
        "Reconciles active GitHub PR comments, reviews, review threads, and checks.",
      schedule: "0 * * * *",
    },
    {
      jobKey: "daily-deep-scan",
      displayName: "Daily GitHub deep scan",
      description:
        "Audits GitHub graph coverage and missed review/check surfaces.",
      schedule: "31 3 * * *",
    },
  ],
  apiRoutes: [
    {
      routeKey: "status",
      method: "GET",
      path: "/status",
      auth: "board-or-agent",
      capability: "api.routes.register",
      companyResolution: { from: "query", key: "companyId" },
    },
    {
      routeKey: "ingest-event",
      method: "POST",
      path: "/source-events",
      auth: "board-or-agent",
      capability: "api.routes.register",
      companyResolution: { from: "body", key: "companyId" },
    },
    {
      routeKey: "register-artifact",
      method: "POST",
      path: "/artifacts",
      auth: "board-or-agent",
      capability: "api.routes.register",
      companyResolution: { from: "body", key: "companyId" },
    },
    {
      routeKey: "register-edge",
      method: "POST",
      path: "/artifact-edges",
      auth: "board-or-agent",
      capability: "api.routes.register",
      companyResolution: { from: "body", key: "companyId" },
    },
    {
      routeKey: "register-surface",
      method: "POST",
      path: "/surfaces",
      auth: "board-or-agent",
      capability: "api.routes.register",
      companyResolution: { from: "body", key: "companyId" },
    },
    {
      routeKey: "set-lifecycle",
      method: "POST",
      path: "/artifact-lifecycle",
      auth: "board-or-agent",
      capability: "api.routes.register",
      companyResolution: { from: "body", key: "companyId" },
    },
    {
      routeKey: "active-surfaces",
      method: "GET",
      path: "/active-surfaces",
      auth: "board-or-agent",
      capability: "api.routes.register",
      companyResolution: { from: "query", key: "companyId" },
    },
    {
      routeKey: "coverage-audit",
      method: "GET",
      path: "/coverage-audit",
      auth: "board-or-agent",
      capability: "api.routes.register",
      companyResolution: { from: "query", key: "companyId" },
    },
  ],
  projects: [
    {
      projectKey: "github-pr-feedback",
      displayName: "GitHub PR Feedback",
      description: "Operational work created by the GitHub PR Feedback plugin.",
      status: "in_progress",
    },
  ],
  agents: [
    {
      agentKey: "github-pr-feedback-monitor",
      displayName: "GitHub PR Feedback Monitor",
      role: "operations",
      title: "GitHub PR Feedback Monitor",
      capabilities:
        "Reviews GitHub source events, routes PR review/CI/merge conflict feedback, and audits missed GitHub surfaces.",
      adapterPreference: ["codex_local", "claude_local", "process"],
      instructions: {
        content:
          "You monitor normalized GitHub source events created by the GitHub PR Feedback plugin. Route actionable PR review, inline thread, CI, workflow, and issue feedback while preserving source ids.",
      },
    },
  ],
  routines: [
    {
      routineKey: "hourly-github-reconciliation",
      title: "Hourly GitHub reconciliation",
      description:
        "Review plugin-detected GitHub source events and route missed PR/review/check feedback.",
      assigneeRef: {
        resourceKind: "agent",
        resourceKey: "github-pr-feedback-monitor",
      },
      projectRef: {
        resourceKind: "project",
        resourceKey: "github-pr-feedback",
      },
      priority: "high",
      triggers: [
        {
          kind: "schedule",
          label: "Hourly",
          cronExpression: "9 * * * *",
          timezone: "UTC",
          enabled: false,
          signingMode: null,
          replayWindowSec: null,
        },
      ],
    },
  ],
  skills: [
    {
      skillKey: "github-pr-feedback-routing",
      displayName: "GitHub PR Feedback Routing",
      description:
        "Classify GitHub PR review, inline thread, issue, workflow, and check-run source events.",
    },
  ],
  ui: {
    slots: [
      {
        type: "dashboardWidget",
        id: "github-pr-feedback-health",
        displayName: "GitHub PR Feedback",
        exportName: "DashboardWidget",
      },
      {
        type: "page",
        id: "github-pr-feedback",
        displayName: "GitHub PR Feedback",
        exportName: "GitHubPrFeedbackPage",
        routePath: "github-pr-feedback",
      },
      {
        type: "settingsPage",
        id: "settings",
        displayName: "GitHub PR Feedback",
        exportName: "SettingsPage",
      },
    ],
  },
};

export default manifest;

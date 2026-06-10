import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

const manifest: PaperclipPluginManifestV1 = {
  id: "paperclip.github-pr-feedback",
  apiVersion: 1,
  version: "0.1.13",
  displayName: "GitHub PR Feedback",
  description:
    "Builds a canonical GitHub pull request feedback, review, and check-run graph for Paperclip.",
  author: "Dale Baldwin",
  categories: ["connector", "automation", "ui"],
  capabilities: [
    "api.routes.register",
    "companies.read",
    "database.namespace.migrate",
    "database.namespace.read",
    "database.namespace.write",
    "webhooks.receive",
    "secrets.read-ref",
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
    "ui.sidebar.register",
  ],
  entrypoints: {
    worker: "./dist/worker.js",
    ui: "./dist/ui",
  },
  instanceConfigSchema: {
    type: "object",
    properties: {
      repositories: {
        type: "array",
        title: "Repositories",
        items: { type: "string" },
        default: [],
      },
      defaultCompanyId: {
        type: "string",
        title: "Default company ID for webhook intake",
        description:
          "Used when GitHub webhook deliveries need to create company-scoped artifacts and no repository-specific company mapping is configured.",
      },
      repositoryCompanyMap: {
        type: "object",
        title: "Repository to company ID map",
        description:
          "Optional map of owner/name repositories to Paperclip company IDs for webhook intake.",
        additionalProperties: { type: "string" },
        default: {},
      },
      githubTokenSecretRef: {
        type: "string",
        title: "GitHub token secret ref",
        description:
          "Secret reference used by PR backfill actions to read GitHub comments, reviews, checks, and workflow runs.",
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
  jobs: [],
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
      routeKey: "tracked-artifacts",
      method: "GET",
      path: "/tracked-artifacts",
      auth: "board-or-agent",
      capability: "api.routes.register",
      companyResolution: { from: "query", key: "companyId" },
    },
    {
      routeKey: "source-events",
      method: "GET",
      path: "/events",
      auth: "board-or-agent",
      capability: "api.routes.register",
      companyResolution: { from: "query", key: "companyId" },
    },
    {
      routeKey: "set-event-status",
      method: "POST",
      path: "/event-status",
      auth: "board-or-agent",
      capability: "api.routes.register",
      companyResolution: { from: "body", key: "companyId" },
    },
    {
      routeKey: "backfill-pull-request",
      method: "POST",
      path: "/backfill/pull-request",
      auth: "board-or-agent",
      capability: "api.routes.register",
      companyResolution: { from: "body", key: "companyId" },
    },
    {
      routeKey: "backfill-open-pull-requests",
      method: "POST",
      path: "/backfill/open-pull-requests",
      auth: "board-or-agent",
      capability: "api.routes.register",
      companyResolution: { from: "body", key: "companyId" },
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
        "Uses agent-owned GitHub credentials to discover open PR feedback, writes normalized source events into the plugin graph, routes PR review/CI/merge conflict feedback, and audits missed GitHub surfaces.",
      adapterPreference: ["codex_local", "claude_local", "process"],
      instructions: {
        content:
          "You own GitHub source synchronization for this plugin. On each heartbeat, use your normal GitHub credentials to list configured/open PRs, comments, reviews, review threads, checks, workflow runs, merge health, and head SHA state. Register artifacts, surfaces, lifecycle, and normalized source events through the GitHub PR Feedback plugin APIs, then route actionable PR review, inline thread, CI, workflow, and issue feedback while preserving source ids.",
      },
    },
  ],
  routines: [
    {
      routineKey: "hourly-github-reconciliation",
      title: "Hourly GitHub reconciliation",
      description:
        "Synchronize GitHub PR source surfaces into the plugin graph, then route missed PR/review/check feedback.",
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
        type: "sidebar",
        id: "github-pr-feedback-sidebar",
        displayName: "GitHub PR Feedback",
        exportName: "GitHubSidebarLink",
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

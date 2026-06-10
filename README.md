# Paperclip GitHub PR Feedback

Paperclip plugin for tracking GitHub pull requests, review feedback, inline
threads, comments, checks, workflow runs, and merge state that agents need to
keep watching while work moves through review.

The plugin gives Paperclip a durable source graph for GitHub PR operations. It
does not try to be the only GitHub client in your system. Instead, your agents
use their own GitHub credentials to read repositories and pull requests, then
write artifacts, source surfaces, lifecycle state, and source events into this
plugin.

## What This Is For

Use this plugin when you want Paperclip agents to stop missing PR feedback or
operational blockers after a pull request has been opened.

Common examples:

- A reviewer leaves an inline review thread that needs code changes.
- A review bot leaves actionable feedback that should wake the PR owner.
- A CI check fails after a push and needs the owning agent to fix it.
- A PR develops merge conflicts and needs rebasing or conflict resolution.
- A late comment appears after merge and should create follow-up work.
- An agent creates, updates, or observes a PR and needs to record that the PR
  must keep being checked.

The plugin is the registry and cursor store. Agents remain responsible for
external API reads and operational decisions.

## What It Provides

- A Paperclip plugin manifest for `paperclip.github-pr-feedback`
- Plugin-owned database tables for source artifacts, edges, surfaces, lifecycle
  state, and source events
- API routes agents can call to register tracked GitHub content
- Managed Paperclip project, routine, skill, and agent declarations
- A sidebar page and dashboard/settings UI for inspecting tracked PR sources
- GitHub webhook endpoint declaration
- Normalization and test coverage for PR feedback events, including review
  threads

## What It Does Not Do

- It does not store GitHub tokens in plugin settings.
- It does not replace your agent credentials, GitHub App, or GitHub CLI setup.
- It does not make routing decisions without an agent or routine reading the
  plugin events.
- It does not guarantee complete coverage unless your agents register every
  relevant repository, PR, review surface, check surface, and workflow surface
  they create, update, link, or discover.

## Install

Install from the Paperclip plugin UI using the npm package:

```text
paperclip-plugin-github-pr
```

Or install with the Paperclip CLI:

```bash
paperclipai plugin install paperclip-plugin-github-pr
paperclipai plugin inspect paperclip.github-pr-feedback
```

For local development:

```bash
pnpm install
pnpm build
paperclipai plugin install <absolute-path-to-this-repo>
paperclipai plugin inspect paperclip.github-pr-feedback
```

If `paperclipai` is not on `PATH`, use `npx paperclipai`.

## Plugin Settings

Configure the repositories your agents should monitor:

```json
{
  "repositories": ["example-org/example-repo", "example-org/another-repo"],
  "defaultCompanyId": "your-paperclip-company-id",
  "repositoryCompanyMap": {
    "example-org/example-repo": "your-paperclip-company-id"
  },
  "githubTokenSecretRef": "secret:github-token",
  "ignoredAuthorPatterns": ["bot", "automation"]
}
```

These settings identify where to look. They are not credentials.
`defaultCompanyId` or `repositoryCompanyMap` is required for webhook deliveries
to create company-scoped GitHub artifacts. `githubTokenSecretRef` is used only
by the backfill actions that repair missed PR artifacts from the GitHub API.

## Required GitHub Credentials

Your scanning/routing agents need GitHub credentials outside the plugin. Use the
credential mechanism your Paperclip deployment supports, such as environment
variables, a secret store, `gh` authentication, or a GitHub App installation.

For a token based setup, agents usually need one of:

- `GITHUB_TOKEN`
- `GH_TOKEN`
- a GitHub App installation token provided by your host

The token or app should be able to read:

- repository metadata
- pull requests, reviews, review comments, and review threads
- issue comments on pull requests
- check runs and check suites
- workflow runs and job state
- mergeability or branch comparison state

If your agents also push fixes, resolve conflicts, comment on PRs, or update
branches, grant only the write scopes required for those actions.

## Agent Setup

The plugin installs a managed agent declaration named `GitHub PR Feedback
Monitor` and an hourly reconciliation routine. The routine is intentionally a
source sync contract: the agent must use its GitHub credentials, then write
normalized state into the plugin.

Adapt this example to your Paperclip agent configuration format:

```yaml
agent:
  name: GitHub PR Feedback Monitor
  role: operations
  schedule: hourly
  credentials:
    GITHUB_TOKEN: secret:github-token
  instructions: |
    You own GitHub pull request source synchronization for Paperclip.

    On every heartbeat:
    1. Read configured repositories and discover open PRs, recently merged PRs,
       recently closed PRs, and Paperclip-linked PRs.
    2. Register every discovered repository and pull request in
       paperclip.github-pr-feedback.
    3. Register surfaces for issue comments, review comments, reviews, review
       threads, check runs, check suites, and workflow runs.
    4. Record new human or review-bot feedback as plugin events with durable
       GitHub ids, parent ids, timestamps, author login, URL, head SHA, and body
       hash where available.
    5. Record failing checks, failed workflow runs, stale required checks, merge
       conflicts, and changed head SHA state as source events.
    6. Route actionable new events to the PR owner or mark them ignored,
       blocked, or no-action with evidence.
    7. Never mark a PR review surface clear while GitHub has unresolved
       actionable feedback that is missing from the plugin graph.
```

## Agent API Contract

Agents should call the plugin routes whenever they create, update, link,
discover, merge, close, archive, or reopen GitHub PR source content.

Supported actions:

- `register-artifact` / `POST /artifacts`
- `register-edge` / `POST /artifact-edges`
- `register-surface` / `POST /surfaces`
- `set-lifecycle` / `POST /artifact-lifecycle`
- `active-surfaces` / `GET /active-surfaces`
- `tracked-artifacts` / `GET /tracked-artifacts`
- `source-events` / `GET /events`
- `set-event-status` / `POST /event-status`
- `coverage-audit` / `GET /coverage-audit`
- `record-source-event` / `POST /source-events`
- `backfill-pull-request` / `POST /backfill/pull-request`
- `backfill-open-pull-requests` / `POST /backfill/open-pull-requests`

Example artifact registration:

```json
{
  "companyId": "your-paperclip-company-id",
  "source": "github",
  "artifactKind": "pull_request",
  "externalId": "example-org/example-repo#42",
  "repository": "example-org/example-repo",
  "url": "https://github.com/example-org/example-repo/pull/42",
  "title": "Fix checkout confirmation",
  "status": "active",
  "ownerLane": "product-engineering"
}
```

Example backfill request for a PR that was created before webhook/source sync was
configured:

```json
{
  "companyId": "your-paperclip-company-id",
  "repository": "example-org/example-repo",
  "pullRequestNumber": 42
}
```

Example source event:

```json
{
  "companyId": "your-paperclip-company-id",
  "source": "github",
  "artifactKind": "pull_request",
  "artifactExternalId": "example-org/example-repo#42",
  "repository": "example-org/example-repo",
  "artifactUrl": "https://github.com/example-org/example-repo/pull/42",
  "artifactTitle": "Fix checkout confirmation",
  "surface": "pull_request_review_threads",
  "externalEventId": "PRRT_kwDOExample",
  "externalParentId": "PRR_kwDOExample",
  "authorLogin": "reviewer",
  "authorType": "human",
  "createdAt": "2026-06-10T09:00:00.000Z",
  "bodyText": "This still fails on the mobile viewport."
}
```

## Covered Surfaces

The plugin models these GitHub surfaces:

- `issue_comments`
- `pull_request_comments`
- `pull_request_reviews`
- `pull_request_review_threads`
- `check_runs`
- `check_suites`
- `workflow_runs`

Review threads, check state, workflow state, and merge health are first-class
operational input surfaces, not edge cases.

## Lifecycle

Artifacts can be marked as:

- `registered`
- `active`
- `grace`
- `closed`
- `archived`
- `reopened`

Heartbeat scans should normally read `registered`, `active`, `grace`, and
`reopened` surfaces. `closed` and `archived` surfaces should not receive routine
polling, but newly observed source activity can reopen them.

## Development

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build
```

## Trust Model

Paperclip alpha plugins are trusted local or npm-installed code. Do not install
this plugin from an untrusted source. Keep GitHub tokens in your Paperclip
agent, host, or secret-store configuration rather than in plugin settings.

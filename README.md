# Paperclip GitHub PR Feedback

Reliable GitHub pull request feedback, review, workflow, and check-run intake
for Paperclip.

This plugin is intended to make GitHub pull request operational signals
first-class Paperclip source events. It exists because agents should not rely on
ad hoc polling or prompt memory to notice pull request review feedback, inline
review threads, failing checks, workflow state, merge conflicts, or issue
comments.

## Current Status

This repository is an initial scaffold. It defines:

- a Paperclip plugin manifest
- a GitHub webhook endpoint
- hourly and daily reconciliation jobs
- a plugin-owned database namespace
- a canonical artifact/source-event schema
- managed Paperclip project, agent, routine, and skill declarations
- minimal dashboard/settings UI
- tests for source-event normalization, including review threads

The full GitHub REST and GraphQL scanners are intentionally next-step work.

## Usability Gate

The current scaffold is installable and useful as the shared contract for GitHub
PR feedback, but it is not yet a fully operational unattended connector.

Before it can keep PR feedback moving without manual intervention, it needs:

- webhook signature verification using the configured webhook secret ref
- GitHub webhook payload conversion into normalized source events
- GitHub REST or GraphQL scanners for hourly reconciliation
- source-event routing into Paperclip issues or wakeups
- durable handling for failing checks, stale review threads, merge conflicts,
  and late comments after merge
- ignored-author and bot policy enforcement
- repository settings validation in the plugin settings UI

## Why This Exists

Paperclip agents should not each rediscover where GitHub feedback might live.
The plugin should own the reliable integration layer:

```text
GitHub webhook or reconciliation scan
  -> artifact graph
  -> source surface cursor
  -> source event
  -> Paperclip issue or wakeup
  -> owning agent
```

## Covered Source Surfaces

The model explicitly includes:

- `issue_comments`
- `pull_request_comments`
- `pull_request_reviews`
- `pull_request_review_threads`
- `check_runs`
- `check_suites`
- `workflow_runs`

Review threads and check/workflow state are treated as required surfaces, not
edge cases.

## Agent-Facing Registry Contract

Agents and orchestration routines should register what they create or discover
instead of relying on later prompt heuristics.

Supported plugin actions and matching API routes:

- `register-artifact` / `POST /artifacts`
- `register-edge` / `POST /artifact-edges`
- `register-surface` / `POST /surfaces`
- `set-lifecycle` / `POST /artifact-lifecycle`
- `active-surfaces` / `GET /active-surfaces`
- `coverage-audit` / `GET /coverage-audit`
- `record-source-event` / `POST /source-events`

Example flow:

```text
Pull request opened
  -> register repository artifact
  -> register pull request artifact
  -> register edge: repository -> pull request
  -> register PR comments, reviews, review threads, check runs, and workflow runs
```

Lifecycle states:

- `registered`
- `active`
- `grace`
- `closed`
- `archived`
- `reopened`

Hourly scans should read `registered`, `active`, `grace`, and `reopened`
surfaces. `closed` and `archived` surfaces should not receive routine polling,
but webhook events can still reopen them.

## Development

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build
```

For local Paperclip development:

```bash
pnpm dev
paperclipai plugin install <absolute-path-to-plugin>
paperclipai plugin inspect paperclip.github-pr-feedback
```

If `paperclipai` is not on `PATH`, use `npx paperclipai`.

For a published package install, use the package name instead of a local path:

```bash
paperclipai plugin install paperclip-plugin-github-pr
paperclipai plugin inspect paperclip.github-pr-feedback
```

## Planned MVP

1. Implement GitHub webhook payload conversion for PR comments, reviews, review
   threads, issues, checks, and workflow runs.
2. Implement GitHub GraphQL/REST scanners with token secret refs.
3. Add hourly scanner for active PRs, recently merged PRs, and open issues.
4. Add merge-conflict and failing-check classification.
5. Add daily graph coverage audit for missing PR review/check surfaces.
6. Route new human or review-bot feedback into Paperclip issues with durable
   origin ids.
7. Add settings UI for repositories, ignored authors, and routing policies.

## Trust Model

Paperclip alpha plugins are trusted local or npm-installed code. Do not install
this plugin from an untrusted source. Store secrets as Paperclip secret
references and resolve them at runtime; never persist resolved secret values.

CREATE TABLE IF NOT EXISTS plugin_github_pr_feedback_faf63ecd83.source_artifacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id text NOT NULL,
  source text NOT NULL,
  artifact_kind text NOT NULL,
  external_id text NOT NULL,
  repository text,
  url text,
  title text,
  status text,
  owner_lane text,
  discovered_from text,
  last_seen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, source, artifact_kind, external_id)
);

CREATE TABLE IF NOT EXISTS plugin_github_pr_feedback_faf63ecd83.source_artifact_edges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id text NOT NULL,
  from_artifact_id uuid NOT NULL REFERENCES plugin_github_pr_feedback_faf63ecd83.source_artifacts(id) ON DELETE CASCADE,
  to_artifact_id uuid NOT NULL REFERENCES plugin_github_pr_feedback_faf63ecd83.source_artifacts(id) ON DELETE CASCADE,
  relationship text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (from_artifact_id, to_artifact_id, relationship)
);

CREATE TABLE IF NOT EXISTS plugin_github_pr_feedback_faf63ecd83.source_surfaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artifact_id uuid NOT NULL REFERENCES plugin_github_pr_feedback_faf63ecd83.source_artifacts(id) ON DELETE CASCADE,
  surface text NOT NULL,
  cursor_external_id text,
  cursor_version text,
  last_scan_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (artifact_id, surface)
);

CREATE TABLE IF NOT EXISTS plugin_github_pr_feedback_faf63ecd83.source_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id text NOT NULL,
  artifact_id uuid NOT NULL REFERENCES plugin_github_pr_feedback_faf63ecd83.source_artifacts(id) ON DELETE CASCADE,
  surface_id uuid NOT NULL REFERENCES plugin_github_pr_feedback_faf63ecd83.source_surfaces(id) ON DELETE CASCADE,
  source text NOT NULL,
  surface text NOT NULL,
  external_event_id text NOT NULL,
  external_parent_id text,
  version text NOT NULL,
  author_login text,
  author_type text NOT NULL DEFAULT 'unknown',
  created_at_external timestamptz,
  updated_at_external timestamptz,
  body_text text,
  body_hash text NOT NULL,
  raw_payload jsonb,
  status text NOT NULL DEFAULT 'new',
  paperclip_issue_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, source, surface, external_event_id, version)
);

CREATE INDEX IF NOT EXISTS source_events_status_idx
  ON plugin_github_pr_feedback_faf63ecd83.source_events (company_id, status, created_at);

CREATE TABLE IF NOT EXISTS plugin_github_pr_feedback_faf63ecd83.webhook_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id text NOT NULL UNIQUE,
  endpoint_key text NOT NULL,
  source text NOT NULL,
  event_type text NOT NULL,
  external_event_id text NOT NULL,
  raw_body text NOT NULL,
  parsed_body jsonb,
  status text NOT NULL,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

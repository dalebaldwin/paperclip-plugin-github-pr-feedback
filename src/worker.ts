import {
  definePlugin,
  runWorker,
  type PluginApiRequestInput,
  type PluginContext,
  type PluginWebhookInput,
} from "@paperclipai/plugin-sdk";
import {
  isRecord,
  normalizeSourceEvent,
  parseGitHubWebhook,
  stringField,
} from "./intake.js";
import {
  expectedSurfacesForArtifact,
  normalizeArtifactInput,
  normalizeEdgeInput,
  normalizeLifecycleInput,
  normalizeListActiveSurfacesInput,
  normalizeSurfaceInput,
} from "./registry.js";
import type {
  ListActiveSurfacesInput,
  NormalizedSourceEvent,
  RegisterSourceArtifactEdgeInput,
  RegisterSourceArtifactInput,
  RegisterSourceSurfaceInput,
  SetSourceArtifactLifecycleInput,
  SourceArtifactKind,
  SourceArtifactLifecycleStatus,
  SourceEventInput,
  SourceSurface,
  SourceSystem,
} from "./types.js";

function table(namespace: string, name: string): string {
  return `${namespace}.${name}`;
}

async function upsertArtifact(
  ctx: PluginContext,
  event: NormalizedSourceEvent,
): Promise<string> {
  await ctx.db.execute(
    `INSERT INTO ${table(ctx.db.namespace, "source_artifacts")}
      (company_id, source, artifact_kind, external_id, repository, url, title, last_seen_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, now())
     ON CONFLICT (company_id, source, artifact_kind, external_id)
     DO UPDATE SET
       url = COALESCE(EXCLUDED.url, ${table(ctx.db.namespace, "source_artifacts")}.url),
       title = COALESCE(EXCLUDED.title, ${table(ctx.db.namespace, "source_artifacts")}.title),
       last_seen_at = now(),
       updated_at = now()`,
    [
      event.companyId,
      event.source,
      event.artifactKind,
      event.artifactExternalId,
      event.repository,
      event.artifactUrl,
      event.artifactTitle,
    ],
  );

  const rows = await ctx.db.query<{ id: string }>(
    `SELECT id
     FROM ${table(ctx.db.namespace, "source_artifacts")}
     WHERE company_id = $1
       AND source = $2
       AND artifact_kind = $3
       AND external_id = $4`,
    [
      event.companyId,
      event.source,
      event.artifactKind,
      event.artifactExternalId,
    ],
  );

  const id = rows[0]?.id;
  if (!id) {
    throw new Error("source_artifacts upsert returned no id");
  }
  return id;
}

async function registerArtifact(
  ctx: PluginContext,
  input: RegisterSourceArtifactInput,
) {
  const artifact = normalizeArtifactInput(input);
  await ctx.db.execute(
    `INSERT INTO ${table(ctx.db.namespace, "source_artifacts")}
      (company_id, source, artifact_kind, external_id, repository, url, title, status, owner_lane, discovered_from, last_seen_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now())
     ON CONFLICT (company_id, source, artifact_kind, external_id)
     DO UPDATE SET
       url = COALESCE(EXCLUDED.url, ${table(ctx.db.namespace, "source_artifacts")}.url),
       title = COALESCE(EXCLUDED.title, ${table(ctx.db.namespace, "source_artifacts")}.title),
       status = EXCLUDED.status,
       owner_lane = COALESCE(EXCLUDED.owner_lane, ${table(ctx.db.namespace, "source_artifacts")}.owner_lane),
       discovered_from = COALESCE(EXCLUDED.discovered_from, ${table(ctx.db.namespace, "source_artifacts")}.discovered_from),
       last_seen_at = now(),
       updated_at = now()`,
    [
      artifact.companyId,
      artifact.source,
      artifact.artifactKind,
      artifact.externalId,
      artifact.repository ?? null,
      artifact.url ?? null,
      artifact.title ?? null,
      artifact.status,
      artifact.ownerLane ?? null,
      artifact.discoveredFrom ?? null,
    ],
  );

  const rows = await ctx.db.query<{
    id: string;
    company_id: string;
    source: SourceSystem;
    artifact_kind: SourceArtifactKind;
    external_id: string;
    repository: string | null;
    url: string | null;
    title: string | null;
    status: string | null;
    owner_lane: string | null;
    discovered_from: string | null;
  }>(
    `SELECT id, company_id, source, artifact_kind, external_id, repository, url, title, status, owner_lane, discovered_from
     FROM ${table(ctx.db.namespace, "source_artifacts")}
     WHERE company_id = $1
       AND source = $2
       AND artifact_kind = $3
       AND external_id = $4`,
    [
      artifact.companyId,
      artifact.source,
      artifact.artifactKind,
      artifact.externalId,
    ],
  );

  const row = rows[0];
  if (!row) {
    throw new Error("source_artifacts registration returned no row");
  }
  return {
    id: row.id,
    companyId: row.company_id,
    source: row.source,
    artifactKind: row.artifact_kind,
    externalId: row.external_id,
    repository: row.repository,
    url: row.url,
    title: row.title,
    status: row.status,
    ownerLane: row.owner_lane,
    discoveredFrom: row.discovered_from,
  };
}

async function resolveArtifactId(
  ctx: PluginContext,
  companyId: string,
  artifact: {
    id?: string;
    source?: SourceSystem;
    artifactKind?: SourceArtifactKind;
    externalId?: string;
  },
): Promise<string> {
  if (artifact.id) {
    const rows = await ctx.db.query<{ id: string }>(
      `SELECT id
       FROM ${table(ctx.db.namespace, "source_artifacts")}
       WHERE id = $1 AND company_id = $2`,
      [artifact.id, companyId],
    );
    if (rows[0]?.id) {
      return rows[0].id;
    }
    throw new Error(`source artifact not found by id: ${artifact.id}`);
  }

  const rows = await ctx.db.query<{ id: string }>(
    `SELECT id
     FROM ${table(ctx.db.namespace, "source_artifacts")}
     WHERE company_id = $1
       AND source = $2
       AND artifact_kind = $3
       AND external_id = $4`,
    [companyId, artifact.source, artifact.artifactKind, artifact.externalId],
  );
  if (rows[0]?.id) {
    return rows[0].id;
  }
  throw new Error(
    `source artifact not found: ${artifact.source}/${artifact.artifactKind}/${artifact.externalId}`,
  );
}

async function registerArtifactEdge(
  ctx: PluginContext,
  input: RegisterSourceArtifactEdgeInput,
) {
  const edge = normalizeEdgeInput(input);
  const fromId = await resolveArtifactId(ctx, edge.companyId, edge.from);
  const toId = await resolveArtifactId(ctx, edge.companyId, edge.to);
  await ctx.db.execute(
    `INSERT INTO ${table(ctx.db.namespace, "source_artifact_edges")}
      (company_id, from_artifact_id, to_artifact_id, relationship)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (from_artifact_id, to_artifact_id, relationship)
     DO UPDATE SET updated_at = now()`,
    [edge.companyId, fromId, toId, edge.relationship],
  );

  const rows = await ctx.db.query<{
    id: string;
    from_artifact_id: string;
    to_artifact_id: string;
    relationship: string;
  }>(
    `SELECT id, from_artifact_id, to_artifact_id, relationship
     FROM ${table(ctx.db.namespace, "source_artifact_edges")}
     WHERE from_artifact_id = $1
       AND to_artifact_id = $2
       AND relationship = $3`,
    [fromId, toId, edge.relationship],
  );

  const row = rows[0];
  if (!row) {
    throw new Error("source_artifact_edges registration returned no row");
  }
  return {
    id: row.id,
    companyId: edge.companyId,
    fromArtifactId: row.from_artifact_id,
    toArtifactId: row.to_artifact_id,
    relationship: row.relationship,
  };
}

async function registerSourceSurface(
  ctx: PluginContext,
  input: RegisterSourceSurfaceInput,
) {
  const surface = normalizeSurfaceInput(input);
  const artifactId = await resolveArtifactId(ctx, surface.companyId, surface.artifact);
  await ctx.db.execute(
    `INSERT INTO ${table(ctx.db.namespace, "source_surfaces")}
      (artifact_id, surface, cursor_external_id, cursor_version, last_scan_at)
     VALUES ($1, $2, $3, $4, COALESCE($5::timestamptz, now()))
     ON CONFLICT (artifact_id, surface)
     DO UPDATE SET
       cursor_external_id = COALESCE(EXCLUDED.cursor_external_id, ${table(ctx.db.namespace, "source_surfaces")}.cursor_external_id),
       cursor_version = COALESCE(EXCLUDED.cursor_version, ${table(ctx.db.namespace, "source_surfaces")}.cursor_version),
       last_scan_at = EXCLUDED.last_scan_at,
       updated_at = now()`,
    [
      artifactId,
      surface.surface,
      surface.cursorExternalId ?? null,
      surface.cursorVersion ?? null,
      surface.lastScanAt ?? null,
    ],
  );

  const rows = await ctx.db.query<{
    id: string;
    artifact_id: string;
    surface: SourceSurface;
    cursor_external_id: string | null;
    cursor_version: string | null;
  }>(
    `SELECT id, artifact_id, surface, cursor_external_id, cursor_version
     FROM ${table(ctx.db.namespace, "source_surfaces")}
     WHERE artifact_id = $1
       AND surface = $2`,
    [artifactId, surface.surface],
  );

  const row = rows[0];
  if (!row) {
    throw new Error("source_surfaces registration returned no row");
  }
  return {
    id: row.id,
    artifactId: row.artifact_id,
    surface: row.surface,
    cursorExternalId: row.cursor_external_id,
    cursorVersion: row.cursor_version,
  };
}

async function setArtifactLifecycle(
  ctx: PluginContext,
  input: SetSourceArtifactLifecycleInput,
) {
  const lifecycle = normalizeLifecycleInput(input);
  const artifactId = await resolveArtifactId(ctx, lifecycle.companyId, lifecycle.artifact);
  await ctx.db.execute(
    `UPDATE ${table(ctx.db.namespace, "source_artifacts")}
     SET status = $1, updated_at = now()
     WHERE id = $2 AND company_id = $3`,
    [lifecycle.status, artifactId, lifecycle.companyId],
  );

  const rows = await ctx.db.query<{
    id: string;
    status: string | null;
    updated_at: string;
  }>(
    `SELECT id, status, updated_at::text
     FROM ${table(ctx.db.namespace, "source_artifacts")}
     WHERE id = $1 AND company_id = $2`,
    [artifactId, lifecycle.companyId],
  );
  const row = rows[0];
  if (!row) {
    throw new Error("source artifact lifecycle update returned no row");
  }
  return {
    id: row.id,
    status: row.status,
    updatedAt: row.updated_at,
    reason: lifecycle.reason ?? null,
  };
}

async function listActiveSurfaces(
  ctx: PluginContext,
  input: ListActiveSurfacesInput,
) {
  const params = normalizeListActiveSurfacesInput(input);
  return ctx.db.query<{
    artifact_id: string;
    source: SourceSystem;
    artifact_kind: SourceArtifactKind;
    external_id: string;
    title: string | null;
    status: string | null;
    surface_id: string;
    surface: SourceSurface;
    cursor_external_id: string | null;
    cursor_version: string | null;
    last_scan_at: string | null;
  }>(
    `SELECT
       a.id AS artifact_id,
       a.source,
       a.artifact_kind,
       a.external_id,
       a.title,
       a.status,
       s.id AS surface_id,
       s.surface,
       s.cursor_external_id,
       s.cursor_version,
       s.last_scan_at::text
     FROM ${table(ctx.db.namespace, "source_artifacts")} a
     JOIN ${table(ctx.db.namespace, "source_surfaces")} s
       ON s.artifact_id = a.id
     WHERE a.company_id = $1
       AND COALESCE(a.status, 'registered') = ANY($2::text[])
     ORDER BY a.source, a.artifact_kind, a.external_id, s.surface`,
    [params.companyId, params.statuses],
  );
}

async function coverageAudit(ctx: PluginContext, companyId: string) {
  const rows = await ctx.db.query<{
    artifact_id: string;
    source: SourceSystem;
    artifact_kind: SourceArtifactKind;
    external_id: string;
    title: string | null;
    surfaces: SourceSurface[] | null;
  }>(
    `SELECT
       a.id AS artifact_id,
       a.source,
       a.artifact_kind,
       a.external_id,
       a.title,
       array_remove(array_agg(s.surface), NULL) AS surfaces
     FROM ${table(ctx.db.namespace, "source_artifacts")} a
     LEFT JOIN ${table(ctx.db.namespace, "source_surfaces")} s
       ON s.artifact_id = a.id
     WHERE a.company_id = $1
       AND COALESCE(a.status, 'registered') = ANY($2::text[])
     GROUP BY a.id, a.source, a.artifact_kind, a.external_id, a.title
     ORDER BY a.source, a.artifact_kind, a.external_id`,
    [companyId, ["registered", "active", "grace", "reopened"]],
  );

  const findings = [];
  for (const row of rows) {
    const existing = new Set(row.surfaces ?? []);
    for (const expected of expectedSurfacesForArtifact(row.artifact_kind)) {
      if (!existing.has(expected)) {
        findings.push({
          artifactId: row.artifact_id,
          source: row.source,
          artifactKind: row.artifact_kind,
          externalId: row.external_id,
          title: row.title,
          missingSurface: expected,
        });
      }
    }
  }

  return {
    checkedArtifacts: rows.length,
    missingSurfaces: findings,
  };
}

async function upsertSurface(
  ctx: PluginContext,
  artifactId: string,
  event: NormalizedSourceEvent,
): Promise<string> {
  await ctx.db.execute(
    `INSERT INTO ${table(ctx.db.namespace, "source_surfaces")}
      (artifact_id, surface, cursor_external_id, last_scan_at)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (artifact_id, surface)
     DO UPDATE SET
       cursor_external_id = EXCLUDED.cursor_external_id,
       last_scan_at = now(),
       updated_at = now()`,
    [artifactId, event.surface, event.externalEventId],
  );

  const rows = await ctx.db.query<{ id: string }>(
    `SELECT id
     FROM ${table(ctx.db.namespace, "source_surfaces")}
     WHERE artifact_id = $1
       AND surface = $2`,
    [artifactId, event.surface],
  );

  const id = rows[0]?.id;
  if (!id) {
    throw new Error("source_surfaces upsert returned no id");
  }
  return id;
}

async function recordSourceEvent(
  ctx: PluginContext,
  input: SourceEventInput,
): Promise<{ eventId: string; artifactId: string; inserted: boolean }> {
  const event = normalizeSourceEvent(input);
  const artifactId = await upsertArtifact(ctx, event);
  const surfaceId = await upsertSurface(ctx, artifactId, event);
  const existingRows = await ctx.db.query<{ id: string }>(
    `SELECT id
     FROM ${table(ctx.db.namespace, "source_events")}
     WHERE company_id = $1
       AND source = $2
       AND surface = $3
       AND external_event_id = $4
       AND version = $5
     LIMIT 1`,
    [
      event.companyId,
      event.source,
      event.surface,
      event.externalEventId,
      event.version,
    ],
  );

  await ctx.db.execute(
    `INSERT INTO ${table(ctx.db.namespace, "source_events")}
      (
        company_id,
        artifact_id,
        surface_id,
        source,
        surface,
        external_event_id,
        external_parent_id,
        version,
        author_login,
        author_type,
        created_at_external,
        updated_at_external,
        body_text,
        body_hash,
        raw_payload,
        status
      )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::timestamptz, $12::timestamptz, $13, $14, $15::jsonb, 'new')
     ON CONFLICT (company_id, source, surface, external_event_id, version)
     DO NOTHING`,
    [
      event.companyId,
      artifactId,
      surfaceId,
      event.source,
      event.surface,
      event.externalEventId,
      event.externalParentId,
      event.version,
      event.authorLogin,
      event.authorType,
      event.createdAt,
      event.updatedAt,
      event.bodyText,
      event.bodyHash,
      JSON.stringify(event.raw),
    ],
  );

  const rows = await ctx.db.query<{ id: string }>(
    `SELECT id
     FROM ${table(ctx.db.namespace, "source_events")}
     WHERE company_id = $1
       AND source = $2
       AND surface = $3
       AND external_event_id = $4
       AND version = $5
     LIMIT 1`,
    [
      event.companyId,
      event.source,
      event.surface,
      event.externalEventId,
      event.version,
    ],
  );

  const row = rows[0];
  if (!row) {
    throw new Error("source_events upsert returned no row");
  }

  return { eventId: row.id, artifactId, inserted: existingRows.length === 0 };
}

async function recordWebhookDelivery(
  ctx: PluginContext,
  input: PluginWebhookInput,
): Promise<void> {
  const envelope = parseGitHubWebhook(
    input.requestId,
    input.headers,
    input.parsedBody,
  );

  await ctx.db.execute(
    `INSERT INTO ${table(ctx.db.namespace, "webhook_deliveries")}
      (request_id, endpoint_key, source, event_type, external_event_id, raw_body, parsed_body, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, 'received')
     ON CONFLICT (request_id) DO NOTHING`,
    [
      input.requestId,
      input.endpointKey,
      envelope.source,
      envelope.eventType,
      envelope.webhookEventId,
      input.rawBody,
      JSON.stringify(envelope.payload),
    ],
  );
}

async function intakeStatus(ctx: PluginContext, companyId?: string | null) {
  const params = companyId ? [companyId] : [];
  const where = companyId ? "WHERE company_id = $1" : "";
  const eventRows = await ctx.db.query<{
    status: string;
    count: string;
  }>(
    `SELECT status, count(*)::text AS count
     FROM ${table(ctx.db.namespace, "source_events")}
     ${where}
     GROUP BY status
     ORDER BY status`,
    params,
  );
  const artifactRows = await ctx.db.query<{ count: string }>(
    `SELECT count(*)::text AS count
     FROM ${table(ctx.db.namespace, "source_artifacts")}
     ${where}`,
    params,
  );
  const deliveryRows = await ctx.db.query<{ status: string; count: string }>(
    `SELECT status, count(*)::text AS count
     FROM ${table(ctx.db.namespace, "webhook_deliveries")}
     GROUP BY status
     ORDER BY status`,
  );

  return {
    artifactCount: Number(artifactRows[0]?.count ?? 0),
    eventCounts: Object.fromEntries(
      eventRows.map((row) => [row.status, Number(row.count)]),
    ),
    webhookDeliveryCounts: Object.fromEntries(
      deliveryRows.map((row) => [row.status, Number(row.count)]),
    ),
  };
}

const plugin = definePlugin({
  async setup(ctx) {
    setupContext = ctx;

    ctx.actions.register("setup-company", async (params) => {
      const companyId = stringField(params.companyId);
      if (!companyId) {
        throw new Error("companyId is required");
      }
      const project = await ctx.projects.managed.reconcile(
        "github-pr-feedback",
        companyId,
      );
      const agent = await ctx.agents.managed.reconcile(
        "github-pr-feedback-monitor",
        companyId,
      );
      const routine = await ctx.routines.managed.reconcile(
        "hourly-github-reconciliation",
        companyId,
      );
      const skill = await ctx.skills.managed.reconcile(
        "github-pr-feedback-routing",
        companyId,
      );
      return { project, agent, routine, skill };
    });

    ctx.actions.register("record-source-event", async (params) => {
      return recordSourceEvent(ctx, params as unknown as SourceEventInput);
    });

    ctx.actions.register("register-artifact", async (params) => {
      return registerArtifact(ctx, params as unknown as RegisterSourceArtifactInput);
    });

    ctx.actions.register("register-edge", async (params) => {
      return registerArtifactEdge(
        ctx,
        params as unknown as RegisterSourceArtifactEdgeInput,
      );
    });

    ctx.actions.register("register-surface", async (params) => {
      return registerSourceSurface(
        ctx,
        params as unknown as RegisterSourceSurfaceInput,
      );
    });

    ctx.actions.register("set-lifecycle", async (params) => {
      return setArtifactLifecycle(
        ctx,
        params as unknown as SetSourceArtifactLifecycleInput,
      );
    });

    ctx.data.register("active-surfaces", async (params) => {
      return listActiveSurfaces(
        ctx,
        params as unknown as ListActiveSurfacesInput,
      );
    });

    ctx.data.register("coverage-audit", async (params) => {
      const companyId = stringField(params.companyId);
      if (!companyId) {
        throw new Error("companyId is required");
      }
      return coverageAudit(ctx, companyId);
    });

    ctx.data.register("status", async (params) => {
      return intakeStatus(ctx, stringField(params.companyId));
    });

    ctx.jobs.register("hourly-reconcile", async (job) => {
      ctx.logger.info("GitHub hourly reconciliation job fired", {
        runId: job.runId,
        status: "scanner-pending",
      });
    });

    ctx.jobs.register("daily-deep-scan", async (job) => {
      ctx.logger.info("GitHub daily deep scan job fired", {
        runId: job.runId,
        status: "coverage-audit-pending",
      });
    });
  },

  async onApiRequest(input: PluginApiRequestInput) {
    if (input.routeKey === "status") {
      return {
        body: await intakeStatus(
          currentContext(),
          stringField(input.query.companyId),
        ),
      };
    }

    if (input.routeKey === "ingest-event") {
      if (!isRecord(input.body)) {
        return { status: 400, body: { error: "JSON object body required" } };
      }
      const result = await recordSourceEvent(
        currentContext(),
        input.body as unknown as SourceEventInput,
      );
      return { status: result.inserted ? 201 : 200, body: result };
    }

    if (input.routeKey === "register-artifact") {
      if (!isRecord(input.body)) {
        return { status: 400, body: { error: "JSON object body required" } };
      }
      return {
        status: 201,
        body: await registerArtifact(
          currentContext(),
          input.body as unknown as RegisterSourceArtifactInput,
        ),
      };
    }

    if (input.routeKey === "register-edge") {
      if (!isRecord(input.body)) {
        return { status: 400, body: { error: "JSON object body required" } };
      }
      return {
        status: 201,
        body: await registerArtifactEdge(
          currentContext(),
          input.body as unknown as RegisterSourceArtifactEdgeInput,
        ),
      };
    }

    if (input.routeKey === "register-surface") {
      if (!isRecord(input.body)) {
        return { status: 400, body: { error: "JSON object body required" } };
      }
      return {
        status: 201,
        body: await registerSourceSurface(
          currentContext(),
          input.body as unknown as RegisterSourceSurfaceInput,
        ),
      };
    }

    if (input.routeKey === "set-lifecycle") {
      if (!isRecord(input.body)) {
        return { status: 400, body: { error: "JSON object body required" } };
      }
      return {
        body: await setArtifactLifecycle(
          currentContext(),
          input.body as unknown as SetSourceArtifactLifecycleInput,
        ),
      };
    }

    if (input.routeKey === "active-surfaces") {
      return {
        body: await listActiveSurfaces(currentContext(), {
          companyId: stringField(input.query.companyId) ?? "",
          statuses: queryList(input.query.status),
        }),
      };
    }

    if (input.routeKey === "coverage-audit") {
      const companyId = stringField(input.query.companyId);
      if (!companyId) {
        return { status: 400, body: { error: "companyId is required" } };
      }
      return {
        body: await coverageAudit(currentContext(), companyId),
      };
    }

    return { status: 404, body: { error: `Unknown route ${input.routeKey}` } };
  },

  async onWebhook(input: PluginWebhookInput) {
    await recordWebhookDelivery(currentContext(), input);
  },

  async onHealth() {
    return {
      status: "ok",
      message: "GitHub PR Feedback worker is running",
      details: {
        surfaces: [
          "issue_comments",
          "pull_request_comments",
          "pull_request_reviews",
          "pull_request_review_threads",
          "check_runs",
          "workflow_runs",
        ],
      },
    };
  },
});

let setupContext: PluginContext | null = null;

function currentContext(): PluginContext {
  if (!setupContext) {
    throw new Error("Plugin context is not ready");
  }
  return setupContext;
}

function queryList(
  value: string | string[] | undefined,
): SourceArtifactLifecycleStatus[] | undefined {
  if (Array.isArray(value)) {
    return value
      .flatMap((item) => item.split(","))
      .filter(Boolean) as SourceArtifactLifecycleStatus[];
  }
  return value?.split(",").filter(Boolean) as
    | SourceArtifactLifecycleStatus[]
    | undefined;
}

export default plugin;
export { recordSourceEvent, recordWebhookDelivery, intakeStatus };
runWorker(plugin, import.meta.url);

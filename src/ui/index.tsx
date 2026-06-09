import * as React from "react";
import {
  MarkdownBlock,
  useHostContext,
  usePluginAction,
  usePluginData,
} from "@paperclipai/plugin-sdk/ui";

type StatusData = {
  artifactCount: number;
  eventCounts: Record<string, number>;
  webhookDeliveryCounts: Record<string, number>;
};

function StatusSummary() {
  const host = useHostContext();
  const status = usePluginData<StatusData>("status", {
    companyId: host.companyId,
  });

  if (status.loading) {
    return <div>Loading GitHub intake status...</div>;
  }

  if (status.error) {
    return <div>Failed to load GitHub intake status.</div>;
  }

  const data = status.data ?? {
    artifactCount: 0,
    eventCounts: {},
    webhookDeliveryCounts: {},
  };

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div>
        <strong>Artifacts:</strong> {data.artifactCount}
      </div>
      <div>
        <strong>Source events:</strong>{" "}
        {Object.entries(data.eventCounts)
          .map(([key, value]) => `${key}: ${value}`)
          .join(", ") || "none"}
      </div>
      <div>
        <strong>Webhook deliveries:</strong>{" "}
        {Object.entries(data.webhookDeliveryCounts)
          .map(([key, value]) => `${key}: ${value}`)
          .join(", ") || "none"}
      </div>
    </div>
  );
}

export function DashboardWidget() {
  return (
    <section style={{ display: "grid", gap: 12 }}>
      <h3>GitHub Intake</h3>
      <StatusSummary />
    </section>
  );
}

export function GitHubIntakePage() {
  return (
    <main style={{ maxWidth: 960, padding: 24 }}>
      <h1>GitHub Source Intake</h1>
      <StatusSummary />
      <MarkdownBlock
        content={[
          "## Covered surfaces",
          "",
          "- Issue comments",
          "- Pull request comments",
          "- Pull request reviews",
          "- Pull request review threads",
          "- Check runs",
          "- Check suites",
          "- Workflow runs",
          "",
          "Webhook intake and reconciliation scanners write to the same source-event tables.",
        ].join("\n")}
      />
    </main>
  );
}

export function SettingsPage() {
  const host = useHostContext();
  const setupCompany = usePluginAction("setup-company");
  const [status, setStatus] = React.useState<
    "idle" | "loading" | "success" | "error"
  >("idle");

  return (
    <main style={{ maxWidth: 760, padding: 24 }}>
      <h1>GitHub Intake Settings</h1>
      <p>
        Configure GitHub credentials in the plugin instance settings, then
        reconcile managed Paperclip resources for each company.
      </p>
      <button
        type="button"
        onClick={() => {
          setStatus("loading");
          setupCompany({ companyId: host.companyId })
            .then(() => setStatus("success"))
            .catch(() => setStatus("error"));
        }}
      >
        Reconcile managed resources
      </button>
      {status === "loading" ? <p>Reconciling...</p> : null}
      {status === "error" ? <p>Reconciliation failed.</p> : null}
      {status === "success" ? <p>Managed resources reconciled.</p> : null}
    </main>
  );
}

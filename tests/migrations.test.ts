import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migrationPath = fileURLToPath(
  new URL("../migrations/001_source_intake.sql", import.meta.url),
);

describe("plugin migrations", () => {
  it("uses Paperclip validator-compatible qualified object references", () => {
    const sql = readFileSync(migrationPath, "utf8");

    expect(sql).toContain("plugin_github_pr_feedback_faf63ecd83.");
    expect(sql).not.toMatch(
      /\bcreate\s+(?:unique\s+)?index(?:\s+concurrently)?\s+(?:if\s+not\s+exists\s+)?plugin_github_pr_feedback_faf63ecd83\./i,
    );
    expect(sql).toMatch(
      /\bcreate\s+(?:unique\s+)?index(?:\s+concurrently)?\s+(?:if\s+not\s+exists\s+)?source_events_status_idx\s+on\s+plugin_github_pr_feedback_faf63ecd83\.source_events/i,
    );
  });
});

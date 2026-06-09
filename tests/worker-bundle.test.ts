import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const workerPath = fileURLToPath(new URL("../dist/worker.js", import.meta.url));

describe("worker bundle", () => {
  it("does not require plugin SDK runtime dependencies from the install folder", () => {
    const worker = readFileSync(workerPath, "utf8");

    expect(worker).not.toContain("from \"@paperclipai/plugin-sdk\"");
    expect(worker).not.toContain("from '@paperclipai/plugin-sdk'");
  });
});

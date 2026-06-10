import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const workerSourcePath = fileURLToPath(new URL("../src/worker.ts", import.meta.url));

describe("worker database contract", () => {
  it("does not send write SQL through ctx.db.query", () => {
    const worker = readFileSync(workerSourcePath, "utf8");
    const queryWritePattern =
      /ctx\.db\.query(?:<[^>]+>)?\(\s*`[\s\n]*(?:INSERT|UPDATE|DELETE|WITH)\b/gi;

    expect(worker.match(queryWritePattern) ?? []).toEqual([]);
  });
});

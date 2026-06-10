import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import manifest from "../src/manifest.js";

const packageJsonPath = fileURLToPath(new URL("../package.json", import.meta.url));

describe("manifest version", () => {
  it("matches package.json", () => {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
      version: string;
    };

    expect(manifest.version).toBe(packageJson.version);
  });
});

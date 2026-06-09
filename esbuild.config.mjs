import esbuild from "esbuild";
import { mkdir } from "node:fs/promises";

const watch = process.argv.includes("--watch");

const shared = {
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node22",
  sourcemap: true,
};

await mkdir("dist/ui", { recursive: true });

const builds = [
  esbuild.context({
    ...shared,
    entryPoints: ["src/manifest.ts"],
    outfile: "dist/manifest.js",
  }),
  esbuild.context({
    ...shared,
    entryPoints: ["src/worker.ts"],
    outfile: "dist/worker.js",
  }),
  esbuild.context({
    bundle: true,
    format: "esm",
    platform: "browser",
    target: "es2022",
    sourcemap: true,
    packages: "external",
    entryPoints: ["src/ui/index.tsx"],
    outdir: "dist/ui",
  }),
];

const contexts = await Promise.all(builds);

if (watch) {
  await Promise.all(contexts.map((context) => context.watch()));
  console.log("Watching Paperclip GitHub plugin...");
} else {
  await Promise.all(contexts.map((context) => context.rebuild()));
  await Promise.all(contexts.map((context) => context.dispose()));
}

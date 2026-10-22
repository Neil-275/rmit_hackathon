// Runner for scripts/seed-demo.ts: bundles it for Node with esbuild (already a dependency) and runs it.
// Usage: npm run seed:demo  (server must run with VOICEVAULT_AUTH_MODE=simulated; VOICEVAULT_URL defaults to http://localhost:3000)
import { build } from "esbuild";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tmp = mkdtempSync(path.join(tmpdir(), "voicevault-seed-"));
const outfile = path.join(tmp, "seed-demo.mjs");
try {
  await build({ entryPoints: [path.join(root, "scripts/seed-demo.ts")], outfile, bundle: true, format: "esm", platform: "node", target: ["node20"], logLevel: "warning" });
  await import(pathToFileURL(outfile).href);
} finally {
  // The bundle has finished its top-level work once import() resolves; keep the temp dir until then.
  process.on("exit", () => rmSync(tmp, { recursive: true, force: true }));
}

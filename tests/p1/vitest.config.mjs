import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export default defineConfig({
  root,
  test: {
    include: ["tests/p1/**/*.test.ts"],
    environment: "node",
    pool: "forks",
    testTimeout: 30000,
    hookTimeout: 60000,
  },
});

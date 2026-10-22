// DB SQLite tạm cho mỗi lần chạy: tạo file riêng, đẩy schema bằng prisma db push, xoá khi xong.
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const ROOT = path.resolve(__dirname, "../../..");

export function createTempDb(): { prisma: PrismaClient; cleanup: () => Promise<void> } {
  const dir = mkdtempSync(path.join(tmpdir(), "voicevault-p1-"));
  const url = `file:${path.join(dir, "test.db").replace(/\\/g, "/")}`;
  execFileSync(process.execPath, [
    path.join(ROOT, "node_modules/prisma/build/index.js"), "db", "push",
    "--skip-generate", "--schema", path.join(ROOT, "prisma/schema.prisma"),
  ], { cwd: ROOT, env: { ...process.env, DATABASE_URL: url }, stdio: "pipe" });
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  return {
    prisma,
    cleanup: async () => {
      await prisma.$disconnect();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

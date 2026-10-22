import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTempDb } from "./helpers/db";
import { actor, ideaDto } from "./helpers/dto";
import { loadRoster } from "../../src/server/roster-file";
import { createServices, type Services } from "../../src/server/services";
import { createHttpHandler } from "../../src/server/http";
import { ok } from "../../src/contracts/api";
import { createStubAuth, createStubCrypto, createVoiceVaultLive } from "../../src/integration/browser-runtime";
import { createVoiceVaultUIRuntime } from "../../src/integration/ui-runtime";

const manager = actor("subject-binh", ["employee", "manager"]);
const director = actor("subject-chi", ["employee", "director"]);
const input = (expectedVersion: unknown = 1) => ({ contractVersion: "v1", expectedVersion });
let db: ReturnType<typeof createTempDb>;
let svc: Services;
beforeAll(() => { db = createTempDb(); });
afterAll(async () => { await db?.cleanup(); });
beforeEach(async () => {
  await db.prisma.idea.deleteMany();
  await db.prisma.auditEvent.deleteMany();
  svc = createServices({ prisma: db.prisma, roster: loadRoster(), now: () => new Date("2026-10-22T09:00:00Z") });
});
async function seed() {
  const dto = await ideaDto();
  expect((await svc.createIdea(actor("subject-an"), dto)).ok).toBe(true);
  return dto;
}
const decision = (value: "APPROVE" | "REJECT", version: number) => ({ contractVersion: "v1", decision: value, reason: "reviewed", expectedVersion: version });

describe("manager endorsement", () => {
  it("persists manager endorsement without changing content or the sealed identity", async () => {
    const dto = await seed();
    const before = await db.prisma.idea.findUniqueOrThrow({ where: { id: dto.id } });
    expect(await svc.endorseIdea(manager, dto.id, input())).toMatchObject({ ok: true, data: { status: "ENDORSED", version: 2, endorsedBy: "Bình", endorsedAt: "2026-10-22T09:00:00.000Z" } });
    const after = await db.prisma.idea.findUniqueOrThrow({ where: { id: dto.id } });
    expect(after).toMatchObject({ title: before.title, description: before.description, category: before.category, contentHash: before.contentHash, identityEnvelope: before.identityEnvelope, ciphertextHash: before.ciphertextHash, publishCreditOnApproval: before.publishCreditOnApproval });
    const audit = await db.prisma.auditEvent.findMany({ where: { action: "IDEA_ENDORSED" } });
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ actorSubject: manager.subject, resourceId: dto.id, source: "APP" });
    expect(JSON.stringify(await svc.getIdea(director, dto.id))).not.toMatch(/identityEnvelope|ciphertext|subject-an/);
  });

  it.each([actor("employee"), director, actor("admin", ["it_admin"]), { ...manager, organizationId: "other" }])("denies an unauthorized actor without mutation", async (who) => {
    const dto = await seed();
    expect(await svc.endorseIdea(who, dto.id, input())).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    expect(await db.prisma.idea.findUniqueOrThrow({ where: { id: dto.id } })).toMatchObject({ status: "UNDER_REVIEW", version: 1 });
    expect(await db.prisma.auditEvent.count({ where: { action: "IDEA_ENDORSED" } })).toBe(0);
  });

  it.each([undefined, 0, -1, 1.5, "1", 2_147_483_648, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER + 1])("rejects invalid expectedVersion %s", async (version) => {
    const dto = await seed();
    expect(await svc.endorseIdea(manager, dto.id, { contractVersion: "v1", expectedVersion: version })).toMatchObject({ ok: false, error: { code: "INVALID_REQUEST" } });
  });

  it("rejects signed-out actors, missing ideas and incompatible contracts", async () => {
    const dto = await seed();
    expect(await svc.endorseIdea(null as never, dto.id, input())).toMatchObject({ ok: false, error: { code: "UNAUTHENTICATED" } });
    expect(await svc.endorseIdea(manager, "missing", input())).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });
    expect(await svc.endorseIdea(manager, dto.id, { ...input(), contractVersion: "v2" })).toMatchObject({ ok: false, error: { code: "INVALID_REQUEST" } });
  });

  it("rejects stale versions, duplicate endorsements and terminal ideas", async () => {
    const dto = await seed();
    expect(await svc.endorseIdea(manager, dto.id, input(2))).toMatchObject({ ok: false, error: { code: "VERSION_CONFLICT" } });
    expect((await svc.endorseIdea(manager, dto.id, input())).ok).toBe(true);
    expect(await svc.endorseIdea(manager, dto.id, input(2))).toMatchObject({ ok: false, error: { code: "VERSION_CONFLICT" } });
    expect((await svc.decideIdea(director, dto.id, decision("APPROVE", 2))).ok).toBe(true);
    expect(await svc.endorseIdea(manager, dto.id, input(3))).toMatchObject({ ok: false, error: { code: "VERSION_CONFLICT" } });
    const rejected = await seed();
    expect((await svc.decideIdea(director, rejected.id, decision("REJECT", 1))).ok).toBe(true);
    expect(await svc.endorseIdea(manager, rejected.id, input(2))).toMatchObject({ ok: false, error: { code: "VERSION_CONFLICT" } });
  });

  it("requires endorsement before approval and allows rejection before or after endorsement", async () => {
    const dto = await seed();
    expect(await svc.decideIdea(director, dto.id, decision("APPROVE", 1))).toMatchObject({ ok: false, error: { code: "VERSION_CONFLICT" } });
    expect((await svc.endorseIdea(manager, dto.id, input())).ok).toBe(true);
    expect((await svc.decideIdea(director, dto.id, decision("REJECT", 2))).ok).toBe(true);
  });

  it("allows only one concurrent endorsement and writes one audit event", async () => {
    const dto = await seed();
    const results = await Promise.all([manager, actor("another-manager", ["manager"])].map((who) => svc.endorseIdea(who, dto.id, input())));
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.find((r) => !r.ok)).toMatchObject({ error: { code: "VERSION_CONFLICT" } });
    expect(await db.prisma.auditEvent.count({ where: { action: "IDEA_ENDORSED" } })).toBe(1);
  });

  it("uses verified HTTP actor and maps the full browser action to the UI", async () => {
    const dto = await seed();
    const handler = createHttpHandler({ authenticate: async () => ok(manager), getServices: () => svc });
    const ui = createVoiceVaultUIRuntime(createVoiceVaultLive({ apiBase: "/api/v1", auth: createStubAuth({ authenticated: true, subject: manager.subject }), crypto: createStubCrypto(), fetch: async (url, init) => handler(new Request(new URL(String(url), "https://app.test"), init)) }));
    expect(await ui.getIdea(dto.id)).toMatchObject({ ok: true, data: { capabilities: { canEndorse: true } } });
    expect(await ui.endorseIdea(dto.id, 1)).toMatchObject({ ok: true, data: { status: "ENDORSED", endorsedBy: "Bình", capabilities: { canEndorse: false, canReveal: false } } });
    const forged = await seed();
    const response = await handler(new Request(`https://app.test/api/v1/ideas/${forged.id}/endorse`, { method: "POST", headers: { authorization: "Bearer signed-token" }, body: JSON.stringify({ ...input(), subject: "forged", endorsedBy: "forged", roles: ["director"] }) }));
    expect(response.status).toBe(200);
    const audit = await db.prisma.auditEvent.findFirstOrThrow({ where: { action: "IDEA_ENDORSED", resourceId: forged.id } });
    expect(audit.actorSubject).toBe(manager.subject);
    const employeeHandler = createHttpHandler({ authenticate: async () => ok(actor("subject-an")), getServices: () => svc });
    const denied = await employeeHandler(new Request(`https://app.test/api/v1/ideas/${dto.id}/endorse`, { method: "POST", headers: { authorization: "Bearer signed-token" }, body: JSON.stringify({ ...input(), roles: ["manager"], subject: manager.subject }) }));
    expect(denied.status).toBe(403);
  });
});

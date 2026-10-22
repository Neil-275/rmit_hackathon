import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import path from "node:path";
import type { PrismaClient } from "@prisma/client";
import { createServices, httpStatusOf, type Services } from "../../src/server/services";
import { loadRoster } from "../../src/server/roster";
import { createTempDb } from "./helpers/db";
import { actor, ideaDto, reportDto } from "./helpers/dto";
import { assertApiResult, findForbiddenKeys, quorumFor } from "./helpers/contract.mjs";

const roster = loadRoster(path.resolve(__dirname, "../../config/roster.json"));
const an = actor("subject-an");
const chi = actor("subject-chi", ["employee", "director"]);
const j1 = actor("subject-juror-1");
const j2 = actor("subject-juror-2");
const j3 = actor("subject-juror-3");

let db: ReturnType<typeof createTempDb>;
let prisma: PrismaClient;
let clock = new Date("2026-10-22T08:00:00Z");
let svc: Services;

beforeAll(() => {
  db = createTempDb();
  prisma = db.prisma;
});
afterAll(async () => { await db.cleanup(); });
beforeEach(async () => {
  await prisma.vote.deleteMany();
  await prisma.votingRequest.deleteMany();
  await prisma.report.deleteMany();
  await prisma.idea.deleteMany();
  await prisma.auditEvent.deleteMany();
  clock = new Date("2026-10-22T08:00:00Z");
  // drawInt luôn chọn giá trị nhỏ nhất: N=min và tập ứng viên đầu tiên.
  svc = createServices({ prisma, roster, now: () => clock, drawInt: (min) => min });
});

function expectOk<T>(r: { ok: boolean; data?: T }): T {
  assertApiResult(r);
  expect(r.ok, JSON.stringify(r)).toBe(true);
  return r.data as T;
}
function expectErr(r: unknown, code: string) {
  assertApiResult(r);
  const res = r as { ok: boolean; error: { code: string; enforcement: string } };
  expect(res.ok).toBe(false);
  expect(res.error.code).toBe(code);
  expect(res.error.enforcement).toBe("APP");
}

describe("ideas", () => {
  it("tạo UNDER_REVIEW, không lộ tác giả/envelope, không lưu người nộp", async () => {
    const dto = await ideaDto();
    const created = expectOk(await svc.createIdea(an, dto));
    expect(created).toMatchObject({ id: dto.id, status: "UNDER_REVIEW", version: 1, publicCredit: null });
    const list = expectOk(await svc.listIdeas(chi, {}));
    expect(list.items.map((i) => i.id)).toContain(dto.id);
    expect(findForbiddenKeys(list)).toEqual([]);
    const row = await prisma.idea.findUniqueOrThrow({ where: { id: dto.id } });
    expect(JSON.stringify(row)).not.toContain("subject-an");
    const audit = await prisma.auditEvent.findMany();
    expect(JSON.stringify(audit)).not.toContain("subject-an");
  });

  it("hash sai thì INTEGRITY_MISMATCH, input sai thì INVALID_REQUEST", async () => {
    const dto = await ideaDto();
    expectErr(await svc.createIdea(an, { ...dto, title: "đã sửa" }), "INTEGRITY_MISMATCH");
    expectErr(await svc.createIdea(an, { ...dto, identityEnvelope: { ...dto.identityEnvelope, ciphertext: "khác" } }), "INTEGRITY_MISMATCH");
    expectErr(await svc.createIdea(an, { title: "" }), "INVALID_REQUEST");
    expect(httpStatusOf(await svc.createIdea(an, {}))).toBe(400);
  });

  it("retry cùng id/nội dung trả bản cũ, khác nội dung bị VERSION_CONFLICT", async () => {
    const dto = await ideaDto();
    expectOk(await svc.createIdea(an, dto));
    expectOk(await svc.createIdea(an, dto));
    expectErr(await svc.createIdea(an, await ideaDto({ id: dto.id, title: "khác" })), "VERSION_CONFLICT");
    expect(await prisma.idea.count()).toBe(1);
  });

  it("chưa đăng nhập hoặc khác org bị chặn", async () => {
    expectErr(await svc.createIdea(null as never, await ideaDto()), "UNAUTHENTICATED");
    expectErr(await svc.listIdeas({ ...an, organizationId: "other" }, {}), "FORBIDDEN");
  });

  it("director quyết định với expectedVersion; không quyết định lại", async () => {
    const dto = await ideaDto();
    expectOk(await svc.createIdea(an, dto));
    expectErr(await svc.decideIdea(an, dto.id, { contractVersion: "v1", decision: "APPROVE", reason: "", expectedVersion: 1 }), "FORBIDDEN");
    expectErr(await svc.decideIdea(chi, dto.id, { contractVersion: "v1", decision: "APPROVE", reason: "", expectedVersion: 2 }), "VERSION_CONFLICT");
    const approved = expectOk(await svc.decideIdea(chi, dto.id, { contractVersion: "v1", decision: "APPROVE", reason: "tốt", expectedVersion: 1 }));
    expect(approved).toMatchObject({ status: "APPROVED", version: 2 });
    expectErr(await svc.decideIdea(chi, dto.id, { contractVersion: "v1", decision: "REJECT", reason: "", expectedVersion: 2 }), "VERSION_CONFLICT");
  });

  it("envelope ý tưởng chỉ cho director khi APPROVED + consent", async () => {
    const yes = await ideaDto();
    const no = await ideaDto({ publishCreditOnApproval: false });
    expectOk(await svc.createIdea(an, yes));
    expectOk(await svc.createIdea(an, no));
    expectErr(await svc.getIdeaIdentityEnvelope(chi, yes.id), "VERSION_CONFLICT");
    for (const d of [yes, no]) {
      expectOk(await svc.decideIdea(chi, d.id, { contractVersion: "v1", decision: "APPROVE", reason: "", expectedVersion: 1 }));
    }
    expectErr(await svc.getIdeaIdentityEnvelope(an, yes.id), "FORBIDDEN");
    expectErr(await svc.getIdeaIdentityEnvelope(chi, no.id), "FORBIDDEN");
    const env = expectOk(await svc.getIdeaIdentityEnvelope(chi, yes.id));
    expect(env.envelope.ciphertext).toBe(yes.identityEnvelope.ciphertext);
  });
});

describe("reports + voting", () => {
  async function investigating() {
    const dto = await reportDto(["subject-an"]);
    const report = expectOk(await svc.createReport(an, dto));
    expect(report.status).toBe("INVESTIGATING");
    expect(report.voterCount).toBe(3);
    expect(report.quorumRequired).toBe(quorumFor(3));
    expect(report.votingRequestId).toBeNull();
    return dto;
  }
  async function unmask(reportId: string) {
    return expectOk(await svc.createUnmaskRequest(j1, reportId, { contractVersion: "v1", recipientSubject: "subject-juror-3", purpose: "điều tra" }));
  }
  const vote = (who: typeof j1, id: string, decision: "APPROVE" | "DENY") =>
    svc.castVote(who, id, { contractVersion: "v1", votingRequestId: id, decision, reason: "r" });

  it("thiếu jury thì lưu AWAITING_ELIGIBLE_JURY, yêu cầu mở trả INSUFFICIENT_ELIGIBLE_JURORS", async () => {
    // Tố juror-1 loại juror-1 và chuỗi quản lý (chi); còn 2 juror < min 3.
    const dto = await reportDto(["subject-juror-1"]);
    const r = await svc.createReport(an, dto);
    const report = expectOk(r);
    expect(httpStatusOf(r, 201)).toBe(201);
    expect(report).toMatchObject({ status: "AWAITING_ELIGIBLE_JURY", votingRequestId: null });
    expectErr(await svc.createUnmaskRequest(chi, dto.id, { contractVersion: "v1", recipientSubject: "subject-juror-3", purpose: "x" }), "INSUFFICIENT_ELIGIBLE_JURORS");
  });

  it("accused không có trong directory bị INVALID_REQUEST", async () => {
    expectErr(await svc.createReport(an, await reportDto(["ghost"])), "INVALID_REQUEST");
  });

  it("người ngoài assignment không thấy phản ánh; list không có ciphertext", async () => {
    const dto = await investigating();
    expectErr(await svc.getReport(an, dto.id), "NOT_FOUND");
    expect(expectOk(await svc.listReports(an, {})).items).toEqual([]);
    const list = expectOk(await svc.listReports(chi, {}));
    expect(list.items).toHaveLength(1);
    expect(findForbiddenKeys(list)).toEqual([]);
    expect(JSON.stringify(list)).not.toContain("opaque-");
  });

  it("luồng mở: dưới T QUORUM_PENDING, đủ T có independent READY, chỉ recipient mở được", async () => {
    const dto = await investigating();
    const vr = await unmask(dto.id);
    expect(vr).toMatchObject({ state: "COLLECTING", voterCount: 3, quorumRequired: 2, validApprovals: 0, reportId: dto.id });
    expect(expectOk(await svc.getReport(chi, dto.id)).votingRequestId).toBe(vr.id);

    expectErr(await vote(an, vr.id, "APPROVE"), "NOT_FOUND");
    expectErr(await svc.getReportIdentityEnvelope(j3, dto.id, vr.id), "QUORUM_PENDING");

    const after1 = expectOk(await vote(j1, vr.id, "APPROVE"));
    expect(after1).toMatchObject({ state: "COLLECTING", validApprovals: 1 });
    expect(after1.voters.find((v) => v.subject === j1.subject)).toMatchObject({ hasVoted: true, decision: "APPROVE" });
    expect(after1.voters.find((v) => v.subject === j3.subject)).not.toHaveProperty("decision");
    expectErr(await vote(j1, vr.id, "APPROVE"), "FORBIDDEN");
    expect(expectOk(await svc.getVotingRequest(j1, vr.id)).validApprovals).toBe(1);

    // Hai phiếu không independent chưa READY.
    const after2 = expectOk(await vote(j2, vr.id, "APPROVE"));
    expect(after2).toMatchObject({ state: "COLLECTING", validApprovals: 2, independentApproved: false });

    const after3 = expectOk(await vote(j3, vr.id, "APPROVE"));
    expect(after3).toMatchObject({ state: "READY", validApprovals: 3, independentApproved: true });

    expectErr(await svc.getReportIdentityEnvelope(chi, dto.id, vr.id), "FORBIDDEN");
    const env = expectOk(await svc.getReportIdentityEnvelope(j3, dto.id, vr.id));
    expect(env.envelope.ciphertext).toBe(dto.identityEnvelope.ciphertext);

    const mine = expectOk(await svc.listMyVotingRequests(j2, {}));
    expect(mine.items.map((i) => i.id)).toEqual([vr.id]);
    expect(expectOk(await svc.listMyVotingRequests(an, {})).items).toEqual([]);
  });

  it("một DENY kết thúc; không vote tiếp, không mở", async () => {
    const dto = await investigating();
    const vr = await unmask(dto.id);
    const denied = expectOk(await vote(j2, vr.id, "DENY"));
    expect(denied.state).toBe("DENIED");
    expect(denied.voters.find((v) => v.subject === j2.subject)).toMatchObject({ hasVoted: true, decision: "DENY" });
    expectErr(await vote(j3, vr.id, "APPROVE"), "VERSION_CONFLICT");
    expectErr(await svc.getReportIdentityEnvelope(j3, dto.id, vr.id), "FORBIDDEN");
  });

  it("hết hạn trả APPROVAL_EXPIRED", async () => {
    const dto = await investigating();
    const vr = await unmask(dto.id);
    clock = new Date(clock.getTime() + 73 * 3600 * 1000);
    expectErr(await vote(j1, vr.id, "APPROVE"), "APPROVAL_EXPIRED");
    expectErr(await svc.getReportIdentityEnvelope(j3, dto.id, vr.id), "APPROVAL_EXPIRED");
  });

  it("READY hết hạn không phát hành envelope và cho phép tạo round mới", async () => {
    const dto = await investigating();
    const vr = await unmask(dto.id);
    expectOk(await vote(j1, vr.id, "APPROVE"));
    expect(expectOk(await vote(j3, vr.id, "APPROVE")).state).toBe("READY");
    clock = new Date(clock.getTime() + 73 * 3600 * 1000);
    expectErr(await svc.getReportIdentityEnvelope(j3, dto.id, vr.id), "APPROVAL_EXPIRED");
    expect((await unmask(dto.id)).id).not.toBe(vr.id);
  });

  it("hai yêu cầu mở đồng thời chỉ tạo một round đang hoạt động", async () => {
    const dto = await investigating();
    const results = await Promise.all(["điều tra A", "điều tra B"].map((purpose) =>
      svc.createUnmaskRequest(j1, dto.id, { contractVersion: "v1", recipientSubject: j3.subject, purpose }),
    ));
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expectErr(results.find((r) => !r.ok), "VERSION_CONFLICT");
    expect(await prisma.votingRequest.count()).toBe(1);
    const report = await prisma.report.findUniqueOrThrow({ where: { id: dto.id } });
    expect(report.votingRequestId).toBe(expectOk(results.find((r) => r.ok)!).id);
  });

  it("round READY không còn là round hiện hành không phát hành envelope", async () => {
    const dto = await investigating();
    const vr = await unmask(dto.id);
    expectOk(await vote(j1, vr.id, "APPROVE"));
    expectOk(await vote(j3, vr.id, "APPROVE"));
    await prisma.report.update({ where: { id: dto.id }, data: { votingRequestId: null } });
    expectErr(await svc.getReportIdentityEnvelope(j3, dto.id, vr.id), "NOT_FOUND");
  });

  it("chỉ juror được bốc tạo yêu cầu mở; recipient bị tố bị từ chối", async () => {
    const dto = await investigating();
    expectErr(await svc.createUnmaskRequest(chi, dto.id, { contractVersion: "v1", recipientSubject: "subject-juror-3", purpose: "x" }), "FORBIDDEN");
    expectErr(await svc.createUnmaskRequest(j1, dto.id, { contractVersion: "v1", recipientSubject: "subject-an", purpose: "x" }), "INVALID_REQUEST");
  });

  it("audit ghi nguồn APP, không có người nộp", async () => {
    const dto = await investigating();
    const vr = await unmask(dto.id);
    expectOk(await vote(j1, vr.id, "APPROVE"));
    expectErr(await svc.listAudit(an, {}), "FORBIDDEN");
    const page = expectOk(await svc.listAudit(chi, {}));
    expect(page.items.length).toBeGreaterThanOrEqual(3);
    for (const e of page.items) expect(e.source).toBe("APP");
    expect(findForbiddenKeys(page)).toEqual([]);
    const raw = await prisma.auditEvent.findMany({ where: { action: "REPORT_SUBMITTED" } });
    expect(raw).toHaveLength(1);
    expect(raw[0].actorSubject).toBeNull();
  });

it("serializes concurrent closing votes so only one can close the round", async () => {
  const dto = await investigating(); const vr = await unmask(dto.id);
  expectOk(await vote(j1, vr.id, "APPROVE"));
  const results = await Promise.all([vote(j2, vr.id, "DENY"), vote(j3, vr.id, "APPROVE")]);
  expect(results.filter(r => r.ok)).toHaveLength(1);
  expectErr(results.find(r => !r.ok), "VERSION_CONFLICT");
  expect(await prisma.vote.count({ where: { votingRequestId: vr.id } })).toBe(2);
  expect(["READY", "DENIED"]).toContain(expectOk(await svc.getVotingRequest(j1, vr.id)).state);
});

it("report views carry fixed assigned voters before an unmask round exists", async () => {
  const dto = await investigating();
  const report = expectOk(await svc.getReport(j1, dto.id));
  expect(report.votingRequestId).toBeNull();
  expect(report.voters).toHaveLength(3);
  expect(report.voters).toContainEqual({ subject: j3.subject, displayName: "Juror 3", independent: true });
});

  it("rolls back a vote when writing its audit event fails", async () => {
    const dto = await investigating(); const vr = await unmask(dto.id);
    const broken = prisma.$extends({ query: { auditEvent: { async create() { throw new Error("audit unavailable"); } } } });
    const service = createServices({ prisma: broken as unknown as PrismaClient, roster, now: () => clock });
    await expect(service.castVote(j1, vr.id, { contractVersion: "v1", votingRequestId: vr.id, decision: "APPROVE", reason: "reviewed" })).rejects.toThrow("audit unavailable");
    expect(await prisma.vote.count({ where: { votingRequestId: vr.id } })).toBe(0);
    expect(expectOk(await svc.getVotingRequest(j1, vr.id)).state).toBe("COLLECTING");
  });

  it("rolls back an unmask request when writing its audit event fails", async () => {
    const dto = await investigating();
    const broken = prisma.$extends({ query: { auditEvent: { async create() { throw new Error("audit unavailable"); } } } });
    const service = createServices({ prisma: broken as unknown as PrismaClient, roster, now: () => clock });
    await expect(service.createUnmaskRequest(j1, dto.id, { contractVersion: "v1", recipientSubject: j3.subject, purpose: "reviewed" })).rejects.toThrow("audit unavailable");
    expect(await prisma.votingRequest.count()).toBe(0);
    expect((await prisma.report.findUniqueOrThrow({ where: { id: dto.id } })).votingRequestId).toBeNull();
  });

  it("rolls back an idea decision when writing its audit event fails", async () => {
    const dto = await ideaDto(); const idea = expectOk(await svc.createIdea(an, dto));
    const broken = prisma.$extends({ query: { auditEvent: { async create() { throw new Error("audit unavailable"); } } } });
    const service = createServices({ prisma: broken as unknown as PrismaClient, roster, now: () => clock });
    await expect(service.decideIdea(chi, idea.id, { contractVersion: "v1", expectedVersion: idea.version, decision: "REJECT", reason: "reviewed" })).rejects.toThrow("audit unavailable");
    expect((await prisma.idea.findUniqueOrThrow({ where: { id: idea.id } })).status).toBe("UNDER_REVIEW");
  });

});

describe("session / council / directory", () => {
  it("getMe, getCouncil, getDirectory đúng shape", async () => {
    const me = expectOk(await svc.getMe(chi));
    expect(me).toMatchObject({ authenticated: true, roles: ["employee", "director"] });
    expect(me.capabilities).toContain("decideIdea");
    expect(findForbiddenKeys(me)).toEqual([]);
    const council = expectOk(await svc.getCouncil(an));
    expect(council.members.length).toBeGreaterThanOrEqual(3);
    expect(council.members.some((m) => m.independent && m.active)).toBe(true);
    expect(council.rosterHash).toMatch(/^[0-9a-f]{64}$/);
    const dir = expectOk(await svc.getDirectory(an));
    for (const p of dir.people) expect(Object.keys(p).sort()).toEqual(["displayName", "id"]);
  });
});

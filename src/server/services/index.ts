// Service P1, không phụ thuộc framework: (actor, input) => Promise<ApiResult<T>>.
// Route (src/app, agent P0) verify JWT, dựng Actor, gọi service rồi trả JSON với httpStatusOf(result).
// Mọi lỗi ở đây là app chặn: enforcement "APP". Không bao giờ ghi người nộp vào DB/audit.
import { randomInt, randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import {
  ERROR_HTTP_STATUS, MAX_PAGE_SIZE, fail, ok,
  validateCreateIdeaRequest, validateCreateReportRequest, validateCreateUnmaskRequest,
  validateDecideIdeaRequest, validateListQuery, validateSubmitApprovalRequest,
  type Actor, type ApiResult, type AuditEventView, type CouncilView, type DirectoryView,
  type IdeaView, type IdentityEnvelopeResponse, type Page, type ReportView, type SessionView,
  type UnmaskRequestView, type VotingRequestView, type ResourceKind,
} from "../../contracts/api";
import { hashCiphertext, hashIdeaV1, hashReportV1 } from "../../contracts/encoding";
import { computeEligible, selectVotingAssignment, type DrawInt, type EligibleVoter, type VotingAssignment } from "../domain/council";
import { canCast, tally, type VotingState } from "../domain/voting";
import { decideIdeaTransition, ideaIdentityOpenable, initialReportStatus, type IdeaStatus, type ReportStatus } from "../domain/lifecycle";
import type { Roster } from "../roster";

export interface ServiceDeps {
  prisma: PrismaClient;
  roster: Roster;
  now?: () => Date;
  drawInt?: DrawInt;
  newId?: () => string;
  /** Thời hạn của một VotingRequest, mặc định 72 giờ. */
  votingTtlMs?: number;
}

type Result<T> = Promise<ApiResult<T>>;

export function httpStatusOf(result: ApiResult<unknown>, successStatus = 200): number {
  return result.ok ? successStatus : ERROR_HTTP_STATUS[result.error.code];
}

export const unauthenticated = (): ApiResult<never> => fail("UNAUTHENTICATED", "cần đăng nhập", { retryable: false });

const hasRole = (actor: Actor, ...roles: string[]): boolean => roles.some((r) => actor.roles.includes(r));
const isOversight = (actor: Actor): boolean => hasRole(actor, "director", "auditor");

type IdeaRow = Awaited<ReturnType<PrismaClient["idea"]["findUniqueOrThrow"]>>;
type ReportRow = Awaited<ReturnType<PrismaClient["report"]["findUniqueOrThrow"]>>;
type VotingRow = Awaited<ReturnType<PrismaClient["votingRequest"]["findUniqueOrThrow"]>> & {
  votes: { voterSubject: string; decision: string }[];
};

function paginate<T>(rows: T[], limit: number, offset: number): Page<T> {
  const items = rows.slice(0, limit);
  return { items, nextCursor: rows.length > limit ? String(offset + limit) : null };
}

const parseCursor = (cursor: string | null | undefined): number | null => {
  if (cursor === null || cursor === undefined || cursor === "") return 0;
  const n = Number(cursor);
  return Number.isInteger(n) && n >= 0 ? n : null;
};

export function createServices(deps: ServiceDeps) {
  const { prisma, roster } = deps;
  const now = deps.now ?? (() => new Date());
  const drawInt = deps.drawInt ?? randomInt;
  const newId = deps.newId ?? randomUUID;
  const votingTtlMs = deps.votingTtlMs ?? 72 * 3600 * 1000;

  const personaOf = (subject: string) => roster.personas.find((p) => p.subject === subject);
  const displayNameOf = (subject: string) =>
    roster.directory.find((p) => p.id === subject)?.displayName ?? personaOf(subject)?.displayName ?? subject;
  const isCouncilMember = (subject: string) => roster.council.members.some((m) => m.subject === subject && m.active);

  const guardOrg = (actor: Actor | null | undefined): ApiResult<never> | null => {
    if (!actor || typeof actor.subject !== "string" || !actor.subject) return unauthenticated();
    if (actor.organizationId !== roster.organizationId) return fail("FORBIDDEN", "khác tổ chức");
    return null;
  };

  async function audit(e: {
    action: string; resourceKind?: ResourceKind | null; resourceId?: string | null;
    result?: "OK" | "DENIED" | "ERROR"; actorSubject?: string | null;
  }) {
    await prisma.auditEvent.create({
      data: {
        id: newId(), organizationId: roster.organizationId, action: e.action,
        resourceKind: e.resourceKind ?? null, resourceId: e.resourceId ?? null,
        source: "APP", result: e.result ?? "OK", actorSubject: e.actorSubject ?? null,
        occurredAt: now(),
      },
    });
  }

  // ---------- View mapping ----------

  const ideaView = (row: IdeaRow, actor: Actor): IdeaView => {
    const status = row.status as IdeaStatus;
    const capabilities: string[] = [];
    if (hasRole(actor, "director") && status === "UNDER_REVIEW") capabilities.push("decide");
    if (hasRole(actor, "director") && ideaIdentityOpenable(status, row.publishCreditOnApproval)) capabilities.push("revealIdentity");
    return {
      id: row.id, version: row.version, status, title: row.title, description: row.description,
      category: row.category, publishCreditOnApproval: row.publishCreditOnApproval,
      // Public credit cần artifact G4 đã xác minh; P1 chưa có nên luôn null.
      publicCredit: null,
      capabilities, contentHash: row.contentHash, createdAt: row.createdAt.toISOString(),
      decidedAt: row.decidedAt ? row.decidedAt.toISOString() : null, decisionReason: row.decisionReason,
    };
  };

  const assignmentOf = (row: ReportRow): VotingAssignment | null =>
    row.assignmentJson ? (JSON.parse(row.assignmentJson) as VotingAssignment) : null;

  const reportView = (row: ReportRow, actor: Actor): ReportView => {
    const assignment = assignmentOf(row);
    const capabilities: string[] = [];
    if (assignment?.voters.some((v) => v.id === actor.subject) && row.status === "INVESTIGATING") capabilities.push("requestUnmask");
    return {
      id: row.id, version: row.version, status: row.status as ReportStatus, title: row.title,
      evidenceDetails: row.evidenceDetails, accusedPersonIds: JSON.parse(row.accusedJson) as string[],
      votingRequestId: row.votingRequestId, capabilities,
      councilVersion: row.councilVersion, councilRosterHash: row.councilRosterHash,
      voterCount: assignment?.voterCount ?? null, quorumRequired: assignment?.quorumRequired ?? null,
      contentHash: row.contentHash, createdAt: row.createdAt.toISOString(),
    };
  };

  const snapshotOf = (row: VotingRow) => ({
    state: row.state as VotingState,
    voters: JSON.parse(row.votersJson) as EligibleVoter[],
    quorumRequired: row.quorumRequired,
    expiresAt: row.expiresAt,
    votes: row.votes.map((v) => ({ voterSubject: v.voterSubject, decision: v.decision as "APPROVE" | "DENY" })),
  });

  const votingView = (row: VotingRow, actor: Actor): VotingRequestView => {
    const snap = snapshotOf(row);
    const t = tally(snap, now());
    const capabilities: string[] = [];
    if (canCast(snap, actor.subject, now()).ok) capabilities.push("vote");
    if (t.state === "READY" && row.recipientSubject === actor.subject) capabilities.push("revealIdentity");
    return {
      id: row.id, version: row.version, operation: row.operation as VotingRequestView["operation"],
      resourceKind: row.resourceKind as ResourceKind, resourceId: row.resourceId, state: t.state,
      voterCount: row.voterCount, quorumRequired: row.quorumRequired,
      voters: snap.voters.map((v) => {
        const decision = snap.votes.find((vote) => vote.voterSubject === v.id)?.decision;
        return {
          subject: v.id, displayName: displayNameOf(v.id), independent: v.independent, hasVoted: t.voted.has(v.id),
          ...(decision ? { decision } : {}),
        };
      }),
      validApprovals: t.validApprovals, independentApproved: t.independentApproved,
      expiresAt: row.expiresAt.toISOString(), recipientSubject: row.recipientSubject, purpose: row.purpose,
      councilVersion: row.councilVersion, capabilities,
    };
  };

  const canSeeVoting = (row: VotingRow, actor: Actor) =>
    isOversight(actor) || row.recipientSubject === actor.subject
    || (JSON.parse(row.votersJson) as EligibleVoter[]).some((v) => v.id === actor.subject);

  const canSeeReport = (row: ReportRow, actor: Actor) =>
    isOversight(actor) || !!assignmentOf(row)?.voters.some((v) => v.id === actor.subject);

  const findVoting = (id: string) =>
    prisma.votingRequest.findFirst({
      where: { id, organizationId: roster.organizationId },
      include: { votes: { orderBy: { id: "asc" } } },
    }) as Promise<VotingRow | null>;

  // ---------- Session / directory / council ----------

  async function getMe(actor: Actor): Result<SessionView> {
    const denied = guardOrg(actor);
    if (denied) return denied;
    const capabilities = new Set<string>();
    if (hasRole(actor, "employee")) { capabilities.add("submitIdea"); capabilities.add("submitReport"); }
    if (hasRole(actor, "director")) { capabilities.add("decideIdea"); capabilities.add("revealIdeaIdentity"); }
    if (isOversight(actor)) capabilities.add("viewAudit");
    if (isCouncilMember(actor.subject)) capabilities.add("vote");
    return ok({
      authenticated: true, subject: actor.subject, displayName: displayNameOf(actor.subject),
      organizationId: actor.organizationId, roles: [...actor.roles], capabilities: [...capabilities],
    });
  }

  async function getDirectory(actor: Actor): Result<DirectoryView> {
    const denied = guardOrg(actor);
    if (denied) return denied;
    return ok({ people: roster.directory.map((p) => ({ id: p.id, displayName: p.displayName })) });
  }

  async function getCouncil(actor: Actor): Result<CouncilView> {
    const denied = guardOrg(actor);
    if (denied) return denied;
    return ok({
      version: roster.council.version, rosterHash: roster.rosterHash,
      members: roster.council.members.map((m) => ({ ...m })),
      selectionPolicy: { ...roster.council.selectionPolicy },
    });
  }

  // ---------- Ideas ----------

  async function listIdeas(actor: Actor, query?: unknown): Result<Page<IdeaView>> {
    const denied = guardOrg(actor);
    if (denied) return denied;
    const q = validateListQuery(query);
    if (!q.ok) return fail("INVALID_REQUEST", q.message);
    const offset = parseCursor(q.value.cursor);
    if (offset === null) return fail("INVALID_REQUEST", "cursor sai");
    const rows = await prisma.idea.findMany({
      where: { organizationId: roster.organizationId, ...(q.value.status ? { status: q.value.status } : {}) },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }], skip: offset, take: q.value.limit + 1,
    });
    return ok(paginate(rows.map((r) => ideaView(r, actor)), q.value.limit, offset));
  }

  async function getIdea(actor: Actor, id: string): Result<IdeaView> {
    const denied = guardOrg(actor);
    if (denied) return denied;
    const row = await prisma.idea.findFirst({ where: { id: String(id ?? "").toLowerCase(), organizationId: roster.organizationId } });
    return row ? ok(ideaView(row, actor)) : fail("NOT_FOUND", "không tìm thấy ý tưởng");
  }

  async function createIdea(actor: Actor, input: unknown): Result<IdeaView> {
    const denied = guardOrg(actor);
    if (denied) return denied;
    if (!hasRole(actor, "employee")) return fail("FORBIDDEN", "cần role employee");
    const v = validateCreateIdeaRequest(input);
    if (!v.ok) return fail("INVALID_REQUEST", v.message);
    const dto = v.value;
    const b = dto.identityEnvelope.binding;
    if (b.organizationId !== roster.organizationId) return fail("INVALID_REQUEST", "binding khác tổ chức");
    if (b.contentVersion !== 1) return fail("INVALID_REQUEST", "contentVersion phải là 1");
    const contentHash = await hashIdeaV1({
      organizationId: roster.organizationId, resourceId: dto.id, contentVersion: 1,
      title: dto.title, description: dto.description, category: dto.category,
    });
    if (contentHash !== b.contentHash) return fail("INTEGRITY_MISMATCH", "contentHash không khớp nội dung");
    if ((await hashCiphertext(dto.identityEnvelope.ciphertext)) !== dto.identityEnvelope.ciphertextHash) {
      return fail("INTEGRITY_MISMATCH", "ciphertextHash không khớp");
    }
    const existing = await prisma.idea.findUnique({ where: { id: dto.id } });
    if (existing) {
      // Retry cùng nội dung trả lại bản cũ; UUID trùng với nội dung khác bị từ chối.
      return existing.contentHash === contentHash && existing.organizationId === roster.organizationId
        ? ok(ideaView(existing, actor))
        : fail("VERSION_CONFLICT", "id đã tồn tại");
    }
    const row = await prisma.idea.create({
      data: {
        id: dto.id, organizationId: roster.organizationId, contentVersion: 1,
        title: dto.title, description: dto.description, category: dto.category, contentHash,
        publishCreditOnApproval: dto.publishCreditOnApproval,
        identityEnvelope: JSON.stringify(dto.identityEnvelope), ciphertextHash: dto.identityEnvelope.ciphertextHash,
        policyVersion: b.policyVersion, status: "UNDER_REVIEW", createdAt: now(),
      },
    });
    await audit({ action: "IDEA_SUBMITTED", resourceKind: "IDEA", resourceId: row.id });
    return ok(ideaView(row, actor));
  }

  async function decideIdea(actor: Actor, id: string, input: unknown): Result<IdeaView> {
    const denied = guardOrg(actor);
    if (denied) return denied;
    if (!hasRole(actor, "director")) return fail("FORBIDDEN", "chỉ director được quyết định");
    const v = validateDecideIdeaRequest(input);
    if (!v.ok) return fail("INVALID_REQUEST", v.message);
    const row = await prisma.idea.findFirst({ where: { id: String(id ?? "").toLowerCase(), organizationId: roster.organizationId } });
    if (!row) return fail("NOT_FOUND", "không tìm thấy ý tưởng");
    if (row.version !== v.value.expectedVersion) return fail("VERSION_CONFLICT", "phiên bản đã đổi, tải lại", { retryable: true });
    const next = decideIdeaTransition(row.status as IdeaStatus, v.value.decision);
    if (!next.ok) return fail(next.code, next.message);
    const updated = await prisma.idea.updateMany({
      where: { id: row.id, version: row.version },
      data: { status: next.status, version: row.version + 1, decisionReason: v.value.reason, decidedAt: now() },
    });
    if (updated.count !== 1) return fail("VERSION_CONFLICT", "phiên bản đã đổi, tải lại", { retryable: true });
    await audit({ action: `IDEA_${next.status}`, resourceKind: "IDEA", resourceId: row.id, actorSubject: actor.subject });
    return ok(ideaView(await prisma.idea.findUniqueOrThrow({ where: { id: row.id } }), actor));
  }

  async function getIdeaIdentityEnvelope(actor: Actor, id: string): Result<IdentityEnvelopeResponse> {
    const denied = guardOrg(actor);
    if (denied) return denied;
    if (!hasRole(actor, "director")) return fail("FORBIDDEN", "chỉ director");
    const row = await prisma.idea.findFirst({ where: { id: String(id ?? "").toLowerCase(), organizationId: roster.organizationId } });
    if (!row) return fail("NOT_FOUND", "không tìm thấy ý tưởng");
    if (row.status === "UNDER_REVIEW") return fail("VERSION_CONFLICT", "ý tưởng chưa được duyệt");
    if (!ideaIdentityOpenable(row.status as IdeaStatus, row.publishCreditOnApproval)) {
      await audit({ action: "IDEA_IDENTITY_ENVELOPE_DENIED", resourceKind: "IDEA", resourceId: row.id, result: "DENIED", actorSubject: actor.subject });
      return fail("FORBIDDEN", "không có consent hoặc ý tưởng bị từ chối");
    }
    await audit({ action: "IDEA_IDENTITY_ENVELOPE_RELEASED", resourceKind: "IDEA", resourceId: row.id, actorSubject: actor.subject });
    return ok({ resourceKind: "IDEA", resourceId: row.id, envelope: JSON.parse(row.identityEnvelope) });
  }

  // ---------- Reports ----------

  async function listReports(actor: Actor, query?: unknown): Result<Page<ReportView>> {
    const denied = guardOrg(actor);
    if (denied) return denied;
    const q = validateListQuery(query);
    if (!q.ok) return fail("INVALID_REQUEST", q.message);
    const offset = parseCursor(q.value.cursor);
    if (offset === null) return fail("INVALID_REQUEST", "cursor sai");
    // SQLite không lọc được trong JSON đơn giản; P1 lọc quyền trong bộ nhớ (dữ liệu demo nhỏ).
    const rows = (await prisma.report.findMany({
      where: { organizationId: roster.organizationId, ...(q.value.status ? { status: q.value.status } : {}) },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    })).filter((r) => canSeeReport(r, actor));
    return ok(paginate(rows.slice(offset, offset + q.value.limit + 1).map((r) => reportView(r, actor)), q.value.limit, offset));
  }

  async function getReport(actor: Actor, id: string): Result<ReportView> {
    const denied = guardOrg(actor);
    if (denied) return denied;
    const row = await prisma.report.findFirst({ where: { id: String(id ?? "").toLowerCase(), organizationId: roster.organizationId } });
    // Không được đọc thì trả NOT_FOUND để không lộ sự tồn tại.
    return row && canSeeReport(row, actor) ? ok(reportView(row, actor)) : fail("NOT_FOUND", "không tìm thấy phản ánh");
  }

  async function createReport(actor: Actor, input: unknown): Result<ReportView> {
    const denied = guardOrg(actor);
    if (denied) return denied;
    if (!hasRole(actor, "employee")) return fail("FORBIDDEN", "cần role employee");
    const v = validateCreateReportRequest(input);
    if (!v.ok) return fail("INVALID_REQUEST", v.message);
    const dto = v.value;
    const b = dto.identityEnvelope.binding;
    if (b.organizationId !== roster.organizationId) return fail("INVALID_REQUEST", "binding khác tổ chức");
    if (b.contentVersion !== 1) return fail("INVALID_REQUEST", "contentVersion phải là 1");
    const contentHash = await hashReportV1({
      organizationId: roster.organizationId, resourceId: dto.id, contentVersion: 1,
      title: dto.title, evidenceDetails: dto.evidenceDetails, accusedPersonIds: dto.accusedPersonIds,
    });
    if (contentHash !== b.contentHash) return fail("INTEGRITY_MISMATCH", "contentHash không khớp nội dung");
    if ((await hashCiphertext(dto.identityEnvelope.ciphertext)) !== dto.identityEnvelope.ciphertextHash) {
      return fail("INTEGRITY_MISMATCH", "ciphertextHash không khớp");
    }
    const existing = await prisma.report.findUnique({ where: { id: dto.id } });
    if (existing) {
      // Retry không bốc lại hội đồng.
      return existing.contentHash === contentHash && existing.organizationId === roster.organizationId
        ? ok(reportView(existing, actor))
        : fail("VERSION_CONFLICT", "id đã tồn tại");
    }
    const eligible = computeEligible(roster.council.members, dto.accusedPersonIds, roster.directory);
    if (!eligible.ok) return fail("INVALID_REQUEST", eligible.message);
    const selection = selectVotingAssignment(eligible.value.eligible, roster.council.selectionPolicy, drawInt);
    if (!selection.ok && selection.code !== "INSUFFICIENT_ELIGIBLE_JURORS") return fail("INVALID_REQUEST", selection.message);
    const assignment = selection.ok ? selection.value : null;
    const status = initialReportStatus(assignment !== null);
    const row = await prisma.report.create({
      data: {
        id: dto.id, organizationId: roster.organizationId, contentVersion: 1,
        title: dto.title, evidenceDetails: dto.evidenceDetails, accusedJson: JSON.stringify(dto.accusedPersonIds),
        contentHash, identityEnvelope: JSON.stringify(dto.identityEnvelope),
        ciphertextHash: dto.identityEnvelope.ciphertextHash, policyVersion: b.policyVersion, status,
        councilVersion: roster.council.version, councilRosterHash: roster.rosterHash,
        assignmentJson: assignment ? JSON.stringify(assignment) : null,
        excludedJson: JSON.stringify(eligible.value.excluded), createdAt: now(),
      },
    });
    await audit({ action: assignment ? "REPORT_SUBMITTED" : "REPORT_AWAITING_ELIGIBLE_JURY", resourceKind: "REPORT", resourceId: row.id });
    // Người nộp không nằm trong assignment nên view trả cho họ không có capability nào.
    return ok(reportView(row, actor));
  }

  async function createUnmaskRequest(actor: Actor, reportId: string, input: unknown): Result<UnmaskRequestView> {
    const denied = guardOrg(actor);
    if (denied) return denied;
    const v = validateCreateUnmaskRequest(input);
    if (!v.ok) return fail("INVALID_REQUEST", v.message);
    const report = await prisma.report.findFirst({ where: { id: String(reportId ?? "").toLowerCase(), organizationId: roster.organizationId } });
    if (!report || !canSeeReport(report, actor)) return fail("NOT_FOUND", "không tìm thấy phản ánh");
    const assignment = assignmentOf(report);
    if (!assignment) return fail("INSUFFICIENT_ELIGIBLE_JURORS", "phản ánh đang chờ đủ hội đồng hợp lệ");
    if (!assignment.voters.some((x) => x.id === actor.subject)) return fail("FORBIDDEN", "chỉ juror được bốc mới tạo yêu cầu mở");
    if (report.status !== "INVESTIGATING") return fail("VERSION_CONFLICT", `phản ánh đang ${report.status}`);
    const accused = JSON.parse(report.accusedJson) as string[];
    const excluded = JSON.parse(report.excludedJson) as string[];
    const recipient = v.value.recipientSubject;
    if (!personaOf(recipient) || accused.includes(recipient) || excluded.includes(recipient)) {
      return fail("INVALID_REQUEST", "recipient không hợp lệ hoặc có xung đột lợi ích");
    }
    if (report.votingRequestId) {
      const current = await findVoting(report.votingRequestId);
      if (current) {
        const state = tally(snapshotOf(current), now()).state;
        if (state === "COLLECTING" || state === "READY") {
          // Chỉ một yêu cầu mở đang hoạt động trên một assignment; không bốc lại.
          return current.recipientSubject === recipient && current.purpose === v.value.purpose
            ? ok({ ...votingView(current, actor), votingRequestId: current.id, reportId: report.id })
            : fail("VERSION_CONFLICT", "đã có yêu cầu mở đang hoạt động");
        }
      }
    }
    const id = newId();
    const created = await prisma.$transaction(async (tx) => {
      // Claim this report version before creating a round. A losing caller writes nothing.
      const claimed = await tx.report.updateMany({
        where: {
          id: report.id, organizationId: roster.organizationId, version: report.version,
          votingRequestId: report.votingRequestId, status: "INVESTIGATING",
        },
        data: { votingRequestId: id, version: { increment: 1 } },
      });
      if (claimed.count !== 1) return false;
      await tx.votingRequest.create({
        data: {
          id, organizationId: roster.organizationId, operation: "REVEAL_REPORT_IDENTITY",
          resourceKind: "REPORT", resourceId: report.id, state: "COLLECTING",
          voterCount: assignment.voterCount, quorumRequired: assignment.quorumRequired,
          votersJson: JSON.stringify(assignment.voters), councilVersion: report.councilVersion,
          councilRosterHash: report.councilRosterHash, recipientSubject: recipient, purpose: v.value.purpose,
          nonce: newId(), expiresAt: new Date(now().getTime() + votingTtlMs), createdAt: now(),
        },
      });
      return true;
    });
    if (!created) return fail("VERSION_CONFLICT", "The report changed. Reload and try again.", { retryable: true });
    await audit({ action: "UNMASK_REQUEST_CREATED", resourceKind: "REPORT", resourceId: report.id, actorSubject: actor.subject });
    const row = (await findVoting(id))!;
    return ok({ ...votingView(row, actor), votingRequestId: id, reportId: report.id });
  }

  async function getReportIdentityEnvelope(actor: Actor, reportId: string, votingRequestId: string): Result<IdentityEnvelopeResponse> {
    const denied = guardOrg(actor);
    if (denied) return denied;
    const report = await prisma.report.findFirst({ where: { id: String(reportId ?? "").toLowerCase(), organizationId: roster.organizationId } });
    const row = votingRequestId ? await findVoting(String(votingRequestId)) : null;
    if (!report || !row || report.votingRequestId !== row.id || row.resourceKind !== "REPORT" || row.resourceId !== report.id || row.operation !== "REVEAL_REPORT_IDENTITY") {
      return fail("NOT_FOUND", "không tìm thấy yêu cầu mở");
    }
    if (row.recipientSubject !== actor.subject) {
      await audit({ action: "REPORT_IDENTITY_ENVELOPE_DENIED", resourceKind: "REPORT", resourceId: report.id, result: "DENIED", actorSubject: actor.subject });
      return fail("FORBIDDEN", "chỉ recipient đã được vote mới mở được");
    }
    const state = tally(snapshotOf(row), now()).state;
    if (state !== "READY") {
      await audit({ action: "REPORT_IDENTITY_ENVELOPE_DENIED", resourceKind: "REPORT", resourceId: report.id, result: "DENIED", actorSubject: actor.subject });
      if (state === "COLLECTING") return fail("QUORUM_PENDING", "chưa đủ T phiếu APPROVE có independent");
      if (state === "EXPIRED") return fail("APPROVAL_EXPIRED", "yêu cầu đã hết hạn");
      return fail("FORBIDDEN", `yêu cầu đã ${state}`);
    }
    await audit({ action: "REPORT_IDENTITY_ENVELOPE_RELEASED", resourceKind: "REPORT", resourceId: report.id, actorSubject: actor.subject });
    return ok({ resourceKind: "REPORT", resourceId: report.id, envelope: JSON.parse(report.identityEnvelope) });
  }

  // ---------- Voting ----------

  async function listMyVotingRequests(actor: Actor, query?: unknown): Result<Page<VotingRequestView>> {
    const denied = guardOrg(actor);
    if (denied) return denied;
    const q = validateListQuery(query);
    if (!q.ok) return fail("INVALID_REQUEST", q.message);
    const offset = parseCursor(q.value.cursor);
    if (offset === null) return fail("INVALID_REQUEST", "cursor sai");
    const rows = ((await prisma.votingRequest.findMany({
      where: { organizationId: roster.organizationId },
      include: { votes: { orderBy: { id: "asc" } } },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    })) as VotingRow[]).filter((r) => (JSON.parse(r.votersJson) as EligibleVoter[]).some((v) => v.id === actor.subject));
    return ok(paginate(rows.slice(offset, offset + q.value.limit + 1).map((r) => votingView(r, actor)), q.value.limit, offset));
  }

  async function getVotingRequest(actor: Actor, id: string): Result<VotingRequestView> {
    const denied = guardOrg(actor);
    if (denied) return denied;
    const row = await findVoting(String(id ?? ""));
    return row && canSeeVoting(row, actor) ? ok(votingView(row, actor)) : fail("NOT_FOUND", "không tìm thấy yêu cầu vote");
  }

  async function castVote(actor: Actor, id: string, input: unknown): Result<VotingRequestView> {
    const denied = guardOrg(actor);
    if (denied) return denied;
    const row = await findVoting(String(id ?? ""));
    if (!row || !canSeeVoting(row, actor)) return fail("NOT_FOUND", "không tìm thấy yêu cầu vote");
    const v = validateSubmitApprovalRequest(input, row.id);
    if (!v.ok) return fail("INVALID_REQUEST", v.message);
    const check = canCast(snapshotOf(row), actor.subject, now());
    if (!check.ok) return fail(check.code, check.message);
    try {
      await prisma.vote.create({
        data: { votingRequestId: row.id, voterSubject: actor.subject, decision: v.value.decision, reason: v.value.reason, createdAt: now() },
      });
    } catch (e) {
      if ((e as { code?: string }).code === "P2002") return fail("FORBIDDEN", "đã bỏ phiếu");
      throw e;
    }
    const fresh = (await findVoting(row.id))!;
    const t = tally(snapshotOf(fresh), now());
    if (t.state !== fresh.state) {
      await prisma.votingRequest.updateMany({
        where: { id: fresh.id, version: fresh.version },
        data: { state: t.state, version: fresh.version + 1 },
      });
    }
    await audit({ action: `VOTE_${v.value.decision}`, resourceKind: row.resourceKind as ResourceKind, resourceId: row.resourceId, actorSubject: actor.subject });
    if (t.state !== fresh.state) {
      await audit({ action: `VOTING_${t.state}`, resourceKind: row.resourceKind as ResourceKind, resourceId: row.resourceId });
    }
    return ok(votingView((await findVoting(row.id))!, actor));
  }

  // ---------- Audit ----------

  async function listAudit(actor: Actor, query?: unknown): Result<Page<AuditEventView>> {
    const denied = guardOrg(actor);
    if (denied) return denied;
    if (!isOversight(actor)) return fail("FORBIDDEN", "cần role director hoặc auditor");
    const q = validateListQuery(query);
    if (!q.ok) return fail("INVALID_REQUEST", q.message);
    const offset = parseCursor(q.value.cursor);
    if (offset === null) return fail("INVALID_REQUEST", "cursor sai");
    const rows = await prisma.auditEvent.findMany({
      where: { organizationId: roster.organizationId },
      orderBy: [{ occurredAt: "desc" }, { id: "asc" }], skip: offset, take: Math.min(q.value.limit, MAX_PAGE_SIZE) + 1,
    });
    return ok(paginate(rows.map((r): AuditEventView => ({
      id: r.id, occurredAt: r.occurredAt.toISOString(), action: r.action,
      resourceKind: (r.resourceKind as ResourceKind | null) ?? null, resourceId: r.resourceId,
      source: r.source as AuditEventView["source"], result: r.result as AuditEventView["result"], requestId: r.requestId,
    })), q.value.limit, offset));
  }

  return {
    getMe, getDirectory, getCouncil,
    listIdeas, getIdea, createIdea, decideIdea, getIdeaIdentityEnvelope,
    listReports, getReport, createReport, createUnmaskRequest, getReportIdentityEnvelope,
    listMyVotingRequests, getVotingRequest, castVote,
    listAudit,
  };
}

export type Services = ReturnType<typeof createServices>;

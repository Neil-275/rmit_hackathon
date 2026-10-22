import { describe, expect, it } from "vitest";
import {
  computeEligible, quorumFor, selectVotingAssignment,
  type CouncilMember, type DirectoryPerson, type EligibleVoter,
} from "../../src/server/domain/council";
import { canCast, tally, type VotingSnapshot } from "../../src/server/domain/voting";
import { decideIdeaTransition, ideaIdentityOpenable, initialReportStatus, resolveReportTransition } from "../../src/server/domain/lifecycle";

const pool = (n: number, independentAt: number[] = [n - 1]): EligibleVoter[] =>
  Array.from({ length: n }, (_, i) => ({ id: `j${i}`, independent: independentAt.includes(i) }));

// drawInt xác định: lần đầu trả N mong muốn, các lần sau trả min.
const drawSeq = (...values: number[]) => {
  let i = 0;
  return (min: number, max: number) => {
    const v = values[i++] ?? min;
    if (v < min || v >= max) throw new Error(`draw ${v} ngoài [${min}, ${max})`);
    return v;
  };
};

describe("selectVotingAssignment", () => {
  it.each([[3, 2], [4, 3], [5, 4]])("N=%i cho T=%i", (n, t) => {
    const r = selectVotingAssignment(pool(5), { minVoters: 3, maxVoters: 5 }, drawSeq(n, 0));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.voterCount).toBe(n);
    expect(r.value.quorumRequired).toBe(t);
    expect(r.value.voters).toHaveLength(n);
    expect(new Set(r.value.voters.map((v) => v.id)).size).toBe(n);
    expect(r.value.voters.some((v) => v.independent)).toBe(true);
    expect(quorumFor(n)).toBe(t);
  });

  it("N bị giới hạn bởi |E|: E=3 chỉ có N=3", () => {
    const seen: [number, number][] = [];
    const r = selectVotingAssignment(pool(3), undefined, (min, max) => { seen.push([min, max]); return min; });
    expect(r.ok && r.value.voterCount).toBe(3);
    expect(seen[0]).toEqual([3, 4]);
  });

  it.each([
    ["0 người", pool(0)],
    ["1 người", pool(1)],
    ["2 người", pool(2)],
    ["không có independent", pool(5, [])],
  ])("thiếu jury (%s) trả INSUFFICIENT_ELIGIBLE_JURORS", (_label, eligible) => {
    const r = selectVotingAssignment(eligible, undefined, drawSeq());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("INSUFFICIENT_ELIGIBLE_JURORS");
  });

  it("mọi tập ứng viên đều có independent", () => {
    // 5 người, chỉ j4 independent, N=3: C(4,2)=6 tập hợp lệ.
    for (let k = 0; k < 6; k++) {
      const r = selectVotingAssignment(pool(5, [4]), undefined, drawSeq(3, k));
      expect(r.ok && r.value.voters.some((v) => v.independent)).toBe(true);
    }
  });

  it("policy sai và voter trùng bị từ chối", () => {
    expect(selectVotingAssignment(pool(5), { minVoters: 2, maxVoters: 5 }).ok).toBe(false);
    expect(selectVotingAssignment(pool(5), { minVoters: 3, maxVoters: 6 }).ok).toBe(false);
    expect(selectVotingAssignment([...pool(3), { id: "j0", independent: true }]).ok).toBe(false);
  });
});

describe("computeEligible", () => {
  const member = (subject: string, over: Partial<CouncilMember> = {}): CouncilMember => ({
    subject, displayName: subject, membershipRole: "MEMBER", independent: false, active: true, ...over,
  });
  const roster = [member("eva"), member("frank"), member("grace", { independent: true }), member("henry"), member("iris", { active: false })];
  const directory: DirectoryPerson[] = [
    { id: "binh", displayName: "Bình", managerId: "frank" },
    { id: "frank", displayName: "Frank", managerId: "chi" },
    { id: "chi", displayName: "Chi" },
    { id: "eva", displayName: "Eva" },
    { id: "grace", displayName: "Grace" },
    { id: "henry", displayName: "Henry" },
    { id: "iris", displayName: "Iris" },
  ];

  it("loại người bị tố, chuỗi quản lý và inactive", () => {
    const r = computeEligible(roster, ["binh", "eva"], directory);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.eligible.map((e) => e.id)).toEqual(["grace", "henry"]);
    expect(r.value.excluded).toEqual(["binh", "chi", "eva", "frank"]);
  });

  it("also excludes council members who report to an accused person (directly or indirectly)", () => {
    const reportsUp: DirectoryPerson[] = [
      { id: "chi", displayName: "Chi" },
      { id: "eva", displayName: "Eva", managerId: "chi" },
      { id: "frank", displayName: "Frank", managerId: "eva" },
      { id: "grace", displayName: "Grace" },
      { id: "henry", displayName: "Henry", managerId: "chi" },
      { id: "iris", displayName: "Iris" },
    ];
    const r = computeEligible(roster, ["chi"], reportsUp);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.eligible.map((e) => e.id)).toEqual(["grace"]);
    expect(r.value.excluded).toEqual(["chi", "eva", "frank", "henry"]);
  });

  it("accused không có trong directory bị từ chối", () => {
    const r = computeEligible(roster, ["ghost"], directory);
    expect(!r.ok && r.code).toBe("UNKNOWN_PERSON");
  });

  it("chuỗi quản lý có vòng bị từ chối", () => {
    const cyc: DirectoryPerson[] = [{ id: "a", displayName: "a", managerId: "b" }, { id: "b", displayName: "b", managerId: "a" }];
    const r = computeEligible(roster, ["a"], cyc);
    expect(!r.ok && r.code).toBe("INVALID_DIRECTORY");
  });
});

describe("tally / canCast", () => {
  const voters: EligibleVoter[] = [
    { id: "a", independent: false }, { id: "b", independent: false }, { id: "c", independent: true },
  ];
  const now = new Date("2026-10-22T08:00:00Z");
  const snap = (votes: VotingSnapshot["votes"], over: Partial<VotingSnapshot> = {}): VotingSnapshot => ({
    state: "COLLECTING", voters, quorumRequired: 2, expiresAt: new Date("2026-10-23T00:00:00Z"), votes, ...over,
  });

  it("đủ T nhưng không có independent vẫn COLLECTING", () => {
    const t = tally(snap([{ voterSubject: "a", decision: "APPROVE" }, { voterSubject: "b", decision: "APPROVE" }]), now);
    expect(t).toMatchObject({ state: "COLLECTING", validApprovals: 2, independentApproved: false });
  });

  it("đủ T có independent thì READY", () => {
    const t = tally(snap([{ voterSubject: "a", decision: "APPROVE" }, { voterSubject: "c", decision: "APPROVE" }]), now);
    expect(t).toMatchObject({ state: "READY", validApprovals: 2, independentApproved: true });
  });

  it("vote trùng chỉ tính một, người ngoài jury bị bỏ qua", () => {
    const t = tally(snap([
      { voterSubject: "a", decision: "APPROVE" }, { voterSubject: "a", decision: "APPROVE" },
      { voterSubject: "zed", decision: "APPROVE" },
    ]), now);
    expect(t.validApprovals).toBe(1);
    expect(t.state).toBe("COLLECTING");
  });

  it("một DENY kết thúc request", () => {
    const t = tally(snap([{ voterSubject: "a", decision: "APPROVE" }, { voterSubject: "b", decision: "DENY" }]), now);
    expect(t.state).toBe("DENIED");
  });

  it("hết hạn thì EXPIRED; terminal không hồi sinh", () => {
    expect(tally(snap([], { expiresAt: new Date("2026-10-21T00:00:00Z") }), now).state).toBe("EXPIRED");
    const revived = tally(snap([{ voterSubject: "a", decision: "APPROVE" }, { voterSubject: "c", decision: "APPROVE" }], { state: "DENIED" }), now);
    expect(revived.state).toBe("DENIED");
    expect(tally(snap([], { state: "EXPIRED", expiresAt: new Date("2027-01-01") }), now).state).toBe("EXPIRED");
  });

  it("READY và quorum đã đủ vẫn hết hạn đúng expiresAt", () => {
    const votes: VotingSnapshot["votes"] = [
      { voterSubject: "a", decision: "APPROVE" }, { voterSubject: "c", decision: "APPROVE" },
    ];
    for (const state of ["COLLECTING", "READY"] as const) {
      expect(tally(snap(votes, { state, expiresAt: now }), now).state).toBe("EXPIRED");
    }
  });

  it("canCast: ngoài jury FORBIDDEN, đã vote FORBIDDEN, hết hạn APPROVAL_EXPIRED, đóng VERSION_CONFLICT", () => {
    expect(canCast(snap([]), "zed", now)).toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect(canCast(snap([{ voterSubject: "a", decision: "APPROVE" }]), "a", now)).toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect(canCast(snap([], { expiresAt: new Date("2026-10-21") }), "a", now)).toMatchObject({ ok: false, code: "APPROVAL_EXPIRED" });
    expect(canCast(snap([{ voterSubject: "b", decision: "DENY" }]), "a", now)).toMatchObject({ ok: false, code: "VERSION_CONFLICT" });
    expect(canCast(snap([]), "a", now)).toEqual({ ok: true });
  });
});

describe("lifecycle", () => {
  it("idea: approval requires ENDORSED; rejection is terminal", () => {
    expect(decideIdeaTransition("UNDER_REVIEW", "APPROVE").ok).toBe(false);
    expect(decideIdeaTransition("ENDORSED", "APPROVE")).toEqual({ ok: true, status: "APPROVED" });
    expect(decideIdeaTransition("ENDORSED", "REJECT")).toEqual({ ok: true, status: "REJECTED" });
    expect(decideIdeaTransition("UNDER_REVIEW", "REJECT")).toEqual({ ok: true, status: "REJECTED" });
    expect(decideIdeaTransition("REJECTED", "APPROVE").ok).toBe(false);
    expect(decideIdeaTransition("APPROVED", "REJECT").ok).toBe(false);
  });
  it("report: trạng thái đầu theo assignment, chỉ INVESTIGATING mới RESOLVED", () => {
    expect(initialReportStatus(true)).toBe("INVESTIGATING");
    expect(initialReportStatus(false)).toBe("AWAITING_ELIGIBLE_JURY");
    expect(resolveReportTransition("INVESTIGATING")).toEqual({ ok: true, status: "RESOLVED" });
    expect(resolveReportTransition("AWAITING_ELIGIBLE_JURY").ok).toBe(false);
  });
  it("envelope ý tưởng chỉ mở khi APPROVED + consent", () => {
    expect(ideaIdentityOpenable("APPROVED", true)).toBe(true);
    expect(ideaIdentityOpenable("APPROVED", false)).toBe(false);
    expect(ideaIdentityOpenable("UNDER_REVIEW", true)).toBe(false);
  });
});

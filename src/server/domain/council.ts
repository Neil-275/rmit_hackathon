// Chọn hội đồng cho một phản ánh (§10.2): lọc CoI rồi bốc N, sau đó bốc N người có independent.
// Thuần, không I/O. drawInt tiêm được để test; production dùng node:crypto.randomInt.
import { randomInt } from "node:crypto";

export interface CouncilMember {
  subject: string;
  displayName: string;
  membershipRole: "MEMBER" | "CHAIR";
  independent: boolean;
  active: boolean;
}

export interface DirectoryPerson {
  id: string;
  displayName: string;
  /** Quản lý trực tiếp; chuỗi quản lý tính bằng cách đi lên theo field này. */
  managerId?: string | null;
}

export interface SelectionPolicy {
  minVoters: number;
  maxVoters: number;
}

export interface EligibleVoter {
  id: string;
  independent: boolean;
}

export interface VotingAssignment {
  voterCount: number;
  quorumRequired: number;
  voters: EligibleVoter[];
}

export type DrawInt = (min: number, maxExclusive: number) => number;

export type DomainResult<T, C extends string = string> =
  | { ok: true; value: T }
  | { ok: false; code: C; message: string };

export const quorumFor = (n: number): number => Math.ceil((2 * n) / 3);

export const MAX_COUNCIL_SIZE = 12;

/**
 * Loại người bị tố, chuỗi quản lý của họ và thành viên inactive.
 * accused phải có trong directory; chuỗi quản lý có vòng thì từ chối.
 */
export function computeEligible(
  roster: readonly CouncilMember[],
  accusedIds: readonly string[],
  directory: readonly DirectoryPerson[],
): DomainResult<{ eligible: EligibleVoter[]; excluded: string[] }, "UNKNOWN_PERSON" | "INVALID_DIRECTORY"> {
  const byId = new Map(directory.map((p) => [p.id, p]));
  const excluded = new Set<string>();
  for (const accused of accusedIds) {
    if (!byId.has(accused)) return { ok: false, code: "UNKNOWN_PERSON", message: `không có ${accused} trong directory` };
    const seen = new Set<string>();
    let current: string | null | undefined = accused;
    while (current) {
      if (seen.has(current)) return { ok: false, code: "INVALID_DIRECTORY", message: "chuỗi quản lý có vòng" };
      seen.add(current);
      excluded.add(current);
      current = byId.get(current)?.managerId ?? null;
    }
  }
  const eligible = roster
    .filter((m) => m.active && !excluded.has(m.subject))
    .map((m) => ({ id: m.subject, independent: m.independent }));
  return { ok: true, value: { eligible, excluded: [...excluded].sort() } };
}

export function selectVotingAssignment(
  eligible: readonly EligibleVoter[],
  policy: SelectionPolicy = { minVoters: 3, maxVoters: 5 },
  drawInt: DrawInt = randomInt,
): DomainResult<VotingAssignment, "INVALID_VOTER_POLICY" | "COUNCIL_SIZE_LIMIT_EXCEEDED" | "INVALID_DIRECTORY" | "INSUFFICIENT_ELIGIBLE_JURORS"> {
  if (!Number.isInteger(policy.minVoters) || !Number.isInteger(policy.maxVoters)
      || policy.minVoters < 3 || policy.maxVoters < policy.minVoters || policy.maxVoters > 5) {
    return { ok: false, code: "INVALID_VOTER_POLICY", message: "policy phải 3 <= min <= max <= 5" };
  }
  if (eligible.length > MAX_COUNCIL_SIZE) {
    return { ok: false, code: "COUNCIL_SIZE_LIMIT_EXCEEDED", message: `tối đa ${MAX_COUNCIL_SIZE} người` };
  }
  if (new Set(eligible.map((v) => v.id)).size !== eligible.length) {
    return { ok: false, code: "INVALID_DIRECTORY", message: "voter trùng" };
  }
  const maxN = Math.min(policy.maxVoters, eligible.length);
  if (maxN < policy.minVoters || !eligible.some((v) => v.independent)) {
    return { ok: false, code: "INSUFFICIENT_ELIGIBLE_JURORS", message: "không đủ người hợp lệ hoặc không có independent" };
  }
  const voterCount = drawInt(policy.minVoters, maxN + 1);
  const candidates: EligibleVoter[][] = [];
  const collect = (from: number, selected: EligibleVoter[]): void => {
    if (selected.length === voterCount) {
      if (selected.some((v) => v.independent)) candidates.push([...selected]);
      return;
    }
    const remaining = voterCount - selected.length;
    for (let i = from; i <= eligible.length - remaining; i++) {
      selected.push(eligible[i]);
      collect(i + 1, selected);
      selected.pop();
    }
  };
  collect(0, []);
  if (candidates.length === 0) {
    return { ok: false, code: "INSUFFICIENT_ELIGIBLE_JURORS", message: "không có tập nào chứa independent" };
  }
  return {
    ok: true,
    value: {
      voterCount,
      quorumRequired: quorumFor(voterCount),
      voters: candidates[drawInt(0, candidates.length)].map((v) => ({ id: v.id, independent: v.independent })),
    },
  };
}

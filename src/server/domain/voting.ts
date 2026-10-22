// Bộ đếm phiếu dùng chung cho mọi operation (REVEAL_REPORT_IDENTITY, CHANGE_COUNCIL).
// Thuần: nhận snapshot assignment + phiếu đã lưu, trả trạng thái suy ra. Không I/O.
import type { EligibleVoter } from "./council";

export type VotingState = "COLLECTING" | "READY" | "DENIED" | "EXPIRED" | "STALE";
export type VoteDecision = "APPROVE" | "DENY";

export interface StoredVote {
  voterSubject: string;
  decision: VoteDecision;
}

export interface VotingSnapshot {
  state: VotingState;
  voters: readonly EligibleVoter[];
  quorumRequired: number;
  expiresAt: Date;
  votes: readonly StoredVote[];
}

export interface Tally {
  state: VotingState;
  validApprovals: number;
  independentApproved: boolean;
  voted: Set<string>;
}

/** Trạng thái không bao giờ quay lại COLLECTING. READY cũng đóng việc nhận phiếu. */
export const isTerminal = (s: VotingState): boolean => s === "DENIED" || s === "EXPIRED" || s === "STALE";

export function tally(snapshot: VotingSnapshot, now: Date): Tally {
  const assigned = new Map(snapshot.voters.map((v) => [v.id, v]));
  const counted = new Map<string, VoteDecision>();
  // Mỗi voter một phiếu (phiếu đầu tiên); phiếu của người ngoài assignment bị bỏ qua.
  for (const vote of snapshot.votes) {
    if (assigned.has(vote.voterSubject) && !counted.has(vote.voterSubject)) counted.set(vote.voterSubject, vote.decision);
  }
  const approvers = [...counted].filter(([, d]) => d === "APPROVE").map(([s]) => s);
  const validApprovals = approvers.length;
  const independentApproved = approvers.some((s) => assigned.get(s)?.independent);
  const denied = [...counted.values()].includes("DENY");

  let state: VotingState;
  if (isTerminal(snapshot.state)) state = snapshot.state;
  else if (denied) state = "DENIED";
  else if (snapshot.state === "READY" || (validApprovals >= snapshot.quorumRequired && independentApproved)) state = "READY";
  else if (now.getTime() >= snapshot.expiresAt.getTime()) state = "EXPIRED";
  else state = "COLLECTING";

  return { state, validApprovals, independentApproved, voted: new Set(counted.keys()) };
}

export type CastCheck =
  | { ok: true }
  | { ok: false; code: "FORBIDDEN" | "VERSION_CONFLICT" | "APPROVAL_EXPIRED"; message: string };

/** Kiểm tra trước khi ghi phiếu. Ghi xong gọi lại tally() để có trạng thái mới. */
export function canCast(snapshot: VotingSnapshot, voterSubject: string, now: Date): CastCheck {
  if (!snapshot.voters.some((v) => v.id === voterSubject)) {
    return { ok: false, code: "FORBIDDEN", message: "không nằm trong danh sách được bốc" };
  }
  const current = tally(snapshot, now);
  if (current.state === "EXPIRED") return { ok: false, code: "APPROVAL_EXPIRED", message: "yêu cầu đã hết hạn" };
  if (current.state !== "COLLECTING") {
    return { ok: false, code: "VERSION_CONFLICT", message: `yêu cầu đã ở trạng thái ${current.state}` };
  }
  if (current.voted.has(voterSubject)) return { ok: false, code: "FORBIDDEN", message: "đã bỏ phiếu" };
  return { ok: true };
}

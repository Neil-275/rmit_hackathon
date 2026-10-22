// Idea: UNDER_REVIEW -> ENDORSED -> APPROVED; rejection is terminal from either pending state.
// Report: AWAITING_ELIGIBLE_JURY | INVESTIGATING -> RESOLVED.

export type IdeaStatus = "UNDER_REVIEW" | "ENDORSED" | "APPROVED" | "REJECTED";
export type ReportStatus = "AWAITING_ELIGIBLE_JURY" | "INVESTIGATING" | "RESOLVED";
export type IdeaDecision = "APPROVE" | "REJECT";

export type Transition<S> = { ok: true; status: S } | { ok: false; code: "VERSION_CONFLICT"; message: string };

export function decideIdeaTransition(current: IdeaStatus, decision: IdeaDecision): Transition<IdeaStatus> {
  if ((current !== "UNDER_REVIEW" && current !== "ENDORSED") || (decision === "APPROVE" && current !== "ENDORSED")) {
    return { ok: false, code: "VERSION_CONFLICT", message: `ý tưởng đã ${current}, không quyết định lại` };
  }
  return { ok: true, status: decision === "APPROVE" ? "APPROVED" : "REJECTED" };
}

/** Trạng thái phản ánh lúc nộp, theo kết quả bốc hội đồng. */
export const initialReportStatus = (hasAssignment: boolean): ReportStatus =>
  hasAssignment ? "INVESTIGATING" : "AWAITING_ELIGIBLE_JURY";

export function resolveReportTransition(current: ReportStatus): Transition<ReportStatus> {
  if (current !== "INVESTIGATING") {
    return { ok: false, code: "VERSION_CONFLICT", message: `không thể đóng phản ánh ở ${current}` };
  }
  return { ok: true, status: "RESOLVED" };
}

/** Envelope ý tưởng chỉ mở khi APPROVED và tác giả đã đồng ý công khai lúc nộp. */
export const ideaIdentityOpenable = (status: IdeaStatus, publishCreditOnApproval: boolean): boolean =>
  status === "APPROVED" && publishCreditOnApproval;

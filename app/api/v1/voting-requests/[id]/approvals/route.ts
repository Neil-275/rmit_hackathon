import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/src/server/db';
import { getAuthUser } from '@/src/server/auth';
import { randomUUID } from 'crypto';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getAuthUser(request);

    if (!user) {
      return NextResponse.json({
        ok: false,
        error: { code: "UNAUTHENTICATED", message: "Bạn cần đăng nhập.", enforcement: "APP", retryable: false },
        contractVersion: "v1"
      }, { status: 401 });
    }

    const body = await request.json();
    const { decision, reason } = body; // 'APPROVE' or 'DENY'

    if (decision !== 'APPROVE' && decision !== 'DENY') {
      return NextResponse.json({
        ok: false,
        error: { code: "INVALID_REQUEST", message: "Quyết định bỏ phiếu phải là APPROVE hoặc DENY.", enforcement: "APP", retryable: false },
        contractVersion: "v1"
      }, { status: 400 });
    }

    const db = getDb();
    const vr = db.prepare('SELECT * FROM voting_requests WHERE id = ?').get(id) as any;
    if (!vr) {
      return NextResponse.json({
        ok: false,
        error: { code: "NOT_FOUND", message: "Không tìm thấy yêu cầu bỏ phiếu.", enforcement: "APP", retryable: false },
        contractVersion: "v1"
      }, { status: 404 });
    }

    if (vr.state !== 'COLLECTING') {
      return NextResponse.json({
        ok: false,
        error: { code: "VERSION_CONFLICT", message: `Lượt bỏ phiếu không còn ở trạng thái mở (hiện tại: ${vr.state}).`, enforcement: "APP", retryable: false },
        contractVersion: "v1"
      }, { status: 409 });
    }

    const voters = JSON.parse(vr.voters_json) as Array<{
      subject: string;
      displayName: string;
      independent: boolean;
      hasVoted: boolean;
      decision?: string;
      reason?: string;
    }>;

    const voterIndex = voters.findIndex(v => v.subject === user.subject);
    if (voterIndex === -1) {
      return NextResponse.json({
        ok: false,
        error: { code: "FORBIDDEN", message: "Bạn không thuộc danh sách hội đồng được chỉ định cho lượt bỏ phiếu này.", enforcement: "APP", retryable: false },
        contractVersion: "v1"
      }, { status: 403 });
    }

    if (voters[voterIndex].hasVoted) {
      return NextResponse.json({
        ok: false,
        error: { code: "INVALID_REQUEST", message: "Bạn đã bỏ phiếu trong lượt này rồi.", enforcement: "APP", retryable: false },
        contractVersion: "v1"
      }, { status: 400 });
    }

    voters[voterIndex].hasVoted = true;
    voters[voterIndex].decision = decision;
    voters[voterIndex].reason = reason;

    let newState = vr.state;
    let newValidApprovals = vr.valid_approvals;
    let newIndependentApproved = vr.independent_approved;

    if (decision === 'DENY') {
      newState = 'DENIED';
    } else {
      newValidApprovals += 1;
      if (voters[voterIndex].independent) {
        newIndependentApproved = 1;
      }

      if (newValidApprovals >= vr.quorum_required && newIndependentApproved === 1) {
        newState = 'READY';
      }
    }

    const newVersion = vr.version + 1;
    const now = new Date().toISOString();

    db.prepare(`
      UPDATE voting_requests 
      SET state = ?, voters_json = ?, valid_approvals = ?, independent_approved = ?, version = ?
      WHERE id = ?
    `).run(
      newState,
      JSON.stringify(voters),
      newValidApprovals,
      newIndependentApproved,
      newVersion,
      id
    );

    // Audit log
    db.prepare(`
      INSERT INTO audit (id, at, action, outcome, source, resource_kind, resource_id, actor_display_name, request_id)
      VALUES (?, ?, 'VOTE_CAST', 'OK', 'SIMULATED', ?, ?, ?, ?)
    `).run(
      randomUUID(),
      now,
      vr.resource_kind,
      vr.resource_id,
      user.displayName,
      "req-" + randomUUID().slice(0, 8)
    );

    return NextResponse.json({
      ok: true,
      data: {
        id,
        state: newState,
        version: newVersion,
        validApprovals: newValidApprovals,
        independentApproved: newIndependentApproved === 1,
        quorumRequired: vr.quorum_required
      },
      contractVersion: "v1"
    });
  } catch (err: any) {
    return NextResponse.json({
      ok: false,
      error: { code: "INTERNAL_ERROR", message: err.message, enforcement: "APP", retryable: false },
      contractVersion: "v1"
    }, { status: 500 });
  }
}

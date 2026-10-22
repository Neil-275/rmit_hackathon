import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/src/server/db';
import { getAuthUser } from '@/src/server/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getAuthUser(request);
    const db = getDb();

    const vr = db.prepare('SELECT * FROM voting_requests WHERE id = ?').get(id) as any;
    if (!vr) {
      return NextResponse.json({
        ok: false,
        error: { code: "NOT_FOUND", message: "Không tìm thấy yêu cầu bỏ phiếu.", enforcement: "APP", retryable: false },
        contractVersion: "v1"
      }, { status: 404 });
    }

    const voters = JSON.parse(vr.voters_json);
    const isVoter = user ? voters.some((v: any) => v.subject === user.subject) : false;

    return NextResponse.json({
      ok: true,
      data: {
        id: vr.id,
        operation: vr.operation,
        resourceKind: vr.resource_kind,
        resourceId: vr.resource_id,
        state: vr.state,
        version: vr.version,
        purpose: vr.purpose,
        voterCount: vr.voter_count,
        quorumRequired: vr.quorum_required,
        voters,
        validApprovals: vr.valid_approvals,
        independentApproved: vr.independent_approved === 1,
        councilVersion: vr.council_version,
        contextHash: vr.context_hash,
        createdAt: vr.created_at,
        expiresAt: vr.expires_at,
        capabilities: isVoter && vr.state === 'COLLECTING' ? ['vote'] : []
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

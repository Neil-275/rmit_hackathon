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

    if (!user || !user.roles.includes('director')) {
      return NextResponse.json({
        ok: false,
        error: { code: "FORBIDDEN", message: "Chỉ Giám đốc (Director) mới có quyền phê duyệt sáng kiến.", enforcement: "APP", retryable: false },
        contractVersion: "v1"
      }, { status: 403 });
    }

    const body = await request.json();
    const { decision, reason } = body; // APPROVE or REJECT

    if (decision !== 'APPROVE' && decision !== 'REJECT') {
      return NextResponse.json({
        ok: false,
        error: { code: "INVALID_REQUEST", message: "Quyết định phải là APPROVE hoặc REJECT.", enforcement: "APP", retryable: false },
        contractVersion: "v1"
      }, { status: 400 });
    }

    const db = getDb();
    const idea = db.prepare('SELECT * FROM ideas WHERE id = ?').get(id) as any;
    if (!idea) {
      return NextResponse.json({
        ok: false,
        error: { code: "NOT_FOUND", message: "Không tìm thấy sáng kiến.", enforcement: "APP", retryable: false },
        contractVersion: "v1"
      }, { status: 404 });
    }

    const newStatus = decision === 'APPROVE' ? 'APPROVED' : 'REJECTED';
    const newVersion = idea.version + 1;
    const now = new Date().toISOString();

    let publicCredit = null;
    if (newStatus === 'APPROVED' && idea.publish_credit_on_approval === 1) {
      publicCredit = { displayName: idea.author_display_name, verified: true };
    }

    db.prepare(`
      UPDATE ideas 
      SET status = ?, decision_reason = ?, public_credit_json = ?, version = ?
      WHERE id = ?
    `).run(
      newStatus,
      reason || null,
      publicCredit ? JSON.stringify(publicCredit) : null,
      newVersion,
      id
    );

    db.prepare(`
      INSERT INTO audit (id, at, action, outcome, source, resource_kind, resource_id, actor_display_name, request_id)
      VALUES (?, ?, ?, 'OK', 'SIMULATED', 'IDEA', ?, ?, ?)
    `).run(
      randomUUID(),
      now,
      newStatus === 'APPROVED' ? 'IDEA_APPROVED' : 'IDEA_REJECTED',
      id,
      user.displayName,
      "req-" + randomUUID().slice(0, 8)
    );

    return NextResponse.json({
      ok: true,
      data: {
        id,
        status: newStatus,
        version: newVersion,
        decisionReason: reason,
        publicCredit
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

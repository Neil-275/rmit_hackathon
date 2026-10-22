import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/src/server/db';
import { getAuthUser } from '@/src/server/auth';
import { randomUUID } from 'crypto';

export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const user = await getAuthUser(request);

    const rows = db.prepare('SELECT * FROM ideas ORDER BY created_at DESC').all() as any[];

    const ideas = rows.map(r => {
      let publicCredit = null;
      if (r.status === 'APPROVED' && r.publish_credit_on_approval === 1) {
        publicCredit = r.public_credit_json ? JSON.parse(r.public_credit_json) : { displayName: r.author_display_name, verified: false };
      }

      const capabilities: string[] = [];
      if (user?.roles.includes('manager') && r.status === 'UNDER_REVIEW') {
        capabilities.push('endorse');
      }
      if (user?.roles.includes('director') && r.status === 'UNDER_REVIEW') {
        capabilities.push('decide');
      }

      return {
        id: r.id,
        title: r.title,
        description: r.description,
        category: r.category,
        status: r.status,
        version: r.version,
        endorsementCount: r.endorsement_count,
        publishCreditOnApproval: r.publish_credit_on_approval === 1,
        publicCredit,
        decisionReason: r.decision_reason,
        createdAt: r.created_at,
        capabilities
      };
    });

    return NextResponse.json({
      ok: true,
      data: { items: ideas },
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

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({
        ok: false,
        error: { code: "UNAUTHENTICATED", message: "Bạn cần đăng nhập.", enforcement: "APP", retryable: false },
        contractVersion: "v1"
      }, { status: 401 });
    }

    const body = await request.json();
    const { title, description, category, publishCreditOnApproval } = body;

    if (!title || !description || !category) {
      return NextResponse.json({
        ok: false,
        error: { code: "INVALID_REQUEST", message: "Tiêu đề, mô tả và phân loại là bắt buộc.", enforcement: "APP", retryable: false },
        contractVersion: "v1"
      }, { status: 400 });
    }

    const id = randomUUID();
    const now = new Date().toISOString();
    const db = getDb();

    db.prepare(`
      INSERT INTO ideas (id, title, description, category, status, version, endorsement_count, publish_credit_on_approval, public_credit_json, decision_reason, author_subject, author_display_name, created_at)
      VALUES (?, ?, ?, ?, 'UNDER_REVIEW', 1, 0, ?, null, null, ?, ?, ?)
    `).run(
      id,
      title,
      description,
      category,
      publishCreditOnApproval ? 1 : 0,
      user.subject,
      user.displayName,
      now
    );

    // Audit log
    db.prepare(`
      INSERT INTO audit (id, at, action, outcome, source, resource_kind, resource_id, actor_display_name, request_id)
      VALUES (?, ?, 'IDEA_SUBMITTED', 'OK', 'SIMULATED', 'IDEA', ?, ?, ?)
    `).run(
      randomUUID(),
      now,
      id,
      user.displayName,
      "req-" + id.slice(0, 8)
    );

    return NextResponse.json({
      ok: true,
      data: {
        id,
        title,
        description,
        category,
        status: "UNDER_REVIEW",
        version: 1,
        endorsementCount: 0,
        publishCreditOnApproval: !!publishCreditOnApproval,
        publicCredit: null,
        createdAt: now,
        capabilities: []
      },
      contractVersion: "v1"
    }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({
      ok: false,
      error: { code: "INTERNAL_ERROR", message: err.message, enforcement: "APP", retryable: false },
      contractVersion: "v1"
    }, { status: 500 });
  }
}

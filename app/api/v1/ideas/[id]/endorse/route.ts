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

    if (!user || !user.roles.includes('manager')) {
      return NextResponse.json({
        ok: false,
        error: { code: "FORBIDDEN", message: "Chỉ Quản lý (Manager) mới có quyền đề cử sáng kiến.", enforcement: "APP", retryable: false },
        contractVersion: "v1"
      }, { status: 403 });
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

    const newCount = idea.endorsement_count + 1;
    const newVersion = idea.version + 1;
    const now = new Date().toISOString();

    db.prepare('UPDATE ideas SET endorsement_count = ?, version = ? WHERE id = ?').run(newCount, newVersion, id);

    db.prepare(`
      INSERT INTO audit (id, at, action, outcome, source, resource_kind, resource_id, actor_display_name, request_id)
      VALUES (?, ?, 'IDEA_ENDORSED', 'OK', 'SIMULATED', 'IDEA', ?, ?, ?)
    `).run(
      randomUUID(),
      now,
      id,
      user.displayName,
      "req-" + randomUUID().slice(0, 8)
    );

    return NextResponse.json({
      ok: true,
      data: {
        id,
        endorsementCount: newCount,
        version: newVersion
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

import { NextResponse } from 'next/server';
import { getDb } from '@/src/server/db';

export async function GET() {
  try {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM audit ORDER BY at DESC LIMIT 50').all() as any[];

    const audit = rows.map(r => ({
      id: r.id,
      at: r.at,
      action: r.action,
      outcome: r.outcome,
      source: r.source,
      resourceKind: r.resource_kind,
      resourceId: r.resource_id,
      actorDisplayName: r.actor_display_name,
      requestId: r.request_id
    }));

    return NextResponse.json({
      ok: true,
      data: { items: audit },
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

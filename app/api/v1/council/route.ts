import { NextResponse } from 'next/server';
import { getDb } from '@/src/server/db';

export async function GET() {
  try {
    const db = getDb();
    const row = db.prepare('SELECT * FROM council ORDER BY version DESC LIMIT 1').get() as any;

    if (!row) {
      return NextResponse.json({
        ok: false,
        error: { code: "NOT_FOUND", message: "Hội đồng chưa được khởi tạo.", enforcement: "APP", retryable: false },
        contractVersion: "v1"
      }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      data: {
        version: row.version,
        rosterHash: row.roster_hash,
        members: JSON.parse(row.members_json),
        selectionPolicy: JSON.parse(row.selection_policy_json)
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

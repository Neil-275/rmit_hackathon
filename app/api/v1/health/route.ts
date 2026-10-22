import { NextResponse } from 'next/server';
import { getDb } from '@/src/server/db';

export async function GET() {
  try {
    const db = getDb();
    const council = db.prepare('SELECT version, roster_hash FROM council LIMIT 1').get() as any;

    return NextResponse.json({
      ok: true,
      data: {
        status: "ok",
        database: "sqlite",
        councilVersion: council?.version || 3,
        rosterHash: council?.roster_hash || "",
        tidecloak: "http://localhost:8081",
        mode: "DEV_DATABASE",
        timestamp: new Date().toISOString()
      },
      contractVersion: "v1"
    });
  } catch (err: any) {
    return NextResponse.json({
      ok: false,
      error: { code: "INTERNAL_ERROR", message: err.message, enforcement: "APP", retryable: true },
      contractVersion: "v1"
    }, { status: 500 });
  }
}

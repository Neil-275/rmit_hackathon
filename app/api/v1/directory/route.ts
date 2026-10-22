import { NextResponse } from 'next/server';
import { getAllUsers } from '@/src/server/db';

export async function GET() {
  const users = getAllUsers();
  const people = users.map(u => ({
    id: u.subject,
    displayName: u.displayName
  }));

  return NextResponse.json({
    ok: true,
    data: { people },
    contractVersion: "v1"
  });
}

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/src/server/auth';
import { getUserBySubject, upsertUser } from '@/src/server/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({
      ok: false,
      error: { code: "UNAUTHENTICATED", message: "Bạn cần đăng nhập.", enforcement: "APP", retryable: false },
      contractVersion: "v1"
    }, { status: 401 });
  }

  const dbUser = getUserBySubject(user.subject);

  return NextResponse.json({
    ok: true,
    data: {
      user: dbUser || user
    },
    contractVersion: "v1"
  });
}

export async function PUT(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({
      ok: false,
      error: { code: "UNAUTHENTICATED", message: "Bạn cần đăng nhập.", enforcement: "APP", retryable: false },
      contractVersion: "v1"
    }, { status: 401 });
  }

  try {
    const body = await request.json();
    const updated = upsertUser({
      subject: user.subject,
      username: (user as any).username || user.displayName.toLowerCase().replace(/\s+/g, '_'),
      displayName: body.displayName || user.displayName,
      roles: user.roles,
      email: body.email || user.email || undefined,
      department: body.department || user.department || undefined
    });

    return NextResponse.json({
      ok: true,
      data: { user: updated },
      contractVersion: "v1"
    });
  } catch (err: any) {
    return NextResponse.json({
      ok: false,
      error: { code: "INVALID_REQUEST", message: err.message, enforcement: "APP", retryable: false },
      contractVersion: "v1"
    }, { status: 400 });
  }
}

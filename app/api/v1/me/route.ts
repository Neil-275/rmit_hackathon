import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/src/server/auth';

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

  const capabilities = ["logout", "submitIdea", "submitReport"];
  if (user.roles.includes("manager")) capabilities.push("endorseIdea");
  if (user.roles.includes("director")) capabilities.push("decideIdea");
  if (user.roles.includes("juror")) capabilities.push("vote");

  return NextResponse.json({
    ok: true,
    data: {
      authenticated: true,
      subject: user.subject,
      displayName: user.displayName,
      roles: user.roles,
      email: user.email,
      department: user.department,
      capabilities
    },
    contractVersion: "v1"
  });
}

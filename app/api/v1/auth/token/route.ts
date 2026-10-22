import { NextRequest, NextResponse } from 'next/server';
import { authenticateSimulatedUser } from '@/src/server/tidecloak-simulator';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password } = body;

    if (!username) {
      return NextResponse.json({
        ok: false,
        error: { code: "INVALID_REQUEST", message: "Username is required", enforcement: "APP", retryable: false },
        contractVersion: "v1"
      }, { status: 400 });
    }

    const authResult = authenticateSimulatedUser(username);
    if (!authResult) {
      return NextResponse.json({
        ok: false,
        error: { code: "UNAUTHENTICATED", message: "User not found or credentials invalid", enforcement: "FABRIC", retryable: false },
        contractVersion: "v1"
      }, { status: 401 });
    }

    return NextResponse.json({
      ok: true,
      data: {
        access_token: authResult.token,
        token_type: "Bearer",
        expires_in: 3600,
        user: {
          id: authResult.user.id,
          subject: authResult.user.subject,
          username: authResult.user.username,
          displayName: authResult.user.displayName,
          email: authResult.user.email,
          roles: authResult.user.roles,
          department: authResult.user.department
        }
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

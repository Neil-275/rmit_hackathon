import { NextRequest, NextResponse } from 'next/server'
import { verifyTideCloakToken } from '@tidecloak/nextjs/server'
import { verifySimulatedToken } from '@/src/server/tidecloak-simulator'
import tcConfig from '../../../tidecloak.json'

const ALLOWED_ROLE = 'offline_access'

export async function GET(request: NextRequest): Promise<NextResponse> {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json(
      { error: 'Unauthorized: Missing or invalid token' },
      { status: 401 }
    )
  }

  const token = authHeader.split(' ')[1]

  // 1. Try simulated TideCloak token verification
  const simResult = verifySimulatedToken(token, [ALLOWED_ROLE])
  if (simResult.ok && simResult.payload) {
    return NextResponse.json(
      {
        ok: true,
        subject: simResult.payload.sub,
        username: simResult.payload.preferred_username,
        roles: simResult.payload.realm_access?.roles,
        source: 'SIMULATED'
      },
      { status: 200 }
    )
  }

  // 2. Try real TideCloak token verification
  try {
    const activeConfig = {
      ...tcConfig,
      tokenSignatureAlgorithms: tcConfig.tokenSignatureAlgorithms || ['RS256', 'ES256', 'EdDSA']
    }
    const user = await verifyTideCloakToken(activeConfig, token, [ALLOWED_ROLE]) as Record<string, any>

    if (user) {
      return NextResponse.json(
        {
          ok: true,
          subject: user.sub,
          username: user.preferred_username,
          roles: user.realm_access?.roles,
          source: 'FABRIC'
        },
        { status: 200 }
      )
    }
  } catch (err) {
    // Real TideCloak verification threw
  }

  return NextResponse.json(
    { error: 'Forbidden: Invalid token or insufficient role' },
    { status: 403 }
  )
}

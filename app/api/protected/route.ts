import { NextRequest, NextResponse } from 'next/server'
import { verifyTideCloakToken } from '@tidecloak/nextjs/server'
import tcConfig from '../../../tidecloak.json'

const ALLOWED_ROLE = 'offline_access'

// Accepts plain Bearer tokens only. If you turn on useDPoP, call this with
// secureFetch and extend it to accept the DPoP scheme and validate the proof server-side.
export async function GET(request: NextRequest): Promise<NextResponse> {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json(
      { error: 'Unauthorized: Missing or invalid token' },
      { status: 401 }
    )
  }

  const token = authHeader.split(' ')[1]

  try {
    const activeConfig = {
      ...tcConfig,
      tokenSignatureAlgorithms: tcConfig.tokenSignatureAlgorithms || ['RS256', 'ES256', 'EdDSA']
    }
    const user = await verifyTideCloakToken(activeConfig, token, [ALLOWED_ROLE]) as Record<string, any>

    if (!user) {
      return NextResponse.json(
        { error: 'Forbidden: Invalid token or insufficient role', configRealm: tcConfig.realm, algorithms: tcConfig.tokenSignatureAlgorithms },
        { status: 403 }
      )
    }
    return NextResponse.json(
      { ok: true, subject: user.sub, username: user.preferred_username, roles: user.realm_access?.roles },
      { status: 200 }
    )
  } catch (err) {
    console.error('Token verification failed:', err)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}

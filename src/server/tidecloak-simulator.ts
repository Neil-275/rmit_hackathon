import crypto from 'crypto';
import { getUserBySubject, getAllUsers, DbUser } from './db';

const SIMULATED_SECRET = 'tidecloak-hackathon-unlocked-2026-secret-seed';

export interface SimulatedTokenPayload {
  iss: string;
  sub: string;
  preferred_username: string;
  name: string;
  azp: string;
  realm_access: {
    roles: string[];
  };
  resource_access: {
    [clientId: string]: {
      roles: string[];
    };
  };
  email?: string;
  department?: string;
  simulated: boolean;
  iat: number;
  exp: number;
}

function base64UrlEncode(data: string | Buffer): string {
  return Buffer.from(data).toString('base64url');
}

function base64UrlDecode(data: string): string {
  return Buffer.from(data, 'base64url').toString('utf-8');
}

export function generateSimulatedToken(user: {
  subject: string;
  username: string;
  displayName: string;
  roles: string[];
  email?: string | null;
  department?: string | null;
}): string {
  const header = {
    alg: 'HS256',
    typ: 'JWT',
    kid: 'simulated-tidecloak-key-1'
  };

  const now = Math.floor(Date.now() / 1000);
  const payload: SimulatedTokenPayload = {
    iss: 'http://localhost:8081/realms/myrealm',
    sub: user.subject,
    preferred_username: user.username,
    name: user.displayName,
    azp: 'myclient',
    realm_access: {
      roles: user.roles
    },
    resource_access: {
      myclient: {
        roles: user.roles
      }
    },
    email: user.email || `${user.username}@tidecloak.internal`,
    department: user.department || 'General',
    simulated: true,
    iat: now,
    exp: now + 3600 // 1 hour
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signatureInput = `${encodedHeader}.${encodedPayload}`;

  const signature = crypto
    .createHmac('sha256', SIMULATED_SECRET)
    .update(signatureInput)
    .digest('base64url');

  return `${signatureInput}.${signature}`;
}

export function verifySimulatedToken(
  token: string,
  allowedRoles?: string[]
): { ok: boolean; payload?: SimulatedTokenPayload; error?: string } {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return { ok: false, error: 'Malformed token structure' };
    }

    const [encodedHeader, encodedPayload, signature] = parts;
    const signatureInput = `${encodedHeader}.${encodedPayload}`;

    const expectedSignature = crypto
      .createHmac('sha256', SIMULATED_SECRET)
      .update(signatureInput)
      .digest('base64url');

    if (signature !== expectedSignature) {
      return { ok: false, error: 'Invalid token signature' };
    }

    const payload: SimulatedTokenPayload = JSON.parse(base64UrlDecode(encodedPayload));

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return { ok: false, error: 'Token expired' };
    }

    // Role check if required
    if (allowedRoles && allowedRoles.length > 0) {
      const userRoles = payload.realm_access?.roles || [];
      const hasRole = allowedRoles.some(r => userRoles.includes(r));
      if (!hasRole) {
        return { ok: false, error: `Missing required role. Requires one of: ${allowedRoles.join(', ')}` };
      }
    }

    return { ok: true, payload };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}

export function authenticateSimulatedUser(usernameOrSubject: string): {
  user: DbUser;
  token: string;
} | null {
  const users = getAllUsers();
  const target = usernameOrSubject.toLowerCase();

  const user = users.find(
    u => u.username.toLowerCase() === target ||
         u.subject.toLowerCase() === target ||
         u.subject.toLowerCase() === `subject-${target}`
  );

  if (!user) return null;

  const token = generateSimulatedToken(user);
  return { user, token };
}

import { NextRequest } from 'next/server';
import { getUserBySubject, upsertUser } from './db';
import { verifyTideCloakToken } from '@tidecloak/nextjs/server';
import { verifySimulatedToken } from './tidecloak-simulator';
import tcConfig from '../../tidecloak.json';

export interface Persona {
  subject: string;
  displayName: string;
  roles: string[];
  email?: string | null;
  department?: string | null;
}

export const PERSONAS: Record<string, Persona> = {
  an: { subject: "subject-an", displayName: "An", roles: ["employee"], department: "Engineering", email: "an@voicevault.internal" },
  chi: { subject: "subject-chi", displayName: "Chi", roles: ["employee", "director"], department: "Executive", email: "chi@voicevault.internal" },
  minh: { subject: "subject-minh", displayName: "Minh", roles: ["employee", "manager"], department: "Operations", email: "minh@voicevault.internal" },
  binh: { subject: "subject-binh", displayName: "Bình", roles: ["employee", "juror"], department: "Legal", email: "binh@voicevault.internal" },
  dung: { subject: "subject-dung", displayName: "Dũng", roles: ["employee", "juror"], department: "Finance", email: "dung@voicevault.internal" },
  hoa: { subject: "subject-hoa", displayName: "Hoa", roles: ["employee", "juror"], department: "Internal Audit", email: "hoa@voicevault.internal" },
  khanh: { subject: "subject-khanh", displayName: "Khánh", roles: ["employee", "juror"], department: "People & Culture", email: "khanh@voicevault.internal" },
  lan: { subject: "subject-lan", displayName: "Lan", roles: ["employee", "juror"], department: "External Independent", email: "lan@voicevault.internal" },
};

export async function getAuthUser(request: NextRequest): Promise<Persona | null> {
  const authHeader = request.headers.get('authorization');

  // 1. Check Bearer token (Simulated TideCloak or Real TideCloak)
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];

    // 1a. Try simulated TideCloak token verification first
    const simResult = verifySimulatedToken(token);
    if (simResult.ok && simResult.payload) {
      const p = simResult.payload;
      return {
        subject: p.sub,
        displayName: p.name || p.preferred_username,
        roles: p.realm_access?.roles || ["employee"],
        email: p.email,
        department: p.department
      };
    }

    // 1b. Try real TideCloak token verification if available
    try {
      const activeConfig = {
        ...tcConfig,
        tokenSignatureAlgorithms: (tcConfig as any).tokenSignatureAlgorithms || ['RS256', 'ES256', 'EdDSA']
      };
      const payload = await verifyTideCloakToken(activeConfig, token) as Record<string, any>;
      if (payload) {
        const sub = payload.sub || payload.preferred_username;
        const username = payload.preferred_username || payload.name || "TideUser";
        const displayName = payload.name || payload.preferred_username || "TideUser";
        const realmRoles = payload.realm_access?.roles || [];
        const roles = realmRoles.length > 0 ? realmRoles : ["employee"];

        // Connect & persist TideCloak user to SQLite database
        const dbUser = upsertUser({
          subject: sub,
          username,
          displayName,
          roles,
          email: payload.email || `${username}@tidecloak.internal`,
          department: "Engineering"
        });

        return {
          subject: dbUser.subject,
          displayName: dbUser.displayName,
          roles: dbUser.roles,
          email: dbUser.email,
          department: dbUser.department
        };
      }
    } catch (err) {
      // Real TideCloak server offline or invalid signature
    }
  }

  // 2. Dev mode simulation fallback connected to database
  const isDevAuth = process.env.VOICEVAULT_DEV_AUTH !== '0';
  if (isDevAuth) {
    const personaHeader = request.headers.get('x-dev-persona')?.toLowerCase();
    const urlPersona = request.nextUrl.searchParams.get('persona')?.toLowerCase();
    const target = personaHeader || urlPersona;

    if (target) {
      // Direct key match in DB
      const dbUser = getUserBySubject(target) || 
                     getUserBySubject(`subject-${target}`) ||
                     getUserBySubject(target.replace('persona-', 'subject-'));
      if (dbUser) {
        return {
          subject: dbUser.subject,
          displayName: dbUser.displayName,
          roles: dbUser.roles,
          email: dbUser.email,
          department: dbUser.department
        };
      }

      // Memory fallback if DB query missed
      if (PERSONAS[target]) return PERSONAS[target];
      for (const [key, p] of Object.entries(PERSONAS)) {
        if (p.subject.toLowerCase() === target || target.includes(key)) {
          return p;
        }
      }
    }

    // Default connected dev user
    const defaultDbUser = getUserBySubject("subject-an");
    if (defaultDbUser) {
      return {
        subject: defaultDbUser.subject,
        displayName: defaultDbUser.displayName,
        roles: defaultDbUser.roles,
        email: defaultDbUser.email,
        department: defaultDbUser.department
      };
    }

    return PERSONAS.an;
  }

  return null;
}

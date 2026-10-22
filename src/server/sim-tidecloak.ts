// Simulated TideCloak: sign-in, realm roles and token verification for local development and demos.
// It mirrors the shape of a TideCloak access token and of verifyTideCloakToken(config, token) so the rest of the
// server (actor extraction, role checks, CoI, quorum) runs unchanged. It is NOT Tide: no threshold verification,
// no Fabric, no ORKs. Enabled only when VOICEVAULT_AUTH_MODE=simulated.
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { Roster } from "./roster";

export const SIM_CONFIG = Object.freeze({
  "auth-server-url": "https://sim-tidecloak.voicevault.test",
  realm: "voicevault-sim",
  resource: "voicevault-web",
});
const ISSUER = `${SIM_CONFIG["auth-server-url"]}/realms/${SIM_CONFIG.realm}`;
const TOKEN_LIFETIME_SECONDS = 15 * 60;
const CLOCK_SKEW_SECONDS = 60;

export const simulatedAuthEnabled = (): boolean => process.env.VOICEVAULT_AUTH_MODE === "simulated";

// One key per process unless VOICEVAULT_SIM_SECRET is set (>= 32 chars); a restart signs every session out.
function signingKey(): Buffer {
  const configured = process.env.VOICEVAULT_SIM_SECRET;
  if (configured && configured.length >= 32) return Buffer.from(configured, "utf8");
  const holder = globalThis as unknown as { __voicevaultSimKey?: Buffer };
  holder.__voicevaultSimKey ??= randomBytes(32);
  return holder.__voicevaultSimKey;
}

const b64url = (value: Buffer | string) => Buffer.from(value).toString("base64url");
const sign = (data: string) => createHmac("sha256", signingKey()).update(data).digest();

export function issueSimulatedToken(roster: Roster, subject: unknown, now = Math.floor(Date.now() / 1000)):
  { access_token: string; token_type: "Bearer"; expires_in: number } | null {
  const persona = roster.personas.find((p) => p.subject === subject);
  if (!persona) return null;
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT", kid: "sim-tidecloak" }));
  const payload = b64url(JSON.stringify({
    iss: ISSUER, azp: SIM_CONFIG.resource, aud: "account", sub: persona.subject,
    organizationId: roster.organizationId, name: persona.displayName,
    realm_access: { roles: [...persona.roles] }, iat: now, exp: now + TOKEN_LIFETIME_SECONDS,
  }));
  const signature = b64url(sign(`${header}.${payload}`));
  return { access_token: `${header}.${payload}.${signature}`, token_type: "Bearer", expires_in: TOKEN_LIFETIME_SECONDS };
}

// Same contract as verifyTideCloakToken: the verified payload, or false on any failure.
export async function verifySimulatedToken(config: object, token: string, now = Math.floor(Date.now() / 1000)): Promise<Record<string, unknown> | false> {
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [header, payload, signature] = parts;
  try {
    const expected = sign(`${header}.${payload}`), actual = Buffer.from(signature, "base64url");
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return false;
    if (JSON.parse(Buffer.from(header, "base64url").toString("utf8")).alg !== "HS256") return false;
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Record<string, unknown>;
    const cfg = config as Record<string, unknown>;
    if (claims.iss !== `${cfg["auth-server-url"]}/realms/${cfg.realm}` || claims.azp !== cfg.resource) return false;
    if (typeof claims.exp !== "number" || claims.exp <= now) return false;
    if (typeof claims.iat !== "number" || claims.iat > now + CLOCK_SKEW_SECONDS) return false;
    return claims;
  } catch {
    return false;
  }
}

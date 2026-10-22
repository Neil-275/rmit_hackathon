// Browser adapters for Simulated TideCloak. Same AuthAdapter/CryptoAdapter shape the real Tide adapters will
// implement. Claims are decoded only for display; the server verifies every token. NOT Tide security.
import type { AuthAdapter, AuthSession, CryptoAdapter } from "./browser-runtime";
import { createStubCrypto } from "./browser-runtime";

export const SIM_BASE = "/sim-tidecloak";
const TOKEN_KEY = "voicevault.simTideCloak.token";

interface SimClaims { sub: string; name?: string; organizationId?: string; exp: number; realm_access?: { roles?: string[] } }

function decode(token: string): SimClaims | null {
  try {
    const part = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const claims = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(part), (c) => c.charCodeAt(0)))) as SimClaims;
    return typeof claims.sub === "string" && typeof claims.exp === "number" ? claims : null;
  } catch {
    return null;
  }
}

// Asks the server whether simulated sign-in is enabled; any failure means "not simulated".
export async function simulatedTideCloakEnabled(fetchImpl: typeof fetch = fetch): Promise<boolean> {
  try { return (await fetchImpl(`${SIM_BASE}/personas`, { cache: "no-store" })).ok; } catch { return false; }
}

export function createSimTideCloakAuth(storage: Storage = sessionStorage): AuthAdapter {
  let token: string | null = null, claims: SimClaims | null = null;
  const valid = () => token !== null && claims !== null && claims.exp * 1000 > Date.now();
  const clear = () => { token = null; claims = null; storage.removeItem(TOKEN_KEY); };
  return {
    async init() {
      token = storage.getItem(TOKEN_KEY);
      claims = token ? decode(token) : null;
      if (!valid()) clear();
    },
    async getToken() { return valid() ? token : null; },
    session(): AuthSession {
      if (!valid() || !claims) return { authenticated: false };
      return { authenticated: true, subject: claims.sub, displayName: claims.name ?? claims.sub,
        organizationId: claims.organizationId, roles: [...(claims.realm_access?.roles ?? [])] };
    },
    // Like TideCloak's doLogin(): leave the app for the sign-in page, which returns here with a token.
    async login() {
      const back = `${location.pathname}${location.search}${location.hash}`;
      location.assign(`${SIM_BASE}/login.html?return=${encodeURIComponent(back)}`);
      await new Promise<never>(() => {});
    },
    async logout() { clear(); },
  };
}

// Envelope "encryption" is base64 JSON bound to the resource; it only exercises the flow.
export const createSimTideCloakCrypto = (): CryptoAdapter => createStubCrypto();

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fail, ok, type Actor, type ApiResult } from "../contracts/api";
import { SIM_CONFIG, simulatedAuthEnabled, verifySimulatedToken } from "./sim-tidecloak";

interface AuthDeps {
  readConfig: () => Promise<unknown>;
  verifyToken: (config: object, token: string) => Promise<unknown>;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const nonempty = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;

export function isActor(value: unknown): value is Actor {
  return isRecord(value) && nonempty(value.subject) && nonempty(value.organizationId)
    && Array.isArray(value.roles) && value.roles.every(nonempty);
}

function usableConfig(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value)) return false;
  const fields = [value["auth-server-url"], value.realm, value.resource];
  if (!fields.every((field) => nonempty(field) && !/placeholder|your[_ -]|change[_ -]?me|replace[_ -]?me|[<>]|\$\{/i.test(field))) return false;
  try {
    const url = new URL(value["auth-server-url"] as string);
    return ["https:", "http:"].includes(url.protocol);
  } catch {
    return false;
  }
}

export function createAuthenticator(deps: Partial<AuthDeps> = {}) {
  // Simulated TideCloak replaces only the config and the verifier; actor and role handling below are unchanged.
  const simulated = !deps.readConfig && !deps.verifyToken && simulatedAuthEnabled();
  const readConfig = deps.readConfig ?? (simulated ? async () => SIM_CONFIG as unknown
    : async () => JSON.parse(await readFile(path.join(process.cwd(), "tidecloak.json"), "utf8")) as unknown);
  const verifyToken = deps.verifyToken ?? (simulated ? verifySimulatedToken : async (config, token) => {
    const { verifyTideCloakToken } = await import("@tidecloak/nextjs/server");
    return verifyTideCloakToken(config, token);
  });

  return async (token: string): Promise<ApiResult<Actor>> => {
    let config: unknown;
    try { config = await readConfig(); } catch {
      return fail("POLICY_UNAVAILABLE", "TideCloak configuration is unavailable");
    }
    if (!usableConfig(config)) return fail("POLICY_UNAVAILABLE", "TideCloak configuration is unavailable");
    try {
      // No JWT decoding fallback: only the pinned SDK's verified payload is trusted.
      const claims = await verifyToken(config, token);
      if (!isRecord(claims) || !isRecord(claims.realm_access)) return fail("UNAUTHENTICATED", "Invalid credential");
      const actor = { subject: claims.sub, organizationId: claims.organizationId, roles: claims.realm_access.roles };
      if (!isActor(actor)) return fail("UNAUTHENTICATED", "Invalid credential");
      return ok({ ...actor, roles: [...actor.roles] });
    } catch {
      // Do not expose or log credentials, token-derived claims, or verifier errors.
      return fail("UNAUTHENTICATED", "Invalid credential");
    }
  };
}

export const authenticate = createAuthenticator();

import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ok } from "../../src/contracts/api";
import { createAuthenticator } from "../../src/server/auth";
import { createHttpHandler } from "../../src/server/http";
import { loadRoster } from "../../src/server/roster-file";
import { SIM_CONFIG, issueSimulatedToken, verifySimulatedToken } from "../../src/server/sim-tidecloak";
import type { Services } from "../../src/server/services";

const roster = loadRoster(path.resolve(__dirname, "../../config/roster.json"));
const now = Math.floor(Date.now() / 1000);
const token = (subject: string, at = now) => issueSimulatedToken(roster, subject, at)!.access_token;
const swap = (jwt: string, index: number, value: string) => jwt.split(".").map((part, i) => i === index ? value : part).join(".");
const b64 = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");

afterEach(() => { vi.unstubAllEnvs(); });

describe("simulated TideCloak", () => {
  it("signs in a roster persona with its realm roles and verifies like verifyTideCloakToken", async () => {
    const claims = await verifySimulatedToken(SIM_CONFIG, token("subject-binh"));
    expect(claims).toMatchObject({ sub: "subject-binh", azp: "voicevault-web", organizationId: roster.organizationId, realm_access: { roles: ["employee", "manager"] } });
    expect(issueSimulatedToken(roster, "subject-mallory")).toBeNull();
    expect(issueSimulatedToken(roster, undefined)).toBeNull();
  });

  it("rejects forged roles, tampered signatures, expiry, wrong issuer and wrong client", async () => {
    const jwt = token("subject-an");
    const forged = swap(jwt, 1, b64({ ...JSON.parse(Buffer.from(jwt.split(".")[1], "base64url").toString()), realm_access: { roles: ["director"] } }));
    expect(await verifySimulatedToken(SIM_CONFIG, forged)).toBe(false);
    expect(await verifySimulatedToken(SIM_CONFIG, swap(jwt, 2, "AAAA"))).toBe(false);
    expect(await verifySimulatedToken(SIM_CONFIG, token("subject-an", now - 3600))).toBe(false);
    expect(await verifySimulatedToken({ ...SIM_CONFIG, realm: "other" }, jwt)).toBe(false);
    expect(await verifySimulatedToken({ ...SIM_CONFIG, resource: "other-client" }, jwt)).toBe(false);
    expect(await verifySimulatedToken(SIM_CONFIG, "not.a.jwt")).toBe(false);
  });

  it("is used by the authenticator only when VOICEVAULT_AUTH_MODE=simulated", async () => {
    expect((await createAuthenticator()(token("subject-chi"))).ok).toBe(false);
    vi.stubEnv("VOICEVAULT_AUTH_MODE", "simulated");
    expect(await createAuthenticator()(token("subject-chi"))).toMatchObject({ ok: true, data: { subject: "subject-chi", roles: ["employee", "director"] } });
    expect((await createAuthenticator()(swap(token("subject-an"), 2, "AAAA"))).ok).toBe(false);
  });

  it("keeps submissions locked unless simulated mode is explicitly on", async () => {
    const createIdea = vi.fn(async () => ok({ id: "idea" }));
    const handler = createHttpHandler({ authenticate: async () => ok({ subject: "subject-an", organizationId: roster.organizationId, roles: ["employee"] }), getServices: () => ({ createIdea } as unknown as Services) });
    const post = () => handler(new Request("https://app.test/api/v1/ideas", { method: "POST", headers: { authorization: "Bearer x.y.z" }, body: "{}" }));
    expect((await (await post()).json()).error.code).toBe("POLICY_UNAVAILABLE");
    expect(createIdea).not.toHaveBeenCalled();
    vi.stubEnv("VOICEVAULT_AUTH_MODE", "simulated");
    expect((await post()).status).toBe(201);
    expect(createIdea).toHaveBeenCalledOnce();
  });
});

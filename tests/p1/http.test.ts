import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { createAuthenticator } from "../../src/server/auth";
import { createHttpHandler } from "../../src/server/http";
import { createServices, type Services } from "../../src/server/services";
import { loadRoster } from "../../src/server/roster-file";
import { fail, ok, type Actor } from "../../src/contracts/api";
import type { PrismaClient } from "@prisma/client";

const actor: Actor = { subject: "subject-an", organizationId: "org-demo", roles: ["employee"] };
const config = { "auth-server-url": "https://identity.example", realm: "voicevault", resource: "voicevault-web" };
const request = (path: string, init: RequestInit = {}) => new Request(`https://app.example/api/v1${path}`, {
  ...init, headers: { authorization: "Bearer signed-token", ...init.headers },
});
const services = () => createServices({ prisma: {} as PrismaClient, roster: loadRoster(path.resolve(__dirname, "fixtures/roster.json")) });

describe("HTTP authentication boundary", () => {
  it.each([undefined, "", "Basic secret", "Bearer", "Bearer a b", "Bearer stub:identity"])("denies malformed credentials %s before services", async (authorization) => {
    const authenticate = vi.fn(async () => ok(actor));
    const getServices = vi.fn(services);
    const handler = createHttpHandler({ authenticate, getServices });
    const response = await handler(new Request("https://app.example/api/v1/me", { headers: authorization === undefined ? {} : { authorization } }));
    expect(response.status).toBe(401);
    expect((await response.json()).error.code).toBe("UNAUTHENTICATED");
    expect(authenticate).not.toHaveBeenCalled();
    expect(getServices).not.toHaveBeenCalled();
  });

  it("rejects invalid verified actors before creating the database service", async () => {
    const getServices = vi.fn(services);
    for (const invalid of [{ ...actor, organizationId: "" }, { ...actor, roles: "director" }, { ...actor, subject: "" }]) {
      const handler = createHttpHandler({ authenticate: async () => ok(invalid as Actor), getServices });
      expect((await handler(request("/me"))).status).toBe(401);
    }
    expect(getServices).not.toHaveBeenCalled();
  });

  it("returns verifier denials without calling services", async () => {
    const getServices = vi.fn(services);
    const handler = createHttpHandler({ authenticate: async () => fail("UNAUTHENTICATED", "Invalid credential"), getServices });
    expect((await handler(request("/me"))).status).toBe(401);
    expect(getServices).not.toHaveBeenCalled();
  });
});

describe("verified claims", () => {
  it("only derives actor from verified subject, explicit organization claim and realm roles", async () => {
    const verifyToken = vi.fn(async () => ({ sub: "verified", organizationId: "org-demo", realm_access: { roles: ["employee"] }, roles: ["director"] }));
    const authenticate = createAuthenticator({ readConfig: async () => config, verifyToken });
    expect(await authenticate("signed-token")).toMatchObject({ ok: true, data: { subject: "verified", organizationId: "org-demo", roles: ["employee"] } });
    expect(verifyToken).toHaveBeenCalledWith(config, "signed-token");
  });

  it.each([
    null, { sub: "verified", realm_access: { roles: [] } },
    { sub: "verified", organizationId: "org-demo", realm_access: { roles: "director" } },
    { sub: "verified", organizationId: "org-demo", realm_access: { roles: [1] } },
    { vuid: "unmapped", organizationId: "org-demo", realm_access: { roles: [] } },
  ])("denies incomplete or malformed claims", async (claims) => {
    const authenticate = createAuthenticator({ readConfig: async () => config, verifyToken: async () => claims });
    expect(await authenticate("signed-token")).toMatchObject({ ok: false, error: { code: "UNAUTHENTICATED" } });
  });

  it.each([{}, { ...config, realm: "YOUR_REALM" }, { ...config, resource: "" }])("fails closed for placeholder configuration", async (value) => {
    const verifyToken = vi.fn(async () => ({}));
    const authenticate = createAuthenticator({ readConfig: async () => value, verifyToken });
    expect(await authenticate("signed-token")).toMatchObject({ ok: false, error: { code: "POLICY_UNAVAILABLE" } });
    expect(verifyToken).not.toHaveBeenCalled();
  });

  it("fails closed for unreadable configuration and safely denies verifier errors", async () => {
    const missing = createAuthenticator({ readConfig: async () => { throw new Error("missing"); } });
    expect(await missing("signed-token")).toMatchObject({ ok: false, error: { code: "POLICY_UNAVAILABLE" } });
    const invalid = createAuthenticator({ readConfig: async () => config, verifyToken: async () => { throw new Error("secret raw error"); } });
    const result = await invalid("signed-token");
    expect(result).toMatchObject({ ok: false, error: { code: "UNAUTHENTICATED" } });
    expect(JSON.stringify(result)).not.toContain("secret raw error");
  });
});

describe("HTTP service dispatch", () => {
  const handler = createHttpHandler({ authenticate: async () => ok(actor), getServices: services });

  it("dispatches real session, directory and council services with ApiResult", async () => {
    const me = await handler(request("/me"));
    expect(me.status).toBe(200);
    expect(me.headers.get("cache-control")).toBe("no-store");
    expect(await me.json()).toMatchObject({ ok: true, contractVersion: "v1", data: { authenticated: true, subject: "subject-an", organizationId: "org-demo" } });
    expect((await (await handler(request("/directory"))).json()).data.people.length).toBeGreaterThan(0);
    expect((await (await handler(request("/council"))).json()).data.members.length).toBeGreaterThan(0);
  });

  it("keeps organization authorization in real services", async () => {
    const wrongOrg = createHttpHandler({ authenticate: async () => ok({ ...actor, organizationId: "other" }), getServices: services });
    expect((await wrongOrg(request("/me"))).status).toBe(403);
  });

  it("never lets JSON actor claims replace the authenticated actor", async () => {
    const decideIdea = vi.fn(async (authenticated: Actor) => ok({ subject: authenticated.subject, roles: authenticated.roles }));
    const dispatch = createHttpHandler({ authenticate: async () => ok(actor), getServices: () => ({ decideIdea } as unknown as Services) });
    const response = await dispatch(request("/ideas/example/decision", { method: "POST", body: JSON.stringify({ actor: { subject: "forged", roles: ["director"] }, subject: "forged", organizationId: "other", roles: ["director"] }) }));
    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual({ subject: "subject-an", roles: ["employee"] });
    expect(decideIdea.mock.calls[0][0]).toEqual(actor);
  });

  it("rejects malformed JSON before resolving services", async () => {
    const getServices = vi.fn(services);
    const dispatch = createHttpHandler({ authenticate: async () => ok(actor), getServices });
    const response = await dispatch(request("/ideas/example/decision", { method: "POST", body: "{" }));
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("INVALID_REQUEST");
    expect(getServices).not.toHaveBeenCalled();
  });

  it("distinguishes absent routes and unsupported HTTP methods", async () => {
    expect((await handler(request("/missing"))).status).toBe(404);
    const response = await handler(request("/me", { method: "POST", body: "{}" }));
    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("GET");
  });

  it("forwards typed list query and preserves service error statuses", async () => {
    const listIdeas = vi.fn(async (_actor: Actor, query: unknown) => ok(query));
    const getIdea = vi.fn(async () => fail("NOT_FOUND", "Missing idea"));
    const dispatch = createHttpHandler({ authenticate: async () => ok(actor), getServices: () => ({ listIdeas, getIdea } as unknown as Services) });
    expect((await (await dispatch(request("/ideas?limit=7&cursor=14&status=APPROVED"))).json()).data).toEqual({ limit: 7, cursor: "14", status: "APPROVED" });
    expect((await dispatch(request("/ideas/missing"))).status).toBe(404);
  });

  it.each(["/ideas/id/identity-envelope", "/reports/id/identity-envelope?votingRequestId=ready"])("blocks identity envelope release at %s without resolving services", async (path) => {
    const getServices = vi.fn(services);
    const dispatch = createHttpHandler({ authenticate: async () => ok(actor), getServices });
    const response = await dispatch(request(path));
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ ok: false, error: { code: "POLICY_UNAVAILABLE", enforcement: "APP" } });
    expect(getServices).not.toHaveBeenCalled();
  });

  it.each(["/ideas", "/reports"])("blocks unverified client identity envelopes on POST %s", async (path) => {
    const getServices = vi.fn(services);
    const dispatch = createHttpHandler({ authenticate: async () => ok(actor), getServices });
    const response = await dispatch(request(path, { method: "POST", body: JSON.stringify({ identityEnvelope: { ciphertext: "stub:base64" } }) }));
    expect(response.status).toBe(503);
    expect((await response.json()).error.code).toBe("POLICY_UNAVAILABLE");
    expect(getServices).not.toHaveBeenCalled();
  });

  it.each(["/council-changes", "/council-changes/id/apply"])("keeps unsupported operation %s unavailable", async (path) => {
    const response = await handler(request(path, { method: "POST", body: "{}" }));
    expect(response.status).toBe(503);
    expect((await response.json()).error.code).toBe("POLICY_UNAVAILABLE");
  });

  it("sanitizes infrastructure errors", async () => {
    const dispatch = createHttpHandler({ authenticate: async () => ok(actor), getServices: () => { throw new Error("DATABASE_URL=password"); } });
    const response = await dispatch(request("/me"));
    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toContain("password");
  });
});

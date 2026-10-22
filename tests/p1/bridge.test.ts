import { afterEach, describe, expect, it, vi } from "vitest";
import "../../src/integration/bridge-entry";
import { createStubAuth } from "../../src/integration/browser-runtime";
import { ok } from "../../src/contracts/api";
import type { createVoiceVaultUIRuntime } from "../../src/integration/ui-runtime";

const globals = globalThis as unknown as Record<string, unknown>;
const factory = () => {
  expect(typeof globals.createVoiceVaultLiveRuntime).toBe("function");
  return (globals.createVoiceVaultLiveRuntime as () => Promise<ReturnType<typeof createVoiceVaultUIRuntime>>)();
};
afterEach(() => vi.unstubAllGlobals());

describe("bootstrap LIVE factory", () => {
  it("fails with a configuration error when no Tide auth adapter is installed", async () => {
    await expect(factory()).rejects.toThrow("POLICY_UNAVAILABLE");
    expect(globals.VoiceVaultLiveStubs).toBeUndefined();
    expect(globals.createVoiceVaultLive).toBeUndefined();
  });

  it("wraps API views for the UI while keeping unverified operations locked", async () => {
    vi.stubGlobal("VoiceVaultLiveConfig", { auth: createStubAuth({ authenticated: true, subject: "member" }) });
    const requests: string[] = [];
    vi.stubGlobal("fetch", async (input: string) => {
      requests.push(input);
      return Response.json(ok({ authenticated: true, subject: "member", roles: ["employee"], capabilities: ["submitIdea", "submitReport"] }));
    });
    const runtime = await factory();
    expect(runtime.mode).toBe("LIVE");
    expect(await runtime.init()).toMatchObject({ ok: true, data: { authenticated: true, capabilities: { canSubmit: false } } });
    expect(requests).toEqual(["/api/v1/me"]);
    for (const result of [await runtime.submitIdea({}), await runtime.submitReport({}), await runtime.revealIdentity("REPORT", "report", "round")]) {
      expect(result).toMatchObject({ ok: false, error: { code: "POLICY_UNAVAILABLE" } });
    }
    expect(requests).toEqual(["/api/v1/me"]);
  });

  it("uses Simulated TideCloak only when the server enables it, and then follows server capabilities", async () => {
    const store = new Map<string, string>();
    vi.stubGlobal("sessionStorage", { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v), removeItem: (k: string) => store.delete(k) });
    const payload = Buffer.from(JSON.stringify({ sub: "subject-an", name: "An Nguyen", exp: Math.floor(Date.now() / 1000) + 600, realm_access: { roles: ["employee"] } })).toString("base64url");
    store.set("voicevault.simTideCloak.token", `h.${payload}.s`);
    const requests: { url: string; auth: string | null }[] = [];
    vi.stubGlobal("fetch", async (input: string, init?: RequestInit) => {
      requests.push({ url: input, auth: new Headers(init?.headers).get("authorization") });
      if (input === "/sim-tidecloak/personas") return Response.json({ realm: "voicevault-sim", users: [] });
      return Response.json(ok({ authenticated: true, subject: "subject-an", roles: ["employee"], capabilities: ["submitIdea", "submitReport"] }));
    });
    const runtime = await factory() as ReturnType<typeof createVoiceVaultUIRuntime>;
    expect(runtime.simulatedTide).toBe(true);
    expect(await runtime.init()).toMatchObject({ ok: true, data: { authenticated: true, capabilities: { canSubmit: true } } });
    expect(requests.map((r) => r.url)).toEqual(["/sim-tidecloak/personas", "/api/v1/me"]);
    expect(requests[1].auth).toBe(`Bearer h.${payload}.s`);
  });

  it("stays locked when the simulated sign-in endpoint is absent", async () => {
    vi.stubGlobal("fetch", async () => new Response("Not found", { status: 404 }));
    await expect(factory()).rejects.toThrow("POLICY_UNAVAILABLE");
  });

  it("passes the server's reveal capability through only in simulated mode", async () => {
    const { createVoiceVaultUIRuntime: wrap } = await import("../../src/integration/ui-runtime");
    const round = { id: "r", resourceId: "rep", operation: "REVEAL_REPORT_IDENTITY", state: "READY", voters: [], voterCount: 3, quorumRequired: 2, validApprovals: 2, independentApproved: true, capabilities: ["revealIdentity"], recipientSubject: "subject-frank" };
    const core = { contractVersion: "v1", mode: "LIVE", getVotingRequest: async () => ok(round) };
    expect(await wrap(core).getVotingRequest("r")).toMatchObject({ ok: true, data: { canReveal: false } });
    expect(await wrap(core, { simulatedTide: true }).getVotingRequest("r")).toMatchObject({ ok: true, data: { canReveal: true } });
  });
});

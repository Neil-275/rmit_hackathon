import { describe, expect, it, afterEach } from "vitest";
import { fail, ok } from "../../src/contracts/api";
import { createStubAuth, createStubCrypto, createVoiceVaultLive } from "../../src/integration/browser-runtime";
import "../../src/integration/bridge-entry";

const identity = { authenticated: true, subject: "member", organizationId: "org-demo", displayName: "Member", roles: ["employee"] };
const globals = globalThis as unknown as Record<string, any>;
afterEach(() => { delete globals.VoiceVaultLiveConfig; });

describe("session and bridge continuation", () => {
  it("does not keep a stale authenticated session after API 401", async () => {
    const runtime = createVoiceVaultLive({ apiBase: "/api/v1", auth: createStubAuth(identity), crypto: createStubCrypto(),
      fetch: (async () => Response.json(fail("UNAUTHENTICATED", "Session expired"), { status: 401 })) as typeof fetch });
    expect(await runtime.getSession()).toMatchObject({ ok: false, error: { code: "UNAUTHENTICATED" } });
  });

  it("provides the bootstrap factory and fails closed without configured adapters", () => {
    expect(typeof globals.createVoiceVaultLiveRuntime).toBe("function");
    expect(() => globals.createVoiceVaultLiveRuntime()).toThrow("POLICY_UNAVAILABLE");
    expect(globals.VoiceVaultLiveStubs).toBeUndefined();
  });

  it("mounts the UI contract from explicitly configured adapters", async () => {
    globals.VoiceVaultLiveConfig = { apiBase: "/api/v1", auth: createStubAuth(identity), crypto: createStubCrypto(),
      fetch: async () => Response.json(ok({ ...identity, capabilities: ["submitIdea", "submitReport"] })) };
    expect(typeof globals.createVoiceVaultLiveRuntime).toBe("function");
    const runtime = globals.createVoiceVaultLiveRuntime();
    // Submission stays locked in LIVE until ciphertext provenance is verified (master decision).
    expect(await runtime.init()).toMatchObject({ ok: true, data: { capabilities: { canSubmit: false } } });
    expect(runtime.mode).toBe("LIVE");
    expect(runtime.simulation).toBeUndefined();
    expect(await runtime.revealIdentity("REPORT", "report", "round")).toMatchObject({ ok: false, error: { code: "POLICY_UNAVAILABLE" } });
  });
});

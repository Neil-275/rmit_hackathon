import { afterEach, describe, expect, it, vi } from "vitest";
import "../../src/integration/bridge-entry";
import { createStubAuth } from "../../src/integration/browser-runtime";
import { ok } from "../../src/contracts/api";
import type { createVoiceVaultUIRuntime } from "../../src/integration/ui-runtime";

const globals = globalThis as unknown as Record<string, unknown>;
const factory = () => {
  expect(typeof globals.createVoiceVaultLiveRuntime).toBe("function");
  return (globals.createVoiceVaultLiveRuntime as () => ReturnType<typeof createVoiceVaultUIRuntime>)();
};
afterEach(() => vi.unstubAllGlobals());

describe("bootstrap LIVE factory", () => {
  it("fails with a configuration error when no Tide auth adapter is installed", () => {
    expect(() => factory()).toThrow("POLICY_UNAVAILABLE");
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
    const runtime = factory();
    expect(runtime.mode).toBe("LIVE");
    expect(await runtime.init()).toMatchObject({ ok: true, data: { authenticated: true, capabilities: { canSubmit: false } } });
    expect(requests).toEqual(["/api/v1/me"]);
    for (const result of [await runtime.submitIdea({}), await runtime.submitReport({}), await runtime.revealIdentity("REPORT", "report", "round")]) {
      expect(result).toMatchObject({ ok: false, error: { code: "POLICY_UNAVAILABLE" } });
    }
    expect(requests).toEqual(["/api/v1/me"]);
  });
});

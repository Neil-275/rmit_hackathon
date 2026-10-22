import { describe, expect, it } from "vitest";
import { fail, ok } from "../../src/contracts/api";
import { createStubAuth, createStubCrypto, createVoiceVaultLive } from "../../src/integration/browser-runtime";

describe("server-verified browser session", () => {
  it("does not report a stale adapter session as connected after API rejection", async () => {
    const auth = createStubAuth({ authenticated: true, subject: "stale-user" });
    const runtime = createVoiceVaultLive({
      apiBase: "/api/v1", auth, crypto: createStubCrypto(),
      fetch: async () => Response.json(fail("UNAUTHENTICATED", "expired"), { status: 401 }),
    });
    const session = await runtime.getSession();
    expect(session.ok ? session.data.authenticated : session.error.code).toBe("UNAUTHENTICATED");
  });

  it("checks the server after login before reporting connected capabilities", async () => {
    const auth = createStubAuth({ authenticated: false, subject: "member" });
    const runtime = createVoiceVaultLive({
      apiBase: "/api/v1", auth, crypto: createStubCrypto(),
      fetch: async () => Response.json(ok({ authenticated: true, subject: "member", roles: ["employee"], capabilities: ["submitIdea", "submitReport"] })),
    });
    expect(await runtime.login()).toMatchObject({ ok: true, data: { capabilities: ["submitIdea", "submitReport"] } });
  });

  it("does not accept an HTTP 401 body that claims success", async () => {
    const auth = createStubAuth({ authenticated: true, subject: "stale-user" });
    const runtime = createVoiceVaultLive({
      apiBase: "/api/v1", auth, crypto: createStubCrypto(),
      fetch: async () => Response.json(ok({ authenticated: true }), { status: 401 }),
    });
    expect(await runtime.getSession()).toMatchObject({ ok: false, error: { code: "UNAUTHENTICATED" } });
  });
});

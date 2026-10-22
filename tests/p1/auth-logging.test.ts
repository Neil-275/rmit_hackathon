import { afterEach, describe, expect, it, vi } from "vitest";
const captured = vi.hoisted(() => ({ options: null as any, verify: vi.fn() }));
vi.mock("@tidecloak/nextjs/server", () => ({
  createTideCloakProxy: (options: any) => { captured.options = options; return () => {}; },
  verifyTideCloakToken: captured.verify,
}));
import "../../proxy";
import { GET } from "../../app/api/protected/route";
afterEach(() => vi.restoreAllMocks());
const dumped = (spy: any) => spy.mock.calls.flat().map((x: unknown) => String(x) + " " + JSON.stringify(x)).join(" ");

describe("auth log privacy", () => {
  it("never writes a rejected bearer credential to proxy logs", () => {
    const log = vi.spyOn(console, "debug").mockImplementation(() => {});
    captured.options.onFailure({ token: "private-bearer-credential" }, { nextUrl: { pathname: "/protected" } });
    expect(dumped(log)).not.toContain("private-bearer-credential");
  });
  it("does not dump verifier exception details in proxy or legacy API logs", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = new Error("private-verifier-payload");
    captured.options.onError(error, { nextUrl: { pathname: "/protected" }, url: "http://localhost:3000/protected" });
    captured.verify.mockRejectedValueOnce(error);
    await GET(new Request("http://localhost:3000/api/protected", { headers: { authorization: "Bearer token" } }) as any);
    expect(dumped(log)).not.toContain("private-verifier-payload");
  });
});

import { afterAll, beforeAll, expect, it } from "vitest";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createTempDb } from "./helpers/db";
import { actor, reportDto } from "./helpers/dto";
import { loadRoster } from "../../src/server/roster";
import { createServices } from "../../src/server/services";
import { createHttpHandler } from "../../src/server/http";
import { ok } from "../../src/contracts/api";
import { createStubAuth, createStubCrypto, createVoiceVaultLive } from "../../src/integration/browser-runtime";
import { createVoiceVaultUIRuntime } from "../../src/integration/ui-runtime";

const { JSDOM } = createRequire(import.meta.url)("jsdom");
const root = path.resolve(__dirname, "../..");
let db: ReturnType<typeof createTempDb>;
beforeAll(() => { db = createTempDb(); });
afterAll(async () => { await db?.cleanup(); });

it("renders real service vote decisions through HTTP and the adapter in the static DOM", async () => {
  const roster = loadRoster(path.join(root, "config/roster.json"));
  const svc = createServices({ prisma: db.prisma, roster, drawInt: (min) => min });
  const j1 = actor("subject-juror-1"), j2 = actor("subject-juror-2");
  const dto = await reportDto(["subject-an"]);
  expect((await svc.createReport(actor("subject-an"), dto)).ok).toBe(true);
  const created = await svc.createUnmaskRequest(j1, dto.id, { contractVersion: "v1", recipientSubject: j1.subject, purpose: "Review synthetic evidence" });
  if (!created.ok) throw new Error(created.error.code);
  expect((await svc.castVote(j2, created.data.id, { contractVersion: "v1", votingRequestId: created.data.id, decision: "DENY", reason: "Insufficient evidence" })).ok).toBe(true);
  const handler = createHttpHandler({ authenticate: async () => ok(j1), getServices: () => svc });
  const runtime = createVoiceVaultUIRuntime(createVoiceVaultLive({
    apiBase: "/api/v1", auth: createStubAuth({ authenticated: true, subject: j1.subject }), crypto: createStubCrypto(),
    fetch: async (input, init) => handler(new Request(new URL(String(input), "https://app.test"), init)),
  }));
  const result = await runtime.listReports();
  expect(result).toMatchObject({ ok: true, data: { items: [{ voting: { approvalCount: 0, status: "DENIED", validApprovals: [{ voterId: j2.subject, decision: "DENY" }], canReveal: false } }] } });

  const dom = new JSDOM(readFileSync(path.join(root, "public/ui/index.html"), "utf8"), { url: "https://app.test/ui/index.html#votes", runScripts: "outside-only", pretendToBeVisual: true });
  try {
    for (const file of ["views/helpers.js", "views/dialogs.js", "views/pages.js", "app.js"]) {
      dom.window.eval(readFileSync(path.join(root, "public/ui", file), "utf8"));
    }
    await dom.window.VoiceVaultUI.mount(runtime);
    const doc = dom.window.document;
    expect(doc.body.dataset.appState).toBe("ready");
    const panel = doc.querySelector(`[data-round-id="${created.data.id}"]`);
    expect(panel.textContent).toContain("Denied");
    expect(panel.querySelector('[role="progressbar"]').getAttribute("aria-valuenow")).toBe("0");
    expect(panel.querySelectorAll(".voter.has-voted")).toHaveLength(1);
    expect(panel.querySelector('[data-action="approve-vote"]')).toBeNull();
    expect(doc.body.textContent).not.toMatch(/opaque-|stub-token|undefined/);
  } finally { dom.window.close(); }
});

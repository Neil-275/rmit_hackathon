// Seeds the 2-minute demo through the real HTTP API, signed in with Simulated TideCloak tokens.
// Every record passes the server's authentication, role checks, CoI selection, hashing and audit.
// Run via `npm run seed:demo` against a server started with VOICEVAULT_AUTH_MODE=simulated.
import { createStubCrypto, createVoiceVaultLive, type AuthAdapter } from "../src/integration/browser-runtime";

const base = (process.env.VOICEVAULT_URL ?? "http://localhost:3000").replace(/\/+$/, "");
type Result = { ok: boolean; data?: any; error?: { code: string; message: string } };

async function signIn(subject: string) {
  const res = await fetch(`${base}/sim-tidecloak/token`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subject }) });
  if (!res.ok) throw new Error(res.status === 404 ? "Simulated TideCloak is off: start the server with VOICEVAULT_AUTH_MODE=simulated." : `sign-in failed for ${subject}`);
  const { access_token: token } = await res.json() as { access_token: string };
  const claims = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"));
  const auth: AuthAdapter = {
    async init() {}, async login() {}, async logout() {}, async getToken() { return token; },
    session: () => ({ authenticated: true, subject: claims.sub, displayName: claims.name, organizationId: claims.organizationId, roles: claims.realm_access.roles }),
  };
  return createVoiceVaultLive({ apiBase: `${base}/api/v1`, auth, crypto: createStubCrypto() }) as unknown as Record<string, (...args: unknown[]) => Promise<Result>>;
}

const sessions = new Map<string, Awaited<ReturnType<typeof signIn>>>();
async function as(name: string) {
  const subject = `subject-${name}`;
  if (!sessions.has(subject)) sessions.set(subject, await signIn(subject));
  return sessions.get(subject)!;
}
function must(result: Result, what: string) {
  if (!result.ok) throw new Error(`${what}: ${result.error?.code} ${result.error?.message}`);
  return result.data;
}

async function idea(author: string, title: string, description: string, category: string, credit: boolean, steps: ("endorse" | "approve" | "reject")[]) {
  let view = must(await (await as(author)).submitIdea({ title, description, category, publishCreditOnApproval: credit }), `idea "${title}"`);
  for (const step of steps) {
    if (step === "endorse") view = must(await (await as("binh")).endorseIdea(view.id, view.version), `endorse "${title}"`);
    else view = must(await (await as("chi")).decideIdea(view.id, { decision: step === "approve" ? "APPROVE" : "REJECT", reason: step === "approve" ? "Clear benefit and low cost." : "Not feasible this year.", expectedVersion: view.version }), `${step} "${title}"`);
  }
  console.log(`  idea   ${view.status.padEnd(13)} ${title}`);
}

async function report(reporter: string, title: string, evidenceDetails: string, accused: string[], unmask?: { by?: string; purpose: string; votes: ("APPROVE" | "DENY")[] }) {
  const view = must(await (await as(reporter)).submitReport({ title, evidenceDetails, accusedPersonIds: accused.map((a) => `subject-${a}`), contact: `${reporter}@example.test`, consent: true }), `report "${title}"`);
  const jurors: { id?: string; subject?: string; independent?: boolean }[] = view.jurors ?? view.voters ?? [];
  console.log(`  report ${String(view.status).padEnd(13)} ${title} · N=${view.voterCount ?? "-"} T=${view.quorumRequired ?? "-"}`);
  if (!unmask || jurors.length === 0) return;
  const ids = jurors.map((j) => String(j.subject ?? j.id).replace(/^subject-/, ""));
  // The jury is drawn at random, so the requester is whichever juror was drawn (Frank when he is); it also receives
  // the identity. Never redraw to get a preferred jury.
  const opener = ids.includes(unmask.by ?? "frank") ? (unmask.by ?? "frank") : ids[0];
  const round = must(await (await as(opener)).createUnmaskRequest(view.id, { recipientSubject: `subject-${opener}`, purpose: unmask.purpose }), `unmask "${title}"`);
  console.log(`         recipient ${opener}`);
  // Independent members vote first so a full set of approvals reaches READY.
  const order = [...jurors].sort((a, b) => Number(b.independent) - Number(a.independent)).map((j) => String(j.subject ?? j.id).replace(/^subject-/, ""));
  let last: any = round;
  for (const [i, decision] of unmask.votes.entries()) {
    if (!order[i] || ["READY", "DENIED"].includes(String(last.state ?? last.status))) break;
    last = must(await (await as(order[i])).castVote(round.votingRequestId ?? round.id, { decision, reason: decision === "APPROVE" ? "Evidence warrants identity review." : "Evidence is not strong enough." }), `vote on "${title}"`);
  }
  console.log(`         round ${String(last.state ?? last.status ?? "COLLECTING")} · ${unmask.votes.length} vote(s)`);
}

async function main() {
  const existing = must(await (await as("chi")).listIdeas({}), "list ideas");
  if (existing.items.length > 0 && !process.argv.includes("--force")) {
    console.log(`Database already has ${existing.items.length} idea(s); not seeding again (use --force to add another set).`);
    return;
  }
  console.log(`Seeding demo data via ${base}/api/v1 (Simulated TideCloak)`);
  await idea("an", "Rotate on-call fairly", "Publish the on-call rota a month ahead and let engineers swap shifts in one place.", "process", true, []);
  await idea("mai", "A shared knowledge library", "Create an internal library so expertise stays with the team when people move between projects.", "culture", true, ["endorse"]);
  await idea("an", "Make meeting rooms work better", "Ask organizers to confirm bookings and release unused rooms. Pilot on one floor first.", "sustainability", true, ["endorse", "approve"]);
  await idea("henry", "Automate shift quality checks", "Combine equipment readings and checklists into one short review before production starts.", "process", false, ["endorse", "approve"]);
  await idea("iris", "Plain-language policy summaries", "Add a one-page plain-language summary to every internal policy.", "culture", true, ["endorse"]);
  await idea("dave", "Four-day pilot week for IT", "Trial a four-day week for the IT team for one quarter.", "culture", true, ["reject"]);
  await idea("mai", "Quiet hours for deep work", "Keep 9–11am meeting-free on Tuesdays and Thursdays.", "product", true, []);

  await report("an", "Overtime hours not recorded", "Synthetic scenario: weekend work requested by the team lead is missing from timesheets for three months.", ["binh"],
    { purpose: "Legal needs to confirm the reporter's account before interviewing witnesses.", votes: ["APPROVE"] });
  await report("mai", "Supplier selection skipped review", "Synthetic scenario: two purchase orders were approved without the independent review the policy requires.", ["eva"],
    { purpose: "Verify the reporter before referring the case to external audit.", votes: ["APPROVE", "APPROVE", "APPROVE", "APPROVE", "APPROVE"] });
  await report("an", "Project access rights left open", "Synthetic scenario: administrator accounts kept access to finished projects.", ["dave"],
    { purpose: "Confirm the reporter's role in the project.", votes: ["DENY"] });
  await report("henry", "Bonus decisions overruled", "Synthetic scenario: approved bonuses were changed after sign-off by senior leadership.", ["chi"]);
  console.log("Done. Open /ui/index.html and sign in with Simulated TideCloak.");
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });

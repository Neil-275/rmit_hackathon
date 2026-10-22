// Simulated TideCloak sign-in: exchanges a demo persona for a signed access token. 404 unless explicitly enabled.
import rosterConfig from "../../../config/roster.json";
import { parseRoster } from "../../../src/server/roster";
import { issueSimulatedToken, simulatedAuthEnabled } from "../../../src/server/sim-tidecloak";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const roster = parseRoster(rosterConfig);

export async function POST(request: Request) {
  if (!simulatedAuthEnabled()) return new Response("Not found", { status: 404 });
  let subject: unknown;
  try { subject = ((await request.json()) as { subject?: unknown }).subject; } catch { subject = undefined; }
  const token = issueSimulatedToken(roster, subject);
  if (!token) return Response.json({ error: "unknown_user" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  return Response.json(token, { headers: { "Cache-Control": "no-store" } });
}

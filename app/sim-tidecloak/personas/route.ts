// Simulated TideCloak login screen data: the synthetic demo users and their realm roles. 404 unless enabled.
import rosterConfig from "../../../config/roster.json";
import { parseRoster } from "../../../src/server/roster";
import { simulatedAuthEnabled } from "../../../src/server/sim-tidecloak";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const roster = parseRoster(rosterConfig);
const titles = new Map((rosterConfig.personas as { subject: string; title?: string }[]).map((p) => [p.subject, p.title ?? ""]));

export async function GET() {
  if (!simulatedAuthEnabled()) return new Response("Not found", { status: 404 });
  const council = new Set(roster.council.members.filter((m) => m.active).map((m) => m.subject));
  return Response.json({
    realm: "voicevault-sim",
    users: roster.personas.map((p) => ({ subject: p.subject, displayName: p.displayName, title: titles.get(p.subject), roles: p.roles, council: council.has(p.subject) })),
  }, { headers: { "Cache-Control": "no-store" } });
}

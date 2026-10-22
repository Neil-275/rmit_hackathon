// Đọc roster từ đĩa cho test/script. Route production dùng import JSON tĩnh trong services/default.ts.
import { readFileSync } from "node:fs";
import path from "node:path";
import { parseRoster, type Roster } from "./roster";

export function loadRoster(file = path.join(process.cwd(), "config", "roster.json")): Roster {
  return parseRoster(JSON.parse(readFileSync(file, "utf8")));
}

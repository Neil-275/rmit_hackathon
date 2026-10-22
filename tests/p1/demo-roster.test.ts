import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadRoster } from "../../src/server/roster-file";

// The app ships config/roster.json; a broken file would only fail on the first request.
describe("demo roster", () => {
  it("parses and seats the spec council with Grace as the independent member", () => {
    const roster = loadRoster(path.resolve(__dirname, "../../config/roster.json"));
    expect(roster.council.members.map((m) => m.displayName)).toEqual(["Eva Do", "Frank Vu", "Grace Hoang", "Henry Ly", "Iris Phan"]);
    expect(roster.council.members.filter((m) => m.independent).map((m) => m.displayName)).toEqual(["Grace Hoang"]);
    expect(roster.council.selectionPolicy).toEqual({ minVoters: 3, maxVoters: 5 });
    const roles = Object.fromEntries(roster.personas.map((p) => [p.displayName, p.roles]));
    expect(roles["Binh Tran"]).toContain("manager");
    expect(roles["Chi Le"]).toContain("director");
    expect(roster.personas.every((p) => p.roles.includes("employee"))).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import {
  encodeIdeaV1, encodeReportV1, hashCiphertext, hashIdeaV1, hashReportV1, normalizeText, sha256Hex,
} from "../../src/contracts/encoding";

const base = {
  organizationId: "org-demo",
  resourceId: "3f8f2f0e-6a3b-4c5d-9e7f-0123456789ab",
  contentVersion: 1,
  category: "process",
};
const idea = (title: string, description: string) => ({ ...base, title, description });
const report = (over: Partial<{ title: string; evidenceDetails: string; accusedPersonIds: string[] }> = {}) => ({
  ...base, title: "t", evidenceDetails: "e", accusedPersonIds: ["b", "a"], ...over,
});

describe("canonical encoding v1", () => {
  it('("a||b","c") khác ("a","b||c")', async () => {
    expect(await hashIdeaV1(idea("a||b", "c"))).not.toBe(await hashIdeaV1(idea("a", "b||c")));
  });
  it("NFC và NFD cho cùng hash", async () => {
    const nfc = "Tiếng Việt".normalize("NFC");
    const nfd = "Tiếng Việt".normalize("NFD");
    expect(nfc).not.toBe(nfd);
    expect(await hashIdeaV1(idea(nfd, nfd))).toBe(await hashIdeaV1(idea(nfc, nfc)));
  });
  it("CRLF, CR và LF cho cùng hash; whitespace khác vẫn giữ", async () => {
    const lf = await hashIdeaV1(idea("t", "a\nb"));
    expect(await hashIdeaV1(idea("t", "a\r\nb"))).toBe(lf);
    expect(await hashIdeaV1(idea("t", "a\rb"))).toBe(lf);
    expect(await hashIdeaV1(idea("t", "a \nb"))).not.toBe(lf);
    expect(normalizeText(" x\r\n")).toBe(" x\n");
  });
  it("thứ tự field cố định, có schema", () => {
    const json = new TextDecoder().decode(encodeIdeaV1(idea("t", "d")));
    expect(Object.keys(JSON.parse(json))).toEqual([
      "schema", "organizationId", "resourceId", "contentVersion", "title", "description", "category",
    ]);
  });
  it("report: accused dedupe + sort, thứ tự đầu vào không đổi hash", async () => {
    const json = JSON.parse(new TextDecoder().decode(encodeReportV1(report({ accusedPersonIds: ["c", "a", "c"] }))));
    expect(json.accusedPersonIds).toEqual(["a", "c"]);
    expect(await hashReportV1(report({ accusedPersonIds: ["a", "b"] })))
      .toBe(await hashReportV1(report({ accusedPersonIds: ["b", "a", "a"] })));
    expect(await hashReportV1(report())).not.toBe(await hashReportV1(report({ evidenceDetails: "e2" })));
  });
  it("SHA-256 WebCrypto khớp node:crypto", async () => {
    const bytes = encodeIdeaV1(idea("x", "y"));
    expect(await sha256Hex(bytes)).toBe(createHash("sha256").update(bytes).digest("hex"));
    expect(await hashCiphertext("abc")).toBe(createHash("sha256").update("abc", "utf8").digest("hex"));
  });
});

// Canonical encoding v1 (§9): NFC, CRLF/CR -> LF, giữ whitespace còn lại, JSON thứ tự field cố định.
// SHA-256 qua WebCrypto (globalThis.crypto.subtle) để client và server cho cùng hash.
// Không stringify object tùy ý hoặc spread input: mỗi encoder liệt kê field tường minh.

export const normalizeText = (v: string): string => v.normalize("NFC").replace(/\r\n?/g, "\n");

export interface IdeaContentV1 {
  organizationId: string;
  resourceId: string;
  contentVersion: number;
  title: string;
  description: string;
  category: string;
}

export interface ReportContentV1 {
  organizationId: string;
  resourceId: string;
  contentVersion: number;
  title: string;
  evidenceDetails: string;
  accusedPersonIds: string[];
}

const utf8 = (s: string): Uint8Array => new TextEncoder().encode(s);

export const canonicalAccused = (ids: readonly string[]): string[] =>
  [...new Set(ids.map(normalizeText))].sort();

export function encodeIdeaV1(v: IdeaContentV1): Uint8Array {
  return utf8(JSON.stringify({
    schema: "voicevault.idea.content.v1",
    organizationId: v.organizationId,
    resourceId: v.resourceId.toLowerCase(),
    contentVersion: v.contentVersion,
    title: normalizeText(v.title),
    description: normalizeText(v.description),
    category: normalizeText(v.category),
  }));
}

export function encodeReportV1(v: ReportContentV1): Uint8Array {
  return utf8(JSON.stringify({
    schema: "voicevault.report.content.v1",
    organizationId: v.organizationId,
    resourceId: v.resourceId.toLowerCase(),
    contentVersion: v.contentVersion,
    title: normalizeText(v.title),
    evidenceDetails: normalizeText(v.evidenceDetails),
    accusedPersonIds: canonicalAccused(v.accusedPersonIds),
  }));
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error("WEBCRYPTO_UNAVAILABLE");
  const digest = await subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export const hashIdeaV1 = (v: IdeaContentV1): Promise<string> => sha256Hex(encodeIdeaV1(v));
export const hashReportV1 = (v: ReportContentV1): Promise<string> => sha256Hex(encodeReportV1(v));

/** ciphertextHash = SHA-256 trên UTF-8 của chuỗi ciphertext đúng như gửi trong envelope (không decode base64). */
export const hashCiphertext = (ciphertext: string): Promise<string> => sha256Hex(utf8(ciphertext));

// Dựng DTO hợp lệ (hash khớp) cho test service.
import { randomUUID } from "node:crypto";
import { hashCiphertext, hashIdeaV1, hashReportV1 } from "../../../src/contracts/encoding";
import type { Actor } from "../../../src/contracts/api";

export const ORG = "org-demo";

export const actor = (subject: string, roles: string[] = ["employee"]): Actor => ({ subject, organizationId: ORG, roles });

export async function ideaDto(over: { title?: string; description?: string; publishCreditOnApproval?: boolean; id?: string } = {}) {
  const id = over.id ?? randomUUID();
  const title = over.title ?? "Giảm thời gian họp";
  const description = over.description ?? "Họp đứng 15 phút\r\nmỗi sáng";
  const category = "process";
  const ciphertext = `opaque-${id}`;
  return {
    contractVersion: "v1", id, title, description, category,
    publishCreditOnApproval: over.publishCreditOnApproval ?? true,
    identityEnvelope: {
      scheme: "TIDE_V1", tag: "idea_author", ciphertext, ciphertextHash: await hashCiphertext(ciphertext),
      binding: {
        contractVersion: "v1", organizationId: ORG, resourceKind: "IDEA", resourceId: id, contentVersion: 1,
        contentHash: await hashIdeaV1({ organizationId: ORG, resourceId: id, contentVersion: 1, title, description, category }),
        policyVersion: "p1-app-enforced",
      },
    },
  };
}

export async function reportDto(accusedPersonIds: string[], over: { id?: string } = {}) {
  const id = over.id ?? randomUUID();
  const title = "Phản ánh";
  const evidenceDetails = "Bằng chứng giả cho demo";
  const ciphertext = `opaque-${id}`;
  return {
    contractVersion: "v1", id, title, evidenceDetails, accusedPersonIds,
    identityEnvelope: {
      scheme: "TIDE_V1", tag: "report_id", ciphertext, ciphertextHash: await hashCiphertext(ciphertext),
      binding: {
        contractVersion: "v1", organizationId: ORG, resourceKind: "REPORT", resourceId: id, contentVersion: 1,
        contentHash: await hashReportV1({ organizationId: ORG, resourceId: id, contentVersion: 1, title, evidenceDetails, accusedPersonIds }),
        policyVersion: "p1-app-enforced",
      },
    },
  };
}

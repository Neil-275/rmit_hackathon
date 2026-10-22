# P1 core: bàn giao tích hợp

Branch `work/p1-core`, gốc `dccfd22`. Lõi server và LIVE runtime không phụ thuộc Next. Không có file nào trong `src/app/`, `public/`, `tests/p0/`.

## Chạy

```bash
npm install
npm run db:generate                 # sinh Prisma client (output mặc định node_modules/.prisma)
# .env (gitignore): DATABASE_URL="file:./local/dev.db"   -> prisma/local/dev.db
npm run db:push                     # tạo schema SQLite
npm run test:p1                     # vitest, 72 test; integration dùng file SQLite tạm riêng mỗi lần chạy
npm run build:bridge                # esbuild IIFE -> public/integration/runtime.generated.js (gitignore)
npx tsc -p tests/p1/tsconfig.json   # type-check (cần typescript 5.8.3, branch P0 đã có)
```

## Route nào gọi service nào

Bảng chuẩn nằm trong `ROUTES` của `src/contracts/api.ts`. Prefix `/api/v1`.

| Route | Service (`getServices().<tên>`) | Status thành công |
| --- | --- | --- |
| `GET /me` | `getMe(actor)` | 200 |
| `GET /directory` | `getDirectory(actor)` | 200 |
| `GET /ideas` | `listIdeas(actor, query)` | 200 |
| `POST /ideas` | `createIdea(actor, body)` | 201 |
| `GET /ideas/:id` | `getIdea(actor, id)` | 200 |
| `POST /ideas/:id/decision` | `decideIdea(actor, id, body)` | 200 |
| `GET /ideas/:id/identity-envelope` | `getIdeaIdentityEnvelope(actor, id)` | 200 |
| `GET /reports` | `listReports(actor, query)` | 200 |
| `POST /reports` | `createReport(actor, body)` | 201 (kể cả `AWAITING_ELIGIBLE_JURY`) |
| `GET /reports/:id` | `getReport(actor, id)` | 200 |
| `POST /reports/:id/unmask-requests` | `createUnmaskRequest(actor, id, body)` | 201 |
| `GET /reports/:id/identity-envelope?votingRequestId=` | `getReportIdentityEnvelope(actor, id, votingRequestId)` | 200 |
| `GET /voting-requests/mine` | `listMyVotingRequests(actor, query)` | 200 |
| `GET /voting-requests/:id` | `getVotingRequest(actor, id)` | 200 |
| `POST /voting-requests/:id/approvals` | `castVote(actor, id, body)` | 200 |
| `GET /council` | `getCouncil(actor)` | 200 |
| `GET /audit` | `listAudit(actor, query)` | 200 |

`query` là object từ `searchParams` (`cursor`, `limit`, `status`).

## Cách route gắn `actor`

```ts
import { getServices, } from "../../../server/services/default";   // import tương đối
import { httpStatusOf, unauthenticated } from "../../../server/services";

export async function POST(req: Request) {
  const actor = await authenticate(req);          // verify JWT TideCloak -> { subject, organizationId, roles }
  if (!actor) return Response.json(unauthenticated(), { status: 401 });
  const result = await getServices().createIdea(actor, await req.json().catch(() => null));
  return Response.json(result, { status: httpStatusOf(result, 201) });
}
```

- `actor.subject`/`organizationId`/`roles` lấy từ token, không lấy từ body. `organizationId` phải khớp `config/roster.json` (`org-demo`), khác thì `FORBIDDEN`.
- Role dùng: `employee` (nộp), `director` (quyết định ý tưởng, xem mọi phản ánh, audit), `auditor` (xem phản ánh, audit). Tư cách juror lấy từ roster, không phải role.
- `getServices()` (`src/server/services/default.ts`) giữ một `PrismaClient` qua hot reload. Route chỉ nên gọi service, không truy cập Prisma trực tiếp.
- Body JSON lỗi: truyền `null`, service trả `INVALID_REQUEST`.

## Runtime LIVE

`createVoiceVaultLive({ apiBase, auth, crypto, fetch? })` trong `src/integration/browser-runtime.ts`; bundle gán `window.createVoiceVaultLive`, `window.VoiceVaultLiveInfo` và `window.VoiceVaultLiveStubs`.

- Đủ 23 method, `contractVersion: "v1"`, `mode: "LIVE"`. Luôn resolve `ApiResult`. Lỗi mạng hoặc HTTP không phải JSON trả `POLICY_UNAVAILABLE` (retryable). Response sai shape trả `CONTRACT_MISMATCH`.
- `Authorization: Bearer` chỉ gửi tới `apiBase + path`; id được `encodeURIComponent`.
- `submitIdea`/`submitReport`: sinh UUID, canonical hash, `crypto.encryptIdentity`, POST DTO. Danh tính và `contact` chỉ nằm trong ciphertext.
- `revealIdentity(kind, id, votingRequestId?)`: GET envelope, kiểm `binding.resourceId` và `ciphertextHash`, gọi `crypto.decryptIdentity`, trả `IdentityView` tạm, không lưu.
- **Còn stub:** `AuthAdapter` và `CryptoAdapter` chỉ có `createStubAuth`/`createStubCrypto` (stub crypto chỉ base64, **không phải mã hóa**). Adapter Tide thật làm sau spike G1.
- **Ngoài phạm vi P1:** `endorseIdea`, `listCouncilChanges`, `submitCouncilChange`, `applyCouncilChange` trả `POLICY_UNAVAILABLE` (`APP`, `retryable: false`).

## Giới hạn đã biết

- Quorum, quyền mở envelope và mọi kiểm tra đều **APP-enforced**; chưa có proof G3/G4, chưa có Fabric. `SubmitApprovalRequest.proof` là optional và không được kiểm.
- `publicCredit` luôn `null` vì chưa có artifact G4.
- Không có idempotency table hay outbox. Retry `POST /ideas` và `POST /reports` cùng id và cùng nội dung trả lại bản cũ (không bốc lại hội đồng); cùng id mà khác nội dung trả `VERSION_CONFLICT`.
- `EXPIRED` được tính lúc đọc, không ghi lại DB. `READY` đóng việc nhận phiếu.
- Một phản ánh có tối đa một yêu cầu mở đang hoạt động; yêu cầu mới sau DENIED/EXPIRED dùng lại assignment cũ.
- `listReports` và `listMyVotingRequests` lọc quyền trong bộ nhớ (dữ liệu demo nhỏ). Cursor là offset.
- Mọi người cùng org đều xem được danh sách ý tưởng (kể cả `UNDER_REVIEW`).
- Roster/persona/directory là placeholder trong `config/roster.json` (3 juror, juror 3 independent). Tố `subject-juror-*` sẽ làm còn dưới 3 người: report vào `AWAITING_ELIGIBLE_JURY`. Thay bằng subject Tide thật trước demo.
- `npm install` báo 7 lỗ hổng từ cây dependency; theo handoff không chạy `npm audit fix`.

## Contract cần chốt

Field P1 thêm mà `tests/p0` chưa khẳng định. Đều optional, cần Tùng đối chiếu với fixture P0:

1. `SessionView`: `subject`, `displayName`, `organizationId` (optional). `roles` là bắt buộc vì mock test đọc `session.data.roles`.
2. `IdeaView`: `contentHash`, `createdAt`, `decidedAt`, `decisionReason` (optional).
3. `ReportView`: `evidenceDetails`, `councilVersion`, `councilRosterHash`, `voterCount`, `quorumRequired`, `contentHash`, `createdAt` (optional). `votingRequestId` là `null` cho tới khi có yêu cầu mở, kể cả khi `INVESTIGATING`.
4. `VotingRequestView`: tests/p0 dùng `id, operation, resourceId, state, voterCount, quorumRequired, voters[{subject, independent, hasVoted}], validApprovals, independentApproved, expiresAt`. P1 thêm `resourceKind` (bắt buộc), `version`, `recipientSubject`, `purpose`, `councilVersion`, `capabilities`, `voters[].displayName` (optional).
5. `UnmaskRequestView` = `VotingRequestView` + `votingRequestId` + `reportId`; trong P1 `id === votingRequestId`.
6. `AuditEventView`: `id, occurredAt, action, resourceKind, resourceId, source, result, requestId?`. tests/p0 chỉ dùng `resourceId` và `source`.
7. `IdentityView`: `resourceKind, resourceId, subject, displayName, contact?`.
8. Form input: `decideIdea(id, { decision: "APPROVE" | "REJECT", reason, expectedVersion })`, `createUnmaskRequest(reportId, { recipientSubject, purpose })`, `castVote(id, { decision: "APPROVE" | "DENY", reason })`, `submitReport({ title, evidenceDetails, accusedPersonIds, contact? })`. Nếu fixture P0 dùng tên khác thì cần sửa một bên.
9. Mã lỗi của các trường hợp mà test chưa quy định: vote lần hai trả `FORBIDDEN`; vote vào request đã đóng trả `VERSION_CONFLICT`; envelope ý tưởng khi còn `UNDER_REVIEW` trả `VERSION_CONFLICT`, khi không có consent hoặc bị `REJECTED` trả `FORBIDDEN`; envelope phản ánh khi `DENIED` trả `FORBIDDEN`.
10. Capability string: session `submitIdea, submitReport, decideIdea, revealIdeaIdentity, viewAudit, vote`; idea `decide, revealIdentity`; report `requestUnmask`; voting `vote, revealIdentity`.

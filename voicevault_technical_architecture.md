# VoiceVault — Kiến trúc kỹ thuật cho hai người code song song

> Phạm vi: Sealed-Credited Ideas + Protected Reports, RMIT Hackathon — UNLOCKED.
> Trạng thái: bản thiết kế để triển khai. Repository hiện chưa có ứng dụng, script hay kiểm thử tích hợp; các đường dẫn và endpoint bên dưới là đầu ra cần tạo.
> Cách dùng: hai người đọc mục 1–5 cùng nhau, tạo baseline rồi làm theo phân công A/B. Quy trình merge và chạy chung ở mục 12–14.
> Tài liệu này thay thiết kế kỹ thuật cũ. Trước nộp bài phải đối chiếu README/Idea.MD với kết quả thực tế, không giữ các cam kết mạnh hơn bằng chứng đã có.

## Mục lục

- [1. Quyết định MVP và tiêu chí bảo mật](#1-quyết-định-mvp-và-tiêu-chí-bảo-mật)
- [2. Kiến trúc và ranh giới tin cậy](#2-kiến-trúc-và-ranh-giới-tin-cậy)
- [3. Phân công và quyền sở hữu file](#3-phân-công-và-quyền-sở-hữu-file)
- [4. Baseline trước khi tách branch](#4-baseline-trước-khi-tách-branch)
- [5. Contract v1 dùng chung](#5-contract-v1-dùng-chung)
- [6. API, auth và xử lý lỗi](#6-api-auth-và-xử-lý-lỗi)
- [7. State machine và luồng nghiệp vụ](#7-state-machine-và-luồng-nghiệp-vụ)
- [8. SDK và chính sách TideCloak](#8-sdk-và-chính-sách-tidecloak)
- [9. Hash và bằng chứng tác giả](#9-hash-và-bằng-chứng-tác-giả)
- [10. Xung đột lợi ích và chọn hội đồng](#10-xung-đột-lợi-ích-và-chọn-hội-đồng)
- [11. Database, transaction và migration](#11-database-transaction-và-migration)
- [12. Code song song và Git merge chi tiết](#12-code-song-song-và-git-merge-chi-tiết)
- [13. Chạy hệ thống sau merge](#13-chạy-hệ-thống-sau-merge)
- [14. Quyền riêng tư và audit](#14-quyền-riêng-tư-và-audit)
- [15. Prompt và mẫu bàn giao](#15-prompt-và-mẫu-bàn-giao)
- [16. Kiểm thử, demo và điều kiện hoàn thành](#16-kiểm-thử-demo-và-điều-kiện-hoàn-thành)
- [17. Nguồn kỹ thuật](#17-nguồn-kỹ-thuật)

## 1. Quyết định MVP và tiêu chí bảo mật

| Chủ đề | Quyết định |
| --- | --- |
| Phân công | A: UI + browser crypto. B: API + DB + IAM/policy + điều phối tích hợp |
| Kiến trúc | Một Next.js App Router + TypeScript ở root repository, không hai scaffold/backend riêng |
| Database | SQLite + Prisma; bỏ JSON store để thống nhất transaction/migration |
| Phiên bản | Pin bản Next.js/React/SDK đã scaffold và smoke test thành công; không giữ “14+” mơ hồ |
| ORM cho hướng dẫn này | Prisma CLI và @prisma/client cùng 6.19.0; nâng major là thay đổi baseline riêng |
| Contract | DTO/schema/fixture v1 dùng chung, validate runtime |
| Danh sách hội đồng | Chốt roster có version ngay khởi tạo; mọi thay đổi sau đó phải qua vote |
| Người được vote | Bốc ngẫu nhiên cả số lượng N và N người từ roster hiện hành sau lọc CoI; mặc định N từ 3 tới min(5, eligibleCount) |
| Ngưỡng thông qua | T = ceil(2 × N / 3) APPROVE khác người, có ít nhất một independent approver |
| Đổi hội đồng | Đề xuất thêm/xóa/đổi vai → cùng pipeline vote như phản ánh → verify và áp dụng nguyên tử; chưa áp dụng thì roster cũ còn hiệu lực |
| Thiếu người hợp lệ | AWAITING_ELIGIBLE_JURY; không hạ minVoters hoặc thay N/T sau khi đã bốc |
| Nội dung báo cáo | Dữ liệu giả, lưu rõ trong prototype; API giới hạn người đọc |
| Công khai tác giả | Sau APPROVED + consent đã ràng buộc với ý tưởng + bằng chứng hợp lệ |
| Ý tưởng bị từ chối | Terminal, không tạo yêu cầu mở; không hứa xóa khóa/niêm phong vĩnh viễn |
| Reporter plaintext | Chỉ trong bộ nhớ phiên recipient; không lưu lại database |
| Policy chưa kiểm chứng | POLICY_UNAVAILABLE, không fallback sang bộ đếm DB/biến UI |
| Persona demo | Các phiên đăng nhập thật, không chỉ thay activeRole trên giao diện |

Phạm vi này thay phần MVP cũ chỉ chọn Credited trong Idea.MD. Cả hai người dùng một cách hiểu khi triển khai.

### 1.1. Gate kỹ thuật phải có bằng chứng

| Gate | Cần chứng minh | Owner | Chưa đạt |
| --- | --- | --- | --- |
| G1 | An mã hóa, recipient khác mở được qua cơ chế chia sẻ thực sự được hỗ trợ | A + B | Khóa reveal, ghi cross-user chưa được hỗ trợ |
| G2 | Có role vẫn không mở được hồ sơ chưa duyệt/đã từ chối bằng lời gọi trực tiếp | B | Không cấp decrypt role rộng để lách |
| G3 | Approval/grant cho phản ánh và đổi hội đồng gắn đúng resource/payload, roster version, N/T, assignment, recipient, expiry và policy | B | Row phiếu chỉ hiển thị tiến độ, chưa cấp quyền mật mã |
| G4 | Proof chứng minh tác giả xác thực, không chỉ tên tự khai trong JSON | A + B | Không hiển thị “Cryptographically Verified” |
| G5 | QEA và policy không cho đổi roster/quyền trực tiếp, tái bootstrap hoặc áp thay đổi chưa có vote hợp lệ | B | Giới hạn cam kết, ghi rõ đường chưa kiểm chứng |

Mỗi gate ghi PASS/FAIL/NOT RUN, test case, version và request ID không nhạy cảm. Modal đỏ không thay bằng chứng thao tác thật.

## 2. Kiến trúc và ranh giới tin cậy

~~~mermaid
flowchart LR
    U[Người dùng] --> C[A: UI + browser crypto]
    C -->|JWT + DTO v1 + ciphertext| S[B: API + domain services]
    S --> D[(SQLite)]
    C <--> T[TideCloak SDK / IAM]
    T <--> F[Fabric + policy]
    S --> P[B: Policy adapter]
    P -->|Yêu cầu và bằng chứng| F
    F -->|Kết quả theo phiên hợp lệ| C
~~~

Sơ đồ là ranh giới trách nhiệm. Flow gọi SDK/policy cụ thể phải xác nhận ở G1–G3, không phải khẳng định một API Tide chưa được kiểm chứng.

Ba lớp độc lập:

1. Authentication xác minh token, ứng dụng, tổ chức và phiên.
2. Application authorization kiểm tra role, quyền đọc, jury, trạng thái và version.
3. Cryptographic authorization kiểm tra bằng chứng theo từng tài nguyên ngay tại dịch vụ mật mã. Bỏ qua API/UI hoặc sửa row DB không được tạo request giải mã hợp lệ.

Chỉ có lớp 1/2 thì chưa chống backend độc hại. Policy không tin một cờ approved hoặc assignment backend tự sửa mà không có nguồn bằng chứng thích hợp.

Giới hạn phải công bố:

- Backend nhận JWT vẫn biết người gửi tại lúc request. Không lưu sub chỉ giảm liên kết trong DB, chưa ẩn danh trước backend.
- Frontend bị sửa có thể ghi plaintext trước mã hóa; tính toàn vẹn mã client là giả định cần xét khi admin kiểm soát triển khai.
- Người đã xem có thể chụp/tiết lộ. Thu hồi quyền không lấy lại nội dung đã biết.
- Một nhóm đủ T = ceil(2 × N / 3) người đủ điều kiện thông đồng có thể thông qua; không loại bỏ mọi thông đồng.
- Mã hóa không ngăn xóa hồ sơ, ngừng dịch vụ hoặc suy luận người viết từ nội dung.
- Directory, roster/version, kết quả bốc N/người, proof và policy phải có nguồn tin cậy tương ứng threat model, không chỉ được lưu trong DB.

## 3. Phân công và quyền sở hữu file

| Người | Việc tự chủ | Đầu ra bàn giao |
| --- | --- | --- |
| A — UI/client | Shell, portal, màn hình hội đồng/đề xuất đổi roster và VotePanel dùng chung, API client, browser SDK adapter, UX lỗi, test UI/E2E | UI theo DTO v1, wrapper đúng SDK, không persist plaintext, kết quả probe G1 |
| B — server/integration | Contract, auth, API/service, Prisma, council roster/change vote, directory/CoI/random N/jury, policy adapter, QEA, CI | Endpoint thật, migration, fixture, proof/deny, kết quả G2/G3/G5, integration chạy được |
| Cùng làm | Baseline, cross-user probe, origin proof, bypass tests, review demo | Quyết định có bằng chứng và contract thống nhất |

B điều phối merge, A review tác động tới client và kết quả tích hợp. Nếu policy là nút thắt, A hỗ trợ thử bằng phiên browser thật sau khi UI skeleton xong.

### 3.1. Cấu trúc đích

~~~text
repository-root/
├── voicevault_technical_architecture.md       B điều phối thay đổi đã thống nhất
├── package.json, package-lock.json           B: single writer
├── .env.example, .gitignore, .github/         B
├── next.config.*, tsconfig.*, eslint.*       B
├── prisma/                                  B
│   ├── schema.prisma, seed.ts, migrations/
│   └── local/                               DB local, gitignored
├── config/                                  B: cấu hình mẫu không bí mật
├── src/
│   ├── app/
│   │   ├── layout.tsx, page.tsx, globals.css  A
│   │   ├── auth/redirect/                    A
│   │   └── api/v1/                          B
│   ├── components/                          A
│   ├── client/                              A
│   │   ├── api.ts, identityCrypto.ts
│   │   ├── tidecloakProvider.tsx
│   │   └── mocks/                           chỉ dev, nhãn SIMULATED
│   ├── contracts/                           B giữ file, hai người duyệt
│   │   ├── v1.ts, schemas.ts, fixtures.ts
│   │   └── contentEncoding.ts               client/server dùng chung
│   └── server/                              B, không import vào client
│       ├── auth.ts, config.ts, db.ts
│       └── services/, jury/, policy/, audit/
├── tests/
│   ├── unit/client/, ui/, e2e/               A
│   └── unit/server/, contracts/, integration/ B
└── docs/integration/                        handoff riêng, B ghi kết quả merge
~~~

Quy tắc:

- Một file chỉ một người sửa tại một thời điểm. Muốn đổi file bên kia, bàn giao tên file + lý do + thời điểm trước.
- A yêu cầu dependency qua B; B sửa manifest/lockfile, merge baseline nhỏ rồi A nhận. Không để hai agent cùng sửa lockfile.
- Contract đổi trước consumer. Không dùng any để che lệch DTO hoặc sao chép type vào UI.
- Hai người/agent dùng hai checkout/worktree riêng, env/node_modules/DB/port riêng; không đổi branch trong cùng working tree.
- Không tự đổi framework, package manager, route convention hoặc major dependency giữa milestone.

## 4. Baseline trước khi tách branch

### 4.1. Foundation chung

1. B kiểm tra Node/npm/Docker/Git trên hai máy. Chọn cùng Node LTS đáp ứng scaffold/dependencies; ghi bản thực vào .nvmrc và engines sau smoke test.
2. Scaffold theo Tide Quickstart vào thư mục tạm rồi đưa source vào root repo hiện có, giữ tài liệu và .git; không tạo repo Git lồng nhau.
3. Hoàn tất enrollment/license/realm. Chốt và xác minh roster hội đồng ban đầu cùng policy chọn N/ngưỡng qua ceremony bootstrap một lần ở mục 10.1. Container chạy chưa chứng minh auth hoạt động.
4. Pin bản Next.js/React/SDK/tooling đã chạy thành công, Prisma CLI/client cùng 6.19.0 cho SQLite/CLI trong hướng dẫn. Đây không phải khẳng định Prisma mới nhất.
5. B tạo contracts/schema/fixtures, skeleton API, scripts/test config và migration đầu. A tạo shell/client; cùng kiểm tra client/server import boundary.
6. Cùng thử token thật/token giả và SDK smoke test; gate chưa đạt vẫn NOT RUN/FAIL, không giả thành công.
7. Commit/push một baseline lên integration/voicevault; hai branch từ cùng SHA.

B ghi manifest không nhạy cảm tại docs/integration/baseline.json: baseline SHA, contract version, Node/npm và dependency version, image digest, realm/client ID, policy/contract ID, directory version, council roster hash/version, minVoters/maxVoters và bootstrap receipt. Ghi kết quả G1–G5 tại docs/integration/gates.md, tách kết quả mock và live; không lưu token, credential hoặc reporter plaintext trong các file này.

Quickstart có thể khởi tạo bằng latest; sau smoke test lưu image digest/tag thực tế vào manifest. Hai máy không tự kéo hai bản khác nhau rồi coi là cùng môi trường. [Quickstart](https://docs.tide.org/get-started/Tidecloak%20Quickstart).

### 4.2. Environment

- Commit .env.example không bí mật; mỗi checkout tạo .env riêng, gitignored. Prisma 6 và Next.js cùng nạp .env root theo baseline.
- DATABASE_URL=file:./local/voicevault-dev.db được hiểu theo vị trí Prisma schema; tạo prisma/local trước migrate. Mỗi checkout có DB riêng.
- Cấu hình browser chỉ chứa URL/issuer, realm, client ID và public JWK nếu cần; không admin token/secret trong NEXT_PUBLIC_* hoặc bundle client.
- Đăng ký callback đúng origin/cổng của hai máy. A 3000, B có thể 3001; E2E trỏ rõ instance.
- B giữ manifest tags/roles/policy và thông báo mọi thay đổi realm; không sửa console âm thầm khi A đang test.
- Không commit .env, DB/WAL/SHM, token, private key, enrollment URL nhạy cảm hoặc realm export chứa credential.

### 4.3. Script phải tạo ở M0

Chưa có các script này trong repo hiện tại. B phải tạo và xác minh trước khi dùng ở runbook merge.

| Script | Trách nhiệm |
| --- | --- |
| dev/build/start | Next.js theo scaffold đã pin |
| typecheck | tsc --noEmit |
| lint | ESLint đã cấu hình; không mặc định mọi Next đều có next lint |
| test:unit | Vitest: encoding, thuật toán, service/client adapter |
| test:contracts | DTO/schema/fixture success/error và hash vectors |
| test:integration | API + DB test riêng; ghi rõ case cần realm thật |
| test:security:live | G1–G5 với Tide thật; thiếu cấu hình báo NOT RUN/không thành công |
| test:e2e | Playwright, phiên riêng theo persona |
| db:validate/db:generate | prisma validate / prisma generate |
| db:migrate:dev | prisma migrate dev, chỉ B tạo migration |
| db:migrate:deploy | prisma migrate deploy, áp migration đã commit |
| db:seed | tsx prisma/seed.ts, idempotent trên DB demo đã chỉ định |
| check | typecheck + lint + unit + contracts + build; không thay live tests |

npm ci yêu cầu manifest/lockfile khớp, không tạo lockfile mới. [npm ci](https://docs.npmjs.com/cli/v11/commands/npm-ci/).

## 5. Contract v1 dùng chung

B giữ src/contracts; A review cách dùng trước tách branch. UUID browser tạo trước mã hóa, server validate/chống trùng và không đổi ID đã ràng buộc trong proof. Display name không phải ID phân quyền. Mọi request/response validate runtime bằng schema chung; type không thay validation.

Thay contract phải có schema + fixture + contract test + ví dụ request/response; merge trước consumer. Breaking change có version mới hoặc chuyển đồng bộ cùng milestone.

### 5.1. Type lõi

Đây là interface nội bộ cần triển khai, không phải API có sẵn của Tide.

~~~typescript
export type ResourceKind = "IDEA" | "REPORT" | "COUNCIL_CHANGE";
export type VotingPurpose = "REVEAL_REPORT_IDENTITY" | "CHANGE_COUNCIL";
export type Enforcement = "APP" | "FABRIC" | "SIMULATED";

export interface ResourceBinding {
  contractVersion: "v1";
  organizationId: string;
  resourceKind: ResourceKind;
  resourceId: string;
  contentVersion: number;
  contentHash: string;
  policyVersion: string;
}
export interface IdentityEnvelope {
  scheme: "TIDE_V1";
  tag: "idea_author" | "report_id";
  ciphertext: string;
  ciphertextHash: string;
  binding: ResourceBinding;
}
export interface CreateIdeaRequest {
  contractVersion: "v1";
  id: string;
  title: string;
  description: string;
  category: string;
  publishCreditOnApproval: boolean;
  identityEnvelope: IdentityEnvelope;
}
export interface CreateReportRequest {
  contractVersion: "v1";
  id: string;
  title: string;
  evidenceDetails: string;
  accusedPersonIds: string[];
  identityEnvelope: IdentityEnvelope;
}
export interface ApprovalContext {
  requestId: string;
  binding: ResourceBinding;
  payloadHash: string;
  ciphertextHash?: string; // Bắt buộc REVEAL_REPORT_IDENTITY; không dùng với CHANGE_COUNCIL.
  operation: VotingPurpose;
  votingAssignmentHash: string;
  councilVersion: number;
  councilRosterHash: string;
  voterCount: number;
  quorumRequired: number;
  recipientSubject: string; // Recipient identity hoặc executor đề xuất; ràng buộc trong proof.
  purpose: string;
  nonce: string;
  expiresAt: string;
}
export interface SubmitApprovalRequest {
  contractVersion: "v1";
  votingRequestId: string;
  decision: "APPROVE" | "DENY";
  reason: string;
  proof: string;
}
export interface CouncilMemberSpec {
  subject: string;
  independent: boolean;
  active: boolean;
  membershipRole: "MEMBER" | "CHAIR";
}
export interface VotingSelectionPolicy {
  minVoters: number;
  maxVoters: number;
}
export interface CreateCouncilChangeRequest {
  contractVersion: "v1";
  id: string;
  expectedCouncilVersion: number;
  reason: string;
  proposedMembers: CouncilMemberSpec[]; // Toàn roster đích; server tính diff/hash.
  proposedSelectionPolicy: VotingSelectionPolicy; // Toàn policy đích, kể cả khi không đổi.
}
export type ApiResult<T> =
  | { ok: true; data: T; requestId: string; contractVersion: "v1" }
  | {
      ok: false;
      error: {
        code: string; message: string;
        enforcement: Enforcement; retryable: boolean;
      };
      requestId: string; contractVersion: "v1";
    };
~~~

Binding rõ chỉ hỗ trợ routing/check sơ bộ; bản tương ứng phải nằm trong payload được bảo vệ/xác thực. Server tính lại content/ciphertext hash theo encoding đã chốt. Proof là artifact G3 đã kiểm chứng, không phải chuỗi tùy ý/HMAC backend tự cấp. Juror lấy từ token và đối chiếu signer, không lấy từ body. Schema IdentityEnvelope chỉ chấp nhận binding IDEA/REPORT; COUNCIL_CHANGE không có identity envelope. Với vote đổi hội đồng, payloadHash ràng buộc roster đích/diff/version; với reveal, payloadHash ràng buộc context mở và ciphertextHash bắt buộc.

### 5.2. View phải chốt ở M0

| View | Ngữ nghĩa |
| --- | --- |
| IdeaView | Nội dung theo quyền, status/version, endorsement, consent, capabilities server tính; public credit sau xác minh |
| ReportView | Nội dung theo quyền, roster version/hash, N/T và assignment bất biến, tiến độ approval; list không reporter ID/plaintext/envelope |
| UnmaskRequestView | votingRequestId, context hash/state/version, N/T, valid approval count, independent approval, expiry |
| CouncilView | Roster hiện hành với ID/role/independent, version/hash; UI không có thao tác sửa trực tiếp |
| CouncilChangeView | Roster/version gốc, diff/roster đích, votingRequestId, N/T, assignment, trạng thái và kết quả apply; chưa apply không đổi CouncilView |
| DirectoryView | ID/display name để chọn; không email/sơ đồ nhân sự đầy đủ cho mọi người |
| RevealChallenge | Context và dữ liệu công khai cho flow đã kiểm chứng; không chỉ allowDecrypt=true |
| AuditEventView | Nguồn, kết quả, request/resource ID an toàn; không danh tính người nộp |

Capability giúp UI hiển thị, không thay quyết định mật mã. Không trả nguyên Prisma object cho client.

### 5.3. Mock để A làm độc lập

Mock API client implement cùng interface/fixtures v1, chỉ dev, nhãn “Dữ liệu mô phỏng” và SIMULATED. Có case success, N=3/4/5 với T tương ứng, token lỗi, pending, thiếu jury, expired, tamper, unavailable và thay đổi roster chưa có hiệu lực. Không tự fallback khi API thật lỗi. Live demo/live test phải tắt mock và báo lỗi nếu phát hiện mock đang dùng.

## 6. API, auth và xử lý lỗi

Prefix /api/v1; mọi endpoint trừ health đều auth. List phân trang tối đa 50, scope organization và quyền từng hồ sơ.

| Method/path | Trách nhiệm |
| --- | --- |
| GET /health | Liveness không nhạy cảm, không config/token |
| GET /me | Phiên thật, organization và capabilities |
| GET /directory | ID có thể chọn trong cùng org |
| GET /ideas | IdeaView[], không identity envelope |
| POST /ideas | CreateIdeaRequest, validate/binding/idempotency/persist thật |
| POST /ideas/:id/endorse | Manager, expectedVersion, actor từ token |
| POST /ideas/:id/decision | Director, decision/reason/expectedVersion và decision artifact |
| POST /ideas/:id/reveal-challenges | APPROVED + consent + verified decision, recipient/purpose |
| GET /reports | Chỉ hồ sơ được phép đọc, không bảng công khai |
| POST /reports | Multi-accused, jury chọn một lần, persist thật |
| POST /reports/:id/unmask-requests | Assigned juror, recipient/purpose/version; chưa mở |
| GET /unmask-requests/:id | View theo quyền, không plaintext |
| GET /voting-requests/:id | Vote context/snapshot/N/T và tiến độ theo quyền, dùng chung hai luồng |
| POST /voting-requests/:id/approvals | SubmitApprovalRequest; verify proof/membership/context + transaction, dùng chung reveal và đổi hội đồng |
| POST /unmask-requests/:id/reveal-challenges | Adapter xác minh bằng chứng rồi tạo challenge thật |
| GET /resources/:kind/:id/identity-envelope | Challenge/request hợp lệ, đúng recipient, ciphertext không plaintext |
| GET /council | Roster/version/hash hiện hành, không endpoint PATCH roster trực tiếp |
| POST /council/change-requests | CreateCouncilChangeRequest; snapshot roster cũ, bốc N/người một lần, tạo VotingRequest |
| GET /council/change-requests/:id | Diff/roster đích, N/T, tiến độ vote, apply state |
| POST /council/change-requests/:id/apply | Executor hợp lệ; verify threshold/policy/version, outbox/QEA nếu cần, không tự ghi đè roster |
| POST /governance/role-change-requests | QEA adapter cho thay đổi whitelist; thay đổi liên quan council bắt buộc tham chiếu proposal đã có vote hợp lệ, không đường tắt |
| GET /audit | Role audit, redaction, pagination |

POST tạo resource có Idempotency-Key UUID gắn org/scope/payload hash: cùng key/body trả kết quả cũ, body khác trả IDEMPOTENCY_CONFLICT. Không lưu subject/JWT người nộp trong idempotency record; persist cùng transaction để retry không tạo lại report/assignment. Decision, approval, unmask/council-change/governance operation cũng idempotent. Tạo lại cùng payload đổi council trên cùng base version khi đề xuất còn hoạt động phải trỏ cùng proposal/voting assignment hoặc bị từ chối, không dùng UUID mới để bốc lại. External call có outbox/request ID, không giữ DB transaction khi chờ mạng.

| HTTP/code | Ngữ nghĩa |
| --- | --- |
| 400 INVALID_REQUEST | Schema/UUID/encoding sai, không echo payload nhạy cảm |
| 401 UNAUTHENTICATED | Token thiếu/giả/hết hạn/sai issuer/client |
| 403 FORBIDDEN | App từ chối; nguồn APP, không gọi là Fabric |
| 404 NOT_FOUND | Không có hoặc không được biết tồn tại, tránh cross-org disclosure |
| 409 VERSION_CONFLICT | Refresh trước thao tác lại |
| 409 COUNCIL_VERSION_CONFLICT | Roster đã đổi; proposal cũ thành STALE, không áp diff/phiếu lên version mới |
| 403 COUNCIL_VOTE_REQUIRED | Cố đổi membership/role/independent trực tiếp hoặc bỏ qua vote |
| 409 BOOTSTRAP_ALREADY_COMPLETED | Cố khởi tạo lại roster để vượt quy trình vote |
| 409 QUORUM_PENDING | Giữ khóa, không lặp decrypt |
| 409 IDEMPOTENCY_CONFLICT | Key cũ/body khác |
| 409 INSUFFICIENT_ELIGIBLE_JURORS | Đang chờ jury, không hạ ngưỡng |
| 410 APPROVAL_EXPIRED | Request mới, không dùng phiếu cũ |
| 422 INTEGRITY_MISMATCH | Không mở/không verified credit |
| 403 POLICY_DENIED | Chỉ FABRIC khi dịch vụ thật trả deny đã xác nhận |
| 503 POLICY_UNAVAILABLE | Adapter chưa kiểm chứng/dịch vụ lỗi; giữ khóa |

POST report lưu được nhưng thiếu jury trả 201 + AWAITING_ELIGIBLE_JURY, không lỗi khiến user tưởng chưa lưu. Mã insufficient dùng khi thử lập jury/yêu cầu mở hồ sơ đang chờ.

### 6.1. Snippet auth đã sửa

Khung auth dưới chưa thay route hoàn chỉnh: B còn thêm validation/org scope/persistence/error mapping.

~~~typescript
import "server-only";
import { verifyTideCloakToken } from "@tidecloak/verify";
import { tidecloakServerConfig } from "./config";

export async function authenticateEmployee(req: Request) {
  const match = /^Bearer\s+(\S+)$/i.exec(req.headers.get("authorization") ?? "");
  if (!match) return null;
  const payload = await verifyTideCloakToken(
    tidecloakServerConfig, match[1], ["employee"],
  );
  if (!payload) return null;
  // Claim riêng của app phải cấu hình mapper/test; không mặc định Tide có sẵn.
  if (typeof payload.sub !== "string" || typeof payload.organization_id !== "string") {
    return null;
  }
  return { subject: payload.sub, organizationId: payload.organization_id };
}
~~~

M0 cấu hình employee role cho persona được nộp. Director/juror/admin route kiểm tra thêm quyền; allowedRoles có ngữ nghĩa OR, không thay điều kiện AND. Prefix Bearer không xác thực. [Verify JWT](https://docs.tide.org/Languages/NextJS/VerifyJWT).

Nếu chọn cookie phải có CSRF/cookie policy. Bật DPoP phía client chưa đủ; resource server phải verify proof tương ứng.

## 7. State machine và luồng nghiệp vụ

### 7.1. Ý tưởng

~~~text
UNDER_REVIEW -> ENDORSED -> APPROVED
      |             |
      +-----------> REJECTED
APPROVED + consent + verified decision
  -> challenge -> browser decrypt/verify -> public credit theo consent
~~~

MVP yêu cầu endorse trước approve; REJECTED terminal, không reopen. APPROVED không đồng nghĩa đã mở/công khai. Transition kiểm tra role/org/expectedVersion trong transaction.

1. A lấy org từ phiên, sinh UUID, canonicalize/hash nội dung.
2. Payload bảo vệ gồm binding, tác giả xác thực, consent và origin proof G4. Nếu tự công khai lúc approve, user đồng ý rõ từ lúc nộp.
3. B validate/hash/persist thật và trả receipt, không submitter FK.
4. Manager endorse riêng; không PATCH tác giả/ciphertext/nội dung đã nộp.
5. Director tạo decision artifact theo cơ chế đã xác minh; sửa status không tạo proof hợp lệ.
6. Recipient thực hiện challenge; browser validate schema/proof/binding/hash trước hiện tên.
7. Public credit chỉ lưu khi có consent và artifact G4 xác minh được, không tin tên tùy ý browser gửi. Chưa có thì chỉ hiện trong phiên hợp lệ và công bố ledger chưa được kiểm chứng.

REJECTED không sinh yêu cầu mở trong MVP. UI ghi “Không công khai danh tính khi từ chối”, không “SEALED FOREVER” hoặc “Zero Ridicule”.

### 7.2. Báo cáo

~~~text
Report: nhận -> AWAITING_ELIGIBLE_JURY hoặc INVESTIGATING -> RESOLVED
UnmaskRequest: COLLECTING -> READY -> GRANTED
                    |         |
                    +-------> EXPIRED
                    +-------> DENIED
~~~

READY là tiến độ, chưa là quyền mật mã. GRANTED sau adapter verify/cấp authorization thật. Timeout external call cần đối soát request ID; grant không chứng minh browser đã xem plaintext.

1. A gửi evidence giả, nhiều accused IDs và envelope, không department tự khai.
2. B lấy roster hội đồng đã chốt từ đầu, resolve directory/CoI và snapshot policy/roster. Bốc N trong khoảng hợp lệ rồi bốc N người một lần; khóa N, danh sách và T = ceil(2 × N / 3), hoặc lưu chờ.
3. Assigned juror tạo UnmaskRequest liên kết VotingRequest, gắn resource/binding, ciphertext/assignment/roster hash/version, N/T, recipient/purpose/nonce/expiry. Các yêu cầu mở trên cùng assignment của phản ánh không bốc lại N/người để tìm hội đồng thuận lợi.
4. Mỗi juror xem cùng context, phiên riêng, approve/deny bằng proof verify được. MVP: một DENY hợp lệ kết thúc request, xem lại cần request mới.
5. Đủ T APPROVE từ những người khác nhau có ít nhất một independent tạo READY; adapter submit bằng chứng. Fabric tự từ chối dưới ngưỡng/context sai; người không vote/offline không làm giảm mẫu số N.
6. Recipient đúng context/phiên mở; plaintext không gửi API/audit.
7. Expiry hoặc đổi assignment/policy/content làm phiếu cũ không còn áp dụng; không reuse cho request mới. Khi roster hiện hành đổi, request đang chờ được đánh dấu STALE và chặn grant mới theo mục 10.3.

## 8. SDK và chính sách TideCloak

### 8.1. Ma trận quyền mục tiêu

| Persona | Nghiệp vụ | Điều kiện mở |
| --- | --- | --- |
| An/employee | Nộp hồ sơ | Không đọc identity người khác |
| Binh/manager | Ý tưởng được giao, endorse | Không mở tác giả/reporter |
| Chi/director | Quyết định ý tưởng | APPROVED + consent + proof, đúng recipient |
| Dave/it_admin | Vận hành, đề xuất đổi quyền | Không tự có decrypt |
| Eva/Frank/Grace/Henry/Iris | Roster hội đồng được chốt lúc bootstrap | Chỉ assignment ngẫu nhiên đúng N/T, không CoI, đủ proof, đúng recipient |
| Thành viên được đề xuất thêm | Chưa có quyền hội đồng | Chỉ có quyền sau proposal đã vote đủ và APPLIED |
| Governance admins | Đổi IAM/policy | Không mặc nhiên là jury/recipient |

Không cấp decrypt role theo tag cho toàn pool/director rồi dựa vào UI trì hoãn gọi. Primitive tag không thực thi resource policy thì dùng cơ chế được Tide hỗ trợ và chứng minh, hoặc giữ khóa.

### 8.2. Wrapper SDK phía A

SDK reference dùng mảng item. Wrapper này chỉ chuẩn hóa primitive tag, không tự thêm quorum/state policy và không là reveal hoàn chỉnh. Dùng smoke test hoặc khi G1/G2 xác nhận flow phù hợp.

~~~typescript
type EncryptItem = { data: string | Uint8Array; tags: string[] };
type DecryptItem = { encrypted: string; tags: string[] };
type EncryptFn = (items: EncryptItem[]) => Promise<string[]>;
type DecryptFn = (items: DecryptItem[]) => Promise<(string | Uint8Array)[]>;

export async function encryptJson(
  encrypt: EncryptFn, payload: unknown, tag: string,
): Promise<string> {
  const values = await encrypt([{ data: JSON.stringify(payload), tags: [tag] }]);
  if (values.length !== 1 || typeof values[0] !== "string") {
    throw new Error("INVALID_CRYPTO_RESPONSE");
  }
  return values[0];
}
export async function decryptJson<T>(
  decrypt: DecryptFn, ciphertext: string, tag: string,
  validate: (value: unknown) => T,
): Promise<T> {
  const values = await decrypt([{ encrypted: ciphertext, tags: [tag] }]);
  if (values.length !== 1) throw new Error("INVALID_CRYPTO_RESPONSE");
  const value = values[0];
  const text = typeof value === "string"
    ? value : new TextDecoder("utf-8", { fatal: true }).decode(value);
  return validate(JSON.parse(text));
}
~~~

Bind function đúng instance/hook đã pin. Validate runtime, không chỉ as T. Tên selfencrypt/selfdecrypt chưa xác nhận semantics cross-user. [Next SDK](https://docs.tide.org/Languages/NextJS/tidecloak-nextjs-reference), [JS types](https://docs.tide.org/Languages/JavaScript/tidecloak-js-reference).

### 8.3. Policy adapter phía B

Interface nội bộ phải triển khai/kiểm chứng, không khẳng định tên API Tide có sẵn:

~~~text
verifySubmissionOrigin(protectedPayload/proof, binding)
verifyIdeaDecision(decisionArtifact, binding, ciphertextHash, recipient)
verifyVotingAssignment(assignmentArtifact, org, councilVersion, rosterHash, N, T, policyVersion)
verifyApproval(proof, ApprovalContext, authenticatedJuror)
createRevealChallenge(verifiedContext, verifiedProofs)
verifyCouncilChange(changeArtifact, baseVersion, candidateRosterHash, verifiedVotes)
applyCouncilChange(verifiedProposal, expectedCouncilVersion)
requestGovernedRoleChange(whitelistedChange, approvedCouncilProposalIfRelevant)
~~~

Dịch vụ mật mã phải tự verify toàn context canonical, distinct approvers, membership/roster snapshot, N/T được bốc và khóa, independent/CoI, operation/payload/recipient/expiry/policy, không tin row count/status. Chặn dùng phiếu A cho B, đổi ciphertext/recipient/purpose sau ký và dùng grant ngoài scope/phiên cho phép.

Assignment/directory có nguồn xác thực phù hợp. Backend tự đổi assignment rồi tự ký bằng secret của nó chưa chống chính backend. Adapter chưa có trả POLICY_UNAVAILABLE, không artifact giả.

Nếu dùng Forseti, ghi contract hash/ID/version và các validation stage thực sự chạy. Hook khác nhau theo policy mode; không giả định mọi hook đều chạy cùng request. [Forseti](https://docs.tide.org/Core-Concepts/forseti-engine).

### 8.4. QEA khác quorum vụ việc

QEA bảo vệ đổi IAM/policy; không tự biến row phiếu thành phê duyệt mật mã cho report hoặc đổi council. Governance admins và thành viên council là hai tập riêng. Mọi đổi roster/role hội đồng cần vote nghiệp vụ ở mục 10.3 trước; QEA nếu có là bước áp dụng kỹ thuật bổ sung, không thay vote và không được tự kích hoạt bootstrap/đổi roster.

Tài liệu QEA ghi max(1, floor(0.7 * N_admins)): 1/2 admin có thể cần một approval, 3 admin cần hai; realm master không chịu QEA. B phải test đường quản trị/cấu hình thực tế, không suy ra master đọc plaintext và không bỏ qua ngoại lệ. [QEA](https://docs.tide.org/Core-Concepts/iga-workflow).

Demo governance dùng ba tài khoản admin thật, request thật pending sau một approval. Không ép admins thành jury chỉ để số phiếu giống nhau.

## 9. Hash và bằng chứng tác giả

Encoding chung ở src/contracts/contentEncoding.ts: validate string, Unicode NFC, CRLF thành LF, giữ whitespace còn lại; fixed-order JSON. Lưu/hiển thị chính nội dung canonical. Không stringify object tùy ý/spread input.

~~~typescript
type IdeaContentV1 = {
  organizationId: string; resourceId: string; contentVersion: number;
  title: string; description: string; category: string;
};
const normalizeText = (v: string) => v.normalize("NFC").replace(/\r\n?/g, "\n");

export function encodeIdeaV1(v: IdeaContentV1): Uint8Array {
  // Input đã validate; thứ tự field cố định dùng ở cả client/server.
  return new TextEncoder().encode(JSON.stringify({
    schema: "voicevault.idea.content.v1",
    organizationId: v.organizationId,
    resourceId: v.resourceId,
    contentVersion: v.contentVersion,
    title: normalizeText(v.title),
    description: normalizeText(v.description),
    category: normalizeText(v.category),
  }));
}
~~~

SHA-256 trên bytes đó. Hai cặp title/description ("a||b","c") và ("a","b||c") phải khác hash; thuật toán nối delimiter cũ cho cùng bytes, không phải SHA-256 bị phá.

Report encoding có schema/org/UUID/version/title/evidence và accused IDs deduplicate/sort. Assignment/ApprovalContext cũng chốt key/array order. Ciphertext hash chốt rõ hash bytes ciphertext hay UTF-8 serialization, test vector chung, không mỗi bên tự chọn.

Origin proof chứa binding, tác giả xác thực và consent. G4 xác định issuer/signer/trust root/verifier. Tên trong JSON/content hash/ciphertext không tự chứng minh tác giả. Không công khai proof/public key có thể nối về nhân viên trong đánh giá mù; receipt/proof định danh đặt trong lớp bảo vệ thích hợp, đánh giá cả metadata.

Thử thay label/content/ciphertext/cả record, replay UUID/org khác. Phát hiện mismatch chưa khôi phục được dữ liệu đúng; cần receipt/bản gốc đã xác minh và backup. Timestamp server chỉ vận hành; bằng chứng ưu tiên trước DBA cần chứng thực/biên nhận độc lập, không hash và thời gian cùng một DB.

## 10. Xung đột lợi ích và chọn hội đồng

### 10.1. Chốt danh sách hội đồng ngay khởi tạo

Phân biệt **council roster** (danh sách hội đồng gốc theo từng version) và **voting assignment** (N người được chọn cho một phản ánh/đề xuất). Không tạo hội đồng từ toàn bộ nhân viên mỗi khi có phản ánh, không tự thêm người đang đăng nhập và không lấy roster đích chưa duyệt làm nguồn người vote.

Bootstrap một lần trước hồ sơ đầu tiên:

1. Hai người triển khai chốt danh sách thành viên cụ thể, xác minh stable subject ID, organization, trạng thái active, membershipRole và independent. Pool demo duy nhất: Eva, Frank, Grace, Henry, Iris; Grace independent.
2. Khóa policy ban đầu: minVoters=3, maxVoters=5, tỷ lệ 2/3 và independent requirement. Khoảng N là mặc định thiết kế vì yêu cầu chưa chỉ định; thay min/max trong giới hạn 3..5 phải qua proposal được vote như thay roster. Tỷ lệ 2/3 và independent requirement là quy tắc cố định của protocol v1, không có tùy chọn sửa trực tiếp.
3. Tạo CouncilSnapshot version=1 bất biến, rosterHash, policyHash, bootstrap receipt và dấu bootstrapCompleted được policy xác thực. Roster có ít nhất ba người, ít nhất một independent; prototype giới hạn tối đa 12 người để thuật toán mẫu hữu hạn.
4. Có xác nhận tham gia của các thành viên ban đầu và lưu manifest không nhạy cảm. Bootstrap là quyết định quản trị ban đầu được công bố, không nhận là danh sách tự phát sinh từ mật mã.
5. Sau bootstrap không còn endpoint add/remove/edit trực tiếp, seed không ghi đè roster và không bật lại chế độ bootstrap khi reset app/DB. Policy không chấp nhận version/hash cũ như roster hiện hành; khôi phục backup phải đối soát với checkpoint đáng tin cậy.

Directory nhân sự không tự cấp tư cách council: nhân viên mới/đổi tên/đổi phòng ban không tự thành người vote. Subject sai hoặc inactive bị loại theo CoI/eligibility, nhưng đổi tư cách/role/independent của council vẫn cần proposal được vote.

### 10.2. Bốc ngẫu nhiên số lượng rồi bốc người

Client chỉ gửi accusedPersonIds. Server resolve từ directory đáng tin/có version, reject unknown/cross-org và management graph cycle. CoI loại accused, chuỗi quản lý liên quan đã biết và quan hệ xung đột được xác minh. Không dùng department do client tự khai hoặc display name làm khóa.

Với E là thành viên hợp lệ còn lại trong roster hiện hành:

- Khoảng N hợp lệ: từ minVoters=3 tới min(maxVoters=5, |E|), và phải chọn được ít nhất một independent.
- Bốc N đều trong các số nguyên hợp lệ, sau đó bốc đều một tập N người thỏa independent. Đây là phân phối đều theo kích thước rồi theo tập có cùng kích thước, không tuyên bố mọi tập ở mọi kích thước có xác suất bằng nhau.
- T = ceil(2 × N / 3), tính trên N được chọn, không tính trên số đã bỏ phiếu hoặc đang online. N=3 → T=2; N=4 → T=3; N=5 → T=4.
- Có thể chỉ còn một kích thước khả dụng, ví dụ E có ba người thì N=3; không cố bốc N lớn hơn pool hoặc hạ minVoters để tạo ngẫu nhiên giả.
- Lưu N/T, voter IDs, exclusions, council/directory/policy version/hash và selection proof cùng request. Retry/idempotency không bốc lại, không thêm/bớt voter sau khi đã có phiếu.
- Thiếu ba người hoặc không independent: AWAITING_ELIGIBLE_JURY; không lấy người ngoài roster, không giảm ngưỡng.

Hàm Node minh họa sau khi CoI được tính; nguồn roster/selection vẫn phải được G3 xác minh:

~~~typescript
import { randomInt } from "node:crypto";
type EligibleVoter = { id: string; independent: boolean };
type VoterPolicy = { minVoters: number; maxVoters: number };

export function selectVotingAssignment(
  eligible: EligibleVoter[],
  policy: VoterPolicy = { minVoters: 3, maxVoters: 5 },
  drawInt: (min: number, maxExclusive: number) => number = randomInt,
) {
  if (!Number.isInteger(policy.minVoters) || !Number.isInteger(policy.maxVoters)
      || policy.minVoters < 3 || policy.maxVoters < policy.minVoters
      || policy.maxVoters > 5) throw new Error("INVALID_VOTER_POLICY");
  if (eligible.length > 12) throw new Error("COUNCIL_SIZE_LIMIT_EXCEEDED");
  if (new Set(eligible.map(v => v.id)).size !== eligible.length) {
    throw new Error("INVALID_DIRECTORY");
  }
  const maxN = Math.min(policy.maxVoters, eligible.length);
  if (maxN < policy.minVoters || !eligible.some(v => v.independent)) {
    throw new Error("INSUFFICIENT_ELIGIBLE_JURORS");
  }
  const voterCount = drawInt(policy.minVoters, maxN + 1);
  const candidates: EligibleVoter[][] = [];
  function collect(from: number, selected: EligibleVoter[]) {
    if (selected.length === voterCount) {
      if (selected.some(v => v.independent)) candidates.push([...selected]);
      return;
    }
    const remaining = voterCount - selected.length;
    for (let i = from; i <= eligible.length - remaining; i++) {
      selected.push(eligible[i]);
      collect(i + 1, selected);
      selected.pop();
    }
  }
  collect(0, []);
  if (candidates.length === 0) throw new Error("INSUFFICIENT_ELIGIBLE_JURORS");
  return {
    voterCount,
    quorumRequired: Math.ceil(2 * voterCount / 3),
    voters: candidates[drawInt(0, candidates.length)],
  };
}
~~~

drawInt chỉ được tiêm deterministic trong unit test; production dùng node:crypto.randomInt. CSPRNG tránh modulo bias nhưng không chứng minh backend không bốc lại; G3 phải kiểm chứng assignment và chống bỏ kết quả không thuận lợi. [Node randomInt](https://nodejs.org/api/crypto.html#cryptorandomintmin-max-callback).

Demo tố Eva/Binh tính eligibility từ roster/directory thật, hiển thị N/T và voter list thực. Không hứa luôn Frank–Grace–Henry vì Iris cũng có thể được chọn; fixture cố định phải mang nhãn mô phỏng.

### 10.3. Thay đổi hội đồng phải vote như duyệt phản ánh

Mọi thêm, xóa, thay người, đổi chair/independent, bật/tắt membership hoặc đổi min/max đều tạo CouncilChangeRequest. Không có ngoại lệ “IT sửa nhanh”; IAM/DB/seed/console không được là đường tắt. Protocol v1 giữ tỷ lệ 2/3 cố định, không nhận proposal hạ tỷ lệ này.

Dùng **cùng VotingService, thuật toán chọn N/người, kiểm tra T/independent, ký context, expiry, idempotency, DENY và audit** như duyệt phản ánh; chỉ khác operation/payload và hành động cuối:

~~~text
Đề xuất roster/policy đích trên CouncilSnapshot v
  -> lọc CoI từ roster đang có hiệu lực v
  -> bốc N + N voters, khóa assignment và T
  -> COLLECTING -> READY khi đủ T APPROVE hợp lệ có independent
  -> verify proof/policy -> APPLYING -> APPLIED
COLLECTING/READY -> DENIED / EXPIRED / STALE
Không đủ eligible -> AWAITING_ELIGIBLE_JURY
~~~

1. Proposal chứa baseCouncilVersion/hash, toàn roster/policy đích, diff, reason, expiry, nonce và payloadHash bất biến. Validate roster đích: subject duy nhất/cùng org/được xác minh, tối đa 12 người, đủ thành viên active cho minVoters và có independent active; policy đích 3 <= minVoters <= maxVoters <= 5. Context operation=CHANGE_COUNCIL, không trộn với REVEAL_REPORT_IDENTITY.
2. Người vote lấy từ roster **cũ đang có hiệu lực**, loại thành viên bị thêm/xóa/đổi quyền và người có CoI với thay đổi. Người mới chưa được duyệt không có quyền vote cho chính việc bổ nhiệm.
3. Không đủ eligible/independent thì giữ chờ, không giảm N/T hoặc thêm người ngoài roster. Muốn thay independent duy nhất có thể cần proposal bổ sung independent khác được duyệt trước rồi mới proposal loại người cũ.
4. Mỗi voter đăng nhập riêng, ký đúng proposal hash/base version/assignment/N/T/purpose/expiry; cùng ngưỡng ceil(2N/3), distinct và independent như phản ánh. Một DENY hợp lệ kết thúc proposal theo quy tắc chung.
5. Đủ phiếu chỉ là READY. Adapter xác minh bằng chứng, thực hiện thay đổi IAM/QEA nếu cần qua outbox rồi đối soát; chưa hoàn tất giữ roster cũ ở trạng thái hiệu lực, không cấp quyền sớm.
6. Publish version v+1 bằng compare-and-swap expectedVersion=v, giữ lịch sử v và ghi audit/proof. IAM projection không là nguồn membership duy nhất; API/Fabric kiểm cả version được publish để role đã chuẩn bị chưa tạo quyền sớm.
7. Nếu proposal khác đã publish trước, proposal này STALE, không tự rebase roster đích hoặc dùng phiếu cũ. Các pending voting request/reveal challenge trên roster cũ được đánh dấu STALE, ngăn grant/apply mới; cấp assignment mới cần quy trình có ghi nhận, không âm thầm bốc lại.
8. Authorization đã cấp cần được policy kiểm version khi dùng; nếu Tide adapter không thu hồi/chặn được artifact cũ, ghi giới hạn và khóa luồng thay đổi chưa đạt G3/G5. Không tuyên bố thu hồi plaintext đã xem.
9. BootstrapCompleted không được reset để tránh vote. Duplicate proposal cùng payload/base version không bốc lại; hủy/nộp lại không được dùng để “săn” nhóm vote thuận lợi mà không có quy trình đối soát.

Đây là governance nghiệp vụ của hội đồng. QEA quản trị realm là lớp kỹ thuật riêng và không tự thay thế các phiếu này.

## 11. Database, transaction và migration

### 11.1. Schema logic

B chuyển bảng này thành Prisma schema đúng bản đã pin; đây không phải schema hoàn chỉnh copy chạy ngay.

| Entity | Trường/ngữ nghĩa | Ràng buộc |
| --- | --- | --- |
| Idea | Org/UUID, canonical content/version/hash, envelope, consent, policy, state/version | Bất biến sau nộp, không submitter FK |
| IdeaEndorsement | ideaId, endorserSubject, artifact | Actor từ token, không đổi tác giả |
| IdeaDecision | decision/director/context/proof | Verify artifact; row không nguồn quyền duy nhất |
| PublishedCredit | ideaId, tên công khai, artifact | Chỉ consent + G4; không bảng tương tự reporter |
| Report | Org/UUID, evidence giả/content hash, envelope, state/version | Không createdBy/reporterId/revealedReporter plaintext |
| ReportAccused | reportId/personId | Unique(reportId, personId), cùng org |
| CouncilSnapshot | org/version, roster/policy hash, bootstrap receipt, publishedAt | Unique(org, version), bất biến; current version có checkpoint đáng tin |
| CouncilMember | snapshotId/subject/role/independent/active | Unique(snapshotId, subject), không sửa trực tiếp sau publish |
| CouncilChangeRequest | UUID/org/base version/hash, roster/policy đích/diff/hash/reason, votingRequestId, applyState/version | Payload bất biến; duplicate active proposal cùng payload/base không bốc lại |
| VotingRequest | operation/resource/binding, council version/hash, payloadHash, nonce/expiry/state/version | Dùng chung phản ánh/đổi council; phiếu không tái dùng qua operation |
| VotingAssignment | votingRequest/report, version, roster/directory/policy version/hash, voterCount/quorumRequired, hash/artifact | Một selection cho một round/resource đã chốt, N/T bất biến |
| VotingAssignmentMember | assignment/member/independent snapshot | Unique(assignmentId, memberSubject), đúng voterCount đã bốc |
| VotingExclusion | person/reason/directory version | Lý do đã xác minh |
| UnmaskRequest | report/assignment/votingRequestId/context/ciphertext hash/recipient/purpose/expiry/state/version | Context bất biến, dùng VotingRequest chung, không tự đếm phiếu riêng |
| VoteApproval | votingRequestId/voterSubject/decision/reason/proof/hash/verifiedAt | Unique(votingRequestId, voterSubject), snapshot/N/T/context verify |
| RevealAuthorization | request/opaque artifact/context/expiry/state | Không plaintext, DB không tự cấp quyền |
| IdempotencyRecord | org/scope/key/payload hash/response reference | Unique(org, scope, key), không JWT/submitter |
| OutboxOperation | request/type/context/state/attempts | Retry idempotent và đối soát external call |
| AuditEvent | action/resource/request/source/result/time, actor có chọn lọc | Redact, chưa mặc định tamper-evident trước DBA |

Reporter plaintext chỉ client memory, xóa khi đóng/logout; không localStorage/analytics/SSR/cache. API chọn field, không trả nguyên object có envelope/proof cho list.

### 11.2. Transaction

- Tạo report + accused + roster snapshot reference + selection N/T/assignment hoặc chờ + idempotency trong một transaction. Council proposal + VotingRequest + selection cũng nguyên tử.
- Verify proof trước persist; tại commit kiểm tra lại state/version/expiry/membership snapshot, insert unique và tính tiến độ. Row count không thay proof.
- Approval không sửa tại chỗ; DENY kết thúc request; xét lại cần request mới.
- Optimistic version chống hồi sinh EXPIRED/DENIED; external grant qua outbox, không giữ DB transaction khi gọi mạng.
- Timeout đối soát request ID trước retry, không cấp grant/apply roster trùng. Publish council bằng expectedVersion; hai proposal đồng thời chỉ một được publish, proposal kia STALE. Không transaction DB dài trong lúc QEA/network chờ.
- SQLite prototype một app instance, không chia file đang ghi qua mạng.

### 11.3. Migration single writer

Chỉ B tạo schema/migration; A yêu cầu field qua contract change, không db push và không commit DB.

Máy B với Prisma 6.19.0:

~~~powershell
npm run db:migrate:dev -- --name add_unmask_requests
npm run db:validate
npm run db:generate
git diff -- prisma/schema.prisma prisma/migrations
~~~

Máy A/checkout integration sau merge:

~~~powershell
npm run db:migrate:deploy
npm run db:generate
~~~

Không sửa migration đã áp dụng; hợp nhất bằng migration tiến tới. Drift/đòi reset: kiểm tra đúng DB/version/checksum, không tự reset cho xanh. CLI major mới có thể khác hướng dẫn, không lấy latest áp vào Prisma 6.

## 12. Code song song và Git merge chi tiết

### 12.1. Milestone

| Mốc | A | B | Điều kiện |
| --- | --- | --- | --- |
| M0 chung | DTO review, shell/client probe, roster/vote UI | Scaffold/contracts/deps/env/scripts/schema, bootstrap roster/policy một lần | Cùng SHA, roster v1/hash đã chốt, token thật/giả được thử |
| M1 nối đầu | Form/list fixture, SDK probe | /me/API skeleton/persist/policy probe | API tối thiểu merge trước UI, browser tạo record thật |
| M2 ý tưởng | Encrypt/submit/review/reveal | Decision/origin/binding/policy | G1/G2/G4 có kết luận, bypass không mở sớm |
| M3 phản ánh + council | Multi-accused, N/T/voter list, VotePanel và council-change UI | Roster version, random N/người, VotingService chung, CoI/proof/outbox/grant/apply | T=ceil(2N/3), independent, chống replay và không đổi roster trước APPLIED |
| M4 hardening | Multi-session E2E, UX/privacy | QEA/concurrency/audit/fresh migration | Security cases đạt trên integration |
| M5 bàn giao | Video, mock tắt | Clean checkout/runbook/version manifest | Hai máy cùng commit, cam kết khớp bằng chứng |

Ước lượng chia việc: M0/feasibility 45–90 phút; mỗi đợt M1–M3 60–120 phút nếu SDK thuận lợi; dành riêng 45–90 phút tích hợp cuối, 30–45 phút demo. Không cam kết hoàn thành policy chưa chứng minh trong thời lượng cố định.

G1–G3 tắc: A tiếp tục UI theo contract và POLICY_UNAVAILABLE; B ưu tiên policy, không thay proof bằng biến frontend. Đầu mốc chốt owner, giữa mốc gửi SHA/contract change, cuối mốc merge/smoke; không chờ hoàn thành cả hệ thống mới merge.

### 12.2. B tạo baseline

Lệnh sau là hướng dẫn thực hiện sau khi có M0, chưa được chạy khi sửa tài liệu. Base branch hiện là master, remote origin; nếu đổi main sửa runbook thống nhất. Trước switch/merge working tree phải sạch; commit chọn lọc việc dở, không reset hard/stage việc ngoài scope.

~~~powershell
git status --short
git fetch origin
git switch master
git pull --ff-only origin master
git switch -c integration/voicevault
~~~

Cùng hoàn thành M0, stage/review/commit foundation rồi B:

~~~powershell
git push -u origin integration/voicevault
git rev-parse HEAD
~~~

Gửi baseline SHA cho A, không scaffold app thứ hai.

### 12.3. Branch riêng từ cùng SHA

Checkout A:

~~~powershell
git fetch origin
git switch -c work/ui-client --track origin/integration/voicevault
git push -u origin work/ui-client
npm ci
npm run db:generate
~~~

Checkout B:

~~~powershell
git fetch origin
git switch -c work/server-policy --track origin/integration/voicevault
git push -u origin work/server-policy
npm ci
npm run db:generate
~~~

Sau push -u, upstream là branch công việc của từng người. Kiểm tra SHA, không chỉ tên branch. Cùng máy dùng hai clone/worktree trong thư mục được phép; env/DB/port riêng.

### 12.4. Commit/handoff và đồng bộ

Mỗi người chỉ sửa file mình, commit lát cắt nhỏ, chạy kiểm tra phù hợp + npm run check, stage file cụ thể/git add -p và review git diff --cached. Không token/env/DB. Live chưa chạy ghi NOT RUN. Push branch riêng, gửi handoff mục 15; không tự push master/integration.

Sau mỗi integration merge, commit việc dở, đảm bảo sạch và trên branch mình:

~~~powershell
git fetch origin
git merge origin/integration/voicevault
npm ci
npm run db:generate
npm run check
~~~

Migration mới thì chạy db:migrate:deploy trên DB local riêng trước integration test. git pull từ upstream branch công việc chưa chắc nhận integration. Không rebase/force-push commit người khác đã dùng.

### 12.5. B merge và kiểm tra cây kết quả

Checkout integration sạch, env/DB riêng; nếu một checkout phải commit/push việc server trước switch. Thứ tự contract → API tối thiểu → UI, lặp theo dependency:

~~~powershell
git fetch origin
git switch integration/voicevault
git pull --ff-only origin integration/voicevault
git status --short
git merge --no-ff --no-commit origin/work/server-policy
~~~

Merge sạch hoặc giải quyết conflict xong, kiểm tra trước commit/push:

~~~powershell
git diff --check
git diff --cached --check
npm ci
npm run db:validate
npm run db:migrate:deploy
npm run db:generate
npm run check
npm run test:integration
~~~

Chạy thêm live/E2E cần thiết của mốc, với app/realm/test DB đã dựng theo mục 13. Đạt mới:

~~~powershell
git commit -m "merge: integrate server policy milestone"
git push origin integration/voicevault
~~~

Lặp với origin/work/ui-client/message phù hợp. Already up to date thì không có merge mới để commit, kiểm tra SHA handoff. B không sửa client âm thầm để ép xanh; consumer A sửa, provider B sửa. Sau push, cả hai đồng bộ mục 12.4.

### 12.6. Conflict, lockfile và migration

~~~powershell
git status --short
git diff --name-only --diff-filter=U
~~~

| Conflict | Xử lý |
| --- | --- |
| Contract/schema/fixture | Hai người chốt ngữ nghĩa, B contract, A consumer, chạy contract tests |
| Component/client | A sửa theo contract mới, B review auth/policy |
| API/service | B sửa, A kiểm response thật |
| Manifest/lockfile | B hợp nhất dependency có chủ đích; manifest đổi thì npm install bằng npm version chung để tạo lock, xác minh npm ci |
| Prisma/migration | B giữ lịch sử đã áp dụng, hòa giải bằng migration tiến tới |
| Env/DB trong diff | Dừng stage/push, loại đúng file; credential đã lộ xử lý thay riêng |

Không Accept All Ours/Theirs cho contract/manifest/migration. Stage đúng file sau giải quyết, kiểm tra conflict marker trong code/config đã sửa, chạy lại check/test. Không nhầm code ví dụ trong tài liệu với conflict thật.

Bỏ merge chưa commit bằng git merge --abort khi working tree sạch trước merge; giữ lại các sửa chữa duy nhất đã bàn giao. Abort không hoàn tác DB/realm đã thay.

### 12.7. Nhập master và rollback

M5 đạt: PR integration/voicevault → master ghi gate/validation/giới hạn/SHA demo, người còn lại review. Hai branch tự chạy được chưa đủ nhận là hệ thống chung chạy được.

Merge đã push bị lỗi: xem git log --oneline --merges, xác minh SHA rồi dùng git revert -m 1 MERGE_COMMIT_SHA (thay tên mẫu bằng SHA thật), chạy lại check/push. Không reset/force-push lịch sử chung. Revert merge ảnh hưởng merge lại; cần commit sửa mới hoặc revert lại revert trước khi nhập lại cùng lịch sử.

Git rollback không thu hồi plaintext/grant, migration hay policy đã áp dụng. B có kế hoạch DB/policy riêng và chạy lại deny tests.

## 13. Chạy hệ thống sau merge

1. Hai máy cùng SHA; đối chiếu Node/npm/SDK/Prisma, lockfile và image digest M0.
2. Dựng TideCloak, kiểm enrollment/client/issuer/JWK/QEA/callback. Không copy token người khác để chuyển persona.
3. Tạo .env local, xác nhận DATABASE_URL đúng checkout, tạo prisma/local.
4. Áp migration/seed lên DB demo đã chỉ định:

~~~powershell
npm ci
npm run db:validate
npm run db:migrate:deploy
npm run db:generate
npm run db:seed
npm run check
~~~

5. Terminal riêng npm run dev; đợi health và đặt BASE_URL test đúng instance, không gọi server cũ.
6. test:integration dùng DB test riêng; sau đó test:security:live và test:e2e theo realm/fixture đúng. Thiếu prerequisite ghi NOT RUN, không skip im lặng báo xanh.
7. Browser tạo hồ sơ mới, refresh/restart đọc lại; seed tải sẵn không thay persist test thật.
8. Happy path + direct bypass, inspect DB/log/storage không có reporter plaintext/token.

Seed idempotent, dữ liệu giả, không ghi proof/grant “hợp lệ” thẳng DB và không overwrite council đã bootstrap. Khởi tạo roster chỉ qua ceremony một lần, thay đổi qua vote. Crypto fixture tạo qua flow thật hoặc gắn SIMULATED.

### 13.1. Triage tích hợp

| Lỗi | Kiểm tra trước | Owner |
| --- | --- | --- |
| UI undefined/schema fail | Contract version, ApiResult, response/fixture | A + B |
| Token thật 401 | Issuer/client/algorithm/org/expiry/QEA | B |
| Login loop | Origin/callback/port/SSO/cookie | A + B |
| An encrypt được, Chi không mở | G1/sharing/recipient/key scope, không cấp role rộng lách | A + B |
| Đủ T phiếu vẫn khóa | N/T đã chốt, context/proof/independent/assignment/roster hash/expiry/outbox | B |
| Council đổi trước vote đủ | Dừng demo, rà direct DB/IAM/seed/bootstrap bypass và publish version | B + A |
| Roster đổi nhưng quyền/phiếu cũ vẫn dùng được | STALE/version check trên API và Fabric, đối soát projection/artifact | B |
| Một phiếu đã mở | Dừng demo, sửa policy/role, không chỉ progress bar | B, A xác nhận bypass |
| Prisma thiếu field | Version/migration/generate đúng checkout | B |
| SQLite lock/drift | DB dùng chung/concurrent process/transaction/checksum | B, không reset tùy tiện |
| UI Fabric deny không request live | Mock fallback/client tự gắn nguồn | A + B |

## 14. Quyền riêng tư và audit

Không log Authorization/cookie/body, payload trước/sau crypto, email/employee ID hoặc proof định danh người nộp. Kiểm SDK errors/proxy/tracing/error tracker/browser console. Rate limit user/IP tạo liên kết danh tính: công bố retention/phạm vi; không thêm submittedBy để debug rồi vẫn hứa ẩn danh.

Nội dung/văn phong/thời điểm/metadata tệp có thể lộ người viết. MVP không nhận attachment thật; upload cần xử lý metadata/ACL riêng. Không lưu sub trong DB không chống backend chủ động ghi lại JWT/request; thiết kế tư cách ẩn danh riêng ngoài MVP.

| Kết quả | Nhãn đúng |
| --- | --- |
| API chặn sửa | APP / FORBIDDEN |
| Browser phát hiện mismatch | CLIENT / INTEGRITY_MISMATCH, telemetry chưa xác minh nếu chỉ client báo |
| Policy từ chối thật | FABRIC / POLICY_DENIED + request ID đối soát |
| QEA chưa áp dụng | QEA / PENDING |
| Mock | SIMULATED, không bằng chứng live |

Browser không tự ghi “Fabric đã chặn” thành chứng cứ server tin. Endpoint chỉ ghi blocked chưa chứng minh thao tác thật.

Hash chain cùng DB không chống viết lại cả chain. Muốn tamper-evident trước DBA cần checkpoint/chữ ký đối chiếu độc lập và test; HMAC backend giữ không chống chính backend. Phát hiện giả mạo chưa chứng minh phục hồi được.

README/UI bỏ “an toàn tuyệt đối”, “mathematically safe”, “khóa vĩnh viễn”, “khôi phục tác giả” nếu chưa có bằng chứng phù hợp; phân biệt confidentiality/integrity/availability/recovery.

## 15. Prompt và mẫu bàn giao

Hai prompt dành cho hai người dùng coding agent trên checkout riêng, không yêu cầu agent tự tạo team hoặc viết chồng file.

### 15.1. Prompt A

~~~text
Đọc voicevault_technical_architecture.md, nhất là mục 3–9 và 12–16.
Làm work/ui-client từ baseline SHA team cung cấp.
Chỉ sửa UI layout/page/globals.css, auth redirect, components, client,
test client/UI/E2E thuộc A. Import contracts/schema/encoding chung.
Không tự sửa package/lockfile/Prisma/API/server/contracts.
Cần dependency/DTO mới thì yêu cầu B merge trước.

Làm milestone giao: UI fixture v1 rồi API client adapter thật.
Mock có nhãn, tắt live, không fallback khi API lỗi.
Hiện roster đã bootstrap, N/T và voters thực; VotePanel dùng chung phản ánh
và council-change. Không nút sửa roster trực tiếp, không coi READY là APPLIED.
SDK nhận mảng; runtime-validate payload/binding/proof sau mở.
Không giả grant hoặc nhận Fabric chặn chỉ vì UI ẩn nút.
Không persist/log reporter plaintext, token, payload nhận diện.

Chạy check phù hợp, handoff SHA/file/contract/deps/prerequisite,
lệnh thực sự đã chạy/kết quả/giới hạn. Không tự merge integration/master.
~~~

### 15.2. Prompt B

~~~text
Đọc voicevault_technical_architecture.md, nhất là mục 4–14 và 16.
Làm work/server-policy, điều phối integration theo mốc, A review.
Sở hữu contracts/server/API/Prisma/deps/config/CI.
Không sửa UI che lệch DTO; contract/error/fixture merge trước consumer.

Verify JWT thật/org/role; validate và persist thật với idempotency.
Directory do server resolve, hỗ trợ multi-accused.
Bootstrap roster một lần, mọi đổi membership/role/policy qua vote.
Bốc ngẫu nhiên N rồi N voters từ roster hiện hành sau CoI; khóa N/T,
T=ceil(2N/3), distinct có independent, thiếu người chờ không hạ ngưỡng.
Dùng VotingService chung cho phản ánh/council-change; publish version
sau proof/QEA/apply đã đối soát, proposal cũ STALE khi roster đổi.
Approval/grant/apply gắn operation/request/resource/payload/roster/N/T/assignment/recipient/
purpose/policy/expiry. Row count không là quyền mật mã.
Không cấp decrypt role rộng thay resource policy.
G1–G3 chưa đạt: POLICY_UNAVAILABLE, không giả proof/grant/Fabric deny.
Không persist/log reporter plaintext/token.

Migration single writer, env/DB riêng. Merge theo mục 12, kiểm tra
cây đã merge, báo live gates riêng, không force-push lịch sử chung.
~~~

### 15.3. Handoff

~~~text
Milestone:
Branch + commit SHA:
Baseline/integration SHA đã đồng bộ:
Contract version:
File/endpoint thay đổi:
Request/response mẫu (chỉ dữ liệu giả, không token):
Dependency/config/migration thay đổi:
G1–G5: PASS / FAIL / NOT RUN + bằng chứng không nhạy cảm:
Lệnh đã chạy + kết quả:
Prerequisite để người kia chạy:
Giới hạn/lỗi còn lại:
Shared file cần bàn giao owner:
~~~

Không chỉ báo “xong frontend/backend”; người kia phải tái hiện kết quả cùng SHA không đoán console config.

## 16. Kiểm thử, demo và điều kiện hoàn thành

| Case | Kết quả bắt buộc | Bằng chứng |
| --- | --- | --- |
| Token giả/hết hạn/sai issuer/client | 401, không record mới | API |
| Role đúng/org khác | Không đọc/ghi cross-org | API |
| SDK round trip/cross-user | Đúng kiểu, recipient khác mở đúng cơ chế | G1 live |
| Director mở UNDER_REVIEW/REJECTED trực tiếp | Dịch vụ mật mã từ chối, không chỉ UI | G2 live |
| Sửa label/tên tự khai | Không verified credit | G4 |
| Tráo content/ciphertext/UUID/org | Mismatch/policy deny | G2/G4 |
| Delimiter/Unicode/newline/order | Canonical client/server khớp, hai cặp cũ khác bytes | Contract vectors |
| Multi-accused/management conflict | Loại đúng directory version | Unit/API |
| 0/1/2 eligible/không independent | Chờ, không giảm minVoters hoặc N/T đã chốt | Unit/API |
| Bốc N với eligible 3/4/5 | N trong khoảng cấu hình, T lần lượt 2/3/4 khi N=3/4/5 | Unit với drawInt test |
| Roster bootstrap/seed chạy lại | Không overwrite/tái bootstrap, không tự thêm nhân viên | API/policy G5 |
| Council thêm/xóa/đổi role | Chỉ proposal + vote; roster hiện hành chưa đổi khi pending/READY | API + G3/G5 |
| Thành viên mới vote bổ nhiệm mình | Từ chối, chỉ roster cũ đủ điều kiện được vote | G3 live |
| Hai council proposal cùng base version | Một APPLIED, còn lại STALE, phiếu không rebase | Transaction/policy |
| Đổi roster/direct IAM/DB/console không proof | Không publish version/quyền hợp lệ | Adversarial G5 |
| Retry create/proposal | Một resource/assignment, giữ N/T/người; không bốc lại bằng key/UUID mới | Transaction/policy |
| Juror approve hai lần | Chỉ một người được tính | Unique + proof |
| Đủ T approval nhưng không independent | Không grant/apply council | G3 |
| Ngoài jury/CoI | Không approve/mở kể cả direct call | API + G3 |
| T APPROVE hợp lệ | Đúng operation/context: recipient mở hoặc proposal được apply, không dùng chéo | G3 live |
| Phiếu A dùng B/recipient khác | Từ chối | G3 live |
| Expiry/đổi policy/assignment | Proof/grant cũ không áp dụng | G3 live |
| Sửa row status/vote/assignment | Không tạo authorization mật mã hợp lệ | Adversarial G2/G3 |
| Concurrent approval/adapter timeout | Không grant trùng/hồi sinh terminal | Integration |
| IT tự cấp role | QEA request thật chưa áp dụng dưới ngưỡng | G5 live |
| Logout/reload/DB/log/storage | Không reporter plaintext/token ngoài phạm vi | Privacy |
| Fresh checkout/DB trống | Install/migrate/generate/seed/build theo runbook | Reproducibility |
| Sau merge | UI/API thật cùng commit, mock tắt | E2E |

Mock/unit không thay live tests; thiếu config/chưa chạy ghi NOT RUN, không xem skip là PASS.

### 16.1. Demo hai phút

1. An gửi ý tưởng, reviewer không thấy tên; request mở sớm thật bị từ chối đúng tầng.
2. APPROVED + consent mới mở/xác minh credit nếu G4 đạt; REJECTED không công khai.
3. Hiện roster đã chốt từ đầu; nộp phản ánh, bốc số lượng N và voters thực, hiển thị T; fixture có nhãn.
4. CEO/người bị loại bị chặn; dưới T vẫn khóa, đủ T đúng có independent mới mở. N=4 cần ba phiếu, không dùng mặc định hai.
5. Tạo đề xuất đổi council: roster cũ còn hiệu lực khi pending, đủ vote và apply mới có version mới. Demo QEA thật nếu có thời gian; audit đúng nguồn.

Không đủ thời gian thì chọn luồng mạnh nhất đã chứng minh và nói rõ phần còn lại; không dựng endpoint chỉ ghi blocked. Quy định video/bài nộp đối chiếu Hackathon.md và nguồn chính thức khi nộp.

### 16.2. Definition of Done

- [ ] Dependency/config pin, hai máy cùng SHA/contract.
- [ ] DTO/schema/fixture/client khớp, migration có owner/lịch sử.
- [ ] Roster chốt một lần từ đầu, không bootstrap/seed overwrite; N/người random và T bất biến theo từng round.
- [ ] Council thay đổi qua cùng VotingService như phản ánh; version mới chỉ APPLIED sau proof, xử lý STALE/phiếu cũ.
- [ ] Auth/create/persist/reload/state/transaction chạy thật.
- [ ] G1–G5 có kết quả riêng, phần chưa đạt khóa hoặc công bố rõ.
- [ ] Mock tắt; deny ghi đúng nguồn APP/FABRIC/QEA/client.
- [ ] Không persist/log plaintext reporter/token; công bố giới hạn ẩn danh.
- [ ] Bypass/E2E/fresh checkout đạt cho phạm vi nộp bài.
- [ ] README/Idea.MD khớp triển khai, không hứa tuyệt đối/vĩnh viễn chưa chứng minh.
- [ ] Handoff, SHA demo, runbook/video theo yêu cầu đã xác nhận.

## 17. Nguồn kỹ thuật

Đối chiếu đúng version M0 đã pin, không tự coi interface minh họa là API Tide có sẵn.

- [TideCloak Quickstart](https://docs.tide.org/get-started/Tidecloak%20Quickstart).
- [Next SDK](https://docs.tide.org/Languages/NextJS/tidecloak-nextjs-reference).
- [JS SDK](https://docs.tide.org/Languages/JavaScript/tidecloak-js-reference).
- [Verify JWT](https://docs.tide.org/Languages/NextJS/VerifyJWT).
- [QEA](https://docs.tide.org/Core-Concepts/iga-workflow).
- [Forseti](https://docs.tide.org/Core-Concepts/forseti-engine).
- [Hermetic E2EE](https://docs.tide.org/Core-Concepts/hermetic-e2ee).
- [Prisma 6.19.0 release](https://github.com/prisma/orm/releases/tag/6.19.0) — bản chọn cho SQLite/CLI ở đây, không khẳng định mới nhất.
- [Node randomInt](https://nodejs.org/api/crypto.html#cryptorandomintmin-max-callback).
- [npm ci](https://docs.npmjs.com/cli/v11/commands/npm-ci/).
- [Git merge](https://git-scm.com/docs/git-merge).

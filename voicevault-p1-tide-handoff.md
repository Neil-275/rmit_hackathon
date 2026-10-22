# Handoff — VoiceVault P1-tide: spike G1 + Tide SDK adapters (máy khác)

Viết lúc ~14:30, 22/10/2026 (UTC+7). **Hạn nộp hackathon: 18:00 hôm nay.**
- **Báo kết quả spike G1 cho Tùng trước 15:15**, vì quyết định này ảnh hưởng nhãn bảo mật của cả demo.
- Code adapter xong trước **16:00**.

Repo: github.com/Neil-275/rmit_hackathon. Bạn làm trên **máy riêng**, không chia sẻ thư mục với ai.

## Điều kiện tiên quyết
1. **Tùng** phải đẩy commit gốc lên remote trước (commit `dccfd22` hiện chỉ có trên máy Tùng):
   `git push origin dccfd22:refs/heads/baseline/p0-tests`
2. Máy bạn: Git, Node ≥ 20, Docker, một browser (nên có 2 profile hoặc cửa sổ ẩn danh để đăng nhập 2 user cùng lúc).

```powershell
git clone https://github.com/Neil-275/rmit_hackathon
cd rmit_hackathon
git switch -c work/p1-tide origin/baseline/p0-tests
npm install
```
Nếu branch `work/p1-tide` đã có trên remote thì dùng `git switch work/p1-tide` (đã tồn tại thì dùng lại, không tạo đè).

## Bối cảnh
- VoiceVault mã hoá danh tính người nộp (tác giả ý tưởng, người phản ánh) **trong browser** bằng TideCloak. Chỉ người được phép mới mở được: director khi ý tưởng APPROVED; recipient khi đủ T = ceil(2N/3) phiếu jury.
- Đọc `voicevault_technical_architecture.md` §1.1 (gate G1, G2), §2 (ranh giới tin cậy), §5.1 (`ResourceBinding`, `IdentityEnvelope`), §8 (SDK, wrapper mẫu `encryptJson`/`decryptJson`, ma trận quyền), §14 (nhãn APP/FABRIC/CLIENT/SIMULATED).
- Hai người khác đang làm song song: agent P0 (Next.js, `public/`, `src/app/`, TideCloak của Tùng) và agent P1-core (`src/contracts/`, `src/server/`, `src/integration/browser-runtime.ts`). P1-core gọi adapter của bạn qua interface ở dưới, hiện đang dùng stub.
- Nhóm đã cắt phạm vi: QEA, Forseti, đổi hội đồng **không** làm hôm nay.

## Phát hiện có sẵn (chưa kiểm chứng)
- Realm mẫu của starter Next.js hiện chỉ có role `_tide_message.selfencrypt` / `_tide_message.selfdecrypt`, tức là người mã hoá tự giải mã. Như vậy **chưa đáp ứng G1** (người khác mở được).
- Giả thuyết cần thử: mã hoá chia sẻ theo tag với role dạng `_tide_<tag>.encrypt` / `_tide_<tag>.decrypt`. **Tên role và tên hàm SDK chưa được xác nhận.** Hãy đọc `.d.ts` của `@tidecloak/js` đã cài và tài liệu: https://docs.tide.org/Languages/JavaScript/tidecloak-js-reference, https://docs.tide.org/Core-Concepts/hermetic-e2ee, https://docs.tide.org/get-started/Tidecloak%20Quickstart
- Kể cả khi giải mã chéo chạy được, role decrypt theo tag nhiều khả năng mở được **mọi** ciphertext mang tag đó, không phụ thuộc trạng thái APPROVED hay quorum. Khi đó G2/G3 chỉ là APP-enforced.

## Việc 1: Spike G1 (tối đa 45 phút, báo kết quả trước 15:15)
Dựng TideCloak **riêng trên máy bạn** theo Quickstart (Docker `tideorg/tidecloak-dev`; ghi lại **image digest** bằng `docker inspect`). Dựng starter Next.js **bên ngoài repo** (ví dụ `..\tide-spike`). Không commit starter vào repo.

Thử theo thứ tự, ghi kết quả từng bước:
1. User A mã hoá một chuỗi với tag `idea_author`, sau đó **chính A** giải mã được.
2. User B (role decrypt cho tag đó) giải mã ciphertext của A. **Đây là G1.**
3. User C **không có** role decrypt thì bị từ chối. Ghi nguyên văn mã lỗi; đây là bằng chứng FABRIC thật.
4. Đổi 1 byte trong ciphertext rồi giải mã: lỗi gì.
5. (Nếu còn thời gian) Có cách nào điều kiện hoá việc giải mã (policy, approval) không? Chỉ ghi nhận, không cài đặt.

**Kết luận phải là một trong ba:**
- **A** — chia sẻ theo tag chạy được. Danh tính dùng FABRIC cho phần giải mã theo role; quorum/trạng thái ghi APP.
- **B** — chỉ self-encrypt chạy được. Mở danh tính phải ghi SIMULATED, demo nói rõ.
- **C** — không cái nào chạy được. SIMULATED toàn bộ.

Gửi Tùng: kết luận, version SDK, image digest, tên role và tên hàm SDK đã xác nhận, mã lỗi bước 3/4. Ghi lại vào `docs/integration/g1-spike.md`.

## Việc 2: Adapter Tide (`src/integration/tide/`)
Interface **phải đúng như dưới**, vì P1-core dùng đúng định nghĩa này. Đặt nó trong `src/integration/tide/types.ts`. Branch `work/p1-core` cũng tạo file này với **nội dung chép nguyên văn** cùng khối này, nên khi merge không xung đột. Vì vậy chép chính xác từng ký tự và **không sửa** nội dung; nếu cần đổi, báo Tùng trước.

```ts
export type ResourceBinding = {
  contractVersion: "v1"; organizationId: string;
  resourceKind: "IDEA" | "REPORT"; resourceId: string;
  contentVersion: number; contentHash: string; policyVersion: string;
};
export type IdentityTag = "idea_author" | "report_id";
export type IdentityPayloadV1 = {
  schema: "voicevault.identity.v1";
  subject: string; displayName: string;
  binding: ResourceBinding;
  consent: { publishCreditOnApproval: boolean } | null;
};
export type SessionInfo = {
  authenticated: boolean; subject: string | null;
  displayName: string | null; roles: string[];
};
export interface AuthAdapter {
  init(): Promise<SessionInfo>;      // không tự redirect login
  session(): SessionInfo;
  getToken(): Promise<string | null>; // refresh nếu cần; null khi chưa đăng nhập
  login(): Promise<void>;            // được phép redirect
  logout(): Promise<void>;
}
export interface CryptoAdapter {
  readonly enforcement: "FABRIC" | "SIMULATED";
  encryptIdentity(payload: IdentityPayloadV1, tag: IdentityTag): Promise<string>; // trả ciphertext
  decryptIdentity(ciphertext: string, tag: IdentityTag, expected: ResourceBinding): Promise<IdentityPayloadV1>;
}
```

Hành vi bắt buộc:
- `createTideAuthAdapter(sdk)` và `createTideCryptoAdapter(sdk)` **nhận instance SDK được inject** (để test bằng SDK giả, không cần mạng). Có thêm một factory `createTideSdk(config)` mỏng, bọc `@tidecloak/js`.
- `decryptIdentity` validate runtime toàn bộ payload (không chỉ ép kiểu `as`). Nếu `binding` khác `expected` thì throw `Error("INTEGRITY_MISMATCH")`. Payload hỏng hoặc SDK trả nhiều hơn một phần tử thì throw `Error("INVALID_CRYPTO_RESPONSE")`. SDK từ chối thì throw `Error("POLICY_DENIED")`, giữ mã gốc trong `cause`.
- `createSimulatedCryptoAdapter()`: `enforcement = "SIMULATED"`, mã hoá giả (base64 kèm prefix `SIMULATED:`). Chỉ dùng khi kết luận spike là B/C và được **chọn tường minh** qua config, **không** tự fallback khi SDK lỗi.
- Không log token, payload hay plaintext. Không ghi vào `localStorage`/`sessionStorage`. Không gửi plaintext đi đâu.
- `login` chỉ gọi khi user bấm. `init` không redirect (tránh vòng lặp login).
- Code phải chạy trong browser: không dùng `node:*`. Chỉ import tương đối, không path alias, không API riêng của Next.

Test (`tests/p1-tide/`, vitest **3.2.4**):
- Round-trip với SDK giả.
- Binding lệch thì `INTEGRITY_MISMATCH`.
- SDK từ chối thì `POLICY_DENIED`.
- Kiểu trả về sai thì `INVALID_CRYPTO_RESPONSE`.
- Simulated adapter luôn báo `SIMULATED`.
- `init` không gọi `login`.

## Việc 3: Cấu hình realm cho VoiceVault (`docs/integration/tide-realm.md`)
Theo kết luận spike, ghi:
- Tên role.
- Persona nào nhận role nào: An encrypt; Chi decrypt `idea_author`; recipient decrypt `report_id`; juror **không** decrypt.
- Các bước tạo trên TideCloak của Tùng: thủ công trong admin console, hoặc script `scripts/tide-roles.sh` dùng admin REST API, đọc URL/realm/credential từ biến môi trường.
- Không commit credential, `tidecloak.json`, realm export có secret hoặc dữ liệu TideCloak.

## Ranh giới file
| Được sửa | Không được sửa |
| --- | --- |
| `src/integration/tide/**`, `tests/p1-tide/**`, `docs/integration/g1-spike.md`, `docs/integration/tide-realm.md`, `scripts/tide-roles.sh` | `tests/p0/**`, `public/**`, `src/app/**`, `src/contracts/**`, `src/server/**`, `src/integration/browser-runtime.ts`, `prisma/`, `tsconfig.json` ở root, tài liệu kiến trúc |

`package.json`/lockfile: chỉ **thêm** `@tidecloak/js@0.13.33` (khớp `@tidecloak/nextjs@0.13.33` bên P0), `vitest@3.2.4`, script `test:p1-tide`. Đặt trong **một commit riêng** để Tùng gộp tay. Không nâng version khác.

## Git và bàn giao
- Commit nhỏ theo việc trên `work/p1-tide`. Được `git push -u origin work/p1-tide`. **Không** merge vào branch khác, **không** force-push.
- Bàn giao: SHA, kết luận A/B/C, các lệnh đã chạy và kết quả, những gì chưa kiểm chứng.
- Kết quả spike chỉ chứng minh trên TideCloak của bạn. Ghi rõ là cần Tùng chạy lại trên instance của Tùng.

## Nếu thiếu giờ
Thứ tự ưu tiên: kết luận spike (Việc 1) → `types.ts` + simulated adapter → Tide crypto adapter → auth adapter → tài liệu realm. Đến 16:00 thì dừng, commit những gì đang xanh, push và báo lại.

## Suggested skills
- `mattpocock-skills:research`: tra tài liệu Tide (tên role, API SDK) từ nguồn chính thức trong lúc spike.
- `mattpocock-skills:prototype`: dựng starter spike tạm ngoài repo.
- `mattpocock-skills:tdd`: viết adapter theo red-green với SDK giả.
- `mattpocock-skills:diagnosing-bugs`: lỗi login loop, DPoP, CORS hoặc giải mã.

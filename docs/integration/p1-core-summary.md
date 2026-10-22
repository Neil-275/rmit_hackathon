# Tổng kết P1 core: kết quả và hướng kết nối

Dành cho người điều hành dự án, để quyết định cách ghép P1 core với phần P0 (Next app, TideCloak, UI).
Chi tiết kỹ thuật cho người viết route: [p1-core.md](p1-core.md).

## Trạng thái

- **Đã xong** cả 5 gói việc trong handoff P1 core. Đã push lên `origin/work/p1-core`, commit `2e2ffb953d069d3da0b9dfac6d4d729b4067afab`. Nhánh gốc là `dccfd22`.
- **Chưa merge** vào `work/server-policy` hay `master`. Theo handoff, việc merge do Tùng làm.
- **Phạm vi file**: chỉ sửa `src/contracts/`, `src/server/`, `src/integration/`, `prisma/`, `config/roster.json`, `scripts/build-bridge.mjs`, `tests/p1/`, `docs/integration/` và `package.json`/`package-lock.json`. Không động vào `tests/p0/`, `public/`, `src/app/`, `next.config.*`, `proxy.ts` hay `tsconfig.json` ở root.
- **Bảo mật**: mọi kiểm tra đều do app thực thi, ghi `enforcement: "APP"`, không giả lập Fabric. DB và audit log không có cột hay trường nào lưu người nộp.

## Những gì đã giao

| # | Gói | File chính | Commit |
| --- | --- | --- | --- |
| 1 | API contract v1 | `src/contracts/api.ts` | `4dacfe8` |
| 2 | Canonical encoding và hash | `src/contracts/encoding.ts` | `fdb1089` |
| 3 | Domain thuần, không I/O | `src/server/domain/` | `0d69c1a` |
| 4 | Prisma, roster, 17 service | `prisma/schema.prisma`, `config/roster.json`, `src/server/` | `aeffebb`, `f6111e1` |
| 5 | LIVE browser runtime và bundle | `src/integration/`, `scripts/build-bridge.mjs` | `98b6b3f` |
| – | Tài liệu bàn giao | `docs/integration/p1-core.md` | `72ddb02` |
| – | Sửa sau review | 3 lỗi race/canonical | `2e2ffb9` |

Tóm tắt từng gói:

1. **Contract v1**
   - Mọi kết quả có dạng `ApiResult<T>`: `{ ok, data | error, requestId, contractVersion: "v1" }`.
   - Có 14 mã lỗi kèm HTTP status, các view type và DTO.
   - Có bảng `ROUTES` cho 17 route `/api/v1/...` và danh sách 23 method runtime.
   - Validator viết tay, không thêm thư viện.
2. **Encoding**
   - Văn bản được chuẩn hóa NFC và đổi xuống dòng thành LF, rồi đưa vào JSON có thứ tự field cố định.
   - Hash bằng SHA-256 qua WebCrypto, nên chạy được cả trên trình duyệt lẫn server.
   - Danh sách người bị tố được khử trùng lặp và sắp xếp.
3. **Domain**
   - Chọn hội đồng: N ngẫu nhiên trong khoảng `[min, max]`, quorum T = ⌈2N/3⌉, bắt buộc có ít nhất một thành viên độc lập.
   - Lọc xung đột lợi ích: loại người bị tố và toàn bộ chuỗi quản lý của họ.
   - Bộ đếm phiếu: một phiếu DENY là DENIED. Đủ T phiếu và có người độc lập thì READY. Quá hạn thì EXPIRED. Đã vào trạng thái cuối thì không quay lại.
   - State machine cho ý tưởng và phản ánh.
4. **Server**
   - Schema SQLite gồm Idea, Report, VotingRequest, Vote, AuditEvent. Danh tính chỉ nằm trong envelope mã hóa (chuỗi opaque).
   - Service có dạng `(actor, input) => ApiResult`. Có audit log.
   - Cập nhật đồng thời dùng compare-and-swap theo version/state.
5. **Runtime LIVE**
   - `createVoiceVaultLive({ apiBase, auth, crypto })` đủ 23 method và không bao giờ throw.
   - Lỗi mạng trả `POLICY_UNAVAILABLE`, response sai dạng trả `CONTRACT_MISMATCH`.
   - Token chỉ gửi tới `apiBase`.
   - Bundle IIFE ghi ra `public/integration/runtime.generated.js`, file này bị gitignore.

## Kiểm chứng

| Kiểm tra | Kết quả |
| --- | --- |
| `npm run test:p1` (vitest) | **72/72 pass**, ổn định qua 3 lần chạy liên tiếp |
| `npx tsc -p tests/p1/tsconfig.json` | 0 lỗi |
| `node scripts/build-bridge.mjs --check` | Build và smoke test trong VM đều OK |
| `npm run db:push` với SQLite local | OK |
| `npm run test:p0` | 1 pass, 30 fail. Giống hệt baseline trước khi làm P1, vì các test này cần `public/` của P0 |

Integration test chạy service thật trên SQLite tạm. Có test cho các tình huống đồng thời: hai juror cùng tạo yêu cầu mở, nhiều phiếu bầu cùng lúc.

## Kết nối với các phần khác

```
UI (P0, public/)  ──►  LIVE runtime (window.createVoiceVaultLive)
                          │  fetch + Bearer token
                          ▼
Next route handlers (P0, src/app/api/v1/**)   ← chưa có, cần viết
                          │  authenticate(req) -> actor
                          ▼
getServices().<service>(actor, input)  (P1)  ──►  Prisma / SQLite (P1)
```

### Việc cần làm để ghép

1. **Merge nhánh**
   - Thử merge trước với `work/server-policy` cho thấy chỉ xung đột ở `package.json` và `package-lock.json`, vì cả hai bên đều thêm dependency.
   - `package.json`: giữ deps của P0, thêm `vitest 3.2.4`, `esbuild 0.25.9`, `prisma 6.19.0`, `@prisma/client 6.19.0` cùng các script `test:p1`, `db:*`, `build:bridge`.
   - Lockfile: lấy bản của P0, rồi chạy `npm install` để sinh lại.
   - Lưu ý: các thay đổi chưa commit ở checkout P0 có thể gây thêm xung đột.
2. **Route handler** (phần P0): mỗi route chỉ cần khoảng 5 dòng. Mẫu code và bảng route → service có trong [p1-core.md](p1-core.md#route-nào-gọi-service-nào).
3. **Xác thực**: hàm `authenticate(req)` phải verify JWT TideCloak rồi trả về `{ subject, organizationId, roles }`. P1 không làm phần này.
4. **Adapter thật**
   - `AuthAdapter`: lấy token từ TideCloak SDK.
   - `CryptoAdapter`: mã hóa danh tính bằng Tide. Hiện mới có bản stub, mà stub crypto chỉ base64, **không phải mã hóa**. Không được dùng stub cho demo thật.
5. **Roster**: thay subject placeholder trong `config/roster.json` (an, binh, chi, juror-1..3) bằng subject Tide thật.
6. **Môi trường**: tạo `.env` có `DATABASE_URL="file:./local/dev.db"`, rồi chạy `npm run db:generate` và `npm run db:push`.
7. **Chốt contract**: đối chiếu 10 điểm trong mục [Contract cần chốt](p1-core.md#contract-cần-chốt) với fixture của P0. Đáng chú ý nhất là tên field trong form input và mã lỗi ở các ca biên.

### Kiểm tra sau khi merge

```bash
npm install && npm run db:generate && npm run db:push
npm run test:p1        # kỳ vọng 72/72
npm run build          # Next type-check toàn bộ src/, kể cả code P1
npm run build:bridge && npm run test:p0
```

## Rủi ro và giới hạn

| Mục | Mức | Ghi chú |
| --- | --- | --- |
| Crypto stub | **Cao** | Danh tính chỉ được base64. Phải thay bằng Tide trước khi đưa dữ liệu thật vào |
| Chưa có proof G3/G4, chưa có Fabric | Trung bình | Quorum và quyền mở envelope do app kiểm. `proof` là optional và chưa được kiểm |
| Contract chưa đối chiếu với fixture P0 | Trung bình | 10 điểm cần chốt, xem p1-core.md |
| Next 16 type-check `src/` | Thấp | `tsc` riêng của P1 không lỗi, nhưng tsconfig ở root có thể chặt hơn |
| Lọc quyền trong bộ nhớ, cursor là offset | Thấp | Đủ cho dữ liệu demo, không hợp cho dữ liệu lớn |
| `EXPIRED` chỉ tính lúc đọc | Thấp | Không ghi lại vào DB |
| 7 lỗ hổng do `npm install` báo | Thấp | Theo handoff, không chạy `npm audit fix` |
| 4 method ngoài phạm vi | – | `endorseIdea` và 3 method đổi hội đồng trả `POLICY_UNAVAILABLE` |

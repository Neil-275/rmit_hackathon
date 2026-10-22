# VoiceVault — trạng thái dự án

Cập nhật: **22/10/2026**. Đây là điểm bắt đầu để xem phần đã làm và chọn việc tiếp theo trên `master`.

**Trạng thái chung: WIP. MOCK chạy được; tích hợp Tide LIVE chưa hoàn tất.** Test nghiệp vụ APP và build thành công không chứng minh G1–G5 hay quyền giải mã đã được Tide thực thi.

## Đã làm được

| Phần | Kết quả hiện tại |
| --- | --- |
| UI tĩnh | Giữ HTML/JS trong `public/ui/`; mở `index.html` bằng `file://` để chạy MOCK với dữ liệu hư cấu. |
| Next.js shell | Có hosting, đường đăng nhập và API `/api/v1`; production build thành công. |
| Domain/service | Có idea, report, chọn jury loại xung đột lợi ích, tạo vòng unmask, vote, quorum, expiry và audit ở lớp APP. |
| Persistence | Có Prisma/SQLite và roster demo; test dùng database tạm riêng. |
| HTTP authentication | Actor lấy từ credential được xác minh, không lấy subject/org/roles từ request body; thiếu cấu hình hoặc policy thì từ chối. |
| Unmask concurrency | Transaction chỉ cho một request chiếm phiên bản report và tạo vòng mới; request thua trả `VERSION_CONFLICT`, không để lại orphan round. |
| Current round / expiry | Vòng READY hết hạn không phát hành envelope; service chỉ chấp nhận vòng hiện hành của report. HTTP envelope vẫn khóa. |
| Voter decisions | Trả quyết định APPROVE/DENY thật của từng voter; không suy diễn `hasVoted` thành APPROVE. |
| Session | API 401 không còn biến session adapter cũ thành connected; login lấy capabilities từ server. |
| Browser bridge | Có `createVoiceVaultLiveRuntime()` bọc UI adapter, giữ voting purpose; không xuất stub auth/crypto ra global. Thiếu host auth adapter trả `POLICY_UNAVAILABLE`. |
| Khóa tính năng nhạy cảm | UI adapter và HTTP giữ submit/reveal không khả dụng khi provenance ciphertext và policy chưa được kiểm chứng. |
| Kiểm thử tích hợp | Có test payload từ SQLite/service qua HTTP dispatcher, adapter và DOM tĩnh; kiểm tra DENY, progress và không lộ ciphertext. |

## Kết quả kiểm tra

Kết quả trên cây code core continuation trước khi tích hợp; cần chạy lại khi merge làm thay đổi code.

| Kiểm tra | Kết quả |
| --- | --- |
| P0 — `node --test "tests/p0/*.test.mjs"` | **61/61 pass** |
| P1 — `node node_modules/vitest/vitest.mjs run --config tests/p1/vitest.config.mjs --reporter=dot` | **117/117 pass** |
| UI — `& ./public/ui/tests/run.ps1 -Suite all` | **31/31 pass**, với bundle đã sinh |
| TypeScript — `node node_modules/typescript/bin/tsc -p tests/p1/tsconfig.json` | **Pass**; test dùng cấu hình riêng, production vẫn kiểm tra kiểu |
| Bridge — `node scripts/build-bridge.mjs --check` | **Pass** |
| Next — `node node_modules/next/dist/bin/next build` | **Pass**, còn cảnh báo filesystem tracing của roster |
| Review độc lập | Không có lỗi Critical/Important trong phạm vi sửa core; lỗi nhỏ thiếu voting purpose đã sửa và test lại |
| Tide LIVE / G1–G5 | **CHƯA XÁC NHẬN** |

## Còn cần làm — theo thứ tự ưu tiên

- [ ] **Chốt contract UI/API với Tâm:** endorsement trước idea approval; category/status; assignment detail trước vòng vote đầu; public credit/verified; audit; capability và các shape còn khác nhau. Đối chiếu với `master` hiện tại, vì bảng reconciliation trên nhánh UI dùng baseline backend cũ.
- [ ] **Tích hợp `work/ui-static`:** nhận phần sửa tương tác, review và exploratory testing của Tâm sau khi đối chiếu contract; chạy lại P0/P1 và browser suite trên cây đã gộp.
- [ ] **Nối auth Tide thật cho UI:** cung cấp `window.VoiceVaultLiveConfig = { auth }` trước bootstrap; đối chiếu realm claims với server. Bridge hiện chỉ có điểm tiêm adapter, chưa cài adapter thật.
- [ ] **Hoàn tất Tide/license/policy/crypto:** provisioning theo quy trình; kiểm chứng provenance ciphertext và quyền giải mã. Chỉ mở submission/envelope/reveal khi cơ chế thật được xác nhận; không dùng stub hoặc bypass để demo LIVE.
- [ ] **Triển khai và kiểm chứng G1–G5 end-to-end**, gồm các trường hợp từ chối và bảo vệ identity; ghi bằng chứng thực tế.
- [ ] **Hoàn tất chức năng còn thiếu:** council-change service và policy, endorsement, public-credit verification; thống nhất quy trình tạo vòng mới sau DENIED/EXPIRED và pagination vượt 50 bản ghi.
- [ ] **Làm browser test độc lập với generated bundle:** test có tên “without a LIVE bundle” hiện kỳ vọng `POLICY_UNAVAILABLE`; khi bundle thật sự thiếu, bootstrap trả `LIVE_RUNTIME_UNAVAILABLE`. P0 đã có coverage riêng cho missing bundle.
- [ ] **Xử lý cảnh báo roster filesystem tracing** trước khi đóng gói triển khai, rồi rà soát log riêng tư, cấu hình và chạy lại toàn bộ checks.

## Phân công để tránh trùng

| Người/phần | Phạm vi |
| --- | --- |
| Tâm — `work/ui-static` | `public/ui/**`: sửa code review, kiểm thử council lifecycle, juror unmask, error scenarios, keyboard và mobile. Mốc đã đọc: `ba3466e`. |
| Core/backend | `src/**`, `app/**`, `public/integration/**`, Prisma, package/build và `tests/p0`, `tests/p1`. |
| Cả hai | Chốt contract/fixtures và các tài liệu dùng chung trước khi sửa đồng thời hoặc merge. |

Phần core continuation không sửa `public/ui/**`; các commit riêng trên `work/ui-static` chưa được nhập trong đợt này.

## Tài liệu chi tiết

- [Core continuation: thay đổi, kiểm tra và giới hạn](docs/integration/core-status.md)
- [Handoff gốc ngày 22/10/2026](docs/integration/HANDOFF-2026-10-22.md) — bản ghi lịch sử, một số lỗi trong đó đã được sửa như bảng trên.
- [Phân công UI trên nhánh của Tâm](https://github.com/Neil-275/rmit_hackathon/blob/work/ui-static/docs/integration/ui-status.md)
- [Đối chiếu contract trên nhánh UI](https://github.com/Neil-275/rmit_hackathon/blob/work/ui-static/docs/integration/contract-reconciliation.md)

Sau mỗi phần việc, cập nhật file này với kết quả đã kiểm tra và việc còn lại. Không đưa `.env`, credential, token, database hay generated bundle vào Git.

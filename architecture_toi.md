# Architecture — Phần của tôi: UI chạy không cần Next.js hoặc Docker

> Đầu ra của bạn: giao diện HTML/CSS/JavaScript thuần, mở trực tiếp trong trình duyệt.
> Máy bạn không cần Node.js, npm, Next.js, Docker, database hoặc TideCloak SDK.
> Tùng đã xác nhận chạy được Next.js và Docker; Tùng phụ trách toàn bộ build/runtime thật.
> Đây là hướng dẫn triển khai, các file UI/script bên dưới chưa được tạo trong lần cập nhật tài liệu này.

Đọc cùng [Architecture của Tùng](./architecture_tung.md) và [thiết kế nghiệp vụ/bảo mật chung](./voicevault_technical_architecture.md). Tài liệu này chốt cách làm trên máy bạn; không làm theo lệnh npm/Docker dành cho Tùng.

## 1. Bạn làm gì, Tùng làm gì?

| Bạn | Tùng |
| --- | --- |
| HTML, CSS, JavaScript giao diện | Next.js server, API, DB, Docker |
| Form sáng kiến và phản ánh | Auth, TideCloak SDK và crypto chạy ở browser |
| Hiển thị council, N/T, danh sách voter, tiến độ | Bootstrap roster, chọn ngẫu nhiên N/người, verify vote, đổi roster |
| Mock hành vi để thử màn hình | Runtime LIVE cùng interface, proof, policy, QEA |
| Trải nghiệm lỗi/loading/empty, responsive | Build, migration, unit/integration/live/E2E tests |
| Kịch bản nghiệm thu, ảnh lỗi, nội dung demo | Merge, chạy ứng dụng thật, cung cấp kết quả kiểm chứng |

Bạn viết UI có tương tác được và dùng lại trực tiếp trong ứng dụng cuối. Không cần viết React/TSX hoặc bàn giao ảnh để Tùng dựng lại.

## 2. Cấu trúc file bạn sở hữu

~~~text
public/
├── ui/                             bạn sở hữu toàn bộ
│   ├── index.html
│   ├── styles.css
│   ├── app.js
│   ├── mock-runtime.js
│   ├── views/                      JS thường, chỉ tách khi cần
│   └── assets/                     ảnh/icon/font local, không dữ liệu thật
└── integration/                    Tùng sở hữu, bạn không sửa
    ├── bootstrap.js                 chạy cả local và LIVE
    ├── contract-fixtures.js         fixture giả + contract version
    └── runtime.generated.js         Tùng build; local mock không cần file này
~~~

Tùng cung cấp bootstrap và fixtures tối thiểu trước để bạn mở index.html được. Khi thiếu chúng, ghi rõ đang chờ handoff; không thay bằng cách cài npm trên máy bạn.

Quy tắc kỹ thuật:

- HTML/CSS/JS thuần; không React, JSX/TSX, Tailwind cần build, npm import hoặc thư viện chỉ dùng qua bundler.
- Dùng CSS thường, asset và font local; không phụ thuộc CDN để mở offline.
- Dùng classic script có defer, namespace window.VoiceVaultUI; không ES module/import trên file://.
- Không fetch JSON để lấy fixture khi mở file://. Tùng cung cấp fixture JavaScript gán window.VoiceVaultFixtures.
- Dùng đường dẫn tương đối cho asset/script để cùng hoạt động ở file:// và /ui/index.html.
- Dữ liệu nhập được render bằng textContent hoặc DOM API an toàn, không innerHTML với nội dung người dùng.
- Mock chỉ lưu dữ liệu giả trong memory; reload reset được, không localStorage chứa danh tính.

## 3. Mở UI mà không cài gì

1. Nhận baseline/ZIP có public/ui và public/integration/bootstrap.js + contract-fixtures.js.
2. Mở public/ui/index.html bằng trình duyệt. Nếu trình duyệt của máy chặn local script theo policy riêng, gửi lỗi Console cho Tùng để chuẩn bị bản HTML self-contained chỉ dùng mock.
3. Kiểm tra banner “Dữ liệu mô phỏng — không kết nối TideCloak”.
4. Sửa HTML/CSS/JS trong editor, lưu rồi refresh trình duyệt.
5. Dùng DevTools Console để tìm lỗi UI, nhưng không nhập token hoặc dữ liệu nhân viên thật để thử.

Không cần local server, Python, npm install, npm run dev hoặc Docker. Không đăng nhập TideCloak thật từ file://.

Khung load script cần chốt với Tùng:

~~~html
<link rel="stylesheet" href="./styles.css">
<script defer src="../integration/contract-fixtures.js"></script>
<script defer src="./mock-runtime.js"></script>
<script defer src="./app.js"></script>
<script defer src="../integration/bootstrap.js"></script>
~~~

app.js định nghĩa VoiceVaultUI.mount(runtime), không tự chạy trước bootstrap. Bạn báo lỗi nếu runtime/contract không khớp, không tự chuyển LIVE lỗi thành mock.

## 4. Cách nối UI với hệ thống thật

Bạn chỉ gọi interface VoiceVaultRuntime v1 ở mục 5.4 của tài liệu chung. Có hai implementation:

- MOCK: bạn viết trong mock-runtime.js, dùng fixtures của Tùng, không crypto/API thật.
- LIVE: Tùng viết và build; nó xử lý login, token, canonical hash, proof, browser encryption, API và validation.

Ví dụ luồng submit:

~~~text
Bạn: form -> runtime.submitReport(formInput) -> render ApiResult
Tùng: runtime LIVE -> xác thực phiên -> mã hóa tại browser -> POST API
~~~

Không tự tạo reporterCiphertext, không tự verify token hoặc ký approval trong UI. Tùng cũng không đưa plaintext identity qua server để thay browser crypto.

UI không fetch endpoint trực tiếp và không đọc token. Nếu cần action mới, đề xuất tên/input/output cho Tùng cập nhật contract trước.

## 5. Danh sách màn hình và việc phải làm

| Màn hình | Đầu ra của bạn |
| --- | --- |
| Tổng quan | Navigation/tab, persona đang dùng, MOCK/LIVE banner và loading/error |
| Ý tưởng | List/detail, form gửi, consent công khai credit, endorse/decision actions theo capability |
| Phản ánh | Form nhiều accused IDs, list/detail theo quyền, trạng thái chờ đủ hội đồng |
| Bỏ phiếu | N, T, voter list, independent badge, phiếu hợp lệ và expiry; dùng một VotePanel chung |
| Hội đồng | Roster hiện hành/version, xem đề xuất/diff roster, nút tạo proposal, pending/applying/applied |
| Audit | Phân biệt APP/FABRIC/QEA/CLIENT/SIMULATED, không nội dung nhạy cảm |

Các state cần mock: loading, empty, validation error, 401, 403, quorum pending, thiếu eligible, stale version, expired, integrity mismatch, POLICY_UNAVAILABLE và success. Không chỉ làm happy path.

Mẫu giả được thử:

- N=3, T=2; N=4, T=3; N=5, T=4.
- Thành viên không nằm trong voter list không có nút vote.
- Đạt READY chưa có nghĩa council mới APPLIED.
- Roster cũ vẫn hiện là roster có hiệu lực khi proposal chưa APPLIED.
- Người mới chưa có quyền vote bổ nhiệm mình.
- Một independent duy nhất cần bổ sung người thay trước khi có thể loại người cũ nếu eligibility không đủ.

UI hiển thị N/T do runtime trả, không hard-code hai phiếu là đủ và không tự bốc lại mỗi lần refresh. Capability chỉ giúp hiển thị; quyền thật do API/policy thực thi.

## 6. Thứ tự làm để không chờ Tùng

| Mốc | Bạn làm | Cần Tùng bàn giao |
| --- | --- | --- |
| U0 | Layout, tab, card/form cơ bản | Runtime interface + fixtures + bootstrap chạy file:// |
| U1 | Ý tưởng/reflection form, mock-runtime theo interface | Fixture success/error và view model đã chốt |
| U2 | VotePanel/council proposal, N/T/state UX | Fixture các kích thước, stale/apply/error |
| U3 | Responsive/accessibility, lỗi/empty/loading, kịch bản demo | Ghi chú capability và enum chính thức |
| U4 | Handoff UI, review LIVE qua browser nếu có URL | Tùng merge/build và gửi kết quả test/URL hoặc screen share |

Không cần chờ API xong để làm U0–U3. Khi Tùng sửa view/contract, nhận fixture mới rồi sửa consumer, không tự đoán type.

## 7. Git và bàn giao cho Tùng

Branch của bạn: work/ui-static, từ SHA integration/voicevault đã thống nhất. Bạn chỉ dùng Git nếu có sẵn, không có bước npm/DB.

~~~powershell
git fetch origin
git switch -c work/ui-static --track origin/integration/voicevault
git push -u origin work/ui-static
~~~

Nếu branch đã có thì switch branch hiện tại, không chạy lại switch -c. Trước đổi branch phải lưu/commit việc đang dở và working tree sạch.

Mỗi milestone:

1. Mở index.html, thử màn hình và Console.
2. git status --short; review diff, chỉ stage public/ui và handoff của mình.
3. Commit/push work/ui-static; gửi SHA + file + kết quả browser.
4. Không tự merge master/integration, không sửa public/integration hoặc package/lockfile.
5. Sau Tùng merge thành công, nhận integration trên branch mình:

~~~powershell
git fetch origin
git merge origin/integration/voicevault
~~~

Mở lại index.html để kiểm tra. Không chạy npm ci hoặc migration dù branch có thêm package.json.

Nếu máy cũng không dùng Git được, gửi ZIP public/ui + handoff, không .git/env/database. ZIP phải giữ cấu trúc đường dẫn và ghi baseline SHA đã dựa vào; Tùng nhập vào branch riêng, so diff rồi merge. Không ghi đè toàn repository.

## 8. Checklist nghiệm thu trên máy bạn

- [ ] Mở index.html với file://, không cần cài dependency.
- [ ] CSS/asset/classic script tải được, không cần mạng/CDN.
- [ ] Không có fetch JSON/ES module khiến local preview hỏng.
- [ ] Ban đầu ghi MOCK; lỗi LIVE không biến thành success giả.
- [ ] Form có validation, submit/loading/error/retry hợp lý.
- [ ] UI dùng N/T và roster version từ runtime, đủ các mẫu 3/4/5.
- [ ] Pending/READY/APPLYING/APPLIED/STALE hiển thị khác nhau.
- [ ] Không token, plaintext reporter hoặc dữ liệu thật được lưu/log.
- [ ] Responsive/keyboard/focus/label và nội dung người dùng không gây HTML injection.
- [ ] Handoff có SHA/baseline, ảnh/steps lỗi và kết quả browser.

Kiểm thử UI mock không chứng minh auth, crypto, quorum hay policy thật. Các kết quả này ghi “chưa kiểm chứng trên máy tôi”, Tùng kiểm tra LIVE.

## 9. Prompt cho coding agent trên máy tôi

~~~text
Đọc architecture_toi.md và runtime contract mục 5.4 trong tài liệu chung.
Máy này không chạy Node.js/npm/Next.js/Docker, không yêu cầu cài chúng.
Chỉ tạo/sửa public/ui bằng HTML/CSS/JavaScript classic và asset local.
Mở index.html trực tiếp bằng browser phải xem được mock UI.

Định nghĩa window.VoiceVaultUI.mount(runtime) và mock runtime đúng v1.
Dùng fixture JS của Tùng, không fetch JSON/import ES module/npm/CDN.
Không viết React/TSX, backend, SDK crypto, API fetch hoặc đọc token.
UI gọi high-level runtime methods, render ApiResult và capabilities.
Hiển thị N/T ngẫu nhiên do runtime trả, council version và proposal state.
Mock có nhãn, không giả Fabric proof/deny hoặc fallback khi LIVE lỗi.
Không hard-code hai phiếu là đủ, không cho sửa roster trực tiếp.

Làm milestone được giao, kiểm tra browser/Console nếu công cụ có sẵn;
không nhận đã chạy browser test nếu chưa chạy. Bàn giao file/SHA/steps.
~~~

## 10. Mẫu handoff

~~~text
Milestone / baseline SHA / commit SHA hoặc ZIP:
Runtime contract version:
File đã sửa (chỉ public/ui):
Màn hình/state đã làm:
Cách mở index.html:
Browser đã thử / kích thước màn hình:
Kết quả mock manual / ảnh lỗi / steps:
Method hoặc fixture cần Tùng bổ sung:
Việc chưa kiểm chứng LIVE:
~~~

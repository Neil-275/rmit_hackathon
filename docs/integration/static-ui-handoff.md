# Bàn giao static UI cho Tùng

Baseline tài liệu: `8725f1a`. Thay đổi hiện ở working tree, chưa commit/merge/push.
Môi trường không cho tạo Git ref nên chưa tạo được `work/ui-static`.
Phạm vi đã implement: phần giao diện của `architecture_toi.md` và runtime MOCK v1.
Backend, database, IAM và TideCloak LIVE theo `architecture_tung.md` chưa implement trong đợt này.

## Ownership và thứ tự merge

| Đường dẫn | Người phụ trách | Lưu ý |
| --- | --- | --- |
| `public/ui/` | Bạn | HTML, CSS, views, mock runtime và test |
| `public/integration/bootstrap.js` | Tùng | Baseline tối thiểu được tạo để mở UI; review trước khi nhập |
| `public/integration/contract-fixtures.js` | Tùng | Fixtures giả dùng chung; giữ global và contractVersion |
| `public/integration/runtime.generated.js` | Tùng | Chưa có; bundle LIVE dạng classic script/IIFE |
| Contract/API/schema/dependency/migration | Tùng | UI không thay đổi các phần này |

1. Tùng tạo/kiểm tra baseline `integration/voicevault` theo kiến trúc chung; ghi lại SHA.
2. Khi Git có thể ghi, đưa các file của đợt này vào `work/ui-static`. Chỉ stage file liên quan;
   không stage `taste-skill-main.zip`, thư mục skill được tải về, log hay profile trình duyệt.
   Không chuyển nhánh khi còn thay đổi chưa được bảo toàn. Không reset/chép đè cả repository.
3. Tùng đối chiếu hai file integration ở bảng trên với baseline của mình. Nếu đã có phiên bản riêng,
   merge nội dung có chọn lọc; giữ thứ tự script và quy tắc file/HTTP ở phần dưới.
4. Fetch hai nhánh, tạo nhánh tích hợp tạm từ `integration/voicevault`. Merge `work/server-policy`
   rồi `work/ui-static` với `--no-ff --no-commit`; review, giải conflict, chạy test trên cây đã merge
   trước khi tạo merge commit. Nếu không có conflict, Git vẫn dừng trước commit để review.
5. Chạy kiểm thử local và kiểm thử LIVE của Tùng. Ghi SHA UI, SHA server và kết quả G1–G5 vào handoff.
   Chỉ cập nhật integration sau khi các kiểm tra cần thiết đạt.
6. Máy bạn nhận lại integration và mở `public/ui/index.html`; không cần chạy npm hay migration.

Nếu dùng ZIP: chỉ gửi `public/ui/`, tài liệu bàn giao và hai file integration để Tùng **review riêng**.
ZIP giữ đường dẫn tương đối, không có `.git`, `.env`, database hay credential.
Tùng nhập ZIP vào nhánh import từ SHA baseline đã ghi, xem diff rồi mới merge.

## Bootstrap LIVE

`index.html` dùng classic `defer` theo thứ tự: fixtures → mock → helpers → dialogs → pages → app → bootstrap.
Không có import ES module, CDN hay fetch JSON khi mở file.

- `file://`: factory `window.createVoiceVaultMock(window.VoiceVaultFixtures)`.
- HTTP(S): bootstrap tải `../integration/runtime.generated.js` và gọi
  `await window.createVoiceVaultLiveRuntime()`. Factory phải trả `{mode:'LIVE', contractVersion:'v1', ...methods}`.
- Mỗi lần mount gọi `init()`; `init.data` là SessionView. Không có LIVE bundle/không tương thích/không có policy
  phải báo lỗi. Tuyệt đối không gắn runtime MOCK với nhãn LIVE.
- Factory LIVE chỉ là browser adapter. Không nhúng server secret, refresh token hoặc private key vào bundle.

## Hình dạng dữ liệu UI đang dùng

Tất cả method trả `Promise<ApiResult<T>>`:

```js
{ ok: true, data, requestId, contractVersion: 'v1' }
{ ok: false, error: { code, message, enforcement, retryable }, requestId, contractVersion: 'v1' }
```

Đây là shape bàn giao của static UI, cần đối chiếu/chốt với schema LIVE của Tùng;
không phải tuyên bố adapter hay API LIVE đã được kiểm thử.

| View | Trường UI cần |
| --- | --- |
| Session | `authenticated, subject, displayName, role, capabilities.canSubmit` |
| Page | `items, nextCursor`; UI hiện lấy tối đa 50 bản ghi, chưa có phân trang LIVE |
| Idea | `id,title,description,category,status,version,createdAt,publicCredit,capabilities` |
| Idea capabilities | `canEndorse,canDecide,canReveal`; publicCredit chỉ xuất hiện khi được phép |
| Report | `id,title,evidenceDetails,accusedPersonIds,createdAt,status,version,voters,voterCount,quorumRequired,votingRequestId,voting,capabilities.canRequestUnmask` |
| VotingRequest | `id,resourceId,operation,voters,voterCount,quorumRequired,councilVersion,status,approvalCount,validApprovals,independentApproved,expiresAt,recipientSubject,canVote,canReveal` |
| Voter / Vote | Voter: `id,displayName,independent`; Vote: `voterId,decision,reason` |
| Council | `version,selectionPolicy,members,capabilities.canPropose`; member: `subject,displayName,title,active,independent,membershipRole` |
| CouncilChange | `id,reason,baseCouncilVersion,status,proposedMembers,proposedSelectionPolicy,voting,capabilities.canApply` |
| Directory | `people:[{id,displayName,title,department}]` |
| Audit | Page; event: `action,actor,targetId,enforcement,createdAt`; không có identity/contact/token |
| Reveal | `displayName,contact?`; MOCK thêm `simulated:true`. Chỉ truyền cho dialog, không lưu vào page state |

Danh sách method ở architecture §5.4 được giữ nguyên. Các input mutation hiện dùng:

```js
submitIdea({ title, description, category, publishCreditOnApproval })
endorseIdea(ideaId, expectedVersion)
decideIdea(ideaId, { decision, reason, expectedVersion })
submitReport({ title, evidenceDetails, accusedPersonIds, contact, consent, clientRequestId? })
createUnmaskRequest(reportId, { recipientSubject, purpose })
getVotingRequest(votingRequestId)
castVote(votingRequestId, { decision, reason })
submitCouncilChange({ expectedCouncilVersion, reason, proposedMembers, proposedSelectionPolicy })
applyCouncilChange(changeId, baseCouncilVersion)
revealIdentity(kind, resourceId, votingRequestId?) // kind = IDEA | REPORT
```

`createUnmaskRequest` trả `{id,votingRequestId,voting}`. Report mới có assignment nhưng `voting:null`;
assigned juror mở chi tiết và tạo request. `listReports`/`listCouncilChanges` trả voting summary lồng sẵn
để render. UI chưa polling; adapter cần trả trạng thái mới khi refresh, hoặc bổ sung subscription sau.
Ba report seed đã có request để demo ngay N=3/4/5.

Capability chỉ giúp hiển thị UI; server và cơ chế Tide phải kiểm chứng mọi thao tác độc lập.
MOCK không tạo proof, binding hash hay authorization mật mã thật.
Request DENIED/EXPIRED không được tự mở lại trong UI hiện tại; không đổi N/người để tìm kết quả thuận lợi.
Luồng tạo request mới sau vòng kết thúc và phân trang cần chốt thêm khi nối LIVE.

## Bằng chứng kiểm tra

- `& ./public/ui/tests/run.ps1 -Suite all`: bộ test runtime và browser; kết quả cuối ghi trong plan.
- Test thực thi mock implementation, DOM thật qua Chrome và HTTP startup khi thiếu LIVE bundle.
- Có regression cho N=4/5, phiếu trùng/không được chọn, thiếu independent, consent, CoI nhiều accused,
  giữ assignment khi retry/khởi tạo request, READY/APPLIED/STALE/expiry, XSS và reveal đến muộn sau logout/đổi trang/đổi persona.
- Review độc lập tìm ba lỗi quan trọng; đã tái hiện bằng test fail rồi sửa và chạy lại:
  identity race, audit lộ submitter, apply council sau expiry.
- Chrome headless test cần cờ `--no-sandbox` trong profile tạm trên máy này; mở HTML bình thường không cần cờ đó.
- Node tích hợp VS Code có thể in cảnh báo Crashpad `Access is denied`; kết quả test và exit code vẫn được thu riêng.

**G1, G2, G3, G4, G5: NOT RUN.** Chưa có LIVE adapter/TideCloak/backend để kiểm chứng.
Không dùng kết quả MOCK hoặc visual inspector để tuyên bố các gate này đã đạt.

# Architecture — Phần của Tùng: platform, browser runtime và tích hợp

> Tùng chạy được Next.js và Docker; máy người còn lại không chạy được hai công cụ này.
> Tùng sở hữu toàn bộ toolchain/runtime thật. Người còn lại viết HTML/CSS/JS thuần trong public/ui, xem bằng file://.
> Giữ nguyên các yêu cầu council roster, random N/voters và vote thay đổi hội đồng trong tài liệu chung.
> Đây là hướng dẫn triển khai; lần cập nhật này chỉ viết tài liệu, không dựng app.

Đọc [Architecture của bạn cùng nhóm](./architecture_toi.md) và [thiết kế chung](./voicevault_technical_architecture.md). File này là runbook dành cho Tùng; không yêu cầu máy bên kia chạy npm/DB.

## 1. Thiết kế tích hợp đã chọn

~~~text
Máy bạn cùng nhóm:
  public/ui/index.html + CSS/JS classic
    -> MOCK runtime + fixture JS -> browser, không server/dependency

Máy Tùng:
  Next.js phục vụ /ui/index.html
    -> cùng UI
    -> LIVE browser runtime do Tùng build
    -> browser TideCloak SDK / crypto
    -> API /api/v1 -> services -> SQLite / policy / QEA
~~~

Không chuyển UI sang React khi merge. Next.js phục vụ file trong public ở URL tương ứng từ root; đây là cách đưa nguyên HTML/CSS/JS vào ứng dụng. Root page có thể redirect tới /ui/index.html, không tạo page khác trùng đường dẫn static. [Next.js public folder](https://nextjs.org/docs/app/api-reference/file-conventions/public-folder).

Public folder chỉ có code/config công khai và fixture giả, không DB/secret/identity thật. UI tĩnh không phải lớp auth; API và policy vẫn bảo vệ dữ liệu.

## 2. File Tùng sở hữu

~~~text
architecture_tung.md
package.json / package-lock.json / tsconfig / next.config / CI
.env.example / config/ / prisma/ / tests/ (automated)
public/integration/
  bootstrap.js                    classic JS, local mock và LIVE selection
  contract-fixtures.js             JS public, dữ liệu giả, track trong Git
  runtime.generated.js             generated bundle, gitignore, chỉ LIVE
public/auth/
  callback / silent-SSO assets     theo SDK đã pin và smoke test
src/
  app/                            host/redirect + API, không UI phải viết lại
  contracts/                      DTO/schema/encoding + fixture source
  integration/browser-runtime.ts  SDK bridge chạy browser, không server crypto
  server/                         auth/domain/DB/council/voting/policy/audit
scripts/                          bridge build, fixture export, smoke tests
docs/integration/                 baseline/gates/handoff/test results
~~~

Người còn lại sở hữu public/ui, bao gồm index/styles/app/mock-runtime/views/assets. Muốn đổi HTML/script tag thì gửi yêu cầu và bàn giao file trước; không tự sửa UI để che runtime mismatch.

Tùng nhận toàn bộ automated tests, bao gồm file:// UI smoke và browser LIVE. Bạn cùng nhóm chỉ cần manual test giao diện, không cần cài test runner.

## 3. Baseline đầu tiên phải bàn giao sớm

Không chờ API/policy hoàn chỉnh mới cho UI làm việc. Commit foundation tối thiểu có:

1. Contract runtime v1 và view fixtures đã chốt.
2. public/integration/contract-fixtures.js là JS thường gán window.VoiceVaultFixtures, không fetch JSON.
3. public/integration/bootstrap.js không phụ thuộc Node trong browser.
4. public/ui/index.html shell và app.js với mount hook, bàn giao ownership cho bạn cùng nhóm.
5. Một mẫu mock runtime tối thiểu hoặc hướng dẫn factory để UI mở file:// được.
6. Check trên browser: mở index.html bằng file://, không server, Console không lỗi.

Sau đó Tùng scaffold/pin Next.js/React/Tide SDK/Prisma/tooling trên máy mình; giữ root repository, không tạo repo lồng nhau. Commit package/config và manifest baseline, không bắt bên kia cài theo.

## 4. Bootstrap và hai chế độ chạy

Load order được ghi ở architecture_toi.md: fixture JS -> mock-runtime.js -> app.js -> bootstrap.js, tất cả classic defer.

Bootstrap chịu trách nhiệm:

- file://: chỉ khởi tạo factory mock, đặt mode=MOCK, bật banner và gọi VoiceVaultUI.mount(mockRuntime). Không tải SDK/generated bundle, không gọi API hay Tide login.
- HTTP(S): chỉ khởi tạo LIVE runtime, gọi init rồi mount; bundle/config/service lỗi phải hiện lỗi kết nối, không chuyển mock.
- Contract version khác: dừng với CONTRACT_MISMATCH, không chạy UI bằng shape đoán.
- UI mount một lần, có loading/error lifecycle; SDK init/login redirect không được tạo vòng lặp.
- Không để query string người dùng bật mock trong LIVE hoặc tự gắn FABRIC-denied. Backend không tin mode/capability client.

Mock có thể vẫn là asset công khai; việc ai đó tự mở mock không tạo quyền server. Live security test phải xác minh đang thực hiện request thật và mode=LIVE, không chỉ nhìn badge.

## 5. LIVE runtime: phần khó Tùng nhận thay người còn lại

Interface chính xác ở mục 5.4 tài liệu chung. Tùng implement cùng surface như mock:

- Session/login/logout với SDK đã pin; không lộ raw token cho UI.
- Danh sách/view qua API adapter và ApiResult; validate response runtime.
- submitIdea/submitReport: nhận form input trong browser, sinh UUID, canonical hash, lấy identity từ phiên thật, tạo proof/encrypt, gửi DTO ciphertext tới server.
- castVote: lấy context bất biến, tạo proof thật và submit đúng votingRequestId, không chấp nhận phiếu tự khai.
- revealIdentity: kiểm policy/challenge/binding/proof; plaintext chỉ trả vào view tạm trong browser, không POST plaintext về server.
- council proposal/apply: shared VotingService, version/hash/N/T, ngăn apply trước đủ proof.
- Audit hiển thị đúng APP/FABRIC/QEA/CLIENT/SIMULATED.

Runtime là code browser do Tùng build; không chuyển encryption/decryption sang Next.js server chỉ để dễ nối UI.

Cần adapter Tide SDK Vanilla JS thay vì yêu cầu UI dùng React provider/hook. G1 vẫn phải chứng minh cross-user sharing; tag wrapper không tự bổ sung resource policy.

### 5.1. Build browser bridge

Tùng có thể bundle src/integration/browser-runtime.ts bằng esbuild thành IIFE/classic script, đưa vào public/integration/runtime.generated.js. Chọn/pin bản bundler tương thích trong baseline. [esbuild bundling và format](https://esbuild.github.io/api/#bundle).

Script cần tạo:

| Script | Công việc |
| --- | --- |
| build:fixtures | Export fixture JS từ nguồn contract, chỉ dữ liệu giả; kiểm diff trước commit |
| build:bridge | Bundle browser runtime, xử lý asset/worker nếu SDK yêu cầu |
| dev | Build bridge trước, sau đó Next dev; rebuild bridge khi source runtime đổi |
| build | Build bridge trước Next build, bảo đảm bundle nằm trong public trước build |
| test:ui:file | Browser mở file:// index.html, SDK/API không được gọi |
| test:ui:live | Browser mở /ui/index.html qua Next, runtime LIVE/API/auth thật |
| check | Bổ sung kiểm contract/runtime/fixture và bridge build vào checks chung |

Generated runtime không cần có trên máy bạn cùng nhóm và không commit như source. bootstrap/fixture JS phải track để local preview không hỏng sau checkout mới.

Kiểm cả tải assets SDK, callback, CSP, CORS/issuer và runtime config; đừng nhận bundle một file là đủ trước khi smoke test SDK thật. Credential/admin secret không được embed vào bundle/config.

## 6. Backend, council và policy giữ nguyên trách nhiệm

Tùng thực hiện toàn bộ mục 6–11 và 14–16 của tài liệu chung:

- Verify JWT/org/role thật; không chỉ kiểm Bearer prefix.
- Validation/idempotency/persistence/optimistic version/outbox.
- Roster chốt lúc bootstrap; min/max mặc định 3/5.
- Bốc N rồi N voters sau CoI; T=ceil(2N/3), có independent và assignment bất biến.
- Shared VotingService cho mở danh tính và council change.
- Chưa APPLIED thì roster cũ còn hiệu lực, candidate không vote bổ nhiệm mình, stale proposal không tự rebase.
- QEA là lớp kỹ thuật bổ sung, không thay vote nghiệp vụ.
- Gate G1–G5 chưa đạt giữ chức năng khóa, không fake proof hoặc cấp role rộng để demo.
- Không lưu reporter plaintext hoặc log token/payload nhận diện.

Mọi npm/Docker/Prisma/CI/live security command trong hướng dẫn chung đều do Tùng chạy. Người còn lại có thể xem kết quả qua screen share hoặc URL test đã được cung cấp, không phải dựng hệ thống lần hai.

## 7. Chạy riêng và chạy chung

### Chạy riêng

- Người còn lại mở file:// và làm UI mock.
- Tùng chạy Next/Docker/API và LIVE runtime trên máy mình.
- Contract/fixture thay đổi thì commit baseline nhỏ trước để UI cập nhật; không bắt người kia đọc TS để đoán JSON.

### Chạy chung sau merge

1. Nhận commit UI, giữ nguyên public/ui.
2. Merge vào integration/voicevault theo mục 8.
3. Build fixtures/bridge, validate/migrate/generate/seed DB local của Tùng.
4. Chạy Next rồi mở /ui/index.html, không mở file:// để chứng minh LIVE.
5. Kiểm relative CSS/JS/assets, bootstrap chọn LIVE, SDK callback trở về đúng route.
6. Test UI action gọi runtime rồi API thật; xem network để tránh demo chỉ dùng mock.
7. Test G1–G5, N=3/4/5, đủ/thiếu T, council pending/applied/stale và auth khác persona.
8. Gửi SHA, ảnh hoặc video và kết quả cho người kia review UX.

localhost trên máy Tùng không tự truy cập được từ máy người kia. Nếu đã có URL test HTTPS hợp lệ thì cung cấp URL; nếu chưa, screen share/record kết quả. Không bắt họ cài Next/Docker để review.

## 8. Git và merge

Branch Tùng: work/server-policy. Branch người kia: work/ui-static. Cùng từ integration/voicevault baseline.

Tùng là single writer của dependency/lockfile/contracts/migration/integration. Bạn cùng nhóm commit UI hoặc gửi ZIP public/ui có baseline SHA; ZIP không chứa .git/env/database. Tùng nhập ZIP vào branch import riêng rồi review diff, không chép đè cả repo.

Mỗi mốc merge API/runtime hoặc UI nhỏ, không chờ xong hết:

~~~powershell
git fetch origin
git switch integration/voicevault
git pull --ff-only origin integration/voicevault
git status --short
git merge --no-ff --no-commit origin/work/ui-static
~~~

Sau giải quyết conflict, trên cây kết quả:

~~~powershell
git diff --check
git diff --cached --check
npm ci
npm run build:fixtures
npm run build:bridge
npm run db:validate
npm run db:migrate:deploy
npm run db:generate
npm run check
npm run test:ui:file
npm run test:integration
~~~

Đối chiếu fixture export có thay contract ngoài dự kiến không. Nếu contract đổi, chốt với người kia trước, không tự sửa UI cho khớp một API mới chưa review.

Khởi động app/test prerequisites rồi chạy test:ui:live, live security và E2E cần thiết. Đạt mới commit merge/push integration. Already up to date thì kiểm handoff SHA, không tạo commit rỗng.

Mọi reset/drift/migration conflict theo runbook chung; không reset DB để ép xanh. Git abort/revert không hoàn tác DB/realm/grant.

Sau merge, người kia chỉ fetch/merge Git rồi mở index.html lại, không chạy npm/Prisma. Tùng chịu trách nhiệm fresh checkout build toàn bộ app.

## 9. Milestone thực tế

| Mốc | Tùng bàn giao/kiểm tra |
| --- | --- |
| T0 | Bootstrap + fixture + runtime contract, file:// shell mở được |
| T1 | Next static hosting + /me/API skeleton + bridge init; UI không phải đổi sang React |
| T2 | LIVE submit/decision/reveal ý tưởng + G1/G2/G4 |
| T3 | LIVE report/vote/council change + G3/G5 |
| T4 | Merge UI, file/local/live checks, privacy, concurrency, fresh DB |
| T5 | Đối chiếu README/demo, SHA chung và handoff |

Tùng nhận nhiều phần kỹ thuật hơn vì máy có toolchain; người kia nhận đủ màn hình, UX state, fixture-driven UI và demo để Tùng tập trung runtime/policy.

## 10. Prompt cho coding agent trên máy Tùng

~~~text
Đọc architecture_tung.md, architecture_toi.md và thiết kế chung.
Chỉ máy này chạy được Next.js/Docker; bạn cùng nhóm chỉ mở HTML trong browser.
Sở hữu platform/API/DB/IAM/policy, browser LIVE runtime, build/CI/tests.
Giữ UI public/ui của người kia, không viết lại React/TSX hoặc yêu cầu họ npm.

Bàn giao sớm bootstrap.js + contract-fixtures.js chạy file://.
Runtime MOCK/LIVE cùng interface v1; HTTP(S) chỉ LIVE, lỗi không fallback.
Bundle SDK Vanilla JS cho browser, không đưa crypto sang server, không lộ token.
Tạo script bridge build trước Next build và file:// + LIVE browser smoke tests.

Giữ roster bootstrap, random N/voters, T=ceil(2N/3), vote council change,
idempotency, proof/context/version, fail closed khi G1–G5 chưa kiểm chứng.
Merge UI qua branch, test cây đã merge, báo SHA và kết quả thực.
Không sửa file UI người kia nếu chưa bàn giao ownership.
~~~

## 11. Handoff từ Tùng

~~~text
Milestone / commit SHA / baseline SHA:
Runtime contract version / methods đã LIVE:
Fixture/bootstrap thay đổi:
SDK/Next/Node/npm/Prisma/image/policy version:
Lệnh đã chạy + kết quả (file UI / integration / LIVE / G1–G5):
Prerequisite hoặc URL test/screen share:
Lỗi/giới hạn chưa đạt, method đang POLICY_UNAVAILABLE:
Việc UI cần chỉnh / file ownership cần bàn giao:
~~~

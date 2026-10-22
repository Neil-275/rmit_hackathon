# Lỗi `init/tcinit.sh`: Tide license không thiết lập được (Midgard.FinalizeWallet 500)

Ngày 22/10/2026, máy Tùng. Giờ ghi theo UTC (log container); giờ VN = UTC+7.
Repo: `origin/work/server-policy`, commit `7968226`.

## Kết luận (cập nhật)
Tide đã xác nhận lỗi nằm ở phía server của họ. **Quyết định:** trong bản nộp hackathon, mọi bước phụ thuộc Tide (login Tide, mã hoá/giải mã danh tính, policy) đều chạy ở chế độ **SIMULATED** và được gắn nhãn rõ trên UI/audit. Kiến trúc và contract v1 giữ nguyên để thay bằng Tide thật khi `tcinit.sh` chạy được.

## Tóm tắt
`tcinit.sh` tạo realm thành công, sau đó luôn lỗi ở bước `setUpTideRealm`:

```
ERROR: setUpTideRealm failed (HTTP 500).
Response: {"code":"TIDE-IDPEXT-VENDOR-KEYGEN_FAILED","title":"Key generation failed","status":500,
"detail":"The vendor key was created but the license could not be set up. Please retry; if it persists contact support.",
"instance":"/admin/realms/<realm>/vendorResources/setUpTideRealm"}
```

Log container cho thấy TideCloak gọi dịch vụ Tide từ xa (Midgard) để finalize license free-tier, và dịch vụ đó trả lỗi:

```
INFO  [TideVendorLifecycleManager] Initialized subscription for realm <realm> on tier free, awaiting vendor payment
INFO  [TideVendorLifecycleManager] Free tier with email on realm <realm>, finalizing vendor creation now
[Midgard] FinalizeWallet failed: HttpRequestException: Response status code does not indicate success: 500 (Internal Server Error).
ERROR [TideVendorLifecycleManager] Could not finalize wallet for realm <realm>: java.lang.RuntimeException: Midgard.FinalizeWallet: --FAILED--
    at org.midgard.Midgard.FinalizeWallet(Midgard.java:282)
    at ...TideVendorLifecycleManager.FinalizeVendor(TideVendorLifecycleManager.java:594)
    at ...TideVendorLifecycleManager.TryCreateVVK(TideVendorLifecycleManager.java:152)
    at ...VendorResource.RunVendorKeyLifecycle(VendorResource.java:2654)
ERROR [TideExceptionMapper] [TIDE-IDPEXT-VENDOR-KEYGEN_FAILED] The vendor key was created but the license could not be set up.
```

Lỗi xảy ra 5/5 lần trong khoảng 1 giờ, với 3 tên realm, 2 email, cả `realm.json` gốc lẫn bản đã sửa. Kết luận hiện tại: nhiều khả năng lỗi nằm ở dịch vụ Tide (Midgard), không phải ở cấu hình của repo.

## Môi trường
| Thành phần | Giá trị |
| --- | --- |
| OS | Windows 11, Git Bash (GNU bash 5.3.15) |
| curl | 8.22.0 (mingw) |
| jq | 1.7.1 (tải từ GitHub release jqlang, đặt trong `~/bin`) |
| Node / npm | 20.17.0 / 11.5.2 |
| Container | `mytidecloak`, image `tideorg/tidecloak-dev:latest` (`sha256:96304d51af27…`, image build 2026-10-19T09:51Z, container tạo 2026-10-22T06:04Z), cổng `8080:8080`, admin `admin`/`password` |
| Realm có sẵn trong container | `master`, `myrealm` (không có user, không có Tide vendor key; mình không động vào) |

## Các bước đã làm

### 1. Chuẩn bị
1. Chuyển starter `my-app/` lên root repo. `init/tcinit.sh` và `init/realm.json` lấy nguyên từ starter; script ghi adapter config ra `tidecloak.json` ở root (mặc định `ADAPTER_OUTPUT_PATH=init/../tidecloak.json`).
2. Máy chưa có `jq`, nên tải `jq-windows-amd64.exe` bản 1.7.1 về `~/bin/jq.exe`.
3. Kiểm tra container: `docker ps` cho thấy `mytidecloak` đang chạy; `curl http://localhost:8080/realms/master` trả 200.
4. Sửa `init/realm.json` (bằng jq), thêm:
   - realm role: `employee`, `manager`, `director`, `juror`, `_tide_idea_author.selfencrypt/selfdecrypt`, `_tide_report_id.selfencrypt/selfdecrypt`
   - thêm `employee` và 4 role `_tide_*` kể trên vào composite `default-roles-nextjs-test` (script tự `sed` `nextjs-test` thành tên realm).

### 2. Các lần chạy
Mọi lần đều chạy từ root repo bằng Git Bash. Sau mỗi lần lỗi, realm dở dang được xoá bằng admin API, vì script từ chối realm đã tồn tại nếu không đặt `ALLOW_EXISTING_REALM=1`:

```bash
TOK=$(curl -s -d client_id=admin-cli -d username=admin -d password=password -d grant_type=password \
  http://localhost:8080/realms/master/protocol/openid-connect/token | jq -r .access_token)
curl -X DELETE -H "Authorization: Bearer $TOK" http://localhost:8080/admin/realms/<realm>   # -> 204
```

| # | Giờ finalize (UTC) | Lệnh | realm.json | Email (`SUBSCRIPTION_EMAIL`) | Kết quả Midgard |
| --- | --- | --- | --- | --- | --- |
| 1 | 07:10 | `NEW_REALM_NAME=voicevault CLIENT_NAME=voicevault bash init/tcinit.sh` | đã sửa | mặc định `test@demo.org` | 500 |
| 2 | 07:12 | như #1 (sau khi xoá realm) | đã sửa | `test@demo.org` | 500 |
| 3 | 07:24 | `NEW_REALM_NAME=voicevault CLIENT_NAME=voicevault SUBSCRIPTION_EMAIL=<email thật của Tùng> bash init/tcinit.sh` | đã sửa | email thật | **503** Service Unavailable |
| 4 | 07:35 | `NEW_REALM_NAME=testlicense CLIENT_NAME=testlicense REALM_JSON_PATH=<bản gốc> ADAPTER_OUTPUT_PATH=<file tạm> bash init/tcinit.sh` | **gốc** (chỉ `appUser`, `_tide_message.self{en,de}crypt`) | `test@demo.org` | 500 |
| 5 | 08:09 | như #1 | đã sửa | `test@demo.org` | 500 |

Output của script giống hệt nhau ở cả 5 lần:

```
Using realm.json: .../init/realm.json
Creating realm 'voicevault'...
  realm create -> 201 (created)
Setting up Tide realm (VRK keygen on the Tide Cybersecurity Fabric)...
ERROR: setUpTideRealm failed (HTTP 500).
```

Ở lần #4, "bản gốc" là `init/realm.json` với 8 role đã thêm được gỡ ra bằng jq. Danh sách role sau khi gỡ là `appUser, _tide_message.selfencrypt, _tide_message.selfdecrypt, default-roles-nextjs-test`, khớp với starter.

### 3. Trạng thái sau cùng
- Mọi realm thử nghiệm (`voicevault`, `testlicense`) đã bị xoá; container còn `master`, `myrealm`.
- Chưa có `tidecloak.json` thật; file ở root là `{}`, do `npm run dev` tự tạo.
- Script chưa bao giờ tới được bước tạo admin user hay link enrollment Tide.

## Đã loại trừ
- `realm.json` đã sửa: lần #4 dùng bản gốc, vẫn lỗi.
- Tên realm hoặc client: đã thử 2 tên.
- Email license: đã thử email mặc định và email thật.
- Lỗi thoáng qua: lặp lại suốt khoảng 1 giờ (07:10 đến 08:09 UTC).
- CRLF: `tcinit.sh` chạy từ working tree LF; repo đã có `.gitattributes` (`*.sh text eol=lf`).

## Chưa thử / gợi ý bước tiếp
1. Pull image mới (`docker pull tideorg/tidecloak-dev:latest`) và chạy container mới trên **cổng khác**, để không ảnh hưởng `mytidecloak`, `myrealm` hay `tidecloak-data`. Image hiện tại build ngày 19/10; có thể phía server đã đổi API Midgard.
2. Hỏi kênh hỗ trợ hoặc Discord của Tide về `Midgard.FinalizeWallet` 500 cho free tier ngày 22/10.
3. Chạy thử trên máy khác hoặc mạng khác, để loại trừ mạng nội bộ (máy này có Cloudflare WARP trong PATH; chưa kiểm tra WARP có bật không).
4. Xem log đầy đủ: `docker logs --since 2h mytidecloak 2>&1 | grep -iE "wallet|vendor|license|midgard"`.

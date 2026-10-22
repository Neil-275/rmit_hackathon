# Chẩn đoán lỗi setUpTideRealm / FinalizeWallet

Ngày kiểm tra: 22/10/2026. Nhánh làm việc: `work/server-policy`.

## 1. Kết luận hiện tại

Lỗi nằm trong quá trình hoàn tất vendor/wallet của Tide được gọi bởi `setUpTideRealm`. Bằng chứng người dùng cung cấp nghiêng về lỗi ở thao tác phía Tide hoặc tương thích với thao tác đó, nhưng chưa đủ xác nhận dịch vụ Midgard bị sập toàn hệ thống.

Đã loại trừ tình huống image local chỉ là bản `latest` cũ trong cache: digest local trùng digest `latest` trên registry tại thời điểm kiểm tra. Điều này không loại trừ regression ngay trong bản latest.

Có endpoint thử lại vendor/license lifecycle trên một realm còn tồn tại, không cần tạo lại realm và không cần chạy toàn bộ script. Đây là tiếp tục lifecycle theo trạng thái, không bảo đảm chỉ gọi một thao tác license duy nhất trong mọi trạng thái.

## 2. Bối cảnh lỗi do người dùng cung cấp

```text
NEW_REALM_NAME=voicevault CLIENT_NAME=voicevault bash init/tcinit.sh
Realm creation: HTTP 201
setUpTideRealm: HTTP 500
TIDE-IDPEXT-VENDOR-KEYGEN_FAILED
The vendor key was created but the license could not be set up
Midgard.FinalizeWallet failed: 500 Internal Server Error
Subsequent attempt: 503 Service Unavailable
```

Người dùng đã thử hai email khác nhau, xóa realm dở dang giữa các lần thử và có jq trong Git Bash. Các role nghiệp vụ và role mã hóa đã được thêm vào realm JSON.

Đây là bằng chứng của lần chạy trước, không phải lỗi đã tái hiện lại trong phiên chẩn đoán này.

## 3. Kiểm tra trực tiếp đã thực hiện

| Kiểm tra | Kết quả | Diễn giải |
|---|---|---|
| Docker engine và container | Container `mytidecloak` đang chạy khi kiểm tra | Có thể đọc image và trạng thái hiện tại |
| Thời điểm image tạo | `2026-10-19T09:51:49.043288832Z` | Khớp bối cảnh người dùng |
| Nhãn image | `0.14.41-DEV` | Không lấy phiên bản SDK npm để suy ra phiên bản server |
| Digest local và remote latest | Trùng nhau | Pull cùng tag lúc kiểm tra không mang về bản khác |
| Realm hiện có | `master`, `myrealm` | `voicevault` không tồn tại, nên không có trạng thái lỗi cũ để replay |
| Log mới đọc được | Có cảnh báo Keycloak bootstrapping trả 503 | Không dùng cảnh báo này làm bằng chứng về 503 của FinalizeWallet trước đó |
| Trang trạng thái công khai | HTTP 200, tiêu đề `Tide ORK Network Status` | Trang truy cập được không chứng minh mọi thao tác vendor/license đều khỏe |
| Doctor chỉ đọc | Adapter local thiếu trường vì đang là placeholder | Hệ quả chưa hoàn thành bootstrap, không chứng minh nguyên nhân FinalizeWallet |

Digest đã đối chiếu:

```text
sha256:3f52d0bc3e4e3ae5153e172960003bbe94705cd40af6561fd4c7c4434aaa2708
```

Không tạo, xóa, đổi policy hoặc retry provisioning trên realm nào trong quá trình kiểm tra này. Không thay email license, không chấp thuận điều khoản thay người dùng.

## 4. Vì sao tên lỗi có thể gây hiểu nhầm?

Đã đọc bytecode và annotation từ chính JAR của image đang chạy, thay vì dựa hoàn toàn vào tài liệu có thể thuộc phiên bản khác:

- `VendorResource.SetUpTideRealm` tạo/chuẩn bị IdP và component, sau đó gọi `RunVendorKeyLifecycle` nếu không skip.
- `RunVendorKeyLifecycle` gọi `TideVendorLifecycleManager.TryCreateVVK` và ánh xạ lỗi sang thông báo tổng quát `VENDOR-KEYGEN_FAILED`.
- Lifecycle có các trạng thái `NotCreated`, `AwaitingPayment`, `Created`.
- Trong bước hoàn tất, `FinalizeVendor` gọi `Midgard.FinalizeWallet`; chỉ sau khi lời gọi thành công mới lưu các kết quả hoàn tất như FirstAdmin, chữ ký và VVK.
- `MidgardInterface` là interface `com.sun.jna.Library`: tên `Midgard.FinalizeWallet` trong log là tên lớp/hàm wrapper native, không tự xác định một HTTP server cụ thể đang sập.

Vì vậy, thông báo “vendor key was created” không chứng minh realm đã có đầy đủ bộ khóa, chữ ký và cấu hình dùng được. Log FinalizeWallet là bằng chứng gần nguồn lỗi hơn dòng hướng dẫn chung “check ORKs/email” của script.

Các artifact bytecode được giữ tại `F:\Research\RMIT\tide-diagnostics\`, ngoài repository. Không có token/mật khẩu hoặc dữ liệu khóa runtime trong các bản bytecode công khai này.

## 5. Xếp hạng giả thuyết

| Ưu tiên | Giả thuyết | Vì sao đáng kiểm tra | Bằng chứng để phân biệt |
|---|---|---|---|
| 1 | Thao tác upstream trong finalize vendor/wallet lỗi hoặc tạm thời không khả dụng | Log ghi HTTP 500/503, đổi email không đổi kết quả | Inner error, trace ID, URL/host đích đã che dữ liệu; đối chiếu log phía Tide |
| 2 | Regression hoặc không tương thích giữa image hiện tại và backend/protocol | Dùng latest không loại trừ lỗi mới; endpoint đã đi đủ sâu đến finalization | Cùng request/state trên bản được Tide xác nhận hoạt động, hoặc xác nhận từ nhóm Tide |
| 3 | Lỗi mạng/proxy/egress trong đường từ container tới upstream | HTTP có thể do gateway/proxy tạo; host truy cập web không chứng minh container truy cập đúng dịch vụ | Xác định đích từ lỗi trước, kiểm tra DNS/TLS/response của đích đó; không đoán endpoint mutation |
| 4 | Realm còn trạng thái dở làm lần retry thất bại | Lifecycle có dữ liệu pending và trạng thái phiên | Đọc metadata trạng thái, giữ nguyên realm lỗi để thử lại có kiểm soát |
| Thấp hơn | Role employee/juror, jq hoặc cú pháp shell là nguyên nhân trực tiếp | Đã tạo realm thành công và nhận lỗi có cấu trúc từ Java/native | Chỉ quay lại nếu log có lỗi payload/role riêng; chưa có bằng chứng đó |

Vì các lần trước đã xóa realm, trạng thái dở không giải thích tốt lỗi ban đầu trên realm mới; nó vẫn quan trọng đối với cách retry.

## 6. Có thể bỏ qua license không?

`setUpTideRealm` có tham số `skipLicense=true`, nhưng trong image đã kiểm tra, nhánh này trả về sớm với marker `idp-created`, trước khi chạy vendor lifecycle.

Nó chỉ giúp tách bước chuẩn bị IdP/component khỏi bước hoàn tất khóa/license. Nó không chứng minh VRK/VVK hoạt động, không hoàn tất FirstAdmin và không thay thế việc cấp license. Không cho script tiếp tục như thể bootstrap Tide đã thành công chỉ vì nhận marker đó.

Không sửa script thành luôn `skipLicense=true` để giải quyết lỗi này; cũng không fake `tidecloak.json`, tắt QEA hay tạo khóa riêng thay cho khóa Tide.

## 7. Endpoint thử lại trên realm đã tồn tại

Đã xác nhận trực tiếp annotation trong image:

```text
POST /admin/realms/{realm}/vendorResources/CreateTideVendorKey
Content-Type: application/x-www-form-urlencoded

licensingTier=free
email=<địa chỉ do chủ deployment cung cấp>
# requestedUsers là tham số tùy chọn; không cần gửi cho ví dụ free tier.
```

Đúng chữ hoa/thường: `CreateTideVendorKey`.

Endpoint này yêu cầu quyền `manage-realm`, gọi cùng `RunVendorKeyLifecycle`, nhưng không import lại realm JSON và không chạy các bước drain change-request của `tcinit.sh`.

Lifecycle có xử lý tiếp tục trạng thái pending. Tuy nhiên, khi phiên checkout hết hạn, code có thể xóa cấu hình pending và khởi tạo lại phần cần thiết. Vì thế không mô tả endpoint này là “chỉ gọi license, tuyệt đối không tạo lại pending key”.

Nếu realm đã bị xóa thì endpoint không thể khôi phục dữ liệu của realm cũ. Cần một lần setup mới khi người dùng quyết định thực hiện; không tạo thêm realm âm thầm chỉ để test.

## 8. Thủ tục retry cho người vận hành

### 8.1. Điều kiện trước khi gọi POST

- Realm cần thử lại vẫn tồn tại, có Tide IdP/component phù hợp.
- Có email license thực tế của chủ deployment.
- Chủ deployment đã đọc và tự đồng ý [điều khoản Tide](https://tide.org/legal). Không suy ra sự đồng ý từ yêu cầu debug hoặc từ việc trước đó đã dùng email thử nghiệm.
- Token admin vừa lấy, giữ trong biến môi trường/bộ nhớ, không đưa vào log hoặc Git.
- Gọi từng lần và kiểm tra kết quả; không đặt vòng lặp retry POST vô hạn.

### 8.2. Ví dụ Git Bash cho bước retry

Đây là hướng dẫn, chưa được chạy trên realm lỗi trong phiên chẩn đoán. Đoạn lệnh tự hỏi email và điều khoản trước khi gọi API, không tạo realm, không tự tiếp tục các bước IGA.

```bash
set +x
HOST="http://localhost:8080"
REALM="voicevault"

read -r -p 'Email quản lý license: ' TIDE_LICENSE_EMAIL
test -n "$TIDE_LICENSE_EMAIL" || { echo 'Thiếu email'; exit 1; }
echo 'Đọc điều khoản: https://tide.org/legal'
read -r -p 'Bạn đồng ý điều khoản Tide? (yes/no): ' TIDE_TERMS_ACCEPTED
test "$TIDE_TERMS_ACCEPTED" = yes || { echo 'Đã dừng'; exit 1; }

read -r -p 'Tên admin: ' KC_USER
read -r -s -p 'Mật khẩu admin: ' KC_PASSWORD
printf '\n'
ADMIN_TOKEN="$(curl -sS --max-time 20 \
  "$HOST/realms/master/protocol/openid-connect/token" \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  --data-urlencode "username=$KC_USER" \
  --data-urlencode "password=$KC_PASSWORD" \
  -d 'grant_type=password' -d 'client_id=admin-cli' \
  | jq -er '.access_token')" || exit 1
unset KC_PASSWORD

realm_http="$(curl -sS --max-time 20 -o /dev/null -w '%{http_code}' \
  "$HOST/admin/realms/$REALM" \
  -H "Authorization: Bearer $ADMIN_TOKEN")" || exit 1
test "$realm_http" = 200 || { echo "Realm check HTTP $realm_http; đã dừng"; exit 1; }

body_file="$(mktemp)" || exit 1
trap 'rm -f "$body_file"; unset ADMIN_TOKEN' EXIT
license_http="$(curl -sS --max-time 120 -o "$body_file" -w '%{http_code}' \
  -X POST "$HOST/admin/realms/$REALM/vendorResources/CreateTideVendorKey" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  --data-urlencode 'licensingTier=free' \
  --data-urlencode "email=$TIDE_LICENSE_EMAIL")" || exit 1

printf 'License lifecycle HTTP %s\n' "$license_http"
if test "$license_http" = 200 && test "$(tr -d '\r\n' < "$body_file")" = CREATED; then
  echo 'Lifecycle báo CREATED. Kiểm tra license/adapter trước khi tiếp tục bootstrap.'
else
  echo 'Chưa xác nhận hoàn tất. Không tiếp tục IGA; giữ realm và lấy log đã che bí mật.'
  # Chỉ xuất mã lỗi tổng quát; không in response đầy đủ hoặc token.
  jq -r '.code // .error.code // empty' "$body_file" 2>/dev/null || true
  exit 1
fi
```

Lệnh có thể bị timeout dù phía server đã tiến triển. Nếu gặp timeout, đọc trạng thái trước khi gọi lại. Với một phiên bản khác, response có thể khác: phải đối chiếu image đó, không coi HTTP 200 bất kỳ là thành công. `NEED_PAYMENT`, `idp-created` hoặc redirect checkout đều không chứng minh hoàn tất free-tier lifecycle.

### 8.3. Kiểm tra sau retry

- Đọc `GET .../vendorResources/getLicenseDetails` bằng admin token; giữ response có định danh/license trong máy, không dán toàn bộ ra chat hoặc commit.
- Kiểm tra `isPendingLicenseActive` nếu có pending license; không dùng riêng giá trị false để kết luận active license hiện tại bị lỗi.
- Kiểm tra adapter xuất từ server có các trường Tide cần thiết; không tự điền khóa vào adapter.
- Nếu lifecycle đã `CREATED`, tiếp tục bootstrap có kiểm soát. Script hiện không có cờ “resume từ bước 3”; không dùng một lệnh `sed` cắt script rồi chạy bỏ qua các bước kiểm tra.

## 9. Vì sao không dùng ALLOW_EXISTING_REALM làm license-only retry?

`ALLOW_EXISTING_REALM=1` chỉ cho script vượt qua lỗi trùng realm ở bước tạo. Sau đó nó vẫn chạy các bước còn lại, bao gồm cấu hình IGA và drain toàn bộ pending change-request.

Với một realm đang có việc khác, thao tác đó có thể áp dụng thay đổi ngoài mục đích thử license. Trên các bản có toggle IGA kiểu đảo trạng thái, chạy lại còn cần kiểm tra trạng thái hiện tại. Vì vậy endpoint vendor riêng phù hợp hơn để cô lập lỗi này.

Không tự gọi `force-gen-vrk`, `force-rotate-vrk` hoặc `force-switch-vrk`: đây là thao tác thay đổi khóa, không phải phép thử sức khỏe hoặc license retry thông thường.

## 10. Bằng chứng còn thiếu để xác nhận outage hoặc regression

Cần một lần tái hiện có kiểm soát trên realm lỗi còn tồn tại, sau khi chủ deployment quyết định thực hiện:

1. Ghi thời gian UTC và digest image.
2. Gọi một lần bước vendor lifecycle; ghi HTTP status và mã lỗi.
3. Lấy các dòng liên quan `FinalizeWallet`, inner error và trace/correlation ID; che email, token, dữ liệu khóa và payload nhạy cảm.
4. Phân biệt lỗi native/upstream với 503 lúc Keycloak chưa sẵn sàng.
5. Nếu vẫn lỗi trên latest, gửi bộ thông tin đã che tới Tide qua kênh hỗ trợ. Chưa gửi thông tin cho bên thứ ba trong phiên này.

Không có lần gọi thành công hoặc xác nhận phía Tide thì chưa thể đánh dấu lỗi đã sửa. Trang ORK status hoạt động cũng không thay thế được kiểm tra giao dịch finalize vendor.

## 11. Nguồn và phạm vi

- JAR lấy từ chính container local: `tidecloak-key-provider-1.0-SNAPSHOT.jar`, `MidgardJava.jar`; phân tích bằng `javap`.
- Tide MCP: `tide_doctor` ở chế độ check-only; canon `troubleshooting`, `tidecloak-endpoints`, `tidecloak-bootstrap`.
- [Admin API Reference](https://docs.tide.org/API/Admin%20API%20Reference).
- [Licensing guide](https://docs.tide.org/Admin/license).
- [Tide ORK Network Status](https://status.tideprotocol.com/).

Tài liệu công khai và MCP có khác biệt giữa các phiên bản endpoint; với `CreateTideVendorKey`, tên và form parameters ở đây đã được đối chiếu với annotation của image local. Bản thân lệnh retry mới được xác minh về cấu trúc/cú pháp, chưa được kiểm chứng end-to-end trên realm lỗi.

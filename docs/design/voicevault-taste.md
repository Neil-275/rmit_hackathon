# VoiceVault — áp dụng taste skill

Đã cài `design-taste-frontend` từ `taste-skill-main/taste-skill-main/skills/taste-skill`
vào thư mục skill Codex; checksum 38 file khớp. Dùng quy trình **app screens**, giữ HTML/CSS/JS local.

Direction: **Achromatic ledger**, seed **22102026**, kind `workspace`, theme light,
giữ font hệ thống Segoe UI để mở offline. Không redraw. Chọn phong cách này vì công việc chính là
xem hồ sơ và ra quyết định; chrome trung tính để trạng thái biểu quyết dễ nhận biết.

Face: các con số N/T và dấu niêm phong từ chính quy trình VoiceVault. Signature là danh sách tiến độ
biểu quyết với số phiếu, N/T và điều kiện independent trên từng hồ sơ. Tổng số đều tính từ dữ liệu phiên.
Màu xanh chỉ dùng cho phần tiến độ đã có phiếu; số 0 không được vẽ thành một đoạn tiến độ giả.

## Câu hỏi của từng màn hình

| Màn hình | Câu hỏi chính |
| --- | --- |
| Tổng quan | Hồ sơ nào đang chuyển động và còn bao nhiêu lượt lấy ý kiến? |
| Sáng kiến | Ý tưởng nào đang chờ đề cử hoặc quyết định? |
| Phản ánh | Phiên này được xem hồ sơ nào và có thể đề nghị xác minh không? |
| Bỏ phiếu | Tôi được vote cho lượt nào, còn thiếu bao nhiêu phiếu và independent? |
| Hội đồng | Ai đang có hiệu lực, thay đổi nào mới là đề xuất? |
| Nhật ký | Thao tác nào đã được ghi nhận và từ nguồn thực thi nào? |

## Trước và sau

Inspector chạy Chrome tại 1440, 768 và 390 px. Bản trước có 7 FAIL:
nhãn chữ hoa quá nhỏ, gradient, shadow nút, tương phản thấp, icon màu dạng chip,
chữ dưới 11 px và headline xuống quá nhiều dòng trên điện thoại.

Bản sau thay sidebar tối bằng nền sáng, bỏ banner chào mừng và hình khiên trang trí,
gộp KPI thành một dải, đưa hồ sơ và tiến độ vote lên đầu. H1 24px, nội dung 14px,
metadata 11–12px; chữ có tương phản tối thiểu 4.5:1. Menu gập ở tablet/phone, control mobile 44px.
Đã xem ảnh desktop/tablet/mobile và sửa theo ảnh, không chỉ dựa vào số đo.

Không cấp allowance cho lỗi kiểm tra nào. Cảnh báo về tỷ lệ chữ nhỏ được giữ vì các trường đó là
metadata, phiên mô phỏng và chú thích; tên hồ sơ, điều hướng và nội dung chính dùng cỡ 14px.
Lint cảnh báo shadow ở dialog/toast là hợp lệ vì chúng là overlay; nhãn ngữ cảnh dialog có mục đích.
Kết quả lệnh inspector/lint cuối được ghi trong plan, ảnh và JSON tạo trong `.taste-skill/` (không commit).

Inspector gốc tự serve HTTP cho file local, làm VoiceVault khóa đúng quy tắc LIVE. Vì vậy harness
kiểm tra trong `.superpowers/taste-inspect.mjs` giữ `file://` và thêm cờ headless phù hợp máy này;
không sửa bootstrap sản phẩm hay code skill đã cài.

Dữ liệu mẫu cần thay khi nối LIVE: 10 nhân vật tổng hợp, council v1 gồm Eva/Frank/Grace/Henry/Iris,
ba sáng kiến, ba phản ánh với N=4/3/5, email `@example.test`. Không có khách hàng, thống kê tăng trưởng,
review hay bằng chứng mật mã được bịa để trang trí giao diện.

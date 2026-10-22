# VoiceVault — giao diện chạy trực tiếp

Mở `index.html` bằng Chrome hoặc Edge (nhấp đúp, hoặc kéo file vào trình duyệt).
Không cần Next.js, npm, Docker hay server. Đường dẫn phải bắt đầu bằng `file://`.

Đây là **MOCK**, sử dụng dữ liệu giả và chỉ lưu trong bộ nhớ của tab. Tải lại trang
sẽ khôi phục dữ liệu mẫu. Bản này không thực hiện mã hóa, xác thực thật hay TideCloak.

## Những gì có thể thử

- Sáu trang: Tổng quan, Sáng kiến, Phản ánh, Bỏ phiếu, Hội đồng, Nhật ký.
- An gửi sáng kiến; Bình đề cử; Chi duyệt hoặc từ chối. Chỉ công khai tác giả khi có consent.
- An gửi phản ánh, chọn nhiều người bị phản ánh. Hội đồng được bốc từ roster hiện hành sau khi loại xung đột.
- Thành viên được phân công mở hồ sơ và chọn **Đề nghị mở danh tính**, nhập lý do để tạo lượt vote.
  N và danh sách đã chọn được giữ nguyên. T = ceil(2N/3), đồng thời phải có phiếu độc lập.
- Frank, Grace, Henry thử hồ sơ mẫu `report-101`: N=4, T=3. Sau ba phiếu APPROVE,
  Frank là recipient có thể xem danh tính giả. Hai phiếu chưa đủ, kể cả đã có Grace.
- Frank đề xuất thay đổi hội đồng. Thành viên được chọn vote; đủ phiếu mới hiện thao tác
  áp dụng cho người đề xuất. READY chưa thay roster; APPLIED tăng version và làm lượt cũ STALE.
- Chọn tình huống mô phỏng để thử danh sách rỗng, thiếu quyền, hết hạn, lỗi policy hoặc thiếu juror.

Nhân vật và tình huống chỉ hiện ở MOCK. Đây là công cụ thử giao diện, không phải cách đăng nhập.
Nút đóng, đổi trang, đổi nhân vật và đăng xuất xóa phiên xem danh tính; phản hồi reveal đến muộn bị bỏ qua.

## Kiểm thử

Chạy từ thư mục gốc project trong PowerShell:

```powershell
& ./public/ui/tests/run.ps1 -Suite all
```

Có thể chọn `runtime` hoặc `browser`. Script dùng Node đã có trong PATH, hoặc Node
được tích hợp sẵn trong VS Code tại đường dẫn cài đặt mặc định. Browser suite cần Chrome/Edge;
có thể đặt `VOICEVAULT_CHROME` nếu trình duyệt cài ở nơi khác. Không có bước cài dependency.
Giao diện dùng hằng ngày chỉ cần trình duyệt, không cần runtime chạy test.

## Nối hệ thống của Tùng

HTTP(S) chỉ chấp nhận LIVE v1. Thiếu `public/integration/runtime.generated.js` hoặc
factory tương thích thì hiển thị lỗi và giữ chức năng khóa. Chạy `python -m http.server`
sẽ không tự chuyển sang demo.

Xem [hướng dẫn tích hợp và merge](../../docs/integration/static-ui-handoff.md)
và [ghi chú thiết kế](../../docs/design/voicevault-taste.md).

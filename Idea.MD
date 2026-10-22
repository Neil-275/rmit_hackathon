# Ý tưởng: Tiếng nói nhân viên có bảo chứng (VoiceVault)

> Tài liệu lưu ý tưởng đề xuất cho Challenge 2: UNLOCKED. Các khả năng của TideCloak nêu ở đây dựa trên mô tả trong đề bài và **cần đối chiếu với tài liệu TideCloak** trước khi khẳng định trong bài nộp.

## 1. Vấn đề

Ý tưởng mở rộng từ "kênh tố giác" thành toàn bộ **tiếng nói từ dưới lên** (employee voice) trong công ty, gồm hai kiểu thất bại:

| | Tố giác sai phạm | Đóng góp ý tưởng |
|---|---|---|
| Rủi ro cho người nói | **Bị lộ danh tính** → bị trả đũa | **Bị xóa tên** → mất công trạng |
| Ai gây ra | Người có quyền tra danh tính (HR, IT, lãnh đạo) | Người trung gian chuyển tiếp (sếp trực tiếp) |
| Hệ quả | Không ai dám báo cáo | Không ai muốn đóng góp |

**Gốc rễ chung:** bên nào kiểm soát kênh truyền thì kiểm soát luôn danh tính và công trạng của người nói. Trong hệ thống thông thường, trường "tác giả" chỉ là một cột trong database: sếp, HR hay IT admin đều có thể đọc, sửa, hoặc đơn giản là không chuyển tiếp.

**Ví dụ:** A đề xuất một ý tưởng và trình cho B (sếp của A). Khi B trình lên cấp cao hơn, B không ghi công A.

## 2. Bằng chứng

- **Bị lấy công ý tưởng:** khảo sát OfficeTeam (2009) cho thấy 29% nhân viên từng bị lấy công ý tưởng; 51% trong số đó không làm gì. Một khảo sát khác cho thấy gần 1/5 nhân viên tin sếp lấy công của mình. BambooHR xếp "sếp lấy công" là hành vi bị ghét nhất.
- **Ý tưởng bị giữ lại:** Morrison & Detert phát hiện nhân viên không chỉ im lặng về tin xấu mà còn giữ lại cả ý tưởng cải tiến. Lý do hàng đầu: sợ bị đánh giá tiêu cực và sợ hỏng quan hệ. Việc lên tiếng phụ thuộc mạnh vào cảm nhận rằng đóng góp **có tác động và được ghi nhận**.
- **Sợ trả đũa khi tố giác:** 34% người không báo cáo vì sợ lãnh đạo trả đũa, 30% vì sợ cấp trên trực tiếp (Ethics & Compliance Initiative, 2013).
- **Lộ danh tính là chuyện có thật:** vụ Halliburton (Tòa phúc thẩm Liên bang Mỹ khu vực 5, 2014): công ty lần ra người tố giác, email nội bộ làm lộ danh tính, đồng nghiệp tẩy chay. Tòa xác định riêng việc tiết lộ danh tính đã là hành vi trả đũa.

> Lưu ý: nhiều số liệu đến từ khảo sát cũ hoặc của bên bán giải pháp; dùng để minh họa và nên kiểm tra nguồn gốc trước khi trích dẫn.

## 3. Giải pháp

Mỗi đề xuất có **3 chế độ danh tính**, do chính người viết chọn:

1. **Credited (ghi danh):** tên tác giả gắn chặt vào ý tưởng từ lúc tạo. Sếp có thể *xác nhận / chuyển lên* nhưng **không thể xóa hay sửa tác giả**. Cấp trên luôn thấy "Người khởi xướng: A · Người đề cử: B".
2. **Sealed (niêm phong):** ý tưởng được đánh giá "mù" theo giá trị, không lộ tên, tránh thiên vị. Tác giả **mở danh tính để nhận công** khi ý tưởng được duyệt. Dấu thời gian chứng minh quyền ưu tiên nếu người khác nộp bản "của mình" sau đó.
3. **Protected report (tố giác):** hội đồng đạo đức đọc được nội dung, nhưng danh tính người báo cáo chỉ được giải mã khi **đủ ngưỡng phê duyệt** (ví dụ 2/3 thành viên, bắt buộc có một thành viên độc lập). CEO, HR, IT admin **không ai tự mở được**. Thay đổi thành viên hội đồng cũng cần đủ ngưỡng phê duyệt.

## 4. Vì sao TideCloak là bắt buộc

| Login + backend thông thường | TideCloak (Emergent Authority) |
|---|---|
| DBA/IT có thể `UPDATE ideas SET author=...` | Bản ghi tác giả được bảo vệ bởi danh tính + chính sách; không một bên nào giữ quyền sửa |
| Server giữ khóa → đọc được danh tính người tố giác | Danh tính được mã hóa; quyền giải mã hình thành từ chính sách + đủ phê duyệt, không nằm ở server |
| Admin tự cấp cho mình vai trò "hội đồng đạo đức" | Thay đổi vai trò nhạy cảm cần đủ ngưỡng phê duyệt |
| Nhân viên phải **tin** công ty | Nhân viên được **bảo đảm** bằng cơ chế, kể cả khi lãnh đạo là bên bị tố |

Ở công ty truyền thống, nhân viên phải tin chính tổ chức mà họ báo cáo hoặc đóng góp. Sản phẩm này loại bỏ yêu cầu đó.

## 5. Giới hạn

- **Không ngăn được việc sếp diễn đạt lại ý tưởng bằng lời ngoài hệ thống.** Sản phẩm cung cấp *bằng chứng ưu tiên* và *kênh chính thức có ghi công*; giá trị đến từ việc công ty quy định đề xuất phải đi qua kênh này.
- **Nội dung tố giác có thể tự làm lộ người viết** (văn phong, chi tiết chỉ một người biết). TideCloak bảo vệ khóa, không bảo vệ suy luận từ nội dung.
- Dấu thời gian, audit trail, luồng chuyển tiếp là **phần ứng dụng tự xây**, không tự có khi thêm TideCloak.
- Thu hồi quyền chỉ chặn truy cập về sau, không lấy lại nội dung người khác đã xem.

## 6. Kịch bản demo 2 phút

Nhân vật: **An** (kỹ sư), **Bình** (trưởng nhóm), **Chi** (giám đốc), hội đồng đạo đức 3 người, **IT admin**. Toàn bộ dữ liệu giả lập.

| Thời gian | Nội dung |
|---|---|
| 0:00–0:20 | **Rào cản:** 29% bị lấy công ý tưởng; vụ Halliburton lộ danh tính người tố giác. |
| 0:20–0:55 | **Ý tưởng:** An gửi ý tưởng (Credited) → Bình chuyển lên Chi → Chi thấy "khởi xướng: An". Bình thử sửa tác giả → **bị từ chối**. |
| 0:55–1:15 | **Admin vượt quyền:** IT admin tự gán mình vào hội đồng đạo đức → **bị chặn, chưa đủ phê duyệt**. |
| 1:15–1:45 | **Tố giác:** An báo cáo sai phạm của Bình. Hội đồng đọc được nội dung. CEO thử xem danh tính → **bị từ chối**. 2/3 hội đồng duyệt cho thủ tục pháp lý → danh tính được mở. |
| 1:45–2:00 | **Thay đổi:** nhân viên dám lên tiếng vì cơ chế bảo vệ họ, không cần tin bất kỳ ai. |

## 7. Phạm vi MVP

- **Bắt buộc:** chế độ Credited (tác giả không thể sửa) + chế độ Protected report (giải mã danh tính theo ngưỡng phê duyệt).
- **Để sau:** chế độ Sealed / đánh giá mù — nhắc trong README như hướng mở rộng.
- Người dùng, tổ chức và dữ liệu đều giả lập.

## 8. Ánh xạ tiêu chí chấm điểm

| Tiêu chí | Điểm mạnh của ý tưởng |
|---|---|
| Vision & originality (25%) | Gộp tố giác và ghi công ý tưởng thành một bài toán "tiếng nói từ dưới lên"; không nằm trong 12 ý tưởng gợi ý. |
| Trust constraint insight (20%) | Người nói phải tin chính tổ chức/sếp đang kiểm soát kênh truyền. |
| Value & impact (20%) | Nhân viên được ghi công và an toàn; công ty nhận được nhiều ý tưởng và cảnh báo sớm hơn. |
| Why TideCloak matters (20%) | Không admin/sếp/CEO nào đơn phương sửa tác giả, xem danh tính hay tự cấp quyền. |
| Prototype & storytelling (15%) | Câu chuyện An–Bình–Chi dễ hiểu, có các khoảnh khắc "bị chặn" rõ ràng. |

## Nguồn

- [29% of employees say they've had ideas stolen at work](https://www.reliableplant.com/Articles/Print/20473)
- [Survey Shows Ideas Aren't Safe In The Office](https://wbjournal.com/article/survey-shows-ideas-arent-safe-in-the-office/)
- [HR Dive – Top bad boss behavior: taking credit](https://www.hrdive.com/news/the-top-bad-boss-behavior-taking-credit-for-employees-work/447400/)
- [JDP Infographic – Bosses](https://www.jdp.com/downloads/JDP-Infographic-Bosses.pdf)
- [Morrison 2014 – Employee voice and silence](https://explore.psychsafety.com/n/morrison-2014/)
- [Why People Don't Always Speak Up At Work](https://adigaskell.org/?p=26304)
- [UNC – Employees Have a Voice](https://execdev.unc.edu/have-a-voice)
- [UVM – Reporting, Non-Retaliation](https://www.uvm.edu/~complian/Newsletter/Winter2016/Helpline.html)
- [Halliburton: revealing whistleblower's identity is adverse action](https://whistleblowersblog.org/2014/11/articles/sox-whistleblowers/halliburton-revealing-whistleblowers-identity-to-colleagues-is-adverse-action)
- [Disclosing the Identity of a Complainant Can Constitute Retaliation (AFS Law)](https://www.afslaw.com/perspectives/alerts/disclosing-the-identity-complainant-can-constitute-retaliation-under-the)

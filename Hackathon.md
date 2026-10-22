# RMIT Hackathon 2026 — UNLOCKED

Tài liệu tiếng Việt tổng hợp đề bài **Challenge 2: UNLOCKED**, do RMIT và Tide giới thiệu. Nội dung được diễn giải từ [trang đề bài chính thức](https://tide.org/unlocked/), kiểm tra ngày **22/10/2026**.

> README này lưu context của cuộc thi, chưa phải phần giới thiệu một sản phẩm đã triển khai. Khi nộp bài, cần đặt **Project overview tối đa 300 từ** về dự án thực tế ở đầu README, đồng thời bổ sung hướng dẫn chạy ở phần riêng. Các mô tả về TideCloak bên dưới phản ánh đề bài; không phải tuyên bố rằng repository đã triển khai hoặc kiểm chứng các khả năng đó.

## Mục lục

- [1. Mục tiêu và đề bài](#1-mục-tiêu-và-đề-bài)
- [2. TideCloak và Emergent Authority](#2-tidecloak-và-emergent-authority)
- [3. Quy trình từ ý tưởng đến demo](#3-quy-trình-từ-ý-tưởng-đến-demo)
- [4. Yêu cầu bài nộp](#4-yêu-cầu-bài-nộp)
- [5. Thời hạn](#5-thời-hạn)
- [6. Tiêu chí chấm điểm](#6-tiêu-chí-chấm-điểm)
- [7. Toàn bộ 12 ý tưởng gợi ý](#7-toàn-bộ-12-ý-tưởng-gợi-ý)
- [8. Câu hỏi thường gặp](#8-câu-hỏi-thường-gặp)
- [9. Tài nguyên và hỗ trợ](#9-tài-nguyên-và-hỗ-trợ)
- [10. Checklist chuẩn bị bài nộp](#10-checklist-chuẩn-bị-bài-nộp)

## 1. Mục tiêu và đề bài

Câu hỏi dẫn dắt: **Bạn sẽ xây dựng điều gì nếu niềm tin không còn là nút thắt?**

Nhiều sản phẩm hữu ích đang đòi hỏi người dùng trao quá nhiều quyền lực cho một bên. Ví dụ: bệnh viện muốn cộng tác nhưng phải quyết định ai kiểm soát hồ sơ chung; AI muốn hỗ trợ nhiều hơn nhưng cần giới hạn quyền truy cập; cộng đồng muốn quản lý nguồn lực chung nhưng không muốn một người có toàn quyền quyết định.

Đội thi cần chọn một khả năng đang bị hạn chế bởi sự đánh đổi đó và xây dựng **prototype nhỏ, hoạt động được, tích hợp TideCloak**. Prototype phải thể hiện rằng không một quản trị viên, tổ chức hoặc AI riêng lẻ nào có thể tự ý vượt qua các quy tắc bảo vệ dữ liệu và quyết định của người dùng.

Trọng tâm là chứng minh **một khả năng mới có giá trị**, đồng thời giải thích tại sao việc loại bỏ quyền kiểm soát đơn phương giúp khả năng ấy trở nên khả thi. Không cần một sản phẩm hoàn chỉnh hay kiến thức chuyên sâu về an ninh mạng và mật mã học.

Nguồn: [Mission](https://tide.org/unlocked/#challenge).

## 2. TideCloak và Emergent Authority

### TideCloak là công cụ tích hợp

Theo đề bài, TideCloak cung cấp xác thực người dùng, phân quyền và bảo vệ dữ liệu. Công cụ dùng Emergent Authority để ứng dụng thực hiện các thao tác nhạy cảm mà không trao cho một quản trị viên, máy chủ hoặc nhà cung cấp khả năng tự mình vô hiệu hóa các lớp bảo vệ.

### Emergent Authority là gì?

Trong mô hình thông thường, một chủ thể cuối cùng thường nắm quyền giải mã dữ liệu, duyệt truy cập hoặc sửa luật. Giữ một master key an toàn vẫn yêu cầu tin tưởng bên đang nắm chìa khóa đó.

Emergent Authority thay đổi cách hình thành quyền lực: các node độc lập trong mạng Tide phối hợp để thực hiện thao tác được bảo vệ khi **danh tính, chính sách và các phê duyệt cần thiết** cùng thỏa mãn. Không node, máy chủ ứng dụng hoặc quản trị viên riêng lẻ nào có toàn bộ quyền thực hiện thao tác đó một mình. Ứng dụng có thể sử dụng quyền được hình thành qua phối hợp mà không giữ một master key có thể tái sử dụng.

Đội thi định nghĩa quy tắc truy cập và phê duyệt cho sản phẩm, sau đó dùng TideCloak đưa các cơ chế bảo vệ vào ứng dụng.

### Vai trò cần thể hiện trong bài thi

TideCloak phải làm thay đổi điều sản phẩm có thể thực hiện một cách đáng tin cậy. Nếu thay nó bằng đăng nhập thông thường và quyền truy cập ở backend mà trải nghiệm cũng như các bảo đảm vẫn y hệt, đề bài yêu cầu phát triển ý tưởng thêm.

Tránh lấy demo đăng nhập, công cụ bảo mật hoặc dashboard phân quyền tổng quát làm nội dung chính. Cần làm rõ lợi ích mới mà người dùng nhận được.

Nguồn: [TideCloak](https://tide.org/unlocked/#tool), [Emergent Authority](https://tide.org/unlocked/#superpower), [Judging](https://tide.org/unlocked/#judging).

## 3. Quy trình từ ý tưởng đến demo

### Bước 1 — Chọn một khả năng hữu ích

Tìm một tình huống hiện bị hạn chế bởi niềm tin, quyền riêng tư hoặc bảo mật. Có thể tham khảo 12 ý tưởng bên dưới và dùng Hackbot trên trang để trao đổi, kiểm tra và làm rõ ý tưởng.

### Bước 2 — Kết nối coding agent

Thêm MCP server của Tide vào coding agent để agent có công cụ và hướng dẫn tích hợp TideCloak. Trang đề bài đề cập Claude Code, Cursor, VS Code và các agent tương thích MCP khác.

Hướng dẫn: [Connect your coding agent](https://tide.org/agent-plugins).

### Bước 3 — Xây dựng prototype

Mô tả ứng dụng, cách truy cập và các quy tắc cho agent. Xây dựng luồng nhỏ có TideCloak tích hợp, dùng dữ liệu tổng hợp và mock các hệ thống bên ngoài. Ưu tiên một tình huống có thể trình diễn thuyết phục.

**Phương án thay thế:** MCP không bắt buộc. Nếu MCP gặp vấn đề hoặc muốn tự tích hợp, dùng [TideCloak Quickstart](https://docs.tide.org/get-started/Tidecloak%20Quickstart). Quickstart cung cấp website mẫu đã tích hợp TideCloak để phát triển tiếp, dùng được với editor/model khác hoặc không dùng AI.

### Bước 4 — Demo và nộp bài

Cho thấy khả năng mới hoạt động và TideCloak đóng vai trò gì. Chuẩn bị repository, viết phần giới thiệu dự án, quay video hai phút và nộp link qua biểu mẫu.

Nguồn: [Start building](https://tide.org/unlocked/#start), [Build kit](https://tide.org/unlocked/#build-kit).

## 4. Yêu cầu bài nộp

Nộp **link repository GitHub public** qua [Google Form chính thức](https://forms.gle/HRHYjnqB86j1LFS97). Hai thành phần chính là code prototype và video demo, cùng đặt trong repository.

### 4.1. Repository và phần giới thiệu README

Repository phải chứa code của prototype hoạt động được và đã tích hợp TideCloak. Phần **Project overview** phải ở đầu README, có một câu mô tả sản phẩm và trả lời đủ năm câu hỏi sau, với tổng độ dài **không quá 300 từ**. Có thể dùng đoạn văn ngắn hoặc bullet; hướng dẫn cài đặt để ở phần riêng.

| Mục | Câu hỏi cần trả lời |
|---|---|
| Vision & originality | Bạn đề xuất sản phẩm, dịch vụ, trải nghiệm hoặc cách làm việc mới nào? Điều gì làm ý tưởng khác biệt? |
| Trust constraint insight | Hiện nay điều gì khó, rủi ro hoặc không thể làm vì rào cản niềm tin, quyền riêng tư hay bảo mật? Khi loại bỏ rào cản, điều gì trở nên khả thi? |
| Value & impact | Ai được hưởng lợi? Cuộc sống hoặc công việc của họ cải thiện ra sao? Đưa một ví dụ cụ thể. |
| Why TideCloak matters | Ứng dụng dùng TideCloak như thế nào? Việc tích hợp giúp tạo ra khả năng đang demo ra sao? |
| Prototype & storytelling | Prototype hiện chứng minh được gì? Ban giám khảo cần chú ý tương tác chính nào? |

**Khung soạn thảo tham khảo** bên dưới được biên soạn lại theo năm câu hỏi, không phải bản sao từ nút Copy README template trên website:

```markdown
## Project overview

[Một câu mô tả sản phẩm.]

### Vision & originality
[Ý tưởng và điểm khác biệt.]

### Trust constraint insight
[Rào cản hiện tại và khả năng mới khi loại bỏ rào cản.]

### Value & impact
[Đối tượng hưởng lợi và ví dụ cụ thể.]

### Why TideCloak matters
[Tích hợp thực tế và vai trò thiết yếu của TideCloak.]

### Prototype & storytelling
[Luồng đã hoạt động và tương tác cần xem trong demo.]
```

### 4.2. Video demo

- Thời lượng: **hai phút**.
- Định dạng: **`.mp4`**.
- Dung lượng: **dưới 100 MB**, theo yêu cầu trên trang.
- Vị trí: trong repository GitHub của bài nộp.
- Nội dung: cho thấy khả năng mới thực sự hoạt động.

Cấu trúc kể chuyện được ban tổ chức gợi ý:

1. **Khả năng:** nhóm chọn xây dựng điều gì?
2. **Rào cản:** vấn đề niềm tin nào đang cản trở điều đó?
3. **Prototype:** trình diễn luồng hoạt động và vai trò của TideCloak.
4. **Thay đổi:** người sử dụng giờ có thể làm gì mà trước đó bị hạn chế?

Nguồn: [What to submit](https://tide.org/unlocked/#submit).

## 5. Thời hạn

Trang chính thức và FAQ ghi các mốc đóng bài industry challenge như sau:

| Địa điểm | Mốc được công bố |
|---|---|
| Việt Nam | **Thứ Năm, 22/10/2026, 18:00 giờ địa phương** |
| Malaysia | Thứ Năm, 22/10/2026, 18:00 giờ địa phương |
| Melbourne | Thứ Sáu, 23/10/2026, 10:00 AEDT |

**Lưu ý về nguồn:** đây là các mốc được chép lại theo từng địa điểm, không phải bảng quy đổi múi giờ. Các giờ trên không tương ứng với cùng một thời điểm. Với đội tại Việt Nam, tài liệu này giữ mốc **18:00 ngày 22/10/2026** như website công bố; nếu cần giải quyết sự khác biệt, hỏi ban tổ chức qua kênh hỗ trợ chính thức.

Nguồn: [Deadline](https://tide.org/unlocked/#submit), [FAQ](https://tide.org/unlocked/#help).

## 6. Tiêu chí chấm điểm

| Tiêu chí | Trọng số | Điều cần chứng minh |
|---|---:|---|
| Vision & originality | **25%** | Hướng giải mới mẻ và có tham vọng, trả lời đúng tinh thần đề bài. |
| Trust constraint insight | **20%** | Chỉ rõ niềm tin, quyền riêng tư, quyền nắm giữ hoặc quyền quyết định đang ngăn cản điều gì. |
| Value & impact | **20%** | Giá trị có ý nghĩa cho cá nhân, tổ chức hoặc xã hội. |
| Why TideCloak matters | **20%** | TideCloak tạo ra khác biệt thực chất đối với những gì sản phẩm có thể thực hiện đáng tin cậy. |
| Prototype & storytelling | **15%** | Ý tưởng dễ hiểu và được chứng minh bằng luồng chạy thực tế. |
| **Tổng** | **100%** | |

Ban giám khảo đọc phần giới thiệu dự án trong README cùng với video demo. Năm câu hỏi README được thiết kế tương ứng với năm tiêu chí này.

Nguồn: [How your app will be judged](https://tide.org/unlocked/#judging).

## 7. Toàn bộ 12 ý tưởng gợi ý

Các ý tưởng là **nguồn cảm hứng tùy chọn**, không phải các track bắt buộc. Nhóm có thể chọn bất kỳ lĩnh vực nào hoặc đề xuất ý tưởng riêng.

### 7.1. Care Passport — Hồ sơ y tế do bệnh nhân kiểm soát

- **Ý tưởng:** dùng hồ sơ giả lập để bệnh nhân chia sẻ từng giấy chuyển viện, kết quả xét nghiệm hoặc kế hoạch chăm sóc với bác sĩ cụ thể.
- **Rào cản:** khám ở nhiều nơi thường dẫn đến chia sẻ quá nhiều lịch sử bệnh và tin tưởng một dịch vụ giữ cả bộ hồ sơ.
- **Vai trò Tide:** mã hóa đầu cuối gắn với phiên và vai trò bác sĩ giúp giới hạn ai giải mã được từng hồ sơ; bên vận hành không mặc nhiên đọc được tất cả.
- **Demo:** cho bác sĩ đa khoa xem một hồ sơ, chuyên viên vật lý trị liệu xem hồ sơ khác; thu hồi quyền tương lai của chuyên viên và cho thấy yêu cầu giải mã tiếp theo bị từ chối.

### 7.2. Research Consent Vault — Kho dữ liệu theo sự đồng ý nghiên cứu

- **Ý tưởng:** người tham gia đóng góp dataset, khảo sát hoặc tài liệu tổng hợp và đồng ý cho các nhà nghiên cứu cụ thể sử dụng.
- **Rào cản:** sau khi đóng góp dữ liệu nhạy cảm, người tham gia khó biết ai đang được dùng dữ liệu và sự đồng ý còn hiệu lực hay không.
- **Vai trò Tide:** mã hóa dữ liệu và xác thực vai trò nhà nghiên cứu, gắn quyền truy cập với sự đồng ý đang có hiệu lực; nền tảng không cần quyền đọc toàn bộ dữ liệu rõ.
- **Demo:** duyệt một nhà nghiên cứu, mở dữ liệu được phép, rút lại sự đồng ý và chặn lần truy cập tiếp theo.

### 7.3. Rental Application Passport — Hồ sơ ứng tuyển thuê nhà

- **Ý tưởng:** tái sử dụng hồ sơ thu nhập, người giới thiệu và giấy tờ định danh; chỉ chia sẻ phần cần thiết cho từng đơn thuê nhà.
- **Rào cản:** mỗi lần ứng tuyển có thể tạo thêm một bản sao đầy đủ giấy tờ nhạy cảm trong email hoặc database khác.
- **Vai trò Tide:** tài liệu được mã hóa và chỉ người nhận hợp lệ mới mở được; nền tảng không cần quyền giải mã toàn bộ hồ sơ ứng viên.
- **Demo:** một quản lý bất động sản nhận chứng minh thu nhập, người khác nhận thư giới thiệu; mỗi bên không mở được gói của bên còn lại.

### 7.4. Blind Portfolio Review — Đánh giá portfolio trước khi lộ danh tính

- **Ý tưởng:** trong tuyển dụng hoặc giáo dục, người đánh giá xem sản phẩm và tiêu chí trước; nhân sự có quyền chỉ mở danh tính ở đúng giai đoạn.
- **Rào cản:** ẩn tên trên giao diện không ngăn backend hoặc người có quyền quá rộng đọc dữ liệu định danh.
- **Vai trò Tide:** quyền giải mã từng trường dữ liệu dựa trên vai trò và giai đoạn đánh giá.
- **Demo:** đánh giá ẩn danh; thử mở danh tính sớm và bị chặn, sau đó chuyển giai đoạn và cho vai trò hợp lệ xem.

### 7.5. Unreleased — Cộng tác với tác phẩm chưa phát hành

- **Ý tưởng:** không gian preview cho nhạc sĩ, nhà làm phim, nhà thiết kế hoặc agency; mời người cộng tác vào từng dự án và tài sản cụ thể.
- **Rào cản:** nền tảng cộng tác thường có thể truy cập toàn bộ tác phẩm giá trị chưa công bố.
- **Vai trò Tide:** mã hóa đầu cuối và quyền theo vai trò cho phép điều phối cộng tác mà không trao quyền giải mã toàn bộ cho dịch vụ.
- **Demo:** cho reviewer nghe một bản nhạc chưa phát hành; các bản còn lại không đọc được, kể cả bằng tài khoản vận hành.

### 7.6. Supplier Evidence Exchange — Chia sẻ bằng chứng nhà cung cấp

- **Ý tưởng:** portal B2B chia sẻ chứng nhận, bằng chứng kiểm toán và tài liệu sản xuất với khách hàng hoặc kiểm toán viên được chọn.
- **Rào cản:** chứng minh tuân thủ thường kéo theo việc đưa tài liệu thương mại nhạy cảm vào phòng dữ liệu có quyền truy cập rộng.
- **Vai trò Tide:** danh tính liên tổ chức, quyền giới hạn phạm vi và dữ liệu mã hóa giúp mỗi bên chỉ đọc gói được giao; cơ chế quản trị theo ngưỡng phê duyệt bảo vệ việc đổi quyền nhạy cảm.
- **Demo:** khách hàng và kiểm toán viên mở các gói khác nhau; thử mở rộng quyền chỉ bằng một quản trị viên.

### 7.7. Matter Room — Không gian hồ sơ vụ việc

- **Ý tưởng:** khách hàng, luật sư, chuyên gia và bên đối tác có các mức truy cập khác nhau vào hồ sơ, bằng chứng hoặc tài liệu giao dịch.
- **Rào cản:** quản trị viên nền tảng quá mạnh có thể đọc tài liệu mật hoặc sửa ai được phép truy cập.
- **Vai trò Tide:** mã hóa tài liệu, phân quyền chống sửa đổi trái phép và thay đổi cần đồng phê duyệt giúp tách việc quản trị hệ thống khỏi quyền đọc dữ liệu của mọi người.
- **Demo:** yêu cầu xem hồ sơ nhạy cảm; tài khoản admin đơn lẻ không mở được và không âm thầm sửa vai trò bắt buộc.

### 7.8. Dual-Control Expense Desk — Phê duyệt chi phí nhiều bên

- **Ý tưởng:** quy trình xử lý chi phí giá trị cao, chứng từ và người phê duyệt được chỉ định; mock hệ thống thanh toán.
- **Rào cản:** quy trình phê duyệt mất ý nghĩa nếu một admin có thể tự cấp cho mình vai trò người duyệt.
- **Vai trò Tide:** bảo vệ danh tính, vai trò người duyệt và yêu cầu đủ phê duyệt khi thay đổi quyền, ngăn một admin tự tạo quyền duyệt.
- **Demo:** gửi khoản chi giả lập, thu thập đủ phê duyệt; thử vượt quy trình bằng việc một admin tự sửa vai trò.

### 7.9. Guild Treasury — Quỹ cộng đồng trong game

- **Ý tưởng:** quản lý credit hư cấu, giao dịch chung hoặc vật phẩm khan hiếm; thành viên đề xuất chi tiêu và cán bộ nhóm duyệt hành động giá trị cao.
- **Rào cản:** tài sản chung phụ thuộc vào một moderator hoặc admin có quá nhiều quyền.
- **Vai trò Tide:** vai trò chống sửa đổi trái phép và quản trị theo ngưỡng phê duyệt bảo vệ việc đổi quyền quỹ.
- **Demo:** đề xuất mua bằng credit giả lập, lấy đủ duyệt, rồi cho thấy một người không thể đơn phương nâng quyền.

### 7.10. Coalition Intel Exchange — Chia sẻ báo cáo giữa cơ quan hư cấu

- **Ý tưởng:** hệ thống hoàn toàn hư cấu, dùng báo cáo tổng hợp với điều kiện phát hành như chỉ AUS hoặc AUS/NZ.
- **Rào cản:** biết báo cáo tồn tại không đồng nghĩa được đọc nội dung; đăng nhập chung chưa đủ để kiểm soát chia sẻ liên cơ quan.
- **Vai trò Tide:** mã hóa, vai trò và chính sách thực thi giới hạn phát hành; thay đổi quyền nhạy cảm cần đủ phê duyệt.
- **Demo:** chuyên viên đối tác tìm thấy báo cáo nhưng chỉ đúng tổ chức và vai trò mới mở được. Dùng dữ liệu giả lập trong toàn bộ luồng.

### 7.11. CreatorVault — Nội dung mã hóa theo quyền thuê bao

- **Ý tưởng:** ứng dụng creator có bài công khai, nội dung thuê bao và file mở khóa riêng; giả lập đăng ký và giao dịch mua.
- **Rào cản:** URL bí mật hoặc cờ quyền ở backend không loại bỏ khả năng nền tảng đọc toàn bộ nội dung premium.
- **Vai trò Tide:** nội dung mã hóa chỉ được mở cho danh tính có quyền hưởng nội dung tương ứng; bên vận hành không cần quyền đọc tất cả.
- **Demo:** mua giả lập để mở file premium, xóa quyền hưởng nội dung và từ chối yêu cầu giải mã trong tương lai.

### 7.12. Community Ballot — Bỏ phiếu cộng đồng

- **Ý tưởng:** bỏ phiếu cho hội sinh viên, cộng đồng hoặc hội đồng; kiểm tra tư cách, nhận một phiếu kín mỗi thành viên, yêu cầu đồng phê duyệt khi đổi luật nhạy cảm hoặc mở kiểm phiếu.
- **Rào cản:** cử tri phải tin một server và một số người vận hành đang kiểm soát danh sách cử tri, lá phiếu, luật và kết quả.
- **Vai trò Tide:** gắn việc gửi phiếu và xem kiểm phiếu với danh tính, vai trò, chính sách; cơ chế quorum bảo vệ thay đổi quyền. Theo mô tả ý tưởng, xác thực cũng tránh kho password hash tập trung.
- **Trách nhiệm của ứng dụng:** tách danh tính cử tri khỏi phiếu mã hóa, kiểm tra bỏ phiếu trùng và xây dựng dấu vết kiểm toán có thể xác minh; không coi những phần này là tự động có sẵn khi thêm TideCloak.
- **Demo:** tổ chức bỏ phiếu giả lập, từ chối phiếu thứ hai và hành động đổi tư cách hoặc đếm phiếu sớm từ một admin; đủ phê duyệt mới công bố kết quả và audit trail mà không lộ lựa chọn cá nhân.

**Giới hạn chung được trang nhắc trong mọi ý tưởng:** dùng dữ liệu tổng hợp. Thu hồi quyền chỉ chặn các lần truy cập được cấp phép về sau; không lấy lại được nội dung mà người nhận đã xem hoặc sao chép.

Nguồn: [Ideas to get you started](https://tide.org/unlocked/#ideas), bao gồm hộp chi tiết của cả 12 ý tưởng.

## 8. Câu hỏi thường gặp

| Câu hỏi | Nội dung trả lời từ đề bài, được diễn giải |
|---|---|
| Có cần kinh nghiệm an ninh mạng hoặc mật mã không? | Không. Cần ý tưởng và sẵn sàng xây dựng; coding agent với MCP có thể hỗ trợ tích hợp. |
| Có được dùng AI coding tools không? | Có; đây là quy trình được khuyến khích. Walkthrough minh họa Claude Code trong VS Code, nhưng có thể dùng agent khác hỗ trợ MCP. |
| Có bắt buộc Tide MCP không? | Không. Có thể dùng Quickstart và tự tích hợp. |
| Có được dùng dữ liệu tổng hợp và mock không? | Có; được khuyến nghị cho y tế, tài chính, chính phủ và các tình huống nhạy cảm. Mock hệ thống thanh toán, hồ sơ hoặc hệ thống bên ngoài để tập trung chứng minh trải nghiệm. |
| Prototype phải hoàn chỉnh đến đâu? | Nhỏ nhưng chạy được, có TideCloak, chứng minh một khả năng mới thuyết phục; không yêu cầu sản phẩm hoàn thiện. |
| Phải chọn một ý tưởng mẫu không? | Không. Ý tưởng mẫu chỉ để tham khảo; các ý tưởng độc đáo ở lĩnh vực khác được hoan nghênh. |
| Nộp gì và ở đâu? | Nộp link GitHub public qua Google Form; repo có code, video hai phút dạng MP4 và README bắt đầu bằng phần giới thiệu trả lời năm câu hỏi. Xem mục thời hạn ở trên. |
| Cần tránh điều gì? | Tránh dự án chủ yếu là demo login, công cụ bảo mật hoặc dashboard phân quyền chung. Hãy thể hiện khả năng mới cho người sử dụng. |
| Hỏi trợ giúp ở đâu? | Coding agent với Tide MCP cho code/tích hợp, Discord cho lỗi setup, Hackbot cho ý tưởng và quy định cuộc thi. |

Nguồn: [FAQ và Help](https://tide.org/unlocked/#help).

## 9. Tài nguyên và hỗ trợ

| Tài nguyên | Mục đích |
|---|---|
| [Đề bài UNLOCKED](https://tide.org/unlocked/) | Nguồn chính cho Challenge 2; có video launch và walkthrough. |
| [TideCloak overview](https://tide.org/tidecloak) | Tổng quan công cụ và những gì công cụ cung cấp cho ứng dụng. |
| [Kết nối coding agent / MCP](https://tide.org/agent-plugins) | Hướng dẫn thiết lập cho coding agent. |
| [TideCloak Quickstart](https://docs.tide.org/get-started/Tidecloak%20Quickstart) | Bắt đầu từ website mẫu tích hợp sẵn khi không dùng MCP. |
| [Tài liệu TideCloak](https://docs.tide.org/) | Tra cứu kỹ thuật và tích hợp. |
| [Emergent Authority beyond cybersecurity](https://tide.org/blog/emergent-authority-beyond-cybersecurity) | Bài đọc được đề bài gợi ý đầu tiên để hiểu tư duy và cơ hội sản phẩm. |
| [Emergent Authority trong kỷ nguyên AI — bài trình bày RMIT](https://tide.org/blog/cyber-immunity-emergent-authority-ai-era) | Thêm bối cảnh và cảm hứng. |
| [Tide Discord](https://discord.gg/XBMd9ny2q5) | Hỏi lỗi thiết lập trong kênh `#support`, kèm thông báo lỗi và các cách đã thử. |
| [Hackbot trên trang UNLOCKED](https://tide.org/unlocked/#help) | Trao đổi ý tưởng, quy tắc, demo và README; dùng nút Ask Hackbot trên trang. |
| [Google Form nộp bài](https://forms.gle/HRHYjnqB86j1LFS97) | Gửi link repository public. |

Các liên kết trên được trang đề bài dẫn tới; README này không thay thế tài liệu tích hợp tại từng liên kết và không bao gồm bản chép lời các video.

## 10. Checklist chuẩn bị bài nộp

Checklist dưới đây tổng hợp các yêu cầu đã nêu; chưa đánh dấu vì tài liệu này không xác nhận trạng thái triển khai của dự án.

- [ ] Chọn một khả năng mới và chỉ rõ rào cản niềm tin hiện tại.
- [ ] Xác định người dùng hưởng lợi và ví dụ tác động cụ thể.
- [ ] Có prototype nhỏ hoạt động được với TideCloak tích hợp.
- [ ] Demo thể hiện tại sao một bên riêng lẻ không thể vượt qua quy tắc bảo vệ.
- [ ] Giải thích khác biệt thực chất so với login và quyền backend thông thường.
- [ ] Dùng dữ liệu tổng hợp và mock hệ thống ngoài ở các tình huống nhạy cảm.
- [ ] Repository GitHub ở chế độ public và có code prototype.
- [ ] Đặt Project overview ở đầu README, gồm mô tả một câu và năm câu trả lời, tổng không quá 300 từ.
- [ ] Để hướng dẫn setup ở mục riêng.
- [ ] Đặt video demo hai phút dạng `.mp4`, dưới 100 MB, trong repository.
- [ ] Video cho thấy khả năng, rào cản, luồng chạy với TideCloak và điều thay đổi cho người dùng.
- [ ] Nộp link repository qua Google Form trước hạn áp dụng tại địa điểm dự thi.

---

Nguồn nội dung: [Tide — UNLOCKED, Challenge 2 of the RMIT hackathon](https://tide.org/unlocked/). Tài liệu được diễn giải bằng tiếng Việt để lưu context làm việc; khi có cập nhật hoặc khác biệt, đối chiếu thông báo chính thức của ban tổ chức.

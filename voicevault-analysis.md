# VoiceVault — Phân tích tổng hợp và kế hoạch hackathon

**Phiên bản:** bản tổng hợp ngày 22/10/2026, giờ Việt Nam (UTC+7).

**Đầu vào:** `Idea.MD` tại commit `a82caca` trên nhánh `master`, bản phân tích `idea.md` local trước khi pull và README đề bài UNLOCKED.

**Trạng thái:** đề xuất để chọn phạm vi và triển khai; không phải xác nhận sản phẩm đã hoạt động hoặc được kiểm định bảo mật.

## 1. Tóm tắt sản phẩm

**VoiceVault là kênh tiếng nói nhân viên, giúp bảo vệ danh tính khi phản ánh sai phạm và duy trì dấu vết ghi nhận khi đóng góp sáng kiến.**

Hai nhu cầu có vẻ trái ngược: người tố giác muốn giấu tên, người đề xuất muốn giữ tên. Gốc rễ chung là họ đang phụ thuộc vào người kiểm soát kênh tiếp nhận và chuyển tiếp. VoiceVault cho phép người gửi chọn cách thể hiện danh tính, đồng thời giới hạn quyền đọc và quyền thay đổi quy tắc của bên tiếp nhận.

Ba chế độ kế thừa từ ý tưởng trên Git:

1. **Credited — Ghi danh:** giữ liên kết có thể kiểm tra giữa người gửi và bản sáng kiến, phân biệt người khởi xướng với người đề cử.
2. **Sealed — Niêm phong:** đánh giá nội dung dưới bí danh; người gửi chủ động đề nghị công khai danh tính khi cần ghi nhận.
3. **Protected report — Báo cáo được bảo vệ:** tách quyền đọc báo cáo khỏi quyền xem danh tính; thao tác nhạy cảm có điều kiện phê duyệt rõ ràng.

Thông điệp sản phẩm:

> Người có ý tưởng không dễ bị xóa dấu vết đóng góp; người lên tiếng không mặc nhiên phải lộ danh tính cho bên tiếp nhận.

## 2. Phần kế thừa và điều chỉnh sau tổng hợp

| Nội dung | Bản trên Git | Bản tổng hợp này |
|---|---|---|
| Phạm vi vấn đề | Employee voice: tố giác và sáng kiến | Giữ cả hai, bổ sung hành trình và tình huống riêng |
| Chế độ danh tính | Credited, Sealed, Protected report | Giữ đủ ba, xác định người được xem và điều kiện chuyển chế độ |
| Ghi công | Tác giả không thể bị sửa | Phân biệt khóa sửa qua API với bằng chứng phát hiện sửa dữ liệu; chỉ tuyên bố mức đã kiểm chứng |
| Timestamp | Chứng minh ưu tiên | Biên nhận có thể hỗ trợ đối chiếu; hash và giờ server chưa chứng minh tác quyền hay thời điểm độc lập |
| Mở danh tính | Ví dụ hội đồng 2/3 | Xem là chính sách đề xuất; tách quorum quản trị khỏi phê duyệt theo từng hồ sơ |
| Vai trò Tide | Không ai tự vượt quyền | Gắn từng bảo đảm với cấu hình thực tế, ranh giới tin cậy và bài kiểm tra |
| MVP | Credited và Protected report | Giữ làm mục tiêu sản phẩm; chia thành mức cơ sở và mức hoàn chỉnh để phù hợp thời gian |
| Nguồn bằng chứng | Nhiều số liệu và vụ việc tham khảo | Phân loại mức kiểm chứng, không đưa số liệu chưa xác minh vào lời mở đầu demo |

Tài liệu không thay thế quyết định của nhóm về phạm vi. Những lựa chọn được đề xuất đều có lý do và điều kiện kiểm chứng bên dưới.

## 3. Đọc đề thi dưới góc nhìn VoiceVault

UNLOCKED yêu cầu một prototype tích hợp TideCloak, thể hiện một khả năng có giá trị khi không một bên riêng lẻ được tự ý vượt quy tắc bảo vệ dữ liệu hoặc quyết định. Các yêu cầu nộp, rubric và mốc địa phương đã được tổng hợp trong [README](./README.md).

Với VoiceVault, câu trả lời cần cụ thể:

- **Khả năng mới:** nhân viên chia sẻ thông tin hoặc sáng kiến qua một kênh mà bên vận hành không mặc nhiên kiểm soát cả nội dung, danh tính và công trạng.
- **Rào cản hiện tại:** sếp, HR, IT hoặc người tiếp nhận có thể nắm quá nhiều quyền ở những hệ thống được thiết kế tập trung.
- **Thay đổi cần chứng minh:** một tài khoản quản trị không thể đơn phương tạo ra quyền giải mã hoặc làm một thay đổi quyền được bảo vệ có hiệu lực.
- **Giá trị cho tổ chức:** nhận được cảnh báo và sáng kiến vốn có thể bị giữ lại. Đây là giả thuyết giá trị cần đánh giá, không phải kết quả đã đo lường.

Ứng dụng có thể có giao diện đơn giản. Phần cần thuyết phục là thao tác hợp lệ chạy được, thao tác vượt quyền bị chặn bởi cơ chế thực tế và người xem hiểu vì sao điều đó giúp người gửi.

Nguồn cuộc thi: [UNLOCKED](https://tide.org/unlocked/). Nội dung đề bài dùng theo lần đọc ngày 22/10/2026; chưa có xác nhận riêng từ ban tổ chức về các thay đổi sau thời điểm đọc.

## 4. Phân tích vấn đề và người dùng

### 4.1. Hai kiểu mất tiếng nói

| Khía cạnh | Báo cáo sai phạm | Đóng góp sáng kiến |
|---|---|---|
| Điều người gửi muốn | Sự việc được xử lý | Ý tưởng được đánh giá và ghi nhận |
| Điều người gửi sợ | Lộ danh tính, mất quan hệ hoặc bị gây khó dễ | Bị chiếm công, bị chặn chuyển tiếp hoặc bị thiên vị |
| Điểm tập trung quyền lực | Danh tính và quyền phân công điều tra | Tác giả, đường chuyển tiếp và quyền quyết định |
| Kết quả mong muốn | Chia sẻ đủ thông tin mà không lộ tên quá sớm | Nội dung đến đúng người, lịch sử đóng góp được giữ |
| Khả năng sản phẩm có thể cung cấp | Giới hạn truy cập, bí danh, phê duyệt theo điều kiện | Liên kết đóng góp, đánh giá theo giai đoạn, biên nhận |

### 4.2. Các nhóm người dùng

| Nhóm | Nhu cầu | Quyền tối thiểu đề xuất |
|---|---|---|
| Nhân viên/người gửi | Gửi, theo dõi và bổ sung hồ sơ | Truy cập hồ sơ của mình; lựa chọn chế độ được hỗ trợ |
| Trưởng nhóm/người đề cử | Nhận xét và chuyển sáng kiến | Thêm nhận xét/đề cử; không nhận mình là người khởi xướng |
| Hội đồng sáng kiến | Đánh giá chất lượng | Đọc nội dung được giao; xem danh tính theo chế độ |
| Người xử lý báo cáo | Đọc, hỏi thêm và cập nhật tiến trình | Nội dung hồ sơ được giao; không mặc định thấy danh tính |
| Thành viên giám sát | Xem xét thay đổi quyền nhạy cảm | Duyệt trong phạm vi được cấu hình; không có quyền đọc mọi hồ sơ |
| IT admin | Vận hành hệ thống | Quản lý kỹ thuật; quyền dữ liệu phải được cấp riêng |

Trong demo có thể dùng cùng một người đóng nhiều vai, nhưng tài khoản và bước xác thực/phê duyệt phải tách biệt. Điều đó chỉ mô phỏng vai trò; không chứng minh các bên độc lập trong triển khai thật.

### 4.3. Giả thuyết cần kiểm tra với người dùng

- Người gửi có hiểu sự khác biệt giữa bí danh và ẩn danh không?
- Biết chính xác ai có quyền đọc có giúp họ yên tâm hơn không?
- Hội đồng có xử lý được hồ sơ mà chưa biết danh tính không?
- Người đề xuất có coi biên nhận và lịch sử đề cử là hữu ích khi tranh luận về công trạng không?
- Những bước đồng phê duyệt nào thực sự cần thiết, bước nào chỉ tạo thêm trì hoãn?

Đây là câu hỏi nghiên cứu sản phẩm cho sau khi có prototype, không phải điều kiện chặn việc chuẩn bị demo.

## 5. Bằng chứng và cách sử dụng nguồn

Bản `Idea.MD` đưa ra nhiều nguồn về việc lấy công, im lặng trong tổ chức và sợ bị trả đũa. Chúng giúp định hướng vấn đề, nhưng cần phân biệt nguồn đã đọc, nguồn dẫn lại và phát biểu chưa kiểm chứng.

| Phát biểu trong bản gốc | Tình trạng khi tổng hợp | Cách dùng phù hợp |
|---|---|---|
| OfficeTeam 2009: 29% từng bị lấy công, 51% không làm gì | Chưa xác minh lại; đường dẫn Reliable Plant không đọc được bằng công cụ web | Giữ trong danh mục nghiên cứu; chưa dùng con số trên slide/video |
| Gần 1/5 nhân viên cho rằng sếp lấy công | Chưa kiểm tra nguồn khảo sát và mẫu | Chưa diễn đạt như số liệu đã được chứng thực |
| Lấy công là hành vi quản lý bị phản đối mạnh | Đã đọc bài HR Dive năm 2017 dẫn khảo sát BambooHR; đã mở được trang BambooHR gốc | Có thể dùng làm bối cảnh khảo sát lịch sử, không suy rộng sang nhân viên Việt Nam năm 2026 |
| Morrison/Detert về employee voice | Các tài liệu trong bản gốc là đầu mối; chưa đối chiếu đầy đủ công trình và kết quả | Trình bày là hướng đọc tiếp, chưa gán kết luận cụ thể cho tác giả |
| ECI 2013: tỷ lệ sợ lãnh đạo/cấp trên trả đũa | Chưa đối chiếu báo cáo gốc | Không dùng tỷ lệ để mở đầu demo |
| Vụ Halliburton và kết luận pháp lý | Chưa đối chiếu văn bản phán quyết | Giữ liên kết tham khảo; không dùng để suy ra nghĩa vụ pháp lý ở Việt Nam |

Nguồn đã đọc: [HR Dive, 19/07/2017](https://www.hrdive.com/news/the-top-bad-boss-behavior-taking-credit-for-employees-work/447400/), [BambooHR — Bad Boss Index](https://www.bamboohr.com/blog/bad-boss-index-the-worst-boss-behaviors-according-to-employees-infographic).

**Cách mở đầu demo đề xuất:** dùng câu chuyện An–Bình–Chi với dữ liệu hư cấu, thay vì phụ thuộc số liệu cũ hoặc nhận định pháp lý chưa xác minh. Điều này vẫn làm rõ vấn đề mà không tạo thêm gánh nặng giải thích nguồn.

## 6. Chế độ Credited — Giữ dấu vết người khởi xướng

### 6.1. Tình huống

An đề xuất cách giảm lỗi kiểm tra sản phẩm. Bình là trưởng nhóm, bổ sung nhận xét rồi đề cử lên Chi. Chi cần thấy rõ phần nào là ý tưởng của An và phần nào là đóng góp của Bình.

### 6.2. Luồng sử dụng

1. An xác thực, viết sáng kiến và nhận biên nhận cho phiên bản đã gửi.
2. Bình đọc trong phạm vi được phép, thêm nhận xét hoặc đề cử.
3. Hệ thống hiển thị hai vai riêng: **Người khởi xướng: An · Người đề cử: Bình**.
4. Bình thử đổi tên người khởi xướng qua API; ứng dụng từ chối.
5. Nếu thử sửa dữ liệu lưu trữ, bản ghi có bằng chứng xác thực phải bị phát hiện không còn khớp khi kiểm tra, nếu cơ chế này đã được triển khai.
6. Sửa nội dung tạo phiên bản mới, không âm thầm thay thế bản đã có biên nhận.

### 6.3. Bảo đảm cần thiết

Một trường `author_id` chỉ đọc trong API giúp chặn lỗi và thao tác thông thường. Nó không tự chặn người có quyền sửa database. Để phát hiện sửa bản gốc, thiết kế đề xuất cần bằng chứng gắn với tối thiểu: mã hồ sơ, phiên bản, dấu vân tay nội dung và danh tính/bí danh người gửi.

Nếu bằng chứng được ký, chữ ký phải thực sự ràng buộc các trường cần bảo vệ. Có token đăng nhập hợp lệ không đồng nghĩa toàn bộ nội dung sáng kiến đã được người gửi ký. Khóa kiểm tra cũng không được tùy ý thay cùng với dữ liệu rồi vẫn báo là hợp lệ.

**Cách mô tả theo mức hoàn thành:**

- Chỉ có kiểm tra ứng dụng: “Người đề cử không được đổi tác giả qua luồng ứng dụng.”
- Có bằng chứng kiểm tra độc lập: “Việc sửa bản ghi đóng góp có thể được phát hiện khi xác minh biên nhận.”
- Chưa kiểm chứng chống xóa/khôi phục bản cũ: không gọi toàn bộ lịch sử là bất biến.

## 7. Chế độ Sealed — Đánh giá trước khi biết danh tính

### 7.1. Tình huống và luồng

Một nhân viên mới muốn ý tưởng được đánh giá cùng tiêu chí với người có chức vụ cao. Họ gửi nội dung dưới bí danh và giữ biên nhận chứng minh liên kết với bản đóng góp.

Hội đồng đọc và phản hồi nội dung; khi sáng kiến được chọn, người gửi đề nghị công khai danh tính. Việc mở danh tính chỉ áp dụng đúng hồ sơ và người nhận được chỉ định. Một lần đồng ý không được hiểu là cho phép đọc mọi hồ sơ khác của cùng người.

### 7.2. Các quyết định thiết kế

- Tách dữ liệu định danh khỏi nội dung đánh giá.
- Không đưa tên, email hoặc định danh tài khoản dễ tra cứu vào payload cho người chấm.
- Giữ cơ chế xác nhận chủ hồ sơ mà không buộc công khai danh tính từ đầu.
- Kiểm tra các dấu hiệu tự nhận diện trong nội dung và tài liệu đính kèm.
- Không tuyên bố loại bỏ mọi thiên vị: văn phong và nội dung vẫn có thể tạo thành kiến.

**Ưu tiên:** sau MVP, trừ khi hạ tầng tách danh tính đã có sẵn và hoạt động ổn định. Không thêm một lựa chọn “Sealed” vào form rồi coi là hoàn tất chế độ này.

## 8. Chế độ Protected report — Đọc nội dung, giới hạn danh tính

### 8.1. Tình huống và luồng

An báo cáo việc Bình sửa số liệu. Người tiếp nhận cần xem bằng chứng nhưng chưa cần tên An. Hệ thống tạo mã hồ sơ và bí danh; nội dung được cấp quyền cho nhóm xử lý, danh tính nằm trong phạm vi bảo vệ riêng nếu được thu thập.

Các bước đề xuất: gửi báo cáo → cấp biên nhận → người xử lý hợp lệ đọc → hỏi thêm qua bí danh nếu đã hỗ trợ → cập nhật trạng thái → đóng hồ sơ. Việc chuyển người xử lý hoặc yêu cầu mở danh tính là thao tác riêng, không phải hệ quả tự động của việc mở báo cáo.

### 8.2. Ba mô hình tiết lộ danh tính

| Mô hình | Điều kiện | Ưu điểm | Đánh đổi |
|---|---|---|---|
| Không có chức năng mở trong MVP | Chỉ xử lý dưới bí danh | Phạm vi nhỏ và tránh một luồng nguy hiểm chưa kiểm chứng | Không loại bỏ liên kết qua tài khoản hoặc log; không hỗ trợ trường hợp cần liên hệ trực tiếp |
| Người gửi đồng ý + đồng phê duyệt | Consent gắn với hồ sơ và đủ bên duyệt độc lập | Người gửi giữ vai trò trong quyết định | Cần xử lý người gửi vắng mặt, rút consent và thời hạn yêu cầu |
| Hội đồng mở theo chính sách ngoại lệ | Đủ ngưỡng và điều kiện được công bố trước | Hỗ trợ quy trình ngoại lệ được tổ chức xác định | Người gửi vẫn phải tin nhóm đủ ngưỡng; có nguy cơ lạm dụng nếu các bên không độc lập |

**Khuyến nghị sản phẩm:** ưu tiên mô hình có sự đồng ý của người gửi. Nếu demo dùng mô hình ngoại lệ của bản gốc, phải công khai điều kiện trước khi gửi và nói rõ người gửi không có quyền phủ quyết trong mô hình đó. Không tự suy ra điều kiện pháp lý chỉ từ nút “legal request”.

Ngưỡng “2 trong 3, gồm một bên độc lập” là **quy tắc nghiệp vụ đề xuất**, chưa phải tính năng có sẵn đã được cấu hình. Nếu chỉ có kiểm tra số lượng mà không kiểm tra vai trò độc lập, chưa đạt chính sách này.

## 9. Ma trận quyền và chống xung đột lợi ích

| Hành động | Người gửi | Người đề cử | Người xử lý đúng phạm vi | Hội đồng/giám sát | IT admin |
|---|---|---|---|---|---|
| Tạo hồ sơ | Có | Khi là người gửi | Khi là người gửi | Khi là người gửi | Khi là người gửi |
| Đọc nội dung | Hồ sơ của mình | Sáng kiến được giao | Hồ sơ được giao | Khi có quyền đọc riêng | Không mặc định |
| Đổi người khởi xướng bản đã ghi nhận | Không sửa âm thầm | Không | Không | Chỉ quy trình đính chính riêng nếu có | Không qua ứng dụng |
| Thêm nhận xét/đề cử | Theo luồng | Có theo phạm vi | Có theo phạm vi | Theo phạm vi | Không mặc định |
| Xem danh tính niêm phong | Danh tính của mình | Không mặc định | Không mặc định | Theo chính sách đã thực thi | Không mặc định |
| Đề xuất thay đổi quyền | Không mặc định | Không mặc định | Theo vai trò | Theo vai trò | Chỉ nếu được giao quyền |
| Tự làm thay đổi nhạy cảm có hiệu lực | Không | Không | Không | Không nếu dưới ngưỡng thực tế | Không nếu dưới ngưỡng thực tế |

Ma trận là yêu cầu thiết kế. Quyền phải được thực thi tại điểm cấp/giải mã dữ liệu, không chỉ tại trang hiển thị. Người bị phản ánh không nên tự động được phân công xử lý hồ sơ liên quan đến mình; MVP dùng tình huống được chuẩn bị sẵn, phần tự động phát hiện xung đột để sau.

## 10. TideCloak đảm nhiệm phần nào?

Theo [tài liệu tổng quan](https://docs.tide.org/Core-Concepts/core-concepts), TideCloak cung cấp IAM trên nền Keycloak, kết hợp cơ chế xác thực, mã hóa và quyền mật mã phân tán của Tide. VoiceVault cần chọn đúng luồng tích hợp, không chỉ cài server.

| Nhu cầu VoiceVault | Thành phần dự kiến | Ứng dụng vẫn phải làm |
|---|---|---|
| Xác thực người tham gia | TideCloak/BYOiD | Kiểm tra token ở API, ánh xạ vai trò và phạm vi |
| Giới hạn đọc nội dung | Cơ chế E2EE/giải mã được cấp quyền | Tách trường, chọn tag/policy và vị trí giải mã |
| Bảo vệ thay đổi vai trò | QEA/quorum governance | Cấu hình realm, người duyệt và kiểm tra đường đổi quyền |
| Phê duyệt điều kiện riêng của hồ sơ | Policy phù hợp, có thể cần Forseti | Định nghĩa điều kiện, dữ liệu yêu cầu và kiểm chứng tích hợp |
| Biên nhận tác giả/nội dung | Cần xác minh cơ chế ký phù hợp | Chuẩn hóa nội dung, phiên bản, bằng chứng và trình xác minh |
| Tiến trình và lịch sử đóng góp | Nghiệp vụ ứng dụng | Trạng thái, nhận xét, chuyển tiếp, biên nhận và kiểm tra lịch sử |

### 10.1. Phát hiện quan trọng khi đối chiếu tài liệu QEA

Tài liệu hiện ghi ngưỡng quản trị là `max(1, floor(0.7 × N))`. Với một hoặc hai admin, ngưỡng là một; với ba admin, ngưỡng là hai. Vì vậy, hai tài khoản admin chưa đủ để demo “một người không làm được”. Trang cũng ghi realm `master` không do QEA quản trị. Phải kiểm tra phạm vi tài khoản cấp cao và đường quản trị này trên triển khai thực tế trước khi tuyên bố chặn mọi admin. [Nguồn QEA](https://docs.tide.org/Core-Concepts/iga-workflow)

**Hệ quả thiết kế của VoiceVault:** dùng ít nhất ba admin phù hợp cho thử nghiệm ngưỡng hai; đây là điều kiện demo theo tài liệu, không thay thế kiểm tra thực tế. Với đường `master`, không tự kết luận là đọc được mọi dữ liệu, cũng không bỏ qua ranh giới này. Phải thử hành vi liên quan và ghi rõ phạm vi đã bảo vệ.

### 10.2. Hai loại quorum cần phân biệt

- **Quorum quản trị:** ai được đổi vai trò/chính sách; bảo vệ luật.
- **Phê duyệt hồ sơ:** ai đồng ý mở danh tính hoặc chấp nhận một hành động cụ thể; thực hiện theo luật.

Một quy trình không tự tạo ra quy trình còn lại. Nút “2/3 đồng ý” trong database chưa chứng minh khóa giải mã tuân theo điều kiện đó.

Tài liệu [Forseti](https://docs.tide.org/Core-Concepts/forseti-engine) mô tả policy tùy biến thực thi trên Fabric, có kiểm tra dữ liệu, người phê duyệt và người thực thi. Khả năng phù hợp với ý tưởng, nhưng chưa xác nhận một policy cụ thể của VoiceVault đã triển khai được trong thời gian hackathon.

## 11. Dữ liệu và bằng chứng đề xuất

Mô hình dưới đây phục vụ trao đổi thiết kế; chưa phải schema phải triển khai toàn bộ.

| Thành phần | Dữ liệu chính | Lưu ý |
|---|---|---|
| Hồ sơ | Mã ngẫu nhiên, loại, chế độ danh tính, trạng thái, policy reference | Không nhúng email vào mã hồ sơ |
| Phiên bản nội dung | Nội dung mã hóa, phiên bản, dấu vân tay, bản tham chiếu trước | Dấu vân tay cần quy tắc chuẩn hóa nhất quán |
| Liên kết người gửi | Định danh hoặc bí danh gắn với hồ sơ | Tránh một cột plaintext làm lộ toàn bộ liên kết |
| Biên nhận | Mã hồ sơ, phiên bản, cam kết nội dung, bằng chứng xác thực nếu có | Phải kiểm tra được, không chỉ hiển thị chữ “verified” |
| Đề cử | Người đề cử, nhận xét, phiên bản được đề cử | Không thay thế người khởi xướng |
| Yêu cầu mở danh tính | Mục đích, người nhận, policy version, thời hạn, consent nếu áp dụng | Approval phải ràng buộc đúng yêu cầu |
| Sự kiện | Loại sự kiện, đối tượng, kết quả, bằng chứng nếu có | Không ghi plaintext nhạy cảm hoặc token vào log |

### 11.1. Mức độ mạnh của bằng chứng ghi công

| Mức | Có gì? | Được phép nói gì? |
|---|---|---|
| A | Tác giả và timestamp trong database | Hệ thống ghi nhận người gửi theo dữ liệu ứng dụng |
| B | Hash và biên nhận người gửi giữ | Có dữ liệu để đối chiếu một bản nội dung; chưa có thời gian độc lập |
| C | Biên nhận được ký, ràng buộc nội dung và người gửi, có cách xác minh | Có thể kiểm tra tính toàn vẹn và nguồn xác thực theo mô hình khóa đã kiểm chứng |
| D | Thêm xác nhận thời gian/lịch sử độc lập | Tăng khả năng phát hiện sửa, xóa hoặc xuất trình bản cũ, tùy cơ chế thực tế |

Không mức nào tự chứng minh ý tưởng là độc nhất, người gửi là tác giả đầu tiên trên thế giới hoặc quyền sở hữu hợp pháp đã được xác lập.

Hash của thông tin dễ đoán cũng có thể hỗ trợ thử đoán. Khi cần che giấu nội dung hoặc danh tính, thiết kế cam kết cần xem xét dữ liệu ngẫu nhiên bí mật và cách quản lý nó; không công bố hash của trường nhận diện như một biện pháp ẩn danh.

## 12. Đường đi dữ liệu và ranh giới tin cậy

1. Người gửi xác thực qua luồng TideCloak đã tích hợp.
2. Ứng dụng chuẩn bị nội dung và danh tính thành các phạm vi bảo vệ riêng.
3. Mã hóa theo luồng được xác minh; backend lưu ciphertext và metadata tối thiểu.
4. Người đọc yêu cầu quyền cho đúng hồ sơ; cơ chế bảo vệ kiểm tra danh tính và chính sách.
5. Nội dung chỉ được giải mã ở vị trí đã xác định trong kiến trúc, không để backend vô tình giữ thêm bản rõ.
6. Thao tác thay đổi quyền hoặc tiết lộ được gắn với yêu cầu/phê duyệt tương ứng.
7. Người gửi giữ biên nhận nếu cơ chế này được xây, để việc đối chiếu không phụ thuộc hoàn toàn vào một bảng database.

Một trang frontend bị thay thế, thiết bị người dùng bị chiếm quyền hoặc người đọc hợp lệ chụp màn hình vẫn có thể làm lộ thông tin. Bảo vệ khóa không tự chứng minh mọi thành phần của web app là an toàn. MVP chỉ công bố các ranh giới và đường tấn công đã thực sự kiểm tra.

## 13. Mô hình đe dọa và giới hạn

| Tình huống | Phản ứng thiết kế | Điều còn lại |
|---|---|---|
| Bình sửa người khởi xướng qua API | Từ chối thao tác; giữ nguyên bản đóng góp | Chưa chứng minh chống sửa database |
| DBA đổi dữ liệu ghi công | Kiểm tra bằng chứng ràng buộc nội dung/người gửi nếu đã triển khai | Có thể xóa dữ liệu, sửa cả giao diện kiểm tra hoặc đưa bản cũ nếu chưa có cơ chế độc lập |
| IT tự thêm quyền đọc | QEA cho thay đổi được quản trị | Phải kiểm tra ngưỡng, realm và tài khoản cấp cao |
| Người xử lý đọc danh tính | Danh tính được bảo vệ riêng và yêu cầu điều kiện riêng | Token, log hoặc nội dung vẫn có thể tiết lộ liên kết |
| Hai người cùng thông đồng | Chọn các bên độc lập và điều kiện bổ sung | Nếu đạt đủ điều kiện hợp lệ, quorum không tự ngăn mọi lạm dụng |
| Người được đọc sao chép nội dung | Giới hạn phạm vi và trách nhiệm xử lý | Không thu hồi được bản đã xem/sao chép |
| Người gửi bịa đặt | Quy trình xem xét, hỏi thêm, phân biệt phản ánh với kết luận | Mật mã không chứng minh nội dung báo cáo là thật |
| Backend ngừng hoạt động/xóa hồ sơ | Biên nhận và sao lưu theo phạm vi triển khai | Bảo mật và tính toàn vẹn không đồng nghĩa luôn sẵn sàng |

Không hứa “không thể trả đũa”, “không cần tin bất kỳ ai” hoặc “ẩn danh tuyệt đối”. Cam kết phù hợp hơn là giảm quyền lực đơn phương trong các thao tác được bảo vệ, theo cấu hình và giả định đã kiểm tra.

## 14. Ba phương án sản phẩm và lựa chọn

| Phương án | Nội dung chính | Điểm mạnh | Đánh đổi |
|---|---|---|---|
| A — Protected report trước | Một báo cáo mã hóa và bảo vệ thay đổi quyền | Gắn rõ nỗi sợ lộ danh tính với quyền của admin | Chưa thể hiện đủ lợi thế ghi công |
| B — Credited trước | Sáng kiến, khởi xướng/đề cử, biên nhận | Câu chuyện An–Bình–Chi ngắn và gần gũi | Khó tạo bằng chứng chống sửa vượt ra ngoài API |
| C — Hai luồng chung nền | Credited đơn giản + Protected report, Sealed để sau | Giữ bản sắc VoiceVault của bản Git | Nhiều điểm tích hợp và khó kể trọn trong hai phút |

**Đề xuất:** lấy C làm mục tiêu, A làm phạm vi cơ sở nếu thiếu thời gian. Không bỏ phần tích hợp cốt lõi để đổi lấy đủ số màn hình. Nếu cơ chế biên nhận thực tế thuận lợi hơn bảo vệ danh tính, có thể chọn B nhưng phải cập nhật câu chuyện và phạm vi bảo đảm.

## 15. Phạm vi triển khai theo mức

### Mức 1 — Nền tảng đủ để chứng minh đề thi

- Đăng nhập TideCloak thật và kiểm tra token ở API.
- Một báo cáo hư cấu, mã hồ sơ và bí danh.
- Đúng nhóm giải mã được; người ngoài phạm vi bị từ chối.
- Ba admin được cấu hình phù hợp để kiểm tra một approval chưa đủ, hai approval mới có hiệu lực, nếu triển khai khớp tài liệu.
- Không xây nút mở danh tính nếu chưa kiểm chứng được policy.
- README, hướng dẫn chạy, tài khoản demo và video.

### Mức 2 — Demo thể hiện đủ hai trụ cột VoiceVault

- Thêm Credited: tách người khởi xướng/người đề cử, giữ phiên bản gốc.
- Từ chối đổi tác giả qua API; nếu có biên nhận ký thì thêm bước sửa dữ liệu và kiểm tra bằng chứng.
- Chỉ thêm mở danh tính khi có phê duyệt ràng buộc đúng yêu cầu và thông báo rõ chính sách cho người gửi.

### Mức 3 — Sau hackathon

- Sealed hoàn chỉnh, đánh giá mù nhiều giai đoạn.
- Hộp thư bí danh, đính kèm, xử lý metadata và chuyển cấp.
- Biên nhận và lịch sử có cơ chế xác minh độc lập, xử lý đính chính tác giả.
- Hội đồng có bên độc lập thực tế, nhiều tổ chức và kiểm toán triển khai.
- Chính sách lưu giữ/xóa và quản lý consent theo từng loại hồ sơ.

AI phân loại hoặc tóm tắt không cần cho MVP. Nếu thêm sau này, phải xác định dữ liệu nào được gửi đến mô hình và ai có quyền cho phép, vì đưa plaintext cho AI mở thêm một bên tiếp nhận.

## 16. Ánh xạ rubric và minh chứng dự kiến

| Tiêu chí | Trọng số | Luận điểm VoiceVault | Minh chứng cần có |
|---|---:|---|---|
| Vision & originality | 25% | Hai hướng bảo vệ tiếng nói: giữ công hoặc giữ kín danh tính | Ba chế độ có mục đích rõ; phân biệt tầm nhìn và phần đã làm |
| Trust constraint insight | 20% | Bên kiểm soát kênh tiếp nhận có thể nắm cả nội dung, danh tính và quyền sửa luật | Một thao tác lạm quyền cụ thể bị từ chối |
| Value & impact | 20% | Giảm rào cản đóng góp thông tin cho nhân viên và tổ chức | Câu chuyện An–Bình–Chi; giả thuyết lợi ích có thể kiểm tra |
| Why TideCloak matters | 20% | Quyền mật mã và quản trị không chỉ nằm ở backend của công ty | Mã hóa/giải mã và quorum thực tế, nói rõ ranh giới |
| Prototype & storytelling | 15% | Đường đi ngắn, có cả thành công và thất bại | Demo ổn định trong hai phút, không thay cơ chế bằng mock |

Việc ý tưởng không trùng nguyên tên của 12 ví dụ không tự chứng minh tính mới. Phần khác biệt cần nhấn là mối liên hệ giữa quyền nhận diện, quyền ghi công và quyền quản trị kênh tiếp nhận.

## 17. Lịch thực hiện cập nhật trong ngày thi

**Thời điểm kiểm tra khi tổng hợp:** khoảng 11:03 ngày 22/10/2026 tại Việt Nam. Mốc Việt Nam trong đề bài đã đọc là 18:00 cùng ngày; còn khoảng 6 giờ 57 phút tại thời điểm đó. Bảng này là kế hoạch đề xuất, không phải tiến độ đã đạt hoặc lịch tự động.

Giả định một người làm kỹ thuật chính, có thể có một người hỗ trợ nội dung. Nếu không có người hỗ trợ, bỏ Mức 2 khi cần để giữ thời gian làm bài nộp. Mốc trên trang cho các địa điểm khác không khớp quy đổi múi giờ; lịch này chỉ dùng mốc Việt Nam, chưa phải xác nhận lại hạn từ ban tổ chức.

| Giờ Việt Nam | Việc chính | Kết quả phải kiểm tra |
|---|---|---|
| 11:15–11:45 | Kiểm tra môi trường, Tide MCP/Quickstart, đăng nhập và tài liệu quorum | Có app chạy và biết thao tác nào thực sự được bảo vệ |
| 11:45–12:45 | Một hồ sơ mã hóa, người đọc đúng/sai quyền | Ciphertext lưu đúng, không có bản rõ ngoài ý muốn |
| 12:45–13:30 | Quorum và đường thay đổi vai trò | Một approval chưa đủ; đủ ngưỡng thật thì thay đổi có hiệu lực; kiểm tra phạm vi master/admin |
| 13:30–14:15 | Hoàn thiện gửi/đọc báo cáo và bí danh | Luồng Mức 1 chạy liên tục; xác định giới hạn metadata |
| 14:15–15:00 | Nếu Mức 1 đạt: Credited, đề cử và biên nhận; nếu chưa: sửa lõi | Có một luồng hoàn chỉnh; không đổi an toàn lấy tính năng phụ |
| 15:00–15:30 | Kiểm tra API, tác giả, quyền, consent nếu có; chốt tính năng | Mỗi câu tuyên bố có bằng chứng tương ứng |
| 15:30–16:00 | Seed dữ liệu, diễn tập, sửa lỗi chặn demo | Chạy lại được với tài khoản đã chuẩn bị |
| 16:00–16:45 | Quay MP4 và viết README cuối | Hai phút, dưới 100 MB; overview tối đa 300 từ |
| 16:45–17:15 | Kiểm tra repo public, code, setup và video | Mở được tài nguyên và chạy được hướng dẫn |
| 17:15–17:30 | Nộp link qua Google Form | Có xác nhận nộp biểu mẫu |
| 17:30–18:00 | Dự phòng upload hoặc sửa lỗi bài nộp | Không thêm tính năng |

### Các mốc cắt phạm vi

- **11:45:** môi trường chưa chạy → dùng Quickstart, bỏ giao diện tùy biến.
- **13:30:** quorum chưa chạy → bỏ Credited bổ sung/hộp thư, tập trung tích hợp cốt lõi. Không giả lập approval để tuyên bố đạt.
- **14:15:** chỉ mở rộng khi Mức 1 đã đạt; nếu không, giữ một luồng.
- **15:00:** không bắt đầu policy mới hoặc chức năng mở danh tính chưa kiểm chứng.
- **15:30:** đóng phạm vi, chỉ sửa lỗi ảnh hưởng demo và bài nộp.
- **16:45:** ưu tiên hoàn tất video/upload/README; nếu cần, demo ít hơn nhưng đúng thực trạng.

Nếu bắt đầu muộn hơn lịch, cắt Mức 2 trước. Giữ ít nhất một giờ cho video, README, kiểm tra tài nguyên và gửi biểu mẫu.

## 18. Hai kịch bản demo hai phút

### 18.1. Kịch bản đầy đủ hai trụ cột

| Thời lượng | Cảnh | Điều cần thấy |
|---|---|---|
| 0:00–0:15 | An có ý tưởng nhưng sợ mất công; có phản ánh nhưng sợ lộ tên | Hai nỗi sợ chung một điểm tập trung quyền lực |
| 0:15–0:45 | An gửi sáng kiến, Bình đề cử, Chi xem | Người khởi xướng và người đề cử tách biệt; thao tác đổi tác giả bị từ chối ở mức đã kiểm chứng |
| 0:45–1:15 | An gửi báo cáo; người xử lý đọc nội dung | Người đúng quyền đọc được, người ngoài phạm vi không giải mã được |
| 1:15–1:45 | Admin thử tự mở rộng quyền | Thay đổi chưa có hiệu lực dưới ngưỡng; đủ phê duyệt mới có hiệu lực |
| 1:45–2:00 | Nêu kết quả và giới hạn | VoiceVault giảm quyền lực đơn phương; Sealed hoặc mở danh tính chưa làm được ghi là hướng mở rộng |

Chỉ thay một cảnh bằng mở danh tính nếu policy đó đã chạy thật. Không cần cố trình diễn mọi chức năng trong cùng hai phút.

### 18.2. Kịch bản dự phòng một luồng

15 giây bối cảnh → 30 giây gửi báo cáo → 25 giây đọc đúng/sai quyền → 35 giây quorum → 15 giây giá trị và giới hạn. Không nhắc chức năng chưa làm như kết quả prototype.

## 19. Kiểm tra nghiệm thu theo tuyên bố

| Mã | Kiểm tra | Bằng chứng đạt |
|---|---|---|
| V1 | Đăng nhập và API không có token | Người hợp lệ vào được, yêu cầu không hợp lệ bị từ chối |
| V2 | Giải mã đúng/sai vai trò | Người đúng quyền đọc được; sai quyền không đọc được qua API/SDK |
| V3 | Bản rõ trong backend/database/log | Kiểm tra đường đi dữ liệu, không chỉ nhìn ô ciphertext trên giao diện |
| V4 | Quorum chưa đủ và đủ | Chỉ thay đổi có đủ phê duyệt thật mới có hiệu lực |
| V5 | Đường quản trị cấp cao | Ghi nhận phạm vi và giới hạn thực tế, không bỏ qua master realm |
| V6 | Sửa tác giả qua API | Bị từ chối, người đề cử không thay thế người khởi xướng |
| V7 | Sửa nội dung/tác giả trong lưu trữ nếu có biên nhận | Trình xác minh phát hiện sai lệch; chưa có thì không tuyên bố chống DBA |
| V8 | Mở danh tính nếu có | Đúng hồ sơ, đúng người nhận, đúng consent/approvals; không tái dùng approval cho hồ sơ khác |
| V9 | Payload và log định danh | Không lộ liên kết trái với phạm vi bảo mật đã tuyên bố |
| V10 | Thử lại từ dữ liệu demo | Một lượt demo mới chạy ổn định, không phụ thuộc trạng thái cũ |

Chỉ bổ sung kiểm tra cho tính năng đã chọn. Không cần xây bộ test lớn cho tài liệu hay các tính năng chưa triển khai.

## 20. Yêu cầu bài nộp và nội dung README

- Repository GitHub public có code prototype.
- Video hai phút dạng `.mp4`, dưới 100 MB, nằm trong repository.
- Đầu README có một câu mô tả sản phẩm và năm mục: Vision & originality, Trust constraint insight, Value & impact, Why TideCloak matters, Prototype & storytelling; tổng Project overview không quá 300 từ.
- Setup để ở phần riêng, nêu môi trường, tài khoản demo và cách chạy.
- Phân biệt rõ đã triển khai, mock hệ thống ngoài, giới hạn và hướng mở rộng.
- Gửi link repo qua [Google Form](https://forms.gle/HRHYjnqB86j1LFS97); push code chưa đồng nghĩa đã nộp cuộc thi.

Không sao chép toàn bộ tài liệu này thành Project overview. Khi nộp, viết lại phần đầu README dựa trên phiên bản thực sự chạy được.

## 21. Đo lường và hướng phát triển sau cuộc thi

Các chỉ số đề xuất để kiểm tra giá trị, chưa có số đo hiện tại:

- Tỷ lệ người hiểu chính xác ai được xem nội dung/danh tính sau khi đọc giải thích.
- Tỷ lệ gửi thành công và thời gian từ gửi đến phản hồi đầu tiên.
- Tỷ lệ nhân viên sẵn sàng gửi trong thử nghiệm có kiểm soát so với kênh cũ.
- Tỷ lệ ý tưởng giữ đúng liên kết người khởi xướng sau khi chuyển qua nhiều cấp.
- Số yêu cầu thay đổi quyền bị từ chối do chưa đủ điều kiện, phân biệt thao tác nhầm và cố ý.
- Thời gian xử lý có tăng quá mức do đồng phê duyệt hay không.

Tăng số báo cáo không tự chứng minh tổ chức có nhiều sai phạm hơn hoặc hệ thống tốt hơn; cần hiểu cả niềm tin, chất lượng phản hồi và tác dụng phụ. Giai đoạn tiếp theo nên thử trong môi trường hư cấu hoặc nhóm tự nguyện trước khi tiếp nhận dữ liệu nhạy cảm thật.

## 22. Quyết định cần chốt và trạng thái hiện tại

| Quyết định | Đề xuất để bắt đầu | Trạng thái |
|---|---|---|
| Tên sản phẩm | VoiceVault theo bản Git | Tên làm việc |
| Bối cảnh | Doanh nghiệp hư cấu, An–Bình–Chi | Đề xuất |
| Mục tiêu phạm vi | Hai luồng Mức 2, Mức 1 làm phương án cơ sở | Chưa xác nhận triển khai |
| Mở danh tính | Chỉ thêm nếu điều kiện và cơ chế thực thi được kiểm chứng | Chưa chốt policy |
| Quorum quản trị | Kiểm tra ba admin theo ngưỡng tài liệu | Chưa kiểm chứng môi trường |
| Bằng chứng ghi công | Nêu đúng mức A/B/C/D đạt được | Chưa xác nhận cơ chế ký |
| Stack và nhân lực | Stack quen thuộc + Quickstart; lịch một người kỹ thuật chính | Giả định cần cập nhật |

Việc tổng hợp tài liệu không phải xác nhận các quyết định trên đã được phê duyệt hoặc một tính năng nào đã hoàn thành.

## 23. Nguồn và truy xuất

### Tài liệu trong repository

- [Ý tưởng gốc trên Git](./Idea.MD), commit `a82caca`: tên VoiceVault, employee voice, ba chế độ và kịch bản An–Bình–Chi.
- [README đề bài](./README.md): yêu cầu cuộc thi và các ví dụ chính thức.
- Bản `idea.md` local trước pull: phân tích hai hướng, giới hạn, lịch và tiêu chí nghiệm thu; đã bảo toàn ngoài repository do xung đột tên hoa/thường trên Windows.

### Nguồn kỹ thuật và cuộc thi

- [UNLOCKED](https://tide.org/unlocked/).
- [TideCloak overview](https://tide.org/tidecloak).
- [Core Concepts & Features](https://docs.tide.org/Core-Concepts/core-concepts).
- [Quorum Enforced Governance](https://docs.tide.org/Core-Concepts/iga-workflow) — đã đọc khi tổng hợp, gồm ngưỡng và ngoại lệ master realm.
- [Forseti Programmable Policy](https://docs.tide.org/Core-Concepts/forseti-engine) — đã đọc khi tổng hợp; chưa xác nhận policy VoiceVault.
- [FAQ/SDK](https://docs.tide.org/FAQ/).
- [Quickstart](https://docs.tide.org/get-started/Tidecloak%20Quickstart).
- [Tide MCP](https://tide.org/agent-plugins).

### Nguồn vấn đề được giữ từ bản Git

- [Reliable Plant — OfficeTeam survey](https://www.reliableplant.com/Articles/Print/20473) — chưa đọc lại được.
- [Worcester Business Journal — Ideas Aren't Safe](https://wbjournal.com/article/survey-shows-ideas-arent-safe-in-the-office/) — đầu mối chưa kiểm chứng lại.
- [HR Dive — Taking credit](https://www.hrdive.com/news/the-top-bad-boss-behavior-taking-credit-for-employees-work/447400/) — đã đọc, bài năm 2017.
- [BambooHR — Bad Boss Index](https://www.bamboohr.com/blog/bad-boss-index-the-worst-boss-behaviors-according-to-employees-infographic) — đã mở nguồn khảo sát được HR Dive dẫn.
- [JDP — Bosses infographic](https://www.jdp.com/downloads/JDP-Infographic-Bosses.pdf) — chưa kiểm chứng lại.
- [Morrison 2014 — đầu mối đọc](https://explore.psychsafety.com/n/morrison-2014/) — cần đối chiếu bài nghiên cứu gốc.
- [Why People Don't Always Speak Up](https://adigaskell.org/?p=26304) — đầu mối thứ cấp.
- [UNC — Employees Have a Voice](https://execdev.unc.edu/have-a-voice) — chưa kiểm chứng lại.
- [UVM — Reporting, Non-Retaliation](https://www.uvm.edu/~complian/Newsletter/Winter2016/Helpline.html) — chưa đối chiếu báo cáo khảo sát gốc.
- [Whistleblowers Blog — Halliburton](https://whistleblowersblog.org/2014/11/articles/sox-whistleblowers/halliburton-revealing-whistleblowers-identity-to-colleagues-is-adverse-action) — đầu mối vụ việc, chưa đối chiếu phán quyết.
- [AFS Law — Disclosing identity](https://www.afslaw.com/perspectives/alerts/disclosing-the-identity-complainant-can-constitute-retaliation-under-the) — đầu mối bình luận, không dùng làm kết luận áp dụng pháp luật.

Các phương án sản phẩm, ma trận quyền, mô hình bằng chứng, lịch và tiêu chí kiểm tra là phân tích đề xuất của tài liệu này. Chúng không phải tính năng TideCloak đã được VoiceVault triển khai hoặc yêu cầu bổ sung từ ban tổ chức.

/* Synthetic v1 baseline. Tùng owns this integration file after handoff. No real identities or credentials. */
(function (global) {
  'use strict';
  global.VoiceVaultFixtures = {
    contractVersion: 'v1', organizationId: 'voicevault-demo',
    people: [
      { id:'an', displayName:'An Nguyễn', initials:'AN', role:'engineer', title:'Kỹ sư phần mềm', department:'Engineering', managerId:'binh' },
      { id:'binh', displayName:'Bình Trần', initials:'BT', role:'manager', title:'Trưởng nhóm kỹ thuật', department:'Engineering', managerId:'chi' },
      { id:'chi', displayName:'Chi Lê', initials:'CL', role:'director', title:'Giám đốc', department:'Leadership' },
      { id:'dave', displayName:'Dave Phạm', initials:'DP', role:'it_admin', title:'Quản trị hệ thống', department:'IT' },
      { id:'eva', displayName:'Eva Đỗ', initials:'EĐ', role:'ethics_pool', title:'Chủ tịch hội đồng', department:'Finance' },
      { id:'frank', displayName:'Frank Vũ', initials:'FV', role:'ethics_pool', title:'Cố vấn pháp lý', department:'Legal' },
      { id:'grace', displayName:'Grace Hoàng', initials:'GH', role:'ethics_pool', title:'Đại diện độc lập', department:'Board' },
      { id:'henry', displayName:'Henry Lý', initials:'HL', role:'ethics_pool', title:'Đại diện nhân viên', department:'Operations' },
      { id:'iris', displayName:'Iris Phan', initials:'IP', role:'ethics_pool', title:'Chuyên viên tuân thủ', department:'Compliance' },
      { id:'mai', displayName:'Mai Trần', initials:'MT', role:'employee', title:'Chuyên viên nghiên cứu', department:'Research' }
    ],
    council: { version:1, rosterHash:'simulated-roster-v1', selectionPolicy:{minVoters:3,maxVoters:5}, members:[
      {subject:'eva', independent:false, active:true, membershipRole:'CHAIR'},
      {subject:'frank', independent:false, active:true, membershipRole:'MEMBER'},
      {subject:'grace', independent:true, active:true, membershipRole:'MEMBER'},
      {subject:'henry', independent:false, active:true, membershipRole:'MEMBER'},
      {subject:'iris', independent:false, active:true, membershipRole:'MEMBER'}
    ]},
    ideas: [
      {id:'idea-101', title:'Một nơi lưu giữ tri thức cho cả đội', description:'Xây dựng thư viện hướng dẫn nội bộ để kinh nghiệm không bị mất khi thành viên thay đổi dự án. Mỗi bài viết được đánh giá và ghi nhận người đóng góp.', category:'CULTURE',status:'UNDER_REVIEW',authorSubject:'an',publishCreditOnApproval:true,ageHours:2},
      {id:'idea-102', title:'Tự động hóa kiểm tra chất lượng đầu ca', description:'Tổng hợp checklist và dữ liệu thiết bị thành một bảng kiểm ngắn, giúp nhóm phát hiện sớm những sai lệch trước khi bắt đầu sản xuất.',category:'PROCESS',status:'ENDORSED',authorSubject:'mai',publishCreditOnApproval:true,ageHours:7,endorsedBy:'Bình Trần'},
      {id:'idea-103', title:'Không gian họp được sử dụng hiệu quả hơn',description:'Tự động nhắc người đặt phòng xác nhận trước giờ họp và trả lại các lịch không được sử dụng. Thử nghiệm trên một tầng trước khi mở rộng.',category:'SUSTAINABILITY',status:'APPROVED',authorSubject:'an',publishCreditOnApproval:true,ageHours:27,endorsedBy:'Bình Trần'}
    ],
    reports: [
      {id:'report-101',title:'Cần rà soát quy trình lựa chọn nhà cung cấp',evidenceDetails:'Tình huống giả: một số hồ sơ mua hàng thiếu bước kiểm tra độc lập. Đề nghị xem xét lại quy trình và các phê duyệt liên quan.',accusedPersonIds:['binh','eva'],reporterSubject:'an',recipientSubject:'frank',voterIds:['frank','grace','henry','iris'],ageHours:3},
      {id:'report-102',title:'Đề nghị kiểm tra việc phân bổ giờ làm thêm',evidenceDetails:'Tình huống giả: thông tin tổng hợp giờ làm thêm chưa thống nhất giữa các nhóm. Cần xác minh bằng dữ liệu trước khi đưa ra kết luận.',accusedPersonIds:['binh'],reporterSubject:'an',recipientSubject:'frank',voterIds:['frank','grace','henry'],ageHours:12},
      {id:'report-103',title:'Rà soát quyền truy cập tài liệu dự án',evidenceDetails:'Tình huống giả: một số quyền truy cập chưa được rà soát sau khi dự án kết thúc. Cần kiểm tra và thu hồi quyền không còn cần thiết.',accusedPersonIds:['dave'],reporterSubject:'an',recipientSubject:'frank',voterIds:['eva','frank','grace','henry','iris'],ageHours:23}
    ],
    scenarios: [
      {id:'NORMAL',label:'Luồng bình thường'}, {id:'EMPTY',label:'Danh sách trống'},
      {id:'UNAUTHENTICATED',label:'Phiên đã hết hạn'}, {id:'FORBIDDEN',label:'Không đủ quyền'},
      {id:'POLICY_UNAVAILABLE',label:'Policy chưa khả dụng'}, {id:'EXPIRED',label:'Lượt vote hết hạn'},
      {id:'INTEGRITY_MISMATCH',label:'Dữ liệu không toàn vẹn'}, {id:'VERSION_CONFLICT',label:'Phiên bản đã thay đổi'},
      {id:'INSUFFICIENT_ELIGIBLE_JURORS',label:'Chưa đủ người hợp lệ'}
    ]
  };
}(window));

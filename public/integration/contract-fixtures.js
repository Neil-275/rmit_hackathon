// VoiceVault contract v1 — dữ liệu giả dùng chung cho MOCK runtime và contract test.
// Classic script: chạy được trên file://, không gọi mạng, gán window.VoiceVaultFixtures (deep-frozen).
// Nguồn sự thật cho tên field/shape; LIVE runtime phải trả cùng shape.
(function (global) {
  "use strict";

  var V = "v1";
  var COUNCIL_VERSION = 3;
  var ROSTER_HASH = "sha256:7f3a9c1e0b5d4f2a8c6e1d9b3f7a5c2e4d6b8f0a1c3e5d7f9b2a4c6e8d0f1a3b";
  var EXPIRES = "2026-10-29T10:00:00.000Z";

  function quorum(n) { return Math.ceil((2 * n) / 3); }

  var people = {
    an: { subject: "subject-an", displayName: "An" },
    chi: { subject: "subject-chi", displayName: "Chi" },
    minh: { subject: "subject-minh", displayName: "Minh" },
    binh: { subject: "subject-binh", displayName: "Bình" },
    dung: { subject: "subject-dung", displayName: "Dũng" },
    hoa: { subject: "subject-hoa", displayName: "Hoa" },
    khanh: { subject: "subject-khanh", displayName: "Khánh" },
    lan: { subject: "subject-lan", displayName: "Lan" },
    giang: { subject: "subject-giang", displayName: "Giang" },
  };

  var councilMembers = [
    { subject: people.binh.subject, displayName: people.binh.displayName, membershipRole: "CHAIR", independent: false, active: true },
    { subject: people.dung.subject, displayName: people.dung.displayName, membershipRole: "MEMBER", independent: false, active: true },
    { subject: people.hoa.subject, displayName: people.hoa.displayName, membershipRole: "MEMBER", independent: true, active: true },
    { subject: people.khanh.subject, displayName: people.khanh.displayName, membershipRole: "MEMBER", independent: false, active: true },
    { subject: people.lan.subject, displayName: people.lan.displayName, membershipRole: "MEMBER", independent: true, active: true },
  ];
  var independentOf = {};
  councilMembers.forEach(function (m) { independentOf[m.subject] = m.independent; });

  // voted: danh sách subject đã APPROVE (fixture không có phiếu DENY trong request còn mở).
  function voters(keys, voted) {
    return keys.map(function (k) {
      var p = people[k];
      return {
        subject: p.subject,
        displayName: p.displayName,
        independent: independentOf[p.subject] === true,
        hasVoted: voted.indexOf(k) >= 0,
      };
    });
  }

  function votingRequest(spec) {
    var list = voters(spec.voters, spec.voted);
    var approvals = spec.voted.length;
    return {
      id: spec.id,
      operation: spec.operation,
      resourceKind: spec.operation === "REVEAL_REPORT_IDENTITY" ? "REPORT" : "COUNCIL_CHANGE",
      resourceId: spec.resourceId,
      state: spec.state,
      version: 1 + approvals,
      purpose: spec.purpose,
      voterCount: list.length,
      quorumRequired: quorum(list.length),
      voters: list,
      validApprovals: approvals,
      independentApproved: list.some(function (v) { return v.independent && v.hasVoted; }),
      councilVersion: spec.councilVersion || COUNCIL_VERSION,
      councilRosterHash: ROSTER_HASH,
      contextHash: "sha256:ctx-" + spec.id.slice(-4),
      createdAt: "2026-10-22T03:00:00.000Z",
      expiresAt: EXPIRES,
    };
  }

  var ID = {
    idea1: "1dea0000-0000-4000-8000-000000000001",
    idea2: "1dea0000-0000-4000-8000-000000000002",
    idea3: "1dea0000-0000-4000-8000-000000000003",
    report1: "0e900000-0000-4000-8000-000000000001",
    report2: "0e900000-0000-4000-8000-000000000002",
    report3: "0e900000-0000-4000-8000-000000000003",
    vr1: "70de0000-0000-4000-8000-000000000001",
    vr2: "70de0000-0000-4000-8000-000000000002",
    vr3: "70de0000-0000-4000-8000-000000000003",
    vr4: "70de0000-0000-4000-8000-000000000004",
    vr5: "70de0000-0000-4000-8000-000000000005",
    vr6: "70de0000-0000-4000-8000-000000000006",
    vr7: "70de0000-0000-4000-8000-000000000007",
    cc1: "cc000000-0000-4000-8000-000000000001",
    cc2: "cc000000-0000-4000-8000-000000000002",
    cc3: "cc000000-0000-4000-8000-000000000003",
    cc4: "cc000000-0000-4000-8000-000000000004",
    cc5: "cc000000-0000-4000-8000-000000000005",
  };

  var votingRequests = [
    // Request mở đầu tiên: N=3, T=2, chưa ai vote — dùng cho demo/test quorum.
    votingRequest({ id: ID.vr1, operation: "REVEAL_REPORT_IDENTITY", resourceId: ID.report2, state: "COLLECTING",
      purpose: "Mở danh tính người phản ánh để điều tra", voters: ["binh", "dung", "hoa"], voted: [] }),
    votingRequest({ id: ID.vr2, operation: "REVEAL_REPORT_IDENTITY", resourceId: ID.report3, state: "READY",
      purpose: "Mở danh tính người phản ánh để điều tra", voters: ["binh", "dung", "hoa", "khanh"], voted: ["binh", "hoa", "khanh"] }),
    votingRequest({ id: ID.vr3, operation: "CHANGE_COUNCIL", resourceId: ID.cc1, state: "COLLECTING",
      purpose: "Đổi hội đồng", voters: ["binh", "dung", "hoa", "khanh", "lan"], voted: ["binh", "lan"] }),
    votingRequest({ id: ID.vr4, operation: "CHANGE_COUNCIL", resourceId: ID.cc2, state: "READY",
      purpose: "Đổi hội đồng", voters: ["dung", "khanh", "hoa"], voted: ["dung", "hoa"] }),
    votingRequest({ id: ID.vr5, operation: "CHANGE_COUNCIL", resourceId: ID.cc3, state: "CONSUMED",
      purpose: "Đổi hội đồng", voters: ["binh", "dung", "khanh", "lan"], voted: ["binh", "khanh", "lan"] }),
    votingRequest({ id: ID.vr6, operation: "CHANGE_COUNCIL", resourceId: ID.cc4, state: "CONSUMED", councilVersion: 2,
      purpose: "Đổi hội đồng", voters: ["binh", "hoa", "khanh"], voted: ["binh", "hoa"] }),
    votingRequest({ id: ID.vr7, operation: "CHANGE_COUNCIL", resourceId: ID.cc5, state: "STALE", councilVersion: 2,
      purpose: "Đổi hội đồng", voters: ["dung", "hoa", "lan"], voted: ["dung"] }),
  ];
  var vrById = {};
  votingRequests.forEach(function (vr) { vrById[vr.id] = vr; });

  function jurors(vrId) {
    return vrById[vrId].voters.map(function (v) {
      return { subject: v.subject, displayName: v.displayName, independent: v.independent };
    });
  }

  var reports = [
    {
      id: ID.report1, title: "Áp lực làm thêm giờ không ghi nhận", summary: "Nhóm bị yêu cầu làm thêm cuối tuần nhưng không ghi công.",
      status: "AWAITING_ELIGIBLE_JURY", version: 1,
      accusedPersonIds: [people.binh.subject, people.dung.subject, people.hoa.subject],
      councilVersion: COUNCIL_VERSION, councilRosterHash: ROSTER_HASH,
      voterCount: null, quorumRequired: null, jurors: [], votingRequestId: null,
      createdAt: "2026-10-22T02:10:00.000Z", capabilities: [],
    },
    {
      id: ID.report2, title: "Nghi vấn thiên vị trong đánh giá cuối năm", summary: "Điểm đánh giá bị điều chỉnh sau khi đã chốt.",
      status: "INVESTIGATING", version: 2, accusedPersonIds: [people.giang.subject],
      councilVersion: COUNCIL_VERSION, councilRosterHash: ROSTER_HASH,
      voterCount: 3, quorumRequired: 2, jurors: jurors(ID.vr1), votingRequestId: ID.vr1,
      createdAt: "2026-10-22T02:20:00.000Z", capabilities: ["vote"],
    },
    {
      id: ID.report3, title: "Hoá đơn công tác bị khai khống", summary: "Chi phí công tác tháng 9 có dấu hiệu khai khống.",
      status: "INVESTIGATING", version: 4, accusedPersonIds: [people.lan.subject],
      councilVersion: COUNCIL_VERSION, councilRosterHash: ROSTER_HASH,
      voterCount: 4, quorumRequired: 3, jurors: jurors(ID.vr2), votingRequestId: ID.vr2,
      createdAt: "2026-10-22T02:30:00.000Z", capabilities: ["revealIdentity"],
    },
  ];

  var ideas = [
    {
      id: ID.idea1, title: "Họp đứng 15 phút mỗi sáng", description: "Thay họp giao ban 1 giờ bằng họp đứng 15 phút.",
      category: "process", status: "UNDER_REVIEW", version: 2, endorsementCount: 1,
      publishCreditOnApproval: true, publicCredit: null, decisionReason: null,
      createdAt: "2026-10-22T01:00:00.000Z", capabilities: ["decide"],
    },
    {
      id: ID.idea2, title: "Kênh góp ý ẩn danh cho khách hàng nội bộ", description: "Mở form ẩn danh cho các phòng ban đánh giá dịch vụ IT.",
      category: "culture", status: "APPROVED", version: 3, endorsementCount: 2,
      publishCreditOnApproval: true, publicCredit: { displayName: people.an.displayName, verified: false },
      decisionReason: "Chi phí thấp, tác động rộng.",
      createdAt: "2026-10-21T08:00:00.000Z", capabilities: [],
    },
    {
      id: ID.idea3, title: "Bỏ chấm công bằng vân tay", description: "Dùng check-in qua app thay máy vân tay.",
      category: "tooling", status: "REJECTED", version: 2, endorsementCount: 0,
      publishCreditOnApproval: false, publicCredit: null, decisionReason: "Chưa đáp ứng yêu cầu kiểm toán.",
      createdAt: "2026-10-21T09:00:00.000Z", capabilities: [],
    },
  ];

  function member(key, role, independent) {
    return { subject: people[key].subject, displayName: people[key].displayName, membershipRole: role, independent: independent, active: true };
  }
  var policy = { minVoters: 3, maxVoters: 5 };

  function change(spec) {
    var vr = spec.votingRequestId ? vrById[spec.votingRequestId] : null;
    return {
      id: spec.id, state: spec.state, version: spec.version, baseCouncilVersion: spec.base,
      reason: spec.reason, diff: spec.diff, proposedMembers: spec.members, proposedSelectionPolicy: policy,
      votingRequestId: spec.votingRequestId, voterCount: vr ? vr.voterCount : null, quorumRequired: vr ? vr.quorumRequired : null,
      appliedCouncilVersion: spec.applied || null, createdAt: spec.createdAt || "2026-10-22T04:00:00.000Z",
    };
  }
  var current = councilMembers;

  var councilChanges = [
    change({ id: ID.cc1, state: "COLLECTING", version: 3, base: COUNCIL_VERSION, votingRequestId: ID.vr3,
      reason: "Bổ sung thành viên độc lập thứ ba",
      diff: { added: [people.giang.subject], removed: [], changed: [] },
      members: current.concat([member("giang", "MEMBER", true)]) }),
    change({ id: ID.cc2, state: "READY", version: 3, base: COUNCIL_VERSION, votingRequestId: ID.vr4,
      reason: "Chuyển chủ toạ sang Khánh",
      diff: { added: [], removed: [], changed: [people.binh.subject, people.khanh.subject] },
      members: [member("binh", "MEMBER", false), member("dung", "MEMBER", false), member("hoa", "MEMBER", true),
        member("khanh", "CHAIR", false), member("lan", "MEMBER", true)] }),
    change({ id: ID.cc3, state: "APPLYING", version: 4, base: COUNCIL_VERSION, votingRequestId: ID.vr5,
      reason: "Đổi Dũng thành thành viên độc lập sau khi chuyển phòng",
      diff: { added: [], removed: [], changed: [people.dung.subject] },
      members: [member("binh", "CHAIR", false), member("dung", "MEMBER", true), member("hoa", "MEMBER", true),
        member("khanh", "MEMBER", false), member("lan", "MEMBER", true)] }),
    change({ id: ID.cc4, state: "APPLIED", version: 5, base: 2, applied: COUNCIL_VERSION, votingRequestId: ID.vr6,
      reason: "Thêm Lan làm thành viên độc lập", createdAt: "2026-10-20T04:00:00.000Z",
      diff: { added: [people.lan.subject], removed: [], changed: [] }, members: current }),
    change({ id: ID.cc5, state: "STALE", version: 2, base: 2, votingRequestId: ID.vr7,
      reason: "Bỏ Khánh khỏi hội đồng", createdAt: "2026-10-20T05:00:00.000Z",
      diff: { added: [], removed: [people.khanh.subject], changed: [] },
      members: [member("binh", "CHAIR", false), member("dung", "MEMBER", false), member("hoa", "MEMBER", true)] }),
  ];

  var personas = [
    { subject: people.an.subject, displayName: "An", roles: ["employee"], note: "Nhân viên nộp ý tưởng/phản ánh" },
    { subject: people.chi.subject, displayName: "Chi", roles: ["employee", "director"], note: "Giám đốc duyệt ý tưởng, nhận danh tính khi đủ quorum" },
    { subject: people.minh.subject, displayName: "Minh", roles: ["employee", "manager"], note: "Quản lý endorse ý tưởng" },
    { subject: people.binh.subject, displayName: "Bình", roles: ["employee", "juror"], note: "Chủ toạ hội đồng" },
    { subject: people.dung.subject, displayName: "Dũng", roles: ["employee", "juror"], note: "Thành viên hội đồng" },
    { subject: people.hoa.subject, displayName: "Hoa", roles: ["employee", "juror"], note: "Thành viên độc lập" },
    { subject: people.khanh.subject, displayName: "Khánh", roles: ["employee", "juror"], note: "Thành viên hội đồng" },
    { subject: people.lan.subject, displayName: "Lan", roles: ["employee", "juror"], note: "Thành viên độc lập" },
  ];

  var ERROR_SPECS = [
    ["INVALID_REQUEST", "Dữ liệu gửi lên không hợp lệ.", "APP", false],
    ["UNAUTHENTICATED", "Bạn cần đăng nhập.", "APP", false],
    ["FORBIDDEN", "Bạn không có quyền thực hiện thao tác này.", "APP", false],
    ["NOT_FOUND", "Không tìm thấy.", "APP", false],
    ["VERSION_CONFLICT", "Dữ liệu đã thay đổi, hãy tải lại.", "APP", true],
    ["COUNCIL_VERSION_CONFLICT", "Hội đồng đã đổi; đề xuất cũ đã STALE.", "APP", false],
    ["COUNCIL_VOTE_REQUIRED", "Đổi hội đồng phải qua bỏ phiếu.", "APP", false],
    ["QUORUM_PENDING", "Chưa đủ số phiếu yêu cầu.", "APP", false],
    ["INSUFFICIENT_ELIGIBLE_JURORS", "Chưa đủ thành viên hội đồng không xung đột lợi ích.", "APP", false],
    ["APPROVAL_EXPIRED", "Yêu cầu bỏ phiếu đã hết hạn.", "APP", false],
    ["INTEGRITY_MISMATCH", "Dữ liệu không khớp bằng chứng toàn vẹn.", "APP", false],
    ["POLICY_DENIED", "Dịch vụ chính sách từ chối.", "FABRIC", false],
    ["POLICY_UNAVAILABLE", "Dịch vụ chính sách chưa sẵn sàng; dữ liệu vẫn khoá.", "APP", true],
    ["CONTRACT_MISMATCH", "Phiên bản contract giữa UI và runtime không khớp.", "CLIENT", false],
    ["IDEMPOTENCY_CONFLICT", "Idempotency-Key đã dùng cho nội dung khác.", "APP", false],
    ["BOOTSTRAP_ALREADY_COMPLETED", "Hội đồng đã khởi tạo; không khởi tạo lại.", "APP", false],
  ];
  var errors = {};
  ERROR_SPECS.forEach(function (s, i) {
    errors[s[0]] = {
      ok: false,
      error: { code: s[0], message: s[1], enforcement: s[2], retryable: s[3] },
      requestId: "fixture-error-" + (i + 1),
      contractVersion: V,
    };
  });

  var fixtures = {
    contractVersion: V,
    methods: [
      "init", "getSession", "login", "logout",
      "listIdeas", "getIdea", "submitIdea", "endorseIdea", "decideIdea",
      "listReports", "getReport", "submitReport", "getDirectory",
      "createUnmaskRequest", "listMyVotingRequests", "getVotingRequest", "castVote",
      "getCouncil", "listCouncilChanges", "submitCouncilChange", "applyCouncilChange",
      "revealIdentity", "listAudit",
    ],
    enums: {
      Enforcement: ["APP", "FABRIC", "QEA", "CLIENT", "SIMULATED"],
      ErrorCode: ERROR_SPECS.map(function (s) { return s[0]; }),
      ResourceKind: ["IDEA", "REPORT", "COUNCIL_CHANGE"],
      IdeaStatus: ["UNDER_REVIEW", "APPROVED", "REJECTED"],
      ReportStatus: ["AWAITING_ELIGIBLE_JURY", "INVESTIGATING", "CLOSED"],
      VotingOperation: ["REVEAL_REPORT_IDENTITY", "CHANGE_COUNCIL"],
      VotingState: ["COLLECTING", "READY", "DENIED", "EXPIRED", "CONSUMED", "STALE"],
      CouncilChangeState: ["AWAITING_ELIGIBLE_JURY", "COLLECTING", "READY", "APPLYING", "APPLIED", "DENIED", "STALE"],
      Decision: ["APPROVE", "DENY"],
      IdeaDecision: ["APPROVE", "REJECT"],
    },
    personas: personas,
    session: {
      anonymous: { authenticated: false, subject: null, displayName: null, roles: [], capabilities: ["login"] },
      authenticated: {
        authenticated: true, subject: people.an.subject, displayName: "An", roles: ["employee"],
        capabilities: ["logout", "submitIdea", "submitReport"],
      },
    },
    ideas: ideas,
    reports: reports,
    votingRequests: votingRequests,
    council: { version: COUNCIL_VERSION, rosterHash: ROSTER_HASH, members: councilMembers, selectionPolicy: policy },
    councilChanges: councilChanges,
    directory: {
      people: Object.keys(people).map(function (k) { return { id: people[k].subject, displayName: people[k].displayName }; }),
    },
    errors: errors,
    audit: [
      { id: "a0000000-0000-4000-8000-000000000001", at: "2026-10-22T01:00:01.000Z", action: "IDEA_SUBMITTED", outcome: "OK",
        source: "APP", resourceKind: "IDEA", resourceId: ID.idea1, requestId: "req-sample-1" },
      { id: "a0000000-0000-4000-8000-000000000002", at: "2026-10-22T02:30:05.000Z", action: "IDENTITY_DECRYPT", outcome: "DENIED",
        source: "FABRIC", resourceKind: "REPORT", resourceId: ID.report3, requestId: "req-sample-2" },
      { id: "a0000000-0000-4000-8000-000000000003", at: "2026-10-22T03:10:00.000Z", action: "VOTE_CAST", outcome: "OK",
        source: "SIMULATED", resourceKind: "REPORT", resourceId: ID.report2, requestId: "req-sample-3" },
      { id: "a0000000-0000-4000-8000-000000000004", at: "2026-10-22T03:20:00.000Z", action: "COUNCIL_CHANGE_PROPOSED", outcome: "OK",
        source: "APP", resourceKind: "COUNCIL_CHANGE", resourceId: ID.cc1, requestId: "req-sample-4" },
    ],
  };

  function deepFreeze(value) {
    if (value && typeof value === "object" && !Object.isFrozen(value)) {
      Object.keys(value).forEach(function (k) { deepFreeze(value[k]); });
      Object.freeze(value);
    }
    return value;
  }

  global.VoiceVaultFixtures = deepFreeze(fixtures);
})(window);

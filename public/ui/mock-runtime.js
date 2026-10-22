// VoiceVault MOCK runtime (contract v1) — mẫu tối thiểu, chỉ dùng trên file://.
// Cùng interface/shape với LIVE runtime. Mọi lỗi mang enforcement "SIMULATED": mock không chặn thật gì cả.
// Không crypto, không mạng, không storage; state nằm trong memory của từng instance.
(function (global) {
  "use strict";

  var V = "v1";

  function clone(value) { return value === undefined ? undefined : JSON.parse(JSON.stringify(value)); }
  function quorum(n) { return Math.ceil((2 * n) / 3); }
  function isObject(v) { return v !== null && typeof v === "object" && !Array.isArray(v); }
  function nonEmpty(v, max) { return typeof v === "string" && v.trim().length > 0 && v.length <= max; }

  function uuid() {
    var c = global.crypto;
    if (c && typeof c.randomUUID === "function") return c.randomUUID();
    var b = [];
    for (var i = 0; i < 16; i++) b.push(Math.floor(Math.random() * 256));
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    var h = b.map(function (x) { return (x + 0x100).toString(16).slice(1); }).join("");
    return h.slice(0, 8) + "-" + h.slice(8, 12) + "-" + h.slice(12, 16) + "-" + h.slice(16, 20) + "-" + h.slice(20);
  }

  function shuffle(list) {
    var a = list.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function createVoiceVaultMock(fixtures) {
    var fx = clone(fixtures || {});
    var seq = 0;
    var db = {
      ideas: fx.ideas || [],
      reports: fx.reports || [],
      votingRequests: fx.votingRequests || [],
      council: fx.council || { version: 1, rosterHash: "", members: [], selectionPolicy: { minVoters: 3, maxVoters: 5 } },
      councilChanges: fx.councilChanges || [],
      people: (fx.directory && fx.directory.people) || [],
      // Fixture audit chỉ là mẫu hiển thị; trong MOCK mọi thứ đều SIMULATED, giữ nguồn gốc ở declaredSource.
      audit: (fx.audit || []).map(function (e) { e.declaredSource = e.source; e.source = "SIMULATED"; return e; }),
    };
    var personas = fx.personas || [];
    // Chỉ trong memory mock: để hiển thị credit khi idea được duyệt. Không bao giờ nằm trong view.
    var creditName = {};
    var endorsedBy = {};
    var votedBy = {};
    var current = null;

    function ok(data) { return Promise.resolve({ ok: true, data: clone(data), requestId: "mock-req-" + (++seq), contractVersion: V }); }
    function fail(code, message, retryable) {
      return Promise.resolve({
        ok: false,
        error: { code: code, message: message || code, enforcement: "SIMULATED", retryable: retryable === true },
        requestId: "mock-req-" + (++seq),
        contractVersion: V,
      });
    }
    function page(items) { return ok({ items: items, nextCursor: null }); }
    function find(list, id) { return list.filter(function (x) { return x.id === id; })[0] || null; }
    function hasRole(role) { return !!current && current.roles.indexOf(role) >= 0; }
    function isCouncilMember(subject) {
      return db.council.members.some(function (m) { return m.subject === subject && m.active; });
    }
    function audit(action, kind, id, outcome) {
      db.audit.push({
        id: uuid(), at: new Date().toISOString(), action: action, outcome: outcome || "OK",
        source: "SIMULATED", resourceKind: kind, resourceId: id, requestId: "mock-req-" + (seq + 1),
      });
    }

    function session() {
      if (!current) return clone(fx.session && fx.session.anonymous) || { authenticated: false, subject: null, displayName: null, roles: [], capabilities: ["login"] };
      var caps = ["logout", "submitIdea", "submitReport"];
      if (hasRole("manager")) caps.push("endorseIdea");
      if (hasRole("director")) caps.push("decideIdea", "revealIdentity");
      if (isCouncilMember(current.subject)) caps.push("vote", "proposeCouncilChange");
      return { authenticated: true, subject: current.subject, displayName: current.displayName, roles: current.roles.slice(), capabilities: caps };
    }

    function ideaView(idea) {
      var v = clone(idea);
      v.capabilities = [];
      if (idea.status === "UNDER_REVIEW") {
        if (hasRole("manager") && !(endorsedBy[idea.id] || {})[current.subject]) v.capabilities.push("endorse");
        if (hasRole("director")) v.capabilities.push("decide");
      }
      return v;
    }

    function vrView(vr) {
      var v = clone(vr);
      v.capabilities = [];
      if (current && vr.state === "COLLECTING" && vr.voters.some(function (x) { return x.subject === current.subject && !x.hasVoted; })) {
        v.capabilities.push("vote");
      }
      if (current && vr.state === "READY" && vr.operation === "REVEAL_REPORT_IDENTITY" && hasRole("director")) v.capabilities.push("revealIdentity");
      return v;
    }

    function canSeeReports() { return hasRole("director") || isCouncilMember(current.subject); }

    // Bốc N trong [min, max] rồi bốc người; bắt buộc có ít nhất một thành viên độc lập.
    function selectJury(excluded) {
      var policy = db.council.selectionPolicy;
      var eligible = db.council.members.filter(function (m) { return m.active && excluded.indexOf(m.subject) < 0; });
      var independents = eligible.filter(function (m) { return m.independent; });
      if (eligible.length < policy.minVoters || independents.length === 0) return null;
      var maxN = Math.min(policy.maxVoters, eligible.length);
      var n = policy.minVoters + Math.floor(Math.random() * (maxN - policy.minVoters + 1));
      var anchor = shuffle(independents)[0];
      var rest = shuffle(eligible.filter(function (m) { return m.subject !== anchor.subject; })).slice(0, n - 1);
      return shuffle([anchor].concat(rest)).map(function (m) {
        return { subject: m.subject, displayName: m.displayName, independent: m.independent };
      });
    }

    function newVotingRequest(operation, kind, resourceId, jurors, purpose) {
      var vr = {
        id: uuid(), operation: operation, resourceKind: kind, resourceId: resourceId, state: "COLLECTING", version: 1,
        purpose: purpose, voterCount: jurors.length, quorumRequired: quorum(jurors.length),
        voters: jurors.map(function (j) { return { subject: j.subject, displayName: j.displayName, independent: j.independent, hasVoted: false }; }),
        validApprovals: 0, independentApproved: false,
        councilVersion: db.council.version, councilRosterHash: db.council.rosterHash,
        contextHash: "sha256:mock-" + resourceId.slice(0, 8), createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 7 * 864e5).toISOString(),
      };
      db.votingRequests.push(vr);
      return vr;
    }

    function syncChangeFromVote(vr) {
      if (vr.operation !== "CHANGE_COUNCIL") return;
      var change = find(db.councilChanges, vr.resourceId);
      if (!change) return;
      if (vr.state === "READY" || vr.state === "DENIED") { change.state = vr.state; change.version++; }
    }

    var runtime = {
      contractVersion: V,
      mode: "MOCK",

      init: function () { return ok(session()); },
      getSession: function () { return ok(session()); },
      login: function () {
        if (!current) current = personas.filter(function (p) { return p.roles.indexOf("employee") >= 0; })[0] || personas[0] || null;
        return ok(session());
      },
      logout: function () { current = null; return ok(session()); },

      listIdeas: function (query) {
        if (!current) return fail("UNAUTHENTICATED");
        var status = isObject(query) ? query.status : undefined;
        return page(db.ideas.filter(function (i) { return !status || i.status === status; }).map(ideaView));
      },
      getIdea: function (id) {
        if (!current) return fail("UNAUTHENTICATED");
        var idea = find(db.ideas, id);
        return idea ? ok(ideaView(idea)) : fail("NOT_FOUND");
      },
      submitIdea: function (input) {
        if (!current) return fail("UNAUTHENTICATED", "Cần đăng nhập để gửi ý tưởng.");
        if (!isObject(input) || !nonEmpty(input.title, 200) || !nonEmpty(input.description, 5000)
          || (input.category !== undefined && typeof input.category !== "string")
          || typeof input.publishCreditOnApproval !== "boolean") {
          return fail("INVALID_REQUEST", "Cần tiêu đề, mô tả và lựa chọn công khai tên.");
        }
        var idea = {
          id: uuid(), title: input.title.trim(), description: input.description.replace(/\r\n/g, "\n"),
          category: input.category || "other", status: "UNDER_REVIEW", version: 1, endorsementCount: 0,
          publishCreditOnApproval: input.publishCreditOnApproval, publicCredit: null, decisionReason: null,
          createdAt: new Date().toISOString(), capabilities: [],
        };
        creditName[idea.id] = current.displayName;
        db.ideas.unshift(idea);
        audit("IDEA_SUBMITTED", "IDEA", idea.id);
        return ok(ideaView(idea));
      },
      endorseIdea: function (id, expectedVersion) {
        if (!current) return fail("UNAUTHENTICATED");
        var idea = find(db.ideas, id);
        if (!idea) return fail("NOT_FOUND");
        if (!hasRole("manager")) return fail("FORBIDDEN", "Chỉ quản lý được endorse.");
        if (idea.status !== "UNDER_REVIEW" || expectedVersion !== idea.version) return fail("VERSION_CONFLICT", null, true);
        endorsedBy[id] = endorsedBy[id] || {};
        if (endorsedBy[id][current.subject]) return fail("VERSION_CONFLICT", "Bạn đã endorse ý tưởng này.");
        endorsedBy[id][current.subject] = true;
        idea.endorsementCount++;
        idea.version++;
        audit("IDEA_ENDORSED", "IDEA", id);
        return ok(ideaView(idea));
      },
      decideIdea: function (id, input) {
        if (!current) return fail("UNAUTHENTICATED");
        var idea = find(db.ideas, id);
        if (!idea) return fail("NOT_FOUND");
        if (!hasRole("director")) return fail("FORBIDDEN", "Chỉ giám đốc được duyệt.");
        if (!isObject(input) || ["APPROVE", "REJECT"].indexOf(input.decision) < 0 || !nonEmpty(input.reason, 2000)) {
          return fail("INVALID_REQUEST", "Cần quyết định APPROVE/REJECT và lý do.");
        }
        if (idea.status !== "UNDER_REVIEW" || (input.expectedVersion !== undefined && input.expectedVersion !== idea.version)) {
          return fail("VERSION_CONFLICT", null, true);
        }
        idea.status = input.decision === "APPROVE" ? "APPROVED" : "REJECTED";
        idea.decisionReason = input.reason;
        idea.version++;
        if (idea.status === "APPROVED" && idea.publishCreditOnApproval && creditName[id]) {
          idea.publicCredit = { displayName: creditName[id], verified: false };
        }
        audit("IDEA_DECIDED", "IDEA", id);
        return ok(ideaView(idea));
      },

      listReports: function () {
        if (!current) return fail("UNAUTHENTICATED");
        return page(canSeeReports() ? db.reports : []);
      },
      getReport: function (id) {
        if (!current) return fail("UNAUTHENTICATED");
        var report = find(db.reports, id);
        if (!report || !canSeeReports()) return fail("NOT_FOUND");
        return ok(report);
      },
      submitReport: function (input) {
        if (!current) return fail("UNAUTHENTICATED");
        if (!isObject(input) || !nonEmpty(input.title, 200) || !nonEmpty(input.evidenceDetails, 10000)
          || !Array.isArray(input.accusedPersonIds) || input.accusedPersonIds.length === 0
          || input.accusedPersonIds.some(function (pid) { return !find(db.people, pid); })) {
          return fail("INVALID_REQUEST", "Cần tiêu đề, chi tiết và ít nhất một người bị phản ánh hợp lệ.");
        }
        // Loại người bị tố và chính người nộp khỏi jury; người nộp không được lưu lại.
        var jury = selectJury(input.accusedPersonIds.concat([current.subject]));
        var report = {
          id: uuid(), title: input.title.trim(), summary: input.evidenceDetails.slice(0, 160),
          status: jury ? "INVESTIGATING" : "AWAITING_ELIGIBLE_JURY", version: 1,
          accusedPersonIds: input.accusedPersonIds.slice(),
          councilVersion: db.council.version, councilRosterHash: db.council.rosterHash,
          voterCount: jury ? jury.length : null, quorumRequired: jury ? quorum(jury.length) : null,
          jurors: jury || [], votingRequestId: null, createdAt: new Date().toISOString(), capabilities: [],
        };
        db.reports.unshift(report);
        audit("REPORT_SUBMITTED", "REPORT", report.id);
        return ok(report);
      },
      getDirectory: function () {
        if (!current) return fail("UNAUTHENTICATED");
        return ok({ people: db.people });
      },

      createUnmaskRequest: function (reportId, input) {
        if (!current) return fail("UNAUTHENTICATED");
        var report = find(db.reports, reportId);
        if (!report) return fail("NOT_FOUND");
        if (report.status === "AWAITING_ELIGIBLE_JURY") return fail("INSUFFICIENT_ELIGIBLE_JURORS");
        if (!report.jurors.some(function (j) { return j.subject === current.subject; })) return fail("FORBIDDEN", "Chỉ juror được phân công mới mở yêu cầu.");
        var existing = report.votingRequestId && find(db.votingRequests, report.votingRequestId);
        if (existing) return ok(vrView(existing));
        var purpose = isObject(input) && nonEmpty(input.purpose, 500) ? input.purpose : "Mở danh tính người phản ánh để điều tra";
        var vr = newVotingRequest("REVEAL_REPORT_IDENTITY", "REPORT", report.id, report.jurors, purpose);
        report.votingRequestId = vr.id;
        report.version++;
        audit("UNMASK_REQUESTED", "REPORT", report.id);
        return ok(vrView(vr));
      },
      listMyVotingRequests: function () {
        if (!current) return fail("UNAUTHENTICATED");
        var subject = current.subject;
        return page(db.votingRequests.filter(function (vr) {
          return vr.voters.some(function (v) { return v.subject === subject; });
        }).map(vrView));
      },
      getVotingRequest: function (id) {
        if (!current) return fail("UNAUTHENTICATED");
        var vr = find(db.votingRequests, id);
        if (!vr) return fail("NOT_FOUND");
        var isVoter = vr.voters.some(function (v) { return v.subject === current.subject; });
        if (!isVoter && !hasRole("director") && !isCouncilMember(current.subject)) return fail("NOT_FOUND");
        return ok(vrView(vr));
      },
      castVote: function (id, input) {
        if (!current) return fail("UNAUTHENTICATED");
        var vr = find(db.votingRequests, id);
        if (!vr) return fail("NOT_FOUND");
        var voter = vr.voters.filter(function (v) { return v.subject === current.subject; })[0];
        if (!voter) return fail("FORBIDDEN", "Bạn không nằm trong danh sách bỏ phiếu.");
        if (!isObject(input) || ["APPROVE", "DENY"].indexOf(input.decision) < 0 || !nonEmpty(input.reason, 2000)) {
          return fail("INVALID_REQUEST", "Cần APPROVE/DENY và lý do.");
        }
        if (Date.parse(vr.expiresAt) < Date.now()) return fail("APPROVAL_EXPIRED");
        votedBy[id] = votedBy[id] || {};
        if (voter.hasVoted || votedBy[id][current.subject]) return fail("VERSION_CONFLICT", "Bạn đã bỏ phiếu.");
        if (vr.state !== "COLLECTING") return fail("VERSION_CONFLICT", "Yêu cầu không còn nhận phiếu.");
        votedBy[id][current.subject] = true;
        voter.hasVoted = true;
        vr.version++;
        if (input.decision === "DENY") {
          vr.state = "DENIED";
        } else {
          vr.validApprovals++;
          if (voter.independent) vr.independentApproved = true;
          if (vr.validApprovals >= vr.quorumRequired && vr.independentApproved) vr.state = "READY";
        }
        syncChangeFromVote(vr);
        audit("VOTE_CAST", vr.resourceKind, vr.resourceId);
        return ok(vrView(vr));
      },

      getCouncil: function () {
        if (!current) return fail("UNAUTHENTICATED");
        return ok(db.council);
      },
      listCouncilChanges: function () {
        if (!current) return fail("UNAUTHENTICATED");
        return page(db.councilChanges);
      },
      submitCouncilChange: function (input) {
        if (!current) return fail("UNAUTHENTICATED");
        if (!isCouncilMember(current.subject)) return fail("FORBIDDEN", "Chỉ thành viên hội đồng được đề xuất.");
        if (!isObject(input) || !nonEmpty(input.reason, 2000) || !Array.isArray(input.proposedMembers) || !isObject(input.proposedSelectionPolicy)) {
          return fail("INVALID_REQUEST");
        }
        if (input.expectedCouncilVersion !== db.council.version) return fail("COUNCIL_VERSION_CONFLICT");
        var p = input.proposedSelectionPolicy;
        if (!(p.minVoters >= 3 && p.minVoters <= p.maxVoters && p.maxVoters <= 5)) return fail("INVALID_REQUEST", "Policy phải 3 <= min <= max <= 5.");
        var oldBy = {};
        db.council.members.forEach(function (m) { oldBy[m.subject] = m; });
        var newBy = {};
        input.proposedMembers.forEach(function (m) { newBy[m.subject] = m; });
        var diff = {
          added: Object.keys(newBy).filter(function (s) { return !oldBy[s]; }),
          removed: Object.keys(oldBy).filter(function (s) { return !newBy[s]; }),
          changed: Object.keys(newBy).filter(function (s) {
            var a = oldBy[s], b = newBy[s];
            return a && (a.independent !== b.independent || a.active !== b.active || a.membershipRole !== b.membershipRole);
          }),
        };
        // Bốc từ roster hiện hành (không phải roster đích).
        var jury = selectJury([]);
        var change = {
          id: uuid(), state: jury ? "COLLECTING" : "AWAITING_ELIGIBLE_JURY", version: 1, baseCouncilVersion: db.council.version,
          reason: input.reason, diff: diff, proposedMembers: clone(input.proposedMembers), proposedSelectionPolicy: clone(p),
          votingRequestId: null, voterCount: jury ? jury.length : null, quorumRequired: jury ? quorum(jury.length) : null,
          appliedCouncilVersion: null, createdAt: new Date().toISOString(),
        };
        if (jury) change.votingRequestId = newVotingRequest("CHANGE_COUNCIL", "COUNCIL_CHANGE", change.id, jury, "Đổi hội đồng").id;
        db.councilChanges.unshift(change);
        audit("COUNCIL_CHANGE_PROPOSED", "COUNCIL_CHANGE", change.id);
        return ok(change);
      },
      applyCouncilChange: function (id, expectedVersion) {
        if (!current) return fail("UNAUTHENTICATED");
        var change = find(db.councilChanges, id);
        if (!change) return fail("NOT_FOUND");
        if (expectedVersion !== change.version) return fail("VERSION_CONFLICT", null, true);
        if (change.baseCouncilVersion !== db.council.version) {
          change.state = "STALE";
          return fail("COUNCIL_VERSION_CONFLICT");
        }
        var vr = change.votingRequestId && find(db.votingRequests, change.votingRequestId);
        if (!vr || vr.state !== "READY") return fail("QUORUM_PENDING", "Chưa đủ phiếu để áp dụng.");
        vr.state = "CONSUMED";
        db.council.members = clone(change.proposedMembers);
        db.council.selectionPolicy = clone(change.proposedSelectionPolicy);
        db.council.version++;
        db.council.rosterHash = "sha256:mock-roster-v" + db.council.version;
        change.state = "APPLIED";
        change.version++;
        change.appliedCouncilVersion = db.council.version;
        db.councilChanges.forEach(function (c) {
          if (c !== change && ["AWAITING_ELIGIBLE_JURY", "COLLECTING", "READY", "APPLYING"].indexOf(c.state) >= 0) c.state = "STALE";
        });
        audit("COUNCIL_CHANGE_APPLIED", "COUNCIL_CHANGE", id);
        return ok(change);
      },

      revealIdentity: function (resourceKind, resourceId, requestId) {
        if (!current) return fail("UNAUTHENTICATED");
        if (resourceKind !== "REPORT") return fail("INVALID_REQUEST", "MOCK chỉ mô phỏng mở danh tính phản ánh.");
        var vr = find(db.votingRequests, requestId);
        if (!vr || vr.resourceId !== resourceId) return fail("NOT_FOUND");
        if (!hasRole("director")) return fail("FORBIDDEN", "Chỉ người nhận được chỉ định mới mở được.");
        if (vr.state === "DENIED") return fail("FORBIDDEN", "Yêu cầu đã bị từ chối.");
        if (vr.state !== "READY") return fail("QUORUM_PENDING", "Chưa đủ phiếu; danh tính vẫn khoá.");
        audit("IDENTITY_REVEALED", "REPORT", resourceId);
        return ok({
          resourceKind: "REPORT", resourceId: resourceId, votingRequestId: requestId,
          displayName: "Người phản ánh (mô phỏng)", simulated: true,
          note: "MOCK không giải mã gì; LIVE giải mã trong browser bằng Tide.",
        });
      },
      listAudit: function () {
        if (!current) return fail("UNAUTHENTICATED");
        return page(db.audit.slice().reverse());
      },
    };

    runtime.mock = {
      personas: function () { return clone(personas); },
      setPersona: function (subject) {
        var persona = personas.filter(function (p) { return p.subject === subject; })[0];
        if (!persona) return fail("NOT_FOUND", "Không có persona này.");
        current = persona;
        return ok(session());
      },
    };

    return runtime;
  }

  global.createVoiceVaultMock = createVoiceVaultMock;
})(window);

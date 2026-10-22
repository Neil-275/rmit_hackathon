// VoiceVault UI — mẫu tối thiểu để bàn giao. Classic script, DOM API thuần (không framework, không chèn HTML).
// Chỉ render ApiResult/capabilities/N/T/state mà runtime trả về; không tự quyết quyền.
(function (global) {
  "use strict";

  var doc = global.document;

  function h(tag, attrs) {
    var el = doc.createElement(tag);
    var a = attrs || {};
    Object.keys(a).forEach(function (k) {
      if (k === "text") el.textContent = a[k];
      else if (k === "class") el.className = a[k];
      else if (k.slice(0, 2) === "on") el.addEventListener(k.slice(2), a[k]);
      else el.setAttribute(k, a[k]);
    });
    for (var i = 2; i < arguments.length; i++) {
      var child = arguments[i];
      if (child === null || child === undefined || child === false) continue;
      [].concat(child).forEach(function (c) {
        if (c === null || c === undefined || c === false) return;
        el.appendChild(typeof c === "string" ? doc.createTextNode(c) : c);
      });
    }
    return el;
  }

  function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); }

  function mount(runtime) {
    var root = doc.getElementById("app") || doc.body.appendChild(h("main", { id: "app" }));
    var state = { session: null, tab: "ideas", message: null };
    var TABS = [["ideas", "Ý tưởng"], ["reports", "Phản ánh"], ["votes", "Bỏ phiếu"], ["council", "Hội đồng"], ["audit", "Audit"]];

    function notify(result, okText) {
      state.message = result.ok
        ? { kind: "ok", text: okText || "Đã xong." }
        : { kind: "error", text: result.error.code + " [" + result.error.enforcement + "]: " + result.error.message };
    }

    function act(promise, okText) {
      return promise.then(function (res) { notify(res, okText); return refresh(); });
    }

    function refresh() {
      return runtime.getSession().then(function (res) {
        state.session = res.ok ? res.data : null;
        return render();
      });
    }

    function banner() {
      return runtime.mode === "MOCK"
        ? h("div", { class: "vv-banner vv-mock", role: "note" },
          "Dữ liệu mô phỏng (MOCK) — không có mã hoá hay chặn thật; mọi kết quả mang nhãn SIMULATED.")
        : h("div", { class: "vv-banner vv-live" }, "LIVE — kết nối VoiceVault API và TideCloak.");
    }

    function sessionBar() {
      var s = state.session || {};
      var bar = h("div", { class: "vv-session" });
      if (s.authenticated) {
        bar.appendChild(h("span", { text: "Đang đăng nhập: " + s.displayName + " (" + s.roles.join(", ") + ")" }));
        bar.appendChild(h("button", { type: "button", onclick: function () { act(runtime.logout(), "Đã đăng xuất."); } }, "Đăng xuất"));
      } else {
        bar.appendChild(h("span", { text: "Chưa đăng nhập." }));
        bar.appendChild(h("button", { type: "button", onclick: function () { act(runtime.login(), "Đã đăng nhập."); } }, "Đăng nhập"));
      }
      if (runtime.mock && typeof runtime.mock.personas === "function") {
        var select = h("select", { "aria-label": "Đổi persona (MOCK)" }, h("option", { value: "" }, "— đổi persona (MOCK) —"));
        runtime.mock.personas().forEach(function (p) {
          select.appendChild(h("option", { value: p.subject }, p.displayName + " · " + p.roles.join("/")));
        });
        select.addEventListener("change", function () {
          if (select.value) act(runtime.mock.setPersona(select.value), "Đã đổi persona.");
        });
        bar.appendChild(select);
      }
      return bar;
    }

    function list(promise, renderItem, empty) {
      var box = h("div", { class: "vv-list" }, h("p", { class: "vv-muted" }, "Đang tải…"));
      promise.then(function (res) {
        clear(box);
        if (!res.ok) { box.appendChild(h("p", { class: "vv-error", text: res.error.code + ": " + res.error.message })); return; }
        if (!res.data.items.length) { box.appendChild(h("p", { class: "vv-muted" }, empty || "Chưa có dữ liệu.")); return; }
        res.data.items.forEach(function (item) { box.appendChild(renderItem(item)); });
      });
      return box;
    }

    function ideaForm() {
      var title = h("input", { name: "title", required: "required", maxlength: "200", placeholder: "Tiêu đề" });
      var desc = h("textarea", { name: "description", required: "required", rows: "3", placeholder: "Mô tả" });
      var credit = h("input", { type: "checkbox", name: "credit" });
      return h("form", {
        class: "vv-card",
        onsubmit: function (e) {
          e.preventDefault();
          act(runtime.submitIdea({ title: title.value, description: desc.value, category: "other", publishCreditOnApproval: credit.checked }), "Đã gửi ý tưởng ẩn danh.");
        },
      }, h("h3", {}, "Gửi ý tưởng ẩn danh"), title, desc,
      h("label", {}, credit, " Công khai tên tôi nếu được duyệt"), h("button", { type: "submit" }, "Gửi"));
    }

    function ideaCard(idea) {
      var actions = [];
      if (idea.capabilities.indexOf("endorse") >= 0) {
        actions.push(h("button", { type: "button", onclick: function () { act(runtime.endorseIdea(idea.id, idea.version), "Đã endorse."); } }, "Endorse"));
      }
      if (idea.capabilities.indexOf("decide") >= 0) {
        ["APPROVE", "REJECT"].forEach(function (d) {
          actions.push(h("button", { type: "button", onclick: function () {
            act(runtime.decideIdea(idea.id, { decision: d, reason: d === "APPROVE" ? "Đồng ý triển khai" : "Chưa phù hợp", expectedVersion: idea.version }), "Đã quyết định.");
          } }, d === "APPROVE" ? "Duyệt" : "Từ chối"));
        });
      }
      return h("article", { class: "vv-card" },
        h("h4", { text: idea.title }), h("p", { text: idea.description }),
        h("p", { class: "vv-meta", text: idea.status + " · v" + idea.version + " · " + idea.endorsementCount + " endorse"
          + (idea.publicCredit ? " · Tác giả: " + idea.publicCredit.displayName : "") }),
        actions);
    }

    function reportCard(r) {
      return h("article", { class: "vv-card" },
        h("h4", { text: r.title }), h("p", { text: r.summary }),
        h("p", { class: "vv-meta", text: r.status + (r.voterCount ? " · N=" + r.voterCount + ", T=" + r.quorumRequired : " · chưa đủ jury") }));
    }

    function voteCard(vr) {
      var actions = [];
      if (vr.capabilities && vr.capabilities.indexOf("vote") >= 0) {
        ["APPROVE", "DENY"].forEach(function (d) {
          actions.push(h("button", { type: "button", onclick: function () {
            act(runtime.castVote(vr.id, { decision: d, reason: d === "APPROVE" ? "Đồng ý" : "Chưa đủ căn cứ" }), "Đã bỏ phiếu.");
          } }, d));
        });
      }
      if (vr.capabilities && vr.capabilities.indexOf("revealIdentity") >= 0) {
        actions.push(h("button", { type: "button", onclick: function () {
          runtime.revealIdentity(vr.resourceKind, vr.resourceId, vr.id).then(function (res) {
            notify(res, res.ok ? "Danh tính: " + res.data.displayName : null);
            render();
          });
        } }, "Mở danh tính"));
      }
      return h("article", { class: "vv-card" },
        h("h4", { text: vr.operation + " — " + vr.purpose }),
        h("p", { class: "vv-meta", text: "Trạng thái " + vr.state + " · " + vr.validApprovals + "/" + vr.quorumRequired
          + " phiếu (N=" + vr.voterCount + ", T=" + vr.quorumRequired + ")" + (vr.independentApproved ? " · có phiếu độc lập" : "") }),
        h("ul", {}, vr.voters.map(function (v) {
          return h("li", { text: v.displayName + (v.independent ? " (độc lập)" : "") + (v.hasVoted ? " ✓" : "") });
        })),
        actions);
    }

    function councilView() {
      var box = h("div", {});
      runtime.getCouncil().then(function (res) {
        if (!res.ok) { box.appendChild(h("p", { class: "vv-error", text: res.error.code })); return; }
        var c = res.data;
        box.appendChild(h("p", { class: "vv-meta", text: "Phiên bản " + c.version + " · N từ " + c.selectionPolicy.minVoters + " đến " + c.selectionPolicy.maxVoters }));
        box.appendChild(h("ul", {}, c.members.map(function (m) {
          return h("li", { text: m.displayName + " — " + m.membershipRole + (m.independent ? " · độc lập" : "") + (m.active ? "" : " · ngưng") });
        })));
      });
      box.appendChild(h("h3", {}, "Đề xuất thay đổi"));
      box.appendChild(list(runtime.listCouncilChanges({}), function (c) {
        var actions = [];
        if (c.state === "READY") {
          actions.push(h("button", { type: "button", onclick: function () { act(runtime.applyCouncilChange(c.id, c.version), "Đã áp dụng."); } }, "Áp dụng"));
        }
        return h("article", { class: "vv-card" }, h("h4", { text: c.reason }),
          h("p", { class: "vv-meta", text: c.state + " · gốc v" + c.baseCouncilVersion + " · +" + c.diff.added.length + " / -" + c.diff.removed.length }), actions);
      }));
      return box;
    }

    function tabBody() {
      if (!state.session || !state.session.authenticated) return h("p", { class: "vv-muted" }, "Đăng nhập để xem nội dung.");
      switch (state.tab) {
        case "ideas": return [ideaForm(), list(runtime.listIdeas({}), ideaCard)];
        case "reports": return list(runtime.listReports({}), reportCard, "Không có phản ánh bạn được xem.");
        case "votes": return list(runtime.listMyVotingRequests({}), voteCard, "Bạn không có yêu cầu bỏ phiếu nào.");
        case "council": return councilView();
        default: return list(runtime.listAudit({}), function (e) {
          return h("p", { class: "vv-meta", text: e.at + " · " + e.action + " · " + e.outcome + " · nguồn " + e.source });
        });
      }
    }

    function render() {
      clear(root);
      root.appendChild(banner());
      root.appendChild(h("header", {}, h("h1", {}, "VoiceVault"), sessionBar()));
      if (state.message) {
        root.appendChild(h("p", { class: state.message.kind === "ok" ? "vv-ok" : "vv-error", role: "status", text: state.message.text }));
      }
      root.appendChild(h("nav", { class: "vv-tabs" }, TABS.map(function (t) {
        return h("button", { type: "button", "aria-pressed": String(state.tab === t[0]), onclick: function () { state.tab = t[0]; state.message = null; render(); } }, t[1]);
      })));
      root.appendChild(h("section", {}, tabBody()));
    }

    render();
    refresh();
  }

  global.VoiceVaultUI = { mount: mount };
})(window);

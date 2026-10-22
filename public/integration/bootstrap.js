// VoiceVault bootstrap (contract v1). Nạp cuối cùng: fixtures -> mock factory -> app -> bootstrap.
// file:// chỉ MOCK; http(s) chỉ LIVE (tải /integration/runtime.generated.js). Lỗi thì dừng và báo, không bao giờ
// chuyển sang mock. Không tự gọi login (tránh vòng lặp redirect). Mount đúng một lần.
(function (global) {
  "use strict";

  var CONTRACT_VERSION = "v1";
  var LIVE_BUNDLE = "/integration/runtime.generated.js";
  var config = global.VoiceVaultBootstrapConfig || {};
  var doc = global.document;
  var pending = null;

  function BootError(code, message) {
    this.code = code;
    this.message = message;
  }

  function messageOf(err) {
    return err && typeof err.message === "string" ? err.message : String(err);
  }

  function setState(mode, state) {
    var root = doc.documentElement;
    if (mode) root.setAttribute("data-vv-mode", mode);
    root.setAttribute("data-vv-state", state);
  }

  function showError(error) {
    var box = doc.createElement("div");
    box.setAttribute("role", "alert");
    box.className = "vv-boot-error";
    var title = doc.createElement("strong");
    title.textContent = error.code;
    var detail = doc.createElement("p");
    detail.textContent = error.message;
    box.appendChild(title);
    box.appendChild(detail);
    (doc.body || doc.documentElement).appendChild(box);
  }

  function defaultLoadScript(src) {
    return new Promise(function (resolve, reject) {
      var script = doc.createElement("script");
      script.src = src;
      script.async = false;
      script.onload = function () { resolve(); };
      script.onerror = function () { reject(new Error("Không tải được " + src)); };
      (doc.head || doc.documentElement).appendChild(script);
    });
  }

  function modeFor(protocol) {
    if (protocol === "file:") return "MOCK";
    if (protocol === "http:" || protocol === "https:") return "LIVE";
    return null;
  }

  function checkRuntime(runtime, mode, unavailable) {
    if (!runtime || typeof runtime !== "object") throw new BootError(unavailable, "Factory không trả runtime.");
    if (runtime.contractVersion !== CONTRACT_VERSION) {
      throw new BootError("CONTRACT_MISMATCH", "Runtime khai contract " + runtime.contractVersion + ", cần " + CONTRACT_VERSION + ".");
    }
    if (runtime.mode !== mode) {
      throw new BootError("RUNTIME_MODE_MISMATCH", "Runtime khai mode " + runtime.mode + ", trang này cần " + mode + ".");
    }
    if (typeof runtime.init !== "function") throw new BootError(unavailable, "Runtime thiếu init().");
    return runtime;
  }

  function createMock() {
    var fixtures = global.VoiceVaultFixtures;
    if (!fixtures || fixtures.contractVersion !== CONTRACT_VERSION) {
      throw new BootError("CONTRACT_MISMATCH", "Fixtures thiếu hoặc khác contract " + CONTRACT_VERSION + ".");
    }
    if (typeof global.createVoiceVaultMock !== "function") {
      throw new BootError("MOCK_RUNTIME_UNAVAILABLE", "Thiếu createVoiceVaultMock (mock-runtime.js).");
    }
    var runtime;
    try {
      runtime = global.createVoiceVaultMock(fixtures);
    } catch (err) {
      throw new BootError("MOCK_RUNTIME_UNAVAILABLE", messageOf(err));
    }
    return checkRuntime(runtime, "MOCK", "MOCK_RUNTIME_UNAVAILABLE");
  }

  function createLive(loadScript) {
    return Promise.resolve()
      .then(function () { return loadScript(LIVE_BUNDLE); })
      .catch(function (err) {
        throw new BootError("LIVE_RUNTIME_UNAVAILABLE", "Không tải được LIVE runtime: " + messageOf(err));
      })
      .then(function () {
        if (typeof global.createVoiceVaultLive !== "function") {
          throw new BootError("LIVE_RUNTIME_UNAVAILABLE", "LIVE bundle không định nghĩa createVoiceVaultLive.");
        }
        var runtime;
        try {
          runtime = global.createVoiceVaultLive({ contractVersion: CONTRACT_VERSION });
        } catch (err) {
          throw new BootError("LIVE_RUNTIME_UNAVAILABLE", messageOf(err));
        }
        return checkRuntime(runtime, "LIVE", "LIVE_RUNTIME_UNAVAILABLE");
      });
  }

  function start(options) {
    var mode = modeFor(global.location.protocol);
    var unavailable = mode === "LIVE" ? "LIVE_RUNTIME_UNAVAILABLE" : "MOCK_RUNTIME_UNAVAILABLE";
    var loadScript = (options && typeof options.loadScript === "function") ? options.loadScript : defaultLoadScript;
    var ui = global.VoiceVaultUI;
    var runtime;
    setState(mode, "loading");

    return Promise.resolve()
      .then(function () {
        if (!mode) throw new BootError("UNSUPPORTED_ORIGIN", "Không hỗ trợ protocol " + global.location.protocol);
        if (!ui || typeof ui.mount !== "function") throw new BootError("UI_UNAVAILABLE", "Thiếu VoiceVaultUI.mount (app.js).");
        return mode === "MOCK" ? createMock() : createLive(loadScript);
      })
      .then(function (rt) {
        runtime = rt;
        return Promise.resolve()
          .then(function () { return runtime.init(); })
          .catch(function (err) { throw new BootError(unavailable, "init() lỗi: " + messageOf(err)); });
      })
      .then(function (initResult) {
        if (!initResult || initResult.contractVersion !== CONTRACT_VERSION) {
          throw new BootError("CONTRACT_MISMATCH", "init() trả kết quả khác contract " + CONTRACT_VERSION + ".");
        }
        if (initResult.ok !== true) {
          var e = initResult.error || {};
          throw new BootError(unavailable, (e.code || "ERROR") + ": " + (e.message || "init() thất bại."));
        }
        try {
          ui.mount(runtime);
        } catch (err) {
          throw new BootError("UI_UNAVAILABLE", "mount() lỗi: " + messageOf(err));
        }
        setState(mode, "mounted");
        return { state: "mounted", mode: mode, error: null };
      })
      .catch(function (err) {
        var error = err instanceof BootError
          ? { code: err.code, message: err.message }
          : { code: unavailable, message: messageOf(err) };
        setState(mode, "error");
        showError(error);
        return { state: "error", mode: mode, error: error };
      });
  }

  function run(options) {
    if (!pending) pending = start(options);
    return pending;
  }

  var api = { contractVersion: CONTRACT_VERSION, run: run, ready: null };
  if (config.autoStart !== false) {
    api.ready = new Promise(function (resolve) {
      function go() { run().then(resolve); }
      if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", go, { once: true });
      else go();
    });
  }
  global.VoiceVaultBootstrap = api;
})(window);

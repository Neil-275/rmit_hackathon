// Test hành vi public/integration/bootstrap.js.
// file:// chỉ MOCK; HTTP(S) chỉ LIVE; lỗi không bao giờ fallback sang mock; mount đúng một lần.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CONTRACT_VERSION, FILE_URL, LIVE_URL, PATHS, createWindow, readSource, runClassic, setGlobal,
} from "./helpers/env.mjs";

const fixturesSource = JSON.parse(JSON.stringify((() => {
  const w = createWindow();
  runClassic(w, PATHS.fixtures);
  return w.VoiceVaultFixtures;
})()));

const okSession = (authenticated) => ({
  ok: true,
  data: { authenticated, subject: authenticated ? "an" : null, displayName: authenticated ? "An" : "Signed out", role: "employee", capabilities: { canSubmit: authenticated } },
  requestId: "req-test",
  contractVersion: CONTRACT_VERSION,
});

function fakeRuntime(mode, overrides = {}) {
  const calls = [];
  const runtime = {
    contractVersion: CONTRACT_VERSION,
    mode,
    calls,
    init: async () => { calls.push("init"); return okSession(false); },
    login: async () => { calls.push("login"); return okSession(true); },
    getSession: async () => okSession(false),
    ...overrides,
  };
  return runtime;
}

/**
 * Dựng trang với các global đã chốt; bootstrap không tự chạy để test gọi run().
 * options.fixtures === null nghĩa là không nạp fixtures.
 */
function setup(url, options = {}) {
  const window = createWindow(url);
  const events = [];
  setGlobal(window, "VoiceVaultBootstrapConfig", { autoStart: options.autoStart ?? false });

  if (options.fixtures !== null) setGlobal(window, "VoiceVaultFixtures", options.fixtures ?? fixturesSource);

  const mockRuntime = options.mockRuntime ?? fakeRuntime("MOCK");
  if (options.withMockFactory !== false) {
    window.createVoiceVaultMock = (fixtures) => {
      events.push({ type: "createMock", fixtures });
      return mockRuntime;
    };
  }

  const liveRuntime = options.liveRuntime ?? fakeRuntime("LIVE");
  const loadScript = options.loadScript ?? (async (src) => {
    events.push({ type: "loadScript", src });
    window.createVoiceVaultLiveRuntime = (...args) => {
      events.push({ type: "createLive", args });
      return liveRuntime;
    };
  });

  if (options.withUI !== false) {
    window.VoiceVaultUI = {
      mount: async (runtime) => {
        events.push({ type: "mount", runtime, initCalledBefore: runtime.calls?.includes("init") });
        await runtime.init();
      },
    };
  }

  let networkCalls = 0;
  window.fetch = async () => { networkCalls++; throw new Error("fetch không được gọi trong bootstrap"); };

  runClassic(window, PATHS.bootstrap);
  const run = () => window.VoiceVaultBootstrap.run({ loadScript });
  return {
    window, events, mockRuntime, liveRuntime, run,
    of: (type) => events.filter((e) => e.type === type),
    get networkCalls() { return networkCalls; },
  };
}

const html = (window) => window.document.documentElement;
const alertText = (window) =>
  [...window.document.querySelectorAll("[role=alert]")].map((el) => el.textContent).join("\n");

function assertNoMount(ctx) {
  assert.equal(ctx.of("mount").length, 0, "không được mount khi lỗi");
  assert.equal(ctx.of("createMock").length, 0, "không được fallback sang mock");
}

test("expose VoiceVaultBootstrap v1 và không tự chạy khi autoStart=false", async () => {
  const ctx = setup(FILE_URL);
  assert.ok(ctx.window.VoiceVaultBootstrap, "bootstrap must expose its public startup controller");
  assert.equal(ctx.window.VoiceVaultBootstrap.contractVersion, CONTRACT_VERSION);
  assert.equal(typeof ctx.window.VoiceVaultBootstrap.run, "function");
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(ctx.of("mount").length, 0);
});

test("file://: mount owns init exactly once and never loads the LIVE bundle", async () => {
  const ctx = setup(FILE_URL);
  const result = await ctx.run();
  assert.equal(result.state, "mounted");
  assert.equal(result.mode, "MOCK");
  assert.equal(result.error, null);

  const created = ctx.of("createMock");
  assert.equal(created.length, 1);
  assert.equal(created[0].fixtures, ctx.window.VoiceVaultFixtures, "phải truyền đúng window.VoiceVaultFixtures");

  const mounts = ctx.of("mount");
  assert.equal(mounts.length, 1);
  assert.equal(mounts[0].runtime, ctx.mockRuntime);
  assert.equal(mounts[0].initCalledBefore, false, "bootstrap must leave init to UI.mount");
  assert.deepEqual(ctx.mockRuntime.calls, ["init"]);

  assert.equal(ctx.of("loadScript").length, 0);
  assert.equal(ctx.networkCalls, 0);
  assert.equal(html(ctx.window).getAttribute("data-vv-mode"), "MOCK");
  assert.equal(html(ctx.window).getAttribute("data-vv-state"), "mounted");
});

test("file://: thiếu createVoiceVaultMock thì báo MOCK_RUNTIME_UNAVAILABLE", async () => {
  const ctx = setup(FILE_URL, { withMockFactory: false });
  const result = await ctx.run();
  assert.equal(result.state, "error");
  assert.equal(result.error.code, "MOCK_RUNTIME_UNAVAILABLE");
  assert.equal(ctx.of("mount").length, 0);
});

test("file://: thiếu fixtures thì báo CONTRACT_MISMATCH", async () => {
  const ctx = setup(FILE_URL, { fixtures: null });
  const result = await ctx.run();
  assert.equal(result.error?.code, "CONTRACT_MISMATCH");
  assertNoMount(ctx);
});

test("fixtures khác contract version thì dừng CONTRACT_MISMATCH", async () => {
  const ctx = setup(FILE_URL, { fixtures: { ...fixturesSource, contractVersion: "v2" } });
  const result = await ctx.run();
  assert.equal(result.state, "error");
  assert.equal(result.error.code, "CONTRACT_MISMATCH");
  assertNoMount(ctx);
  assert.match(alertText(ctx.window), /CONTRACT_MISMATCH/);
});

test("runtime khác contract version thì dừng CONTRACT_MISMATCH", async () => {
  const ctx = setup(FILE_URL, { mockRuntime: { ...fakeRuntime("MOCK"), contractVersion: "v2" } });
  const result = await ctx.run();
  assert.equal(result.error?.code, "CONTRACT_MISMATCH");
  assert.equal(ctx.of("mount").length, 0);
});

test("mock runtime khai mode khác MOCK thì báo RUNTIME_MODE_MISMATCH", async () => {
  const ctx = setup(FILE_URL, { mockRuntime: fakeRuntime("LIVE") });
  const result = await ctx.run();
  assert.equal(result.error?.code, "RUNTIME_MODE_MISMATCH");
  assert.equal(ctx.of("mount").length, 0);
});

test("HTTP: tải runtime.generated.js, tạo LIVE và mount, không đụng mock", async () => {
  const ctx = setup(LIVE_URL);
  const result = await ctx.run();
  assert.equal(result.state, "mounted");
  assert.equal(result.mode, "LIVE");

  const loads = ctx.of("loadScript");
  assert.equal(loads.length, 1);
  assert.match(loads[0].src, /\/integration\/runtime\.generated\.js(\?.*)?$/);
  assert.equal(ctx.of("createLive").length, 1);
  assert.equal(ctx.of("createMock").length, 0);

  const mounts = ctx.of("mount");
  assert.equal(mounts.length, 1);
  assert.equal(mounts[0].runtime, ctx.liveRuntime);
  assert.equal(mounts[0].initCalledBefore, false);
  assert.deepEqual(ctx.liveRuntime.calls, ["init"]);
  assert.deepEqual(ctx.of("createLive")[0].args, [], "factory uses the agreed zero-argument adapter wrapper");
  assert.equal(html(ctx.window).getAttribute("data-vv-mode"), "LIVE");
});

test("HTTPS: query string không bật được mock", async () => {
  const ctx = setup("https://voicevault.example/ui/index.html?mode=MOCK&mock=1&runtime=mock#mock");
  const result = await ctx.run();
  assert.equal(result.mode, "LIVE");
  assert.equal(ctx.of("createMock").length, 0);
});

test("HTTP: tải bundle lỗi thì báo LIVE_RUNTIME_UNAVAILABLE, không fallback", async () => {
  const ctx = setup(LIVE_URL, { loadScript: async () => { throw new Error("404"); } });
  const result = await ctx.run();
  assert.equal(result.state, "error");
  assert.equal(result.error.code, "LIVE_RUNTIME_UNAVAILABLE");
  assertNoMount(ctx);
  assert.equal(html(ctx.window).getAttribute("data-vv-state"), "error");
  assert.match(alertText(ctx.window), /LIVE_RUNTIME_UNAVAILABLE/);
});

test("HTTP: bundle without createVoiceVaultLiveRuntime fails closed", async () => {
  const ctx = setup(LIVE_URL, { loadScript: async () => {} });
  const result = await ctx.run();
  assert.equal(result.error?.code, "LIVE_RUNTIME_UNAVAILABLE");
  assertNoMount(ctx);
});

test("HTTP: init failure inside mount reports LIVE_RUNTIME_UNAVAILABLE without fallback", async () => {
  const live = fakeRuntime("LIVE", { init: async () => { throw new Error("issuer sai"); } });
  const ctx = setup(LIVE_URL, { liveRuntime: live });
  const result = await ctx.run();
  assert.equal(result.error?.code, "LIVE_RUNTIME_UNAVAILABLE");
  assert.equal(ctx.of("mount").length, 1);
  assert.equal(ctx.of("createMock").length, 0);
});

test("HTTP: chưa đăng nhập vẫn mount, không tự gọi login (tránh vòng lặp redirect)", async () => {
  const ctx = setup(LIVE_URL);
  const result = await ctx.run();
  assert.equal(result.state, "mounted");
  assert.ok(!ctx.liveRuntime.calls.includes("login"));
});

test("LIVE runtime khai mode MOCK thì báo RUNTIME_MODE_MISMATCH", async () => {
  const ctx = setup(LIVE_URL, { liveRuntime: fakeRuntime("MOCK") });
  const result = await ctx.run();
  assert.equal(result.error?.code, "RUNTIME_MODE_MISMATCH");
  assertNoMount(ctx);
});

test("thiếu VoiceVaultUI.mount thì báo UI_UNAVAILABLE", async () => {
  const ctx = setup(FILE_URL, { withUI: false });
  const result = await ctx.run();
  assert.equal(result.error?.code, "UI_UNAVAILABLE");
});

test("protocol không hỗ trợ thì báo UNSUPPORTED_ORIGIN", async () => {
  const ctx = setup("about:blank");
  const result = await ctx.run();
  assert.equal(result.error?.code, "UNSUPPORTED_ORIGIN");
  assertNoMount(ctx);
  assert.equal(ctx.of("loadScript").length, 0);
});

test("gọi run nhiều lần chỉ mount một lần", async () => {
  const ctx = setup(FILE_URL);
  const [a, b] = await Promise.all([ctx.run(), ctx.run()]);
  await ctx.run();
  assert.equal(ctx.of("mount").length, 1);
  assert.equal(ctx.of("createMock").length, 1);
  assert.deepEqual(a, b);
});

test("thông báo lỗi render bằng text, không chèn HTML", async () => {
  const payload = '<img src=x onerror="window.__xss=1">';
  const live = fakeRuntime("LIVE", { init: async () => { throw new Error(payload); } });
  const ctx = setup(LIVE_URL, { liveRuntime: live });
  await ctx.run();
  const alerts = ctx.window.document.querySelectorAll("[role=alert]");
  assert.ok(alerts.length >= 1, "phải có vùng role=alert");
  for (const el of alerts) assert.equal(el.querySelector("img"), null);
  assert.equal(ctx.window.__xss, undefined);
});

test("autoStart mặc định trên file:// và expose ready", async () => {
  const window = createWindow(FILE_URL);
  setGlobal(window, "VoiceVaultFixtures", fixturesSource);
  const mounts = [];
  window.createVoiceVaultMock = () => fakeRuntime("MOCK");
  window.VoiceVaultUI = { mount: (rt) => mounts.push(rt) };
  runClassic(window, PATHS.bootstrap);
  const ready = window.VoiceVaultBootstrap.ready;
  assert.equal(typeof ready?.then, "function", "phải expose VoiceVaultBootstrap.ready");
  const result = await ready;
  assert.equal(result.state, "mounted");
  assert.equal(mounts.length, 1);
});

test("source bootstrap không dùng ES module, fetch, storage hoặc innerHTML", () => {
  const src = readSource(PATHS.bootstrap);
  assert.doesNotMatch(src, /^\s*(import|export)\s/m);
  assert.doesNotMatch(src, /\bfetch\s*\(|XMLHttpRequest/);
  assert.doesNotMatch(src, /localStorage|sessionStorage|indexedDB/);
  assert.doesNotMatch(src, /innerHTML|outerHTML|insertAdjacentHTML|document\.write/);
});

// Smoke test mở public/ui/index.html bằng file:// như máy bạn cùng nhóm (không server, không mạng).
import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM, ResourceLoader, VirtualConsole } from "jsdom";
import { PATHS, readSource } from "./helpers/env.mjs";

const EXPECTED_SCRIPTS = [
  "../integration/contract-fixtures.js",
  "./mock-runtime.js",
  "./views/helpers.js",
  "./views/dialogs.js",
  "./views/pages.js",
  "./app.js",
  "../integration/bootstrap.js",
];

class RecordingLoader extends ResourceLoader {
  constructor() {
    super();
    this.requested = [];
  }
  fetch(url, options) {
    this.requested.push(url);
    if (!url.startsWith("file:")) return null; // chặn mọi request mạng
    return super.fetch(url, options);
  }
}

async function openIndex() {
  readSource(PATHS.index);
  const loader = new RecordingLoader();
  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on("jsdomError", (e) => errors.push(e.message));
  virtualConsole.on("error", (...args) => errors.push(args.join(" ")));
  const dom = await JSDOM.fromFile(PATHS.index, {
    runScripts: "dangerously",
    resources: loader,
    pretendToBeVisual: true,
    virtualConsole,
  });
  const { window } = dom;
  if (window.document.readyState !== "complete") {
    await new Promise((resolve) => window.addEventListener("load", resolve, { once: true }));
  }
  const ready = window.VoiceVaultBootstrap?.ready;
  const result = ready ? await Promise.race([ready, new Promise((r) => setTimeout(() => r("timeout"), 3000))]) : null;
  return { window, loader, errors, result };
}

test("index.html khai đúng thứ tự classic script defer, đường dẫn tương đối", () => {
  const dom = new JSDOM(readSource(PATHS.index));
  const scripts = [...dom.window.document.querySelectorAll("script")];
  const srcs = scripts.map((s) => s.getAttribute("src")).filter(Boolean);
  assert.deepEqual(srcs, EXPECTED_SCRIPTS);
  for (const s of scripts) {
    if (!s.getAttribute("src")) continue;
    assert.ok(s.hasAttribute("defer"), `${s.getAttribute("src")} thiếu defer`);
    assert.notEqual(s.getAttribute("type"), "module", "không dùng ES module trên file://");
  }
  assert.ok(!srcs.some((s) => s.includes("runtime.generated.js")), "index không được tải LIVE bundle trực tiếp");
});

test("index.html không phụ thuộc CDN/mạng, có charset/viewport/lang", () => {
  const dom = new JSDOM(readSource(PATHS.index));
  const doc = dom.window.document;
  for (const el of doc.querySelectorAll("[src], link[href]")) {
    const ref = el.getAttribute("src") ?? el.getAttribute("href");
    assert.doesNotMatch(ref, /^(https?:)?\/\//, `tài nguyên ngoài: ${ref}`);
    assert.doesNotMatch(ref, /^\//, `đường dẫn tuyệt đối hỏng trên file://: ${ref}`);
  }
  assert.ok(doc.querySelector("meta[charset]"));
  assert.ok(doc.querySelector('meta[name="viewport"]'));
  assert.ok(doc.documentElement.getAttribute("lang"));
});

test("mở bằng file:// thì mount MOCK, không lỗi và không request ngoài file://", async () => {
  const { window, loader, errors, result } = await openIndex();
  assert.notEqual(result, "timeout", "bootstrap không hoàn tất trong 3s");
  assert.ok(result, "thiếu VoiceVaultBootstrap.ready");
  assert.equal(result.state, "mounted", `bootstrap lỗi: ${JSON.stringify(result.error)}`);
  assert.equal(result.mode, "MOCK");
  assert.equal(window.document.documentElement.getAttribute("data-vv-mode"), "MOCK");
  assert.deepEqual(errors, [], "Console/script có lỗi");
  assert.deepEqual(loader.requested.filter((u) => !u.startsWith("file:")), []);
  assert.ok(!loader.requested.some((u) => u.includes("runtime.generated.js")));
});

test("UI sau khi mount hiển thị nhãn dữ liệu mô phỏng", async () => {
  const { window } = await openIndex();
  assert.match(window.document.body.textContent, /mô phỏng|MOCK/i);
});

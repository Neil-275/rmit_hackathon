// Quy tắc tĩnh cho file public chạy được trên file:// và không lộ dữ liệu nhạy cảm.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { PATHS, ROOT, readSource } from "./helpers/env.mjs";

const CLASSIC_FILES = [PATHS.fixtures, PATHS.bootstrap, PATHS.mock, PATHS.helpers, PATHS.dialogs, PATHS.pages, PATHS.app];
const rel = (file) => path.relative(ROOT, file);

for (const file of CLASSIC_FILES) {
  test(`${rel(file)}: classic script, không module/storage/eval/HTML injection`, () => {
    const src = readSource(file);
    assert.doesNotMatch(src, /^\s*(import|export)\s/m, "không dùng ES module");
    assert.doesNotMatch(src, /\brequire\s*\(/, "không dùng CommonJS/Node");
    assert.doesNotMatch(src, /localStorage|sessionStorage|indexedDB|document\.cookie/, "không lưu trữ phía browser");
    assert.doesNotMatch(src, /\beval\s*\(|new\s+Function\s*\(/, "không eval");
    assert.doesNotMatch(src, /\.innerHTML\s*=|outerHTML\s*=|insertAdjacentHTML|document\.write/, "render bằng textContent/DOM API");
    assert.doesNotMatch(src, /https?:\/\/(?!localhost)[^\s'"]+\.(js|css)/, "không tải script/style từ CDN");
  });
}

for (const file of [PATHS.fixtures, PATHS.mock]) {
  test(`${rel(file)}: không gọi mạng`, () => {
    assert.doesNotMatch(readSource(file), /\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon/);
  });
}

test("runtime.generated.js bị gitignore", () => {
  const ignore = readFileSync(path.join(ROOT, ".gitignore"), "utf8");
  assert.match(ignore, /^public\/integration\/runtime\.generated\.js$/m);
});

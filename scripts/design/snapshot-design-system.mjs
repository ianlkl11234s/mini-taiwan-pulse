#!/usr/bin/env node
/**
 * 把活的元件頁（tools/design-system.html）存成單一靜態 HTML：docs/design-system/reference.html。
 *
 * 用法：先開 dev server（npm run dev，或指定 port），再跑
 *   npm run design:snapshot                  # 預設 http://127.0.0.1:3721
 *   npm run design:snapshot -- --port 3750
 *
 * 做法：用 agent-browser 開頁，等 <html data-ds-ready="1">，把 canvas 換成 dataURL 圖片、
 * 移除 script，存下 outerHTML（vite dev 注入的 <style> 會一起保留，所以樣式與活頁一致）。
 * 快照會落後程式；以活的元件頁為準。
 */
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const portArg = process.argv.indexOf("--port");
const port = portArg > -1 ? process.argv[portArg + 1] : "3721";
const url = `http://127.0.0.1:${port}/tools/design-system.html`;
const out = resolve(process.cwd(), "docs/design-system/reference.html");
const session = ["--session-name", `ds-snapshot-${process.pid}`];

const ab = (...args) => execFileSync("agent-browser", [...session, ...args], { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
const evalJs = (js) => {
  const raw = ab("eval", js).trim().split("\n").pop();
  return JSON.parse(raw);
};

try {
  ab("set", "viewport", "1440", "900");
  ab("open", url);
  let ready = false;
  for (let i = 0; i < 60 && !ready; i++) {
    ready = evalJs(`document.documentElement.dataset.dsReady === "1"`) === true;
    if (!ready) execFileSync("sleep", ["1"]);
  }
  if (!ready) throw new Error(`頁面 60 秒內沒有出現 data-ds-ready（${url}）`);

  const html = evalJs(`(() => {
    const doc = document.documentElement.cloneNode(true);
    const live = [...document.querySelectorAll("canvas")];
    [...doc.querySelectorAll("canvas")].forEach((c, i) => {
      const img = document.createElement("img");
      try { img.src = live[i].toDataURL("image/png"); } catch { img.alt = "canvas"; }
      img.width = live[i].width; img.height = live[i].height;
      img.setAttribute("style", live[i].getAttribute("style") || "");
      img.className = live[i].className;
      c.replaceWith(img);
    });
    doc.querySelectorAll("script, link[rel=modulepreload]").forEach((el) => el.remove());
    doc.querySelectorAll("[data-ds-live-only]").forEach((el) => el.remove());
    const stamp = document.createComment(" 靜態快照：" + new Date().toISOString() + "，來源 tools/design-system.html。以活的元件頁為準。 ");
    doc.insertBefore(stamp, doc.firstChild);
    return "<!doctype html>\\n" + doc.outerHTML;
  })()`);

  writeFileSync(out, html);
  console.log(`已寫入 ${out}（${(html.length / 1024).toFixed(0)} KB）`);
} finally {
  try { ab("close"); } catch { /* 已關閉 */ }
}

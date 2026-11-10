#!/usr/bin/env node
/**
 * 入倉守門接 CI（AG-13）：圖層總表 docs/features/general-analysis/layer-status.csv 的 warehouse_status=missing
 * （沒入倉、也沒標 DISPLAY_ONLY／no_upstream）只准減少，不准比 base 多出任何一層。
 *
 * 為什麼比 CSV、不直接讀 pulse-data：pulse-data 是私有 repo，公開 repo 的 CI 沒有 token 讀不到；
 * CSV 由 scripts/research/build-layer-status.mjs 依 pulse-data 登記簿產生，且 layerStatusCoverage.test.ts 強制它
 * 與 manifest 的 key 一致（新圖層沒重產 CSV → 那支測試紅）。所以新圖層只要在 CSV 是 missing，這裡就紅；
 * pulse-data 的 _warehouse_baseline.yaml 被加回新層也一樣會在這裡被擋（新層在 CSV 仍是 missing）。
 *
 *   node scripts/research/check-warehouse-gate.mjs [--base <git ref>]   # 預設 origin/develop
 * CI 帶 PR 的 base SHA（push 時帶 before SHA）；base 沒有這個檔 → 失敗（不可靜默略過）。
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const CSV_PATH = "docs/features/general-analysis/layer-status.csv";

/** 最小 CSV 解析（雙引號欄位、"" 轉義、欄內換行），回傳 layer_key → warehouse_status */
export function parseStatusCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n") { row.push(cell.replace(/\r$/, "")); rows.push(row); row = []; cell = ""; }
    else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [header = [], ...body] = rows;
  const k = header.indexOf("layer_key");
  const s = header.indexOf("warehouse_status");
  if (k < 0 || s < 0) throw new Error(`${CSV_PATH} 缺 layer_key 或 warehouse_status 欄`);
  return new Map(body.filter((r) => r[k]).map((r) => [r[k], r[s] ?? ""]));
}

/** head 新出現的 missing（新圖層，或既有層退回 missing）與已減少的 missing */
export function diffMissing(base, head) {
  const missing = (m) => new Set([...m].filter(([, v]) => v === "missing").map(([k]) => k));
  const b = missing(base);
  const h = missing(head);
  return {
    added: [...h].filter((k) => !b.has(k)).sort(),
    removed: [...b].filter((k) => !h.has(k)).sort(),
    baseCount: b.size,
    headCount: h.size,
  };
}

function main() {
  const i = process.argv.indexOf("--base");
  const base = (i >= 0 ? process.argv[i + 1] : "") || "origin/develop";
  let baseText;
  try {
    baseText = execFileSync("git", ["show", `${base}:${CSV_PATH}`], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] });
  } catch (err) {
    console.error(`::error::讀不到 base（${base}）的 ${CSV_PATH}：${err.stderr?.toString().trim() || err.message}`);
    return 1;
  }
  const d = diffMissing(parseStatusCsv(baseText), parseStatusCsv(readFileSync(CSV_PATH, "utf8")));
  console.log(`入倉守門（AG-13）：未入倉也未標 DISPLAY_ONLY 的圖層 base ${d.baseCount} → 本次 ${d.headCount}（減少 ${d.removed.length}、新增 ${d.added.length}）`);
  if (!d.added.length) return 0;
  console.error(
    `::error::${d.added.length} 個圖層沒入倉、也沒標 DISPLAY_ONLY：${d.added.join(", ")}。` +
      "新圖層要在 pulse-data 登記並發包入倉（warehouse 區塊），真的只做展示才列進 registry/_display_only.yaml（reason＋unlock）；" +
      "_warehouse_baseline.yaml 只減不增、不可加新層。改完用 build-layer-status.mjs 重產 layer-status.csv。",
  );
  return 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) process.exitCode = main();

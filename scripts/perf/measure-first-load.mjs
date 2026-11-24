#!/usr/bin/env node
/**
 * 開站實際要下載的 JS／CSS 量（B1 P0）。只報告、不擋：永遠 exit 0（除非 dist 不存在或參數錯）。
 *
 * 範圍：dist/index.html 的入口 <script type="module">、全部 modulepreload、全部 stylesheet。
 * 不能只看 main-*.js：manifest 在 statisticsText-*.js，由 modulepreload 一起抓，只量 main 會被「搬到別的 preload chunk」騙過。
 *
 *   node scripts/perf/measure-first-load.mjs [--dist dist] [--json out.json] [--baseline base.json]
 *                                            [--modules] [--summary]
 *
 *   --json      寫出 JSON（total、files、top10、modules）
 *   --baseline  與先前的 JSON 比較，印出差異
 *   --modules   用 sourcemap 估算各來源模組占比（需 `npx vite build --sourcemap`；沒有 .map 就略過）
 *   --summary   同時把 markdown 表格附加到 $GITHUB_STEP_SUMMARY（沒設就略過）
 *
 * gzip 用 level 9；brotli 用 quality 11（每檔約數秒，總共約 10–20 秒）。
 */
import { readFileSync, existsSync, writeFileSync, appendFileSync } from "node:fs";
import { gzipSync, brotliCompressSync, constants } from "node:zlib";
import { join, resolve, basename } from "node:path";

const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const flag = (name) => args.includes(name);

const dist = resolve(opt("--dist") ?? "dist");
const indexPath = join(dist, "index.html");
if (!existsSync(indexPath)) {
  console.error(`找不到 ${indexPath}，請先 npm run build`);
  process.exit(2);
}

const html = readFileSync(indexPath, "utf8");

/** 依出現順序收集 index.html 的資源（去重） */
export function collectAssets(htmlText) {
  const out = new Map();
  const add = (href, role) => {
    if (!href || /^https?:\/\//.test(href)) return;
    const clean = href.split(/[?#]/)[0].replace(/^\//, "");
    if (!out.has(clean)) out.set(clean, role);
  };
  for (const tag of htmlText.match(/<script\b[^>]*>/g) ?? []) {
    if (/type=["']module["']/.test(tag)) add(tag.match(/\bsrc=["']([^"']+)["']/)?.[1], "entry");
  }
  for (const tag of htmlText.match(/<link\b[^>]*>/g) ?? []) {
    const rel = tag.match(/\brel=["']([^"']+)["']/)?.[1];
    const href = tag.match(/\bhref=["']([^"']+)["']/)?.[1];
    if (rel === "modulepreload") add(href, "modulepreload");
    else if (rel === "stylesheet") add(href, "stylesheet");
  }
  return out;
}

const assets = collectAssets(html);
const files = [];
for (const [rel, role] of assets) {
  const p = join(dist, rel);
  if (!existsSync(p)) {
    console.error(`index.html 引用的 ${rel} 不在 dist 內，略過`);
    continue;
  }
  const buf = readFileSync(p);
  files.push({
    file: rel,
    role,
    raw: buf.length,
    gzip: gzipSync(buf, { level: 9 }).length,
    brotli: brotliCompressSync(buf, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }).length,
  });
}

const sum = (k) => files.reduce((s, f) => s + f[k], 0);
const total = { files: files.length, raw: sum("raw"), gzip: sum("gzip"), brotli: sum("brotli") };
const top10 = [...files].sort((a, b) => b.raw - a.raw).slice(0, 10);
const byRole = {};
for (const f of files) {
  const r = (byRole[f.role] ??= { files: 0, raw: 0, gzip: 0, brotli: 0 });
  r.files++;
  r.raw += f.raw;
  r.gzip += f.gzip;
  r.brotli += f.brotli;
}

// ---- 各來源模組占比（sourcemap） ----
const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const B64I = Object.fromEntries([...B64].map((c, i) => [c, i]));
function decodeVlqLine(line) {
  const segs = [];
  let i = 0;
  while (i < line.length) {
    const seg = [];
    while (i < line.length && line[i] !== ",") {
      let shift = 0;
      let v = 0;
      let cont;
      do {
        const d = B64I[line[i++]];
        cont = d & 32;
        v += (d & 31) << shift;
        shift += 5;
      } while (cont);
      seg.push(v & 1 ? -(v >> 1) : v >> 1);
    }
    segs.push(seg);
    i++;
  }
  return segs;
}

/** 回傳 Map<來源路徑, 估算輸出字元數>：segment 起點到下一個 segment（或行尾）的距離歸給該 segment 的來源 */
function attribute(jsPath, mapPath) {
  const map = JSON.parse(readFileSync(mapPath, "utf8"));
  const lines = readFileSync(jsPath, "utf8").split("\n");
  const sizes = new Map();
  let srcIdx = 0;
  const mapLines = map.mappings.split(";");
  for (let ln = 0; ln < mapLines.length; ln++) {
    const segs = mapLines[ln] === "" ? [] : decodeVlqLine(mapLines[ln]);
    let col = 0;
    const abs = [];
    for (const s of segs) {
      col += s[0];
      if (s.length >= 4) {
        srcIdx += s[1];
        abs.push({ col, src: srcIdx });
      } else abs.push({ col, src: -1 });
    }
    const lineLen = (lines[ln] ?? "").length;
    for (let k = 0; k < abs.length; k++) {
      const end = k + 1 < abs.length ? abs[k + 1].col : lineLen;
      if (abs[k].src < 0) continue;
      const name = map.sources[abs[k].src];
      sizes.set(name, (sizes.get(name) ?? 0) + Math.max(0, end - abs[k].col));
    }
  }
  return sizes;
}

let modules = null;
let modulesNote = null;
if (flag("--modules")) {
  const agg = new Map();
  let withMap = 0;
  for (const f of files) {
    if (!f.file.endsWith(".js")) continue;
    const p = join(dist, f.file);
    if (!existsSync(`${p}.map`)) continue;
    withMap++;
    for (const [src, n] of attribute(p, `${p}.map`)) {
      const key = src.replace(/^(\.\.\/)+/, "").replace(/^\.\//, "");
      agg.set(key, (agg.get(key) ?? 0) + n);
    }
  }
  if (withMap === 0) modulesNote = "dist 沒有 .map（用 `npx vite build --sourcemap` 產出後再加 --modules），略過模組占比";
  else {
    const rows = [...agg].map(([src, chars]) => ({ src, chars })).sort((a, b) => b.chars - a.chars);
    const pick = (re) => rows.filter((r) => re.test(r.src)).reduce((s, r) => s + r.chars, 0);
    const groups = {
      layerManifest: pick(/src\/data\/layerManifest/),
      layerParamsSpec: pick(/layerParamsSpec/),
      layerSourceInfo: pick(/layerSourceInfo/),
      overlayRegistry: pick(/overlayRegistry/),
      layerCatalog: pick(/layerCatalog/),
      "i18n 程式碼（src/i18n，不含翻譯 JSON：JSON 沒有 sourcemap 對照）": pick(/src\/i18n\//),
      "分類檔（*Categor*／*Classif*）": pick(/Categor|Classif/i),
      "統計配方（*StatisticsRecipes*）": pick(/StatisticsRecipes/),
      "node_modules": pick(/node_modules\//),
    };
    modules = { sourcesWithMaps: withMap, groups, top20: rows.slice(0, 20) };
  }
}

const result = { measuredAt: new Date().toISOString(), dist: basename(dist), total, byRole, top10, files, modules };

// ---- 輸出 ----
// 十進位（1MB＝1,000,000 bytes），與 B1-DESIGN 的基準一致
const mb = (n) => (n / 1e6).toFixed(2) + "MB";
const kb = (n) => (n / 1e3).toFixed(0) + "KB";
const pct = (a, b) => (b ? (((a - b) / b) * 100).toFixed(1) : "0.0");

const md = [];
md.push("### 開站 JS／CSS 下載量（entry＋modulepreload＋stylesheet）");
md.push("");
md.push("| 項目 | 檔數 | 原始 | gzip | brotli |");
md.push("|---|---:|---:|---:|---:|");
md.push(`| **合計** | ${total.files} | **${mb(total.raw)}** | **${mb(total.gzip)}** | ${mb(total.brotli)} |`);
for (const [role, r] of Object.entries(byRole)) md.push(`| ${role} | ${r.files} | ${mb(r.raw)} | ${mb(r.gzip)} | ${mb(r.brotli)} |`);
md.push("");
md.push("前 10 大檔（依原始大小）");
md.push("");
md.push("| 檔名 | 角色 | 原始 | gzip | brotli |");
md.push("|---|---|---:|---:|---:|");
for (const f of top10) md.push(`| ${f.file.replace(/^assets\//, "")} | ${f.role} | ${kb(f.raw)} | ${kb(f.gzip)} | ${kb(f.brotli)} |`);

if (modules) {
  md.push("");
  md.push("各來源模組占比（sourcemap 估算輸出字元數，非精確位元組）");
  md.push("");
  md.push("| 來源 | 估算大小 |");
  md.push("|---|---:|");
  for (const [k, v] of Object.entries(modules.groups)) md.push(`| ${k} | ${kb(v)} |`);
}
if (modulesNote) md.push(`\n> ${modulesNote}`);

const baselinePath = opt("--baseline");
if (baselinePath) {
  const base = JSON.parse(readFileSync(baselinePath, "utf8"));
  const bt = base.total;
  md.push("");
  md.push(`與基準比較（基準量測時間 ${base.measuredAt ?? "?"}）`);
  md.push("");
  md.push("| 指標 | 基準 | 現在 | 差異 |");
  md.push("|---|---:|---:|---:|");
  for (const k of ["raw", "gzip", "brotli"]) {
    if (bt[k] == null) continue;
    const d = total[k] - bt[k];
    md.push(`| ${k} | ${mb(bt[k])} | ${mb(total[k])} | ${d >= 0 ? "+" : ""}${kb(d)}（${pct(total[k], bt[k])}%） |`);
  }
  md.push(`| 檔數 | ${bt.files} | ${total.files} | ${total.files - bt.files} |`);
}

const text = md.join("\n");
console.log(text);

const jsonOut = opt("--json");
if (jsonOut) writeFileSync(jsonOut, JSON.stringify(result, null, 2) + "\n");
if (flag("--summary") && process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, text + "\n");

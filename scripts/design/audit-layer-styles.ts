/**
 * 地圖圖層視覺盤點（design system「地圖圖層視覺規格」的資料來源）
 *
 *   npm run design:audit-layers
 *   （= npx vite-node scripts/design/audit-layer-styles.ts）
 *
 * 輸出：docs/design-system/layer-style-inventory.json（排序穩定，重跑可直接 diff）。
 * 說明文件：docs/design-system/map-layers.md。
 *
 * ⚠️ 必須用 vite-node 不能用 tsx —— 相依鏈會碰到 `import.meta.env`（同 dump-layer-golden.ts）。
 * ⚠️ 本腳本只讀程式碼與 runtime 常數，不讀 .env、不連網、不改 src/。不要在這裡印出任何 env。
 *
 * ── 每個 layer key 的 resolution（值從哪來）────────────────────────
 *   runtime          OVERLAY_REGISTRY 有 config：paint/layout 以「暗／淡 × 預設 overlayParams」
 *                    求值（沿用 layerGoldenExtract.extractGolden，與黃金快照同一把尺）。
 *                    ⚠️ 數值已乘上滑桿預設值（例如 circle-opacity 已含透明度預設）。
 *   shared-renderer  統計圖層：src/map/regionalStatisticsMap.ts 一支 renderer 畫全部 recipe，
 *                    數值寫死在該檔（見 STATISTICS_PROFILE），色階取自 statisticsRenderRecipe。
 *   static-scan      自行接線（hook／factory）：從 hook 檔及其 ../map、../three 匯入檔文字掃描
 *                    paint 屬性字面值。**hook 層級**——同一支 hook 服務多個 key 時，值可能屬於
 *                    兄弟 key，不能當成本 key 的確定值（scope: "hook"、siblings 列出）。
 *   unresolved       Three.js scene／CustomLayer／沒有渲染實作：靜態抓不到，只記原因與檔案，不猜值。
 */
import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement, Fragment } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { extractGolden } from "../../src/data/__tests__/layerGoldenExtract";
import { LAYER_MANIFEST, MANIFEST_KEYS } from "../../src/data/layerManifest";
import { LAYER_PARAMS_SPEC, type LayerParamSpec } from "../../src/data/layerParamsSpec";
import { LAYER_HOOK_REGISTRY } from "../../src/layers/layerHookRegistry";
import { STATISTICS_RENDER_KEYS, statisticsRenderRecipe } from "../../src/data/regionalStatisticsRecipes";
import { LEGEND_REGISTRY } from "../../src/components/LegendPanel";
import { legendKeys } from "../../src/data/legendGroups";
import { encodeParamsToOverlay, layerParamsStore } from "../../src/state/layerParamsStore";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const OUT = "docs/design-system/layer-style-inventory.json";
const Z_LO = 10;
const Z_HI = 14;
const OUTLIER_RULE = "值 > 2×中位數 或 < 0.5×中位數（同一屬性、同一 zoom、只計 runtime 的主體子圖層；光暈／漣漪／熱區等裝飾子圖層另計）";

// ══════════════════════════════════════════════════════════════════
//  1. 數值求值器（只處理 zoom；資料驅動 → 取所有數值輸出的範圍）
// ══════════════════════════════════════════════════════════════════

type Num =
  | { kind: "const"; v: number }
  | { kind: "range"; min: number; max: number }
  | { kind: "unresolved"; raw: string };

const U = (raw: unknown): Num => ({ kind: "unresolved", raw: JSON.stringify(raw)?.slice(0, 160) ?? String(raw) });
const isZoom = (e: unknown) => Array.isArray(e) && e[0] === "zoom";
const lo = (n: Num) => (n.kind === "const" ? n.v : n.kind === "range" ? n.min : NaN);
const hi = (n: Num) => (n.kind === "const" ? n.v : n.kind === "range" ? n.max : NaN);

function span(list: Num[]): Num {
  if (list.length === 0) return { kind: "unresolved", raw: "[]" };
  const bad = list.find((n) => n.kind === "unresolved");
  if (bad) return bad;
  const mn = Math.min(...list.map(lo));
  const mx = Math.max(...list.map(hi));
  return mn === mx ? { kind: "const", v: mn } : { kind: "range", min: mn, max: mx };
}

function arith(op: string, a: Num, b: Num): Num {
  if (a.kind === "unresolved") return a;
  if (b.kind === "unresolved") return b;
  const f = (x: number, y: number) =>
    op === "*" ? x * y : op === "+" ? x + y : op === "-" ? x - y : op === "/" ? x / y : op === "max" ? Math.max(x, y) : Math.min(x, y);
  const c = [f(lo(a), lo(b)), f(lo(a), hi(b)), f(hi(a), lo(b)), f(hi(a), hi(b))];
  const mn = Math.min(...c);
  const mx = Math.max(...c);
  return mn === mx ? { kind: "const", v: mn } : { kind: "range", min: mn, max: mx };
}

function interp(type: unknown, z: number, z0: number, z1: number): number {
  if (z1 === z0) return 0;
  const base = Array.isArray(type) && type[0] === "exponential" ? Number(type[1]) : 1;
  const t = (z - z0) / (z1 - z0);
  return base === 1 ? t : (Math.pow(base, z - z0) - 1) / (Math.pow(base, z1 - z0) - 1);
}

function evalNum(e: unknown, z: number): Num {
  if (typeof e === "number") return { kind: "const", v: e };
  if (typeof e === "boolean") return { kind: "const", v: e ? 1 : 0 };
  if (!Array.isArray(e)) return U(e);
  const op = e[0];
  if (op === "literal") return typeof e[1] === "number" ? { kind: "const", v: e[1] } : U(e);
  if (op === "interpolate" || op === "interpolate-hcl" || op === "interpolate-lab") {
    const stops: [number, unknown][] = [];
    for (let i = 3; i + 1 < e.length; i += 2) stops.push([Number(e[i]), e[i + 1]]);
    if (!isZoom(e[2])) return span(stops.map(([, v]) => evalNum(v, z)));
    if (z <= stops[0][0]) return evalNum(stops[0][1], z);
    const last = stops[stops.length - 1];
    if (z >= last[0]) return evalNum(last[1], z);
    for (let i = 0; i + 1 < stops.length; i++) {
      const [za, va] = stops[i];
      const [zb, vb] = stops[i + 1];
      if (z >= za && z <= zb) {
        const a = evalNum(va, z);
        const b = evalNum(vb, z);
        if (a.kind === "unresolved") return a;
        if (b.kind === "unresolved") return b;
        const t = interp(e[1], z, za, zb);
        const mn = lo(a) + (lo(b) - lo(a)) * t;
        const mx = hi(a) + (hi(b) - hi(a)) * t;
        return mn === mx ? { kind: "const", v: mn } : { kind: "range", min: Math.min(mn, mx), max: Math.max(mn, mx) };
      }
    }
    return U(e);
  }
  if (op === "step") {
    const outs: unknown[] = [e[2]];
    const zs: number[] = [];
    for (let i = 3; i + 1 < e.length; i += 2) { zs.push(Number(e[i])); outs.push(e[i + 1]); }
    if (!isZoom(e[1])) return span(outs.map((v) => evalNum(v, z)));
    let idx = 0;
    zs.forEach((zz, i) => { if (z >= zz) idx = i + 1; });
    return evalNum(outs[idx], z);
  }
  if (op === "match") {
    const outs: unknown[] = [];
    for (let i = 3; i < e.length - 1; i += 2) outs.push(e[i]);
    outs.push(e[e.length - 1]);
    return span(outs.map((v) => evalNum(v, z)));
  }
  if (op === "case") {
    const outs: unknown[] = [];
    for (let i = 2; i < e.length - 1; i += 2) outs.push(e[i]);
    outs.push(e[e.length - 1]);
    return span(outs.map((v) => evalNum(v, z)));
  }
  if (op === "coalesce") return span(e.slice(1).map((v) => evalNum(v, z)));
  if (["*", "+", "-", "/", "max", "min"].includes(op) && e.length >= 2) {
    if (op === "-" && e.length === 2) return arith("*", evalNum(e[1], z), { kind: "const", v: -1 });
    let acc = evalNum(e[1], z);
    for (const x of e.slice(2)) acc = arith(op, acc, evalNum(x, z));
    return acc;
  }
  if (op === "to-number" || op === "number") return evalNum(e[1], z);
  if (op === "sqrt") { const a = evalNum(e[1], z); return a.kind === "const" ? { kind: "const", v: Math.sqrt(a.v) } : a.kind === "range" ? { kind: "range", min: Math.sqrt(a.min), max: Math.sqrt(a.max) } : a; }
  return U(e);
}

const fmt = (n: Num): number | string | { min: number; max: number } =>
  n.kind === "const" ? round(n.v) : n.kind === "range" ? { min: round(n.min), max: round(n.max) } : `unresolved:${n.raw}`;
const round = (x: number) => Math.round(x * 1000) / 1000;

// ══════════════════════════════════════════════════════════════════
//  2. 顏色工具
// ══════════════════════════════════════════════════════════════════

const NAMED: Record<string, string> = { white: "#ffffff", black: "#000000", transparent: "transparent" };

function normColor(s: string): string | null {
  const t = s.trim().toLowerCase();
  if (NAMED[t]) return NAMED[t];
  let m = /^#([0-9a-f]{3,8})$/.exec(t);
  if (m) {
    let h = m[1];
    if (h.length === 3 || h.length === 4) h = h.slice(0, 3).split("").map((c) => c + c).join("");
    return `#${h.slice(0, 6)}`;
  }
  m = /^rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)/.exec(t);
  if (m) return `#${[m[1], m[2], m[3]].map((v) => Math.round(Number(v)).toString(16).padStart(2, "0")).join("")}`;
  return null;
}

function collectColors(v: unknown, out: Set<string>): void {
  if (typeof v === "string") { const c = normColor(v); if (c && c !== "transparent") out.add(c); return; }
  if (Array.isArray(v)) v.forEach((x) => collectColors(x, out));
}

/** 顏色表達式的「編碼型別」：constant／categorical（match、case）／sequential（資料 interpolate、step） */
function colorKind(v: unknown): string {
  if (typeof v === "string") return "constant";
  if (!Array.isArray(v)) return "unknown";
  const op = v[0];
  if (op === "match" || op === "case") {
    const s = new Set<string>(); collectColors(v, s);
    return s.size >= 2 ? "categorical" : "constant";
  }
  if ((op === "interpolate" || op === "interpolate-hcl" || op === "interpolate-lab" || op === "step")) {
    const input = op === "step" ? v[1] : v[2];
    return isZoom(input) ? "zoom-only" : (op === "step" ? "sequential-step" : "sequential");
  }
  if (op === "coalesce" || op === "to-color") return "data-driven";
  return "expression";
}

function rgbDist(a: string, b: string): number {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return Math.max(...x.map((v, i) => Math.abs(v - y[i])));
}

// ══════════════════════════════════════════════════════════════════
//  3. 子圖層摘要
// ══════════════════════════════════════════════════════════════════

const ZOOM_PROPS: Record<string, string[]> = {
  circle: ["circle-radius", "circle-stroke-width"],
  line: ["line-width", "line-gap-width", "line-offset", "line-blur"],
  heatmap: ["heatmap-radius"],
  symbol: ["icon-size", "text-size"],
};
const PLAIN_PROPS: Record<string, string[]> = {
  circle: ["circle-opacity", "circle-stroke-opacity", "circle-blur"],
  line: ["line-opacity"],
  fill: ["fill-opacity"],
  "fill-extrusion": ["fill-extrusion-opacity", "fill-extrusion-height", "fill-extrusion-base"],
  heatmap: ["heatmap-opacity", "heatmap-intensity", "heatmap-weight"],
  raster: ["raster-opacity", "raster-saturation", "raster-contrast", "raster-brightness-max", "raster-fade-duration"],
  symbol: ["icon-opacity", "text-opacity", "text-halo-width", "text-halo-blur"],
};
const COLOR_PROPS: Record<string, string[]> = {
  circle: ["circle-color", "circle-stroke-color"],
  line: ["line-color"],
  fill: ["fill-color", "fill-outline-color"],
  "fill-extrusion": ["fill-extrusion-color"],
  heatmap: ["heatmap-color"],
  raster: ["raster-color"],
  symbol: ["icon-color", "text-color", "text-halo-color"],
};

type Paint = Record<string, unknown> | string | null;
interface OverlaySub {
  suffix: string; type: string; minzoom: unknown; maxzoom?: unknown;
  paint: { dark: Paint; light: Paint };
  layout: unknown; filter: unknown;
}
interface OverlayCfg { id: string; sourceId: string; sourceUrl: string | null; pmtiles: unknown; dynamicData: unknown; layers: OverlaySub[] }

function geometryOf(type: string, paint: Record<string, unknown>, layout: Record<string, unknown> | null, key: string, sourceId: string): string {
  const gridish = /grid|h3|mesh|hex|cell|fishnet/i.test(`${key} ${sourceId}`);
  switch (type) {
    case "circle": return "point";
    case "symbol": return layout && ("icon-image" in layout) ? "point" : "label";
    case "line": return "line";
    case "fill": return gridish ? "grid" : "polygon";
    case "fill-extrusion": return "3d";
    case "heatmap": return "heatmap";
    case "raster": return "raster";
    default: return type;
  }
  void paint;
}

function renderOf(type: string, layout: Record<string, unknown> | null): string {
  if (type === "symbol") return layout && "icon-image" in layout ? "icon" : "text";
  return type;
}

function asObj(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

/** 裝飾子圖層（光暈、漣漪、點擊熱區、範圍圈、外框描邊）—— 不代表資料本體，統計分開算 */
const DECOR_RE = /(?:^|[-_])(?:glow\d*|halo|ripple|pulse|hit|range|shadow|casing|highlight|select(?:ed)?|hover|bloom|aura|ring)(?:$|[-_\d])/i;

function summarizeSub(key: string, cfg: OverlayCfg, sub: OverlaySub) {
  const dark = asObj(sub.paint.dark) ?? {};
  const light = asObj(sub.paint.light) ?? {};
  const layoutRaw = asObj(sub.layout);
  const layout = asObj(layoutRaw?.dark) ?? layoutRaw;
  const out: Record<string, unknown> = {
    suffix: sub.suffix, type: sub.type,
    role: DECOR_RE.test(sub.suffix) ? "decoration" : "main",
    geometry: geometryOf(sub.type, dark, layout, key, cfg.sourceId),
    render: renderOf(sub.type, layout),
  };
  if (sub.minzoom != null) out.minzoom = sub.minzoom;
  if (sub.maxzoom != null) out.maxzoom = sub.maxzoom;
  if (typeof sub.paint.dark === "string") out.paintError = sub.paint.dark.slice(0, 120);
  const values: Record<string, unknown> = {};
  for (const p of ZOOM_PROPS[sub.type] ?? []) {
    const src = p in dark ? dark[p] : layout && p in layout ? layout[p] : undefined;
    if (src === undefined) continue;
    values[p] = { [`z${Z_LO}`]: fmt(evalNum(src, Z_LO)), [`z${Z_HI}`]: fmt(evalNum(src, Z_HI)) };
  }
  for (const p of PLAIN_PROPS[sub.type] ?? []) {
    const src = p in dark ? dark[p] : layout && p in layout ? layout[p] : undefined;
    if (src === undefined) continue;
    values[p] = fmt(evalNum(src, Z_HI));
  }
  if (sub.type === "line") {
    if ("line-dasharray" in dark) values["line-dasharray"] = dark["line-dasharray"];
    for (const p of ["line-cap", "line-join"]) if (layout && p in layout) values[p] = layout[p];
  }
  if (sub.type === "fill" && "fill-pattern" in dark) values["fill-pattern"] = dark["fill-pattern"];
  if (sub.type === "symbol" && layout) {
    for (const p of ["text-font", "icon-allow-overlap", "text-allow-overlap", "symbol-placement"]) if (p in layout) values[p] = layout[p];
    if ("icon-image" in layout) values["icon-image"] = typeof layout["icon-image"] === "string" ? layout["icon-image"] : "expression";
  }
  const colors: Record<string, unknown> = {};
  for (const p of COLOR_PROPS[sub.type] ?? []) {
    if (!(p in dark) && !(p in light)) continue;
    const d = new Set<string>(); collectColors(dark[p], d);
    const l = new Set<string>(); collectColors(light[p], l);
    colors[p] = {
      kind: colorKind(dark[p]),
      count: d.size,
      ...(d.size <= 3 ? { dark: [...d] } : {}),
      ...(JSON.stringify(dark[p]) !== JSON.stringify(light[p]) ? { lightDiffers: true, ...(l.size <= 3 ? { light: [...l] } : {}) } : {}),
    };
  }
  const themeDiff = [...new Set([...Object.keys(dark), ...Object.keys(light)])]
    .filter((p) => JSON.stringify(dark[p]) !== JSON.stringify(light[p])).sort();
  out.values = values;
  out.colors = colors;
  if (themeDiff.length) out.themeDiff = themeDiff;
  return out;
}

function paintColorSet(cfgs: OverlayCfg[]): Set<string> {
  const s = new Set<string>();
  for (const c of cfgs) for (const l of c.layers) for (const t of ["dark", "light"] as const) {
    const p = asObj(l.paint[t]);
    if (!p) continue;
    for (const [k, v] of Object.entries(p)) if (k.endsWith("color") || k === "raster-color") collectColors(v, s);
  }
  return s;
}

// ══════════════════════════════════════════════════════════════════
//  4. 靜態掃描（自行接線的 hook／factory）
// ══════════════════════════════════════════════════════════════════

const SRC_FILES: string[] = (() => {
  const out: string[] = [];
  const walk = (d: string) => {
    for (const n of readdirSync(join(ROOT, d))) {
      const rel = `${d}/${n}`;
      if (n === "__tests__" || n.endsWith(".test.ts") || n.endsWith(".test.tsx")) continue;
      if (statSync(join(ROOT, rel)).isDirectory()) walk(rel);
      else if (/\.(ts|tsx)$/.test(n)) out.push(rel);
    }
  };
  walk("src");
  return out.sort();
})();
const TEXT = new Map<string, string>();
const text = (f: string) => { if (!TEXT.has(f)) TEXT.set(f, readFileSync(join(ROOT, f), "utf8")); return TEXT.get(f)!; };

const HOOK_FILE = new Map<string, string>();
for (const f of SRC_FILES) {
  for (const m of text(f).matchAll(/export\s+(?:function|const)\s+(use[A-Za-z0-9_]+)/g)) if (!HOOK_FILE.has(m[1])) HOOK_FILE.set(m[1], f);
}

/** src/map・src/three・src/hooks 匯出的函式 → 檔（用來從呼叫點反查渲染檔） */
const FUNC_FILE = new Map<string, string>();
for (const f of SRC_FILES) {
  if (!/^src\/(map|three|hooks)\//.test(f)) continue;
  for (const m of text(f).matchAll(/export\s+(?:async\s+)?(?:function|const|class)\s+([A-Za-z0-9_]+)/g)) if (!FUNC_FILE.has(m[1])) FUNC_FILE.set(m[1], f);
}
const CALLSITE_FILES = ["src/map/MapView.tsx", "src/App.tsx", ...SRC_FILES.filter((f) => f.startsWith("src/layers/hosts/"))];
/** 在掛載點（MapView／App／Host）找引用本 key 的行，取前後 4 行內、函式名含 key 字根的已匯出渲染函式所在檔 */
function filesFromCallsites(key: string): string[] {
  const out = new Set<string>();
  // 只收「函式名含 key 第一個字根」的呼叫（例：agriculture → updateAgricultureLayer），避免把鄰近別層的呼叫算進來
  const stem = (key.match(/^[a-z0-9]+/)?.[0] ?? key).toLowerCase();
  const ref = new RegExp(`(?:vis|visibility|layerVisibility)\\.${key}\\b|["'\`]${key}["'\`]`);
  for (const f of CALLSITE_FILES) {
    const lines = text(f).split("\n");
    lines.forEach((ln, i) => {
      if (!ref.test(ln)) return;
      for (const w of lines.slice(Math.max(0, i - 4), i + 5)) {
        for (const m of w.matchAll(/\b([A-Za-z_][A-Za-z0-9_]*)\s*\(/g)) {
          const file = FUNC_FILE.get(m[1]);
          if (file && m[1].toLowerCase().includes(stem) && /(Layer|Layers|Scene|Factory|Trails|Tracks|Overlay)/.test(m[1] + file)) out.add(file);
        }
      }
    });
  }
  return [...out];
}

const lineOf = (s: string, idx: number) => s.slice(0, idx).split("\n").length;

/** 從 idx 起擷取一個 JS 值（括號平衡到 depth 0 的 , 或 } 為止） */
function captureValue(s: string, idx: number): string {
  let depth = 0; let q: string | null = null;
  for (let i = idx; i < s.length; i++) {
    const c = s[i];
    if (q) { if (c === "\\") { i++; continue; } if (c === q) q = null; continue; }
    if (c === '"' || c === "'" || c === "`") { q = c; continue; }
    if (c === "[" || c === "(" || c === "{") depth++;
    else if (c === "]" || c === ")" || c === "}") { if (depth === 0) return s.slice(idx, i).trim(); depth--; }
    else if ((c === "," || c === ";" || c === "\n") && depth === 0) return s.slice(idx, i).trim();
  }
  return s.slice(idx).trim();
}

function tryParse(raw: string): unknown {
  const t = raw.replace(/\s+as\s+[A-Za-z_.<>[\]|" ]+$/g, "").replace(/'/g, '"').replace(/,(\s*[\]}])/g, "$1");
  try { return JSON.parse(t); } catch { return undefined; }
}

const PAINT_PROP_RE = /["']((?:circle|line|fill-extrusion|fill|heatmap|raster|icon|text)-[a-z-]+)["']\s*:\s*/g;
const LAYER_TYPE_RE = /type\s*:\s*["'](circle|line|fill|fill-extrusion|heatmap|raster|symbol|custom|background|hillshade)["']/g;

function scanFile(f: string) {
  const s = text(f);
  const props: { prop: string; line: number; value?: unknown; raw?: string }[] = [];
  for (const m of s.matchAll(PAINT_PROP_RE)) {
    const raw = captureValue(s, (m.index ?? 0) + m[0].length);
    const parsed = tryParse(raw);
    props.push({ prop: m[1], line: lineOf(s, m.index ?? 0), ...(parsed !== undefined ? { value: parsed } : { raw: raw.slice(0, 140) }) });
  }
  const types = new Set<string>();
  for (const m of s.matchAll(LAYER_TYPE_RE)) types.add(m[1]);
  const three = /from\s+["']three["']/.test(s) || /\bTHREE\./.test(s);
  const customGl = /CustomLayerInterface|renderingMode\s*:\s*["']3d["']|gl\.(drawArrays|drawElements)/.test(s);
  return { props, types, three, customGl };
}

function localImports(f: string): string[] {
  const s = text(f);
  const dir = dirname(f);
  const out: string[] = [];
  for (const m of s.matchAll(/from\s+["'](\.{1,2}\/[^"']+)["']/g)) {
    const p = relative(ROOT, join(ROOT, dir, m[1])).replace(/\\/g, "/");
    if (!/^src\/(map|three|hooks)\//.test(p)) continue;
    for (const ext of [".ts", ".tsx"]) if (SRC_FILES.includes(p + ext)) out.push(p + ext);
  }
  return out;
}

// ══════════════════════════════════════════════════════════════════
//  5. 主流程
// ══════════════════════════════════════════════════════════════════

const golden = extractGolden();
const overlays = golden.overlays as OverlayCfg[];
const params = golden.params as Record<string, { name?: string; value?: unknown; min?: number; max?: number; type?: string; options?: unknown[] }[]>;
const overlayParams = encodeParamsToOverlay(layerParamsStore.getAll());
const byOverlay = new Map<string, OverlayCfg[]>();
for (const o of overlays) byOverlay.set(o.id, [...(byOverlay.get(o.id) ?? []), o]);

const overlayRegistryText = text("src/map/overlayRegistry.ts");
function overlayLines(id: string): string[] {
  const out: string[] = [];
  const re = new RegExp(`id:\\s*["'\`]${id}["'\`]`, "g");
  for (const m of overlayRegistryText.matchAll(re)) out.push(`src/map/overlayRegistry.ts:${lineOf(overlayRegistryText, m.index ?? 0)}`);
  return out;
}

const hookOfKey = new Map<string, string[]>();
for (const e of LAYER_HOOK_REGISTRY) for (const k of e.keys) hookOfKey.set(k, [...(hookOfKey.get(k) ?? []), e.id.split(":")[0]]);
const keysOfHook = new Map<string, string[]>();
for (const e of LAYER_HOOK_REGISTRY) { const h = e.id.split(":")[0]; keysOfHook.set(h, [...new Set([...(keysOfHook.get(h) ?? []), ...e.keys])]); }

const statsKeys = new Set<string>(STATISTICS_RENDER_KEYS as string[]);
const STATS_FILE = "src/map/regionalStatisticsMap.ts";
const statsText = text(STATS_FILE);
const statsLine = (needle: string) => `${STATS_FILE}:${lineOf(statsText, statsText.indexOf(needle))}`;
const STATISTICS_PROFILE = {
  renderer: STATS_FILE,
  sublayers: [
    { suffix: "fill", type: "fill", geometry: "polygon", values: { "fill-opacity": "= 透明度滑桿（預設 0.55）" }, colors: { "fill-color": { kind: "sequential-step", source: "statisticsRenderRecipe(key).colors／breaks；無數值時透明（F-3 A）" } }, evidence: statsLine("'fill-opacity': 0.55") },
    { suffix: "missing", type: "fill", geometry: "polygon", values: { "fill-pattern": "map-hatch-missing-{dark|light}（8px 單向 45° 細斜線，暗白／淡黑 35%）", "fill-opacity": "= 透明度滑桿" }, evidence: statsLine("hatchImageId('missing'") },
    { suffix: "suppressed", type: "fill", geometry: "polygon", values: { "fill-pattern": "map-hatch-suppressed-{dark|light}（8px 交叉斜線）", "fill-opacity": "= 透明度滑桿" }, evidence: statsLine("hatchImageId('suppressed'") },
    { suffix: "line", type: "line", geometry: "line", values: { "line-width": 1, "line-opacity": "暗 0.6／淡 0.8（固定，不綁滑桿）" }, colors: { "line-color": { kind: "constant", source: "底圖色細縫 MAP_SEAM（暗 #0a0a14／淡 #ffffff）" } }, evidence: statsLine("gradedSeamPaint(isDark)") },
  ],
  themeDiff: "細縫顏色與透明度、斜線顏色隨底圖切換（F-2／F-3）",
};

const OPACITY_TEST = "src/data/__tests__/layerUxPolicy.test.ts（hasOpacityControl／hasPointSizeControl）";
function hasOpacityControl(specs: readonly LayerParamSpec[]): boolean {
  return specs.some((s) => s.kind === "slider" && (s.name.toLowerCase().includes("opacity") || s.labelPrefix.includes("透明度")));
}
function hasPointSizeControl(specs: readonly LayerParamSpec[]): boolean {
  return specs.some((s) => s.kind === "slider" && ["scale", "radius", "size"].some((w) => s.name.toLowerCase().includes(w)));
}

function paramDefaults(key: string) {
  const specs = ((LAYER_PARAMS_SPEC as Record<string, readonly LayerParamSpec[]>)[key] ?? []);
  const sliders = specs.filter((s): s is Extract<LayerParamSpec, { kind: "slider" }> => s.kind === "slider");
  const pick = (pred: (s: (typeof sliders)[number]) => boolean) => sliders.find(pred);
  const op = pick((s) => s.name.toLowerCase().includes("opacity") || s.labelPrefix.includes("透明度"));
  const size = pick((s) => ["scale", "radius", "size"].some((w) => s.name.toLowerCase().includes(w)) || /大小|半徑/.test(s.labelPrefix));
  const width = pick((s) => /width/i.test(s.name) || /線寬|粗細|寬度/.test(s.labelPrefix));
  const z = pick((s) => /height|extru|exaggerat/i.test(s.name) || /高度|倍率|誇張/.test(s.labelPrefix));
  const r = (s?: (typeof sliders)[number]) => (s ? { name: s.name, default: s.default, min: s.min, max: s.max } : undefined);
  return { opacity: r(op), size: r(size), lineWidth: r(width), height: r(z), controls: specs.length };
}

// ── 圖例（SSR 優先，失敗退回原始碼啟發式）──
const legendPanelText = text("src/components/LegendPanel.tsx");
function componentBody(name: string): string {
  const files = ["src/components/LegendPanel.tsx", "src/components/sidebar/StatisticsDetails.tsx"];
  for (const f of files) {
    const s = text(f);
    const m = new RegExp(`\\n(?:export\\s+)?function ${name}\\b`).exec(s);
    if (!m) continue;
    const rest = s.slice(m.index + 1);
    const end = rest.slice(1).search(/\n(?:export\s+)?(?:function|const|interface|type)\s/);
    return end < 0 ? rest : rest.slice(0, end + 1);
  }
  return "";
}
function registryEntryText(id: string): { text: string; line: number } {
  const re = new RegExp(`\\{\\s*id:\\s*["']${id}["']`);
  const m = re.exec(legendPanelText);
  if (!m) return { text: "", line: 0 };
  const t = captureValue(legendPanelText, m.index);
  return { text: t, line: lineOf(legendPanelText, m.index) };
}

interface LegendFeatures { swatchSizes?: string[]; dot: number; square: number; line: number; dashed: number; gradient: number; hatch: number; svg: number; sizeSeries: boolean; fontSizes: number[]; swatchColors: string[] }

function featuresFromHtml(html: string): LegendFeatures {
  const f: LegendFeatures = { dot: 0, square: 0, line: 0, dashed: 0, gradient: 0, hatch: 0, svg: 0, sizeSeries: false, fontSizes: [], swatchColors: [] };
  const colors = new Set<string>();
  const dotSizes = new Set<number>();
  f.svg = (html.match(/<svg/g) ?? []).length;
  for (const m of html.matchAll(/style="([^"]*)"/g)) {
    const st = m[1].replace(/&quot;/g, '"');
    const px = (p: string) => { const r = new RegExp(`(?:^|;)${p}:([\\d.]+)px`).exec(st); return r ? Number(r[1]) : undefined; };
    const fs = px("font-size"); if (fs) f.fontSizes.push(fs);
    const w = px("width"); const h = px("height");
    const bg = /(?:^|;)background(?:-color)?:([^;]+)/.exec(st)?.[1] ?? "";
    if (/repeating-linear-gradient/.test(bg)) { f.hatch++; continue; }
    if (/linear-gradient/.test(bg)) { f.gradient++; for (const c of bg.match(/#[0-9a-fA-F]{3,8}|rgba?\([^)]*\)/g) ?? []) { const n = normColor(c); if (n) colors.add(n); } continue; }
    const borderTop = /(?:^|;)border-(?:top|bottom):([^;]+)/.exec(st)?.[1];
    if (borderTop && w && w >= 10) { f.line++; if (/dashed|dotted/.test(borderTop)) f.dashed++; const c = normColor(borderTop.split(/\s+/).pop() ?? ""); if (c) colors.add(c); continue; }
    const small = w !== undefined && h !== undefined && w <= 30 && h <= 30;
    const br = /(?:^|;)border-radius:([\d.]+)px/.exec(st);
    const round = /border-radius:50%/.test(st) || (br !== null && w !== undefined && h !== undefined && Number(br[1]) >= Math.min(w, h) / 2);
    const col = normColor(bg.trim());
    if (!small || !col || col === "transparent") {
      // 空心圓：border 帶色
      const bd = /(?:^|;)border:([^;]+)/.exec(st)?.[1];
      if (small && bd && round) { f.dot++; const c = normColor(bd.split(/\s+/).pop() ?? ""); if (c) colors.add(c); if (w) dotSizes.add(w); }
      continue;
    }
    colors.add(col);
    (f.swatchSizes ??= []).push(`${w}x${h}${round && !(h! <= 4 && w! >= 10) ? "●" : ""}`);
    if (h! <= 4 && w! >= 10) f.line++;
    else if (round) { f.dot++; dotSizes.add(w!); }
    else f.square++;
    if (/dashed|dotted/.test(st)) f.dashed++;
  }
  for (const m of html.matchAll(/(?:stroke-dasharray)="/g)) { void m; f.dashed++; }
  for (const m of html.matchAll(/(?:fill|stroke)="(#[0-9a-fA-F]{3,8})"/g)) { const n = normColor(m[1]); if (n) colors.add(n); }
  f.sizeSeries = dotSizes.size >= 3;
  f.swatchColors = [...colors].sort();
  f.fontSizes = [...new Set(f.fontSizes)].sort((a, b) => a - b);
  f.swatchSizes = [...new Set(f.swatchSizes ?? [])].sort();
  return f;
}

function featuresFromSource(src: string): LegendFeatures {
  const f: LegendFeatures = { dot: 0, square: 0, line: 0, dashed: 0, gradient: 0, hatch: 0, svg: 0, sizeSeries: false, fontSizes: [], swatchColors: [] };
  f.gradient = (src.match(/(?<!repeating-)linear-gradient|GradientBar|h3RampGradient|H3RampLegend/g) ?? []).length;
  f.hatch = (src.match(/repeating-linear-gradient/g) ?? []).length;
  f.dot = (src.match(/borderRadius:\s*["']50%["']|UrbanDotRow|\bround\b/g) ?? []).length;
  f.line = (src.match(/height:\s*[1-4],|borderTop:/g) ?? []).length;
  f.dashed = (src.match(/dashed|dasharray/g) ?? []).length;
  f.svg = (src.match(/<svg/g) ?? []).length;
  f.square = (src.match(/width:\s*1[0-4],\s*height:\s*(?:[89]|1[0-4])/g) ?? []).length;
  f.sizeSeries = /CAPACITY_RADIUS|radius\s*\*\s*2|size\s*\*\s*2|r\s*\*\s*2/.test(src);
  // legendKit 元件（R1 起）：原始碼只看得到元件名，不是 inline 尺寸
  f.dot += (src.match(/<SwatchDot\b/g) ?? []).length;
  f.square += (src.match(/<SwatchSquare\b|<SwatchSteps\b/g) ?? []).length;
  f.line += (src.match(/<SwatchLine\b/g) ?? []).length;
  f.gradient += (src.match(/<SwatchGradient\b/g) ?? []).length;
  f.hatch += (src.match(/<SwatchHatch\b/g) ?? []).length;
  for (const m of src.matchAll(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g)) { const n = normColor(m[0]); if (n) f.swatchColors.push(n); }
  f.swatchColors = [...new Set(f.swatchColors)].sort();
  return f;
}

function legendType(f: LegendFeatures): string {
  const t: string[] = [];
  if (f.gradient) t.push("gradient");
  if (f.sizeSeries) t.push("size");
  if (f.dot) t.push("dot-swatch");
  if (f.square) t.push("square-swatch");
  if (f.line) t.push(f.dashed ? "line-swatch(dashed)" : "line-swatch");
  if (f.hatch) t.push("hatch(missing)");
  if (f.svg) t.push("svg-icon");
  return t.length ? t.join("+") : "text-only";
}

const legendRecords: Record<string, unknown>[] = [];
const legendByKey = new Map<string, { id: string; type: string }>();
const noopVisibility = Object.fromEntries(MANIFEST_KEYS.map((k) => [k, false]));
for (const entry of LEGEND_REGISTRY) {
  const members = legendKeys(entry.id) as string[];
  const vis = { ...noopVisibility, ...Object.fromEntries(members.map((k) => [k, true])) };
  const reg = registryEntryText(entry.id);
  // 元件名：registry 字面（<Name）∪ render 函式原始碼裡的大寫識別字（map 產生的 entry 沒有字面 id）
  const renderSrc = String(entry.render);
  const comps = [...new Set([
    ...[...reg.text.matchAll(/<([A-Z][A-Za-z0-9]+)/g)].map((m) => m[1]),
    ...[...renderSrc.matchAll(/\b([A-Z][A-Za-z0-9]+Legend[A-Za-z0-9]*)\b/g)].map((m) => m[1]).filter((n) => componentBody(n)),
  ])];
  let html = ""; let htmlLight = ""; let resolution = "ssr"; let err = "";
  try {
    html = renderToStaticMarkup(createElement(Fragment, null, entry.render({ visibility: vis as never, overlayParams, isDark: true, railSystems: undefined } as never)));
    htmlLight = renderToStaticMarkup(createElement(Fragment, null, entry.render({ visibility: vis as never, overlayParams, isDark: false, railSystems: undefined } as never)));
  } catch (e) { resolution = "static"; err = e instanceof Error ? e.message.slice(0, 100) : String(e); }
  let feats: LegendFeatures;
  if (resolution === "ssr" && html.trim()) feats = featuresFromHtml(html);
  else {
    if (resolution === "ssr") { resolution = "static"; err = "SSR 輸出為空（可能依賴 runtime store 資料）"; }
    const src = comps.map((c) => { const b = componentBody(c); const nested = [...b.matchAll(/<([A-Z][A-Za-z0-9]+)/g)].map((m) => componentBody(m[1])).join("\n"); return b + nested; }).join("\n");
    feats = src ? featuresFromSource(src) : featuresFromSource(reg.text);
    if (!src && !reg.text) resolution = "unresolved";
    if (!comps.length) resolution = "unresolved";
  }
  const type = legendType(feats);
  // 與圖層 paint 對照
  const memberCfgs = members.flatMap((k) => byOverlay.get(k) ?? []);
  const allRuntime = members.length > 0 && members.every((k) => byOverlay.has(k));
  const paintSet = paintColorSet(memberCfgs);
  const notInPaint = allRuntime
    ? feats.swatchColors.filter((c) => ![...paintSet].some((p) => rgbDist(p, c) <= 6))
    : [];
  const memberGeoms = new Set<string>();
  const memberColorKinds = new Set<string>();
  for (const c of memberCfgs) for (const l of c.layers) {
    const lay = asObj(asObj(l.layout)?.dark) ?? asObj(l.layout);
    memberGeoms.add(geometryOf(l.type, asObj(l.paint.dark) ?? {}, lay, c.id, c.sourceId));
    const p = asObj(l.paint.dark) ?? {};
    for (const [k, v] of Object.entries(p)) if (k.endsWith("-color") && !k.includes("stroke") && !k.includes("outline") && !k.includes("halo")) memberColorKinds.add(colorKind(v));
  }
  const issues: string[] = [];
  if (allRuntime) {
    if (feats.swatchColors.length && notInPaint.length === feats.swatchColors.length) issues.push("色票全數不在圖層 paint 中");
    else if (notInPaint.length) issues.push(`${notInPaint.length}/${feats.swatchColors.length} 個色票不在圖層 paint 中`);
    const onlyPoly = [...memberGeoms].every((g) => g === "polygon" || g === "grid" || g === "3d");
    const onlyPoint = [...memberGeoms].every((g) => g === "point");
    const onlyLine = [...memberGeoms].every((g) => g === "line");
    if (onlyPoly && feats.dot && !feats.square && !feats.gradient) issues.push("面圖層卻用圓點色票");
    if (onlyPoint && feats.square && !feats.dot && !feats.gradient && !feats.svg) issues.push("點圖層卻用方塊色票");
    if (onlyLine && !feats.line && (feats.dot || feats.square)) issues.push("線圖層卻用點／方塊色票");
    const onlyCategorical = memberColorKinds.size > 0 && [...memberColorKinds].every((k) => k === "categorical" || k === "constant");
    if (feats.gradient && onlyCategorical && !feats.dot && !feats.square) issues.push("類別色圖層卻用漸層圖例");
  }
  // 只看「主色」屬性（不含描邊、外框、halo、透明度）：主色隨底圖換、圖例卻不換 → 色票對不上其中一邊
  const MAIN_COLOR = /^(circle-color|line-color|fill-color|fill-extrusion-color|icon-color|heatmap-color|raster-color)$/;
  // 面圖層的外框線（同 config 有看得見的 fill、suffix 不是中心線 core）顏色是 F-2 外框（中性灰／底圖色細縫），不算主色；
  // 行政界的面是透明點擊面，界線本身就是主體
  const isOutline = (c: (typeof memberCfgs)[number], l: (typeof memberCfgs)[number]["layers"][number]) =>
    l.type === "line" && !/core/.test(l.suffix) && c.layers.some((x) => x.type === "fill" && (asObj(x.paint.dark) ?? {})["fill-opacity"] !== 0);
  const mainColorDiffers = memberCfgs.some((c) => c.layers.some((l) => {
    if (isOutline(c, l)) return false;
    const d = asObj(l.paint.dark) ?? {}; const li = asObj(l.paint.light) ?? {};
    return Object.keys(d).some((p) => MAIN_COLOR.test(p) && JSON.stringify(d[p]) !== JSON.stringify(li[p]));
  }));
  if (htmlLight && html && htmlLight === html && /#[0-9a-f]{6}/i.test(html) && mainColorDiffers) {
    issues.push("圖層主色暗／淡不同，但圖例輸出完全相同");
  }
  const hookOverride = members.filter((k) => byOverlay.has(k) && hookOfKey.has(k));
  if (hookOverride.length && issues.some((i) => i.includes("不在圖層 paint"))) {
    issues.push(`成員 ${hookOverride.join(", ")} 另有 hook（${[...new Set(hookOverride.flatMap((k) => hookOfKey.get(k)!))].join(", ")}）可能在 runtime 覆寫 paint，色票差異需人工確認`);
  }
  const rec: Record<string, unknown> = {
    id: entry.id, members: members.slice().sort(), components: comps, evidence: `src/components/LegendPanel.tsx:${reg.line}`,
    resolution, ...(err ? { resolutionNote: /getServerSnapshot/.test(err) ? "SSR 不支援 useSyncExternalStore（無 getServerSnapshot）→ 原始碼啟發式" : err } : {}), type,
    features: { dot: feats.dot, square: feats.square, line: feats.line, dashed: feats.dashed, gradient: feats.gradient, hatch: feats.hatch, svg: feats.svg, sizeSeries: feats.sizeSeries },
    fontSizes: feats.fontSizes, ...(feats.swatchSizes?.length ? { swatchSizes: feats.swatchSizes } : {}), swatchColorCount: feats.swatchColors.length,
    paintComparable: allRuntime,
    ...(notInPaint.length ? { colorsNotInPaint: notInPaint.slice(0, 12) } : {}),
    ...(issues.length ? { issues } : {}),
  };
  legendRecords.push(rec);
  for (const k of members) legendByKey.set(k, { id: entry.id, type });
}

// ── 每個 key ──
const layers: Record<string, unknown> = {};
const runtimeSubs: { key: string; sub: Record<string, unknown> }[] = [];
for (const key of [...MANIFEST_KEYS].sort()) {
  const m = (LAYER_MANIFEST as Record<string, Record<string, unknown>>)[key];
  const specs = ((LAYER_PARAMS_SPEC as Record<string, readonly LayerParamSpec[]>)[key] ?? []);
  const rec: Record<string, unknown> = {
    label: (m.label as string | undefined) ?? null,
    theme: (m.section as { theme?: string } | null)?.theme ?? null,
    dataClass: m.dataClass,
    color: m.color,
    legend: m.legend ?? null,
    legendType: legendByKey.get(key)?.type ?? null,
    popup: m.popup ?? null,
    params: paramDefaults(key),
  };
  const cfgs = byOverlay.get(key);
  let geoms = new Set<string>(); let renders = new Set<string>();
  let categorical = false;
  if (cfgs) {
    rec.resolution = "runtime";
    rec.evidence = overlayLines(key);
    const subs = cfgs.flatMap((c) => c.layers.map((l) => summarizeSub(key, c, l)));
    subs.forEach((s) => { geoms.add(s.geometry as string); renders.add(s.render as string); runtimeSubs.push({ key, sub: s }); });
    categorical = subs.some((s) => Object.entries(s.colors as Record<string, { kind: string; count: number }>).some(([p, c]) => !/stroke|outline|halo/.test(p) && c.kind === "categorical"));
    rec.sublayers = subs;
  } else if (statsKeys.has(key)) {
    rec.resolution = "shared-renderer";
    rec.evidence = [STATISTICS_PROFILE.sublayers[0].evidence];
    geoms = new Set(["polygon"]); renders = new Set(["fill", "line"]);
    try {
      const r = statisticsRenderRecipe(key as never) as { colors: string[]; breaks: number[]; level?: string };
      rec.statistics = { classes: r.colors.length, breaks: r.breaks.length, diverging: r.breaks.some((b) => b < 0), level: r.level ?? null };
    } catch (e) { rec.statistics = { error: e instanceof Error ? e.message.slice(0, 80) : String(e) }; }
  } else {
    const hooks = hookOfKey.get(key) ?? [];
    const files = new Set<string>();
    for (const h of hooks) { const f = HOOK_FILE.get(h); if (f) { files.add(f); localImports(f).forEach((x) => files.add(x)); } }
    if (!files.size) for (const f of filesFromCallsites(key)) { files.add(f); localImports(f).forEach((x) => files.add(x)); }
    if (!files.size) {
      // factory / App.tsx 掛載：找 src/map 內引用本 key 的檔
      const re = new RegExp(`["'\`]${key}["'\`]|\\.${key}\\b`);
      for (const f of SRC_FILES) if (/^src\/(map|three)\//.test(f) && !/overlayRegistry|gisClickRegistry|MapView|overlayManager/.test(f) && re.test(text(f))) files.add(f);
    }
    const scans = [...files].sort().map((f) => ({ f, ...scanFile(f) }));
    const three = scans.filter((s) => s.three || s.customGl).map((s) => s.f);
    const props = scans.flatMap((s) => s.props.map((p) => ({ ...p, file: s.f })));
    const types = new Set(scans.flatMap((s) => [...s.types]));
    rec.hooks = hooks;
    if (hooks.length) rec.siblings = [...new Set(hooks.flatMap((h) => keysOfHook.get(h) ?? []))].filter((k) => k !== key).sort();
    for (const t of types) {
      if (t === "custom") { renders.add("three/custom"); geoms.add("3d"); continue; }
      renders.add(t === "symbol" ? "symbol" : t);
      geoms.add(t === "circle" ? "point" : t === "line" ? "line" : t === "fill" ? "polygon" : t === "fill-extrusion" ? "3d" : t === "symbol" ? "point/label" : t);
    }
    if (three.length) { renders.add("three/custom"); geoms.add("3d"); }
    if (props.length) {
      rec.resolution = "static-scan";
      rec.scope = "hook";
      const byFile = new Map<string, number[]>();
      for (const p of props) byFile.set(p.file, [...(byFile.get(p.file) ?? []), p.line]);
      rec.evidence = [...byFile].map(([f, ls]) => `${f}:${[...new Set(ls)].slice(0, 8).join(",")}${ls.length > 8 ? ",…" : ""}`);
      const vals: Record<string, unknown[]> = {};
      for (const p of props) {
        const k = p.prop;
        const v = p.value !== undefined
          ? (ZOOM_PROPS.circle.concat(ZOOM_PROPS.line, ZOOM_PROPS.symbol, ZOOM_PROPS.heatmap).includes(k)
              ? { [`z${Z_LO}`]: fmt(evalNum(p.value, Z_LO)), [`z${Z_HI}`]: fmt(evalNum(p.value, Z_HI)) }
              : (k.endsWith("color") ? { kind: colorKind(p.value) } : fmt(evalNum(p.value, Z_HI))))
          : `non-literal @${p.file}:${p.line}`;
        (vals[k] ??= []).push(v);
      }
      rec.staticValues = Object.fromEntries(Object.entries(vals).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, v.slice(0, 6)]));
      if (three.length) rec.threeFiles = three;
    } else {
      rec.resolution = "unresolved";
      const ledger = !hooks.length ? "無 LAYER_HOOK_REGISTRY entry（App.tsx 掛載或 factory／尚無實作，見 src/layers/__tests__/layerHookRegistry.test.ts HOOKS_IN_APP_LEDGER／NO_HOOK_LEDGER）" : "";
      rec.unresolvedReason = three.length
        ? `Three.js／WebGL CustomLayer，數值在 shader／材質（${three.join(", ")}）`
        : files.size
          ? `找不到 paint 字面值（${[...files].join(", ")}）`
          : ledger || "hook 名無對應 export（Host 直接呼叫 factory），且 src/map 無引用本 key 的檔";
      rec.evidence = three.length ? three : [...files];
      if (!files.size) for (const f of filesFromCallsites(key)) { files.add(f); localImports(f).forEach((x) => files.add(x)); }
    if (!files.size) { renders.add("unknown"); }
    }
  }
  rec.geometry = [...geoms].sort();
  rec.render = [...renders].sort();
  // 點大小控件只對 runtime 點層判定（static-scan 的 geometry 是 hook 層級，會混入兄弟 key）
  const pointish = rec.resolution === "runtime" && geoms.has("point");
  rec.ironRules = {
    opacity: hasOpacityControl(specs),
    ...(pointish ? { pointSize: hasPointSizeControl(specs) } : {}),
    legend: m.legend != null,
    ...(categorical && m.legend == null ? { categoricalWithoutLegend: true } : {}),
    popup: m.popup != null,
  };
  layers[key] = rec;
}

// ══════════════════════════════════════════════════════════════════
//  6. 統計
// ══════════════════════════════════════════════════════════════════

function dist(vals: number[]) {
  const v = vals.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return { n: 0 };
  const q = (p: number) => v[Math.min(v.length - 1, Math.floor(p * (v.length - 1) + 0.5))];
  const hist: Record<string, number> = {};
  for (const x of v) hist[String(round(x))] = (hist[String(round(x))] ?? 0) + 1;
  const top = Object.entries(hist).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, n]) => `${k}×${n}`);
  return { n: v.length, min: round(v[0]), p25: round(q(0.25)), median: round(q(0.5)), p75: round(q(0.75)), max: round(v[v.length - 1]), mostCommon: top };
}

interface Metric { id: string; type: string; get: (s: Record<string, unknown>) => unknown }
const vget = (prop: string, z?: string) => (s: Record<string, unknown>) => {
  const v = (s.values as Record<string, unknown>)[prop];
  return z && v && typeof v === "object" && !Array.isArray(v) && `z${Z_LO}` in (v as object) ? (v as Record<string, unknown>)[z] : v;
};
const METRICS: Metric[] = [
  { id: `circle-radius@z${Z_LO}`, type: "circle", get: vget("circle-radius", `z${Z_LO}`) },
  { id: `circle-radius@z${Z_HI}`, type: "circle", get: vget("circle-radius", `z${Z_HI}`) },
  { id: `circle-stroke-width@z${Z_HI}`, type: "circle", get: vget("circle-stroke-width", `z${Z_HI}`) },
  { id: "circle-opacity", type: "circle", get: vget("circle-opacity") },
  { id: `line-width@z${Z_LO}`, type: "line", get: vget("line-width", `z${Z_LO}`) },
  { id: `line-width@z${Z_HI}`, type: "line", get: vget("line-width", `z${Z_HI}`) },
  { id: "line-opacity", type: "line", get: vget("line-opacity") },
  { id: "fill-opacity", type: "fill", get: vget("fill-opacity") },
  { id: "fill-extrusion-opacity", type: "fill-extrusion", get: vget("fill-extrusion-opacity") },
  { id: `heatmap-radius@z${Z_HI}`, type: "heatmap", get: vget("heatmap-radius", `z${Z_HI}`) },
  { id: "raster-opacity", type: "raster", get: vget("raster-opacity") },
  { id: `icon-size@z${Z_HI}`, type: "symbol", get: vget("icon-size", `z${Z_HI}`) },
  { id: `text-size@z${Z_HI}`, type: "symbol", get: vget("text-size", `z${Z_HI}`) },
  { id: "text-halo-width", type: "symbol", get: vget("text-halo-width") },
];

const stats: Record<string, unknown> = {};
const outliers: Record<string, unknown[]> = {};
for (const mt of METRICS) {
  const rows: { key: string; suffix: string; v: number; ranged: boolean }[] = [];
  let unresolved = 0; let missing = 0;
  let decorations = 0;
  for (const { key, sub } of runtimeSubs) {
    if (sub.type !== mt.type) continue;
    if (sub.role === "decoration") { decorations++; continue; }
    const v = mt.get(sub);
    if (v === undefined) { missing++; continue; }
    if (typeof v === "number") rows.push({ key, suffix: sub.suffix as string, v, ranged: false });
    else if (v && typeof v === "object" && "min" in (v as object)) {
      const r = v as { min: number; max: number };
      rows.push({ key, suffix: sub.suffix as string, v: (r.min + r.max) / 2, ranged: true });
    } else unresolved++;
  }
  const d = dist(rows.map((r) => r.v)) as { n: number; median?: number };
  stats[mt.id] = { ...d, dataDrivenCounted: rows.filter((r) => r.ranged).length, notSet: missing, unresolved, decorationExcluded: decorations };
  if (d.median && d.median > 0) {
    outliers[mt.id] = rows.filter((r) => r.v > 2 * d.median! || r.v < 0.5 * d.median!)
      .sort((a, b) => b.v - a.v)
      .map((r) => `${r.key}/${r.suffix}=${round(r.v)}${r.ranged ? "(資料驅動中點)" : ""}`);
  }
}

const decorationSubs = runtimeSubs.filter((r) => r.sub.role === "decoration");
const decorationSummary = {
  count: decorationSubs.length,
  byType: decorationSubs.reduce<Record<string, number>>((a, r) => { a[r.sub.type as string] = (a[r.sub.type as string] ?? 0) + 1; return a; }, {}),
  keys: [...new Set(decorationSubs.map((r) => r.key))].length,
};

// 描邊、虛線、主題切換、顏色編碼
const circleSubs = runtimeSubs.filter((r) => r.sub.type === "circle" && r.sub.role === "main");
const strokeColorPattern: Record<string, number> = {};
for (const { sub } of circleSubs) {
  const c = (sub.colors as Record<string, { dark?: string[]; light?: string[]; lightDiffers?: boolean; count: number }>)["circle-stroke-color"];
  const sw = (sub.values as Record<string, unknown>)["circle-stroke-width"];
  const zero = sw && typeof sw === "object" && (sw as Record<string, unknown>)[`z${Z_HI}`] === 0;
  const key = !c || zero ? "無描邊（未設或寬 0）" : c.lightDiffers ? `隨底圖切換` : c.count === 1 ? `固定 ${c.dark?.[0]}` : "資料驅動";
  strokeColorPattern[key] = (strokeColorPattern[key] ?? 0) + 1;
}
const strokePairs: Record<string, number> = {};
for (const { sub } of circleSubs) {
  const c = (sub.colors as Record<string, { dark?: string[]; light?: string[]; lightDiffers?: boolean }>)["circle-stroke-color"];
  if (c?.lightDiffers && c.dark?.length === 1 && c.light?.length === 1) strokePairs[`暗 ${c.dark[0]} → 淡 ${c.light[0]}`] = (strokePairs[`暗 ${c.dark[0]} → 淡 ${c.light[0]}`] ?? 0) + 1;
}
const strokeSummary = Object.fromEntries(Object.entries(strokeColorPattern).sort((a, b) => b[1] - a[1]).slice(0, 14));
const dashed = runtimeSubs.filter((r) => r.sub.type === "line" && (r.sub.values as Record<string, unknown>)["line-dasharray"] !== undefined)
  .map((r) => `${r.key}/${r.sub.suffix}=${JSON.stringify((r.sub.values as Record<string, unknown>)["line-dasharray"])}`);
const themeDiffCount: Record<string, number> = {};
let subsWithThemeDiff = 0;
for (const { sub } of runtimeSubs) {
  const td = sub.themeDiff as string[] | undefined;
  if (td?.length) subsWithThemeDiff++;
  for (const p of td ?? []) themeDiffCount[p] = (themeDiffCount[p] ?? 0) + 1;
}
const colorKinds: Record<string, number> = {};
for (const { sub } of runtimeSubs) for (const [p, c] of Object.entries(sub.colors as Record<string, { kind: string }>)) {
  if (/stroke|outline|halo/.test(p)) continue;
  colorKinds[`${sub.type}:${c.kind}`] = (colorKinds[`${sub.type}:${c.kind}`] ?? 0) + 1;
}
const textFonts: Record<string, number> = {};
for (const { sub } of runtimeSubs) { const f = (sub.values as Record<string, unknown>)["text-font"]; if (f) textFonts[JSON.stringify(f)] = (textFonts[JSON.stringify(f)] ?? 0) + 1; }
const lineCaps: Record<string, number> = {};
for (const { sub } of runtimeSubs.filter((r) => r.sub.type === "line")) {
  const v = sub.values as Record<string, unknown>;
  const k = `cap=${v["line-cap"] ?? "(預設 butt)"} join=${v["line-join"] ?? "(預設 miter)"}`;
  lineCaps[k] = (lineCaps[k] ?? 0) + 1;
}

const allRecs = Object.entries(layers) as [string, Record<string, unknown>][];
const count = (pred: (r: Record<string, unknown>) => boolean) => allRecs.filter(([, r]) => pred(r)).length;
const byResolution: Record<string, number> = {};
const byGeometry: Record<string, number> = {};
const unresolvedReasons: Record<string, number> = {};
for (const [, r] of allRecs) {
  byResolution[r.resolution as string] = (byResolution[r.resolution as string] ?? 0) + 1;
  for (const g of r.geometry as string[]) byGeometry[g] = (byGeometry[g] ?? 0) + 1;
  if (r.resolution === "unresolved") {
    const reason = String(r.unresolvedReason).startsWith("Three.js") ? "Three.js／WebGL CustomLayer" : String(r.unresolvedReason).startsWith("找不到 paint") ? "有渲染檔但無 paint 字面值" : "無 hook／factory（App 掛載或尚無實作）";
    unresolvedReasons[reason] = (unresolvedReasons[reason] ?? 0) + 1;
  }
}
const legendTypes: Record<string, number> = {};
for (const l of legendRecords) legendTypes[l.type as string] = (legendTypes[l.type as string] ?? 0) + 1;
const ironSummary = {
  missingOpacity: allRecs.filter(([, r]) => !(r.ironRules as { opacity: boolean }).opacity).map(([k]) => k),
  missingPointSize: allRecs.filter(([, r]) => (r.ironRules as { pointSize?: boolean }).pointSize === false).map(([k]) => k),
  noLegend: count((r) => !(r.ironRules as { legend: boolean }).legend),
  categoricalWithoutLegend: allRecs.filter(([, r]) => (r.ironRules as { categoricalWithoutLegend?: boolean }).categoricalWithoutLegend).map(([k]) => k),
  noPopup: count((r) => !(r.ironRules as { popup: boolean }).popup),
};

const output = {
  meta: {
    generatedBy: "scripts/design/audit-layer-styles.ts（npm run design:audit-layers）",
    doc: "docs/design-system/map-layers.md",
    zooms: [Z_LO, Z_HI],
    notes: [
      "runtime 數值以 layerGoldenExtract.extractGolden() 求值（暗／淡 × 預設 overlayParams），已乘上滑桿預設值。",
      "資料驅動的數值（match／case／依屬性 interpolate）記為 {min,max}；統計分佈以中點計入並另計 dataDrivenCounted。",
      "static-scan 為 hook 層級字面值，可能屬於同一 hook 的兄弟 key；不進統計分佈。",
      "unresolved 不猜值，只記原因與檔案。",
      "四鐵則第 4 條（select 選項 ≥4 用原生 select）由 LayerParamControls 自動處理，不逐層記錄。",
      "sublayers[].role：decoration＝光暈／漣漪／點擊熱區／範圍圈等裝飾子圖層（suffix 命中 glow|halo|ripple|pulse|hit|range|…），統計分佈只計 main。",
      `離群規則：${OUTLIER_RULE}`,
      "圖例：SSR（renderToStaticMarkup）優先；依賴 runtime store 而 SSR 失敗或輸出為空者退回原始碼啟發式（resolution: static）。",
    ],
  },
  summary: {
    layerKeys: allRecs.length,
    overlayConfigs: overlays.length,
    runtimeSublayers: runtimeSubs.length,
    byResolution, byGeometry, unresolvedReasons,
    legendEntries: legendRecords.length,
    legendTypes,
    legendResolution: legendRecords.reduce<Record<string, number>>((a, l) => { a[l.resolution as string] = (a[l.resolution as string] ?? 0) + 1; return a; }, {}),
    legendsWithIssues: legendRecords.filter((l) => l.issues).length,
    ironRules: ironSummary,
  },
  stats: {
    distributions: stats,
    outliers,
    circleStroke: strokeSummary,
    circleStrokeThemePairs: Object.fromEntries(Object.entries(strokePairs).sort((a, b) => b[1] - a[1]).slice(0, 10)),
    decorationSublayers: decorationSummary,
    lineDash: dashed,
    lineCapJoin: lineCaps,
    themeDiff: { sublayersWithDiff: subsWithThemeDiff, of: runtimeSubs.length, byProperty: Object.fromEntries(Object.entries(themeDiffCount).sort((a, b) => b[1] - a[1])) },
    colorEncoding: Object.fromEntries(Object.entries(colorKinds).sort((a, b) => b[1] - a[1])),
    textFont: textFonts,
    statisticsProfile: STATISTICS_PROFILE,
    statisticsLayers: [...statsKeys].filter((k) => k in layers).length,
  },
  legends: legendRecords.sort((a, b) => String(a.id).localeCompare(String(b.id))),
  layers,
};

mkdirSync(join(ROOT, dirname(OUT)), { recursive: true });
// 序列化：上層 pretty，legends／layers 每筆一行（檔案小、重跑 diff 以圖層為單位）
const J = (v: unknown) => JSON.stringify(v);
const body = [
  "{",
  ` "meta": ${JSON.stringify(output.meta, null, 1).replace(/\n/g, "\n ")},`,
  ` "summary": ${JSON.stringify(output.summary, null, 1).replace(/\n/g, "\n ")},`,
  ` "stats": ${JSON.stringify(output.stats, null, 1).replace(/\n/g, "\n ")},`,
  ` "legends": [\n${output.legends.map((l) => `  ${J(l)}`).join(",\n")}\n ],`,
  ` "layers": {\n${Object.entries(output.layers).map(([k, v]) => `  ${J(k)}: ${J(v)}`).join(",\n")}\n }`,
  "}",
].join("\n");
writeFileSync(join(ROOT, OUT), `${body}\n`);
console.log(`✅ ${OUT}`);
console.log(JSON.stringify(output.summary, (k, v) => (Array.isArray(v) && v.length > 12 ? `${v.length} items` : v), 1));

/* eslint-disable */
/**
 * P0 試驗（spike）：雙地圖＋CSS 裁切的比較模式原型。**不合併、不接正式 UI。**
 * 啟用：dev server 開 `/?compareSpike=1`（只在 dev 載入，見 main.tsx）。
 * 設計：docs/features/compare-mode/DESIGN.md §1.3；結果：docs/features/compare-mode/P0-SPIKE.md。
 *
 * 做的事：
 * - 等主地圖（window.__map）就緒，在它的容器後面插一個同尺寸容器，建第二張 Mapbox 地圖；
 *   右圖容器用 `clip-path: inset(0 0 0 X%)` 裁成右半，中間把手可拖。
 * - 鏡頭雙向同步（move → jumpTo，防重入旗標）。
 * - 右圖：同一底圖＋一張中研院歷史底圖 raster；可選掛一個統計面量圖（直接呼叫 loader，不經 store，
 *   不寫 localStorage，可選不同期別）。
 * - window.__cmpSpike 提供量測 API（給 agent-browser eval 用），量測結果不含 token。
 *
 * 只讀現有程式，不改共用狀態；關閉時 map.remove() 並移除 DOM。
 */
import mapboxgl from "mapbox-gl";
import { HISTORICAL_MAP_GROUPS, historicalMapTileUrl } from "../data/historicalMapSinica";
import { getStyleUrl } from "../components/StyleSelector";
import { loadRegionalStatistics, type StatisticsRecipe } from "../data/regionalStatisticsLoader";
import { regionalStatisticsStore } from "../state/regionalStatisticsStore";
import { statisticsRenderRecipe, type StatisticsRenderKey } from "../data/regionalStatisticsRecipes";
import { statisticsFillCase } from "../data/statisticsFillColor";
import { Z_INDEX } from "../styles/designTokens";

type Log = { t: number; msg: string };
const logs: Log[] = [];
function log(msg: string) {
  logs.push({ t: Math.round(performance.now()), msg });
  if (logs.length > 500) logs.shift();
  console.info("[compareSpike]", msg);
}

const params = new URLSearchParams(window.location.search);
const HAS_VALUE: unknown[] = ["all", ["==", ["get", "status"], "observed"], ["!=", ["get", "value"], null]];

interface State {
  main: mapboxgl.Map | null;
  right: mapboxgl.Map | null;
  container: HTMLDivElement | null;
  handle: HTMLDivElement | null;
  split: number; // 0..1
  syncing: boolean;
  offMain: (() => void) | null;
  lastCreateMs: { load: number | null; idle: number | null } | null;
  statKey: string | null;
  statRelease: string | null;
  events: string[];
}
const S: State = { main: null, right: null, container: null, handle: null, split: 0.5, syncing: false, offMain: null, lastCreateMs: null, statKey: null, statRelease: null, events: [] };

function heap() {
  const m = (performance as unknown as { memory?: { usedJSHeapSize: number; totalJSHeapSize: number } }).memory;
  return m ? { usedMB: +(m.usedJSHeapSize / 1048576).toFixed(1), totalMB: +(m.totalJSHeapSize / 1048576).toFixed(1) } : null;
}
function gc() {
  const g = (window as unknown as { gc?: () => void }).gc;
  if (g) { g(); return true; }
  return false;
}

function applyClip() {
  if (!S.container || !S.handle) return;
  const pct = (S.split * 100).toFixed(2);
  S.container.style.clipPath = `inset(0 0 0 ${pct}%)`;
  S.handle.style.left = `${pct}%`;
}

function sync(from: mapboxgl.Map, to: mapboxgl.Map) {
  if (S.syncing) return;
  S.syncing = true;
  to.jumpTo({ center: from.getCenter(), zoom: from.getZoom(), bearing: from.getBearing(), pitch: from.getPitch() });
  S.syncing = false;
}

function makeHandle(parent: HTMLElement) {
  const h = document.createElement("div");
  h.setAttribute("role", "slider");
  h.setAttribute("aria-label", "比較把手（spike）");
  h.tabIndex = 0;
  Object.assign(h.style, { position: "absolute", top: "0", bottom: "0", width: "2px", marginLeft: "-1px", background: "rgba(255,255,255,0.85)", zIndex: "2", cursor: "ew-resize", touchAction: "none" } as CSSStyleDeclaration);
  const knob = document.createElement("div");
  Object.assign(knob.style, { position: "absolute", top: "50%", left: "50%", width: "28px", height: "28px", marginLeft: "-14px", marginTop: "-14px", borderRadius: "50%", background: "#fff", boxShadow: "0 1px 4px rgba(0,0,0,.4)" } as CSSStyleDeclaration);
  h.appendChild(knob);
  // 觸控區 44px
  const hit = document.createElement("div");
  Object.assign(hit.style, { position: "absolute", top: "0", bottom: "0", left: "-22px", width: "44px" } as CSSStyleDeclaration);
  h.appendChild(hit);
  let dragging = false;
  h.addEventListener("pointerdown", (e) => { dragging = true; h.setPointerCapture(e.pointerId); e.preventDefault(); });
  h.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const r = parent.getBoundingClientRect();
    S.split = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    applyClip();
  });
  h.addEventListener("pointerup", () => { dragging = false; });
  h.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") S.split = Math.max(0, S.split - 0.05);
    else if (e.key === "ArrowRight") S.split = Math.min(1, S.split + 0.05);
    else return;
    applyClip();
  });
  parent.appendChild(h);
  return h;
}

function addHistorical(map: mapboxgl.Map) {
  const group = HISTORICAL_MAP_GROUPS.find((g) => g.key === "historicalMapSinica")!;
  const want = params.get("cmpEra") ?? group.defaultValue;
  const era = group.eras.find((e) => e.value === want) ?? group.eras[0];
  if (map.getSource("cmp-hist")) return;
  map.addSource("cmp-hist", { type: "raster", tiles: [historicalMapTileUrl(era)], tileSize: 256, ...(era.bounds ? { bounds: era.bounds } : {}), attribution: "中研院人社中心 GIS 專題中心（CC BY-NC）" });
  map.addLayer({ id: "cmp-hist", type: "raster", source: "cmp-hist", paint: { "raster-opacity": 0.85 } });
  log(`historical raster added: ${era.value}`);
}

/** 右圖統計：讀主地圖該層目前的 selection，換 releaseId 後直接呼叫 loader（不經 store、不寫 localStorage）。 */
async function addStatistics(map: mapboxgl.Map, key: string, releaseId: string | null, dims?: Record<string, unknown>) {
  const snap = regionalStatisticsStore.getSnapshot(key);
  if (!snap.selection) { log(`stat ${key}: main map has no selection（主地圖先開該層）`); return { ok: false, reason: "no-selection" }; }
  const releases = snap.releases.map((r) => r.release_id);
  const pick = releaseId ?? releases.find((r) => r !== snap.release?.release_id) ?? null;
  // 期別與細項（Q2 b）：右側換 releaseId，必要時一併換 dimensions（例：人口密度的 roc_year／month）
  const recipe: StatisticsRecipe = { ...snap.selection, ...(pick ? { releaseId: pick, allowReleaseFallback: false } : {}), ...(dims ? { dimensions: { ...snap.selection.dimensions, ...dims } } : {}) };
  const t0 = performance.now();
  const result = await loadRegionalStatistics(recipe);
  const ms = Math.round(performance.now() - t0);
  const render = statisticsRenderRecipe(key as StatisticsRenderKey, recipe.indicatorId, recipe.dimensions, { isDark: true });
  const src = "cmp-stat";
  const data: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: result.features };
  if (map.getSource(src)) (map.getSource(src) as mapboxgl.GeoJSONSource).setData(data);
  else {
    map.addSource(src, { type: "geojson", data, promoteId: "area_code" });
    map.addLayer({ id: "cmp-stat-fill", type: "fill", source: src, paint: { "fill-color": statisticsFillCase(render, HAS_VALUE, "rgba(0,0,0,0)") as mapboxgl.ExpressionSpecification, "fill-opacity": 0.75 } });
    map.addLayer({ id: "cmp-stat-line", type: "line", source: src, paint: { "line-color": "#111", "line-width": 0.5, "line-opacity": 0.5 } });
    map.on("click", "cmp-stat-fill", (e) => {
      const f = e.features?.[0];
      S.events.push(`right-click stat area=${f?.properties?.area_code} value=${f?.properties?.value}`);
    });
    map.on("mousemove", "cmp-stat-fill", () => { map.getCanvas().style.cursor = "pointer"; });
    map.on("mouseleave", "cmp-stat-fill", () => { map.getCanvas().style.cursor = ""; });
  }
  S.statKey = key;
  S.statRelease = result.values.release?.release_id ?? pick;
  const info = { ok: true, key, leftRelease: snap.release?.release_id ?? null, rightRelease: S.statRelease, period: `${result.values.release?.period_start}~${result.values.release?.period_end}`, features: result.features.length, loadMs: ms, releases };
  log(`stat ${JSON.stringify(info)}`);
  return info;
}

function open(): Promise<{ loadMs: number; idleMs: number }> {
  return new Promise((resolve, reject) => {
    const main = (window as unknown as { __map?: mapboxgl.Map }).__map;
    if (!main) { reject(new Error("main map not ready")); return; }
    if (S.right) { reject(new Error("already open")); return; }
    S.main = main;
    const mainEl = main.getContainer();
    const c = document.createElement("div");
    c.className = "cmp-spike-right";
    Object.assign(c.style, { position: "absolute", inset: "0", width: "100%", height: "100%" } as CSSStyleDeclaration);
    mainEl.after(c);
    S.container = c;
    S.handle = makeHandle(mainEl.parentElement!);
    applyClip();
    const style = getStyleUrl(params.get("cmpStyle") ?? params.get("style") ?? "dark");
    const t0 = performance.now();
    const right = new mapboxgl.Map({
      container: c, style, center: main.getCenter(), zoom: main.getZoom(), bearing: main.getBearing(), pitch: main.getPitch(),
      attributionControl: false, antialias: true,
    });
    S.right = right;
    let loadMs = 0;
    right.on("load", () => {
      loadMs = Math.round(performance.now() - t0);
      addHistorical(right);
      log(`right map load ${loadMs}ms`);
    });
    right.once("idle", () => {
      const idleMs = Math.round(performance.now() - t0);
      S.lastCreateMs = { load: loadMs, idle: idleMs };
      log(`right map first idle ${idleMs}ms`);
      resolve({ loadMs, idleMs });
    });
    const onMain = () => sync(main, right);
    const onRight = () => sync(right, main);
    main.on("move", onMain);
    right.on("move", onRight);
    // 左右點擊記錄（驗證被裁區域是否攔截）
    const mainClick = (e: mapboxgl.MapMouseEvent) => S.events.push(`main-click x=${Math.round(e.point.x)}`);
    const rightClick = (e: mapboxgl.MapMouseEvent) => S.events.push(`right-click x=${Math.round(e.point.x)}`);
    main.on("click", mainClick);
    right.on("click", rightClick);
    S.offMain = () => { main.off("move", onMain); main.off("click", mainClick); };
  });
}

function close() {
  S.offMain?.(); S.offMain = null;
  S.right?.remove(); S.right = null;
  S.container?.remove(); S.container = null;
  S.handle?.remove(); S.handle = null;
  S.statKey = null;
  log("closed");
}

/** 量 rAF 幀率：在 durationMs 內執行 step(progress)。 */
function measureFps(durationMs: number, step: (p: number) => void): Promise<{ fps: number; frames: number; p95FrameMs: number; maxFrameMs: number }> {
  return new Promise((resolve) => {
    const deltas: number[] = [];
    const start = performance.now();
    let last = start;
    const tick = (now: number) => {
      deltas.push(now - last); last = now;
      const p = (now - start) / durationMs;
      if (p >= 1) {
        deltas.shift();
        const sorted = [...deltas].sort((a, b) => a - b);
        resolve({ fps: +(deltas.length / ((now - start) / 1000)).toFixed(1), frames: deltas.length, p95FrameMs: +sorted[Math.floor(sorted.length * 0.95)]!.toFixed(1), maxFrameMs: +sorted[sorted.length - 1]!.toFixed(1) });
        return;
      }
      step(p);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

async function dragHandle(durationMs = 3000) {
  return measureFps(durationMs, (p) => { S.split = 0.1 + 0.8 * (0.5 - 0.5 * Math.cos(p * Math.PI * 4)); applyClip(); });
}
async function pan(durationMs = 3000) {
  const main = S.main ?? (window as unknown as { __map?: mapboxgl.Map }).__map!;
  // 前半往右、後半往左，量完回到原處附近
  return measureFps(durationMs, (p) => { const d = p < 0.5 ? 1 : -1; main.panBy([6 * d, 2 * d], { animate: false }); });
}

function resourceCounts() {
  const entries = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
  const strip = (u: string) => { try { const x = new URL(u); return x.host + x.pathname; } catch { return "?"; } };
  const styles = entries.filter((e) => /api\.mapbox\.com\/styles\/v1\//.test(e.name) && !/sprite|fonts/.test(e.name)).map((e) => strip(e.name));
  const events = entries.filter((e) => /events\.mapbox\.com/.test(e.name)).map((e) => strip(e.name));
  const tilesets = entries.filter((e) => /api\.mapbox\.com\/v4\/.*\.json/.test(e.name)).map((e) => strip(e.name));
  return { styleJson: styles.length, eventsPosts: events.length, tilesetJson: tilesets.length, styleList: styles, eventsList: events };
}

async function cycle(n = 10) {
  const out: { i: number; loadMs: number; idleMs: number; heapAfterClose: ReturnType<typeof heap> }[] = [];
  gc();
  const before = heap();
  const canvasesBefore = document.querySelectorAll("canvas").length;
  for (let i = 0; i < n; i++) {
    const r = await open();
    await new Promise((res) => setTimeout(res, 500));
    close();
    await new Promise((res) => setTimeout(res, 300));
    gc();
    out.push({ i, ...r, heapAfterClose: heap() });
  }
  await new Promise((res) => setTimeout(res, 1000));
  const gced = gc();
  return { before, after: heap(), gcExposed: gced, canvasesBefore, canvasesAfter: document.querySelectorAll("canvas").length, runs: out };
}

function hitTest() {
  // 把手左邊（被裁掉的那半）與右邊各取一點，看最上層元素是哪張地圖的 canvas
  const mainEl = (S.main ?? (window as unknown as { __map?: mapboxgl.Map }).__map!).getContainer();
  const r = mainEl.getBoundingClientRect();
  const y = r.top + r.height * 0.5;
  const pts = [0.25, 0.75].map((fx) => {
    const x = r.left + r.width * fx;
    const el = document.elementFromPoint(x, y);
    const side = el?.closest(".cmp-spike-right") ? "right-map" : el?.closest(".pulse-map") ? "main-map" : el?.tagName ?? "none";
    return { fx, side };
  });
  return { split: S.split, pts };
}

const api = {
  open, close, dragHandle, pan, cycle, heap, gc, hitTest, resourceCounts,
  addStatistics: (key: string, releaseId: string | null = null, dims?: Record<string, unknown>) => S.right ? addStatistics(S.right, key, releaseId, dims) : Promise.resolve({ ok: false, reason: "not-open" }),
  setSplit: (v: number) => { S.split = v; applyClip(); },
  events: () => S.events.splice(0),
  logs: () => logs.slice(-50),
  state: () => ({ open: Boolean(S.right), split: S.split, statKey: S.statKey, statRelease: S.statRelease, lastCreateMs: S.lastCreateMs, canvases: document.querySelectorAll("canvas").length, gpu: gpuInfo() }),
};

function gpuInfo() {
  try {
    const gl = document.createElement("canvas").getContext("webgl");
    const ext = gl?.getExtension("WEBGL_debug_renderer_info");
    const v = ext && gl ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : null;
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
    return v;
  } catch { return null; }
}


/** 實機測試用的畫面面板（手機上沒有 devtools）：按鈕跑量測，結果直接顯示在畫面上方便截圖回報。 */
function mountPanel() {
  const box = document.createElement("div");
  Object.assign(box.style, { position: "fixed", left: "8px", right: "8px", top: "env(safe-area-inset-top, 8px)", marginTop: "56px", zIndex: String(Z_INDEX.modal), background: "rgba(0,0,0,0.82)", color: "#fff", font: "12px/1.4 ui-monospace, monospace", padding: "8px", borderRadius: "8px", maxHeight: "40vh", overflow: "auto" } as CSSStyleDeclaration);
  const out = document.createElement("pre");
  Object.assign(out.style, { margin: "6px 0 0", whiteSpace: "pre-wrap" } as CSSStyleDeclaration);
  const print = (label: string, v: unknown) => { out.textContent = `${label}: ${JSON.stringify(v)}\n` + (out.textContent ?? ""); };
  const btn = (label: string, fn: () => Promise<unknown> | unknown) => {
    const b = document.createElement("button");
    b.textContent = label;
    Object.assign(b.style, { margin: "2px", padding: "8px 10px", minHeight: "36px", fontSize: "13px" } as CSSStyleDeclaration);
    b.onclick = async () => { b.disabled = true; try { print(label, await fn()); } catch (e) { print(label, String(e)); } finally { b.disabled = false; } };
    box.appendChild(b);
  };
  btn("開比較", () => open());
  btn("關比較", () => { close(); return "ok"; });
  btn("右側統計 2018", () => api.addStatistics("statsDemographicsTownshipPopulationDensity", "hrp-population-density-township-10712", { roc_year: "107", month: "12" }).then((r) => ({ ok: (r as { ok: boolean }).ok })));
  btn("量平移 FPS", () => pan(3000));
  btn("量拖把手 FPS", () => dragHandle(3000));
  btn("開關 10 次", () => cycle(10).then((r) => ({ heapBefore: r.before, heapAfter: r.after, ms: r.runs.map((x) => x.idleMs) })));
  btn("收合面板", () => { box.style.maxHeight = box.style.maxHeight === "44px" ? "40vh" : "44px"; return "toggle"; });
  box.appendChild(out);
  document.body.appendChild(box);
  print("device", { ua: navigator.userAgent.slice(0, 90), dpr: devicePixelRatio, w: innerWidth, h: innerHeight, gpu: gpuInfo() });
}

export function startCompareSpike() {
  // Resource Timing 預設只留 250 筆，地圖圖磚會擠掉 style／events 請求
  performance.setResourceTimingBufferSize(20000);
  (window as unknown as { __cmpSpike?: typeof api }).__cmpSpike = api;
  log("spike API ready: window.__cmpSpike");
  if (params.get("cmpPanel") === "1") {
    if (document.body) mountPanel(); else window.addEventListener("DOMContentLoaded", mountPanel, { once: true });
  }
  // 自動開啟（cmpAuto=0 可關）
  if (params.get("cmpAuto") !== "0") {
    const wait = () => {
      const main = (window as unknown as { __map?: mapboxgl.Map }).__map;
      if (main && main.loaded()) {
        void open().then(async (r) => {
          log(`auto-open ${JSON.stringify(r)}`);
          const stat = params.get("cmpStat");
          if (stat) {
            // 等主地圖 store 有 releases 清單
            for (let i = 0; i < 40 && !regionalStatisticsStore.getSnapshot(stat).releases.length; i++) await new Promise((res) => setTimeout(res, 500));
            await api.addStatistics(stat, params.get("cmpRelease"));
          }
        });
      } else setTimeout(wait, 500);
    };
    wait();
  }
}

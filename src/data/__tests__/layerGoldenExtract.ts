/**
 * 黃金快照抽取器（AR-22 Phase 0）
 * ══════════════════════════════════════════════════════════════════
 *
 * 把「348 個 layer key 在各張登記簿裡長什麼樣」整包抽成一份 canonical JSON。
 * 用途：Layer Manifest 工程要把登記簿類觸點逐批改成由 manifest 派生，
 * 每一批搬完都必須證明「畫面上的登記資料一位元都沒變」——本檔就是那把尺。
 *
 * ⚠️ **搬移已收官（Phase 2/3），但本檔沒有退役** —— 它現在有三個使用者：
 *   - `layerManifest.test.ts` —— 契約測試的地基（`golden.params` 對帳 manifest 的
 *     `{count, kinds}`、四支 featureType 抽取器餵 popup 對帳）。**這是最重要的一個**：
 *     本檔壞掉 = manifest 契約測試整組失去意義。
 *   - `layerGoldenSnapshot.test.ts` —— 重抽 vs committed fixture 逐位元比對
 *     （Phase 4 起 fixture 只留 3 個 section，見下方 `FIXTURE_SECTIONS`）
 *   - `scripts/preprocess/dump-layer-golden.ts` —— 重新產生 fixture（只在有意識地
 *     接受變更時才跑，跑完務必 review diff）
 *
 * ── 精度聲明（哪些是真值、哪些是原始碼文字解析）────────────────────
 *   全精度（runtime 真值）：LAYER_COLORS / LAYER_ICONS / THEMES / SECTIONS /
 *     LAYER_LABELS / GATED_LAYERS / UPSTREAM_REGISTRY / LEGEND_REGISTRY /
 *     HEADER_LABELS / PANEL_REGISTRY keys / OVERLAY_REGISTRY（含函式欄位求值）/
 *     參數控件（buildParamControls ＋ layerParamsStore 快照，P4 起不再經 React SSR）/
 *     **GIS_LAYERS（Phase 4b 起）** —— 它從 `useMapInteraction` 的區域常數提升成
 *     `map/gisClickRegistry.ts` 的模組級 export，`extractGisLayers` 與
 *     `extractGisConstRefTypes` 兩支文字解析器隨之退役（見下方退役註記）。
 *   原始碼文字解析：**只剩兩支**，且解析的都不是登記簿而是「散在各檔的 setFeatureInfo
 *     呼叫」—— `extractNonGisFeatureTypes`（useMapInteraction 直接 setFeatureInfo 的
 *     3 種）與 `extractCustomHandlerFeatureTypes`（圖層模組自掛 handler 的廢棄物 13 層）。
 *     這兩者沒有登記簿可提升，文字解析是目前唯一的取得方式。
 *
 * ── 非決定性防治 ──────────────────────────────────────────────────
 *   overlayRegistry 的 cultureTodayStr() / tourTodayStr() 會把「今天」烤進 filter
 *   literal → 抽取時正規化成 __TODAY_DASH__ / __TODAY_SLASH__，否則 fixture 每天爆。
 *   layerParamsSpec 的 pollutionPenaltyYear 預設 = clamp(今年, 2010, 2026)，
 *   目前被 PENALTY_YEAR_MAX 夾住而穩定；測試另有一條 guard 斷言防它未來鬆脫。
 */

import { readFileSync } from "node:fs";

import type { LayerVisibility } from "../../types";
import {
  LAYER_COLORS, THEMES, SECTIONS, LAYER_LABELS, GATED_LAYERS,
  WORLD_THEME_TITLE, WORLD_TAB_THEME_TITLES,
} from "../../components/sidebar/layerCatalog";
import { LAYER_ICONS } from "../../components/IconRailSidebar";
import { UPSTREAM_REGISTRY } from "../upstreamRegistry";
import { LEGEND_REGISTRY } from "../../components/LegendPanel";
import { legendKeys } from "../legendGroups";
import { HEADER_LABELS, PANEL_REGISTRY } from "../../components/featureInfo/registry";
import { OVERLAY_REGISTRY } from "../../map/overlayRegistry";
import { GIS_LAYERS } from "../../map/gisClickRegistry";
import { buildParamControls } from "../../state/layerParamsControls";
import { encodeParamsToOverlay, layerParamsStore } from "../../state/layerParamsStore";

export const FIXTURE_PATH = "src/data/__tests__/__fixtures__/layer-golden.json";
const INTERACTION_FILE = "src/hooks/useMapInteraction.ts";

/**
 * 圖層模組自己掛 click handler、**完全不經 useMapInteraction** 的那幾支檔（批 7 廢棄物）。
 * 見 `extractCustomHandlerFeatureTypes` 的說明。
 */
const CUSTOM_HANDLER_FILES = [
  "src/map/wasteMapboxLayers.ts",
  "src/map/wasteFacilityCustomLayer.ts",
  "src/App.tsx",
];

// ── 通用：sanitize + canonical JSON ────────────────────────────────

const TODAY_DASH = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" });
const TODAY_SLASH = TODAY_DASH.replace(/-/g, "/");

function normalizeString(s: string): string {
  if (s === TODAY_DASH) return "__TODAY_DASH__";
  if (s === TODAY_SLASH) return "__TODAY_SLASH__";
  return s;
}

/**
 * 把任意值轉成「可 JSON 化且穩定」的形狀：
 * - function → "__FN__"（正常路徑上不該剩下函式；剩下代表有欄位漏求值）
 * - undefined → null（JSON.stringify 會直接吃掉 undefined，會讓「欄位不存在」
 *   跟「欄位是 undefined」變得無法區分 → 一律顯性化）
 * - NaN / ±Infinity → 顯性 marker（JSON.stringify 會轉成 null，同樣會糊掉資訊）
 * - 物件 key 排序（canonical）；陣列保序
 *
 *（曾被 hook return 等值閘直接引用；該測試已隨 useLayerParamsRuntime 於 AR-22 P4 退役。）
 */
export function sanitize(value: unknown): unknown {
  if (value === undefined) return null;
  if (value === null) return null;
  if (typeof value === "function") return "__FN__";
  if (typeof value === "string") return normalizeString(value);
  if (typeof value === "number") {
    if (Number.isNaN(value)) return "__NaN__";
    if (!Number.isFinite(value)) return value > 0 ? "__Infinity__" : "__-Infinity__";
    // -0 → 0：JSON.stringify(-0) 是 "0"，但 toEqual 走 Object.is 會把 -0 跟 0 判為不同
    // → 不正規化的話「fixture 逐位元相等但 section toEqual 紅」，訊息完全看不懂。
    // （來源：paint 裡 `-someOffset` 算出的 translate 值）
    return Object.is(value, -0) ? 0 : value;
  }
  if (typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.map(sanitize);
  if (value instanceof Set) return [...value].map(sanitize);
  if (value instanceof Map) {
    return Object.fromEntries([...value.entries()].map(([k, v]) => [String(k), sanitize(v)]));
  }
  if (typeof value === "object") {
    const src = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(src).sort()) out[k] = sanitize(src[k]);
    return out;
  }
  // symbol / bigint 等：不該出現，出現就顯性標記
  return `__UNSERIALIZABLE__:${typeof value}`;
}

/** canonical JSON 字串（pretty print + trailing newline，讓 diff 逐行可讀） */
export function canonicalJson(snapshot: unknown): string {
  return `${JSON.stringify(snapshot, null, 2)}\n`;
}

/** 求值包一層 try/catch：單層炸掉不該讓整份 dump 掛掉，但要留下 deterministic marker */
function evalGuard(fn: () => unknown): unknown {
  try {
    return sanitize(fn());
  } catch (e) {
    return `__EVAL_ERROR__:${e instanceof Error ? e.message : String(e)}`;
  }
}

// ── 各 section 抽取 ────────────────────────────────────────────────

export type LayerKey = keyof LayerVisibility;

/** SSOT：348 個 layer key（LAYER_COLORS 是型別強制 Record，等於全集） */
export function allLayerKeys(): LayerKey[] {
  return (Object.keys(LAYER_COLORS) as LayerKey[]).slice().sort();
}

function extractIcons(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of allLayerKeys()) {
    const Icon = LAYER_ICONS[key] as unknown as { displayName?: string; name?: string };
    // lucide 的 displayName 是 canonical 名（alias import 也會指回本名）——穩定即可，
    // 拿不到就顯性標記讓測試 fail loud，不要靜默塞空字串。
    out[key] = Icon?.displayName ?? Icon?.name ?? "__NO_DISPLAY_NAME__";
  }
  return out;
}

/**
 * 控件定義 + overlayParams：對全部 348 key 產生控件
 * （規格查無此 key 回 null → `?? []`，非 Expandable 的 key 安全）。
 * ExpandableLayerKey 是 type-only、runtime 無法迭代 → 全掃是唯一完整做法。
 *
 * ── ⚠️ AR-22 P4 換源（`useLayerParamsRuntime` 已整支退役）──────────
 * 原本這裡用 `react-dom/server` 實跑那支 hook，再讀它的 `getControls` 與
 * `overlayParams`。那兩個欄位本來就只是薄薄一層轉接：
 *
 *   getControls(k)  ===  buildParamControls(k, migratedParams[k]) ?? []
 *   overlayParams   ===  { ...encodeParamsToOverlay(migratedParams) }
 *
 * 而 `migratedParams` 就是 `layerParamsStore.getAll()` 的快照。所以這裡直接
 * 打 store ＋ 兩個 builder，**逐位元等價**，還省掉一次 React SSR。
 * 等價的證明就是 fixture 零 diff —— 換源若做錯，`params` / `overlays`
 * 兩個 section 會立刻紅（不准重 dump fixture）。
 */
function probeTransportParams(): {
  controls: Record<string, unknown>;
  overlayParams: Record<string, number>;
} {
  const all = layerParamsStore.getAll();

  const controls: Record<string, unknown> = {};
  for (const key of allLayerKeys()) {
    const list = evalGuard(() => buildParamControls(key, all[key]) ?? []);
    // 控件的 onChange 是 closure，不進快照（sanitize 會轉 "__FN__"，這裡直接剔除
    // 讓 fixture 乾淨——控件「型別/label/範圍/預設值」才是要凍結的契約）。
    controls[key] = Array.isArray(list)
      ? list.map((c) => stripOnChange(c))
      : list;
  }
  return {
    controls,
    overlayParams: encodeParamsToOverlay(all),
  };
}

function stripOnChange(control: unknown): unknown {
  if (!control || typeof control !== "object") return control;
  const { onChange: _onChange, onSelectAll: _onSelectAll, onSelectNone: _onSelectNone, ...rest } =
    control as Record<string, unknown>;
  return rest;
}

/**
 * OVERLAY_REGISTRY：sourceUrl / sourceId / layers 結構全記；
 * 函式型欄位（paint / layout / filter）用固定輸入求值成 JSON，**不快照函式原始碼**
 * —— isDark ∈ {true,false} × 預設 overlayParams。
 */
function extractOverlays(params: Record<string, number>): unknown[] {
  return OVERLAY_REGISTRY.map((cfg) => ({
    id: cfg.id,
    sourceId: cfg.sourceId,
    sourceUrl: cfg.sourceUrl,
    filter: sanitize(cfg.filter),
    rebuildOnParamChange: sanitize(cfg.rebuildOnParamChange),
    pmtiles: sanitize(cfg.pmtiles),
    dynamicData: sanitize(cfg.dynamicData),
    layers: cfg.layers.map((spec) => ({
      suffix: spec.suffix,
      type: spec.type,
      minzoom: sanitize(spec.minzoom),
      ...(spec.maxzoom != null ? { maxzoom: sanitize(spec.maxzoom) } : {}),
      paint: {
        dark: evalGuard(() => spec.paint(true, params)),
        light: evalGuard(() => spec.paint(false, params)),
      },
      layout: typeof spec.layout === "function"
        ? {
            dark: evalGuard(() => (spec.layout as (d: boolean, p?: Record<string, number>) => unknown)(true, params)),
            light: evalGuard(() => (spec.layout as (d: boolean, p?: Record<string, number>) => unknown)(false, params)),
          }
        : sanitize(spec.layout),
      filter: typeof spec.filter === "function"
        ? evalGuard(() => (spec.filter as (p?: Record<string, number>) => unknown)(params))
        : sanitize(spec.filter),
    })),
  }));
}

// ⚠️ **`extractGisLayers()` 與 `extractGisConstRefTypes()` 已於 AR-22 Phase 4b 退役**
// （不留薄殼）。
//
// 兩支都是 `useMapInteraction.ts` 的原始碼文字解析，存在的唯一理由是「GIS_LAYERS 是
// click handler 內的區域常數，runtime 取不到」。Phase 4b 把它提升成
// `src/map/gisClickRegistry.ts` 的模組級 export，理由消失：
//   - `extractGisLayers`：regex 要求字面 `[...]` → **只吃得到 235 筆**，那兩筆寫成
//     常數引用（`{ layers: DISASTER_ALERT_CLICK_LAYERS, type: "disasterAlert" }`）
//     的完全看不見。fixture 的 `gisLayers` section 因此少凍了兩筆真接線。
//   - `extractGisConstRefTypes`：正是為了補上面那個洞而補的**補丁**（只回 type 字串，
//     展不開 layer id）。洞的成因消失，補丁一併退役。
// 現在的表達：`import { GIS_LAYERS } from "../../map/gisClickRegistry"` —— 237 筆
// 全精度真值，常數引用也展開成實際 layer id 進 fixture。
// 換源後 fixture 的 `gisLayers` 235 → 237（多出的兩筆在其真實位置，見該次 commit 的 diff）。
//
// ⚠️ `mapInteractionLayers.test.ts` 的 layer id ratchet **刻意沒有一起換成 runtime**：
// `DISASTER_ALERT_CLICK_LAYERS` 的 15 個 id 是樣板字串產生的（`${group}-fill`…），
// 該測試的兩條判準（registry 組得出來 / 字串字面出現在別的檔）一條都不中 → 全數誤報成
// orphan。理由寫在該檔，別再「升級」它。

/**
 * **不經 GIS_LAYERS** 的 popup 接線 layerType —— useMapInteraction 裡直接
 * `setFeatureInfo({ layerType: "x", … })` 的那幾處。目前 3 種：
 * `ship` / `waterDam`（Three.js scene 自己 raycast）、`climateField`
 * （風場／海流：向量 feature 全部沒命中時的 fallback，點哪都能讀值，
 * 本來就不對應任何 layer id）。
 *
 * ⚠️ 與 `extractGisConstRefTypes` 同一個理由存在：這些是**真的有點擊接線**的，
 * manifest 的 popup 若只拿 GIS_LAYERS 當真值，`windField` / `oceanCurrents` 只能宣告
 * 成 `popup: null`（已知為假），Phase 3 派生時會靜默丟掉「點地圖讀氣候場」這個功能。
 *
 * 只回 type 字串、不進 fixture（同 extractGisConstRefTypes）。
 * GIS_LAYERS 的條目寫的是 `type:` 不是 `layerType:` → 全檔掃描不會誤收。
 */
export function extractNonGisFeatureTypes(
  source = readFileSync(INTERACTION_FILE, "utf8"),
): string[] {
  const out = [...new Set(
    [...source.matchAll(/layerType:\s*"([^"]+)"/g)].map((m) => m[1] as string),
  )].sort();
  if (out.length === 0) {
    throw new Error(`${INTERACTION_FILE} 找不到 setFeatureInfo 的 layerType 字面 —— 抽取器需同步更新`);
  }
  return out;
}

/**
 * 第四種 popup 真值來源：**圖層模組自己掛 Mapbox click handler / customLayer raycast**
 * 的 layerType —— 這些接線完全不在 `useMapInteraction.ts` 裡，前三支解析器一個都抓不到。
 *
 * 目前 3 支檔（批 7 廢棄物）：
 *   - `wasteMapboxLayers.ts` —— 8 個 circle 子層各自 `map.on("click", coreLayerId, …)`
 *     直接 `onFeatureClick`，layerType 還是**三元運算**（facility / disposal 二選一）
 *   - `wasteFacilityCustomLayer.ts` —— Three.js 6 個 sub-scene 的 `facilityRowToFeatureInfo`
 *   - `App.tsx` —— 上面那支 pick 的**實際呼叫端**（inline `setFeatureInfo`，
 *     是 6 個 3D 設施層真正在跑的那條路徑）
 *
 * ⚠️ 與 `extractGisConstRefTypes`（批 1）/ `extractNonGisFeatureTypes`（批 4）同一個理由存在：
 * 這 13 層（wf* 9 + wd* 4）是**真的有點擊接線**的。不補這支，manifest 只能把它們宣告成
 * `popup: null`（已知為假），Phase 3 依 popup 派生 GIS_LAYERS 時會靜默丟掉全部廢棄物點擊。
 *
 * 只回 type 字串、**不進 fixture**（同前兩支）。兩條 regex 精確錨定 `layerType:` 的值位置，
 * 不做整行掃描 —— 整行掃 `"..."` 會把三元式左邊的 `props["kind"] === "facility"` 一起收進來。
 */
export function extractCustomHandlerFeatureTypes(
  sources: [file: string, source: string][] = CUSTOM_HANDLER_FILES.map(
    (f) => [f, readFileSync(f, "utf8")] as [string, string],
  ),
): string[] {
  const out = new Set<string>();
  for (const [file, source] of sources) {
    // 逐檔各自算「有沒有抓到」——不能用聯集大小有沒有增加來判：三支檔都會產出
    // "wasteFacility"，後面兩支的貢獻本來就可能是 0 個**新增**，那不代表接線消失。
    const perFile = new Set<string>();
    // `layerType: "x"`
    for (const m of source.matchAll(/layerType:\s*"([^"]+)"/g)) perFile.add(m[1] as string);
    // `layerType: cond ? "a" : "b"` —— `[^\n?]*` 把比對範圍夾在該行第一個 `?` 之前，
    // 三元式左邊的字串字面（`props["kind"] === "facility"`）因此不會被收進來。
    for (const m of source.matchAll(/layerType:[^\n?]*\?\s*"([^"]+)"\s*:\s*"([^"]+)"/g)) {
      perFile.add(m[1] as string);
      perFile.add(m[2] as string);
    }
    if (perFile.size === 0) {
      throw new Error(`${file} 解析出 0 個 layerType —— 接線已搬走或改形狀，抽取器需同步更新`);
    }
    for (const t of perFile) out.add(t);
  }
  return [...out].sort();
}

// ⚠️ **`paramsCaseKeys()` 已於 AR-22 Phase 4 退役**（不留薄殼）。
//
// 它做的事是掃 `useLayerParamsRuntime.ts` 的原始碼找 `case "key"` 字面，湊出
// 「哪些 key 宣告了控件」＋「哪些 key `return []` 是有意沒有控件（emptyByDesign）」。
// 兩個判準都寄生在字面上，代價實際發生過：
//   - **正則不剝註解** —— P3-3 在檔頭註解寫出那個字面，憑空生出一個幽靈 key
//     同時混進 `all` 與 `emptyByDesign`，讓覆蓋斷言誤報。
//   - 「有意沒有控件」是**語意事實**，它的家應該在 manifest，不是某支 hook 的
//     switch 長相。
//
// 現在的表達：`LAYER_MANIFEST[key].params === null`（12 個 key，由
// `components/sidebar/__tests__/layerConsistency.test.ts` 的 `NO_PARAMS_LEDGER`
// 雙向凍結）＋ `MIGRATED_PARAMS_KEYS`（336 個，runtime 真值）。
// 覆蓋斷言改在 `layerGoldenSnapshot.test.ts` 直接比這兩個集合，零文字解析。

// ── 主入口 ────────────────────────────────────────────────────────

export interface GoldenSnapshot {
  meta: { keyCount: number; sections: string[] };
  colors: unknown;
  icons: unknown;
  labels: unknown;
  gated: unknown;
  themes: unknown;
  sidebarSections: unknown;
  upstream: unknown;
  legend: unknown;
  featureInfo: unknown;
  gisLayers: unknown;
  overlays: unknown;
  params: unknown;
}

const SECTION_NAMES = [
  "colors", "icons", "labels", "gated", "themes", "sidebarSections",
  "upstream", "legend", "featureInfo", "gisLayers", "overlays", "params",
];

/**
 * **進 committed fixture 的 section**（AR-22 Phase 4 縮編，12 → 3）。
 *
 * 抽取器仍抽全部 12 個 section —— `layerManifest.test.ts` 要拿 `params` 與
 * `gisLayers` 做對帳、突變自測與決定性測試也要看全貌。縮的只有「凍進 repo 的那份」。
 *
 * 判準是**這個 section 有沒有別的永久護欄在守**：
 *
 *   已被 `layerManifest.test.ts` 逐 key 雙向焊死（→ 移出 fixture，留著是重複護欄）：
 *     colors / icons / labels / gated / themes / sidebarSections /
 *     upstream / legend / featureInfo
 *     —— 這 9 個同時也是「每加一層必動」的 section，churn 最高、保護價值卻是 0。
 *
 *   沒有別的護欄、且**由共用機制 fan-out**（→ 留在 fixture）：
 *     - `overlays`：paint / layout / filter 的**求值結果**。`overlayRegistry` 有 6 個
 *       entry factory 產 28+ entry，改 factory 5 行可以靜默改掉 28 層的 dark 分支。
 *       manifest 的 `source` 只驗來源形狀，**完全不碰 paint**。
 *     - `params`：336 個 key 的控件全由 `layerParamsSpec` 的 builder ＋
 *       `buildParamControls` 派生。manifest 只釘 `{ count, kinds }`，
 *       改一個 builder 的 default/min/max 不會動到 count 也不會動到 kinds。
 *     - `gisLayers`：first-hit-wins 的**全域順序**。manifest 的 popup 陣列只釘
 *       「同一個 key 的多個 layerType 相對先後」，跨 key 的排序沒人守。
 */
export const FIXTURE_SECTIONS = ["gisLayers", "overlays", "params"];

/**
 * 取出要凍進 fixture 的那幾個 section。`meta.sections` 一併改寫成實際入檔的清單，
 * 讓 fixture 自我描述（讀檔的人不必回頭查本檔才知道它涵蓋什麼）。
 */
export function pickFixture(snapshot: GoldenSnapshot): Record<string, unknown> {
  const src = snapshot as unknown as Record<string, unknown>;
  return {
    meta: { keyCount: snapshot.meta.keyCount, sections: FIXTURE_SECTIONS },
    ...Object.fromEntries(FIXTURE_SECTIONS.map((s) => [s, src[s]])),
  };
}

export function extractGolden(): GoldenSnapshot {
  const keys = allLayerKeys();
  const { controls, overlayParams } = probeTransportParams();

  return {
    meta: { keyCount: keys.length, sections: SECTION_NAMES },
    colors: sanitize(Object.fromEntries(keys.map((k) => [k, LAYER_COLORS[k]]))),
    icons: sanitize(extractIcons()),
    labels: sanitize(LAYER_LABELS),
    gated: sanitize([...GATED_LAYERS].slice().sort()),
    // THEMES 是巢狀有序結構（主題 → 子群 → layer），順序即 UI 顯示順序 → 保序快照
    themes: sanitize({
      worldThemeTitle: WORLD_THEME_TITLE,
      worldTabThemeTitles: WORLD_TAB_THEME_TITLES,
      themes: THEMES,
    }),
    sidebarSections: sanitize(SECTIONS),
    upstream: sanitize(Object.fromEntries(keys.map((k) => [k, UPSTREAM_REGISTRY[k]]))),
    // 順序 = 圖例面板顯示順序 → 保序；render 是元件函式，只記 id ＋ 派生出的成員名單
    // （Phase 4b 起 keys 由 manifest 的 legend 反查，見 data/legendGroups.ts）
    legend: sanitize(LEGEND_REGISTRY.map((e) => ({ id: e.id, keys: legendKeys(e.id) }))),
    featureInfo: sanitize({
      headerLabels: Object.keys(HEADER_LABELS).sort(),
      panelRegistry: Object.keys(PANEL_REGISTRY).sort(),
    }),
    // Phase 4b 起是 runtime 真值（模組級 export）—— 兩筆常數引用一併展開成實際 layer id
    gisLayers: sanitize(GIS_LAYERS),
    overlays: sanitize(extractOverlays(overlayParams)),
    params: sanitize(controls),
  };
}

// ── 比對（測試與突變自測共用同一把尺）────────────────────────────

export interface SectionDiff {
  section: string;
  reason: string;
}

/**
 * 逐 section 比對兩份快照，回傳有差異的 section 清單。
 * 突變自測走的就是本函式 —— 「護欄的護欄」必須驗證真正在用的那把尺。
 */
export function diffGolden(
  actual: unknown,
  expected: unknown,
  sections: string[] = SECTION_NAMES,
): SectionDiff[] {
  const a = actual as Record<string, unknown>;
  const b = expected as Record<string, unknown>;
  const out: SectionDiff[] = [];
  for (const name of ["meta", ...sections]) {
    const av = JSON.stringify(a?.[name]);
    const bv = JSON.stringify(b?.[name]);
    if (av !== bv) out.push({ section: name, reason: firstDiffHint(av, bv) });
  }
  return out;
}

function firstDiffHint(a: string | undefined, b: string | undefined): string {
  if (a === undefined) return "actual 缺少此 section";
  if (b === undefined) return "expected 缺少此 section";
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  const win = 80;
  return `第 ${i} 字元起分歧：actual=…${a.slice(Math.max(0, i - 20), i + win)}… / expected=…${b.slice(Math.max(0, i - 20), i + win)}…`;
}

export { SECTION_NAMES };

/**
 * URL 深連結狀態（EM 系列 — 可嵌入地圖）
 *
 * 把「相機位置 + 開啟哪些圖層 + 圖層參數 + 凍結日期」序列化進 query string，
 * 讓一條網址就能重現特定畫面 —— 主站用於分享連結，`/embed` 用於文章嵌入。
 *
 * 設計原則（見 docs/proposal/embeddable-map-impl.md §4）：
 * 1. **Diff-based**：只序列化與預設不同的項目。預設幾乎全關，故 `layers=` 就是「要開的清單」。
 * 2. **Human-readable**：寫文章時要手打／手改，不做 base64 壓縮。
 * 3. **版本化**：`v=1`。缺版本或版本不符一律回空物件，避免舊嵌入碼被新解析器誤讀。
 *    新增**可選**欄位（如 `rsys=`）不升版 —— 舊網址少那一欄，解析結果與升版前完全相同；
 *    要升版的是「同一個 key 的語意改了」或「必要欄位變了」。
 * 4. **靜默降級**：未知 key／越界數值／上鎖圖層一律 drop，絕不 throw ——
 *    別人的文章裡出現白屏是最糟的失敗模式，寧可少一層。
 */
import type { LayerVisibility } from "../types";
import { LAYER_COLORS, GATED_LAYERS } from "../components/sidebar/layerCatalog";

export const URL_STATE_VERSION = 1;

export interface UrlCamera {
  center: [number, number];
  zoom: number;
  pitch: number;
  bearing: number;
}

export interface UrlState {
  camera?: UrlCamera;
  /** 要開啟的圖層（已濾除未知 key / gated / 不在白名單者） */
  layers?: (keyof LayerVisibility)[];
  /** overlayParams 覆寫。**僅 `/embed` 消費**，主站忽略（見 impl §1-1） */
  params?: Record<string, number>;
  /** 凍結歷史畫面的日期 YYYY-MM-DD */
  date?: string;
  /** 搭配 date 的小時 0–23（台北時區）。embed 快照是日級，這只影響主站時間軸 */
  hour?: number;
  /**
   * 底圖樣式 id（對應 StyleSelector 的 MAP_STYLES：dark / light / satellite /
   * satellite-streets / nav-night / streets / black）。
   * 這裡只做格式驗證不查表 —— 消費端 `getStyleUrl()` 本身對未知 id 就會 fallback 到預設，
   * 且 urlState 要能被 `/embed` 使用，不該相依於主站的 StyleSelector 元件。
   */
  style?: string;
  theme?: "dark" | "light";
  /** UI 元件白名單（attribution 永遠存在、不可移除） */
  ui?: string[];
  /**
   * 鐵路只顯示哪幾個系統（`rsys=trtc` / `rsys=trtc,tmrt`）。
   * **未指定 = 全部六系統**（不是空集合）—— 全部 id 都不合法時本欄位為 undefined，
   * 消費端因此自動回到「顯示全部」，而不是變成空白畫面。
   *
   * 為什麼不是 `p.railSystems`：`p.*` 的契約只收數字（見 parseParams），
   * 系統 id 是字串塞不進去，故立為一等公民欄位（比照 `h=` / `style=`）。
   */
  railSystems?: string[];
}

export interface ParseOptions {
  /**
   * 額外的圖層白名單（`/embed` 傳入靜態圖層集合）。
   * 未提供時只做「key 存在 + 非 gated」檢查。
   */
  allowedLayers?: ReadonlySet<string>;
}

const ALL_LAYER_KEYS = new Set(Object.keys(LAYER_COLORS));
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * `rsys=` 收得下的鐵路系統 id（tra=台鐵、thsr=高鐵，其餘四座捷運／輕軌）。
 *
 * **刻意在此重列而非 import**：canonical 的組裝端是 `src/embed/railReplayData.ts`
 * （`RAIL_ENGINE_SYSTEMS` + tra），但那是回放 chunk 的東西，urlState 在 embed
 * 基礎 bundle 裡、也給主站用，不該為了一張字串表把它拉進來
 * （同 railReplayData 的 `SYSTEM_COLORS` 對 railLoader 的處理）。改動時兩邊要一起改。
 *
 * 白名單擺在 parse 而非消費端，是因為「未知 id → 顯示全部」這條降級規則必須
 * 在同一處收斂：全部 drop 後 `railSystems` 為 undefined，下游看到的永遠是
 * 「未指定」或「至少一個合法 id」，不會出現空陣列導致的空白畫面。
 */
export const RAIL_SYSTEM_IDS = ["tra", "thsr", "trtc", "krtc", "klrt", "tmrt"] as const;
const RAIL_SYSTEM_ID_SET = new Set<string>(RAIL_SYSTEM_IDS);
/** 底圖 id 格式（不查表，見 UrlState.style 註解） */
const STYLE_ID_RE = /^[a-z0-9-]{1,32}$/;

/** 有限數字才收；NaN / Infinity / 非數字字串一律回 undefined。 */
function finiteNum(raw: string | null): number | undefined {
  if (raw == null || raw.trim() === "") return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

/** 在範圍內才收，否則 undefined（不夾取 —— 越界多半是壞掉的網址，不是想要邊界值）。 */
function inRange(n: number | undefined, min: number, max: number): number | undefined {
  return n != null && n >= min && n <= max ? n : undefined;
}

/** bearing 正規化到 -180~180（0=正北）。 */
function normalizeBearing(n: number | undefined): number | undefined {
  if (n == null) return undefined;
  const m = ((n % 360) + 540) % 360 - 180;
  return Object.is(m, -0) ? 0 : m;
}

function parseCamera(q: URLSearchParams): UrlCamera | undefined {
  const lng = inRange(finiteNum(q.get("lng")), -180, 180);
  const lat = inRange(finiteNum(q.get("lat")), -90, 90);
  const zoom = inRange(finiteNum(q.get("z")), 0, 22);
  // 經緯度與 zoom 三者缺一就沒有可用的相機（半套相機比沒有更糟）
  if (lng == null || lat == null || zoom == null) return undefined;
  return {
    center: [lng, lat],
    zoom,
    pitch: inRange(finiteNum(q.get("pitch")), 0, 85) ?? 0,
    bearing: normalizeBearing(finiteNum(q.get("bearing"))) ?? 0,
  };
}

function parseLayers(q: URLSearchParams, opts: ParseOptions): (keyof LayerVisibility)[] | undefined {
  const raw = q.get("layers");
  if (!raw) return undefined;
  const seen = new Set<string>();
  const out = raw
    .split(",")
    .map((s) => s.trim())
    .filter((k) => {
      if (!k || seen.has(k)) return false;
      if (!ALL_LAYER_KEYS.has(k)) return false;          // 未知 key（含已下架圖層）
      if (GATED_LAYERS.has(k as keyof LayerVisibility)) return false; // owner-only 私人圖層
      if (opts.allowedLayers && !opts.allowedLayers.has(k)) return false;
      seen.add(k);
      return true;
    }) as (keyof LayerVisibility)[];
  return out.length > 0 ? out : undefined;
}

/**
 * `rsys=trtc,tmrt` → `["trtc","tmrt"]`。未知 id 逐一 drop（不整包作廢），
 * 全部 drop 後回 undefined ＝ 視同未指定 ＝ 顯示全部（同 parseLayers 的收尾）。
 * 大小寫敏感（同 `style=` 的格式契約，網址一律小寫）。
 */
function parseRailSystems(q: URLSearchParams): string[] | undefined {
  const raw = q.get("rsys");
  if (!raw) return undefined;
  const seen = new Set<string>();
  const out = raw
    .split(",")
    .map((s) => s.trim())
    .filter((id) => {
      if (!id || seen.has(id) || !RAIL_SYSTEM_ID_SET.has(id)) return false;
      seen.add(id);
      return true;
    });
  return out.length > 0 ? out : undefined;
}

function parseParams(q: URLSearchParams): Record<string, number> | undefined {
  const out: Record<string, number> = {};
  let has = false;
  for (const [key, value] of q.entries()) {
    if (!key.startsWith("p.")) continue;
    const name = key.slice(2);
    if (!name) continue;
    const n = finiteNum(value);
    if (n == null) continue;   // overlayParams 契約：只收數字（boolean 走 0/1、select 走 Idx）
    out[name] = n;
    has = true;
  }
  return has ? out : undefined;
}

/**
 * 解析 query string 成 UrlState。任何欄位壞掉都只 drop 該欄位，不 throw。
 *
 * @param search `window.location.search`（可含或不含前導 `?`）
 */
export function parseUrlState(search: string, opts: ParseOptions = {}): UrlState {
  let q: URLSearchParams;
  try {
    q = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  } catch {
    return {};
  }

  // 版本閘門：缺版本或版本不符 → 整組不採用（未來改 schema 時舊網址不會被誤讀）
  if (finiteNum(q.get("v")) !== URL_STATE_VERSION) return {};

  const state: UrlState = {};
  const camera = parseCamera(q);
  if (camera) state.camera = camera;

  const layers = parseLayers(q, opts);
  if (layers) state.layers = layers;

  const params = parseParams(q);
  if (params) state.params = params;

  const date = q.get("date");
  if (date && DATE_RE.test(date) && !Number.isNaN(Date.parse(date))) state.date = date;

  const hour = inRange(finiteNum(q.get("h")), 0, 23);
  if (hour != null) state.hour = Math.floor(hour);

  const style = q.get("style");
  if (style && STYLE_ID_RE.test(style)) state.style = style;

  const theme = q.get("theme");
  if (theme === "dark" || theme === "light") state.theme = theme;

  const railSystems = parseRailSystems(q);
  if (railSystems) state.railSystems = railSystems;

  const ui = q.get("ui");
  if (ui) {
    const items = ui.split(",").map((s) => s.trim()).filter(Boolean);
    if (items.length > 0) state.ui = items;
  }

  return state;
}

/** 相機數值的輸出精度：經緯度 4 位（~11m）、zoom/pitch/bearing 各 1~2 位，避免網址被浮點雜訊撐長。 */
function round(n: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

/**
 * 由 UrlState 組回網址（分享／嵌入按鈕用）。
 * 只寫出有值的欄位 —— 空的 state 產出的就是乾淨的 `?v=1`。
 */
export function buildUrl(state: UrlState, base: string): string {
  const q = new URLSearchParams();
  q.set("v", String(URL_STATE_VERSION));

  if (state.camera) {
    const { center, zoom, pitch, bearing } = state.camera;
    q.set("lng", String(round(center[0], 4)));
    q.set("lat", String(round(center[1], 4)));
    q.set("z", String(round(zoom, 2)));
    if (pitch) q.set("pitch", String(round(pitch, 1)));
    if (bearing) q.set("bearing", String(round(bearing, 1)));
  }
  if (state.layers?.length) q.set("layers", state.layers.join(","));
  if (state.params) {
    for (const [k, v] of Object.entries(state.params)) {
      if (Number.isFinite(v)) q.set(`p.${k}`, String(round(v, 4)));
    }
  }
  if (state.date) q.set("date", state.date);
  // 0 時是有效值但等同預設，省略以保持網址精簡
  if (state.hour) q.set("h", String(Math.floor(state.hour)));
  if (state.railSystems?.length) q.set("rsys", state.railSystems.join(","));
  if (state.style) q.set("style", state.style);
  if (state.theme) q.set("theme", state.theme);
  if (state.ui?.length) q.set("ui", state.ui.join(","));

  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}${q.toString()}`;
}

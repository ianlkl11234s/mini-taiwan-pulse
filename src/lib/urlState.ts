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
  theme?: "dark" | "light";
  /** UI 元件白名單（attribution 永遠存在、不可移除） */
  ui?: string[];
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

  const theme = q.get("theme");
  if (theme === "dark" || theme === "light") state.theme = theme;

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
  if (state.theme) q.set("theme", state.theme);
  if (state.ui?.length) q.set("ui", state.ui.join(","));

  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}${q.toString()}`;
}

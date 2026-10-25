/**
 * 靜態圖層資產索引（ADR-0024 §4；設計正本 .gis-agent-system/projects/2026-10-static-asset-versioning/DESIGN.md §3.5）。
 *
 * 讀取端契約（與 pulse-data 發布端一字不差）：
 *   `<base>current.json` → `{ schema_version, manifest: { path, sha256, bytes }, published_at, previous_manifest }`
 *   `<base><manifest.path>` → `{ schema_version, generated_at, entries: { "<舊相對 URL>": LayerAssetEntry } }`
 *   資產絕對 URL = `<base>` + entry.path
 *
 * 啟動時（main.tsx）載入一次；`resolveAssetUrl()` 是同步查表，所以 PMTiles 的 addSource 可以維持同步。
 * 索引以舊相對 URL 為 key 逐層 opt-in，layerManifest 不用改。
 *
 * ⚠️ `/embed` 不在試點內：embed 是獨立 entry（embed.html），不會呼叫 `loadLayerAssetIndex()`，
 * 遷移清單內的 key 一律走 fallback＝同源部署時版本，與遷移前行為完全相同。
 */
import { withLoading } from "../lib/loadingRegistry";
import { cachedOnce } from "../lib/loaderCache";
import expectedJson from "./layerAssetIndex.expected.json";

export const LAYER_ASSET_SCHEMA = "pulse-layer-assets-v1";
export const DEFAULT_LAYER_ASSET_BASE = "https://data.itsmigu.com/layers/v1/";
export const LAYER_ASSET_FETCH_TIMEOUT_MS = 8_000;
/** GeoJSON 在這個大小以內才於前端驗 bytes 與 sha256（DESIGN §3.5）。 */
export const GEOJSON_VERIFY_MAX_BYTES = 5 * 1024 * 1024;
export const LAYER_ASSET_INDEX_TASK_ID = "layer-asset-index";
export const LAYER_ASSET_INDEX_LABEL = "圖層資料索引";

export interface LayerAssetEntry {
  asset_id: string;
  kind: "geojson" | "pmtiles";
  /** 相對 `<base>`，例：`assets/<asset_id>/<sha>.geojson` */
  path: string;
  sha256: string;
  bytes: number;
  rows?: number | null;
  content_type?: string;
  version?: string;
  note?: string | null;
  published_at?: string;
  registry_id?: string | null;
  package_sha256?: string | null;
  row_key?: string[] | null;
  previous?: { sha256: string; path: string } | null;
  pmtiles?: { source_layer?: string; minzoom?: number; maxzoom?: number } | null;
}

export interface LayerAssetIndex {
  schema_version: typeof LAYER_ASSET_SCHEMA;
  generated_at: string;
  entries: Record<string, LayerAssetEntry>;
}

interface LayerAssetPointer {
  schema_version: string;
  manifest: { path: string; sha256: string; bytes: number };
  published_at?: string;
  previous_manifest?: unknown;
}

export type ResolvedAsset =
  | { url: string; source: "cdn"; entry: LayerAssetEntry }
  | { url: string; source: "fallback"; reason: string }
  | { url: string; source: "legacy" };

/** 已遷移（應由索引供應）的舊相對 URL。只列 key，不含版本。 */
export const MIGRATED_ASSET_KEYS: ReadonlySet<string> = new Set(expectedJson.keys);

export function layerAssetBase(): string {
  const configured = import.meta.env.VITE_LAYER_ASSET_BASE?.trim();
  const base = configured || DEFAULT_LAYER_ASSET_BASE;
  return base.endsWith("/") ? base : `${base}/`;
}

/** `<base>` + 相對 path；拒絕離開 base 的路徑（絕對路徑、`..`、換 origin）。 */
export function layerAssetUrl(base: string, path: string): string {
  if (!path || path.startsWith("/") || path.includes("\\")) throw new Error("圖層資料索引 path 不合法");
  const root = new URL(base);
  const resolved = new URL(path, root);
  if (resolved.origin !== root.origin || !resolved.pathname.startsWith(root.pathname) || resolved.username || resolved.password) {
    throw new Error("圖層資料索引 path 不可離開版本根目錄");
  }
  return resolved.href;
}

export async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
    .map((value) => value.toString(16).padStart(2, "0")).join("");
}

const SHA256_RE = /^[0-9a-f]{64}$/;

async function fetchBytes(url: string, noCache: boolean): Promise<ArrayBuffer> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LAYER_ASSET_FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...(noCache ? { cache: "no-cache" as const } : {}), signal: controller.signal });
    if (!response.ok) throw new Error(`圖層資料索引回應 ${response.status}`);
    return await response.arrayBuffer();
  } catch (error) {
    if (controller.signal.aborted) throw new Error("圖層資料索引載入逾時");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function parseJson(bytes: ArrayBuffer): unknown {
  try { return JSON.parse(new TextDecoder().decode(bytes)); }
  catch { throw new Error("圖層資料索引 JSON 格式不符"); }
}

function isEntry(value: unknown): value is LayerAssetEntry {
  const e = value as LayerAssetEntry | null;
  return !!e && typeof e === "object"
    && (e.kind === "geojson" || e.kind === "pmtiles")
    && typeof e.path === "string" && typeof e.sha256 === "string" && SHA256_RE.test(e.sha256)
    && Number.isInteger(e.bytes) && e.bytes > 0;
}

/** 抓指標 → 抓索引 → 驗索引 bytes／sha256 與 schema。不經快取，給 loader 與測試用。 */
export async function fetchLayerAssetIndex(base: string = layerAssetBase()): Promise<LayerAssetIndex> {
  const pointer = parseJson(await fetchBytes(`${base}current.json`, true)) as LayerAssetPointer;
  if (pointer?.schema_version !== LAYER_ASSET_SCHEMA || !pointer.manifest || typeof pointer.manifest.path !== "string") {
    throw new Error("圖層資料索引指標 schema_version 不符");
  }
  const { path, sha256, bytes: expectedBytes } = pointer.manifest;
  if (typeof sha256 !== "string" || !SHA256_RE.test(sha256)) throw new Error("圖層資料索引指標 sha256 不合法");
  const bytes = await fetchBytes(layerAssetUrl(base, path), false);
  if (Number.isInteger(expectedBytes) && expectedBytes > 0 && bytes.byteLength !== expectedBytes) {
    throw new Error("圖層資料索引大小不符");
  }
  if (await sha256Hex(bytes) !== sha256) throw new Error("圖層資料索引 SHA-256 不符");
  const index = parseJson(bytes) as LayerAssetIndex;
  if (index?.schema_version !== LAYER_ASSET_SCHEMA || !index.entries || typeof index.entries !== "object") {
    throw new Error("圖層資料索引 schema_version 不符");
  }
  for (const [key, entry] of Object.entries(index.entries)) {
    if (!isEntry(entry)) throw new Error(`圖層資料索引條目不合法：${key}`);
    layerAssetUrl(base, entry.path); // 越界 path 整份拒收
  }
  return index;
}

type IndexState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; base: string; index: LayerAssetIndex }
  | { status: "failed"; error: string };

let state: IndexState = { status: "idle" };
const readyListeners = new Set<() => void>();

/**
 * 索引載入成功時通知（PMTiles 用來把開站時以 fallback 建立的 source 換成 CDN）。
 * 已 ready 時於下一個 microtask 呼叫。回傳取消函式；載入失敗則永遠不會呼叫。
 */
export function onLayerAssetIndexReady(cb: () => void): () => void {
  let active = true;
  const fire = () => { if (active) cb(); };
  if (state.status === "ready") {
    queueMicrotask(fire);
  } else {
    readyListeners.add(fire);
  }
  return () => {
    active = false;
    readyListeners.delete(fire);
  };
}

const loadOnce = cachedOnce<LayerAssetIndex>(() => {
  const base = layerAssetBase();
  state = { status: "loading" };
  const p = withLoading(LAYER_ASSET_INDEX_TASK_ID, LAYER_ASSET_INDEX_LABEL, fetchLayerAssetIndex(base));
  return p.then(
    (index) => {
      state = { status: "ready", base, index };
      const listeners = [...readyListeners];
      readyListeners.clear();
      for (const l of listeners) {
        try { l(); } catch (error) { console.warn("[layer-asset-index] ready listener 失敗：", error); }
      }
      return index;
    },
    (error: unknown) => {
      state = { status: "failed", error: error instanceof Error ? error.message : String(error) };
      console.warn("[layer-asset-index] 載入失敗，遷移清單內的圖層改用部署時版本：", error);
      throw error;
    },
  );
}, Number.POSITIVE_INFINITY);

/**
 * 啟動時呼叫一次（失敗也 resolve，不讓開站流程 reject）。失敗以 loadingRegistry「fail」結束，
 * 右上載入狀態條會顯示「載入失敗 · 圖層資料索引」。
 */
export async function loadLayerAssetIndex(): Promise<void> {
  try { await loadOnce(); } catch { /* 狀態已記在 state，resolver 走 fallback */ }
}

/** 測試用：清掉索引狀態與快取。 */
export function resetLayerAssetIndex(): void {
  loadOnce.invalidate();
  readyListeners.clear();
  state = { status: "idle" };
}

export function resolveAssetUrl(url: string): ResolvedAsset {
  if (state.status === "ready") {
    const entry = state.index.entries[url];
    if (entry) return { url: layerAssetUrl(state.base, entry.path), source: "cdn", entry };
  }
  if (!MIGRATED_ASSET_KEYS.has(url)) return { url, source: "legacy" };
  const reason = state.status === "ready" ? "索引缺少此條目"
    : state.status === "failed" ? `索引載入失敗：${state.error}`
    : "索引尚未載入";
  return { url, source: "fallback", reason };
}

/** 既有呼叫點的薄包裝：只要 URL 字串。 */
export function resolveAssetUrlString(url: string): string {
  return resolveAssetUrl(url).url;
}

/**
 * 依 resolver 結果下載 GeoJSON；走 CDN 且 ≤ 5 MB 時驗 bytes 與 sha256。
 * 失敗一律 throw，由呼叫端以 loadingRegistry 失敗結束。
 */
export async function fetchResolvedGeojson(resolved: ResolvedAsset): Promise<GeoJSON.FeatureCollection> {
  const res = await fetch(resolved.url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  if (resolved.source !== "cdn" || resolved.entry.bytes > GEOJSON_VERIFY_MAX_BYTES) {
    return (await res.json()) as GeoJSON.FeatureCollection;
  }
  const bytes = await res.arrayBuffer();
  if (bytes.byteLength !== resolved.entry.bytes) throw new Error("圖層資料大小與索引不符");
  if (await sha256Hex(bytes) !== resolved.entry.sha256) throw new Error("圖層資料 SHA-256 與索引不符");
  return JSON.parse(new TextDecoder().decode(bytes)) as GeoJSON.FeatureCollection;
}

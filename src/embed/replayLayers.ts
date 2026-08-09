/**
 * 嵌入用「回放圖層」的中繼資料（EM-16 / Phase C）
 *
 * 與 `snapshotLayers.ts`（EM-15）的差別：
 * - snapshot 層 = 一天的**靜態幾何**，MapLibre 原生 fill/line 畫得出來
 * - replay 層  = 一天的**軌跡動畫**，需要 Three.js CustomLayer + 回放時鐘
 *
 * ⚠️ 本檔**刻意保持零 three / 零 Scene 相依**：`embedWhitelist` 要 import 它來派生
 * 白名單，而白名單在 embed 基礎 bundle 裡。真正的渲染程式碼全部在
 * `replayRuntime.ts`，只有網址真的帶了回放圖層時才 `import()` 進來
 * （否則純靜態嵌入會白白多背 ~100KB gzip 的 three）。
 *
 * 資料契約：`public/embed-snapshots/<layer>/<YYYY-MM-DD>.json.gz`
 * body = **匯出鏡像列**的陣列（形狀同對應 RPC 回傳），由
 * `scripts/export/export-embed-snapshot.sh <layer> <date>` 產出，
 * 與 `data-collectors/scripts/export_daily_trails.py` 的 `write_gzip_json` 同形。
 *
 * 鐵則（見 docs/proposal/embed-dynamic-layers.md §9 D-4）：
 * **絕不打 Supabase**；快照缺失（404 / 壞檔）→ 靜默略過該層，不白屏、不 fallback。
 */
import type { LayerVisibility } from "../types";

export interface ReplayLayerSpec {
  /** MapLibre custom layer id */
  layerId: string;
  /** 快照檔所在的目錄名（= 匯出腳本的 <layer> 參數） */
  snapshotDir: string;
  /** 人讀標籤（UI 用） */
  label: string;
}

/** 支援回放的圖層。key 必須存在於 LAYER_COLORS（urlState 會驗）且非 gated。 */
export const REPLAY_LAYERS: Readonly<Partial<Record<keyof LayerVisibility, ReplayLayerSpec>>> = {
  flights: {
    layerId: "embed-flights-replay",
    snapshotDir: "flights",
    label: "航班 Flight",
  },
  ships: {
    layerId: "embed-ships-replay",
    snapshotDir: "ships",
    label: "船舶 Ship",
  },
  rail: {
    layerId: "embed-rail-replay",
    snapshotDir: "rail",
    label: "鐵路 Rail",
  },
};

export const REPLAY_KEYS = Object.keys(REPLAY_LAYERS) as (keyof LayerVisibility)[];

export function isReplayLayer(key: string): boolean {
  return key in REPLAY_LAYERS;
}

/** 回放快照檔路徑。date 須為 YYYY-MM-DD（urlState 已驗格式）。 */
export function replaySnapshotUrl(layer: string, date: string): string {
  return `/embed-snapshots/${layer}/${date}.json.gz`;
}

/**
 * 讀 `.json.gz`，回傳解析後的 JSON；任何失敗一律 null（呼叫端靜默略過該層）。
 *
 * gzip 有兩種到達方式，都必須吃得下：
 * - **dev / 直接靜態服務**：`.json.gz` 是普通檔案，`Content-Type: application/gzip`，
 *   瀏覽器不會自動解壓 → 要自己用 `DecompressionStream("gzip")`
 * - **CDN / nginx 設了 `Content-Encoding: gzip`**：fetch 已經自動解壓 → 拿到的就是純 JSON
 * 所以用 magic byte（0x1f 0x8b）判斷，而不是相信 header。
 *
 * 不限於 `embed-snapshots/` —— rail 的幾何 bundle（`/embed-rail/rail_slim.<hash>.json.gz`，
 * 日期無關的共用資產）與它的指標檔 `rail-manifest.json`（未壓縮的純 JSON，走 else 分支）
 * 也走這裡，故回傳型別不假設是陣列。
 */
export async function fetchMaybeGzipJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const bytes = new Uint8Array(buf);

    let text: string;
    if (bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b) {
      if (typeof DecompressionStream === "undefined") return null; // 太舊的瀏覽器 → 略過該層
      const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
      text = await new Response(stream).text();
    } else {
      text = new TextDecoder().decode(bytes);
    }

    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

/** 讀單日 gzip 快照。body 必須是 row 陣列，否則視同失敗。 */
export async function fetchReplaySnapshot<T>(layer: string, date: string): Promise<T[] | null> {
  const json = await fetchMaybeGzipJson<unknown>(replaySnapshotUrl(layer, date));
  if (!Array.isArray(json)) return null;
  return json as T[];
}

/**
 * 嵌入用歷史快照圖層（EM-15 / Phase B）
 *
 * 這些圖層在主站是「專屬 hook + 原生 addLayer」畫的（不在 `overlayRegistry`），
 * 所以 embed 沒辦法靠 `overlayManager` 共用 —— 需要在此重述一份**單日靜態版**的
 * source + layer 規格。
 *
 * 與主站版本的差異（刻意）：
 * - 只呈現**一天**：不做多日疊加、不做累積回放、不做 ageFade（那些是主站的互動功能）
 * - 資料來自 `/embed-snapshots/<layer>/<date>.geojson`（`scripts/export/export-embed-snapshot.sh` 產出）
 * - **絕不打 Supabase**：快照不存在就視同該層不可用（見 docs/proposal/embed-dynamic-layers.md §3-4）
 */
import type { LayerVisibility } from "../types";

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface SnapshotLayerSpec {
  /** GeoJSON source id */
  sourceId: string;
  /** 疊在底圖上的 layer 定義（順序即繪製順序） */
  layers: any[];
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * 共機活動區。樣式對齊 `src/hooks/usePlaActivityLayer.ts`：
 * fill/line 都用 feature 的 `kind_color`（rect 走廊 #38bdf8 / poly 活動區 #a855f7），
 * `needs_review` 的虛線與半透明規則保留 —— 雖然預設快照已排除待核實項，
 * 但若日後匯出時打開 `p_include_review` 就會用到。
 */
const PLA_ACTIVITY: SnapshotLayerSpec = {
  sourceId: "pla-activity",
  layers: [
    {
      id: "pla-activity-fill",
      type: "fill",
      source: "pla-activity",
      paint: {
        "fill-color": ["get", "kind_color"],
        // 主站 BASE_FILL_OPACITY = 0.22，待核實者減半
        "fill-opacity": ["case", ["==", ["get", "needs_review"], 1], 0.11, 0.22],
      },
    },
    {
      id: "pla-activity-line",
      type: "line",
      source: "pla-activity",
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": ["get", "kind_color"],
        "line-width": 1.6,          // 主站單日值（疊加時才降到 0.9）
        "line-opacity": 0.95,       // 主站 BASE_LINE_OPACITY
        "line-dasharray": ["case", ["==", ["get", "needs_review"], 1], ["literal", [2, 2]], ["literal", [1, 0]]],
      },
    },
  ],
};

/** 支援歷史快照的圖層。key 必須也存在於 LAYER_COLORS（urlState 會驗）。 */
export const SNAPSHOT_LAYERS: Readonly<Partial<Record<keyof LayerVisibility, SnapshotLayerSpec>>> = {
  plaActivity: PLA_ACTIVITY,
};

export const SNAPSHOT_KEYS = Object.keys(SNAPSHOT_LAYERS) as (keyof LayerVisibility)[];

export function isSnapshotLayer(key: string): boolean {
  return key in SNAPSHOT_LAYERS;
}

/** 快照檔路徑。date 須為 YYYY-MM-DD（urlState 已驗格式）。 */
export function snapshotUrl(layer: string, date: string): string {
  return `/embed-snapshots/${layer}/${date}.geojson`;
}

/**
 * 讀快照。找不到／格式壞掉一律回 null —— 呼叫端據此靜默略過該層，
 * 與 urlState 的降級原則一致：別人文章裡的白屏是最糟的失敗模式。
 */
export async function fetchSnapshot(
  layer: string,
  date: string,
): Promise<GeoJSON.FeatureCollection | null> {
  try {
    const res = await fetch(snapshotUrl(layer, date));
    if (!res.ok) return null;
    const json = (await res.json()) as GeoJSON.FeatureCollection;
    if (!json || json.type !== "FeatureCollection" || !Array.isArray(json.features)) return null;
    return json;
  } catch {
    return null;
  }
}

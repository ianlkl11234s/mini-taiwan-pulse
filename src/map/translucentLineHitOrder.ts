/**
 * 半透明線層的點擊命中順序（LINESORT-1，2026-11-24）。
 *
 * Mapbox GL 3.x 的 `queryRenderedFeatures` 在同一圖層、同一張圖磚內一律「後畫的排前面」
 * （FeatureIndex.query 依插入序由大到小），假設後畫的蓋在上面。但 `drawLine` 對
 * line-opacity 為常數且介於 0 和 1 之間、沒有 line-pattern 的線層會走 stencil 遮罩：
 * 每個像素只畫第一次，所以畫面上反而是「先畫的在上面」。結果同層兩條線疊在一起時，
 * popup 會選到畫面下層那條（印尼 TransJakarta：紅色 BRT 在上，點到藍色接駁線）。
 *
 * 這裡不改繪製順序（line-sort-key 會讓繪製與查詢一起換位，解決不了），只把查詢結果裡
 * 「同圖層＋同圖磚」連續的一段在 stencil 條件成立時反轉，讓第一筆＝畫面最上面那筆。
 * 不透明（1）、透明度 0 的命中層、透明度依資料而變、circle／fill 等都維持 Mapbox 原順序。
 */

export interface LineHitLike {
  layer?: { id?: string } | null;
  tile?: { key?: number | string } | null;
}

/** 這個圖層的線是否走 Mapbox 的 stencil 遮罩（＝先畫的在上面）。 */
export type FirstDrawnOnTop = (layerId: string) => boolean;

const FEATURE_OPERATORS = new Set(["get", "has", "properties", "feature-state", "id", "geometry-type", "accumulated"]);

/** 樣式值是否依 feature 變化（資料驅動）：此時 Mapbox 視為非常數，不走 stencil。 */
export function isFeatureDependent(value: unknown): boolean {
  if (Array.isArray(value)) {
    if (typeof value[0] === "string" && FEATURE_OPERATORS.has(value[0])) return true;
    return value.some(isFeatureDependent);
  }
  if (value && typeof value === "object") {
    // 舊式 function：{ property: ... } 為資料驅動
    if ("property" in value) return true;
    return Object.values(value as Record<string, unknown>).some(isFeatureDependent);
  }
  return false;
}

/**
 * 對照 mapbox-gl `drawLine` 的 `useStencilMaskRenderPass = !image && hasOpacity`：
 * 線層、沒有 line-pattern、line-opacity 不依 feature 變化，且目前縮放下的值嚴格介於 0 和 1。
 * `evaluatedOpacity` 是當下縮放算出的值（命中 feature 的 layer.paint 已算好）。
 */
export function lineUsesStencilPass(args: { type: unknown; rawOpacity: unknown; evaluatedOpacity: unknown; pattern: unknown }): boolean {
  if (args.type !== "line") return false;
  if (args.pattern !== undefined && args.pattern !== null) return false;
  if (isFeatureDependent(args.rawOpacity)) return false;
  const value = typeof args.evaluatedOpacity === "number" ? args.evaluatedOpacity
    : typeof args.rawOpacity === "number" ? args.rawOpacity : 1;
  return value > 0 && value < 1;
}

/**
 * 依畫面上下重排命中：同圖層＋同圖磚的連續一段，在該圖層走 stencil 時反轉；其餘位置不動。
 * 跨圖層與跨圖磚的先後（Mapbox 已依圖層由上而下排）保持原樣。
 */
export function orderHitsByVisibleTop<T extends LineHitLike>(hits: readonly T[], firstDrawnOnTop: FirstDrawnOnTop): T[] {
  const out: T[] = [];
  let i = 0;
  while (i < hits.length) {
    const layerId = hits[i]!.layer?.id;
    const tileKey = hits[i]!.tile?.key;
    let j = i + 1;
    while (j < hits.length && hits[j]!.layer?.id === layerId && hits[j]!.tile?.key === tileKey) j++;
    const run = hits.slice(i, j);
    out.push(...(j - i > 1 && layerId !== undefined && firstDrawnOnTop(layerId) ? run.reverse() : run));
    i = j;
  }
  return out;
}

/**
 * 點選光暈 → 已由 R2 選取圈取代（UI 統一 Phase E）。
 *
 * 保留 export 名稱，讓 layerHookRegistry / SelectedFeatureHaloHost 不用改接線；
 * 實作見 useSelectionRing（mapboxgl.Marker + CSS 呼吸脈衝，舊的淡黃 circle 圖層已移除）。
 */
export { useSelectionRing as useSelectedFeatureHalo } from "./useSelectionRing";

/**
 * 比較模式右圖的實例（開才建、關就銷毀；Q4 (a)）。給不在 CompareMapView 元件樹裡、又要知道右圖的地方讀：
 * 右下資料來源列（只在右側的圖層也要列出來源）。
 */
import type { Map as MapboxMap } from "mapbox-gl";

let current: MapboxMap | null = null;
const listeners = new Set<() => void>();

export const compareRightMap = {
  get: (): MapboxMap | null => current,
  set(map: MapboxMap | null) {
    if (current === map) return;
    current = map;
    listeners.forEach((listener) => listener());
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  },
};

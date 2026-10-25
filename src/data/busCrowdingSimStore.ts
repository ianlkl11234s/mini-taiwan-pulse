import { useSyncExternalStore } from "react";
import { segmentKey, type BusCrowdingScenarioData } from "./busCrowdingSimTypes";
import type { ReplayLine, ReplayTrip } from "./busCrowdingReplay";

/**
 * 公車擁擠模擬的跨元件小狀態（模組級 store）：hook 載入後寫入，popup 讀。
 * - index：「線編號_站序」→ feature 順序（數值陣列的 index）。
 * - scenario：目前方案的兩版數值。關閉圖層時清空。
 * 版本、方案本身是圖層參數（layerParamsStore），這裡不重複存。
 */
type Listener = () => void;
function createStore<T>(initial: T) {
  let value = initial;
  const listeners = new Set<Listener>();
  return {
    get: () => value,
    set(next: T) { if (Object.is(next, value)) return; value = next; listeners.forEach((l) => l()); },
    subscribe(listener: Listener) { listeners.add(listener); return () => { listeners.delete(listener); }; },
  };
}

const indexStore = createStore<ReadonlyMap<string, number> | null>(null);
const scenarioStore = createStore<BusCrowdingScenarioData | null>(null);

/** 由 segments.geojson 建索引（feature id＝陣列順序）。 */
export function buildSegmentIndex(fc: GeoJSON.FeatureCollection): Map<string, number> {
  const out = new Map<string, number>();
  fc.features.forEach((f, i) => {
    const p = f.properties as { li?: number; sj?: number } | null;
    if (p && typeof p.li === "number" && typeof p.sj === "number") out.set(segmentKey(p.li, p.sj), typeof f.id === "number" ? f.id : i);
  });
  return out;
}

export const busCrowdingSimIndexStore = indexStore;
export const busCrowdingSimScenarioStore = scenarioStore;

export const useBusCrowdingSimIndex = () => useSyncExternalStore(indexStore.subscribe, indexStore.get);
export const useBusCrowdingSimScenario = () => useSyncExternalStore(scenarioStore.subscribe, scenarioStore.get);

/** 時間回放：目前版本×方案的班次與線形（車 popup 依 trip id 查下一站與兩版分級）。關閉回放時清空。 */
export interface BusCrowdingReplayData { trips: readonly ReplayTrip[]; byId: ReadonlyMap<string, ReplayTrip>; lines: readonly (ReplayLine | null)[] }
const replayStore = createStore<BusCrowdingReplayData | null>(null);
export const busCrowdingSimReplayStore = replayStore;
export const useBusCrowdingSimReplay = () => useSyncExternalStore(replayStore.subscribe, replayStore.get);

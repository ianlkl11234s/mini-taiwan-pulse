/**
 * 「多年份並排」視窗開在哪一層（同時最多一個）。按鈕掛在統計連動選單最後一列下方
 * （`layerParamsControls.ts` 的 `LinkedSelectConfig.action`），視窗由 `ExpandedControls` 掛載。
 */
import { useSyncExternalStore } from 'react';
import { regionalStatisticsStore } from './regionalStatisticsStore';
import { isStatisticsRenderLayer } from '../data/regionalStatisticsRecipes';
import { smallMultiplesPlan } from '../data/statisticsSmallMultiples';

let openKey: string | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(listener => listener());

export const statisticsSmallMultiplesStore = {
  get: () => openKey,
  open(key: string) { if (openKey !== key) { openKey = key; emit(); } },
  close() { if (openKey !== null) { openKey = null; emit(); } },
  subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
};

export function useSmallMultiplesOpenKey(): string | null {
  return useSyncExternalStore(statisticsSmallMultiplesStore.subscribe, statisticsSmallMultiplesStore.get, statisticsSmallMultiplesStore.get);
}

/** 這一層目前可並排幾年（< 2、層級不支援、尚未載入 → 0，不顯示按鈕）。 */
export function statisticsSmallMultiplesYearCount(key: string): number {
  if (!isStatisticsRenderLayer(key)) return 0;
  try {
    return smallMultiplesPlan(key, regionalStatisticsStore.getSnapshot(key))?.periods.length ?? 0;
  } catch {
    return 0;
  }
}

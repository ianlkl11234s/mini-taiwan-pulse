/**
 * 領土格原型的共用狀態：左側面板（IconRailSidebar 內）寫、地圖 hook 與右側領土卡讀。
 * 寫法同 countryStore（useSyncExternalStore，無外部依賴）。
 */
import { useSyncExternalStore } from "react";
import type { RankScope, TerritoryRes } from "./territoryAttributes";

export interface TerritoryState {
  /** 面板開著＝地圖鋪格子；關面板即移除 */
  open: boolean;
  /** 目前上色的屬性 key（標籤分數或一般屬性），null＝只看灰格 */
  activeKey: string | null;
  /** 有值格子的填色透明度 */
  opacity: number;
  /** 被點的格子：點擊當下的磚內屬性快照（凍結，避免切屬性時卡片值跟著變） */
  selected: Record<string, unknown> | null;
  /** 點擊的經緯度：換解析度後用來選回包含該點的那一格 */
  selectedLngLat: [number, number] | null;
  /** 三個標籤分數的排名方式：全台（score_*）或縣市內（score_*_cty） */
  rankScope: RankScope;
  /** 目前畫面縮放對應的解析度（圖例斷點跟著換） */
  res: TerritoryRes;
}

const DEFAULT_OPACITY = 0.7;

let state: TerritoryState = { open: false, activeKey: null, opacity: DEFAULT_OPACITY, selected: null, selectedLngLat: null, rankScope: "nation", res: 7 };
const listeners = new Set<() => void>();

function set(patch: Partial<TerritoryState>): void {
  const next = { ...state, ...patch };
  if ((Object.keys(patch) as (keyof TerritoryState)[]).every((k) => next[k] === state[k])) return;
  state = next;
  for (const l of listeners) l();
}

export const territoryStore = {
  getSnapshot: (): TerritoryState => state,
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  setOpen(open: boolean): void {
    // 關面板：連同選取一起清掉（格子與卡片都移除）
    set(open ? { open } : { open, selected: null, selectedLngLat: null });
  },
  setActiveKey(activeKey: string | null): void { set({ activeKey }); },
  setRankScope(rankScope: RankScope): void { set({ rankScope }); },
  setOpacity(opacity: number): void { set({ opacity }); },
  /** lngLat 省略＝沿用原本點擊位置（換解析度選回時用）；selected 為 null 時一併清掉 */
  select(selected: Record<string, unknown> | null, lngLat?: [number, number]): void {
    set({ selected, selectedLngLat: selected ? (lngLat ?? state.selectedLngLat) : null });
  },
  setRes(res: TerritoryRes): void { set({ res }); },
};

export function useTerritory(): TerritoryState {
  return useSyncExternalStore(territoryStore.subscribe, territoryStore.getSnapshot, territoryStore.getSnapshot);
}

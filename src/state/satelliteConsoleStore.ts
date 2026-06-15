/**
 * Satellite Console — 外部 store（panel 開關 + 選中衛星 + 對比 modal）
 *
 * 用 useSyncExternalStore 訂閱；跨元件共享狀態，不靠 prop drilling。
 */
import { useSyncExternalStore } from "react";
import type { ManeuverRow } from "../data/satelliteManeuversLoader";

interface SatelliteConsoleState {
  /** 主 panel 是否開啟 */
  open: boolean;
  /** 點衛星列表 → 觸發百科卡（§E） */
  selectedNorad: number | null;
  /** 點變軌警報「看覆蓋變化」→ §F modal */
  compareManeuver: ManeuverRow | null;
  /** 是否顯示全部軌道（Console 模式預設只顯示變軌 + TW + 通過中） */
  showAllOrbits: boolean;
}

let state: SatelliteConsoleState = {
  open: false,
  selectedNorad: null,
  compareManeuver: null,
  showAllOrbits: false,
};

const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export const satelliteConsoleStore = {
  getState(): SatelliteConsoleState {
    return state;
  },
  subscribe(cb: () => void): () => void {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },
  setOpen(open: boolean) {
    if (state.open === open) return;
    state = { ...state, open };
    emit();
  },
  toggleOpen() {
    state = { ...state, open: !state.open };
    emit();
  },
  selectNorad(norad: number | null) {
    if (state.selectedNorad === norad) return;
    state = { ...state, selectedNorad: norad };
    emit();
  },
  openCompare(maneuver: ManeuverRow) {
    state = { ...state, compareManeuver: maneuver };
    emit();
  },
  closeCompare() {
    state = { ...state, compareManeuver: null };
    emit();
  },
  setShowAllOrbits(v: boolean) {
    if (state.showAllOrbits === v) return;
    state = { ...state, showAllOrbits: v };
    emit();
  },
};

export function useSatelliteConsole() {
  return useSyncExternalStore(satelliteConsoleStore.subscribe, satelliteConsoleStore.getState);
}

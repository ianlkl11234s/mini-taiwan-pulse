/**
 * climateFrameStore — 風場 / 海流粒子層「當前顯示幀」的有效時間與種類。
 *
 * 由 useClimateParticleLineLayer 切幀時寫入；LegendPanel 用 useSyncExternalStore 讀，
 * 顯示一行「實況/預報 · 時間」小字。與 timeStore 同樣是 external store（不觸發整棵樹 re-render）。
 *
 * fallback（無 manifest）時 hook 不寫入，validAt 維持 null → legend 不顯示該行。
 */

import { useSyncExternalStore } from "react";
import type { FrameKind } from "../data/climateFrames";

export type ClimateFrameStatusKey = "windField" | "oceanCurrents";

export interface ClimateFrameStatus {
  validAt: string | null;
  kind: FrameKind | null;
}

const EMPTY: ClimateFrameStatus = { validAt: null, kind: null };

const state: Record<ClimateFrameStatusKey, ClimateFrameStatus> = {
  windField: EMPTY,
  oceanCurrents: EMPTY,
};

const listeners = new Set<() => void>();

export const climateFrameStore = {
  get(key: ClimateFrameStatusKey): ClimateFrameStatus {
    return state[key];
  },
  set(key: ClimateFrameStatusKey, status: ClimateFrameStatus): void {
    const cur = state[key];
    if (cur.validAt === status.validAt && cur.kind === status.kind) return;
    state[key] = status;
    for (const l of listeners) l();
  },
  clear(key: ClimateFrameStatusKey): void {
    climateFrameStore.set(key, EMPTY);
  },
  subscribe(l: () => void): () => void {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};

export function useClimateFrameStatus(key: ClimateFrameStatusKey): ClimateFrameStatus {
  return useSyncExternalStore(
    climateFrameStore.subscribe,
    () => climateFrameStore.get(key),
    () => EMPTY,
  );
}

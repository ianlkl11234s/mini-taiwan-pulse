/**
 * 右上視野提示（design-system §5.42，國家主體化 PR 3）：地圖停穩後判斷視野中心落在哪一國，
 * 和目前國家主體不同時「提示」使用者切換——**只提示、不自動切換**。
 *
 * 判斷規則（PLAN-topic1-website §5）：
 * - `moveend` 後停穩 600ms 才判斷（中途又開始移動就重算）；zoom < 4.5 不判斷（看東亞、全歐時不跳）。
 * - 中心點在他國 bbox、該國≠目前國家、該國可用圖層數 > 0（扣上鎖與 release-hold）才提示。
 * - 拍攝模式、私人畫面、Agent 移動鏡頭中不判斷；手機、AI 對話框或 Agent 活動卡出現時整個停用（呼叫端給 `enabled=false`）。
 * - 「保持〇〇」：本次瀏覽（sessionStorage）不再為該國提示；視野回到目前國家、或國家主體改變（含手動切換）後重新啟用。
 * - 「切換到〇〇」只改 `countryStore`，不飛鏡頭。
 *
 * 純邏輯（`viewportCountryAt`、`viewportHintTarget`、`settleViewport`、`createHintDismissals`、
 * `createViewportSettleWatcher`）與 React 分開，單元測試直接打這些函式。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Map as MapboxMap } from "mapbox-gl";
import type { LayerVisibility } from "../types";
import { countryForPoint, isCountryCode, type CountryCode } from "../constants/countries";
import { countryStore, useCountry } from "../state/countryStore";
import { countryLayerKeys } from "../components/sidebar/layerPanels";
import { isResearchMotionActive } from "../research/researchMotion";

export const VIEWPORT_HINT_MIN_ZOOM = 4.5;
export const VIEWPORT_HINT_SETTLE_MS = 600;
export const VIEWPORT_HINT_STORAGE_KEY = "pulse.countryHint.kept";

/** 停穩後的視野：`null`＝不判斷（zoom 太小或被抑制）；`"none"`＝中心不在任何國家（公海、爭議海域、未收錄國家）。 */
export type ViewportCountry = CountryCode | "none" | null;

export function viewportCountryAt(center: readonly [number, number], zoom: number): ViewportCountry {
  if (!(zoom >= VIEWPORT_HINT_MIN_ZOOM)) return null;
  return countryForPoint(center[0], center[1]) ?? "none";
}

/** 要提示切換到哪一國；不提示回 null。 */
export function viewportHintTarget({
  view,
  country,
  isKept,
  availableCount,
}: {
  view: ViewportCountry;
  country: CountryCode;
  isKept: (code: CountryCode) => boolean;
  availableCount: (code: CountryCode) => number;
}): CountryCode | null {
  if (view === null || view === "none" || view === country) return null;
  if (isKept(view)) return null;
  return availableCount(view) > 0 ? view : null;
}

type HintStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** 「保持〇〇」的紀錄（本次瀏覽＝sessionStorage）。storage 不可用（隱私模式、測試）時只存在記憶體。 */
export function createHintDismissals(storage: HintStorage | null = defaultStorage()) {
  let memory = new Set<CountryCode>(read(storage));
  const write = () => {
    try {
      if (memory.size === 0) storage?.removeItem(VIEWPORT_HINT_STORAGE_KEY);
      else storage?.setItem(VIEWPORT_HINT_STORAGE_KEY, JSON.stringify([...memory]));
    } catch { /* 寫不進 storage 時只留記憶體 */ }
  };
  return {
    has: (code: CountryCode) => memory.has(code),
    add(code: CountryCode) {
      memory.add(code);
      write();
    },
    /** 有東西被清掉才回 true（呼叫端據此決定要不要重繪）。 */
    clear(): boolean {
      if (memory.size === 0) return false;
      memory = new Set();
      write();
      return true;
    },
  };
}
export type HintDismissals = ReturnType<typeof createHintDismissals>;

function defaultStorage(): HintStorage | null {
  try {
    return typeof window !== "undefined" ? window.sessionStorage : null;
  } catch {
    return null;
  }
}

function read(storage: HintStorage | null): CountryCode[] {
  try {
    const raw = storage?.getItem(VIEWPORT_HINT_STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(isCountryCode) : [];
  } catch {
    return [];
  }
}

/** 停穩時的判斷：回傳視野所屬國；視野回到目前國家時清掉「保持」紀錄（重新啟用提示）。 */
export function settleViewport(
  center: readonly [number, number],
  zoom: number,
  country: CountryCode,
  dismissals: HintDismissals,
): { view: ViewportCountry; cleared: boolean } {
  const view = viewportCountryAt(center, zoom);
  const cleared = view === country ? dismissals.clear() : false;
  return { view, cleared };
}

/** 地圖事件的最小介面（測試用假地圖也實作這些）。 */
export interface SettleMap {
  on(type: "movestart" | "moveend", listener: () => void): unknown;
  off(type: "movestart" | "moveend", listener: () => void): unknown;
  getCenter(): { lng: number; lat: number };
  getZoom(): number;
}

/**
 * 綁 movestart／moveend：停穩 `settleMs` 後呼叫 `onSettle`；中途又移動就取消。
 * `isAgentMotion()` 在 movestart 時為真＝這一段是 Agent 移動鏡頭，停穩後改呼叫 `onSkip`（不判斷）。
 */
export function createViewportSettleWatcher({
  map,
  settleMs = VIEWPORT_HINT_SETTLE_MS,
  isAgentMotion = () => false,
  onSettle,
  onSkip,
}: {
  map: SettleMap;
  settleMs?: number;
  isAgentMotion?: () => boolean;
  onSettle: (center: [number, number], zoom: number) => void;
  onSkip: () => void;
}): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let agentMoved = false;
  const onStart = () => {
    if (timer) clearTimeout(timer);
    timer = undefined;
    if (isAgentMotion()) agentMoved = true;
  };
  const onEnd = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
      if (agentMoved || isAgentMotion()) {
        agentMoved = false;
        onSkip();
        return;
      }
      const c = map.getCenter();
      onSettle([c.lng, c.lat], map.getZoom());
    }, settleMs);
  };
  map.on("movestart", onStart);
  map.on("moveend", onEnd);
  return () => {
    if (timer) clearTimeout(timer);
    map.off("movestart", onStart);
    map.off("moveend", onEnd);
  };
}

/**
 * @param enabled false＝整個停用（手機、拍攝模式、AI 對話框或 Agent 活動卡開著）：不判斷、不顯示。
 * @param isPrivateView 私人畫面（會員場景還原後）：判斷時讀 ref，為真就不提示。
 * @param lockedKeys 對目前使用者上鎖的圖層（含 release-hold）；可用層數扣掉這些。
 */
export function useViewportCountry({
  map,
  enabled,
  isPrivateView,
  lockedKeys,
}: {
  map: MapboxMap | null;
  enabled: boolean;
  isPrivateView: () => boolean;
  lockedKeys: ReadonlySet<keyof LayerVisibility>;
}): { target: CountryCode | null; switchTo: () => void; keep: () => void } {
  const country = useCountry();
  const dismissals = useMemo(() => createHintDismissals(), []);
  const [view, setView] = useState<ViewportCountry>(null);
  const [, setDismissVersion] = useState(0);
  const isPrivateViewRef = useRef(isPrivateView);
  isPrivateViewRef.current = isPrivateView;

  useEffect(() => {
    if (!map || !enabled) {
      setView(null);
      return;
    }
    const settle = (center: [number, number], zoom: number) => {
      if (isPrivateViewRef.current()) {
        setView(null);
        return;
      }
      const result = settleViewport(center, zoom, countryStore.getSnapshot(), dismissals);
      if (result.cleared) setDismissVersion((v) => v + 1);
      setView(result.view);
    };
    const dispose = createViewportSettleWatcher({
      map,
      isAgentMotion: () => isResearchMotionActive(map),
      onSettle: settle,
      onSkip: () => setView(null),
    });
    // 啟用當下地圖若已停著（開站、對話框剛關），立刻判斷一次，不必等下一次移動。
    if (!map.isMoving()) {
      const c = map.getCenter();
      settle([c.lng, c.lat], map.getZoom());
    }
    return dispose;
  }, [map, enabled, dismissals]);

  // 國家主體改變（手動切、按「切換到〇〇」、Agent 開他國圖層）→ 重新啟用所有提示。
  const previousCountry = useRef(country);
  useEffect(() => {
    if (previousCountry.current === country) return;
    previousCountry.current = country;
    if (dismissals.clear()) setDismissVersion((v) => v + 1);
  }, [country, dismissals]);

  const target = enabled
    ? viewportHintTarget({
      view,
      country,
      isKept: dismissals.has,
      availableCount: (code) => countryLayerKeys(code).filter((key) => !lockedKeys.has(key)).length,
    })
    : null;

  const switchTo = useCallback(() => {
    if (target) countryStore.set(target);
  }, [target]);
  const keep = useCallback(() => {
    if (!target) return;
    dismissals.add(target);
    setDismissVersion((v) => v + 1);
  }, [target, dismissals]);

  return { target, switchTo, keep };
}

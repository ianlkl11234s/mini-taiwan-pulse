/**
 * 比較模式（雙地圖＋把手）的狀態（docs/features/compare-mode/DESIGN.md §3，P1）。
 *
 * - 主地圖＝左側；比較時另建一張右圖疊在上面，用 CSS 裁切露出把手右邊。
 * - 側別（左／右／兩側）只有 P1 支援的圖層可以設：古地圖六層（`historicalMapSinica.ts`）與統計圖層（面量圖、比例圓）。
 *   其他圖層在比較模式照畫在左側（使用者 2026-11-11 Q1 (a)），圖層列標「比較模式暫不支援，只顯示在左側」。
 * - 統計左右不同的期別／細項不存在這裡：選擇只存在 `regionalStatisticsStore`（右側另一份 `key::R`，
 *   見 `compareStatistics.ts`），這裡只放開關、把手位置、側別。
 * - 側別只活在這次瀏覽（不寫 localStorage）；分享網址另外記（`urlState` 的 `cmp*` 參數）。
 *
 * 兩種模式（同一個「比較」入口，站主 2026-11-24 決定 3）：
 * - `slider`＝同地點拉桿（上面描述的 P1）。
 * - `countries`＝兩國並排（G2-1）：左＝主地圖（目前國家），右＝`rightCountry`（只能是外國）。側別不看 `sides`，
 *   改由圖層的國家決定（`map/compareCountrySides.ts`）；比例尺預設同步（`scaleLocked`），可關。
 *   `rightCamera` 是右圖目前（或要建立時用）的鏡頭：右圖 moveend 寫回，分享網址 `cmpv` 讀它。
 */
import { useMemo, useSyncExternalStore } from "react";
import { HISTORICAL_MAP_GROUPS } from "../data/historicalMapSinica";
import { isStatisticsRenderLayer } from "../data/regionalStatisticsRecipes";
import { isRightSideKey } from "../map/compareCountrySides";
import type { CountryCamera, CountryCode } from "../constants/countries";
import type { UrlCompareState } from "../lib/urlState";

export type CompareSide = "left" | "right" | "both";
/** 比較模式：同地點拉桿／兩國並排；之後新增的比較模式加在這裡（入口選單依序列出） */
export type CompareMode = "slider" | "countries";
export const COMPARE_MODES: readonly CompareMode[] = ["slider", "countries"];

export interface CompareState {
  enabled: boolean;
  mode: CompareMode;
  /** 把手位置（0..1，畫面寬度比例；只用在 slider） */
  split: number;
  /** 圖層側別；缺省＝兩側（只用在 slider） */
  sides: Readonly<Record<string, CompareSide>>;
  /** 並排的右側國家（countries；台灣不能放右邊，站主 2026-11-24 決定 1） */
  rightCountry: CountryCode | null;
  /** 並排時兩邊比例尺一致（依緯度換算縮放級數；預設開） */
  scaleLocked: boolean;
  /** 並排右圖的鏡頭（null＝用該國上次的鏡頭） */
  rightCamera: CountryCamera | null;
}

/** 判斷側別需要的欄位（元件只訂這幾個，拖把手、右圖平移不重繪） */
export type CompareSideState = Pick<CompareState, "enabled" | "mode" | "sides" | "rightCountry">;

export const COMPARE_DEFAULT_SPLIT = 0.5;
export const COMPARE_SPLIT_MIN = 0.05;
export const COMPARE_SPLIT_MAX = 0.95;
/** 鍵盤 ←→ 一次移動的比例 */
export const COMPARE_SPLIT_STEP = 0.05;

const HISTORICAL_KEYS: ReadonlySet<string> = new Set(HISTORICAL_MAP_GROUPS.map((group) => group.key));

/** P1 支援左右指定的圖層：古地圖六層＋統計圖層 */
export function isCompareSupported(key: string): boolean {
  return HISTORICAL_KEYS.has(key) || isStatisticsRenderLayer(key);
}

export function clampSplit(value: number): number {
  if (!Number.isFinite(value)) return COMPARE_DEFAULT_SPLIT;
  return Math.min(COMPARE_SPLIT_MAX, Math.max(COMPARE_SPLIT_MIN, value));
}

const INITIAL: CompareState = { enabled: false, mode: "slider", split: COMPARE_DEFAULT_SPLIT, sides: {}, rightCountry: null, scaleLocked: true, rightCamera: null };
let state: CompareState = INITIAL;
const listeners = new Set<() => void>();

function commit(next: CompareState) {
  if (next === state) return;
  state = next;
  listeners.forEach((listener) => listener());
}

/**
 * 並排的右側國家（站主決定 1、6）：只能是外國、不能和左側同國、要是這個身分看得到的國家。
 * 目前的還合法就留著；否則取「左側之後的下一個釘選外國」（輪回清單開頭），沒有釘選外國時取國家清單第一個外國。
 */
export function pickRightCountry(
  left: CountryCode,
  pinned: readonly CountryCode[],
  visible: readonly CountryCode[],
  current: CountryCode | null = null,
): CountryCode | null {
  const ok = (code: CountryCode) => code !== "TW" && code !== left && visible.includes(code);
  if (current && ok(current)) return current;
  const at = pinned.indexOf(left);
  const ordered = at >= 0 ? [...pinned.slice(at + 1), ...pinned.slice(0, at)] : pinned;
  return ordered.find(ok) ?? visible.find(ok) ?? null;
}

/** 分享網址（或手機寄放）的比較狀態 → `compareStore.hydrate` 的參數（開啟比較） */
export function compareHydrateFromUrl(url: UrlCompareState): Parameters<typeof compareStore.hydrate>[0] {
  if (url.mode === "countries") {
    return {
      enabled: true,
      mode: "countries",
      ...(url.rightCountry ? { rightCountry: url.rightCountry } : {}),
      ...(url.rightCamera ? { rightCamera: url.rightCamera } : {}),
      scaleLocked: url.scaleLocked !== false,
    };
  }
  return {
    enabled: true,
    mode: "slider",
    ...(url.split !== undefined ? { split: url.split } : {}),
    sides: Object.fromEntries([...(url.left ?? []).map((key) => [key, "left"] as const), ...(url.right ?? []).map((key) => [key, "right"] as const)]),
  };
}

/** 「兩國並排」說明卡看過就記住（這個瀏覽器不再出現；G2-1b）。拉桿的說明卡照舊每次開比較出現一次 */
export const COUNTRIES_TIP_SEEN_KEY = "pulse.compareCountriesTipSeen.v1";
export function countriesTipSeen(): boolean {
  try { return typeof localStorage !== "undefined" && localStorage.getItem(COUNTRIES_TIP_SEEN_KEY) === "1"; } catch { return false; }
}
export function markCountriesTipSeen(): void {
  try { if (typeof localStorage !== "undefined") localStorage.setItem(COUNTRIES_TIP_SEEN_KEY, "1"); } catch { /* 私密模式等寫不進去：只是下次再看一次 */ }
}

/** 兩國並排中（右側國家已定） */
export function isCountriesCompare(snapshot: CompareSideState = state): boolean {
  return snapshot.enabled && snapshot.mode === "countries" && !!snapshot.rightCountry;
}

/** 並排中的右側國家（不在並排回 null） */
export function activeRightCountry(snapshot: CompareSideState = state): CountryCode | null {
  return isCountriesCompare(snapshot) ? snapshot.rightCountry : null;
}

/**
 * 圖層在比較模式的側別。拉桿：不支援的圖層一律「左」；並排：右國圖層「右」、其他「左」（沒有兩側）。
 */
export function compareSideOf(key: string, snapshot: CompareSideState = state): CompareSide {
  if (snapshot.mode === "countries") return isRightSideKey(key, snapshot.rightCountry) ? "right" : "left";
  if (!isCompareSupported(key)) return "left";
  return snapshot.sides[key] ?? "both";
}

/** 主地圖（左）畫不畫：比較關閉時＝圖層開關 */
export function shownOnLeft(key: string, visible: boolean, snapshot: CompareSideState = state): boolean {
  return visible && (!snapshot.enabled || compareSideOf(key, snapshot) !== "right");
}

/**
 * 主地圖用的圖層開關表：兩國並排時右國圖層（畫在右圖）讀成 false，其他情況原樣回傳同一個物件。
 * 給主地圖的 overlay 管理器用（G2-1b）；Host 型圖層由 `<LayerHosts>` 自己遮。
 */
export function leftMapVisibility<T extends object>(vis: T, snapshot: CompareSideState = state): T {
  const right = activeRightCountry(snapshot);
  if (!right) return vis;
  let out: T | null = null;
  for (const [key, on] of Object.entries(vis)) {
    if (on !== true || !isRightSideKey(key, right)) continue;
    out ??= { ...vis };
    (out as Record<string, unknown>)[key] = false;
  }
  return out ?? vis;
}

/** 右圖畫不畫：拉桿只有支援的圖層；並排只有右國圖層 */
export function shownOnRight(key: string, visible: boolean, snapshot: CompareSideState = state): boolean {
  if (!visible || !snapshot.enabled) return false;
  if (snapshot.mode === "countries") return compareSideOf(key, snapshot) === "right";
  return isCompareSupported(key) && compareSideOf(key, snapshot) !== "left";
}

export const compareStore = {
  getSnapshot: (): CompareState => state,
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  },
  setEnabled(enabled: boolean) {
    if (state.enabled === enabled) return;
    commit({ ...state, enabled });
  },
  /** 從入口選模式並開啟（已開同一模式＝不變） */
  open(mode: CompareMode) {
    if (state.enabled && state.mode === mode) return;
    commit({ ...state, enabled: true, mode });
  },
  /** 換右側國家：鏡頭改用該國上次的鏡頭（`rightCamera` 清掉） */
  setRightCountry(rightCountry: CountryCode | null) {
    if (rightCountry === "TW") return;
    if (state.rightCountry === rightCountry) return;
    commit({ ...state, rightCountry, rightCamera: null });
  },
  setScaleLocked(scaleLocked: boolean) {
    if (state.scaleLocked === scaleLocked) return;
    commit({ ...state, scaleLocked });
  },
  /** 右圖 moveend 寫回（分享網址用） */
  setRightCamera(rightCamera: CountryCamera | null) {
    commit({ ...state, rightCamera });
  },
  setSplit(split: number) {
    const next = clampSplit(split);
    if (next === state.split) return;
    commit({ ...state, split: next });
  },
  /** 不支援的圖層忽略；「兩側」＝刪掉紀錄（缺省值） */
  setSide(key: string, side: CompareSide) {
    if (!isCompareSupported(key) || compareSideOf(key) === side) return;
    const sides = { ...state.sides };
    if (side === "both") delete sides[key]; else sides[key] = side;
    commit({ ...state, sides });
  },
  /** 一次套用（分享網址還原用）；非法值略過 */
  hydrate(next: {
    enabled?: boolean; split?: number; sides?: Readonly<Record<string, CompareSide>>;
    mode?: CompareMode; rightCountry?: CountryCode; scaleLocked?: boolean; rightCamera?: CountryCamera;
  }) {
    const sides: Record<string, CompareSide> = {};
    for (const [key, side] of Object.entries(next.sides ?? {})) {
      if (isCompareSupported(key) && (side === "left" || side === "right")) sides[key] = side;
    }
    commit({
      ...state,
      enabled: next.enabled ?? state.enabled,
      mode: next.mode ?? state.mode,
      split: next.split === undefined ? state.split : clampSplit(next.split),
      sides: { ...state.sides, ...sides },
      ...(next.rightCountry && next.rightCountry !== "TW" ? { rightCountry: next.rightCountry, rightCamera: next.rightCamera ?? null } : {}),
      ...(next.scaleLocked !== undefined ? { scaleLocked: next.scaleLocked } : {}),
    });
  },
  /** 測試用 */
  reset() { commit(INITIAL); },
};

export function useCompareState(): CompareState {
  return useSyncExternalStore(compareStore.subscribe, compareStore.getSnapshot, compareStore.getSnapshot);
}

/**
 * 只取一部分（回傳值要是原始值或穩定參照）：拖把手時 `split` 每幀變，只看開關／側別的元件不必跟著重繪。
 */
export function useCompareSelector<T>(select: (state: CompareState) => T): T {
  const get = () => select(state);
  return useSyncExternalStore(compareStore.subscribe, get, get);
}

/** 判斷側別用的欄位（參照穩定：拖把手、右圖平移、切比例尺開關都不換新） */
export function useCompareSideState(): CompareSideState {
  const enabled = useCompareSelector((s) => s.enabled);
  const mode = useCompareSelector((s) => s.mode);
  const sides = useCompareSelector((s) => s.sides);
  const rightCountry = useCompareSelector((s) => s.rightCountry);
  return useMemo(() => ({ enabled, mode, sides, rightCountry }), [enabled, mode, sides, rightCountry]);
}

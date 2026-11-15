/**
 * 綜合聲景的呈現方式與最近一幀狀態（W6-10：2026-11-16 使用者決定三種並存，切換放圖層展開區）。
 *
 * - 呈現方式是圖層參數 `soundComposite.soundCompositeMode`（layerParamsSpec；預設 c＝主因）：
 *   c＝主因、a＝活躍種數、b＝綜合指數（假設權重）。
 * - 網址 `?soundComposite=a|b|c`：載入時套一次（soundAtlasHost），切換時寫回（分享網址記住選項）。
 * - 另記最近一幀的整幀說明（例：這天沒有全範圍來源檔），給展開區的「資料不足」提示用。
 */
import type { GridFamily } from "./gridWire";
import type { LayerParamValues } from "../../data/layerParamsSpec";

export type CompositeVariant = "a" | "b" | "c";
export const COMPOSITE_MODE_DEFAULT: CompositeVariant = "c";

export function compositeVariantFromSearch(search: string): CompositeVariant | null {
  const v = new URLSearchParams(search).get("soundComposite");
  return v === "a" || v === "b" || v === "c" ? v : null;
}

/** 圖層參數 → 呈現方式（不合法時回預設） */
export function compositeModeOf(params: LayerParamValues | undefined): CompositeVariant {
  const v = params?.soundCompositeMode;
  return v === "a" || v === "b" || v === "c" ? v : COMPOSITE_MODE_DEFAULT;
}

interface FrameState {
  /** 最近一幀：七族的整幀說明（null＝該族這幀有算） */
  notes: Partial<Record<GridFamily, string | null>> | null;
  bin: number | null;
}

let state: FrameState = { notes: null, bin: null };
const listeners = new Set<() => void>();

export const compositeFrameStore = {
  get: (): FrameState => state,
  subscribe(cb: () => void): () => void {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },
  set(patch: Partial<FrameState>): void {
    state = { ...state, ...patch };
    listeners.forEach((l) => l());
  },
};

/** 沒有全範圍來源檔造成整幀無法判斷的族（展開區「資料不足」提示用） */
export const NO_SOURCE_NOTES = new Set(["no_full_area_source", "no_pack_for_date", "pack_source_mismatch", "source_not_loaded"]);

/**
 * 最近一幀（主執行緒持有的 Worker 結果，滑過提示直接查，不重算、不呼叫 queryReceiver）。
 * 不走 React 狀態：mousemove 只讀這裡。
 */
export interface CompositeFrameRef {
  bin: number;
  a: Uint8Array;
  b: Uint8Array;
  c: Uint8Array;
  lv: Uint32Array;
}
let lastFrame: CompositeFrameRef | null = null;
export const compositeFrameRef = {
  get: (): CompositeFrameRef | null => lastFrame,
  set: (f: CompositeFrameRef | null): void => { lastFrame = f; },
};

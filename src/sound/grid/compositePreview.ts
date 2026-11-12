/**
 * 綜合網格甲／乙預覽的狀態（PREVIEW：使用者選定一版後整個檔案連同 SoundCompositePreviewBar 一起移除，
 * 圖層固定用選定的版本；移除清單見 docs/features/city-sound-atlas/GRID_ARCHITECTURE.md §6）。
 *
 * - 初值讀網址 `?soundComposite=a|b`（預設 a）；切換時用 history.replaceState 寫回網址（方便分享同一版）。
 * - 另記最近一幀的整幀說明（例：這天沒有全範圍來源檔），給預覽列顯示原因。
 */
import type { GridFamily } from "./gridWire";

export type CompositeVariant = "a" | "b";

export function compositeVariantFromSearch(search: string): CompositeVariant | null {
  const v = new URLSearchParams(search).get("soundComposite");
  return v === "a" || v === "b" ? v : null;
}

interface PreviewState {
  variant: CompositeVariant;
  /** 最近一幀：七族的整幀說明（null＝該族這幀有算） */
  notes: Partial<Record<GridFamily, string | null>> | null;
  /** 最近一幀在範圍內的斜線比例（0–1） */
  unknownShare: number | null;
  bin: number | null;
}

let state: PreviewState = {
  variant: (typeof window !== "undefined" && compositeVariantFromSearch(window.location.search)) || "a",
  notes: null,
  unknownShare: null,
  bin: null,
};
const listeners = new Set<() => void>();

export const compositePreviewStore = {
  get: (): PreviewState => state,
  subscribe(cb: () => void): () => void {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },
  set(patch: Partial<PreviewState>): void {
    state = { ...state, ...patch };
    listeners.forEach((l) => l());
  },
  setVariant(v: CompositeVariant): void {
    if (v === state.variant) return;
    this.set({ variant: v });
    if (typeof window !== "undefined") {
      const u = new URL(window.location.href);
      u.searchParams.set("soundComposite", v);
      window.history.replaceState(window.history.state, "", u);
    }
  },
};

/** 沒有全範圍來源檔造成整幀無法判斷的族（預覽列說明原因用） */
export const NO_SOURCE_NOTES = new Set(["no_full_area_source", "no_pack_for_date", "pack_source_mismatch", "source_not_loaded"]);

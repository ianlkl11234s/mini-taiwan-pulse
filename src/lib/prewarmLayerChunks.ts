/**
 * C1：第一次開任一圖層後，於瀏覽器閒置時預先下載 3D／H3 等基礎工具 chunk（暖快取，結果丟棄），
 * 讓之後開 3D／H3 圖層只需等資料。首屏（全部圖層關閉）不觸發。
 * 除呼叫端傳入的 loaders 外，一併預載獨立 3D 圖層 hook 的按需模組（map/lazyThreeLayers，C1b）。
 */
import type { LayerVisibility } from "../types";
import { layerVisibilityStore } from "../state/layerVisibilityStore";
import { LAZY_THREE_LAYER_LOADERS } from "../map/lazyThreeLayers";

type Loader = () => Promise<unknown>;

function anyLayerOn(vis: LayerVisibility): boolean {
  return Object.values(vis).some((v) => v === true);
}

function whenIdle(fn: () => void): void {
  const ric = (globalThis as { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number }).requestIdleCallback;
  if (typeof ric === "function") ric(fn, { timeout: 3000 });
  else setTimeout(fn, 1500);
}

let fired = false;

/** 回傳解除訂閱函式。整個 session 只預載一次。 */
export function installLayerChunkPrewarm(loaders: Loader[]): () => void {
  if (fired) return () => {};
  const fire = () => {
    if (fired) return;
    fired = true;
    unsubscribe();
    whenIdle(() => {
      for (const load of [...loaders, ...LAZY_THREE_LAYER_LOADERS]) load().catch(() => { /* 預載失敗不影響；真正開圖層時會重試並顯示 loading */ });
    });
  };
  const unsubscribe = layerVisibilityStore.subscribe(() => {
    if (anyLayerOn(layerVisibilityStore.getAll())) fire();
  });
  if (anyLayerOn(layerVisibilityStore.getAll())) fire();
  return unsubscribe;
}

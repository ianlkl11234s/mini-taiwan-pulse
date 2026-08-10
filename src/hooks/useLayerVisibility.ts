import { useCallback, useRef } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { LayerVisibility } from "../types";
import {
  layerVisibilityStore,
  useLayerVisibilityAll,
} from "../state/layerVisibilityStore";

/**
 * AR-21 過渡期 bridge —— App state 與 `layerVisibilityStore` 的雙向橋。
 *
 * 介面與改造前一模一樣（`layerVisibility` / `layerVisibilityRef` /
 * `setLayerVisibility` / `toggleVisibility`），所以 App.tsx 既有的 71 處呼叫
 * **一行都不用改**。差別只在底下：狀態的家從 `useState` 搬到了 store。
 *
 * 雙向怎麼成立的（**沒有兩份 state，所以不需要防迴圈旗標**）：
 *   - App → store：`setLayerVisibility` / `toggleVisibility` 直接寫 store，
 *     不再持有自己的 useState。
 *   - store → App：`useLayerVisibilityAll()` 是 `useSyncExternalStore`，
 *     store 被**任何人**（未來直接訂閱的元件、chat bridge、深連結）改動都會
 *     讓 App 重繪拿到新值。
 *
 * 防迴圈的根本手段是 store 端的「同值不通知」（見 layerVisibilityStore
 * `applyChanges`）：值沒變就不換 snapshot identity、不通知任何 listener，
 * 於是 store→App→store 這條路走不到第二圈。StrictMode 雙跑同理安全 ——
 * 重複的 subscribe/unsubscribe 與重複渲染都只是讀同一份 snapshot。
 *
 * ⚠️ `layerVisibilityRef` 刻意維持「render 時賦值」的舊語意，**不要**改成直接
 * 讀 store。App.tsx 多處在 setState 之後立刻
 * `sessionTracker.logWithSnapshot(..., layerVisibilityRef.current)`，靠的就是
 * 這個 ref 此刻仍是**變更前**的快照；改成讀 store 會把那些分析事件悄悄
 * 換成變更後的值。
 *
 * AR-23 全量遷移完成後本 hook 即可退場。
 */
export function useLayerVisibility() {
  const layerVisibility = useLayerVisibilityAll();
  const layerVisibilityRef = useRef(layerVisibility);
  layerVisibilityRef.current = layerVisibility;

  const setLayerVisibility = useCallback<Dispatch<SetStateAction<LayerVisibility>>>(
    (action) => {
      // updater 形式讀 store 當前值（而非 render 時的值）——與 useState 的
      // 「同批多次 updater 依序疊加」語意一致，因為 store 寫入是同步生效的。
      const next =
        typeof action === "function"
          ? (action as (prev: LayerVisibility) => LayerVisibility)(
              layerVisibilityStore.getAll(),
            )
          : action;
      layerVisibilityStore.setAll(next);
    },
    [],
  );

  const toggleVisibility = useCallback((layer: keyof LayerVisibility) => {
    layerVisibilityStore.toggle(layer);
  }, []);

  return { layerVisibility, layerVisibilityRef, setLayerVisibility, toggleVisibility };
}

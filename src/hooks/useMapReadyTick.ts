import { useEffect, useState } from "react";
import type { Map as MapboxMap } from "mapbox-gl";

/**
 * mapRef 就緒通知 —— 解 layer hook 的「建層 effect 早於 map load」競態。
 *
 * ## 為什麼需要這個
 *
 * App 的 `mapRef.current` 是在 MapView 的 `map.on("load")` 裡透過 `onMapReady`
 * 回呼才填的，而**production 首載 load 事件可能晚達 ~30 秒**。在那之前：
 *
 * ```ts
 * useEffect(() => {
 *   const map = mapRef.current;
 *   if (!map) return;        // ← 提早 return，什麼也沒建
 *   ...建 source / layer...
 * }, [mapRef, visible]);
 * ```
 *
 * `mapRef` 是 ref，**`.current` 變動不觸發 re-render**，所以 effect 不會因為
 * 「map 終於好了」而重跑。只要 `visible` 在那之後沒再變，這個圖層就**永遠不會被建出來**。
 *
 * 兩個實際會中招的情境：
 * - **deep-link**（`?layers=`）：App 掛載時就把 visible 設成 true，遠早於 map load
 * - **手動 toggle**：使用者在 load 完成前就點開圖層（首載 30 秒是很長的時間）
 *
 * `OVERLAY_REGISTRY` 那條路徑早就有補發機制（MapView 的 `map.on("load")` 裡會用
 * ref 最新值重放一次），所以 registry 層不受影響 —— 缺的一直是 hook 這條路徑。
 *
 * ## 用法
 *
 * ```ts
 * const mapTick = useMapReadyTick(mapRef, visible);
 * useEffect(() => {
 *   const map = mapRef.current;
 *   if (!map) return;
 *   ...
 * }, [mapRef, visible, mapTick]);   // ← 把 tick 放進 deps
 * ```
 *
 * @param enabled 通常傳 `visible` —— 圖層關著就不需要輪詢，省掉沒必要的 timer
 * @returns map 就緒時 +1 的 tick（放進 deps 即可觸發 effect 重跑）
 */
export function useMapReadyTick(
  mapRef: React.RefObject<MapboxMap | null>,
  enabled = true,
): number {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    // map 已就緒 → 不需要輪詢（絕大多數情況會走這條，成本為零）
    if (!enabled || mapRef.current) return;

    const timer = setInterval(() => {
      if (!mapRef.current) return;
      clearInterval(timer);
      setTick((v) => v + 1);
    }, 200);
    return () => clearInterval(timer);
  }, [mapRef, enabled]);

  return tick;
}

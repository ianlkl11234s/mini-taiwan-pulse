/**
 * dynamicData overlay 的 setData 餵料（R6 段 2）。
 *
 * registry 的 dynamicData source 由 overlayManager 以空 FeatureCollection 建立，資料靠 hook setData。
 * 兩個時序缺口：(1) hook 先算好資料、overlay source 還沒建；(2) 換底圖（setStyle）後 source 重建成空的。
 * 時間軸暫停時 timeStore 不會再觸發，平面圖層就一直空著。
 *
 * 做法：記住最後一份資料；每次 `styledata`（addSource／setStyle 都會觸發）檢查 source 實例，
 * 對「還沒餵過的實例」補 setData。setData 本身只觸發 `sourcedata`，不會遞迴。
 */
import type { GeoJSONSource, Map as MapboxMap } from "mapbox-gl";

export interface DynamicSourceFeed {
  /** 更新資料並立即推給目前的 source（source 尚未建立時先記住，建立後補推） */
  set(fc: GeoJSON.FeatureCollection): void;
  /** 解除 styledata 監聽 */
  dispose(): void;
}

export function feedDynamicSource(map: MapboxMap, sourceId: string): DynamicSourceFeed {
  let last: GeoJSON.FeatureCollection | null = null;
  let fed = new WeakSet<object>();
  const push = (force: boolean) => {
    if (!last) return;
    const src = map.getSource(sourceId) as GeoJSONSource | undefined;
    if (!src || (!force && fed.has(src))) return;
    src.setData(last);
    fed.add(src);
  };
  const onStyleData = () => push(false);
  map.on("styledata", onStyleData);
  return {
    set(fc) {
      last = fc;
      fed = new WeakSet<object>();
      push(true);
    },
    dispose() {
      map.off("styledata", onStyleData);
    },
  };
}

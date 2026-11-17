import { useEffect } from "react";
import type { AnyLayer, Map as MapboxMap } from "mapbox-gl";
import { keepLoadingUntilMapIdle } from "../lib/loadingRegistry";
import { PMTILES_SOURCE_TYPE } from "../map/pmtilesConstants";
import { registerPmtilesSourceTypeOnce } from "../map/pmtilesSourceType";
import { useMapReadyTick } from "./useMapReadyTick";
import type { LayerBuild } from "./useGbWaterLayers";

/**
 * 「一層多檔」：同一個圖層的資料依地區分成多個 PMTiles（分片），只掛視窗看得到的那幾個。
 * 第一個使用者是南韓生態自然圖（依 시·도 17 檔，合計 1.7 GB，2026-11-17 KRH-1）。
 *
 * - 縮放 ≥ `minzoom` 且分片 bbox 與視窗（外擴半個視窗，減少平移時反覆拆裝）相交才掛 source＋layer；
 *   離開就把 layer 與 source 一起移除（只隱藏的話已載入的 tile 仍佔記憶體）。
 * - 低於 `minzoom` 不掛任何分片。另掛一個常駐的空 GeoJSON 錨點 layer（`anchor`，minzoom＝`minzoom`），
 *   讓視野提示卡（spec §5.42.1）找得到可見起點並提示「放大到 zN」。
 * - 每個新掛的分片 source 都註冊 loadingRegistry（`keepLoadingUntilMapIdle`）。
 * - `style.load` 後重掛；`moveend` 時重算要掛哪些分片；`deps` 變了（透明度、暗淡）對已掛的分片跑 `update`。
 */
export interface PmtilesShard {
  /** 分片代碼（layer／source id 的一部分） */
  id: string;
  /** public/world/ 下的檔名 */
  file: string;
  /** [W, S, E, N] */
  bbox: readonly [number, number, number, number];
}

export interface ViewportShardOptions {
  visible: boolean;
  /** 索引還沒載入時給 null（只掛錨點） */
  shards: readonly PmtilesShard[] | null;
  minzoom: number;
  srcMaxzoom: number;
  sourceId: (shard: PmtilesShard) => string;
  attribution: string;
  loading: string;
  /** 每個分片的 style layer（id 須含分片代碼，不可重名） */
  build: (shard: PmtilesShard, sourceId: string) => LayerBuild[];
  anchor: { sourceId: string; layerId: string };
}

function absoluteUrl(relativeFile: string): string {
  const relative = `${import.meta.env.BASE_URL ?? "/"}world/${relativeFile}`;
  return new URL(relative, window.location.href).href;
}

type Bounds = readonly [number, number, number, number];

/** 視窗外擴 `pad` 倍（各邊加寬／高 × pad）。 */
export function padBounds(b: Bounds, pad: number): Bounds {
  const dx = (b[2] - b[0]) * pad;
  const dy = (b[3] - b[1]) * pad;
  return [b[0] - dx, b[1] - dy, b[2] + dx, b[3] + dy];
}

/** 該掛哪些分片：縮放不到回空陣列；否則回 bbox 與（外擴後）視窗相交者。純函式，單元測試直接打。 */
export function shardsInView(shards: readonly PmtilesShard[], zoom: number, view: Bounds, minzoom: number, pad = 0.5): PmtilesShard[] {
  if (zoom < minzoom) return [];
  const v = padBounds(view, pad);
  return shards.filter((s) => v[0] <= s.bbox[2] && v[2] >= s.bbox[0] && v[1] <= s.bbox[3] && v[3] >= s.bbox[1]);
}

export function useViewportPmtilesShards(mapRef: React.RefObject<MapboxMap | null>, o: ViewportShardOptions, deps: readonly unknown[]) {
  const mapTick = useMapReadyTick(mapRef, o.visible);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const shards = o.shards ?? [];

    const removeShard = (shard: PmtilesShard) => {
      const sid = o.sourceId(shard);
      for (const l of o.build(shard, sid)) if (map.getLayer(l.id)) map.removeLayer(l.id);
      if (map.getSource(sid)) map.removeSource(sid);
    };

    const ensureAnchor = (show: boolean) => {
      if (!map.getSource(o.anchor.sourceId)) map.addSource(o.anchor.sourceId, { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      if (!map.getLayer(o.anchor.layerId)) {
        map.addLayer({ id: o.anchor.layerId, type: "fill", source: o.anchor.sourceId, minzoom: o.minzoom, layout: { visibility: "none" }, paint: { "fill-opacity": 0 } } as AnyLayer);
      }
      map.setLayoutProperty(o.anchor.layerId, "visibility", show ? "visible" : "none");
    };

    const sync = () => {
      if (!o.visible) {
        for (const s of shards) removeShard(s);
        if (map.getLayer(o.anchor.layerId)) map.setLayoutProperty(o.anchor.layerId, "visibility", "none");
        return;
      }
      ensureAnchor(true);
      const b = map.getBounds();
      if (!b) return;
      const view: Bounds = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()];
      const wanted = new Set(shardsInView(shards, map.getZoom(), view, o.minzoom).map((s) => s.id));
      for (const shard of shards) {
        const sid = o.sourceId(shard);
        if (!wanted.has(shard.id)) {
          if (map.getSource(sid)) removeShard(shard);
          continue;
        }
        registerPmtilesSourceTypeOnce();
        let added = false;
        if (!map.getSource(sid)) {
          map.addSource(sid, { type: PMTILES_SOURCE_TYPE, url: absoluteUrl(shard.file), attribution: o.attribution, minzoom: o.minzoom, maxzoom: o.srcMaxzoom } as any);
          added = true;
        }
        for (const l of o.build(shard, sid)) {
          if (!map.getLayer(l.id)) map.addLayer(l.layer(), l.before?.(map));
          map.setLayoutProperty(l.id, "visibility", "visible");
          l.update(map);
        }
        if (added) keepLoadingUntilMapIdle(map, `${sid}:render`, o.loading, sid);
      }
    };

    sync();
    map.on("moveend", sync);
    map.on("style.load", sync);
    return () => {
      map.off("moveend", sync);
      map.off("style.load", sync);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapRef, o.visible, o.shards, mapTick, ...deps]);
}

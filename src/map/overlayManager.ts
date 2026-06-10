import type { Map as MapboxMap } from "mapbox-gl";
import type { OverlayConfig, LayerVisibility } from "../types";
import {
  diffPaint,
  snapshotPaint,
  paintSnapshotEquals,
  type SerializedPaint,
} from "./overlayPaintDiff";

function layerId(config: OverlayConfig, suffix: string) {
  return `${config.sourceId}-${suffix}`;
}

// 每個 map instance 一份「上次套用的 paint 快照」（layer id → serialized paint）。
// style 切換時 layer 會被清掉重建，addOverlay 會重設對應快照，所以不會殘留髒值。
const paintCacheByMap = new WeakMap<MapboxMap, Map<string, SerializedPaint>>();

function paintCacheOf(map: MapboxMap): Map<string, SerializedPaint> {
  let cache = paintCacheByMap.get(map);
  if (!cache) {
    cache = new Map();
    paintCacheByMap.set(map, cache);
  }
  return cache;
}

/**
 * GeoJSON source 效能參數。
 * - tolerance：Douglas-Peucker 簡化容差（tile px）。預設 0.375 幾乎不簡化；
 *   1.2px 誤差在任何 zoom 下肉眼不可見，但 line/polygon 頂點數可降數倍。
 * - buffer：tile 邊緣緩衝（px）。預設 128 對純 line/fill 過大；64 已足夠
 *   line join 連續。有 circle/symbol 的 source 維持 128，避免大半徑點在
 *   tile 邊緣被裁切。
 */
export function geojsonSourceOptions(config: OverlayConfig): {
  tolerance: number;
  buffer: number;
} {
  const hasPointLayers = config.layers.some((s) => s.type === "circle");
  return {
    tolerance: 1.2,
    buffer: hasPointLayers ? 128 : 64,
  };
}

/** 新增單一 overlay（source + 所有 layers） */
export function addOverlay(
  map: MapboxMap,
  config: OverlayConfig,
  isDark: boolean,
  params?: Record<string, number>,
) {
  if (!map.getSource(config.sourceId)) {
    map.addSource(config.sourceId, {
      type: "geojson",
      data: config.sourceUrl,
      ...geojsonSourceOptions(config),
    });
  }

  const cache = paintCacheOf(map);
  for (const spec of config.layers) {
    const id = layerId(config, spec.suffix);
    if (map.getLayer(id)) continue;

    const paint = spec.paint(isDark, params);
    map.addLayer({
      id,
      type: spec.type as "line",  // TS union trick
      source: config.sourceId,
      ...(spec.layout ? { layout: spec.layout } : {}),
      ...(spec.minzoom != null ? { minzoom: spec.minzoom } : {}),
      ...(config.filter ? { filter: config.filter } : {}),
      paint: paint as Record<string, unknown>,
    } as mapboxgl.AnyLayer);
    cache.set(id, snapshotPaint(paint));
  }
}

/** 更新單一 overlay 主題（深淺色 + params）— diff 式，只動真正改變的 paint key */
export function updateOverlayTheme(
  map: MapboxMap,
  config: OverlayConfig,
  isDark: boolean,
  params?: Record<string, number>,
) {
  if (!map.getSource(config.sourceId)) return;

  const cache = paintCacheOf(map);

  // 需要 rebuild 的 layers（如 station points 的 circle-radius）
  if (config.rebuildOnParamChange) {
    // 先比對 paint 是否真的變了；沒變就完全不 rebuild（避免 slider 拖動時整層重建）
    let needRebuild = false;
    const nextSnapshots = new Map<string, SerializedPaint>();
    for (const spec of config.layers) {
      if (!config.rebuildOnParamChange.includes(spec.suffix)) continue;
      const id = layerId(config, spec.suffix);
      const snapshot = snapshotPaint(spec.paint(isDark, params));
      nextSnapshots.set(id, snapshot);
      if (!map.getLayer(id) || !paintSnapshotEquals(cache.get(id), snapshot)) {
        needRebuild = true;
      }
    }

    if (needRebuild) {
      // 記住目前 visibility 狀態
      let wasHidden = false;
      for (const suffix of config.rebuildOnParamChange) {
        const id = layerId(config, suffix);
        if (map.getLayer(id)) {
          if (map.getLayoutProperty(id, "visibility") === "none") wasHidden = true;
          map.removeLayer(id);
        }
      }
      for (const spec of config.layers) {
        if (!config.rebuildOnParamChange.includes(spec.suffix)) continue;
        const id = layerId(config, spec.suffix);
        if (map.getLayer(id)) continue;
        const paint = spec.paint(isDark, params);
        map.addLayer({
          id,
          type: spec.type as "line",
          source: config.sourceId,
          ...(spec.layout ? { layout: spec.layout } : {}),
          ...(spec.minzoom != null ? { minzoom: spec.minzoom } : {}),
          ...(config.filter ? { filter: config.filter } : {}),
          paint: paint as Record<string, unknown>,
        } as mapboxgl.AnyLayer);
        cache.set(id, nextSnapshots.get(id) ?? snapshotPaint(paint));
      }
      // 還原 visibility 狀態
      if (wasHidden) {
        for (const suffix of config.rebuildOnParamChange) {
          const id = layerId(config, suffix);
          if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", "none");
        }
      }
    }

    // 非 rebuild layers 仍走 diff 式 setPaintProperty
    for (const spec of config.layers) {
      if (config.rebuildOnParamChange.includes(spec.suffix)) continue;
      applyPaintDiff(map, cache, layerId(config, spec.suffix), spec.paint(isDark, params));
    }
    return;
  }

  // 一般 layers: diff 式 setPaintProperty
  for (const spec of config.layers) {
    applyPaintDiff(map, cache, layerId(config, spec.suffix), spec.paint(isDark, params));
  }
}

function applyPaintDiff(
  map: MapboxMap,
  cache: Map<string, SerializedPaint>,
  id: string,
  paint: Record<string, unknown>,
) {
  if (!map.getLayer(id)) return;
  const { changed, serialized } = diffPaint(cache.get(id), paint);
  // 無快照（理論上 addOverlay 都會建立）→ 保守全套用
  for (const [key, value] of changed) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    map.setPaintProperty(id, key as any, value);
  }
  cache.set(id, serialized);
}

/** 設定單一 overlay 可見性 */
export function setOverlayVisible(
  map: MapboxMap,
  config: OverlayConfig,
  visible: boolean,
) {
  const v = visible ? "visible" : "none";
  for (const spec of config.layers) {
    const id = layerId(config, spec.suffix);
    if (map.getLayer(id)) {
      map.setLayoutProperty(id, "visibility", v);
    }
  }
}

/** 批量新增所有 overlays + 設定初始可見性 */
export function addAllOverlays(
  map: MapboxMap,
  registry: OverlayConfig[],
  isDark: boolean,
  visibility: LayerVisibility,
  params?: Record<string, number>,
) {
  for (const config of registry) {
    addOverlay(map, config, isDark, params);
    if (!visibility[config.id]) {
      setOverlayVisible(map, config, false);
    }
  }
}

/** 批量更新所有 overlay 主題 */
export function updateAllOverlayThemes(
  map: MapboxMap,
  registry: OverlayConfig[],
  isDark: boolean,
  params?: Record<string, number>,
) {
  for (const config of registry) {
    updateOverlayTheme(map, config, isDark, params);
  }
}

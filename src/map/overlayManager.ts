import type { Map as MapboxMap } from "mapbox-gl";
import type { OverlayConfig, LayerVisibility } from "../types";

function layerId(config: OverlayConfig, suffix: string) {
  return `${config.sourceId}-${suffix}`;
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
    });
  }

  for (const spec of config.layers) {
    const id = layerId(config, spec.suffix);
    if (map.getLayer(id)) continue;

    map.addLayer({
      id,
      type: spec.type as "line",  // TS union trick
      source: config.sourceId,
      ...(spec.layout ? { layout: spec.layout } : {}),
      ...(spec.minzoom != null ? { minzoom: spec.minzoom } : {}),
      ...(config.filter ? { filter: config.filter } : {}),
      paint: spec.paint(isDark, params) as Record<string, unknown>,
    } as mapboxgl.AnyLayer);
  }
}

/** 更新單一 overlay 主題（深淺色 + params） */
export function updateOverlayTheme(
  map: MapboxMap,
  config: OverlayConfig,
  isDark: boolean,
  params?: Record<string, number>,
) {
  if (!map.getSource(config.sourceId)) return;

  // 需要 rebuild 的 layers（如 station points 的 circle-radius）
  if (config.rebuildOnParamChange) {
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
      map.addLayer({
        id,
        type: spec.type as "line",
        source: config.sourceId,
        ...(spec.layout ? { layout: spec.layout } : {}),
        ...(spec.minzoom != null ? { minzoom: spec.minzoom } : {}),
        ...(config.filter ? { filter: config.filter } : {}),
        paint: spec.paint(isDark, params) as Record<string, unknown>,
      } as mapboxgl.AnyLayer);
    }
    // 還原 visibility 狀態
    if (wasHidden) {
      for (const suffix of config.rebuildOnParamChange) {
        const id = layerId(config, suffix);
        if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", "none");
      }
    }
    // 非 rebuild layers 仍需 setPaintProperty
    for (const spec of config.layers) {
      if (config.rebuildOnParamChange.includes(spec.suffix)) continue;
      const id = layerId(config, spec.suffix);
      if (!map.getLayer(id)) continue;
      const paint = spec.paint(isDark, params);
      for (const [key, value] of Object.entries(paint)) {
        map.setPaintProperty(id, key, value);
      }
    }
    return;
  }

  // 一般 layers: setPaintProperty loop
  for (const spec of config.layers) {
    const id = layerId(config, spec.suffix);
    if (!map.getLayer(id)) continue;
    const paint = spec.paint(isDark, params);
    for (const [key, value] of Object.entries(paint)) {
      map.setPaintProperty(id, key, value);
    }
  }
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

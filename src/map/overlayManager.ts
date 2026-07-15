import type { Map as MapboxMap } from "mapbox-gl";
import type { OverlayConfig, LayerVisibility } from "../types";
import {
  diffPaint,
  snapshotPaint,
  paintSnapshotEquals,
  type SerializedPaint,
} from "./overlayPaintDiff";
import { PMTILES_SOURCE_TYPE } from "./pmtilesConstants";
import { loadingRegistry } from "../lib/loadingRegistry";
import { LAYER_LABELS } from "../components/sidebar/layerCatalog";

function layerId(config: OverlayConfig, suffix: string) {
  return `${config.sourceId}-${suffix}`;
}

/**
 * 解出 spec.filter 的當下值：函式形式（buildingsGba 高度門檻篩選首用）要餵目前 params 求值，
 * 純陣列形式直接回傳。filter 不像 paint 有 setFilter 式 diff API 可用 → 只能靠
 * rebuildOnParamChange 整層 remove/addLayer 帶新值重建（見 updateOverlayTheme）。
 */
function resolveFilter(
  spec: OverlayConfig["layers"][number],
  params?: Record<string, number>,
): unknown[] | undefined {
  return typeof spec.filter === "function" ? spec.filter(params) : spec.filter;
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
    if (config.pmtiles) {
      // PMTiles 向量切片：呼叫端（MapView）須先 registerPmtilesSourceTypeOnce()
      map.addSource(config.sourceId, {
        type: PMTILES_SOURCE_TYPE,
        url: config.sourceUrl,
        minzoom: config.pmtiles.minzoom,
        maxzoom: config.pmtiles.maxzoom,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
    } else {
      // 全部用空 FC 起手，避免 mount 時 Mapbox 自動 fetch sourceUrl。
      // 靜態 GeoJSON 改由 hydrateOverlayIfNeeded（toggle on 觸發）setData。
      // dynamicData：由對應 loader/hook 按日 setData 餵入。
      map.addSource(config.sourceId, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] } as GeoJSON.FeatureCollection,
        ...geojsonSourceOptions(config),
      });
    }
  }

  const cache = paintCacheOf(map);
  for (const spec of config.layers) {
    const id = layerId(config, spec.suffix);
    if (map.getLayer(id)) continue;

    const paint = spec.paint(isDark, params);
    const filter = resolveFilter(spec, params);
    map.addLayer({
      id,
      type: spec.type as "line",  // TS union trick
      source: config.sourceId,
      // raster PMTiles 無 sourceLayer（raster layer 不允許 source-layer 屬性）
      ...(config.pmtiles?.sourceLayer ? { "source-layer": config.pmtiles.sourceLayer } : {}),
      ...(spec.layout
          ? { layout: typeof spec.layout === "function" ? spec.layout(isDark, params) : spec.layout }
          : {}),
      ...(spec.minzoom != null ? { minzoom: spec.minzoom } : {}),
      ...(filter ? { filter } : config.filter ? { filter: config.filter } : {}),
      paint: paint as Record<string, unknown>,
    } as mapboxgl.AnyLayer);
    // __filter 併入快照僅供 rebuild 變更偵測比對用，不會送進 mapbox（見下方 updateOverlayTheme）
    cache.set(id, snapshotPaint({ ...paint, ...(filter ? { __filter: filter } : {}) }));
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
      // 把 paint + (callback) layout + (函式) filter 一起 snapshot；三者任一變化都需 trigger rebuild
      // （filter 併入 __filter 合成 key 僅供比對，不是真的 mapbox paint property）
      const paintObj = spec.paint(isDark, params);
      const layoutObj = typeof spec.layout === "function" ? spec.layout(isDark, params) : (spec.layout ?? {});
      const filterObj = resolveFilter(spec, params);
      const snapshot = snapshotPaint({ ...paintObj, ...layoutObj, ...(filterObj ? { __filter: filterObj } : {}) });
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
        const layoutObj = typeof spec.layout === "function" ? spec.layout(isDark, params) : spec.layout;
        const filter = resolveFilter(spec, params);
        map.addLayer({
          id,
          type: spec.type as "line",
          source: config.sourceId,
          ...(config.pmtiles?.sourceLayer ? { "source-layer": config.pmtiles.sourceLayer } : {}),
          ...(layoutObj ? { layout: layoutObj } : {}),
          ...(spec.minzoom != null ? { minzoom: spec.minzoom } : {}),
          ...(filter ? { filter } : config.filter ? { filter: config.filter } : {}),
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
      if (typeof spec.layout === "function") {
        applyLayoutDiff(map, layerId(config, spec.suffix), spec.layout(isDark, params));
      }
    }
    return;
  }

  // 一般 layers: diff 式 setPaintProperty + callback layout 也 diff 更新
  for (const spec of config.layers) {
    applyPaintDiff(map, cache, layerId(config, spec.suffix), spec.paint(isDark, params));
    if (typeof spec.layout === "function") {
      applyLayoutDiff(map, layerId(config, spec.suffix), spec.layout(isDark, params));
    }
  }
}

const layoutCacheByMap = new WeakMap<MapboxMap, Map<string, Record<string, string>>>();
function layoutCacheOf(map: MapboxMap): Map<string, Record<string, string>> {
  let cache = layoutCacheByMap.get(map);
  if (!cache) {
    cache = new Map();
    layoutCacheByMap.set(map, cache);
  }
  return cache;
}

function applyLayoutDiff(
  map: MapboxMap,
  id: string,
  layout: Record<string, unknown>,
) {
  if (!map.getLayer(id)) return;
  const cache = layoutCacheOf(map);
  const prev = cache.get(id) ?? {};
  const next: Record<string, string> = {};
  for (const [k, v] of Object.entries(layout)) {
    const s = JSON.stringify(v) ?? "__undefined__";
    next[k] = s;
    if (prev[k] !== s) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        map.setLayoutProperty(id, k as any, v as any);
      } catch (e) {
        console.warn(`[overlayManager] setLayoutProperty ${id}/${k} failed`, e);
      }
    }
  }
  cache.set(id, next);
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

// ── Static GeoJSON lazy hydration ──
// 全域單例：紀錄哪些 sourceId 已經 hydrate（fetch + setData）過，避免重抓。
// key 用 sourceId（不是 config.id），自然處理「多個 overlay 共用同一 sourceUrl」。
const hydratedSources = new Set<string>();

/**
 * 若 config 是靜態 GeoJSON 且尚未 hydrate → fetch sourceUrl + setData。
 * dynamicData / pmtiles 配置直接 no-op（pmtiles 由 Mapbox 自動 lazy load tile，
 * dynamicData 由各自 loader 負責）。
 *
 * 設計：
 * - 失敗時清掉 set 讓下次 toggle 可重試
 * - 先標記 hydrated 防同一 toggle 內重複觸發 race
 */
export async function hydrateOverlayIfNeeded(
  map: MapboxMap,
  config: OverlayConfig,
): Promise<void> {
  if (config.pmtiles || config.dynamicData) return;
  if (hydratedSources.has(config.sourceId)) return;
  hydratedSources.add(config.sourceId);
  const taskId = `overlay-hydrate:${config.sourceId}`;
  const label = LAYER_LABELS[config.id] ?? config.sourceId;
  loadingRegistry.start(taskId, label);
  try {
    const res = await fetch(config.sourceUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = (await res.json()) as GeoJSON.FeatureCollection;
    const src = map.getSource(config.sourceId);
    if (src && "setData" in src) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (src as any).setData(json);
    }
  } catch (e) {
    hydratedSources.delete(config.sourceId);
    console.warn(`[overlay] hydrate ${config.sourceId} failed:`, e);
  } finally {
    loadingRegistry.end(taskId);
  }
}

/** 底圖切換（style.load）後 overlay source 會被 Mapbox 重建為空 FC → 清 hydrate 記錄，
 *  讓可見的靜態 GeoJSON 圖層可重新 fetch + setData（否則切底圖後圖層變空白）。 */
export function resetOverlayHydration(): void {
  hydratedSources.clear();
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

/**
 * 垃圾清運 Mapbox circle 圖層管理（量級大的 8 種子類型）。
 *
 * 為什麼用 Mapbox 原生 circle 而不是 Three.js：
 *   - 量級大（recycling 653 / monitoring 574 / other 3,164 / disposal 13,751…）
 *   - 不需要 3D 戲劇感（焚化爐/掩埋場/轉運站/醫療用 Three.js scene 處理）
 *   - Mapbox 原生 circle event 處理 click 比 Three.js picking 快又穩
 *
 * 8 個 sub-layer：
 *   facility:  wfRecycling / wfMonitoring / wfScrapYard / wfOther
 *   disposal:  wdClothes / wdMixed / wdRecyclingContainer / wdBattery
 *
 * Z 軸 slider 對 Mapbox circle 為偽 3D（circle-translate Y 像素偏移），
 * 真正的 3D altitude 只對 Three.js scene 有效。
 */

import type { Map as MapboxMap, GeoJSONSource, MapLayerMouseEvent } from "mapbox-gl";
import type { FeatureInfo, LayerVisibility } from "../types";
import {
  WASTE_FACILITY_COLORS,
  WASTE_DISPOSAL_COLORS,
  type WasteFacilityRow,
  type WasteDisposalPointRow,
} from "../data/wasteLoader";

export type WasteMapboxLayerKey =
  | "wfRecycling" | "wfMonitoring" | "wfScrapYard" | "wfOther"
  | "wdClothes" | "wdMixed" | "wdRecyclingContainer" | "wdBattery";

/** sub-toggle key → facility_type 過濾 */
const FACILITY_TYPES_BY_KEY: Record<string, string[]> = {
  wfRecycling: ["recycling_plant"],
  wfMonitoring: ["monitoring_well"],
  wfScrapYard: ["scrap_yard"],
  wfOther: ["other", "food_waste_processing", "repair_shop"],
};

/** sub-toggle key → point_type 過濾 */
const DISPOSAL_TYPES_BY_KEY: Record<string, string[]> = {
  wdClothes: ["clothes_box"],
  wdMixed: ["mixed", "community_station", "food_waste_dropoff", "huge_waste_dropoff"],
  wdRecyclingContainer: ["recycling_container"],
  wdBattery: ["battery"],
};

/** 每個 layer 的預設 base 半徑（zoom 中段） */
const BASE_RADII: Record<WasteMapboxLayerKey, number> = {
  wfRecycling: 4,
  wfMonitoring: 3.5,
  wfScrapYard: 6,
  wfOther: 3,
  wdClothes: 3,
  wdMixed: 3,
  wdRecyclingContainer: 3.5,
  wdBattery: 5,
};

/** 各 layer 的代表顏色（fallback；點選 source feature property 也有 color 欄） */
const LAYER_COLOR: Record<WasteMapboxLayerKey, string> = {
  wfRecycling: WASTE_FACILITY_COLORS.recycling_plant!,
  wfMonitoring: WASTE_FACILITY_COLORS.monitoring_well!,
  wfScrapYard: WASTE_FACILITY_COLORS.scrap_yard!,
  wfOther: WASTE_FACILITY_COLORS.other!,
  wdClothes: WASTE_DISPOSAL_COLORS.clothes_box!,
  wdMixed: WASTE_DISPOSAL_COLORS.mixed!,
  wdRecyclingContainer: WASTE_DISPOSAL_COLORS.recycling_container!,
  wdBattery: WASTE_DISPOSAL_COLORS.battery!,
};

const ALL_KEYS: WasteMapboxLayerKey[] = [
  "wfRecycling", "wfMonitoring", "wfScrapYard", "wfOther",
  "wdClothes", "wdMixed", "wdRecyclingContainer", "wdBattery",
];

/** Mapbox source / layer ids */
const sourceId = (k: WasteMapboxLayerKey) => `waste-${k}-src`;
const glowLayerId = (k: WasteMapboxLayerKey) => `waste-${k}-glow`;
const coreLayerId = (k: WasteMapboxLayerKey) => `waste-${k}-core`;

const EMPTY_FC: GeoJSON.FeatureCollection = {
  type: "FeatureCollection",
  features: [],
};

/** facility / disposal 通用：dataset id → "facility" or "disposal"（給 popup 用） */
function isFacilityKey(k: WasteMapboxLayerKey): boolean {
  return k.startsWith("wf");
}

function rowsToFeatures(
  k: WasteMapboxLayerKey,
  facilityRows: Map<string, WasteFacilityRow[]>,
  disposalRows: Map<string, WasteDisposalPointRow[]>,
): GeoJSON.Feature[] {
  const features: GeoJSON.Feature[] = [];
  if (isFacilityKey(k)) {
    const types = FACILITY_TYPES_BY_KEY[k] ?? [];
    for (const t of types) {
      const arr = facilityRows.get(t);
      if (!arr) continue;
      for (const r of arr) {
        if (!Number.isFinite(r.lng) || !Number.isFinite(r.lat)) continue;
        features.push({
          type: "Feature",
          geometry: { type: "Point", coordinates: [r.lng, r.lat] },
          properties: {
            kind: "facility",
            id: r.id,
            facility_name: r.facility_name,
            facility_type: r.facility_type,
            city: r.city,
            operator: r.operator,
            address: r.address,
            capacity_tpd: r.capacity_tpd,
            status: r.status,
            start_year: r.start_year,
            source_url: r.source_url,
          },
        });
      }
    }
  } else {
    const types = DISPOSAL_TYPES_BY_KEY[k] ?? [];
    for (const t of types) {
      const arr = disposalRows.get(t);
      if (!arr) continue;
      for (const r of arr) {
        if (!Number.isFinite(r.lng) || !Number.isFinite(r.lat)) continue;
        features.push({
          type: "Feature",
          geometry: { type: "Point", coordinates: [r.lng, r.lat] },
          properties: {
            kind: "disposal",
            id: r.id,
            point_name: r.point_name,
            point_type: r.point_type,
            city: r.city,
            district: r.district,
            address: r.address,
            operator: r.operator,
            accepts_categories: r.accepts_categories,
            source: r.source,
            source_url: r.source_url,
          },
        });
      }
    }
  }
  return features;
}

export interface WasteMapboxOptions {
  isDark: boolean;
  /** click → 顯示 FeatureInfoPanel */
  onFeatureClick: (info: FeatureInfo) => void;
}

/**
 * 已綁定的 layer-specific event handler 記錄（以 coreLayerId 為 key）。
 * 用來在 setup 重綁前先 `map.off` 成對移除，避免 listener 累加（記憶體洩漏 + 一次點擊觸發多個 popup）。
 * source/layer 用 `getLayer` 守門避免重複新增，listener 也比照辦理做冪等綁定。
 */
type WasteLayerHandlers = {
  click: (e: MapLayerMouseEvent) => void;
  mouseenter: () => void;
  mouseleave: () => void;
};
const boundHandlers = new Map<string, WasteLayerHandlers>();

/** 解綁某 layer 既有的 click / mouseenter / mouseleave handler（若有） */
function offWasteLayerHandlers(map: MapboxMap, layerId: string) {
  const h = boundHandlers.get(layerId);
  if (!h) return;
  map.off("click", layerId, h.click);
  map.off("mouseenter", layerId, h.mouseenter);
  map.off("mouseleave", layerId, h.mouseleave);
  boundHandlers.delete(layerId);
}

/**
 * 在 map load 後呼叫一次：建立 8 個 source + 16 個 layer（每個 sub-key 有 glow + core 兩條），
 * 預設 visibility = none，並掛 click handler。
 */
export function setupWasteMapboxLayers(
  map: MapboxMap,
  opts: WasteMapboxOptions,
) {
  for (const k of ALL_KEYS) {
    if (!map.getSource(sourceId(k))) {
      map.addSource(sourceId(k), { type: "geojson", data: EMPTY_FC });
    }
    const color = LAYER_COLOR[k];
    const baseR = BASE_RADII[k];
    if (!map.getLayer(glowLayerId(k))) {
      map.addLayer({
        id: glowLayerId(k),
        type: "circle",
        source: sourceId(k),
        layout: { visibility: "none" },
        paint: {
          "circle-radius": [
            "interpolate", ["linear"], ["zoom"],
            6, baseR * 0.8, 10, baseR * 1.6, 14, baseR * 3, 17, baseR * 5,
          ],
          "circle-color": color,
          "circle-blur": 1,
          "circle-opacity": opts.isDark ? 0.18 : 0.22,
        },
      });
    }
    if (!map.getLayer(coreLayerId(k))) {
      map.addLayer({
        id: coreLayerId(k),
        type: "circle",
        source: sourceId(k),
        layout: { visibility: "none" },
        paint: {
          "circle-radius": [
            "interpolate", ["linear"], ["zoom"],
            6, baseR * 0.4, 10, baseR * 0.8, 14, baseR * 1.5, 17, baseR * 2.4,
          ],
          "circle-color": color,
          "circle-stroke-color": opts.isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.35)",
          "circle-stroke-width": [
            "interpolate", ["linear"], ["zoom"],
            6, 0, 10, 0.4, 14, 0.7,
          ],
          "circle-opacity": opts.isDark ? 0.85 : 0.75,
        },
      });
    }

    // click → popup（listener 冪等綁定：先 off 既有 handler 再 on，避免重複呼叫 setup 時累加）
    const coreId = coreLayerId(k);
    offWasteLayerHandlers(map, coreId);
    const handlers: WasteLayerHandlers = {
      click: (e) => {
        const feat = e.features?.[0];
        if (!feat) return;
        const props = feat.properties ?? {};
        // accepts_categories 從 GeoJSON properties 拿到的會是字串化陣列，要解
        let accepts = props["accepts_categories"];
        if (typeof accepts === "string") {
          try { accepts = JSON.parse(accepts); } catch { /* keep as string */ }
        }
        opts.onFeatureClick({
          layerType: props["kind"] === "facility" ? "wasteFacility" : "wasteDisposalPoint",
          properties: { ...props, accepts_categories: accepts },
        });
      },
      mouseenter: () => {
        map.getCanvas().style.cursor = "pointer";
      },
      mouseleave: () => {
        map.getCanvas().style.cursor = "";
      },
    };
    map.on("click", coreId, handlers.click);
    map.on("mouseenter", coreId, handlers.mouseenter);
    map.on("mouseleave", coreId, handlers.mouseleave);
    boundHandlers.set(coreId, handlers);
  }
}

/**
 * teardown：移除 8 個 source + 16 個 layer，並成對解綁 click / mouseenter / mouseleave listener。
 * 對 source/layer 用 `getLayer` / `getSource` 守門，listener 透過 boundHandlers 成對 `map.off`。
 */
export function removeWasteMapboxLayers(map: MapboxMap) {
  for (const k of ALL_KEYS) {
    offWasteLayerHandlers(map, coreLayerId(k));
    if (map.getLayer(coreLayerId(k))) map.removeLayer(coreLayerId(k));
    if (map.getLayer(glowLayerId(k))) map.removeLayer(glowLayerId(k));
    if (map.getSource(sourceId(k))) map.removeSource(sourceId(k));
  }
}

/** 同步 GeoJSON data（rows 變更時呼叫）— 8 sub-key 一起更新 */
export function syncWasteMapboxData(
  map: MapboxMap,
  facilityByType: Map<string, WasteFacilityRow[]>,
  disposalByType: Map<string, WasteDisposalPointRow[]>,
) {
  for (const k of ALL_KEYS) {
    const src = map.getSource(sourceId(k)) as GeoJSONSource | undefined;
    if (!src) continue;
    const features = rowsToFeatures(k, facilityByType, disposalByType);
    src.setData({ type: "FeatureCollection", features });
  }
}

/** 同步 visibility — 依 LayerVisibility 8 個 sub-key 顯示 / 隱藏 */
export function syncWasteMapboxVisibility(map: MapboxMap, vis: LayerVisibility) {
  for (const k of ALL_KEYS) {
    const visible = !!vis[k as keyof LayerVisibility];
    const v = visible ? "visible" : "none";
    if (map.getLayer(glowLayerId(k))) map.setLayoutProperty(glowLayerId(k), "visibility", v);
    if (map.getLayer(coreLayerId(k))) map.setLayoutProperty(coreLayerId(k), "visibility", v);
  }
}

/** 套 size / opacity / altitude（Mapbox circle 的 altitude 用 circle-translate Y 偽 3D） */
export function syncWasteMapboxParams(
  map: MapboxMap,
  params: Partial<Record<string, { size: number; opacity: number; altitude: number }>>,
) {
  for (const k of ALL_KEYS) {
    const p = params[k];
    if (!p) continue;
    const baseR = BASE_RADII[k];
    const sizeMul = p.size; // 0.5 ~ 3
    const opacity = p.opacity; // 0.2 ~ 1
    const altitudePx = -Math.max(0, p.altitude) * 0.4; // alt(0~500) → translate Y(0~-200)px
    if (map.getLayer(glowLayerId(k))) {
      map.setPaintProperty(glowLayerId(k), "circle-radius", [
        "interpolate", ["linear"], ["zoom"],
        6, baseR * 0.8 * sizeMul, 10, baseR * 1.6 * sizeMul,
        14, baseR * 3 * sizeMul, 17, baseR * 5 * sizeMul,
      ]);
      map.setPaintProperty(glowLayerId(k), "circle-opacity", 0.22 * opacity);
      map.setPaintProperty(glowLayerId(k), "circle-translate", [0, altitudePx]);
    }
    if (map.getLayer(coreLayerId(k))) {
      map.setPaintProperty(coreLayerId(k), "circle-radius", [
        "interpolate", ["linear"], ["zoom"],
        6, baseR * 0.4 * sizeMul, 10, baseR * 0.8 * sizeMul,
        14, baseR * 1.5 * sizeMul, 17, baseR * 2.4 * sizeMul,
      ]);
      map.setPaintProperty(coreLayerId(k), "circle-opacity", 0.85 * opacity);
      map.setPaintProperty(coreLayerId(k), "circle-translate", [0, altitudePx]);
    }
  }
}

/** 切換 dark / light 樣式 */
export function syncWasteMapboxTheme(map: MapboxMap, isDark: boolean) {
  for (const k of ALL_KEYS) {
    if (map.getLayer(coreLayerId(k))) {
      map.setPaintProperty(
        coreLayerId(k),
        "circle-stroke-color",
        isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.35)",
      );
    }
  }
}

export const WASTE_MAPBOX_KEYS = ALL_KEYS;

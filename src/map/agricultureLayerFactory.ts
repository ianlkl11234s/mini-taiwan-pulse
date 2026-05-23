// Agriculture 圖層 factory
//
// FTW Fields 2025 (38.6 萬田區) + Agriculture Phase 3 Batch 1 (5 PMTiles + 1 GeoJSON POI)
// 來源：taipei-gis-analytics/data/processed/agriculture/
// 部署：public/agriculture/*.pmtiles | *.geojson  (HTTP Range Request for PMTiles)

import mapboxgl from "mapbox-gl";
import type { Map as MapboxMap } from "mapbox-gl";
import { agriPOIMatchColorExpr } from "../data/agriPOITypes";
// mapbox-pmtiles 套件的 package.json "main" 直接指 src/*.ts，會牽動 TS 編譯
// 套件原始檔；改 import dist/ 的 ESM build 並局部宣告型別繞過。
// @ts-expect-error 套件未提供 ESM build 的型別宣告
import { PmTilesSource } from "mapbox-pmtiles/dist/mapbox-pmtiles.js";

interface PmTilesSourceCtor {
  SOURCE_TYPE: string;
}
const PmTilesSourceTyped = PmTilesSource as unknown as PmTilesSourceCtor;

// 一次性註冊 PMTiles SourceType 到 mapbox-gl（所有 PMTiles 圖層共用）
let sourceTypeRegistered = false;
function registerSourceTypeOnce(): void {
  if (sourceTypeRegistered) return;
  const Style = (mapboxgl as unknown as {
    Style: { setSourceType: (type: string, impl: unknown) => void };
  }).Style;
  Style.setSourceType(PmTilesSourceTyped.SOURCE_TYPE, PmTilesSource);
  sourceTypeRegistered = true;
}

const BASE = `${import.meta.env.BASE_URL ?? "/"}agriculture`;

function addPmtilesSourceIfMissing(
  map: MapboxMap,
  sourceId: string,
  fileName: string,
  minzoom: number,
  maxzoom: number,
): void {
  if (map.getSource(sourceId)) return;
  map.addSource(sourceId, {
    type: PmTilesSourceTyped.SOURCE_TYPE,
    url: `${BASE}/${fileName}`,
    minzoom,
    maxzoom,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
}

// =============================================================================
// 1. FTW Fields 2025 — 38.6 萬田區範圍 (既有)
// =============================================================================

const FTW_SOURCE_ID = "agri-ftw-fields";
const FTW_SOURCE_LAYER = "fields";
const FTW_FILL_ID = "agri-ftw-fields-fill";
const FTW_OUTLINE_ID = "agri-ftw-fields-outline";

export interface AgricultureParams {
  /** Fill opacity 倍率 (0~1) — 乘進原本的 confidence-based 透明度 */
  opacity: number;
  /** Outline 線寬倍率 (0~5) — 乘進原本的 zoom-based 寬度 */
  outlineWidth: number;
  /** 是否顯示 outline */
  showOutline: boolean;
  /** Z offset (px) — fill 沿 screen Y 方向上推像素，給 3D 視角下強調田區用 */
  z: number;
}

export const AGRICULTURE_PARAMS_DEFAULT: AgricultureParams = {
  opacity: 1,
  outlineWidth: 1,
  showOutline: true,
  z: 0,
};

export function ensureAgricultureLayers(map: MapboxMap): void {
  registerSourceTypeOnce();
  addPmtilesSourceIfMissing(map, FTW_SOURCE_ID, "ftw_fields_2025.pmtiles", 5, 14);

  if (!map.getLayer(FTW_FILL_ID)) {
    map.addLayer({
      id: FTW_FILL_ID,
      type: "fill",
      source: FTW_SOURCE_ID,
      "source-layer": FTW_SOURCE_LAYER,
      minzoom: 5,
      layout: { visibility: "none" },
      paint: {
        "fill-color": "#2e7d32",
        "fill-opacity": [
          "interpolate", ["linear"],
          ["coalesce", ["get", "confidence_mean"], 0.5],
          0.5, 0.18,
          0.6, 0.42,
        ],
        "fill-outline-color": "rgba(46, 125, 50, 0.6)",
      },
    });
  }

  if (!map.getLayer(FTW_OUTLINE_ID)) {
    map.addLayer({
      id: FTW_OUTLINE_ID,
      type: "line",
      source: FTW_SOURCE_ID,
      "source-layer": FTW_SOURCE_LAYER,
      minzoom: 10,
      layout: { visibility: "none" },
      paint: {
        "line-color": "#1b5e20",
        "line-width": [
          "interpolate", ["linear"], ["zoom"],
          10, 0.2,
          13, 0.6,
          16, 1.2,
        ],
        "line-opacity": 0.55,
      },
    });
  }
}

export function updateAgricultureLayer(
  map: MapboxMap,
  visible: boolean,
  params: AgricultureParams = AGRICULTURE_PARAMS_DEFAULT,
): void {
  if (map.getLayer(FTW_FILL_ID)) {
    map.setLayoutProperty(FTW_FILL_ID, "visibility", visible ? "visible" : "none");
    map.setPaintProperty(FTW_FILL_ID, "fill-opacity", [
      "*", params.opacity,
      [
        "interpolate", ["linear"],
        ["coalesce", ["get", "confidence_mean"], 0.5],
        0.5, 0.18,
        0.6, 0.42,
      ],
    ]);
    map.setPaintProperty(FTW_FILL_ID, "fill-translate", [0, -params.z]);
    map.setPaintProperty(FTW_FILL_ID, "fill-translate-anchor", "viewport");
  }
  if (map.getLayer(FTW_OUTLINE_ID)) {
    const showOutline = visible && params.showOutline;
    map.setLayoutProperty(FTW_OUTLINE_ID, "visibility", showOutline ? "visible" : "none");
    // ["zoom"] 不能被 ["*", ...] 包起來，倍率直接乘進 stops
    const w = params.outlineWidth;
    map.setPaintProperty(FTW_OUTLINE_ID, "line-width", [
      "interpolate", ["linear"], ["zoom"],
      10, 0.2 * w,
      13, 0.6 * w,
      16, 1.2 * w,
    ]);
  }
}

export function setAgricultureVisible(map: MapboxMap, visible: boolean): void {
  updateAgricultureLayer(map, visible, AGRICULTURE_PARAMS_DEFAULT);
}

// =============================================================================
// 通用 PMTiles polygon helper（簡單填色，無 outline 條件）
// =============================================================================

interface SimplePolyConfig {
  sourceId: string;
  fillId: string;
  fileName: string;
  sourceLayer: string;
  minzoom: number;
  maxzoom: number;
  fillColor: string | unknown[];
  defaultOpacity: number;
  outlineColor?: string;
}

export interface AgriPolyParams {
  /** Layer master opacity 倍率 (0~1) — 乘以該 layer 的預設 opacity */
  opacity: number;
}

export const AGRI_POLY_PARAMS_DEFAULT: AgriPolyParams = { opacity: 1 };

function ensureSimplePolyLayer(map: MapboxMap, cfg: SimplePolyConfig): void {
  registerSourceTypeOnce();
  addPmtilesSourceIfMissing(map, cfg.sourceId, cfg.fileName, cfg.minzoom, cfg.maxzoom);

  if (!map.getLayer(cfg.fillId)) {
    map.addLayer({
      id: cfg.fillId,
      type: "fill",
      source: cfg.sourceId,
      "source-layer": cfg.sourceLayer,
      minzoom: cfg.minzoom,
      layout: { visibility: "none" },
      paint: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        "fill-color": cfg.fillColor as any,
        "fill-opacity": cfg.defaultOpacity,
        ...(cfg.outlineColor ? { "fill-outline-color": cfg.outlineColor } : {}),
      },
    });
  }
}

function updateSimplePolyLayer(
  map: MapboxMap,
  fillId: string,
  visible: boolean,
  baseOpacity: number,
  params: AgriPolyParams,
): void {
  if (!map.getLayer(fillId)) return;
  map.setLayoutProperty(fillId, "visibility", visible ? "visible" : "none");
  map.setPaintProperty(fillId, "fill-opacity", baseOpacity * params.opacity);
}

// =============================================================================
// 2. 全台土壤分類 (25539) — 5.7 萬 polygon
// =============================================================================

const SOIL_SOURCE_ID = "agri-soil";
const SOIL_FILL_ID = "agri-soil-fill";
const SOIL_BASE_OPACITY = 0.35;

export function ensureAgriSoilLayers(map: MapboxMap): void {
  ensureSimplePolyLayer(map, {
    sourceId: SOIL_SOURCE_ID,
    fillId: SOIL_FILL_ID,
    fileName: "soil_map_national.pmtiles",
    sourceLayer: "soil",
    minzoom: 6,
    maxzoom: 13,
    fillColor: "#8d6e63",
    defaultOpacity: SOIL_BASE_OPACITY,
    outlineColor: "#5d4037",
  });
}

export function updateAgriSoilLayer(
  map: MapboxMap,
  visible: boolean,
  params: AgriPolyParams = AGRI_POLY_PARAMS_DEFAULT,
): void {
  updateSimplePolyLayer(map, SOIL_FILL_ID, visible, SOIL_BASE_OPACITY, params);
}

// =============================================================================
// 3. 土壤肥力 250m 網格 (112848) — 13.5 萬網格
// =============================================================================

const SOIL_FERT_SOURCE_ID = "agri-soil-fertility";
const SOIL_FERT_FILL_ID = "agri-soil-fertility-fill";
const SOIL_FERT_BASE_OPACITY = 0.45;

export function ensureAgriSoilFertilityLayers(map: MapboxMap): void {
  ensureSimplePolyLayer(map, {
    sourceId: SOIL_FERT_SOURCE_ID,
    fillId: SOIL_FERT_FILL_ID,
    fileName: "soil_fertility_grid_250m.pmtiles",
    sourceLayer: "soil_fertility",
    minzoom: 8,
    maxzoom: 14,
    fillColor: "#00897b",
    defaultOpacity: SOIL_FERT_BASE_OPACITY,
  });
}

export function updateAgriSoilFertilityLayer(
  map: MapboxMap,
  visible: boolean,
  params: AgriPolyParams = AGRI_POLY_PARAMS_DEFAULT,
): void {
  updateSimplePolyLayer(map, SOIL_FERT_FILL_ID, visible, SOIL_FERT_BASE_OPACITY, params);
}

// =============================================================================
// 4. 休閒農業區 (9809) — 109 法定 polygon
// =============================================================================

const LEISURE_SOURCE_ID = "agri-leisure-farm-zones";
const LEISURE_FILL_ID = "agri-leisure-farm-zones-fill";
const LEISURE_BASE_OPACITY = 0.3;

export function ensureAgriLeisureFarmZonesLayers(map: MapboxMap): void {
  ensureSimplePolyLayer(map, {
    sourceId: LEISURE_SOURCE_ID,
    fillId: LEISURE_FILL_ID,
    fileName: "leisure_farm_zones_2025.pmtiles",
    sourceLayer: "leisure_farm_zones",
    minzoom: 6,
    maxzoom: 13,
    fillColor: "#66bb6a",
    defaultOpacity: LEISURE_BASE_OPACITY,
    outlineColor: "#2e7d32",
  });
}

export function updateAgriLeisureFarmZonesLayer(
  map: MapboxMap,
  visible: boolean,
  params: AgriPolyParams = AGRI_POLY_PARAMS_DEFAULT,
): void {
  updateSimplePolyLayer(map, LEISURE_FILL_ID, visible, LEISURE_BASE_OPACITY, params);
}

// =============================================================================
// 5. 農村再生社區 (176846) — 1,109 政策範圍
// =============================================================================

const RURAL_SOURCE_ID = "agri-rural-regen";
const RURAL_FILL_ID = "agri-rural-regen-fill";
const RURAL_BASE_OPACITY = 0.3;

export function ensureAgriRuralRegenLayers(map: MapboxMap): void {
  ensureSimplePolyLayer(map, {
    sourceId: RURAL_SOURCE_ID,
    fillId: RURAL_FILL_ID,
    fileName: "rural_regen_communities_2025.pmtiles",
    sourceLayer: "rural_regen_communities",
    minzoom: 7,
    maxzoom: 13,
    fillColor: "#ffb74d",
    defaultOpacity: RURAL_BASE_OPACITY,
  });
}

export function updateAgriRuralRegenLayer(
  map: MapboxMap,
  visible: boolean,
  params: AgriPolyParams = AGRI_POLY_PARAMS_DEFAULT,
): void {
  updateSimplePolyLayer(map, RURAL_FILL_ID, visible, RURAL_BASE_OPACITY, params);
}

// =============================================================================
// 6. 132 種作物適栽圖 (7294) — 83.3 萬 polygon，依 crop_layer_id filter
// =============================================================================

const CROP_SOURCE_ID = "agri-crop-suitability";
const CROP_FILL_ID = "agri-crop-suitability-fill";
const CROP_BASE_OPACITY = 0.45;

// Kind 4 級配色（依 handoff doc）：1_premium / 2_suitable / 3_marginal / 4_unsuitable
const CROP_KIND_COLOR_EXPR = [
  "match",
  ["get", "kind"],
  1, "#1b5e20",
  2, "#66bb6a",
  3, "#fff59d",
  4, "#ef9a9a",
  "#9e9e9e",
];

export interface AgriCropSuitabilityParams {
  /** opacity 倍率 (0~1) */
  opacity: number;
  /** 選中的作物 ID (0-131)；對應 crop_layer_id property */
  cropLayerId: number;
}

export const AGRI_CROP_SUITABILITY_PARAMS_DEFAULT: AgriCropSuitabilityParams = {
  opacity: 1,
  cropLayerId: 0,
};

export function ensureAgriCropSuitabilityLayers(map: MapboxMap): void {
  registerSourceTypeOnce();
  addPmtilesSourceIfMissing(map, CROP_SOURCE_ID, "crop_suitability_132.pmtiles", 6, 13);

  if (!map.getLayer(CROP_FILL_ID)) {
    map.addLayer({
      id: CROP_FILL_ID,
      type: "fill",
      source: CROP_SOURCE_ID,
      "source-layer": "crop_suitability",
      minzoom: 6,
      layout: { visibility: "none" },
      // 初始 filter — 第 0 號作物
      filter: ["==", ["get", "crop_layer_id"], 0],
      paint: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        "fill-color": CROP_KIND_COLOR_EXPR as any,
        "fill-opacity": CROP_BASE_OPACITY,
      },
    });
  }
}

export function updateAgriCropSuitabilityLayer(
  map: MapboxMap,
  visible: boolean,
  params: AgriCropSuitabilityParams = AGRI_CROP_SUITABILITY_PARAMS_DEFAULT,
): void {
  if (!map.getLayer(CROP_FILL_ID)) return;
  map.setLayoutProperty(CROP_FILL_ID, "visibility", visible ? "visible" : "none");
  map.setPaintProperty(CROP_FILL_ID, "fill-opacity", CROP_BASE_OPACITY * params.opacity);
  map.setFilter(CROP_FILL_ID, ["==", ["get", "crop_layer_id"], params.cropLayerId]);
}

// =============================================================================
// 7. 農業 POI 三合一 (177247+245+246) — 840 點，circle by poi_type
// =============================================================================

const POI_SOURCE_ID = "agri-pois";
const POI_CIRCLE_ID = "agri-pois-circle";

// 三類 POI 配色從 src/data/agriPOITypes.ts 衍生（單一資料源）
const POI_TYPE_COLOR_EXPR = agriPOIMatchColorExpr();

export interface AgriPOIParams {
  /** opacity (0~1) */
  opacity: number;
  /** radius 倍率 (0~3)，乘以 zoom-based interpolation */
  scale: number;
}

export const AGRI_POI_PARAMS_DEFAULT: AgriPOIParams = { opacity: 1, scale: 1 };

export function ensureAgriPOILayers(map: MapboxMap): void {
  if (!map.getSource(POI_SOURCE_ID)) {
    map.addSource(POI_SOURCE_ID, {
      type: "geojson",
      data: `${BASE}/agriculture_pois.geojson`,
    });
  }
  if (!map.getLayer(POI_CIRCLE_ID)) {
    map.addLayer({
      id: POI_CIRCLE_ID,
      type: "circle",
      source: POI_SOURCE_ID,
      layout: { visibility: "none" },
      paint: {
        "circle-radius": [
          "interpolate", ["linear"], ["zoom"],
          6, 3,
          14, 8,
        ],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        "circle-color": POI_TYPE_COLOR_EXPR as any,
        "circle-stroke-width": 1,
        "circle-stroke-color": "#ffffff",
        "circle-opacity": 0.9,
      },
    });
  }
}

export function updateAgriPOILayer(
  map: MapboxMap,
  visible: boolean,
  params: AgriPOIParams = AGRI_POI_PARAMS_DEFAULT,
): void {
  if (!map.getLayer(POI_CIRCLE_ID)) return;
  map.setLayoutProperty(POI_CIRCLE_ID, "visibility", visible ? "visible" : "none");
  map.setPaintProperty(POI_CIRCLE_ID, "circle-opacity", 0.9 * params.opacity);
  map.setPaintProperty(POI_CIRCLE_ID, "circle-radius", [
    "interpolate", ["linear"], ["zoom"],
    6, 3 * params.scale,
    14, 8 * params.scale,
  ]);
}

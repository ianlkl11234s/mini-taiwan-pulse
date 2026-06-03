// 醫療等時圈 + 醫療沙漠圖層 factory（PMTiles 向量切片）
//
// 資料：全台 1km grid → 開車到最近大醫院的分鐘數（OSRM），level 分級 le5/le10/le15/over15/unreachable。
// 來源 scripts/preprocess/ → tippecanoe → public/medical/medical_isochrone.pmtiles。
//
// 兩個 toggle 共用同一個 fill layer：
//   medIsochrone = 全部 level（完整等時圈）
//   medDesert    = 僅 over15（醫療沙漠高亮）
// 兩者互斥邏輯：medIsochrone ON → 顯示全部；medDesert ON 但 medIsochrone OFF → 僅 over15。

import mapboxgl from "mapbox-gl";
import type { Map as MapboxMap, FilterSpecification } from "mapbox-gl";
import type { LayerVisibility } from "../types";
// mapbox-pmtiles 未提供 ESM build 型別，import dist 繞過（同 fireIsochrone / medicalPOI factory）
// @ts-expect-error 套件未提供 ESM build 的型別宣告
import { PmTilesSource } from "mapbox-pmtiles/dist/mapbox-pmtiles.js";

const SOURCE_TYPE = (PmTilesSource as unknown as { SOURCE_TYPE: string }).SOURCE_TYPE;

// PMTiles SourceType 註冊：其他 factory 也會註冊，靠 flag + try/catch 避免重複。
let sourceTypeRegistered = false;
function registerSourceTypeOnce(): void {
  if (sourceTypeRegistered) return;
  sourceTypeRegistered = true;
  try {
    const Style = (mapboxgl as unknown as {
      Style: { setSourceType: (type: string, impl: unknown) => void };
    }).Style;
    Style.setSourceType(SOURCE_TYPE, PmTilesSource);
  } catch {
    // 已由其他 PMTiles 圖層註冊過，忽略
  }
}

const BASE = `${import.meta.env.BASE_URL ?? "/"}medical`;
const SOURCE_ID = "medical-isochrone";
const SOURCE_LAYER = "isochrone";
const FILL_ID = "medical-isochrone-fill";
const BASE_OPACITY = 0.45;

// 分級配色（level 字串 match）：綠 5min → 黃 10min → 橙 15min → 紅 >15min。
const COLOR_EXPR = [
  "match", ["get", "level"],
  "le5", "#22c55e",
  "le10", "#eab308",
  "le15", "#f97316",
  "over15", "#ef4444",
  "#94a3b8", // unreachable fallback
];

export interface MedicalIsochroneParams {
  /** fill opacity 倍率 (0~1) */
  opacity: number;
}

export const MEDICAL_ISOCHRONE_PARAMS_DEFAULT: MedicalIsochroneParams = {
  opacity: 0.5,
};

/** 依 medIsochrone / medDesert 可見性決定 fill layer 的 filter。 */
function visibilityFilter(vis: LayerVisibility): FilterSpecification | null {
  if (vis.medIsochrone) {
    // 完整等時圈：顯示 4 個 level（排除 unreachable）
    return ["match", ["get", "level"], ["le5", "le10", "le15", "over15"], true, false] as unknown as FilterSpecification;
  }
  if (vis.medDesert) {
    // 僅醫療沙漠
    return ["==", ["get", "level"], "over15"] as unknown as FilterSpecification;
  }
  return null; // 兩者皆 OFF → 隱藏
}

export function ensureMedicalIsochroneLayers(map: MapboxMap): void {
  registerSourceTypeOnce();
  if (!map.getSource(SOURCE_ID)) {
    map.addSource(SOURCE_ID, {
      type: SOURCE_TYPE,
      url: `${BASE}/medical_isochrone.pmtiles`,
      minzoom: 5,
      maxzoom: 14,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
  }
  if (!map.getLayer(FILL_ID)) {
    map.addLayer({
      id: FILL_ID,
      type: "fill",
      source: SOURCE_ID,
      "source-layer": SOURCE_LAYER,
      minzoom: 5,
      layout: { visibility: "none" },
      paint: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        "fill-color": COLOR_EXPR as any,
        "fill-opacity": BASE_OPACITY * MEDICAL_ISOCHRONE_PARAMS_DEFAULT.opacity,
        "fill-antialias": false,
      },
    });
  }
}

export function updateMedicalIsochroneLayers(
  map: MapboxMap,
  vis: LayerVisibility,
  params: Record<string, number>,
): void {
  if (!map.getLayer(FILL_ID)) return;
  const opacity = params.medIsochroneOpacity ?? MEDICAL_ISOCHRONE_PARAMS_DEFAULT.opacity;
  const filter = visibilityFilter(vis);
  const show = filter !== null;
  map.setLayoutProperty(FILL_ID, "visibility", show ? "visible" : "none");
  map.setPaintProperty(FILL_ID, "fill-opacity", BASE_OPACITY * opacity);
  if (filter) {
    map.setFilter(FILL_ID, filter);
  }
}

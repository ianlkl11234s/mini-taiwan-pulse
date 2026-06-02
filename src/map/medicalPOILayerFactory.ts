// 醫療基礎點位 factory — 5 個獨立 circle layer（PMTiles 向量切片）
//
// 單一 PMTiles source（medical_poi.pmtiles, source-layer "medical", med_cat 屬性），
// 前端用 med_cat filter 切出 5 個獨立 layer，各自 toggle / 透明度 / 大小。
// 來源：scripts/preprocess/merge_medical_poi.py → tippecanoe → public/medical/medical_poi.pmtiles。
//
// 全程可見：不設 minzoom（與 fireHydrants 的 minzoom 12 不同）→ 任何縮放等級皆可顯示，
// 由 tippecanoe --drop-densest-as-needed 在低縮放抽稀，兼顧效能。
// PMTiles 而非 GeoJSON：77857 點直接餵 GeoJSON 太大（27.7MB），切片用 HTTP Range 按需載入。

import mapboxgl from "mapbox-gl";
import type { Map as MapboxMap, FilterSpecification } from "mapbox-gl";
import type { LayerVisibility } from "../types";
import { MEDICAL_POI_TYPES } from "../data/medicalPOITypes";
// mapbox-pmtiles 未提供 ESM build 型別，import dist 繞過（同 fireIsochrone / agriculture factory）
// @ts-expect-error 套件未提供 ESM build 的型別宣告
import { PmTilesSource } from "mapbox-pmtiles/dist/mapbox-pmtiles.js";

const SOURCE_TYPE = (PmTilesSource as unknown as { SOURCE_TYPE: string }).SOURCE_TYPE;

// PMTiles SourceType 註冊：agriculture / fireIsochrone 也會註冊，靠 flag + try/catch 避免重複。
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
const SOURCE_ID = "medical-poi";
const SOURCE_LAYER = "medical";

export interface MedicalPOIParams {
  /** circle opacity (0~1) */
  opacity: number;
  /** radius 倍率 (0.3~3)，乘以 zoom-based interpolation */
  scale: number;
}

export const MEDICAL_POI_PARAMS_DEFAULT: MedicalPOIParams = { opacity: 0.9, scale: 1 };

function layerId(catId: string): string {
  return `medical-${catId}-circle`;
}

function radiusExpr(scale: number): unknown[] {
  return [
    "interpolate", ["linear"], ["zoom"],
    4, 1.4 * scale,
    8, 2.6 * scale,
    11, 4.5 * scale,
    14, 7 * scale,
  ];
}

/** 此 layer 的 med_cat filter（單值或多值；clinic 含 other_medical）。 */
function catFilter(matchCats: string[]): FilterSpecification {
  return ["match", ["get", "med_cat"], matchCats, true, false] as unknown as FilterSpecification;
}

export function ensureMedicalPOILayers(map: MapboxMap): void {
  registerSourceTypeOnce();
  if (!map.getSource(SOURCE_ID)) {
    map.addSource(SOURCE_ID, {
      type: SOURCE_TYPE,
      url: `${BASE}/medical_poi.pmtiles`,
      minzoom: 0,
      maxzoom: 14,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
  }
  for (const t of MEDICAL_POI_TYPES) {
    const id = layerId(t.id);
    if (map.getLayer(id)) continue;
    map.addLayer({
      id,
      type: "circle",
      source: SOURCE_ID,
      "source-layer": SOURCE_LAYER,
      // 全程可見：不設 minzoom
      layout: { visibility: "none" },
      filter: catFilter(t.matchCats),
      paint: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        "circle-radius": radiusExpr(MEDICAL_POI_PARAMS_DEFAULT.scale) as any,
        "circle-color": t.color,
        "circle-stroke-width": [
          "interpolate", ["linear"], ["zoom"],
          6, 0, 12, 0.8,
        ],
        "circle-stroke-color": "rgba(255,255,255,0.85)",
        "circle-opacity": MEDICAL_POI_PARAMS_DEFAULT.opacity,
      },
    });
  }
}

/** 依 LayerVisibility + overlayParams 更新 5 個 layer（可見性 / 透明度 / 大小）。 */
export function updateMedicalPOILayers(
  map: MapboxMap,
  vis: LayerVisibility,
  params: Record<string, number>,
): void {
  for (const t of MEDICAL_POI_TYPES) {
    const id = layerId(t.id);
    if (!map.getLayer(id)) continue;
    const opacity = params[`${t.paramPrefix}Opacity`] ?? MEDICAL_POI_PARAMS_DEFAULT.opacity;
    const scale = params[`${t.paramPrefix}Scale`] ?? MEDICAL_POI_PARAMS_DEFAULT.scale;
    map.setLayoutProperty(id, "visibility", vis[t.visKey] ? "visible" : "none");
    map.setPaintProperty(id, "circle-opacity", opacity);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    map.setPaintProperty(id, "circle-radius", radiusExpr(scale) as any);
  }
}

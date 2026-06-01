// 救援等時圈圖層 factory（PMTiles 向量切片）
//
// coverage：全國聚合（county="全台"）+ 各縣市環差分級 5/10/15 分鐘，69 features。
// 來源 scripts/fetch/fetch-fire-isochrones.py → tippecanoe → public/fire/*.pmtiles。
// 用 PMTiles 而非 GeoJSON：依縮放/視窗分級載入（HTTP Range Request），又清晰又流暢，
// 不必為了效能把幾何簡化到變醜。
//
// 縣市下拉（params.countyIdx）→ setFilter 切換：全台(0) 顯示全國聚合、其餘顯示單一縣市。

import mapboxgl from "mapbox-gl";
import type { Map as MapboxMap, FilterSpecification } from "mapbox-gl";
import { fireIsochroneCountyByIndex } from "../data/fireIsochroneCounties";
// mapbox-pmtiles 未提供 ESM build 型別，import dist 並局部宣告繞過（同 agricultureLayerFactory）
// @ts-expect-error 套件未提供 ESM build 的型別宣告
import { PmTilesSource } from "mapbox-pmtiles/dist/mapbox-pmtiles.js";

const SOURCE_TYPE = (PmTilesSource as unknown as { SOURCE_TYPE: string }).SOURCE_TYPE;

// PMTiles SourceType 註冊：agriculture factory 也會註冊，靠單一 flag + try/catch 避免重複。
// MapView 先 ensure 農業層再 ensure 本層 → agriculture 先註冊成功，本層 try 命中 already-registered 被吞。
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

const BASE = `${import.meta.env.BASE_URL ?? "/"}fire`;
const SOURCE_ID = "fire-isochrone-coverage";
const SOURCE_LAYER = "coverage";
const FILL_ID = "fire-isochrone-coverage-fill";
const BASE_OPACITY = 0.45;

// 分級配色（由快到慢）：綠 5 分 → 黃 10 分 → 橙 15 分。與 fireTypes FIRE_ISOCHRONE_BANDS 同色。
const COLOR_EXPR = [
  "match", ["get", "minutes"],
  5, "#22c55e", 10, "#eab308", 15, "#f97316",
  "#f97316",
];

export interface FireIsochroneParams {
  /** fill opacity 倍率 (0~1) */
  opacity: number;
  /** 縣市下拉 index（0 = 全台，對應 FIRE_ISOCHRONE_COUNTY_OPTIONS） */
  countyIdx: number;
}

export const FIRE_ISOCHRONE_PARAMS_DEFAULT: FireIsochroneParams = {
  opacity: 0.5,
  countyIdx: 0,
};

/** idx → county filter。全台(idx 0) → 全國聚合 feature（county="全台"）；其餘 → 單一縣市。 */
function countyFilter(idx: number): FilterSpecification {
  const county = fireIsochroneCountyByIndex(idx) ?? "全台";
  return ["==", ["get", "county"], county] as unknown as FilterSpecification;
}

export function ensureFireIsochroneLayer(map: MapboxMap): void {
  registerSourceTypeOnce();
  if (!map.getSource(SOURCE_ID)) {
    map.addSource(SOURCE_ID, {
      type: SOURCE_TYPE,
      url: `${BASE}/fire_isochrone_coverage.pmtiles`,
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
      filter: countyFilter(0),
      paint: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        "fill-color": COLOR_EXPR as any,
        "fill-opacity": BASE_OPACITY * FIRE_ISOCHRONE_PARAMS_DEFAULT.opacity,
        "fill-antialias": false,
      },
    });
  }
}

export function updateFireIsochroneLayer(
  map: MapboxMap,
  visible: boolean,
  params: FireIsochroneParams = FIRE_ISOCHRONE_PARAMS_DEFAULT,
): void {
  if (!map.getLayer(FILL_ID)) return;
  map.setLayoutProperty(FILL_ID, "visibility", visible ? "visible" : "none");
  map.setPaintProperty(FILL_ID, "fill-opacity", BASE_OPACITY * params.opacity);
  map.setFilter(FILL_ID, countyFilter(params.countyIdx));
}

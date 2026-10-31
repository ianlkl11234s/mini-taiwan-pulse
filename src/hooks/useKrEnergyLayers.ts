import type { AnyLayer, Map as MapboxMap } from "mapbox-gl";
import { hookFillPaint, hookLinePaint } from "../map/lineFillSpec";
import { LINE_DASH, pointRadius, pointStrokePaint } from "../map/mapStyleScale";
import { paramDefault } from "../data/layerParamsSpec";
import {
  KR_CAPACITY_BANDS, KR_FALLBACK_COLOR, KR_FUEL_GROUPS, KR_FUEL_STATIONS_ATTRIBUTION, KR_FUEL_TYPES, KR_OIL_GAS_TYPES, KR_OSM_ATTRIBUTION,
  KR_PIPELINE_COLORS, KR_TOWERS_COLOR, KR_TOWERS_MINZOOM, KR_VOLTAGE_CLASSES,
} from "../data/krInfraTypes";
import { useGbPmtilesLayers, type SourceSpec } from "./useGbWaterLayers";

/**
 * 南韓第 1 波能源：燃料站（點，4 類）、電廠（點）、再生能源（點）、電網線／變電所／鐵塔（同一個 PMTiles，三個 key 各自呼叫
 * useGbPmtilesLayers 共用 source）、油氣設施＋管線（OSM，稀疏）。靜態資料、不訂閱時間。
 */
export const KR_FUEL_STATIONS_CIRCLE_ID = "kr-fuel-stations-circle";
export const KR_POWER_PLANTS_CIRCLE_ID = "kr-power-plants-circle";
export const KR_RENEWABLES_CIRCLE_ID = "kr-renewables-circle";
export const KR_POWER_LINES_LINE_ID = "kr-power-lines-line";
export const KR_POWER_CABLES_LINE_ID = "kr-power-cables-line";
export const KR_SUBSTATIONS_CIRCLE_ID = "kr-substations-circle";
export const KR_POWER_TOWERS_CIRCLE_ID = "kr-power-towers-circle";
export const KR_OIL_GAS_FILL_ID = "kr-oil-gas-fill";
export const KR_OIL_GAS_LINE_ID = "kr-oil-gas-line";
export const KR_OIL_GAS_POINT_ID = "kr-oil-gas-point";
export const KR_PIPELINES_LINE_ID = "kr-oil-gas-pipelines-line";

type Expr = unknown[];
type MapRef = React.RefObject<MapboxMap | null>;
const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const opacityDefault = (key: string, fallback: number) => Number(paramDefault(key, `${key}Opacity`) ?? fallback);
const scaleDefault = (key: string) => Number(paramDefault(key, `${key}Scale`) ?? 1);
const setPaint = (map: MapboxMap, id: string, paint: Record<string, unknown>) => {
  for (const [k, v] of Object.entries(paint)) map.setPaintProperty(id, k as any, v as any);
};
function matchBy(field: string, pairs: readonly (readonly [unknown, unknown])[], fallback: unknown): Expr {
  const expr: unknown[] = ["match", ["coalesce", ["get", field], ""]];
  for (const [v, c] of pairs) expr.push(v, c);
  expr.push(fallback);
  return expr;
}

// ─────────────────────────── 燃料／充電站 ───────────────────────────

const FUEL_SOURCE: SourceSpec = {
  id: "kr-fuel-stations", file: "kr_fuel_stations.pmtiles", minzoom: 5, maxzoom: 13, attribution: KR_FUEL_STATIONS_ATTRIBUTION, loading: "韓國燃料與充電站載入中",
};
function fuelPaint(isDark: boolean, opacity: number, scale: number) {
  const op = clamp01(opacity);
  return {
    "circle-radius": pointRadius("M", scale / scaleDefault("krFuelStations")),
    "circle-color": matchBy("fuel_type", KR_FUEL_TYPES.map((f) => [f.value, f.color] as const), KR_FALLBACK_COLOR),
    "circle-opacity": op,
    ...pointStrokePaint(isDark, op / opacityDefault("krFuelStations", 0.75)),
  };
}
export function useKrFuelStationsLayer(mapRef: MapRef, visible: boolean, opacity: number, scale: number, isDark: boolean) {
  useGbPmtilesLayers(mapRef, FUEL_SOURCE, visible, () => [{
    id: KR_FUEL_STATIONS_CIRCLE_ID,
    layer: () => ({
      id: KR_FUEL_STATIONS_CIRCLE_ID, type: "circle", source: FUEL_SOURCE.id, "source-layer": "kr_fuel_stations", minzoom: 8,
      layout: { visibility: "none" }, paint: fuelPaint(isDark, opacity, scale),
    } as unknown as AnyLayer),
    update: (map) => setPaint(map, KR_FUEL_STATIONS_CIRCLE_ID, fuelPaint(isDark, opacity, scale)),
  }], [opacity, scale, isDark]);
}

// ─────────────────────────── 電廠／再生能源（OSM） ───────────────────────────

const fuelColor = (): Expr => matchBy("fuel_group", KR_FUEL_GROUPS.map((g) => [g.value, g.color] as const), KR_FALLBACK_COLOR);
/** 半徑＝裝置容量 4 級（B 階，點大小代表資料數值）；OSM 未標容量（null）用最小級。 */
export function krCapacityRadiusExpr(scale: number): Expr {
  const step: unknown[] = ["step", ["coalesce", ["get", "capacity_mw"], 0], KR_CAPACITY_BANDS[0]!.radius];
  for (const b of KR_CAPACITY_BANDS.slice(1)) step.push(b.min, b.radius);
  return ["*", step, scale];
}
const PLANTS_SOURCE: SourceSpec = {
  id: "kr-power-plants", file: "kr_power_plants.pmtiles", minzoom: 4, maxzoom: 13, attribution: KR_OSM_ATTRIBUTION, loading: "韓國電廠載入中",
};
function capacityPaint(key: string, isDark: boolean, opacity: number, scale: number) {
  const op = clamp01(opacity);
  return {
    "circle-radius": krCapacityRadiusExpr(scale / scaleDefault(key)),
    "circle-color": fuelColor(),
    "circle-opacity": op,
    ...pointStrokePaint(isDark, op / opacityDefault(key, 0.75)),
  };
}
export function useKrPowerPlantsLayer(mapRef: MapRef, visible: boolean, opacity: number, scale: number, isDark: boolean) {
  useGbPmtilesLayers(mapRef, PLANTS_SOURCE, visible, () => [{
    id: KR_POWER_PLANTS_CIRCLE_ID,
    layer: () => ({
      id: KR_POWER_PLANTS_CIRCLE_ID, type: "circle", source: PLANTS_SOURCE.id, "source-layer": "kr_power_plants", minzoom: 6,
      layout: { visibility: "none", "circle-sort-key": ["coalesce", ["get", "capacity_mw"], 0] },
      paint: capacityPaint("krPowerPlants", isDark, opacity, scale),
    } as unknown as AnyLayer),
    update: (map) => setPaint(map, KR_POWER_PLANTS_CIRCLE_ID, capacityPaint("krPowerPlants", isDark, opacity, scale)),
  }], [opacity, scale, isDark]);
}

const RENEW_SOURCE: SourceSpec = {
  id: "kr-renewables", file: "kr_renewables.pmtiles", minzoom: 4, maxzoom: 13, attribution: KR_OSM_ATTRIBUTION, loading: "韓國再生能源載入中",
};
/**
 * 8,578 點（<1 萬）直接畫；太陽能陣列 7,702 多數未標容量，半徑依容量只對風機等有標者生效。
 * 地圖只畫風機／太陽能／水力／生質的點，z8 起出點（全國視角 z6–7 為密集陣列，不畫熱區）。
 */
export function useKrRenewablesLayer(mapRef: MapRef, visible: boolean, opacity: number, scale: number, isDark: boolean) {
  useGbPmtilesLayers(mapRef, RENEW_SOURCE, visible, () => [{
    id: KR_RENEWABLES_CIRCLE_ID,
    layer: () => ({
      id: KR_RENEWABLES_CIRCLE_ID, type: "circle", source: RENEW_SOURCE.id, "source-layer": "kr_renewables", minzoom: 7,
      layout: { visibility: "none", "circle-sort-key": ["coalesce", ["get", "capacity_mw"], 0] },
      paint: capacityPaint("krRenewables", isDark, opacity, scale),
    } as unknown as AnyLayer),
    update: (map) => setPaint(map, KR_RENEWABLES_CIRCLE_ID, capacityPaint("krRenewables", isDark, opacity, scale)),
  }], [opacity, scale, isDark]);
}

// ─────────────────────────── 電網（線＋變電所＋鐵塔，同檔） ───────────────────────────

const GRID_SOURCE: SourceSpec = {
  id: "kr-power-grid", file: "kr_power_grid.pmtiles", minzoom: 4, maxzoom: 13, attribution: KR_OSM_ATTRIBUTION, loading: "韓國電網載入中",
};
const voltageColor = (): Expr => matchBy("voltage_class", KR_VOLTAGE_CLASSES.map((v) => [v.value, v.color] as const), KR_FALLBACK_COLOR);
const voltageOpacity = (op: number): Expr => ["*", clamp01(op), matchBy("voltage_class", KR_VOLTAGE_CLASSES.map((v) => [v.value, v.opacity] as const), 1)];
function voltageWidth(widthScale: number): Expr {
  const w = (f: number) => ["*", f * widthScale, matchBy("voltage_class", KR_VOLTAGE_CLASSES.map((v) => [v.value, v.width] as const), 1)];
  return ["interpolate", ["linear"], ["zoom"], 5, w(0.5), 10, w(1), 14, w(1.6)];
}
const IS_CABLE: Expr = ["==", ["get", "kind"], "cable"];

export function useKrPowerLinesLayer(mapRef: MapRef, visible: boolean, opacity: number, isDark: boolean) {
  const def = opacityDefault("krPowerLines", 0.85);
  const linePaint = (op: number) => hookLinePaint("krPowerLines", KR_POWER_LINES_LINE_ID,
    { "line-color": voltageColor(), "line-width": voltageWidth(1), "line-opacity": voltageOpacity(op) },
    { "line-color": voltageColor(), "line-width": voltageWidth(1), "line-opacity": voltageOpacity(def) }, isDark);
  // 地下／海底電纜：虛線（L-2「非實體」）
  const cablePaint = (op: number) => hookLinePaint("krPowerLines", KR_POWER_CABLES_LINE_ID,
    { "line-color": voltageColor(), "line-width": voltageWidth(0.8), "line-opacity": voltageOpacity(op), "line-dasharray": [...LINE_DASH.general] },
    { "line-color": voltageColor(), "line-width": voltageWidth(0.8), "line-opacity": voltageOpacity(def), "line-dasharray": [...LINE_DASH.general] }, isDark);
  useGbPmtilesLayers(mapRef, GRID_SOURCE, visible, () => [
    {
      id: KR_POWER_CABLES_LINE_ID,
      layer: () => ({
        id: KR_POWER_CABLES_LINE_ID, type: "line", source: GRID_SOURCE.id, "source-layer": "kr_power_lines", minzoom: 5,
        filter: IS_CABLE, layout: { visibility: "none", "line-cap": "butt", "line-join": "round" }, paint: cablePaint(opacity),
      } as unknown as AnyLayer),
      update: (map) => map.setPaintProperty(KR_POWER_CABLES_LINE_ID, "line-opacity", cablePaint(opacity)["line-opacity"] as any),
    },
    {
      id: KR_POWER_LINES_LINE_ID,
      layer: () => ({
        id: KR_POWER_LINES_LINE_ID, type: "line", source: GRID_SOURCE.id, "source-layer": "kr_power_lines", minzoom: 5,
        filter: ["!", IS_CABLE],
        layout: { visibility: "none", "line-cap": "round", "line-join": "round", "line-sort-key": ["coalesce", ["get", "voltage_max_kv"], 0] },
        paint: linePaint(opacity),
      } as unknown as AnyLayer),
      update: (map) => map.setPaintProperty(KR_POWER_LINES_LINE_ID, "line-opacity", linePaint(opacity)["line-opacity"] as any),
    },
  ], [opacity, isDark]);
}

function substationPaint(isDark: boolean, opacity: number, scale: number) {
  const op = clamp01(opacity);
  return {
    "circle-radius": ["*", matchBy("voltage_class", KR_VOLTAGE_CLASSES.map((v) => [v.value, v.radius] as const), 2.5), scale / scaleDefault("krSubstations")],
    "circle-color": voltageColor(),
    "circle-opacity": voltageOpacity(op),
    ...pointStrokePaint(isDark, op / opacityDefault("krSubstations", 0.75)),
  };
}
export function useKrSubstationsLayer(mapRef: MapRef, visible: boolean, opacity: number, scale: number, isDark: boolean) {
  useGbPmtilesLayers(mapRef, GRID_SOURCE, visible, () => [{
    id: KR_SUBSTATIONS_CIRCLE_ID,
    layer: () => ({
      id: KR_SUBSTATIONS_CIRCLE_ID, type: "circle", source: GRID_SOURCE.id, "source-layer": "kr_power_substations", minzoom: 6,
      layout: { visibility: "none", "circle-sort-key": ["coalesce", ["get", "voltage_max_kv"], 0] }, paint: substationPaint(isDark, opacity, scale),
    } as unknown as AnyLayer),
    update: (map) => setPaint(map, KR_SUBSTATIONS_CIRCLE_ID, substationPaint(isDark, opacity, scale)),
  }], [opacity, scale, isDark]);
}

/** 鐵塔 42,252 點：檔內 minzoom 11（低縮放沒有鐵塔，無從做熱區），z11 起畫點。 */
export function useKrPowerTowersLayer(mapRef: MapRef, visible: boolean, opacity: number, scale: number, isDark: boolean) {
  const paint = () => {
    const op = clamp01(opacity);
    return {
      "circle-radius": pointRadius("S", scale / scaleDefault("krPowerTowers")),
      "circle-color": KR_TOWERS_COLOR,
      "circle-opacity": op,
      ...pointStrokePaint(isDark, op / opacityDefault("krPowerTowers", 0.6)),
    };
  };
  useGbPmtilesLayers(mapRef, GRID_SOURCE, visible, () => [{
    id: KR_POWER_TOWERS_CIRCLE_ID,
    layer: () => ({
      id: KR_POWER_TOWERS_CIRCLE_ID, type: "circle", source: GRID_SOURCE.id, "source-layer": "kr_power_towers", minzoom: KR_TOWERS_MINZOOM,
      layout: { visibility: "none" }, paint: paint(),
    } as unknown as AnyLayer),
    update: (map) => setPaint(map, KR_POWER_TOWERS_CIRCLE_ID, paint()),
  }], [opacity, scale, isDark]);
}

// ─────────────────────────── 油氣設施＋管線（OSM，稀疏） ───────────────────────────

const OIL_GAS_SOURCE: SourceSpec = {
  id: "kr-oil-gas", file: "kr_oil_gas.pmtiles", minzoom: 4, maxzoom: 13, attribution: KR_OSM_ATTRIBUTION, loading: "韓國油氣設施載入中",
};
const typeColor = (): Expr => matchBy("facility_type", KR_OIL_GAS_TYPES.map((t) => [t.value, t.color] as const), KR_FALLBACK_COLOR);
const pipeColor = (): Expr => matchBy("substance", Object.entries(KR_PIPELINE_COLORS), KR_FALLBACK_COLOR);
const IS_POLY: Expr = ["==", ["geometry-type"], "Polygon"];
const IS_POINT: Expr = ["==", ["geometry-type"], "Point"];

export function useKrOilGasLayer(mapRef: MapRef, visible: boolean, opacity: number, isDark: boolean) {
  const def = opacityDefault("krOilGas", 0.6);
  const fillPaint = (op: number) => hookFillPaint("krOilGas", KR_OIL_GAS_FILL_ID,
    { "fill-color": typeColor(), "fill-opacity": clamp01(op) }, { "fill-color": typeColor(), "fill-opacity": def }, isDark);
  const linePaint = (op: number) => hookLinePaint("krOilGas", KR_OIL_GAS_LINE_ID,
    { "line-color": typeColor(), "line-width": 1, "line-opacity": clamp01(op / def) * 0.9 },
    { "line-color": typeColor(), "line-width": 1, "line-opacity": 0.9 }, isDark);
  const pipePaint = (op: number) => hookLinePaint("krOilGas", KR_PIPELINES_LINE_ID,
    { "line-color": pipeColor(), "line-width": ["interpolate", ["linear"], ["zoom"], 5, 1, 12, 2], "line-opacity": clamp01(op / def) * 0.9 },
    { "line-color": pipeColor(), "line-width": ["interpolate", ["linear"], ["zoom"], 5, 1, 12, 2], "line-opacity": 0.9 }, isDark);
  const pointPaint = (op: number) => ({
    "circle-radius": pointRadius("M"), "circle-color": typeColor(), "circle-opacity": clamp01(op / def) * 0.9, ...pointStrokePaint(isDark),
  });
  useGbPmtilesLayers(mapRef, OIL_GAS_SOURCE, visible, () => [
    {
      id: KR_OIL_GAS_FILL_ID,
      layer: () => ({
        id: KR_OIL_GAS_FILL_ID, type: "fill", source: OIL_GAS_SOURCE.id, "source-layer": "kr_oil_gas_facilities", minzoom: 6,
        filter: IS_POLY, layout: { visibility: "none" }, paint: fillPaint(opacity),
      } as unknown as AnyLayer),
      update: (map) => map.setPaintProperty(KR_OIL_GAS_FILL_ID, "fill-opacity", fillPaint(opacity)["fill-opacity"] as any),
    },
    {
      id: KR_OIL_GAS_LINE_ID,
      layer: () => ({
        id: KR_OIL_GAS_LINE_ID, type: "line", source: OIL_GAS_SOURCE.id, "source-layer": "kr_oil_gas_facilities", minzoom: 6,
        filter: IS_POLY, layout: { visibility: "none", "line-join": "round" }, paint: linePaint(opacity),
      } as unknown as AnyLayer),
      update: (map) => map.setPaintProperty(KR_OIL_GAS_LINE_ID, "line-opacity", linePaint(opacity)["line-opacity"] as any),
    },
    {
      id: KR_OIL_GAS_POINT_ID,
      layer: () => ({
        id: KR_OIL_GAS_POINT_ID, type: "circle", source: OIL_GAS_SOURCE.id, "source-layer": "kr_oil_gas_facilities", minzoom: 6,
        filter: IS_POINT, layout: { visibility: "none" }, paint: pointPaint(opacity),
      } as unknown as AnyLayer),
      update: (map) => setPaint(map, KR_OIL_GAS_POINT_ID, pointPaint(opacity)),
    },
    {
      id: KR_PIPELINES_LINE_ID,
      layer: () => ({
        id: KR_PIPELINES_LINE_ID, type: "line", source: OIL_GAS_SOURCE.id, "source-layer": "kr_oil_gas_pipelines", minzoom: 6,
        layout: { visibility: "none", "line-cap": "round", "line-join": "round" }, paint: pipePaint(opacity),
      } as unknown as AnyLayer),
      update: (map) => map.setPaintProperty(KR_PIPELINES_LINE_ID, "line-opacity", pipePaint(opacity)["line-opacity"] as any),
    },
  ], [opacity, isDark]);
}

import type { AnyLayer, Map as MapboxMap } from "mapbox-gl";
import { hookFillPaint, hookLinePaint } from "../map/lineFillSpec";
import { LINE_DASH, pointRadius, pointStrokePaint } from "../map/mapStyleScale";
import { paramDefault } from "../data/layerParamsSpec";
import {
  GB_CAPACITY_BANDS, GB_CONSTRUCTION_STROKE, GB_ENERGY_FALLBACK_COLOR, GB_FIELD_INACTIVE_FACTOR, GB_FIELD_PRODUCING, GB_FIELD_TYPES,
  GB_FUEL_GROUPS, GB_FUEL_STATION_COLOR, GB_NSTA_ATTRIBUTION, GB_OSM_ATTRIBUTION, GB_TECH_GROUPS, GB_VOLTAGE_CLASSES, gbStatusView,
} from "../data/gbEnergyTypes";
import { gbMaskFilter, gbWithFilter, useGbPmtilesLayers, type SourceSpec } from "./useGbWaterLayers";

/**
 * 英國第 6 波能源 6 層：電廠（點）、再生能源（點）、電網線＋變電所（同一個 PMTiles，兩個 key 各自呼叫
 * useGbPmtilesLayers 共用 source，隱藏只關自己的 layer）、加油站（點）、離岸油氣田（面）。靜態資料、不訂閱時間。
 */
export const GB_POWER_PLANTS_CIRCLE_ID = "gb-power-plants-circle";
export const GB_RENEWABLES_CIRCLE_ID = "gb-renewables-circle";
export const GB_POWER_LINES_LINE_ID = "gb-power-lines-line";
export const GB_POWER_CABLES_LINE_ID = "gb-power-cables-line";
export const GB_SUBSTATIONS_CIRCLE_ID = "gb-substations-circle";
export const GB_FUEL_STATIONS_CIRCLE_ID = "gb-fuel-stations-circle";
export const GB_OIL_GAS_FILL_ID = "gb-oil-gas-fields-fill";
export const GB_OIL_GAS_LINE_ID = "gb-oil-gas-fields-line";

type Expr = unknown[];
type MapRef = React.RefObject<MapboxMap | null>;
const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const opacityDefault = (key: string, fallback: number) => Number(paramDefault(key, `${key}Opacity`) ?? fallback);
const scaleDefault = (key: string) => Number(paramDefault(key, `${key}Scale`) ?? 1);
const setPaint = (map: MapboxMap, id: string, paint: Record<string, unknown>) => {
  for (const [k, v] of Object.entries(paint)) map.setPaintProperty(id, k as any, v as any);
};
function matchColor(field: string, pairs: readonly (readonly [unknown, string])[], fallback: string): Expr {
  const expr: unknown[] = ["match", ["coalesce", ["get", field], ""]];
  for (const [v, c] of pairs) expr.push(v, c);
  expr.push(fallback);
  return expr;
}
function matchNumber(field: string, pairs: readonly (readonly [unknown, number])[], fallback: number): Expr {
  const expr: unknown[] = ["match", ["coalesce", ["get", field], ""]];
  for (const [v, n] of pairs) expr.push(v, n);
  expr.push(fallback);
  return expr;
}

// ─────────────────────────── 電廠 ───────────────────────────

const PLANTS_SOURCE: SourceSpec = {
  id: "gb-power-plants", file: "gb_power_plants.pmtiles", minzoom: 4, maxzoom: 12, attribution: "DESNZ DUKES 2026 (OGL v3.0)", loading: "英國電廠載入中",
};
const plantColor = (): Expr => matchColor("fuel_group", GB_FUEL_GROUPS.map((g) => [g.value, g.color] as const), GB_ENERGY_FALLBACK_COLOR);
/** 半徑＝裝置容量 4 級（B 階，點大小代表資料數值）。 */
export function gbCapacityRadiusExpr(scale: number): Expr {
  const step: unknown[] = ["step", ["coalesce", ["get", "capacity_mw"], 0], GB_CAPACITY_BANDS[0]!.radius];
  for (const b of GB_CAPACITY_BANDS.slice(1)) step.push(b.min, b.radius);
  return ["*", step, scale];
}
function plantsPaint(isDark: boolean, opacity: number, scale: number) {
  const op = clamp01(opacity);
  return {
    "circle-radius": gbCapacityRadiusExpr(scale / scaleDefault("gbPowerPlants")),
    "circle-color": plantColor(),
    "circle-opacity": op,
    ...pointStrokePaint(isDark, op / opacityDefault("gbPowerPlants", 0.8)),
  };
}

export function useGbPowerPlantsLayer(mapRef: MapRef, visible: boolean, opacity: number, scale: number, fuelMask: number | undefined, isDark: boolean) {
  // §3.8 V-4：燃料類別多選
  const filter = gbMaskFilter("fuel_group", fuelMask, GB_FUEL_GROUPS.map((g) => g.value));
  useGbPmtilesLayers(mapRef, PLANTS_SOURCE, visible, () => gbWithFilter([{
    id: GB_POWER_PLANTS_CIRCLE_ID,
    layer: () => ({
      id: GB_POWER_PLANTS_CIRCLE_ID, type: "circle", source: PLANTS_SOURCE.id, "source-layer": "gb_power_plants", minzoom: 5,
      // 大廠畫在上面
      layout: { visibility: "none", "circle-sort-key": ["coalesce", ["get", "capacity_mw"], 0] },
      paint: plantsPaint(isDark, opacity, scale),
    } as unknown as AnyLayer),
    update: (map) => setPaint(map, GB_POWER_PLANTS_CIRCLE_ID, plantsPaint(isDark, opacity, scale)),
  }], filter), [opacity, scale, fuelMask, isDark]);
}

// ─────────────────────────── 再生能源 ───────────────────────────

const RENEWABLES_SOURCE: SourceSpec = {
  id: "gb-renewables", file: "gb_renewables.pmtiles", minzoom: 4, maxzoom: 13, attribution: "DESNZ REPD July 2026 (OGL v3.0)", loading: "英國再生能源專案載入中",
};
const techColor = (): Expr => matchColor("tech_group", GB_TECH_GROUPS.flatMap((g) => g.raw.map((r) => [r, g.color] as const)), GB_ENERGY_FALLBACK_COLOR);
const IS_CONSTRUCTION: Expr = ["==", ["get", "status_group"], "construction"];
export function gbRenewablesFilter(statusIdx: number): Expr {
  return ["in", ["get", "status_group"], ["literal", [...gbStatusView(statusIdx).groups]]];
}
/**
 * 施工中＝台灣規劃中設施的施工中描邊（P-9 資料編碼描邊）；其餘用底圖色細縫。
 * 半徑＝裝置容量 4 級（同電廠 B 階）。P-4 例外（2026-10-30 使用者決定）：1.46 萬點不畫熱區、z5 起直接畫點，
 * 因為容量從 150 kW 到 GW 級差距大，熱區只反映案件數會誤導；大案場靠點大小在全英視角浮出來。
 */
function renewablesPaint(isDark: boolean, opacity: number, scale: number) {
  const op = clamp01(opacity);
  const seam = pointStrokePaint(isDark, op / opacityDefault("gbRenewables", 0.75));
  return {
    "circle-radius": gbCapacityRadiusExpr(scale / scaleDefault("gbRenewables")),
    "circle-color": techColor(),
    "circle-opacity": op,
    "circle-stroke-color": ["case", IS_CONSTRUCTION, GB_CONSTRUCTION_STROKE, seam["circle-stroke-color"]],
    "circle-stroke-width": ["case", IS_CONSTRUCTION, 1.5, seam["circle-stroke-width"]],
    "circle-stroke-opacity": ["case", IS_CONSTRUCTION, op, seam["circle-stroke-opacity"]],
  };
}

export function useGbRenewablesLayer(mapRef: MapRef, visible: boolean, opacity: number, scale: number, statusIdx: number, isDark: boolean) {
  const filter = gbRenewablesFilter(statusIdx);
  useGbPmtilesLayers(mapRef, RENEWABLES_SOURCE, visible, () => [{
    id: GB_RENEWABLES_CIRCLE_ID,
    layer: () => ({
      id: GB_RENEWABLES_CIRCLE_ID, type: "circle", source: RENEWABLES_SOURCE.id, "source-layer": "gb_renewables", minzoom: 5,
      filter, layout: { visibility: "none", "circle-sort-key": ["coalesce", ["get", "capacity_mw"], 0] }, paint: renewablesPaint(isDark, opacity, scale),
    } as unknown as AnyLayer),
    update: (map) => {
      map.setFilter(GB_RENEWABLES_CIRCLE_ID, filter as any);
      setPaint(map, GB_RENEWABLES_CIRCLE_ID, renewablesPaint(isDark, opacity, scale));
    },
  }], [opacity, scale, statusIdx, isDark]);
}

// ─────────────────────────── 電網（線＋變電所，同檔） ───────────────────────────

const GRID_SOURCE: SourceSpec = {
  id: "gb-power-grid", file: "gb_power_grid.pmtiles", minzoom: 4, maxzoom: 13, attribution: GB_OSM_ATTRIBUTION, loading: "英國電網載入中",
};
const voltageColor = (): Expr => matchColor("voltage_class", GB_VOLTAGE_CLASSES.map((v) => [v.value, v.color] as const), GB_ENERGY_FALLBACK_COLOR);
const voltageOpacity = (op: number): Expr => ["*", clamp01(op), matchNumber("voltage_class", GB_VOLTAGE_CLASSES.map((v) => [v.value, v.opacity] as const), 1)];
/** 線寬＝電壓倍率 × 縮放（z5 0.5、z10 1、z14 1.6）；zoom 必須在最外層 interpolate。 */
function voltageWidth(widthScale: number): Expr {
  const w = (f: number) => ["*", f * widthScale, matchNumber("voltage_class", GB_VOLTAGE_CLASSES.map((v) => [v.value, v.width] as const), 1)];
  return ["interpolate", ["linear"], ["zoom"], 5, w(0.5), 10, w(1), 14, w(1.6)];
}
const IS_CABLE: Expr = ["==", ["get", "kind"], "cable"];

export function useGbPowerLinesLayer(mapRef: MapRef, visible: boolean, opacity: number, isDark: boolean) {
  const def = opacityDefault("gbPowerLines", 0.85);
  const linePaint = (op: number) => hookLinePaint("gbPowerLines", GB_POWER_LINES_LINE_ID,
    { "line-color": voltageColor(), "line-width": voltageWidth(1), "line-opacity": voltageOpacity(op) },
    { "line-color": voltageColor(), "line-width": voltageWidth(1), "line-opacity": voltageOpacity(def) }, isDark);
  // 地下／海底電纜：虛線（L-2「非實體」），比照台灣 osmPowerLines cable
  const cablePaint = (op: number) => hookLinePaint("gbPowerLines", GB_POWER_CABLES_LINE_ID,
    { "line-color": voltageColor(), "line-width": voltageWidth(0.8), "line-opacity": voltageOpacity(op), "line-dasharray": [...LINE_DASH.general] },
    { "line-color": voltageColor(), "line-width": voltageWidth(0.8), "line-opacity": voltageOpacity(def), "line-dasharray": [...LINE_DASH.general] }, isDark);
  useGbPmtilesLayers(mapRef, GRID_SOURCE, visible, () => [
    {
      id: GB_POWER_CABLES_LINE_ID,
      layer: () => ({
        id: GB_POWER_CABLES_LINE_ID, type: "line", source: GRID_SOURCE.id, "source-layer": "gb_power_lines", minzoom: 5,
        filter: IS_CABLE, layout: { visibility: "none", "line-cap": "butt", "line-join": "round" }, paint: cablePaint(opacity),
      } as unknown as AnyLayer),
      update: (map) => map.setPaintProperty(GB_POWER_CABLES_LINE_ID, "line-opacity", cablePaint(opacity)["line-opacity"] as any),
    },
    {
      id: GB_POWER_LINES_LINE_ID,
      layer: () => ({
        id: GB_POWER_LINES_LINE_ID, type: "line", source: GRID_SOURCE.id, "source-layer": "gb_power_lines", minzoom: 5,
        filter: ["!", IS_CABLE],
        // 高電壓畫在上面
        layout: { visibility: "none", "line-cap": "round", "line-join": "round", "line-sort-key": ["coalesce", ["get", "voltage_max_kv"], 0] },
        paint: linePaint(opacity),
      } as unknown as AnyLayer),
      update: (map) => map.setPaintProperty(GB_POWER_LINES_LINE_ID, "line-opacity", linePaint(opacity)["line-opacity"] as any),
    },
  ], [opacity, isDark]);
}

function substationPaint(isDark: boolean, opacity: number, scale: number) {
  const op = clamp01(opacity);
  const s = scale / scaleDefault("gbSubstations");
  return {
    "circle-radius": ["*", matchNumber("voltage_class", GB_VOLTAGE_CLASSES.map((v) => [v.value, v.radius] as const), 2), s],
    "circle-color": voltageColor(),
    "circle-opacity": voltageOpacity(op),
    ...pointStrokePaint(isDark, op / opacityDefault("gbSubstations", 0.75)),
  };
}

export function useGbSubstationsLayer(mapRef: MapRef, visible: boolean, opacity: number, scale: number, isDark: boolean) {
  useGbPmtilesLayers(mapRef, GRID_SOURCE, visible, () => [{
    id: GB_SUBSTATIONS_CIRCLE_ID,
    layer: () => ({
      id: GB_SUBSTATIONS_CIRCLE_ID, type: "circle", source: GRID_SOURCE.id, "source-layer": "gb_power_substations", minzoom: 5,
      layout: { visibility: "none", "circle-sort-key": ["coalesce", ["get", "voltage_max_kv"], 0] }, paint: substationPaint(isDark, opacity, scale),
    } as unknown as AnyLayer),
    update: (map) => setPaint(map, GB_SUBSTATIONS_CIRCLE_ID, substationPaint(isDark, opacity, scale)),
  }], [opacity, scale, isDark]);
}

// ─────────────────────────── 加油站 ───────────────────────────

const FUEL_SOURCE: SourceSpec = {
  id: "gb-fuel-stations", file: "gb_fuel_stations.pmtiles", minzoom: 5, maxzoom: 13, attribution: GB_OSM_ATTRIBUTION, loading: "英國加油站載入中",
};
function fuelPaint(isDark: boolean, opacity: number, scale: number) {
  const op = clamp01(opacity);
  return {
    "circle-radius": pointRadius("M", scale / scaleDefault("gbFuelStations")),
    "circle-color": GB_FUEL_STATION_COLOR,
    "circle-opacity": op,
    ...pointStrokePaint(isDark, op / opacityDefault("gbFuelStations", 0.8)),
  };
}

export function useGbFuelStationsLayer(mapRef: MapRef, visible: boolean, opacity: number, scale: number, isDark: boolean) {
  useGbPmtilesLayers(mapRef, FUEL_SOURCE, visible, () => [{
    id: GB_FUEL_STATIONS_CIRCLE_ID,
    layer: () => ({
      id: GB_FUEL_STATIONS_CIRCLE_ID, type: "circle", source: FUEL_SOURCE.id, "source-layer": "gb_fuel_stations", minzoom: 5,
      layout: { visibility: "none" }, paint: fuelPaint(isDark, opacity, scale),
    } as unknown as AnyLayer),
    update: (map) => setPaint(map, GB_FUEL_STATIONS_CIRCLE_ID, fuelPaint(isDark, opacity, scale)),
  }], [opacity, scale, isDark]);
}

// ─────────────────────────── 離岸油氣田 ───────────────────────────

const OIL_GAS_SOURCE: SourceSpec = {
  id: "gb-oil-gas", file: "gb_oil_gas.pmtiles", minzoom: 4, maxzoom: 12, attribution: GB_NSTA_ATTRIBUTION, loading: "英國離岸油氣田載入中",
};
const fieldColor = (): Expr => matchColor("field_type", GB_FIELD_TYPES.map((f) => [f.value, f.color] as const), GB_ENERGY_FALLBACK_COLOR);
const IS_PRODUCING: Expr = ["==", ["get", "status"], GB_FIELD_PRODUCING];
/** 透明度：生產中較深、其他狀態淡化（資料編碼）。 */
const fieldOpacity = (op: number): Expr => ["case", IS_PRODUCING, clamp01(op), clamp01(op) * GB_FIELD_INACTIVE_FACTOR];

export function useGbOilGasFieldsLayer(mapRef: MapRef, visible: boolean, opacity: number, typeMask: number | undefined, isDark: boolean) {
  // §3.8 V-4：油田／氣田／凝結油田多選
  const filter = gbMaskFilter("field_type", typeMask, GB_FIELD_TYPES.map((f) => f.value));
  const def = opacityDefault("gbOilGasFields", 0.6);
  const fillPaint = (op: number) => hookFillPaint("gbOilGasFields", GB_OIL_GAS_FILL_ID,
    { "fill-color": fieldColor(), "fill-opacity": fieldOpacity(op) }, { "fill-color": fieldColor(), "fill-opacity": fieldOpacity(def) }, isDark);
  const linePaint = (op: number) => hookLinePaint("gbOilGasFields", GB_OIL_GAS_LINE_ID,
    { "line-color": fieldColor(), "line-width": 1, "line-opacity": clamp01(op / def) * 0.9 },
    { "line-color": fieldColor(), "line-width": 1, "line-opacity": 0.9 }, isDark);
  useGbPmtilesLayers(mapRef, OIL_GAS_SOURCE, visible, () => gbWithFilter([
    {
      id: GB_OIL_GAS_FILL_ID,
      layer: () => ({
        id: GB_OIL_GAS_FILL_ID, type: "fill", source: OIL_GAS_SOURCE.id, "source-layer": "gb_oil_gas_fields", minzoom: 4,
        layout: { visibility: "none" }, paint: fillPaint(opacity),
      } as unknown as AnyLayer),
      update: (map) => map.setPaintProperty(GB_OIL_GAS_FILL_ID, "fill-opacity", fillPaint(opacity)["fill-opacity"] as any),
    },
    {
      id: GB_OIL_GAS_LINE_ID,
      layer: () => ({
        id: GB_OIL_GAS_LINE_ID, type: "line", source: OIL_GAS_SOURCE.id, "source-layer": "gb_oil_gas_fields", minzoom: 4,
        layout: { visibility: "none", "line-join": "round" }, paint: linePaint(opacity),
      } as unknown as AnyLayer),
      update: (map) => map.setPaintProperty(GB_OIL_GAS_LINE_ID, "line-opacity", linePaint(opacity)["line-opacity"] as any),
    },
  ], filter), [opacity, typeMask, isDark]);
}

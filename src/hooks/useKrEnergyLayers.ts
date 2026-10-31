import type { AnyLayer, Map as MapboxMap } from "mapbox-gl";
import { hookFillPaint, hookLinePaint } from "../map/lineFillSpec";
import { LINE_DASH, densePointsFromZoom, heatmapMaxzoom, pointRadius, pointStrokePaint } from "../map/mapStyleScale";
import { paramDefault } from "../data/layerParamsSpec";
import { krGroupFilter, krStringProp } from "../data/krDataLayers";
import { useHeatmapStyleSignature } from "../state/layerPalette";
import {
  KR_CAPACITY_BANDS, KR_FALLBACK_COLOR, KR_FUEL_GROUPS, KR_FUEL_STATIONS_ATTRIBUTION, KR_FUEL_TYPES, KR_OIL_GAS_TYPES, KR_OSM_ATTRIBUTION,
  KR_PIPELINE_COLORS, KR_PLANT_FUELS, KR_RENEWABLE_FUELS, KR_TOWERS_COLOR, KR_TOWERS_MINZOOM, KR_VOLTAGE_CLASSES,
} from "../data/krInfraTypes";
import { gbHeatmapBuild, useGbPmtilesLayers, type SourceSpec } from "./useGbWaterLayers";

/**
 * 南韓第 1 波能源：燃料站（點，4 類）、電廠（點）、再生能源（點）、電網線／變電所／鐵塔（同一個 PMTiles，三個 key 各自呼叫
 * useGbPmtilesLayers 共用 source）、油氣設施＋管線（OSM，稀疏）。靜態資料、不訂閱時間。
 */
export const KR_FUEL_STATIONS_CIRCLE_ID = "kr-fuel-stations-circle";
export const KR_FUEL_STATIONS_HEATMAP_ID = "kr-fuel-stations-heatmap";
export const KR_POWER_PLANTS_CIRCLE_ID = "kr-power-plants-circle";
/** V-1：電廠、再生能源 z<8 只畫「非太陽能或 ≥10 MW」的大型點，其餘太陽能（占 86–90%）z8 起由 minor 層補上。 */
export const KR_POWER_PLANTS_MINOR_CIRCLE_ID = "kr-power-plants-minor-circle";
export const KR_RENEWABLES_MINOR_CIRCLE_ID = "kr-renewables-minor-circle";
export const KR_RENEWABLES_CIRCLE_ID = "kr-renewables-circle";
export const KR_POWER_LINES_LINE_ID = "kr-power-lines-line";
export const KR_POWER_CABLES_LINE_ID = "kr-power-cables-line";
export const KR_SUBSTATIONS_CIRCLE_ID = "kr-substations-circle";
export const KR_POWER_TOWERS_CIRCLE_ID = "kr-power-towers-circle";
export const KR_OIL_GAS_FILL_ID = "kr-oil-gas-fill";
export const KR_OIL_GAS_LINE_ID = "kr-oil-gas-line";
export const KR_OIL_GAS_POINT_ID = "kr-oil-gas-point";
export const KR_PIPELINES_LINE_ID = "kr-oil-gas-pipelines-line";
/** V-1：低縮放代表點（146 設施＋33 管線中點，z4 起全含）；放大後（設施 z8、管線 z6）換回原面／線／點，不重複畫。 */
export const KR_OIL_GAS_PTS_FACILITY_ID = "kr-oil-gas-pts-facility-circle";
export const KR_OIL_GAS_PTS_PIPELINE_ID = "kr-oil-gas-pts-pipeline-circle";
const OIL_GAS_DETAIL_FROM = 8;
const PIPELINE_DETAIL_FROM = 6;

/** 低縮放只畫大型點的容量門檻（MW）＝`KR_CAPACITY_BANDS` 第 2 級下界；太陽能小於此值且非他種燃料者 z8 起才出。 */
export const KR_MAJOR_CAPACITY_MW = KR_CAPACITY_BANDS[1]!.min;
export const KR_SOLAR_FULL_FROM_ZOOM = 8;
const IS_MAJOR_PLANT: unknown[] = ["any", ["!=", ["get", "fuel_group"], "solar"], [">=", ["coalesce", ["get", "capacity_mw"], 0], KR_MAJOR_CAPACITY_MW]];
const allOf = (...parts: (unknown[] | null)[]): unknown[] | null => {
  const ps = parts.filter((p): p is unknown[] => !!p);
  return ps.length === 0 ? null : ps.length === 1 ? ps[0]! : ["all", ...ps];
};
const withFilter = (filter: unknown[] | null) => (filter ? { filter } : {});

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
/** V-4：燃料別多選（`krFuelStationsCatMask`；選項順序＝`KR_FUEL_TYPES`）。 */
export const krFuelTypeFilter = (mask: number | undefined) =>
  krGroupFilter(krStringProp("fuel_type"), KR_FUEL_TYPES.map((f) => ({ id: f.value, values: [f.value] })), false, mask);
// R5（V-1／P-4）：7,106 點（<1 萬）使用者點名拉遠改熱區；source 從 z5 起，熱區 z5–8、z8 起單點
const FUEL_COUNT = KR_FUEL_TYPES.reduce((n, f) => n + f.count, 0);
const FUEL_POINTS_FROM = densePointsFromZoom(FUEL_COUNT, 8);
const FUEL_HEAT_INTENSITY = 3;
export function useKrFuelStationsLayer(mapRef: MapRef, visible: boolean, opacity: number, scale: number, isDark: boolean, catMask?: number) {
  const filter = krFuelTypeFilter(catMask);
  const heatStyle = useHeatmapStyleSignature(["krFuelStations"]);
  useGbPmtilesLayers(mapRef, FUEL_SOURCE, visible, () => [
    gbHeatmapBuild({
      id: KR_FUEL_STATIONS_HEATMAP_ID, key: "krFuelStations", sourceId: FUEL_SOURCE.id, sourceLayer: "kr_fuel_stations", maxzoom: heatmapMaxzoom(FUEL_POINTS_FROM), filter,
      isDark, opacityScale: clamp01(opacity) / opacityDefault("krFuelStations", 0.75), intensity: FUEL_HEAT_INTENSITY,
    }),
    {
      id: KR_FUEL_STATIONS_CIRCLE_ID,
      layer: () => ({
        id: KR_FUEL_STATIONS_CIRCLE_ID, type: "circle", source: FUEL_SOURCE.id, "source-layer": "kr_fuel_stations", minzoom: FUEL_POINTS_FROM,
        ...withFilter(filter), layout: { visibility: "none" }, paint: fuelPaint(isDark, opacity, scale),
      } as unknown as AnyLayer),
      update: (map) => { map.setFilter(KR_FUEL_STATIONS_CIRCLE_ID, (filter ?? null) as any); setPaint(map, KR_FUEL_STATIONS_CIRCLE_ID, fuelPaint(isDark, opacity, scale)); },
    },
  ], [opacity, scale, isDark, heatStyle, JSON.stringify(filter)]);
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
/** V-4：燃料別多選（`krPowerPlantsCatMask`；選項順序＝`KR_PLANT_FUELS`，「其他」含地熱與未標燃料）。 */
export const KR_PLANT_FUEL_GROUPS = KR_PLANT_FUELS.map((v) => ({ id: v as string, values: v === "other" ? ["other", "geothermal", "unknown", ""] : [v] }));
export const krPlantFuelFilter = (mask: number | undefined) => krGroupFilter(krStringProp("fuel_group"), KR_PLANT_FUEL_GROUPS, false, mask);
export const KR_RENEWABLE_FUEL_GROUPS = KR_RENEWABLE_FUELS.map((v) => ({ id: v as string, values: [v as string] }));
export const krRenewableFuelFilter = (mask: number | undefined) => krGroupFilter(krStringProp("fuel_group"), KR_RENEWABLE_FUEL_GROUPS, false, mask);

/** 大型（非太陽能或 ≥10 MW）自 z4 起畫；其餘太陽能 z8 起補上（minor 層）。兩層共用 paint／排序／篩選。 */
function capacityLayers(o: {
  mainId: string; minorId: string; source: SourceSpec; sourceLayer: string; key: string; fuelFilter: unknown[] | null;
  isDark: boolean; opacity: number; scale: number;
}) {
  const mainFilter = allOf(IS_MAJOR_PLANT, o.fuelFilter);
  const minorFilter = allOf(["!", IS_MAJOR_PLANT], o.fuelFilter)!;
  const layout = { visibility: "none", "circle-sort-key": ["coalesce", ["get", "capacity_mw"], 0] };
  const paint = () => capacityPaint(o.key, o.isDark, o.opacity, o.scale);
  return [
    {
      id: o.minorId,
      layer: () => ({ id: o.minorId, type: "circle", source: o.source.id, "source-layer": o.sourceLayer, minzoom: KR_SOLAR_FULL_FROM_ZOOM, filter: minorFilter, layout, paint: paint() } as unknown as AnyLayer),
      update: (map: MapboxMap) => { map.setFilter(o.minorId, minorFilter as any); setPaint(map, o.minorId, paint()); },
    },
    {
      id: o.mainId,
      layer: () => ({ id: o.mainId, type: "circle", source: o.source.id, "source-layer": o.sourceLayer, minzoom: 4, ...withFilter(mainFilter), layout, paint: paint() } as unknown as AnyLayer),
      update: (map: MapboxMap) => { map.setFilter(o.mainId, (mainFilter ?? null) as any); setPaint(map, o.mainId, paint()); },
    },
  ];
}
export function useKrPowerPlantsLayer(mapRef: MapRef, visible: boolean, opacity: number, scale: number, isDark: boolean, catMask?: number) {
  const fuelFilter = krPlantFuelFilter(catMask);
  useGbPmtilesLayers(mapRef, PLANTS_SOURCE, visible, () => capacityLayers({
    mainId: KR_POWER_PLANTS_CIRCLE_ID, minorId: KR_POWER_PLANTS_MINOR_CIRCLE_ID, source: PLANTS_SOURCE, sourceLayer: "kr_power_plants", key: "krPowerPlants", fuelFilter, isDark, opacity, scale,
  }), [opacity, scale, isDark, JSON.stringify(fuelFilter)]);
}

const RENEW_SOURCE: SourceSpec = {
  id: "kr-renewables", file: "kr_renewables.pmtiles", minzoom: 4, maxzoom: 13, attribution: KR_OSM_ATTRIBUTION, loading: "韓國再生能源載入中",
};
/**
 * 8,578 點（<1 萬）不畫熱區（容量差距大，熱區只反映案件數會誤導）；V-1：自 z4 起畫大型（風機、水力、生質、≥10 MW 太陽能），
 * 太陽能陣列 7,702（多數未標容量）z8 起補上。
 */
export function useKrRenewablesLayer(mapRef: MapRef, visible: boolean, opacity: number, scale: number, isDark: boolean, catMask?: number) {
  const fuelFilter = krRenewableFuelFilter(catMask);
  useGbPmtilesLayers(mapRef, RENEW_SOURCE, visible, () => capacityLayers({
    mainId: KR_RENEWABLES_CIRCLE_ID, minorId: KR_RENEWABLES_MINOR_CIRCLE_ID, source: RENEW_SOURCE, sourceLayer: "kr_renewables", key: "krRenewables", fuelFilter, isDark, opacity, scale,
  }), [opacity, scale, isDark, JSON.stringify(fuelFilter)]);
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
/** V-4：電壓等級多選（電網線、變電所共用；`krPowerLinesCatMask`／`krSubstationsCatMask`，選項順序＝`KR_VOLTAGE_CLASSES`）。 */
export const krVoltageFilter = (mask: number | undefined) =>
  krGroupFilter(krStringProp("voltage_class"), KR_VOLTAGE_CLASSES.map((v) => ({ id: v.value, values: [v.value] })), false, mask);

export function useKrPowerLinesLayer(mapRef: MapRef, visible: boolean, opacity: number, isDark: boolean, catMask?: number) {
  const def = opacityDefault("krPowerLines", 0.85);
  const vf = krVoltageFilter(catMask);
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
        filter: allOf(IS_CABLE, vf), layout: { visibility: "none", "line-cap": "butt", "line-join": "round" }, paint: cablePaint(opacity),
      } as unknown as AnyLayer),
      update: (map) => { map.setFilter(KR_POWER_CABLES_LINE_ID, allOf(IS_CABLE, vf) as any); map.setPaintProperty(KR_POWER_CABLES_LINE_ID, "line-opacity", cablePaint(opacity)["line-opacity"] as any); },
    },
    {
      id: KR_POWER_LINES_LINE_ID,
      layer: () => ({
        id: KR_POWER_LINES_LINE_ID, type: "line", source: GRID_SOURCE.id, "source-layer": "kr_power_lines", minzoom: 5,
        filter: allOf(["!", IS_CABLE], vf),
        layout: { visibility: "none", "line-cap": "round", "line-join": "round", "line-sort-key": ["coalesce", ["get", "voltage_max_kv"], 0] },
        paint: linePaint(opacity),
      } as unknown as AnyLayer),
      update: (map) => { map.setFilter(KR_POWER_LINES_LINE_ID, allOf(["!", IS_CABLE], vf) as any); map.setPaintProperty(KR_POWER_LINES_LINE_ID, "line-opacity", linePaint(opacity)["line-opacity"] as any); },
    },
  ], [opacity, isDark, JSON.stringify(vf)]);
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
export function useKrSubstationsLayer(mapRef: MapRef, visible: boolean, opacity: number, scale: number, isDark: boolean, catMask?: number) {
  const vf = krVoltageFilter(catMask);
  useGbPmtilesLayers(mapRef, GRID_SOURCE, visible, () => [{
    id: KR_SUBSTATIONS_CIRCLE_ID,
    layer: () => ({
      id: KR_SUBSTATIONS_CIRCLE_ID, type: "circle", source: GRID_SOURCE.id, "source-layer": "kr_power_substations", minzoom: 4, ...withFilter(vf),
      layout: { visibility: "none", "circle-sort-key": ["coalesce", ["get", "voltage_max_kv"], 0] }, paint: substationPaint(isDark, opacity, scale),
    } as unknown as AnyLayer),
    update: (map) => { map.setFilter(KR_SUBSTATIONS_CIRCLE_ID, (vf ?? null) as any); setPaint(map, KR_SUBSTATIONS_CIRCLE_ID, substationPaint(isDark, opacity, scale)); },
  }], [opacity, scale, isDark, JSON.stringify(vf)]);
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
const PTS_FACILITY: Expr = ["==", ["get", "kind"], "facility"];
const PTS_PIPELINE: Expr = ["==", ["get", "kind"], "pipeline"];
const pipeColorBy = (field: string): Expr => matchBy(field, Object.entries(KR_PIPELINE_COLORS), KR_FALLBACK_COLOR);

/** V-4：設施類別（`krOilGasCatMask`，順序＝`KR_OIL_GAS_TYPES`）與管線物質（`krOilGasPipeMask`，順序＝`KR_PIPELINE_COLORS` 鍵）兩組多選。 */
export const krOilGasFacilityFilter = (mask: number | undefined) =>
  krGroupFilter(krStringProp("facility_type"), KR_OIL_GAS_TYPES.map((t) => ({ id: t.value, values: [t.value] })), false, mask);
export const KR_PIPELINE_SUBSTANCES = Object.keys(KR_PIPELINE_COLORS);
export const krPipelineFilter = (mask: number | undefined) =>
  krGroupFilter(krStringProp("substance"), KR_PIPELINE_SUBSTANCES.map((v) => ({ id: v, values: [v] })), false, mask);

export function useKrOilGasLayer(mapRef: MapRef, visible: boolean, opacity: number, isDark: boolean, catMask?: number, pipeMask?: number) {
  const def = opacityDefault("krOilGas", 0.6);
  const ff = krOilGasFacilityFilter(catMask);
  const pf = krPipelineFilter(pipeMask);
  const polyF = allOf(IS_POLY, ff);
  const pointF = allOf(IS_POINT, ff);
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
  const ptsPaint = (kindFilter: unknown[]) => ({
    "circle-radius": pointRadius("M"), "circle-opacity": clamp01(opacity / def) * 0.9, ...pointStrokePaint(isDark),
    "circle-color": kindFilter === PTS_FACILITY ? matchBy("label", KR_OIL_GAS_TYPES.map((t) => [t.value, t.color] as const), KR_FALLBACK_COLOR) : pipeColorBy("label"),
  });
  const ptsFacilityF = allOf(PTS_FACILITY, krGroupFilter(krStringProp("label"), KR_OIL_GAS_TYPES.map((t) => ({ id: t.value, values: [t.value] })), false, catMask))!;
  const ptsPipeF = allOf(PTS_PIPELINE, krGroupFilter(krStringProp("label"), KR_PIPELINE_SUBSTANCES.map((v) => ({ id: v, values: [v] })), false, pipeMask))!;
  useGbPmtilesLayers(mapRef, OIL_GAS_SOURCE, visible, () => [
    {
      id: KR_OIL_GAS_PTS_FACILITY_ID,
      layer: () => ({
        id: KR_OIL_GAS_PTS_FACILITY_ID, type: "circle", source: OIL_GAS_SOURCE.id, "source-layer": "kr_oil_gas_pts", minzoom: 4, maxzoom: OIL_GAS_DETAIL_FROM + 0.01,
        filter: ptsFacilityF, layout: { visibility: "none" }, paint: ptsPaint(PTS_FACILITY),
      } as unknown as AnyLayer),
      update: (map) => { map.setFilter(KR_OIL_GAS_PTS_FACILITY_ID, ptsFacilityF as any); setPaint(map, KR_OIL_GAS_PTS_FACILITY_ID, ptsPaint(PTS_FACILITY)); },
    },
    {
      id: KR_OIL_GAS_PTS_PIPELINE_ID,
      layer: () => ({
        id: KR_OIL_GAS_PTS_PIPELINE_ID, type: "circle", source: OIL_GAS_SOURCE.id, "source-layer": "kr_oil_gas_pts", minzoom: 4, maxzoom: PIPELINE_DETAIL_FROM + 0.01,
        filter: ptsPipeF, layout: { visibility: "none" }, paint: ptsPaint(PTS_PIPELINE),
      } as unknown as AnyLayer),
      update: (map) => { map.setFilter(KR_OIL_GAS_PTS_PIPELINE_ID, ptsPipeF as any); setPaint(map, KR_OIL_GAS_PTS_PIPELINE_ID, ptsPaint(PTS_PIPELINE)); },
    },
    {
      id: KR_OIL_GAS_FILL_ID,
      layer: () => ({
        id: KR_OIL_GAS_FILL_ID, type: "fill", source: OIL_GAS_SOURCE.id, "source-layer": "kr_oil_gas_facilities", minzoom: OIL_GAS_DETAIL_FROM,
        filter: polyF, layout: { visibility: "none" }, paint: fillPaint(opacity),
      } as unknown as AnyLayer),
      update: (map) => { map.setFilter(KR_OIL_GAS_FILL_ID, polyF as any); map.setPaintProperty(KR_OIL_GAS_FILL_ID, "fill-opacity", fillPaint(opacity)["fill-opacity"] as any); },
    },
    {
      id: KR_OIL_GAS_LINE_ID,
      layer: () => ({
        id: KR_OIL_GAS_LINE_ID, type: "line", source: OIL_GAS_SOURCE.id, "source-layer": "kr_oil_gas_facilities", minzoom: OIL_GAS_DETAIL_FROM,
        filter: polyF, layout: { visibility: "none", "line-join": "round" }, paint: linePaint(opacity),
      } as unknown as AnyLayer),
      update: (map) => { map.setFilter(KR_OIL_GAS_LINE_ID, polyF as any); map.setPaintProperty(KR_OIL_GAS_LINE_ID, "line-opacity", linePaint(opacity)["line-opacity"] as any); },
    },
    {
      id: KR_OIL_GAS_POINT_ID,
      layer: () => ({
        id: KR_OIL_GAS_POINT_ID, type: "circle", source: OIL_GAS_SOURCE.id, "source-layer": "kr_oil_gas_facilities", minzoom: OIL_GAS_DETAIL_FROM,
        filter: pointF, layout: { visibility: "none" }, paint: pointPaint(opacity),
      } as unknown as AnyLayer),
      update: (map) => { map.setFilter(KR_OIL_GAS_POINT_ID, pointF as any); setPaint(map, KR_OIL_GAS_POINT_ID, pointPaint(opacity)); },
    },
    {
      id: KR_PIPELINES_LINE_ID,
      layer: () => ({
        id: KR_PIPELINES_LINE_ID, type: "line", source: OIL_GAS_SOURCE.id, "source-layer": "kr_oil_gas_pipelines", minzoom: PIPELINE_DETAIL_FROM, ...withFilter(pf),
        layout: { visibility: "none", "line-cap": "round", "line-join": "round" }, paint: pipePaint(opacity),
      } as unknown as AnyLayer),
      update: (map) => { map.setFilter(KR_PIPELINES_LINE_ID, (pf ?? null) as any); map.setPaintProperty(KR_PIPELINES_LINE_ID, "line-opacity", pipePaint(opacity)["line-opacity"] as any); },
    },
  ], [opacity, isDark, JSON.stringify(ff), JSON.stringify(pf), JSON.stringify(ptsFacilityF), JSON.stringify(ptsPipeF)]);
}

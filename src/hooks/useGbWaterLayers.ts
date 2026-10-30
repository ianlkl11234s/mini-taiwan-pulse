import { useEffect } from "react";
import type { AnyLayer, Map as MapboxMap } from "mapbox-gl";
import { keepLoadingUntilMapIdle } from "../lib/loadingRegistry";
import { PMTILES_SOURCE_TYPE } from "../map/pmtilesConstants";
import { registerPmtilesSourceTypeOnce } from "../map/pmtilesSourceType";
import { hookFillPaint, hookLinePaint } from "../map/lineFillSpec";
import { LINE_WIDTH, pointRadius, pointStrokePaint } from "../map/mapStyleScale";
import { paramDefault } from "../data/layerParamsSpec";
import { applyHeatmapStyle, heatmapLayerPaint } from "../state/layerPalette";
import {
  GB_BATHING_CLASSES, GB_BATHING_NO_CLASS_STROKE,
  GB_EROSION_FALLBACK_COLOR, GB_EROSION_LONG_YEARS, GB_EROSION_PERIODS, GB_EROSION_RISKS, GB_EROSION_SHORT_YEARS, GB_EROSION_ZONES,
  GB_FLOOD_DEFENCE_CLASSES, GB_FLOOD_DEFENCE_NATURAL_FACTOR,
  GB_HYDRO_GRID_PRECISION, GB_HYDRO_KINDS, GB_HYDRO_UNTAGGED_COLOR,
  GB_RIVERS_CANAL_COLOR, GB_RIVERS_COLOR, GB_RIVERS_COLOR_LIGHT, GB_RIVERS_FADED_FACTOR, GB_RIVER_STRAHLER_BANDS,
  GB_WATER_MAP_ATTRIBUTION, type GbErosionPeriod,
} from "../data/gbWaterTypes";
import { useMapReadyTick } from "./useMapReadyTick";

/**
 * 英國第 3 波水資源／海岸 5 層：河川（線）、水文測站（點）、防洪設施（線）、海岸侵蝕（面＋北愛線）、浴場（點）。
 * 每層一個 PMTiles source，各自開關；靜態資料、不訂閱時間。
 */
export const GB_RIVERS_LINE_ID = "gb-rivers-line";
export const GB_HYDRO_CIRCLE_ID = "gb-hydro-stations-circle";
export const GB_FLOOD_DEFENCE_LINE_ID = "gb-flood-defences-line";
export const GB_EROSION_FILL_ID = "gb-coastal-erosion-fill";
export const GB_EROSION_NI_LINE_ID = "gb-coastal-erosion-ni-line";
export const GB_BATHING_CIRCLE_ID = "gb-bathing-waters-circle";

type Expr = unknown[];
const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const opacityDefault = (key: string, fallback: number) => Number(paramDefault(key, `${key}Opacity`) ?? fallback);
const scaleDefault = (key: string) => Number(paramDefault(key, `${key}Scale`) ?? 1);

function absoluteUrl(relativeFile: string): string {
  const relative = `${import.meta.env.BASE_URL ?? "/"}world/${relativeFile}`;
  return new URL(relative, window.location.href).href;
}

/** L-1 線寬：z10／z14 兩點插值，`at(idx)` 回傳該插值點的（可 data-driven）寬度。 */
function zoomWidth(at: (idx: 0 | 1) => unknown): Expr {
  return ["interpolate", ["linear"], ["zoom"], 10, at(0), 14, at(1)];
}

export interface SourceSpec { id: string; file: string; minzoom: number; maxzoom: number; attribution: string; loading: string }
/** `before`（選填）：addLayer 的 beforeId（地形 raster 插在底圖第一個 symbol 下）；不給＝疊在最上面。 */
export interface LayerBuild { id: string; layer: () => AnyLayer; update: (map: MapboxMap) => void; before?: (map: MapboxMap) => string | undefined }

/**
 * R5（P-4／G-2）英國密集點熱區：畫在出點縮放以下、不可點擊；filter 與對應 circle 相同（null＝不篩）。
 * 呼叫端把它排在 circle 之前（先加的在下面），maxzoom 傳 `heatmapMaxzoom(出點縮放)`，並把
 * `useHeatmapStyleSignature([key])` 放進 deps（換色盤、多層疊放倍率才會重套）。
 */
export function gbHeatmapBuild(o: {
  id: string; key: string; sourceId: string; sourceLayer: string; maxzoom: number; filter?: unknown[] | null;
  isDark: boolean; opacityScale: number; intensity: number;
}): LayerBuild {
  return {
    id: o.id,
    layer: () => ({
      id: o.id, type: "heatmap", source: o.sourceId, "source-layer": o.sourceLayer, maxzoom: o.maxzoom,
      ...(o.filter ? { filter: o.filter } : {}),
      layout: { visibility: "none" }, paint: heatmapLayerPaint(o.key, o.isDark, o.opacityScale, o.intensity),
    } as unknown as AnyLayer),
    update: (map) => {
      map.setFilter(o.id, (o.filter ?? null) as any);
      applyHeatmapStyle(map, o.id, o.key, o.isDark, o.opacityScale);
    },
  };
}

/** 共用掛載流程：加 source → 逐一加 layer（初始隱藏）→ 顯示並更新 paint／filter；換底圖（style.load）重掛。
 *  第 4 波交通層也用（同一 source 可被多個 key 各自呼叫；隱藏只關自己的 layer，不移除 source）。 */
export function useGbPmtilesLayers(
  mapRef: React.RefObject<MapboxMap | null>,
  source: SourceSpec,
  visible: boolean,
  build: () => LayerBuild[],
  deps: readonly unknown[],
) {
  const mapTick = useMapReadyTick(mapRef, visible);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const layers = build();
    if (!visible) {
      for (const l of layers) if (map.getLayer(l.id)) map.setLayoutProperty(l.id, "visibility", "none");
      return;
    }
    const mount = () => {
      registerPmtilesSourceTypeOnce();
      let sourceAdded = false;
      if (!map.getSource(source.id)) {
        sourceAdded = true;
        map.addSource(source.id, {
          type: PMTILES_SOURCE_TYPE, url: absoluteUrl(source.file), attribution: source.attribution,
          minzoom: source.minzoom, maxzoom: source.maxzoom,
        } as any);
      }
      for (const l of layers) {
        if (!map.getLayer(l.id)) map.addLayer(l.layer(), l.before?.(map));
        map.setLayoutProperty(l.id, "visibility", "visible");
        l.update(map);
      }
      if (sourceAdded) keepLoadingUntilMapIdle(map, `${source.id}:render`, source.loading, source.id);
    };
    mount();
    map.on("style.load", mount);
    return () => { map.off("style.load", mount); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapRef, visible, mapTick, ...deps]);
}

// ─────────────────────────── 河川 ───────────────────────────

const RIVERS_SOURCE: SourceSpec = {
  id: "gb-rivers", file: "gb_rivers.pmtiles", minzoom: 5, maxzoom: 12, attribution: GB_WATER_MAP_ATTRIBUTION.rivers, loading: "英國河川載入中",
};
const IS_NI_RIVER: Expr = ["==", ["get", "source"], "daera_strahler"];
// `fictitious` 欄位為 false 或 null；只依 form=lake 淡化。
const IS_FADED_RIVER: Expr = ["==", ["get", "form"], "lake"];

function riversColor(isDark: boolean): Expr {
  return ["match", ["get", "form"], "canal", GB_RIVERS_CANAL_COLOR, isDark ? GB_RIVERS_COLOR : GB_RIVERS_COLOR_LIGHT];
}
/** 北愛依 Strahler 三段、大不列顛感潮河段標準寬、其餘細線。 */
export function gbRiversWidthExpr(): Expr {
  return zoomWidth((i) => {
    const step: unknown[] = ["step", ["coalesce", ["get", "strahler"], 1], LINE_WIDTH[GB_RIVER_STRAHLER_BANDS[0]!.width][i]];
    for (const band of GB_RIVER_STRAHLER_BANDS.slice(1)) step.push(band.min, LINE_WIDTH[band.width][i]);
    return ["case", IS_NI_RIVER, step, ["match", ["get", "form"], "tidalRiver", LINE_WIDTH.standard[i], LINE_WIDTH.thin[i]]];
  });
}
const riversOpacity = (opacity: number): Expr => ["case", IS_FADED_RIVER, clamp01(opacity) * GB_RIVERS_FADED_FACTOR, clamp01(opacity)];

export function useGbRiversLayer(mapRef: React.RefObject<MapboxMap | null>, visible: boolean, opacity: number, isDark: boolean) {
  const def = opacityDefault("gbRivers", 0.85);
  const paint = (op: number) => hookLinePaint("gbRivers", GB_RIVERS_LINE_ID,
    { "line-color": riversColor(isDark), "line-width": gbRiversWidthExpr(), "line-opacity": riversOpacity(op) },
    { "line-color": riversColor(isDark), "line-width": gbRiversWidthExpr(), "line-opacity": riversOpacity(def) }, isDark);
  useGbPmtilesLayers(mapRef, RIVERS_SOURCE, visible, () => [{
    id: GB_RIVERS_LINE_ID,
    layer: () => ({
      id: GB_RIVERS_LINE_ID, type: "line", source: RIVERS_SOURCE.id, "source-layer": "gb_rivers", minzoom: 6,
      layout: { visibility: "none", "line-cap": "round", "line-join": "round" }, paint: paint(opacity),
    } as unknown as AnyLayer),
    update: (map) => {
      const p = paint(opacity);
      map.setPaintProperty(GB_RIVERS_LINE_ID, "line-color", p["line-color"] as any);
      map.setPaintProperty(GB_RIVERS_LINE_ID, "line-opacity", p["line-opacity"] as any);
    },
  }], [opacity, isDark]);
}

// ─────────────────────────── 水文測站 ───────────────────────────

const HYDRO_SOURCE: SourceSpec = {
  id: "gb-hydro-stations", file: "gb_hydro_stations.pmtiles", minzoom: 5, maxzoom: 12, attribution: GB_WATER_MAP_ATTRIBUTION.hydro, loading: "英國水文測站載入中",
};
const IS_GRID_PRECISION: Expr = ["==", ["get", "precision"], GB_HYDRO_GRID_PRECISION];

function hydroColor(): Expr {
  const expr: unknown[] = ["match", ["coalesce", ["get", "kind"], ""]];
  for (const k of GB_HYDRO_KINDS) expr.push(k.value, k.color);
  expr.push(GB_HYDRO_UNTAGGED_COLOR);
  return expr;
}

/** 1 公里方格精度的站畫成空心（填色透明＋類別色 1.5px 外框）＝資料編碼描邊；其餘用底圖色細縫（P-2）。 */
function hydroPaint(isDark: boolean, opacity: number, scale: number) {
  const op = clamp01(opacity);
  const seam = pointStrokePaint(isDark, op / opacityDefault("gbHydroStations", 0.8));
  return {
    "circle-radius": pointRadius("M", scale / scaleDefault("gbHydroStations")),
    "circle-color": hydroColor(),
    "circle-opacity": ["case", IS_GRID_PRECISION, 0, op],
    "circle-stroke-color": ["case", IS_GRID_PRECISION, hydroColor(), seam["circle-stroke-color"]],
    "circle-stroke-width": ["case", IS_GRID_PRECISION, 1.5, seam["circle-stroke-width"]],
    "circle-stroke-opacity": ["case", IS_GRID_PRECISION, op, seam["circle-stroke-opacity"]],
  };
}

export function useGbHydroStationsLayer(mapRef: React.RefObject<MapboxMap | null>, visible: boolean, opacity: number, scale: number, isDark: boolean) {
  useGbPmtilesLayers(mapRef, HYDRO_SOURCE, visible, () => [{
    id: GB_HYDRO_CIRCLE_ID,
    layer: () => ({
      id: GB_HYDRO_CIRCLE_ID, type: "circle", source: HYDRO_SOURCE.id, "source-layer": "gb_hydro_stations", minzoom: 5,
      layout: { visibility: "none" }, paint: hydroPaint(isDark, opacity, scale),
    } as unknown as AnyLayer),
    update: (map) => {
      for (const [k, v] of Object.entries(hydroPaint(isDark, opacity, scale))) map.setPaintProperty(GB_HYDRO_CIRCLE_ID, k as any, v as any);
    },
  }], [opacity, scale, isDark]);
}

// ─────────────────────────── 防洪設施 ───────────────────────────

const FLOOD_SOURCE: SourceSpec = {
  id: "gb-flood-defences", file: "gb_flood_defences.pmtiles", minzoom: 6, maxzoom: 13, attribution: GB_WATER_MAP_ATTRIBUTION.flood, loading: "英國防洪設施載入中",
};
const IS_NATURAL_DEFENCE: Expr = ["==", ["get", "group"], "natural"];

function floodColor(): Expr {
  const match: unknown[] = ["match", ["coalesce", ["get", "defence_type"], ""]];
  for (const c of GB_FLOOD_DEFENCE_CLASSES) if (c.value !== "natural" && c.value !== "other") match.push([...c.types], c.color);
  match.push(GB_FLOOD_DEFENCE_CLASSES.find((c) => c.value === "other")!.color);
  return ["case", IS_NATURAL_DEFENCE, GB_FLOOD_DEFENCE_CLASSES.find((c) => c.value === "natural")!.color, match];
}
const floodOpacity = (opacity: number): Expr => ["case", IS_NATURAL_DEFENCE, clamp01(opacity) * GB_FLOOD_DEFENCE_NATURAL_FACTOR, clamp01(opacity)];

export function useGbFloodDefencesLayer(mapRef: React.RefObject<MapboxMap | null>, visible: boolean, opacity: number, isDark: boolean) {
  const def = opacityDefault("gbFloodDefenceAssets", 0.85);
  const paint = (op: number) => hookLinePaint("gbFloodDefenceAssets", GB_FLOOD_DEFENCE_LINE_ID,
    { "line-color": floodColor(), "line-width": 1.5, "line-opacity": floodOpacity(op) },
    { "line-color": floodColor(), "line-width": 1.5, "line-opacity": floodOpacity(def) }, isDark);
  useGbPmtilesLayers(mapRef, FLOOD_SOURCE, visible, () => [{
    id: GB_FLOOD_DEFENCE_LINE_ID,
    layer: () => ({
      id: GB_FLOOD_DEFENCE_LINE_ID, type: "line", source: FLOOD_SOURCE.id, "source-layer": "gb_flood_defences", minzoom: 7,
      layout: { visibility: "none", "line-cap": "round", "line-join": "round" }, paint: paint(opacity),
    } as unknown as AnyLayer),
    update: (map) => map.setPaintProperty(GB_FLOOD_DEFENCE_LINE_ID, "line-opacity", paint(opacity)["line-opacity"] as any),
  }], [opacity, isDark]);
}

// ─────────────────────────── 海岸侵蝕 ───────────────────────────

const EROSION_SOURCE: SourceSpec = {
  id: "gb-coastal-erosion", file: "gb_coastal_erosion.pmtiles", minzoom: 6, maxzoom: 14, attribution: GB_WATER_MAP_ATTRIBUTION.erosion, loading: "英國海岸侵蝕載入中",
};

export function gbErosionPeriodFromIdx(idx: number): GbErosionPeriod {
  return GB_EROSION_PERIODS[idx] ?? "long";
}

export function gbErosionZoneFilter(period: GbErosionPeriod): Expr {
  const years = period === "long" ? [...GB_EROSION_LONG_YEARS] : period === "short" ? [...GB_EROSION_SHORT_YEARS] : [...GB_EROSION_LONG_YEARS, ...GB_EROSION_SHORT_YEARS];
  return ["all", ["==", ["get", "kind"], "erosion_zone"], ["in", ["get", "horizon_year"], ["literal", years]]];
}

function erosionZoneColor(): Expr {
  const expr: unknown[] = ["match", ["concat", ["get", "nation"], ":", ["to-string", ["get", "horizon_year"]]]];
  for (const z of GB_EROSION_ZONES) expr.push(`${z.nation}:${z.year}`, z.color);
  expr.push(GB_EROSION_FALLBACK_COLOR);
  return expr;
}
function erosionRiskColor(): Expr {
  const expr: unknown[] = ["match", ["coalesce", ["get", "risk"], ""]];
  for (const r of GB_EROSION_RISKS) expr.push(r.value, r.color);
  expr.push(GB_EROSION_FALLBACK_COLOR);
  return expr;
}

export function useGbCoastalErosionLayer(mapRef: React.RefObject<MapboxMap | null>, visible: boolean, opacity: number, periodIdx: number, isDark: boolean) {
  const def = opacityDefault("gbCoastalErosionRisk", 0.7);
  const period = gbErosionPeriodFromIdx(periodIdx);
  const fillPaint = (op: number) => hookFillPaint("gbCoastalErosionRisk", GB_EROSION_FILL_ID,
    { "fill-color": erosionZoneColor(), "fill-opacity": clamp01(op) }, { "fill-color": erosionZoneColor(), "fill-opacity": def }, isDark);
  const linePaint = (op: number) => hookLinePaint("gbCoastalErosionRisk", GB_EROSION_NI_LINE_ID,
    { "line-color": erosionRiskColor(), "line-width": 3.5, "line-opacity": clamp01(op) },
    { "line-color": erosionRiskColor(), "line-width": 3.5, "line-opacity": def }, isDark);
  useGbPmtilesLayers(mapRef, EROSION_SOURCE, visible, () => [
    {
      id: GB_EROSION_FILL_ID,
      layer: () => ({
        id: GB_EROSION_FILL_ID, type: "fill", source: EROSION_SOURCE.id, "source-layer": "gb_coastal_erosion", minzoom: 8,
        filter: gbErosionZoneFilter(period),
        // 短期面包含在長期面內：sort-key 讓年份小（短期）的畫在上面
        layout: { visibility: "none", "fill-sort-key": ["-", 0, ["coalesce", ["get", "horizon_year"], 0]] },
        paint: fillPaint(opacity),
      } as unknown as AnyLayer),
      update: (map) => {
        map.setFilter(GB_EROSION_FILL_ID, gbErosionZoneFilter(period) as any);
        map.setPaintProperty(GB_EROSION_FILL_ID, "fill-opacity", fillPaint(opacity)["fill-opacity"] as any);
      },
    },
    {
      id: GB_EROSION_NI_LINE_ID,
      layer: () => ({
        id: GB_EROSION_NI_LINE_ID, type: "line", source: EROSION_SOURCE.id, "source-layer": "gb_coastal_erosion", minzoom: 8,
        filter: ["==", ["get", "kind"], "risk_appraisal"],
        layout: { visibility: "none", "line-cap": "round", "line-join": "round" }, paint: linePaint(opacity),
      } as unknown as AnyLayer),
      update: (map) => map.setPaintProperty(GB_EROSION_NI_LINE_ID, "line-opacity", linePaint(opacity)["line-opacity"] as any),
    },
  ], [opacity, period, isDark]);
}

// ─────────────────────────── 浴場 ───────────────────────────

const BATHING_SOURCE: SourceSpec = {
  id: "gb-bathing-waters", file: "gb_bathing_waters.pmtiles", minzoom: 5, maxzoom: 13, attribution: GB_WATER_MAP_ATTRIBUTION.bathing, loading: "英國浴場載入中",
};
const HAS_CLASS: Expr = ["has", "classification"];

function bathingColor(): Expr {
  const expr: unknown[] = ["match", ["coalesce", ["get", "classification"], ""]];
  for (const c of GB_BATHING_CLASSES) expr.push([...c.raw], c.color);
  expr.push(GB_BATHING_NO_CLASS_STROKE);
  return expr;
}

/** 北愛 classification 為 null → 空心點（灰框），與「未評」灰實心、「不佳」紅都分開（資料編碼描邊）。 */
function bathingPaint(isDark: boolean, opacity: number, scale: number) {
  const op = clamp01(opacity);
  const seam = pointStrokePaint(isDark, op / opacityDefault("gbBathingWaters", 0.85));
  return {
    "circle-radius": pointRadius("M", scale / scaleDefault("gbBathingWaters")),
    "circle-color": bathingColor(),
    "circle-opacity": ["case", HAS_CLASS, op, 0],
    "circle-stroke-color": ["case", HAS_CLASS, seam["circle-stroke-color"], GB_BATHING_NO_CLASS_STROKE],
    "circle-stroke-width": ["case", HAS_CLASS, seam["circle-stroke-width"], 1.5],
    "circle-stroke-opacity": ["case", HAS_CLASS, seam["circle-stroke-opacity"], op],
  };
}

export function useGbBathingWatersLayer(mapRef: React.RefObject<MapboxMap | null>, visible: boolean, opacity: number, scale: number, isDark: boolean) {
  useGbPmtilesLayers(mapRef, BATHING_SOURCE, visible, () => [{
    id: GB_BATHING_CIRCLE_ID,
    layer: () => ({
      id: GB_BATHING_CIRCLE_ID, type: "circle", source: BATHING_SOURCE.id, "source-layer": "gb_bathing_waters", minzoom: 5,
      // 預設只顯示現行指定浴場（已除名 25 處不畫）
      filter: ["==", ["get", "designated"], true],
      layout: { visibility: "none" }, paint: bathingPaint(isDark, opacity, scale),
    } as unknown as AnyLayer),
    update: (map) => {
      for (const [k, v] of Object.entries(bathingPaint(isDark, opacity, scale))) map.setPaintProperty(GB_BATHING_CIRCLE_ID, k as any, v as any);
    },
  }], [opacity, scale, isDark]);
}

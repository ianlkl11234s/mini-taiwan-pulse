import type { AnyLayer, Map as MapboxMap } from "mapbox-gl";
import { hookFillPaint } from "../map/lineFillSpec";
import { hatchImageData, hatchImageId, pointRadius, pointStrokePaint } from "../map/mapStyleScale";
import { paramDefault } from "../data/layerParamsSpec";
import {
  GB_AQUACULTURE_ATTRIBUTION, GB_AQUACULTURE_KINDS, GB_AQUACULTURE_MINZOOM, GB_AQUACULTURE_STATUSES, GB_AQUACULTURE_TILE_ZOOM,
  GB_COMPANIES_ATTRIBUTION, GB_COMPANIES_BUCKETS, GB_COMPANIES_COLOR, GB_COMPANIES_MINZOOM, GB_COMPANIES_TILE_ZOOM,
  GB_FUNERAL_ATTRIBUTION, GB_FUNERAL_KINDS, GB_FUNERAL_TILE_ZOOM, GB_MANUFACTURING_BUCKETS, GB_MANUFACTURING_COLOR,
  GB_SOIL_ATTRIBUTION, GB_SOIL_DEPTHS, GB_SOIL_MINZOOM, GB_SOIL_TILE_ZOOM, GB_W12_FALLBACK_COLOR, GB_W12_HOLLOW_STROKE,
  gbAquacultureView, gbSoilDepthColors, type GbCountBucket,
} from "../data/gbBusinessAgriTypes";
import { gbMaskFilter, gbWithFilter, useGbPmtilesLayers, type SourceSpec } from "./useGbWaterLayers";

/**
 * 英國第 12 波 5 層：公司登記與製造業（同一檔，郵遞區號 district 聚合點，依家數分級半徑）、殯葬設施（OSM 火葬場／葬儀社）、
 * 養殖場（蘇格蘭＋北愛，狀態選單，預設只畫現役）、土壤母質（BGS 1 km 模型，依土層深度分級）。靜態資料、不訂閱時間。
 */
export const GB_COMPANIES_CIRCLE_ID = "gb-companies-circle";
export const GB_MANUFACTURING_CIRCLE_ID = "gb-manufacturing-circle";
export const GB_CREMATORIUM_CIRCLE_ID = "gb-funeral-crematorium-circle";
export const GB_FUNERAL_DIRECTORS_CIRCLE_ID = "gb-funeral-directors-circle";
export const GB_AQUACULTURE_CIRCLE_ID = "gb-aquaculture-circle";
export const GB_SOIL_FILL_ID = "gb-soil-parent-material-fill";
export const GB_SOIL_NA_FILL_ID = "gb-soil-parent-material-na";

type MapRef = React.RefObject<MapboxMap | null>;
type Expr = unknown[];
const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const opacityDefault = (key: string, fallback: number) => Number(paramDefault(key, `${key}Opacity`) ?? fallback);
const scaleDefault = (key: string) => Number(paramDefault(key, `${key}Scale`) ?? 1);
const setPaint = (map: MapboxMap, id: string, paint: Record<string, unknown>) => {
  for (const [k, v] of Object.entries(paint)) map.setPaintProperty(id, k as any, v as any);
};

// ─────────────────────────── 公司登記／製造業（gb_companies.pmtiles） ───────────────────────────

const COMPANIES_SOURCE: SourceSpec = {
  id: "gb-companies", file: "gb_companies.pmtiles", ...GB_COMPANIES_TILE_ZOOM, attribution: GB_COMPANIES_ATTRIBUTION, loading: "英國公司登記載入中",
};
function countStep(field: string, buckets: readonly GbCountBucket[]): Expr {
  const expr: unknown[] = ["step", ["to-number", ["get", field], 0], buckets[0]!.radius];
  for (const b of buckets.slice(1)) expr.push(b.min, b.radius);
  return expr;
}
/** 製造業：c_C 為 0 的 district 不畫（不是缺值，是 0 家）。 */
export const GB_MANUFACTURING_FILTER: Expr = [">", ["to-number", ["get", "c_C"], 0], 0];

function countPaint(key: string, field: string, buckets: readonly GbCountBucket[], color: string, isDark: boolean, opacity: number, scale: number) {
  const op = clamp01(opacity);
  return {
    "circle-radius": ["*", countStep(field, buckets), scale / scaleDefault(key)],
    "circle-color": color,
    "circle-opacity": op,
    ...pointStrokePaint(isDark, op / opacityDefault(key, 0.8)),
  };
}

function useCountLayer(mapRef: MapRef, key: "gbCompanies" | "gbManufacturing", visible: boolean, opacity: number, scale: number, isDark: boolean) {
  const isCompanies = key === "gbCompanies";
  const id = isCompanies ? GB_COMPANIES_CIRCLE_ID : GB_MANUFACTURING_CIRCLE_ID;
  const field = isCompanies ? "total" : "c_C";
  const buckets = isCompanies ? GB_COMPANIES_BUCKETS : GB_MANUFACTURING_BUCKETS;
  const color = isCompanies ? GB_COMPANIES_COLOR : GB_MANUFACTURING_COLOR;
  useGbPmtilesLayers(mapRef, COMPANIES_SOURCE, visible, () => [{
    id,
    layer: () => ({
      id, type: "circle", source: COMPANIES_SOURCE.id, "source-layer": "gb_companies", minzoom: GB_COMPANIES_MINZOOM,
      ...(isCompanies ? {} : { filter: GB_MANUFACTURING_FILTER }),
      // 小點畫在大點上面（不被大圓蓋住）
      layout: { visibility: "none", "circle-sort-key": ["-", 0, ["to-number", ["get", field], 0]] },
      paint: countPaint(key, field, buckets, color, isDark, opacity, scale),
    } as unknown as AnyLayer),
    update: (map) => setPaint(map, id, countPaint(key, field, buckets, color, isDark, opacity, scale)),
  }], [opacity, scale, isDark]);
}

export function useGbCompaniesLayer(mapRef: MapRef, visible: boolean, opacity: number, scale: number, isDark: boolean) {
  useCountLayer(mapRef, "gbCompanies", visible, opacity, scale, isDark);
}
export function useGbManufacturingLayer(mapRef: MapRef, visible: boolean, opacity: number, scale: number, isDark: boolean) {
  useCountLayer(mapRef, "gbManufacturing", visible, opacity, scale, isDark);
}

// ─────────────────────────── 殯葬設施（gb_funeral.pmtiles） ───────────────────────────

const FUNERAL_SOURCE: SourceSpec = {
  id: "gb-funeral", file: "gb_funeral.pmtiles", ...GB_FUNERAL_TILE_ZOOM, attribution: GB_FUNERAL_ATTRIBUTION, loading: "英國殯葬設施載入中",
};
function funeralPaint(kind: (typeof GB_FUNERAL_KINDS)[number], isDark: boolean, opacity: number, scale: number) {
  const op = clamp01(opacity);
  return {
    "circle-radius": pointRadius(kind.value === "crematorium" ? "M" : "S", scale / scaleDefault("gbFuneral")),
    "circle-color": kind.color,
    "circle-opacity": op,
    ...pointStrokePaint(isDark, op / opacityDefault("gbFuneral", 0.8)),
  };
}

export function useGbFuneralLayer(mapRef: MapRef, visible: boolean, opacity: number, scale: number, kindMask: number | undefined, isDark: boolean) {
  // §3.8 V-4：火葬場／葬儀社多選
  const kindFilter = gbMaskFilter("kind", kindMask, GB_FUNERAL_KINDS.map((k) => k.value));
  const build = (id: string, kind: (typeof GB_FUNERAL_KINDS)[number]) => ({
    id,
    layer: () => ({
      id, type: "circle", source: FUNERAL_SOURCE.id, "source-layer": "gb_funeral", minzoom: kind.minzoom,
      filter: ["==", ["get", "kind"], kind.value],
      layout: { visibility: "none" }, paint: funeralPaint(kind, isDark, opacity, scale),
    } as unknown as AnyLayer),
    update: (map: MapboxMap) => setPaint(map, id, funeralPaint(kind, isDark, opacity, scale)),
  });
  // 火葬場（量少）畫在葬儀社上面
  useGbPmtilesLayers(mapRef, FUNERAL_SOURCE, visible, () => gbWithFilter([
    build(GB_FUNERAL_DIRECTORS_CIRCLE_ID, GB_FUNERAL_KINDS[1]!),
    build(GB_CREMATORIUM_CIRCLE_ID, GB_FUNERAL_KINDS[0]!),
  ], kindFilter), [opacity, scale, kindMask, isDark]);
}

// ─────────────────────────── 養殖場（gb_aquaculture.pmtiles） ───────────────────────────

const AQUACULTURE_SOURCE: SourceSpec = {
  id: "gb-aquaculture", file: "gb_aquaculture.pmtiles", ...GB_AQUACULTURE_TILE_ZOOM, attribution: GB_AQUACULTURE_ATTRIBUTION, loading: "英國養殖場載入中",
};
/** 狀態選單 → filter；預設只畫現役（active、北愛 licensed），已註銷不呈現為現役。 */
export function gbAquacultureFilter(viewIdx: number): Expr | null {
  const view = gbAquacultureView(viewIdx);
  if (view === "all") return null;
  const statuses = view === "current" ? ["active", "licensed"] : [view];
  return ["in", ["get", "status"], ["literal", statuses]];
}
function kindColor(): Expr {
  const expr: unknown[] = ["match", ["coalesce", ["get", "kind"], ""]];
  for (const k of GB_AQUACULTURE_KINDS) expr.push(k.value, k.color);
  expr.push(GB_W12_FALLBACK_COLOR);
  return expr;
}
function statusMatch(pick: (s: (typeof GB_AQUACULTURE_STATUSES)[number]) => unknown, fallback: unknown): Expr {
  const expr: unknown[] = ["match", ["coalesce", ["get", "status"], ""]];
  for (const s of GB_AQUACULTURE_STATUSES) expr.push(s.value, pick(s));
  expr.push(fallback);
  return expr;
}
/** 現役實心；暫停營運同色空心淡填；已註銷灰色空心（資料編碼描邊 P-9）。 */
function aquaculturePaint(isDark: boolean, opacity: number, scale: number) {
  const op = clamp01(opacity);
  const seam = pointStrokePaint(isDark, op / opacityDefault("gbAquaculture", 0.8));
  return {
    "circle-radius": pointRadius("M", scale / scaleDefault("gbAquaculture")),
    "circle-color": kindColor(),
    "circle-opacity": statusMatch((s) => op * s.fill, 0),
    "circle-stroke-color": statusMatch((s) => (s.hollow ? (s.neutral ? GB_W12_FALLBACK_COLOR : kindColor()) : seam["circle-stroke-color"]), GB_W12_FALLBACK_COLOR),
    "circle-stroke-width": statusMatch((s) => (s.hollow ? GB_W12_HOLLOW_STROKE : seam["circle-stroke-width"]), GB_W12_HOLLOW_STROKE),
    "circle-stroke-opacity": statusMatch((s) => (s.hollow ? op : seam["circle-stroke-opacity"]), op),
  };
}

export function useGbAquacultureLayer(mapRef: MapRef, visible: boolean, opacity: number, scale: number, viewIdx: number, kindMask: number | undefined, isDark: boolean) {
  const filter = gbAquacultureFilter(viewIdx);
  // §3.8 V-4：養殖類型多選（與狀態選單疊加）
  const kindFilter = gbMaskFilter("kind", kindMask, GB_AQUACULTURE_KINDS.map((k) => k.value));
  useGbPmtilesLayers(mapRef, AQUACULTURE_SOURCE, visible, () => gbWithFilter([{
    id: GB_AQUACULTURE_CIRCLE_ID,
    layer: () => ({
      id: GB_AQUACULTURE_CIRCLE_ID, type: "circle", source: AQUACULTURE_SOURCE.id, "source-layer": "gb_aquaculture", minzoom: GB_AQUACULTURE_MINZOOM,
      ...(filter ? { filter } : {}),
      // 現役畫在上面
      layout: { visibility: "none", "circle-sort-key": statusMatch((s) => s.fill, 0) },
      paint: aquaculturePaint(isDark, opacity, scale),
    } as unknown as AnyLayer),
    update: (map) => {
      map.setFilter(GB_AQUACULTURE_CIRCLE_ID, (filter ?? null) as any);
      setPaint(map, GB_AQUACULTURE_CIRCLE_ID, aquaculturePaint(isDark, opacity, scale));
    },
  }], kindFilter), [opacity, scale, viewIdx, kindMask, isDark]);
}

// ─────────────────────────── 土壤母質（gb_soil_parent_material.pmtiles） ───────────────────────────

const SOIL_SOURCE: SourceSpec = {
  id: "gb-soil-parent-material", file: "gb_soil_parent_material.pmtiles", ...GB_SOIL_TILE_ZOOM, attribution: GB_SOIL_ATTRIBUTION, loading: "英國土壤母質載入中",
};
function soilDepthColor(isDark: boolean): Expr {
  const colors = gbSoilDepthColors(isDark);
  const expr: unknown[] = ["match", ["coalesce", ["get", "soil_depth"], ""]];
  GB_SOIL_DEPTHS.forEach((d, i) => expr.push(d.value, colors[i]!));
  expr.push("rgba(0,0,0,0)");
  return expr;
}
const SOIL_DEPTH_KNOWN: Expr = ["in", ["coalesce", ["get", "soil_depth"], ""], ["literal", GB_SOIL_DEPTHS.map((d) => d.value)]];
const SOIL_DEPTH_MISSING: Expr = ["!", SOIL_DEPTH_KNOWN];
function ensureHatchImages(map: MapboxMap) {
  for (const dark of [true, false]) {
    const id = hatchImageId("missing", dark);
    if (!map.hasImage(id)) map.addImage(id, hatchImageData("missing", dark));
  }
  return undefined;
}

/** 1 km 方格相鄰面：關 antialias，避免半透明邊緣重疊成白色格線（比照 temperatureGrid）。 */
export function useGbSoilParentMaterialLayer(mapRef: MapRef, visible: boolean, opacity: number, isDark: boolean) {
  const def = opacityDefault("gbSoilParentMaterial", 0.55);
  const fill = (op: number) => hookFillPaint("gbSoilParentMaterial", GB_SOIL_FILL_ID,
    { "fill-color": soilDepthColor(isDark), "fill-opacity": clamp01(op), "fill-antialias": false }, { "fill-color": soilDepthColor(isDark), "fill-opacity": def }, isDark);
  const hatch = (op: number) => hookFillPaint("gbSoilParentMaterial", GB_SOIL_NA_FILL_ID,
    { "fill-pattern": hatchImageId("missing", isDark), "fill-opacity": clamp01(op) }, { "fill-pattern": hatchImageId("missing", isDark), "fill-opacity": def }, isDark);
  useGbPmtilesLayers(mapRef, SOIL_SOURCE, visible, () => [
    {
      id: GB_SOIL_FILL_ID,
      layer: () => ({
        id: GB_SOIL_FILL_ID, type: "fill", source: SOIL_SOURCE.id, "source-layer": "gb_soil_parent_material", minzoom: GB_SOIL_MINZOOM,
        filter: SOIL_DEPTH_KNOWN, layout: { visibility: "none" }, paint: fill(opacity),
      } as unknown as AnyLayer),
      update: (map) => setPaint(map, GB_SOIL_FILL_ID, fill(opacity)),
    },
    {
      id: GB_SOIL_NA_FILL_ID,
      // 缺值斜線（F-3）：圖片要在 addLayer 前登記
      before: ensureHatchImages,
      layer: () => ({
        id: GB_SOIL_NA_FILL_ID, type: "fill", source: SOIL_SOURCE.id, "source-layer": "gb_soil_parent_material", minzoom: GB_SOIL_MINZOOM,
        filter: SOIL_DEPTH_MISSING, layout: { visibility: "none" }, paint: hatch(opacity),
      } as unknown as AnyLayer),
      update: (map) => setPaint(map, GB_SOIL_NA_FILL_ID, hatch(opacity)),
    },
  ], [opacity, isDark]);
}

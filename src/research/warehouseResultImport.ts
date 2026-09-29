import type { AnalysisResult } from "./analysisOperations";
import { validateWarehouseResultStyle, type WarehouseResultStyle } from "./warehouseResultStyle";

/**
 * Server-side warehouse results (ADR-0014) arrive as a local GeoJSON file plus a small
 * relay message {resultId, sha256, label, featureCount}. The browser fetches the file
 * over the DEV loopback middleware, verifies its SHA-256, and registers one session
 * result per geometry type so the existing result-collection presentation can draw it.
 */
export type WarehouseImportArgs = { resultId: string; sha256: string; label: string; featureCount: number; style?: WarehouseResultStyle };
export type WarehouseImportGeometry = "Point" | "LineString" | "MultiLineString" | "Polygon" | "MultiPolygon";

const RESULT_ID = /^wh-[0-9]{1,6}$/;
const SHA256 = /^[a-f0-9]{64}$/;
export const WAREHOUSE_RESULT_MAX_FEATURES = 5000;

export function warehouseResultFileName(resultId: string): string | null {
  return RESULT_ID.test(resultId) ? `${resultId}.geojson` : null;
}

export function validateWarehouseImportArgs(args: Record<string, unknown>): WarehouseImportArgs {
  const keys = Object.keys(args);
  if (!keys.every(key => ["resultId", "sha256", "label", "featureCount", "style"].includes(key))) throw new Error("WAREHOUSE_RESULT_INVALID");
  const { resultId, sha256, label, featureCount } = args;
  if (typeof resultId !== "string" || !RESULT_ID.test(resultId)) throw new Error("WAREHOUSE_RESULT_INVALID");
  if (typeof sha256 !== "string" || !SHA256.test(sha256)) throw new Error("WAREHOUSE_RESULT_INVALID");
  if (typeof label !== "string" || !label.trim() || label.length > 120) throw new Error("WAREHOUSE_RESULT_INVALID");
  if (typeof featureCount !== "number" || !Number.isInteger(featureCount) || featureCount < 0 || featureCount > WAREHOUSE_RESULT_MAX_FEATURES) throw new Error("WAREHOUSE_RESULT_INVALID");
  return { resultId, sha256, label: label.trim(), featureCount, ...(args.style !== undefined ? { style: validateWarehouseResultStyle(args.style) } : {}) };
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

type Position = [number, number];
function isPosition(value: unknown): value is Position {
  return Array.isArray(value) && value.length >= 2 && typeof value[0] === "number" && typeof value[1] === "number"
    && Number.isFinite(value[0]) && Number.isFinite(value[1]) && value[0] >= -180 && value[0] <= 180 && value[1] >= -90 && value[1] <= 90;
}
function positionsOf(value: unknown, depth: number): Position[] | null {
  if (depth === 0) return isPosition(value) ? [[value[0], value[1]]] : null;
  if (!Array.isArray(value) || value.length === 0) return null;
  const out: Position[] = [];
  for (const part of value) { const positions = positionsOf(part, depth - 1); if (!positions) return null; out.push(...positions); }
  return out;
}
const DEPTH: Record<WarehouseImportGeometry, number> = { Point: 0, LineString: 1, MultiLineString: 2, Polygon: 2, MultiPolygon: 3 };

/** Normalized features: MultiPoint is split into Points; unsupported or invalid geometry rejects the whole file. */
export function normalizeWarehouseFeatures(collection: unknown): { type: WarehouseImportGeometry; geometry: { type: string; coordinates: unknown }; properties: Record<string, unknown> }[] {
  if (!collection || typeof collection !== "object" || (collection as { type?: unknown }).type !== "FeatureCollection" || !Array.isArray((collection as { features?: unknown }).features)) throw new Error("WAREHOUSE_RESULT_INVALID");
  const out: { type: WarehouseImportGeometry; geometry: { type: string; coordinates: unknown }; properties: Record<string, unknown> }[] = [];
  for (const feature of (collection as { features: unknown[] }).features) {
    const geometry = (feature as { geometry?: { type?: unknown; coordinates?: unknown } } | null)?.geometry;
    const rawProperties = (feature as { properties?: unknown } | null)?.properties;
    const properties = rawProperties && typeof rawProperties === "object" && !Array.isArray(rawProperties) ? rawProperties as Record<string, unknown> : {};
    if (!geometry || typeof geometry.type !== "string") throw new Error("WAREHOUSE_RESULT_INVALID");
    if (geometry.type === "MultiPoint") {
      const points = positionsOf(geometry.coordinates, 1);
      if (!points) throw new Error("WAREHOUSE_RESULT_INVALID");
      for (const point of points) out.push({ type: "Point", geometry: { type: "Point", coordinates: point }, properties });
      continue;
    }
    if (!(geometry.type in DEPTH) || !positionsOf(geometry.coordinates, DEPTH[geometry.type as WarehouseImportGeometry])) throw new Error("WAREHOUSE_RESULT_INVALID");
    out.push({ type: geometry.type as WarehouseImportGeometry, geometry: { type: geometry.type, coordinates: geometry.coordinates }, properties });
  }
  return out;
}

/**
 * Per-feature location precision written by the MCP warehouse (`pulse_wh_present`, from its
 * wh_catalog precision_class): actual | approximate | derived | unknown. Absent (an older MCP) or
 * anything other than "actual" is treated conservatively as not spatial-analysis eligible.
 */
export const WAREHOUSE_LOCATION_PRECISION_PROPERTY = "_wh_location_precision";

/**
 * Geometry contract for one imported geometry group. Only a Point/Line group whose every feature is
 * `actual` stays eligible for browser spatial analysis. Other Points/Lines are still drawn, using the
 * roles the presentation layer accepts for non-eligible geometry (Point → generalized, Line → proxy).
 * Polygons may be derived (e.g. SQL buffers), so they are shown but never re-analysed.
 */
export function warehouseGeometryFor(type: WarehouseImportGeometry, group: readonly { properties: Record<string, unknown> }[]): AnalysisResult["geometry"] {
  if (type === "Polygon" || type === "MultiPolygon") return { type, role: "derived", spatialAnalysisEligible: false };
  const actual = group.length > 0 && group.every(feature => feature.properties[WAREHOUSE_LOCATION_PRECISION_PROPERTY] === "actual");
  if (actual) return { type, role: "actual", spatialAnalysisEligible: true };
  return { type, role: type === "Point" ? "generalized" : "proxy", spatialAnalysisEligible: false };
}

export function warehouseResultIdFor(resultId: string, type: WarehouseImportGeometry, groupCount: number): string {
  return groupCount === 1 ? resultId : `${resultId}:${type.toLowerCase()}`;
}

/** Fetch, verify and convert a warehouse result into one AnalysisResult per geometry type. */
export async function loadWarehouseResult(args: WarehouseImportArgs, fetchImpl: typeof fetch = fetch): Promise<AnalysisResult[]> {
  let response: Response;
  try {
    response = await fetchImpl(`/__warehouse-results/${warehouseResultFileName(args.resultId)}`, { cache: "no-store" });
  } catch {
    throw new Error("WAREHOUSE_RESULT_UNAVAILABLE");
  }
  if (!response.ok) throw new Error("WAREHOUSE_RESULT_UNAVAILABLE");
  const text = await response.text();
  if (await sha256Hex(text) !== args.sha256) throw new Error("WAREHOUSE_RESULT_SHA_MISMATCH");
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { throw new Error("WAREHOUSE_RESULT_INVALID"); }
  const featureCount = Array.isArray((parsed as { features?: unknown })?.features) ? (parsed as { features: unknown[] }).features.length : -1;
  if (featureCount !== args.featureCount) throw new Error("WAREHOUSE_RESULT_INVALID");
  // T1=L1: a series-styled result carries no geometry at all (an empty FeatureCollection) — one
  // non-spatial AnalysisResult, not "one per geometry type" (the loop below never runs for it, since
  // an empty `features` list yields an empty `types` set). Any actual feature alongside a series
  // style is a contract violation, not silently dropped.
  if (args.style?.kind === "series") {
    if (featureCount > 0) throw new Error("WAREHOUSE_RESULT_STYLE_INVALID");
    const createdAt = new Date().toISOString();
    return [{
      resultId: args.resultId,
      datasetId: `warehouse:${args.resultId}`,
      recordGrain: "series",
      rows: [],
      geometry: { type: "none", role: "none", spatialAnalysisEligible: false },
      sourceRefs: [],
      lineage: { origin: "warehouse", warehouseResultId: args.resultId, sha256: args.sha256, warehouseDatasets: [], createdAt },
      coverage: "Server-side analysis warehouse result; see the MCP warehouse result lineage for source datasets and versions.",
      freshness: "unknown",
      units: { value: args.style.unit },
      operation: "warehouse_import",
      inputResultIds: [],
      method: { operation: "import_warehouse_result", version: "0.1", sha256Verified: true },
      summary: { featureCount: 0, geometryType: "none", label: args.label },
      resultStyle: args.style,
    } satisfies AnalysisResult];
  }
  const features = normalizeWarehouseFeatures(parsed);
  const types = [...new Set(features.map(feature => feature.type))];
  if (args.style?.kind === "heatmap" && types.some(type => type !== "Point")) throw new Error("WAREHOUSE_RESULT_STYLE_INVALID");
  if (args.style?.kind === "compare" && (types.some(type => type !== "Point") || features.length !== args.style.columns.length)) throw new Error("WAREHOUSE_RESULT_STYLE_INVALID");
  // Proportional symbols are sized circles (Point only); bivariate fills an area and sizes a bubble
  // at its anchor (Polygon/MultiPolygon only). Any other geometry would silently lose the style.
  if (args.style?.kind === "proportional" && types.some(type => type !== "Point")) throw new Error("WAREHOUSE_RESULT_STYLE_INVALID");
  if (args.style?.kind === "bivariate" && types.some(type => type !== "Polygon" && type !== "MultiPolygon")) throw new Error("WAREHOUSE_RESULT_STYLE_INVALID");
  const createdAt = new Date().toISOString();
  return types.map(type => {
    const group = features.filter(feature => feature.type === type);
    const datasets = [...new Set(group.map(feature => feature.properties._wh_dataset).filter((value): value is string => typeof value === "string" && value.length > 0))];
    return {
      resultId: warehouseResultIdFor(args.resultId, type, types.length),
      datasetId: `warehouse:${args.resultId}`,
      recordGrain: "feature",
      rows: group.map((feature, index) => {
        const name = ["name", "名稱", "school_name", "title"].map(key => feature.properties[key]).find(value => typeof value === "string" && value.trim());
        return { ...feature.properties, record_id: `${args.resultId}:${type}:${index}`, label: typeof name === "string" ? name : args.label, geometry: feature.geometry };
      }),
      geometry: warehouseGeometryFor(type, group),
      sourceRefs: [],
      lineage: { origin: "warehouse", warehouseResultId: args.resultId, sha256: args.sha256, warehouseDatasets: datasets, createdAt },
      coverage: "Server-side analysis warehouse result; see the MCP warehouse result lineage for source datasets and versions.",
      freshness: "unknown",
      units: {},
      operation: "warehouse_import",
      inputResultIds: [],
      method: { operation: "import_warehouse_result", version: "0.1", sha256Verified: true },
      summary: { featureCount: group.length, geometryType: type, label: args.label },
      ...(args.style ? { resultStyle: args.style } : {}),
    } satisfies AnalysisResult;
  });
}

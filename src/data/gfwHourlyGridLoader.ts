import { withLoading } from "../lib/loadingRegistry";
import { parseGfwHourlyGridVessels } from "./gfwHourlyGridTypes";
import {
  isGfwHourlyProductionManifestUrl,
  parseGfwHourlyUnifiedManifest,
  resolveGfwHourlyRootManifestUrl,
} from "./gfwHourlyReleaseManifest";
import type { GfwDetailBucket } from "./gfwHourlyReleaseManifest";

export const GFW_HOURLY_GRID_LOCAL_MANIFEST_URL = "/gfw_hourly_grid_poc/manifest.json";

export function resolveGfwHourlyGridManifestUrl(
  cdnBase = import.meta.env.VITE_GLOBAL_MARITIME_CDN_BASE ?? "",
  isDev = import.meta.env.DEV,
  shadowEnabled = import.meta.env.VITE_GFW_HOURLY_V3_SHADOW_ENABLED === "true",
): string | null {
  return resolveGfwHourlyRootManifestUrl(GFW_HOURLY_GRID_LOCAL_MANIFEST_URL, cdnBase, isDev, shadowEnabled);
}

export interface GfwHourlyGridManifestHour {
  observedAt: string;
  observedAtMs: number;
  path: string;
  cellCount: number;
  vesselCount: number;
  format: "geojson" | "pmtiles";
  detailBuckets: readonly GfwDetailBucket[];
}

export interface GfwHourlyGridManifest {
  manifestUrl: string;
  releaseId: string;
  schemaVersion: 1 | 2 | 3;
  generatedAt: string;
  bbox: [number, number, number, number];
  dateStart: string;
  dateEndInclusive: string;
  sourceDataset: string;
  temporalResolution: "HOURLY";
  spatialResolution: "HIGH";
  coordinateSemantics: string;
  fullFidelity: boolean;
  geometrySemantics: "GFW_HIGH_grid_cell_center" | "inferred_0_01_degree_footprint";
  sourceLayer: string | null;
  attribution: { label: string; href: string };
  hours: GfwHourlyGridManifestHour[];
}

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isUtcHour(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:00:00Z$/.test(value) && Number.isFinite(Date.parse(value));
}

export function floorUtcHourIso(timeSeconds: number): string {
  const d = new Date(Math.floor(timeSeconds / 3600) * 3600 * 1000);
  return d.toISOString().replace(".000Z", "Z");
}

export function parseGfwHourlyGridManifest(
  raw: unknown,
  manifestUrl = GFW_HOURLY_GRID_LOCAL_MANIFEST_URL,
): GfwHourlyGridManifest | null {
  const unified = parseGfwHourlyUnifiedManifest(raw, manifestUrl);
  if (unified) {
    return {
      manifestUrl,
      releaseId: unified.releaseId,
      schemaVersion: unified.schemaVersion,
      generatedAt: unified.generatedAt ?? "",
      bbox: unified.bbox,
      dateStart: unified.dateStart,
      dateEndInclusive: unified.dateEnd,
      sourceDataset: unified.datasetAlias,
      temporalResolution: "HOURLY",
      spatialResolution: "HIGH",
      coordinateSemantics: unified.sourceCoordinateSemantics,
      fullFidelity: unified.fullFidelity,
      geometrySemantics: unified.gridGeometrySemantics,
      sourceLayer: unified.gridSourceLayer,
      attribution: unified.attribution,
      hours: [...unified.gridHours.values()].map((hour) => ({
        observedAt: hour.observedAt,
        observedAtMs: hour.observedAtMs,
        path: hour.path,
        cellCount: hour.features,
        vesselCount: hour.vesselCount,
        format: hour.format,
        detailBuckets: hour.detailBuckets,
      })),
    };
  }
  if (isGfwHourlyProductionManifestUrl(manifestUrl)) return null;
  if (!isObject(raw) || raw.schema_version !== 1) return null;
  if (raw.temporal_resolution !== "HOURLY" || raw.spatial_resolution !== "HIGH") return null;
  if (raw.coordinate_semantics !== "GFW_HIGH_grid_cell_center") return null;
  if (
    typeof raw.generated_at !== "string" ||
    typeof raw.date_start !== "string" ||
    typeof raw.date_end_inclusive !== "string" ||
    typeof raw.source_dataset !== "string" ||
    !Array.isArray(raw.bbox) || raw.bbox.length !== 4 || !raw.bbox.every(isFiniteNumber) ||
    !Array.isArray(raw.hours)
  ) return null;

  const hours: GfwHourlyGridManifestHour[] = [];
  let previousMs = -Infinity;
  for (const item of raw.hours) {
    if (!isObject(item)) return null;
    const observedAt = item.observed_at;
    if (
      typeof observedAt !== "string" || !isUtcHour(observedAt) ||
      typeof item.path !== "string" || item.path.length === 0 ||
      !Number.isInteger(item.cell_count) || (item.cell_count as number) < 0 ||
      !Number.isInteger(item.vessel_count) || (item.vessel_count as number) < 0
    ) return null;
    const observedAtMs = Date.parse(observedAt);
    if (observedAtMs <= previousMs) return null;
    previousMs = observedAtMs;
    hours.push({
      observedAt,
      observedAtMs,
      path: item.path,
      cellCount: item.cell_count as number,
      vesselCount: item.vessel_count as number,
      format: "geojson",
      detailBuckets: [],
    });
  }

  return {
    manifestUrl,
    releaseId: `dev-${raw.date_end_inclusive}`,
    schemaVersion: 1,
    generatedAt: raw.generated_at,
    bbox: raw.bbox as [number, number, number, number],
    dateStart: raw.date_start,
    dateEndInclusive: raw.date_end_inclusive,
    sourceDataset: raw.source_dataset,
    temporalResolution: "HOURLY",
    spatialResolution: "HIGH",
    coordinateSemantics: "GFW_HIGH_grid_cell_center",
    fullFidelity: false,
    geometrySemantics: "GFW_HIGH_grid_cell_center",
    sourceLayer: null,
    attribution: { label: "Global Fishing Watch", href: "https://globalfishingwatch.org/" },
    hours,
  };
}

export interface GfwHourlyGridFeatureContract {
  fullFidelity: boolean;
  geometrySemantics: "GFW_HIGH_grid_cell_center" | "inferred_0_01_degree_footprint";
  sourceCoordinateSemantics?: string;
}

export function parseGfwHourlyGridFeatureCollection(
  raw: unknown,
  expectedHour?: string,
  contract: GfwHourlyGridFeatureContract = {
    fullFidelity: false,
    geometrySemantics: "GFW_HIGH_grid_cell_center",
  },
): GeoJSON.FeatureCollection | null {
  if (!isObject(raw) || raw.type !== "FeatureCollection" || !Array.isArray(raw.features)) return null;
  const features: GeoJSON.Feature[] = [];
  for (const candidate of raw.features) {
    if (!isObject(candidate) || candidate.type !== "Feature" || !isObject(candidate.geometry)) return null;
    const isPolygon = contract.geometrySemantics === "inferred_0_01_degree_footprint";
    if (candidate.geometry.type !== (isPolygon ? "Polygon" : "Point") || !Array.isArray(candidate.geometry.coordinates)) return null;
    const coordinates = candidate.geometry.coordinates;
    if (!isPolygon && (coordinates.length < 2 || !isFiniteNumber(coordinates[0]) || !isFiniteNumber(coordinates[1]))) return null;
    if (isPolygon) {
      const rings = coordinates as unknown[];
      if (!rings.length || !rings.every((ring) => Array.isArray(ring) && ring.length >= 4 && ring.every((point) =>
        Array.isArray(point) && point.length >= 2 && isFiniteNumber(point[0]) && isFiniteNumber(point[1]),
      ))) return null;
    }
    if (!isObject(candidate.properties)) return null;
    const p = candidate.properties;
    const centerLon = isPolygon ? p.center_lon : p.grid_lon;
    const centerLat = isPolygon ? p.center_lat : p.grid_lat;
    if (
      typeof p.observed_at !== "string" || !isUtcHour(p.observed_at) ||
      !isFiniteNumber(centerLon) || !isFiniteNumber(centerLat) ||
      !Number.isInteger(p.vessel_count) || (p.vessel_count as number) < 1 ||
      typeof p.vessels_json !== "string" ||
      typeof p.source_dataset !== "string" ||
      (!isPolygon && p.coordinate_semantics !== "GFW_HIGH_grid_cell_center") ||
      (isPolygon && (typeof p.cell_id !== "string" || p.cell_id.trim() === ""))
    ) return null;
    if (expectedHour && p.observed_at !== expectedHour) return null;
    const vessels = parseGfwHourlyGridVessels(p.vessels_json);
    if (!vessels || vessels.length !== p.vessel_count) return null;
    features.push({
      ...(candidate as unknown as GeoJSON.Feature),
      properties: {
        ...p,
        full_fidelity: contract.fullFidelity ? 1 : 0,
        coordinate_semantics: contract.sourceCoordinateSemantics ?? "GFW_HIGH_grid_cell_center",
        geometry_semantics: contract.geometrySemantics,
        source_coordinate_semantics: contract.sourceCoordinateSemantics ?? "GFW_HIGH_grid_cell_center",
      },
    });
  }
  return { type: "FeatureCollection", features };
}

export function findGfwHourlyGridHour(
  manifest: GfwHourlyGridManifest,
  hourIso: string,
): GfwHourlyGridManifestHour | null {
  return manifest.hours.find((hour) => hour.observedAt === hourIso) ?? null;
}

export function loadGfwHourlyGridManifest(): Promise<GfwHourlyGridManifest | null> {
  const manifestUrl = resolveGfwHourlyGridManifestUrl();
  if (!manifestUrl) return Promise.resolve(null);
  return withLoading(
    "gfw-hourly-grid:manifest",
    "GFW 小時網格清單",
    fetch(manifestUrl, { cache: "no-cache" })
      .then(async (response) => response.ok
        ? parseGfwHourlyGridManifest(await response.json(), manifestUrl)
        : null)
      .catch(() => null),
  );
}

const hourPromises = new Map<string, Promise<GeoJSON.FeatureCollection | null>>();

export async function loadGfwHourlyGridHour(
  manifest: GfwHourlyGridManifest,
  hourIso: string,
): Promise<GeoJSON.FeatureCollection | null> {
  const hour = findGfwHourlyGridHour(manifest, hourIso);
  // PMTiles 的 source-layer/sidecar index 尚未由 collector 定稿；不猜 schema，也不 fetch 假資料。
  if (!hour || hour.format === "pmtiles") return null;
  const key = `${manifest.releaseId}|${hourIso}`;
  const cached = hourPromises.get(key);
  if (cached) return cached;
  const promise = withLoading(
    `gfw-hourly-grid:${hourIso}`,
    `GFW 小時網格 ${hourIso.slice(0, 13)}:00 UTC`,
    fetch(new URL(
      hour.path,
      new URL(manifest.manifestUrl, globalThis.location?.origin ?? "http://localhost"),
    ).toString(), { cache: "force-cache" })
      .then(async (response) => response.ok
        ? parseGfwHourlyGridFeatureCollection(await response.json(), hourIso, {
          fullFidelity: manifest.fullFidelity,
          geometrySemantics: manifest.geometrySemantics,
          sourceCoordinateSemantics: manifest.coordinateSemantics,
        })
        : null)
      .catch(() => null),
  );
  hourPromises.set(key, promise);
  void promise.then((data) => {
    if (!data && hourPromises.get(key) === promise) hourPromises.delete(key);
  });
  return promise;
}

import { withLoading } from "../lib/loadingRegistry";
import { parseGfwHourlyGridVessels } from "./gfwHourlyGridTypes";
import {
  isGfwHourlyProductionManifestUrl,
  parseGfwHourlyUnifiedManifest,
  resolveGfwHourlyRootManifestUrl,
} from "./gfwHourlyReleaseManifest";
import type { GfwDetailBucket } from "./gfwHourlyReleaseManifest";
import {
  loadGfwV4Release,
  resolveGfwV4RootManifestUrl,
  type GfwV4Release,
} from "./gfwV4ReleaseLoader";

export const GFW_HOURLY_GRID_LOCAL_MANIFEST_URL = "/gfw_hourly_grid_poc/manifest.json";
export const GFW_HOURLY_GRID_V4_SHADOW_MANIFEST_URL = "/gfw-v4-poc/manifest.json";

export function resolveGfwHourlyGridManifestUrl(
  cdnBase = import.meta.env.VITE_GLOBAL_MARITIME_CDN_BASE ?? "",
  isDev = import.meta.env.DEV,
  shadowEnabled = import.meta.env.VITE_GFW_HOURLY_V3_SHADOW_ENABLED === "true",
  locationSearch = globalThis.location?.search ?? "",
): string | null {
  // Formal v4 is always the first candidate. The historical resolver remains
  // below as an explicit fail-closed v2/v3 fallback, never as a query switch.
  void isDev; void shadowEnabled; void locationSearch;
  return resolveGfwV4RootManifestUrl(cdnBase);
}

function resolveLegacyGfwHourlyGridManifestUrl(
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
  sha256?: string;
  bytes?: number;
  detailMode?: "hash-prefix" | "adaptive-shard";
  detailBuckets: readonly GfwDetailBucket[];
}

export interface GfwHourlyGridManifest {
  manifestUrl: string;
  releaseId: string;
  schemaVersion: 1 | 2 | 3 | 4;
  generatedAt: string;
  bbox: [number, number, number, number];
  dateStart: string;
  dateEndInclusive: string;
  sourceDataset: string;
  temporalResolution: "HOURLY";
  spatialResolution: "HIGH" | "HIGH_TO_LOCAL_0_1";
  coordinateSemantics: string;
  fullFidelity: boolean;
  geometrySemantics: "GFW_HIGH_grid_cell_center" | "inferred_0_01_degree_footprint" | "globally_aligned_0_1_degree_cell";
  sourceLayer: string | null;
  attribution: { label: string; href: string };
  hours: GfwHourlyGridManifestHour[];
}

function gridManifestFromV4(release: GfwV4Release): GfwHourlyGridManifest {
  return {
    manifestUrl: release.rootUrl,
    releaseId: release.releaseId,
    schemaVersion: 4,
    generatedAt: "",
    bbox: [...release.bbox] as [number, number, number, number],
    dateStart: release.selectedUtcDate,
    dateEndInclusive: release.selectedUtcDate,
    sourceDataset: release.sourceDatasetId,
    temporalResolution: "HOURLY",
    spatialResolution: "HIGH_TO_LOCAL_0_1",
    coordinateSemantics: "GFW_HIGH_locally_aggregated_to_globally_aligned_0_1_degree_cell",
    fullFidelity: true,
    geometrySemantics: "globally_aligned_0_1_degree_cell",
    sourceLayer: release.grid.sourceLayer,
    attribution: { label: "Global Fishing Watch", href: "https://globalfishingwatch.org/" },
    hours: release.grid.hours.map((entry) => ({
      observedAt: entry.observedAt,
      observedAtMs: Date.parse(entry.observedAt),
      path: entry.path,
      cellCount: entry.cellCount,
      vesselCount: entry.vesselCount,
      format: "pmtiles" as const,
      sha256: entry.sha256,
      bytes: entry.bytes,
      detailMode: "adaptive-shard" as const,
      detailBuckets: entry.details,
    })),
  };
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

const sha256 = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{64}$/i.test(value);
const nonNegativeInt = (value: unknown): value is number => Number.isInteger(value) && (value as number) >= 0;
const positiveInt = (value: unknown): value is number => Number.isInteger(value) && (value as number) > 0;
const safeRelativePath = (value: unknown): value is string =>
  typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(value) &&
  !value.split("/").some((part) => part === "." || part === "..");

function isV4ShadowManifestUrl(url: string): boolean {
  try {
    return new URL(url, "http://localhost").pathname === GFW_HOURLY_GRID_V4_SHADOW_MANIFEST_URL;
  } catch {
    return false;
  }
}

/** Strict DEV-only adapter for the immutable 24-hour East Asia v4 shadow POC root. */
export function parseGfwHourlyGridV4ShadowManifest(
  raw: unknown,
  manifestUrl = GFW_HOURLY_GRID_V4_SHADOW_MANIFEST_URL,
): GfwHourlyGridManifest | null {
  if (!isV4ShadowManifestUrl(manifestUrl) || !isObject(raw) || raw.schema_version !== 1 || raw.poc !== true ||
    raw.shadow_only !== true || raw.production_cutover !== false || raw.immutable_local_output !== true ||
    typeof raw.generated_at !== "string" || !Number.isFinite(Date.parse(raw.generated_at)) ||
    typeof raw.release_id !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(raw.release_id) ||
    raw.selected_utc_date !== raw.release_id ||
    !Array.isArray(raw.bbox) || raw.bbox.length !== 4 || !raw.bbox.every(isFiniteNumber) ||
    raw.bbox.some((value, index) => value !== [115.93462, 20.36314, 134.73486, 36.52495][index]) ||
    !positiveInt(raw.artifact_bytes) || !Array.isArray(raw.artifacts) || !isObject(raw.readback) ||
    raw.readback.status !== "passed" || raw.readback.checked_assets !== raw.artifacts.length ||
    raw.readback.checked_bytes !== raw.artifact_bytes || !isObject(raw.grid) ||
    raw.grid.source !== "compare SQLite canonical source='HIGH' locally aggregated" ||
    raw.grid.source_layer !== "gfw_grid_0_1" || raw.grid.resolution_degrees !== 0.1 ||
    raw.grid.hour_count !== 24 || raw.grid.hour_query_count !== 24 || !Array.isArray(raw.grid.hours) ||
    raw.grid.hours.length !== 24
  ) return null;

  const artifactByPath = new Map<string, JsonObject>();
  let artifactBytes = 0;
  for (const candidate of raw.artifacts) {
    if (!isObject(candidate) || !safeRelativePath(candidate.path) || artifactByPath.has(candidate.path) ||
      !positiveInt(candidate.bytes) || !sha256(candidate.sha256) || typeof candidate.type !== "string") return null;
    artifactByPath.set(candidate.path, candidate);
    artifactBytes += candidate.bytes;
  }
  if (artifactBytes !== raw.artifact_bytes) return null;

  const sameAsset = (candidate: JsonObject): boolean => {
    const indexed = typeof candidate.path === "string" ? artifactByPath.get(candidate.path) : undefined;
    return Boolean(indexed && indexed.type === candidate.type && indexed.bytes === candidate.bytes &&
      indexed.sha256 === candidate.sha256 && indexed.features === candidate.features && indexed.vessels === candidate.vessels);
  };

  const hours: GfwHourlyGridManifestHour[] = [];
  const dayStart = Date.parse(`${raw.release_id}T00:00:00Z`);
  for (let index = 0; index < 24; index += 1) {
    const candidate = raw.grid.hours[index];
    const observedAt = new Date(dayStart + index * 3_600_000).toISOString().replace(".000Z", "Z");
    const stamp = observedAt.replace(/[-:]/g, "").slice(0, 11) + "Z";
    if (!isObject(candidate) || candidate.observed_at !== observedAt || !isObject(candidate.pmtiles) ||
      !Array.isArray(candidate.details) || candidate.details.length === 0) return null;
    const pmtiles = candidate.pmtiles;
    if (!isObject(pmtiles.semantic_readback)) return null;
    const semanticReadback = pmtiles.semantic_readback;
    const semanticProperties = semanticReadback.properties;
    if (pmtiles.type !== "grid_hour_pmtiles" || pmtiles.path !== `grid/hours/${stamp}.pmtiles` ||
      !positiveInt(pmtiles.bytes) || !sha256(pmtiles.sha256) ||
      !nonNegativeInt(pmtiles.features) || !nonNegativeInt(pmtiles.vessels) || !sameAsset(pmtiles) ||
      semanticReadback.status !== "passed" || semanticReadback.source_layer !== "gfw_grid_0_1" ||
      semanticReadback.expected_cells !== pmtiles.features || semanticReadback.unique_cells !== pmtiles.features ||
      !Array.isArray(semanticProperties) ||
      ["cell_id", "vessel_count", "detail_shard"].some((key) => !semanticProperties.includes(key))
    ) return null;

    const detailBuckets: GfwDetailBucket[] = [];
    let detailFeatures = 0;
    let detailVessels = 0;
    for (let shardIndex = 0; shardIndex < candidate.details.length; shardIndex += 1) {
      const detail = candidate.details[shardIndex];
      const shard = `part-${String(shardIndex).padStart(4, "0")}.json.gz`;
      if (!isObject(detail) || detail.type !== "grid_detail" ||
        detail.path !== `grid/details/${stamp}/${shard}` || !positiveInt(detail.bytes) || !sha256(detail.sha256) ||
        !nonNegativeInt(detail.features) || !nonNegativeInt(detail.vessels) || !sameAsset(detail)) return null;
      detailFeatures += detail.features;
      detailVessels += detail.vessels;
      detailBuckets.push({ bucket: shard, path: detail.path, sha256: detail.sha256, bytes: detail.bytes, features: detail.features });
    }
    if (detailFeatures !== pmtiles.features || detailVessels !== pmtiles.vessels) return null;
    hours.push({
      observedAt,
      observedAtMs: Date.parse(observedAt),
      path: pmtiles.path,
      cellCount: pmtiles.features,
      vesselCount: pmtiles.vessels,
      format: "pmtiles",
      sha256: pmtiles.sha256,
      bytes: pmtiles.bytes,
      detailMode: "adaptive-shard",
      detailBuckets,
    });
  }

  return {
    manifestUrl,
    releaseId: raw.release_id,
    schemaVersion: 4,
    generatedAt: raw.generated_at,
    bbox: raw.bbox as [number, number, number, number],
    dateStart: raw.release_id,
    dateEndInclusive: raw.release_id,
    sourceDataset: "public-global-presence:latest (HIGH; locally aggregated 0.1 degree)",
    temporalResolution: "HOURLY",
    spatialResolution: "HIGH_TO_LOCAL_0_1",
    coordinateSemantics: "GFW_HIGH_locally_aggregated_to_globally_aligned_0_1_degree_cell",
    fullFidelity: true,
    geometrySemantics: "globally_aligned_0_1_degree_cell",
    sourceLayer: "gfw_grid_0_1",
    attribution: { label: "Global Fishing Watch", href: "https://globalfishingwatch.org/" },
    hours,
  };
}

export function floorUtcHourIso(timeSeconds: number): string {
  const d = new Date(Math.floor(timeSeconds / 3600) * 3600 * 1000);
  return d.toISOString().replace(".000Z", "Z");
}

export function parseGfwHourlyGridManifest(
  raw: unknown,
  manifestUrl = GFW_HOURLY_GRID_LOCAL_MANIFEST_URL,
): GfwHourlyGridManifest | null {
  if (isV4ShadowManifestUrl(manifestUrl)) return parseGfwHourlyGridV4ShadowManifest(raw, manifestUrl);
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
  geometrySemantics: "GFW_HIGH_grid_cell_center" | "inferred_0_01_degree_footprint" | "globally_aligned_0_1_degree_cell";
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
    const isPolygon = contract.geometrySemantics !== "GFW_HIGH_grid_cell_center";
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
  const v4Url = resolveGfwHourlyGridManifestUrl();
  const legacyUrl = resolveLegacyGfwHourlyGridManifestUrl();
  if (!v4Url && !legacyUrl) return Promise.resolve(null);
  return withLoading(
    "gfw-hourly-grid:manifest",
    "GFW 小時網格清單",
    loadGfwV4Release(v4Url ?? undefined)
      .then((v4) => v4 ? gridManifestFromV4(v4) : null)
      .then(async (v4) => {
        if (v4 || !legacyUrl) return v4;
        const response = await fetch(legacyUrl, { cache: "no-cache" });
        return response.ok ? parseGfwHourlyGridManifest(await response.json(), legacyUrl) : null;
      })
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

import { withLoading } from "../lib/loadingRegistry";
import { loadGfwV4Release } from "./gfwV4ReleaseLoader";

export const GFW_FISHING_EFFORT_MANIFEST_URL = "/global-maritime/gfw-hourly/v4/manifest.json";
export const GFW_FISHING_EFFORT_LOCAL_ASSET_URL =
  "/gfw-v4-browser-assets/fishing-effort.geojson.daypack";

const EXPECTED_BBOX = [115.93462, 20.36314, 134.73486, 36.52495] as const;
const EXPECTED_FEATURE_COUNT = 2_887;
const FINALIZATION_STATUS = "not_provided_by_gfw";
const REVISION_SEMANTICS = "dynamic_api_data_may_be_revised";
const DATASET_ALIAS = "public-global-fishing-effort:latest";

type JsonObject = Record<string, unknown>;

export interface GfwFishingEffortAsset {
  path: string;
  bytes: number;
  sha256: string;
  features: number;
  /** The immutable release verifies membership; a missing aggregate must not be invented client-side. */
  apparentFishingHours: number | null;
}

export interface GfwFishingEffortManifest {
  manifestUrl: string;
  releaseId: string;
  selectedUtcDate: string;
  generatedAt: string;
  bbox: [number, number, number, number];
  datasetAlias: typeof DATASET_ALIAS;
  metric?: "apparent_fishing_hours";
  unit?: "hours";
  resolvedDatasetVersion: string;
  latestObservedActiveDate: string;
  latestAvailableDate?: string | null;
  latestAvailableDateStatus?: string;
  finalizationStatus: typeof FINALIZATION_STATUS;
  revisionSemantics: typeof REVISION_SEMANTICS;
  attribution?: string;
  attributionHref?: string | null;
  caveat?: string;
  asset: GfwFishingEffortAsset;
}

const isObject = (value: unknown): value is JsonObject =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const finite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const nonNegativeInteger = (value: unknown): value is number =>
  Number.isInteger(value) && (value as number) >= 0;

const strictUtcDate = (value: unknown): string | null => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
    ? value
    : null;
};

const validIsoInstant = (value: unknown): value is string =>
  typeof value === "string" && /(?:Z|[+]00:00)$/.test(value) && Number.isFinite(Date.parse(value));

const sha256 = (value: unknown): value is string =>
  typeof value === "string" && /^[0-9a-f]{64}$/i.test(value);

function fishingManifestFromV4(release: Awaited<ReturnType<typeof loadGfwV4Release>>): GfwFishingEffortManifest | null {
  if (!release) return null;
  const attributionHref = release.fishingEffort.attribution.match(/https:\/\/globalfishingwatch\.org\/?/)?.[0] ?? null;
  return {
    manifestUrl: release.rootUrl,
    releaseId: release.releaseId,
    selectedUtcDate: release.selectedUtcDate,
    generatedAt: "",
    bbox: [...release.bbox] as [number, number, number, number],
    datasetAlias: DATASET_ALIAS,
    metric: release.fishingEffort.metric,
    unit: release.fishingEffort.unit,
    resolvedDatasetVersion: release.fishingEffort.resolvedDatasetVersion,
    latestObservedActiveDate: release.fishingEffort.latestObservedActiveDate,
    latestAvailableDate: release.fishingEffort.latestAvailableDate,
    latestAvailableDateStatus: release.fishingEffort.latestAvailableDateStatus,
    finalizationStatus: release.fishingEffort.finalizationStatus,
    revisionSemantics: release.fishingEffort.revisionSemantics,
    attribution: release.fishingEffort.attribution,
    attributionHref,
    caveat: release.fishingEffort.caveat,
    asset: {
      path: release.fishingEffort.path,
      bytes: release.fishingEffort.bytes,
      sha256: release.fishingEffort.sha256,
      features: release.fishingEffort.featureCount,
      apparentFishingHours: null,
    },
  };
}

export function parseGfwFishingEffortManifest(
  raw: unknown,
  manifestUrl = GFW_FISHING_EFFORT_MANIFEST_URL,
): GfwFishingEffortManifest | null {
  if (!isObject(raw) || raw.schema_version !== 1 || raw.shadow_only !== true || raw.poc !== true) return null;
  if (raw.production_cutover !== false || raw.immutable_local_output !== true) return null;

  const releaseId = strictUtcDate(raw.release_id);
  const selectedUtcDate = strictUtcDate(raw.selected_utc_date);
  if (!releaseId || !selectedUtcDate || releaseId !== selectedUtcDate || !validIsoInstant(raw.generated_at)) return null;
  if (
    !Array.isArray(raw.bbox) || raw.bbox.length !== EXPECTED_BBOX.length ||
    !raw.bbox.every((value, index) => value === EXPECTED_BBOX[index])
  ) return null;
  if (!isObject(raw.layer_separation) || raw.layer_separation.gfwFishingEffort !== "independent_layer_3") return null;

  const effort = raw.fishing_effort;
  if (!isObject(effort) || !isObject(effort.asset)) return null;
  const resolvedDatasetVersion = typeof effort.resolved_dataset_version === "string"
    ? effort.resolved_dataset_version
    : "";
  const latestObservedActiveDate = strictUtcDate(effort.latest_observed_active_date);
  if (
    effort.independent_layer !== true || effort.presence_identity_contract_shared !== false ||
    effort.dataset_alias !== DATASET_ALIAS || effort.date !== selectedUtcDate ||
    !/^public-global-fishing-effort:v\d+[.]\d+$/.test(resolvedDatasetVersion) ||
    !latestObservedActiveDate || latestObservedActiveDate < selectedUtcDate ||
    effort.finalization_status !== FINALIZATION_STATUS || effort.revision_semantics !== REVISION_SEMANTICS
  ) return null;

  const asset = effort.asset;
  if (
    asset.type !== "fishing_effort_daily_sample" ||
    asset.path !== `fishing-effort/${selectedUtcDate}.geojson.gz` ||
    !Number.isInteger(asset.bytes) || (asset.bytes as number) <= 0 ||
    !sha256(asset.sha256) || asset.features !== EXPECTED_FEATURE_COUNT ||
    !finite(asset.apparent_fishing_hours) || asset.apparent_fishing_hours < 0
  ) return null;

  return {
    manifestUrl,
    releaseId,
    selectedUtcDate,
    generatedAt: raw.generated_at,
    bbox: [...EXPECTED_BBOX],
    datasetAlias: DATASET_ALIAS,
    resolvedDatasetVersion,
    latestObservedActiveDate,
    finalizationStatus: FINALIZATION_STATUS,
    revisionSemantics: REVISION_SEMANTICS,
    asset: {
      path: asset.path,
      bytes: asset.bytes as number,
      sha256: asset.sha256,
      features: EXPECTED_FEATURE_COUNT,
      apparentFishingHours: asset.apparent_fishing_hours,
    },
  };
}

function parseFacetArray(raw: unknown, expectedLength: number): JsonObject[] | null {
  if (typeof raw !== "string") return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length === expectedLength && parsed.every(isObject)
      ? parsed
      : null;
  } catch {
    return null;
  }
}

function parseLowCellPolygon(raw: unknown): GeoJSON.Polygon | null {
  if (!isObject(raw) || raw.type !== "Polygon" || !Array.isArray(raw.coordinates)) return null;
  if (raw.coordinates.length !== 1 || !Array.isArray(raw.coordinates[0])) return null;
  const ring = raw.coordinates[0];
  if (ring.length !== 5) return null;
  const coordinates: [number, number][] = [];
  for (const coordinate of ring) {
    if (
      !Array.isArray(coordinate) || coordinate.length !== 2 || !finite(coordinate[0]) || !finite(coordinate[1]) ||
      coordinate[0] < -180 || coordinate[0] > 180 || coordinate[1] < -90 || coordinate[1] > 90
    ) return null;
    coordinates.push([coordinate[0], coordinate[1]]);
  }
  const first = coordinates[0]!;
  const last = coordinates[4]!;
  if (first[0] !== last[0] || first[1] !== last[1]) return null;
  const corners = coordinates.slice(0, 4);
  if (new Set(corners.map(([lon, lat]) => `${lon}|${lat}`)).size !== 4) return null;
  const lons = corners.map(([lon]) => lon);
  const lats = corners.map(([, lat]) => lat);
  if (new Set(lons).size !== 2 || new Set(lats).size !== 2) return null;
  const width = Math.max(...lons) - Math.min(...lons);
  const height = Math.max(...lats) - Math.min(...lats);
  if (Math.abs(width - 0.1) > 1e-8 || Math.abs(height - 0.1) > 1e-8) return null;
  return { type: "Polygon", coordinates: [coordinates] };
}

export function parseGfwFishingEffortCollection(
  raw: unknown,
  manifest: GfwFishingEffortManifest,
): GeoJSON.FeatureCollection<GeoJSON.Polygon> | null {
  if (!isObject(raw) || raw.type !== "FeatureCollection" || !Array.isArray(raw.features)) return null;
  if (raw.features.length !== manifest.asset.features || !isObject(raw.metadata)) return null;
  const metadata = raw.metadata;
  if (
    metadata.schema_version !== 1 || metadata.date !== manifest.selectedUtcDate ||
    metadata.temporal_resolution !== "DAILY" || metadata.spatial_resolution !== "LOW" ||
    metadata.metric !== "apparent_fishing_hours" || metadata.unit !== "hours" ||
    metadata.resolved_dataset_version !== manifest.resolvedDatasetVersion ||
    metadata.latest_observed_active_date !== manifest.latestObservedActiveDate ||
    metadata.finalization_status !== manifest.finalizationStatus ||
    metadata.revision_semantics !== manifest.revisionSemantics ||
    metadata.latest_available_date !== null ||
    metadata.latest_available_date_status !== FINALIZATION_STATUS ||
    typeof metadata.caveat !== "string" || !metadata.caveat.includes("not vessel presence") ||
    typeof metadata.attribution !== "string" || !metadata.attribution.includes("Global Fishing Watch") ||
    !validIsoInstant(metadata.source_accessed_at) || !sha256(metadata.source_response_sha256) ||
    !isObject(metadata.quality)
  ) return null;

  const quality = metadata.quality;
  for (const key of [
    "boundary_overlap_rows", "exact_duplicate_rows", "invalid_rows", "negative_hours_rejected",
    "valid_rows", "wrong_day_rows",
  ]) {
    if (!nonNegativeInteger(quality[key])) return null;
  }

  const attributionHref = metadata.attribution.match(/https:\/\/globalfishingwatch\.org\/?/)?.[0] ?? null;
  const governance = {
    selected_utc_date: metadata.date,
    metric: metadata.metric,
    unit: metadata.unit,
    dataset_version: metadata.resolved_dataset_version,
    latest_available_date: metadata.latest_available_date,
    latest_available_date_status: metadata.latest_available_date_status,
    finalization_status: metadata.finalization_status,
    revision_semantics: metadata.revision_semantics,
    attribution: metadata.attribution,
    attribution_href: attributionHref,
    caveat: metadata.caveat,
  };
  const features: GeoJSON.Feature<GeoJSON.Polygon>[] = [];
  const ids = new Set<string>();
  let componentCount = 0;
  let apparentFishingHours = 0;
  for (const candidate of raw.features) {
    if (!isObject(candidate) || candidate.type !== "Feature" || typeof candidate.id !== "string" || !candidate.id) return null;
    if (ids.has(candidate.id) || !isObject(candidate.properties)) return null;
    ids.add(candidate.id);
    const geometry = parseLowCellPolygon(candidate.geometry);
    const properties = candidate.properties;
    if (
      !geometry || properties.date !== manifest.selectedUtcDate ||
      properties.metric_semantics !== "apparent_model_derived_fishing_hours" ||
      properties.resolved_dataset_version !== manifest.resolvedDatasetVersion ||
      !finite(properties.apparent_fishing_hours) || properties.apparent_fishing_hours < 0 ||
      !Number.isInteger(properties.component_count) || (properties.component_count as number) < 1 ||
      !parseFacetArray(properties.aggregation_facets_json, properties.component_count as number)
    ) return null;
    componentCount += properties.component_count as number;
    apparentFishingHours += properties.apparent_fishing_hours;
    features.push({
      ...(candidate as unknown as GeoJSON.Feature<GeoJSON.Polygon>),
      properties: { ...properties, ...governance },
    });
  }
  if (componentCount !== quality.valid_rows) return null;
  // The formal release does not publish a synthetic client aggregate. When a
  // publisher provides one, retain the old exact checksum-style assertion.
  if (manifest.asset.apparentFishingHours !== null) {
    const tolerance = Math.max(1e-8, Math.abs(manifest.asset.apparentFishingHours) * 1e-12);
    if (Math.abs(apparentFishingHours - manifest.asset.apparentFishingHours) > tolerance) return null;
  }
  return { type: "FeatureCollection", features };
}

async function sha256Hex(bytes: ArrayBuffer): Promise<string | null> {
  if (!globalThis.crypto?.subtle) return null;
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function decodeGzipJson(bytes: ArrayBuffer): Promise<unknown | null> {
  if (typeof DecompressionStream === "undefined") return null;
  try {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
    return JSON.parse(await new Response(stream).text());
  } catch {
    return null;
  }
}

export function loadGfwFishingEffortManifest(): Promise<GfwFishingEffortManifest | null> {
  if (!manifestPromise) {
    manifestPromise = withLoading(
      "gfw-fishing-effort:manifest",
      "GFW 漁撈活動清單",
      loadGfwV4Release().then(fishingManifestFromV4)
        .catch(() => null),
    );
  }
  return manifestPromise;
}

let manifestPromise: Promise<GfwFishingEffortManifest | null> | null = null;

const assetPromises = new Map<string, Promise<GeoJSON.FeatureCollection<GeoJSON.Polygon> | null>>();

export function loadGfwFishingEffortDay(
  manifest: GfwFishingEffortManifest,
): Promise<GeoJSON.FeatureCollection<GeoJSON.Polygon> | null> {
  const key = `${manifest.releaseId}|${manifest.selectedUtcDate}`;
  const cached = assetPromises.get(key);
  if (cached) return cached;
  const promise = withLoading(
    `gfw-fishing-effort:${key}`,
    `GFW 漁撈活動 ${manifest.selectedUtcDate} UTC`,
    fetch(new URL(manifest.asset.path, new URL(manifest.manifestUrl, globalThis.location?.origin ?? "http://localhost")).toString(), { cache: "force-cache" })
      .then(async (response) => {
        if (!response.ok) return null;
        const compressed = await response.arrayBuffer();
        if (compressed.byteLength !== manifest.asset.bytes) return null;
        const digest = await sha256Hex(compressed);
        if (!digest || digest.toLowerCase() !== manifest.asset.sha256.toLowerCase()) return null;
        return parseGfwFishingEffortCollection(await decodeGzipJson(compressed), manifest);
      })
      .catch(() => null),
  );
  assetPromises.set(key, promise);
  void promise.then((data) => {
    if (!data && assetPromises.get(key) === promise) assetPromises.delete(key);
  });
  return promise;
}

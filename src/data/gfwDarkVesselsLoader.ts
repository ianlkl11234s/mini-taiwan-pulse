import { withLoading } from "../lib/loadingRegistry";
import {
  parseGfwHourlyUnifiedManifest,
  resolveGfwHourlyRootManifestUrl,
  type GfwUnifiedDarkVesselHour,
} from "./gfwHourlyReleaseManifest";

const ROOT_MANIFEST_PATH = "/global-maritime/gfw-hourly/manifest.json";

export interface GfwDarkVesselsManifest {
  manifestUrl: string;
  releaseId: string;
  latestCompleteDate: string;
  hours: ReadonlyMap<string, GfwUnifiedDarkVesselHour>;
}

type JsonObject = Record<string, unknown>;
const isObject = (value: unknown): value is JsonObject =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

export function resolveGfwDarkVesselsManifestUrl(
  cdnBase = import.meta.env.VITE_GLOBAL_MARITIME_CDN_BASE ?? "",
  isDev = import.meta.env.DEV,
): string {
  // Dark-vessel 沒有舊 POC manifest adapter；dev 也只接受 unified root v2。
  return resolveGfwHourlyRootManifestUrl(ROOT_MANIFEST_PATH, cdnBase, isDev) ?? ROOT_MANIFEST_PATH;
}

export function parseGfwDarkVesselsManifest(
  raw: unknown,
  manifestUrl: string,
): GfwDarkVesselsManifest | null {
  const unified = parseGfwHourlyUnifiedManifest(raw, manifestUrl);
  if (!unified) return null;
  return {
    manifestUrl,
    releaseId: unified.releaseId,
    latestCompleteDate: unified.darkVesselsLatestCompleteDate,
    hours: unified.darkVesselHours,
  };
}

export function parseGfwDarkVesselsHour(
  raw: unknown,
  expectedHour: string,
): GeoJSON.FeatureCollection<GeoJSON.Point> | null {
  if (!isObject(raw) || raw.type !== "FeatureCollection" || !Array.isArray(raw.features)) return null;
  if (
    !isObject(raw.metadata) || raw.metadata.observed_at !== expectedHour ||
    raw.metadata.temporal_resolution !== "HOURLY" || raw.metadata.spatial_resolution !== "HIGH" ||
    raw.metadata.semantic_label !== "SAR detection unmatched to AIS" ||
    raw.metadata.not_proof_of_dark_or_illegal_vessel !== true ||
    !Number.isInteger(raw.metadata.feature_count) || (raw.metadata.feature_count as number) < 0 ||
    typeof raw.metadata.detection_count !== "number" || !Number.isFinite(raw.metadata.detection_count) ||
    raw.metadata.detection_count < 0
  ) return null;
  const features: GeoJSON.Feature<GeoJSON.Point>[] = [];
  for (const feature of raw.features) {
    if (!isObject(feature) || feature.type !== "Feature" || !isObject(feature.geometry)) return null;
    if (feature.geometry.type !== "Point" || !Array.isArray(feature.geometry.coordinates)) return null;
    if (feature.geometry.coordinates.length < 2 || !finite(feature.geometry.coordinates[0]) || !finite(feature.geometry.coordinates[1])) return null;
    if (!isObject(feature.properties)) return null;
    const p = feature.properties;
    if (
      p.observed_at !== expectedHour || !Number.isInteger(p.detections) || (p.detections as number) < 1 ||
      typeof p.source_dataset !== "string" || p.source_dataset.length === 0 ||
      p.matched_to_ais !== false || p.matching_semantics !== "SAR_detection_not_matched_to_AIS" ||
      p.coordinate_semantics !== "GFW_HIGH_grid_cell_center" ||
      p.semantic_label !== "SAR detection unmatched to AIS" ||
      typeof p.interpretation_note !== "string" || p.interpretation_note.length === 0
    ) return null;
    features.push(feature as unknown as GeoJSON.Feature<GeoJSON.Point>);
  }
  if (features.length !== raw.metadata.feature_count) return null;
  const detectionCount = features.reduce(
    (sum, feature) => sum + Number(feature.properties?.detections ?? 0),
    0,
  );
  if (detectionCount !== raw.metadata.detection_count) return null;
  return { type: "FeatureCollection", features };
}

export function loadGfwDarkVesselsManifest(): Promise<GfwDarkVesselsManifest | null> {
  const url = resolveGfwDarkVesselsManifestUrl();
  return withLoading(
    "gfw-dark-vessels:manifest",
    "GFW SAR 未匹配 AIS 清單",
    fetch(url, { cache: "no-cache" })
      .then(async (response) => response.ok ? parseGfwDarkVesselsManifest(await response.json(), url) : null)
      .catch(() => null),
  );
}

const hourPromises = new Map<string, Promise<GeoJSON.FeatureCollection<GeoJSON.Point> | null>>();

export function loadGfwDarkVesselsHour(
  manifest: GfwDarkVesselsManifest,
  hourIso: string,
): Promise<GeoJSON.FeatureCollection<GeoJSON.Point> | null> {
  const entry = manifest.hours.get(hourIso);
  if (!entry) return Promise.resolve(null);
  const key = `${manifest.releaseId}|${hourIso}`;
  const cached = hourPromises.get(key);
  if (cached) return cached;
  const promise = withLoading(
    `gfw-dark-vessels:${key}`,
    `GFW SAR 未匹配 AIS ${hourIso.slice(0, 13)}:00 UTC`,
    fetch(new URL(
      entry.path,
      new URL(manifest.manifestUrl, globalThis.location?.origin ?? "http://localhost"),
    ).toString(), { cache: "force-cache" })
      .then(async (response) => {
        if (!response.ok) return null;
        const parsed = parseGfwDarkVesselsHour(await response.json(), hourIso);
        if (!parsed || parsed.features.length !== entry.features) return null;
        const detections = parsed.features.reduce((sum, feature) => sum + Number(feature.properties?.detections ?? 0), 0);
        return detections === entry.detections ? parsed : null;
      })
      .catch(() => null),
  );
  hourPromises.set(key, promise);
  void promise.then((data) => {
    if (!data && hourPromises.get(key) === promise) hourPromises.delete(key);
  });
  return promise;
}

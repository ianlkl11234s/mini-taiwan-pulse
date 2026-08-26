const ROOT_PATH = "global-maritime/gfw-hourly/manifest.json";
export const GFW_HOURLY_V3_SHADOW_ROOT_PATH = "global-maritime/gfw-hourly/v3-shadow/manifest.json";

type JsonObject = Record<string, unknown>;
const isObject = (value: unknown): value is JsonObject =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const strictDate = (value: unknown): string | null => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value ? value : null;
};
export const normalizeGfwUtcHour = (value: unknown): string | null => {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:00:00(?:Z|[+]00:00)$/.test(value)
  ) return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime())
    ? parsed.toISOString().replace(".000Z", "Z")
    : null;
};
const nonNegativeInt = (value: unknown): value is number => Number.isInteger(value) && (value as number) >= 0;
const sha256 = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{64}$/i.test(value);
const releaseAssetPath = (value: unknown, releaseId: string, suffix: string): value is string =>
  typeof value === "string" &&
  value.startsWith(`releases/${releaseId}/`) &&
  value.endsWith(suffix) &&
  /^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(value) &&
  !value.split("/").some((part) => part === ".." || part === "." || part === "");

export interface GfwDetailBucket {
  bucket: string;
  path: string;
  sha256: string;
  bytes: number;
  features: number;
}

export interface GfwDetailContract {
  bucketCount: 16;
  hash: "sha256_hex_prefix";
  prefixLength: 1;
  key: "cell_id" | "track_id";
  format: "json";
  contentEncoding: "gzip";
}

export interface GfwUnifiedTrackDay {
  displayDate: string;
  path: string;
  bytes: number;
  features: number;
  points: number;
  format: "geojson" | "pmtiles";
  detailBuckets: readonly GfwDetailBucket[];
}

export interface GfwUnifiedTrackFrame {
  observedAt: string;
  observedAtMs: number;
  path: string;
  sha256: string;
  bytes: number;
  features: number;
  format: "geojson";
  contentEncoding: "gzip";
}

export interface GfwUnifiedGridHour {
  observedAt: string;
  observedAtMs: number;
  path: string;
  bytes: number;
  features: number;
  vesselCount: number;
  /** v3 PMTiles source-layer/detail contract 已在 root manifest 凍結；v2 保留 GeoJSON。 */
  format: "geojson" | "pmtiles";
  detailBuckets: readonly GfwDetailBucket[];
}

export interface GfwUnifiedDarkVesselHour {
  observedAt: string;
  observedAtMs: number;
  path: string;
  bytes: number;
  features: number;
  detections: number;
}

export interface GfwHourlyUnifiedManifest {
  manifestUrl: string;
  releaseId: string;
  latestCompleteDate: string;
  dateStart: string;
  dateEnd: string;
  generatedAt: string | null;
  bbox: [number, number, number, number];
  datasetAlias: string;
  resolvedDatasetVersions: string[];
  schemaVersion: 2 | 3;
  /** 只有 v3 root 明確宣告 true 時才能移除 POC/capped 限定語。 */
  fullFidelity: boolean;
  sourceCoordinateSemantics: string;
  /** v3 polygon 的中心座標仍需保留來源位置語意，禁止自行猜 PMTiles schema。 */
  gridGeometrySemantics: "GFW_HIGH_grid_cell_center" | "inferred_0_01_degree_footprint";
  gridSourceLayer: string | null;
  gridDetailContract: GfwDetailContract | null;
  trackDays: ReadonlyMap<string, GfwUnifiedTrackDay>;
  trackSourceLayers: { edges: string; singletons: string } | null;
  trackDetailContract: GfwDetailContract | null;
  trackFrames: ReadonlyMap<string, GfwUnifiedTrackFrame>;
  gridHours: ReadonlyMap<string, GfwUnifiedGridHour>;
  darkVesselsLatestCompleteDate: string;
  darkVesselHours: ReadonlyMap<string, GfwUnifiedDarkVesselHour>;
  attribution: { label: string; href: string };
}

export function resolveGfwHourlyRootManifestUrl(
  localFallback: string,
  cdnBase = import.meta.env.VITE_GLOBAL_MARITIME_CDN_BASE ?? "",
  isDev = import.meta.env.DEV,
  shadowEnabled = import.meta.env.VITE_GFW_HOURLY_V3_SHADOW_ENABLED === "true",
  useLocalPoc = import.meta.env.VITE_GFW_HOURLY_USE_LOCAL_POC === "true",
): string | null {
  const path = shadowEnabled ? GFW_HOURLY_V3_SHADOW_ROOT_PATH : ROOT_PATH;
  // 一般 checkout 刻意不含 local POC；DEV 預設經 Vite 同源 proxy 走 production root，
  // 也刻意忽略 CDN override，避免 local browser 產生 CORS 分支。只有明確 opt-in 才回退 fixture。
  if (isDev) return useLocalPoc ? localFallback : `/${path}`;
  const normalized = cdnBase.trim().replace(/\/+$/, "");
  if (normalized) return `${normalized}/${path}`;
  return `/${path}`;
}

export function isGfwHourlyProductionManifestUrl(url: string): boolean {
  return url.endsWith(`/${ROOT_PATH}`) || url.endsWith(`/${GFW_HOURLY_V3_SHADOW_ROOT_PATH}`);
}

export function resolveGfwHourlyV3ShadowManifestUrl(
  cdnBase = import.meta.env.VITE_GLOBAL_MARITIME_CDN_BASE ?? "",
): string {
  const normalized = cdnBase.trim().replace(/\/+$/, "");
  return normalized ? `${normalized}/${GFW_HOURLY_V3_SHADOW_ROOT_PATH}` : `/${GFW_HOURLY_V3_SHADOW_ROOT_PATH}`;
}

function parseDetailContract(raw: unknown, key: "cell_id" | "track_id"): GfwDetailContract | null {
  if (!isObject(raw) || raw.bucket_count !== 16 || raw.hash !== "sha256_hex_prefix" ||
    raw.prefix_length !== 1 || raw.key !== key || raw.format !== "json" || raw.content_encoding !== "gzip") return null;
  return { bucketCount: 16, hash: "sha256_hex_prefix", prefixLength: 1, key, format: "json", contentEncoding: "gzip" };
}

function parseDetailBuckets(raw: unknown, releaseId: string): GfwDetailBucket[] | null {
  if (!Array.isArray(raw) || raw.length !== 16) return null;
  const buckets: GfwDetailBucket[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!isObject(item) || typeof item.bucket !== "string" || !/^[0-9a-f]$/.test(item.bucket) ||
      seen.has(item.bucket) || !releaseAssetPath(item.path, releaseId, ".json.gz") || !sha256(item.sha256) ||
      !nonNegativeInt(item.bytes) || !nonNegativeInt(item.features)) return null;
    seen.add(item.bucket);
    buckets.push({ bucket: item.bucket, path: item.path, sha256: item.sha256, bytes: item.bytes, features: item.features });
  }
  return seen.size === 16 && "0123456789abcdef".split("").every((bucket) => seen.has(bucket)) ? buckets : null;
}

function expectedDates(start: string, end: string): string[] {
  const result: string[] = [];
  for (
    let cursor = Date.parse(`${start}T00:00:00Z`);
    cursor <= Date.parse(`${end}T00:00:00Z`);
    cursor += 86_400_000
  ) result.push(new Date(cursor).toISOString().slice(0, 10));
  return result;
}

export function parseGfwHourlyUnifiedManifest(
  raw: unknown,
  manifestUrl: string,
): GfwHourlyUnifiedManifest | null {
  if (!isObject(raw) || (raw.schema_version !== 2 && raw.schema_version !== 3)) return null;
  const schemaVersion = raw.schema_version;
  const releaseId = strictDate(raw.release_id);
  const latestCompleteDate = strictDate(raw.latest_complete_date);
  const dateStart = strictDate(raw.date_start);
  const dateEnd = strictDate(raw.date_end);
  if (!releaseId || !latestCompleteDate || !dateStart || !dateEnd) return null;
  if (releaseId !== latestCompleteDate || dateStart > dateEnd || dateEnd > latestCompleteDate) return null;
  if (!Array.isArray(raw.bbox) || raw.bbox.length !== 4 || raw.bbox.some((v) => typeof v !== "number" || !Number.isFinite(v))) return null;
  if (!isObject(raw.source) || typeof raw.source.dataset_alias !== "string" || !Array.isArray(raw.source.resolved_dataset_versions)) return null;
  if (!raw.source.resolved_dataset_versions.every((v) => typeof v === "string" && v.length > 0)) return null;
  if (
    !isObject(raw.tracks) || !Array.isArray(raw.tracks.days) ||
    !isObject(raw.grid) || !Array.isArray(raw.grid.hours) ||
    !isObject(raw.dark_vessels) || !Array.isArray(raw.dark_vessels.hours)
  ) return null;
  const fullFidelity = schemaVersion === 3;
  let gridSourceLayer: string | null = null;
  let gridDetailContract: GfwDetailContract | null = null;
  let trackSourceLayers: { edges: string; singletons: string } | null = null;
  let trackDetailContract: GfwDetailContract | null = null;
  if (schemaVersion === 3) {
    if (
      raw.full_fidelity !== true ||
      typeof raw.source.coordinate_semantics !== "string" || raw.source.coordinate_semantics.trim() === "" ||
      raw.grid.geometry_semantics !== "inferred_0_01_degree_footprint" ||
      !isObject(raw.tracks.counts) ||
      !nonNegativeInt(raw.tracks.counts.candidate_features) ||
      !nonNegativeInt(raw.tracks.counts.displayed_features) ||
      !nonNegativeInt(raw.tracks.counts.published_features) ||
      !nonNegativeInt(raw.tracks.counts.candidate_points) ||
      !nonNegativeInt(raw.tracks.counts.displayed_points) ||
      !nonNegativeInt(raw.tracks.counts.published_points) ||
      !nonNegativeInt(raw.tracks.counts.omitted_features) || raw.tracks.counts.omitted_features !== 0 ||
      !nonNegativeInt(raw.tracks.counts.omitted_points) || raw.tracks.counts.omitted_points !== 0 ||
      raw.tracks.counts.cap_applied !== false ||
      raw.tracks.counts.candidate_features !== raw.tracks.counts.displayed_features ||
      raw.tracks.counts.candidate_features !== raw.tracks.counts.published_features ||
      raw.tracks.counts.candidate_points !== raw.tracks.counts.displayed_points ||
      raw.tracks.counts.candidate_points !== raw.tracks.counts.published_points ||
      raw.grid.source_layer !== "gfw_grid" ||
      !(gridDetailContract = parseDetailContract(raw.grid.detail_contract, "cell_id")) ||
      !isObject(raw.tracks.source_layers) || raw.tracks.source_layers.edges !== "gfw_track_edges" ||
      raw.tracks.source_layers.singletons !== "gfw_track_singletons" ||
      !(trackDetailContract = parseDetailContract(raw.tracks.detail_contract, "track_id"))
    ) return null;
    gridSourceLayer = raw.grid.source_layer;
    trackSourceLayers = { edges: raw.tracks.source_layers.edges, singletons: raw.tracks.source_layers.singletons };
  }
  if (!isObject(raw.retention) || raw.retention.published_releases_kept !== 2) return null;
  if (
    !isObject(raw.cache_contract) ||
    raw.cache_contract.root_manifest !== "public,max-age=60,s-maxage=60,stale-while-revalidate=300" ||
    raw.cache_contract.immutable_release !== "public,max-age=604800,s-maxage=604800,immutable"
  ) return null;
  if (!isObject(raw.attribution) || typeof raw.attribution.label !== "string" || typeof raw.attribution.href !== "string") return null;

  const dates = expectedDates(dateStart, dateEnd);
  const trackDays = new Map<string, GfwUnifiedTrackDay>();
  for (const item of raw.tracks.days) {
    if (!isObject(item)) return null;
    const displayDate = strictDate(item.display_date);
    const format = schemaVersion === 3 ? item.format : "geojson";
    const expectedPath = displayDate ? `releases/${releaseId}/tracks/days/${displayDate}.geojson` : "";
    const detailBuckets = schemaVersion === 3 ? parseDetailBuckets(item.detail_buckets, releaseId) : [];
    if (
      !displayDate || format !== "geojson" && format !== "pmtiles" ||
      (format === "geojson" ? item.path !== expectedPath : !releaseAssetPath(item.path, releaseId, ".pmtiles")) ||
      !detailBuckets || trackDays.has(displayDate) || !sha256(item.sha256) ||
      !nonNegativeInt(item.bytes) || !nonNegativeInt(item.features) || !nonNegativeInt(item.points) ||
      !isObject(item.overlap) || item.overlap.lookback_hours !== 3 || item.overlap.lookahead_hours !== 1
    ) return null;
    trackDays.set(displayDate, {
      displayDate, path: item.path as string, bytes: item.bytes, features: item.features, points: item.points,
      format, detailBuckets,
    });
  }
  if (trackDays.size !== dates.length || dates.some((date) => !trackDays.has(date))) return null;

  const trackFrames = new Map<string, GfwUnifiedTrackFrame>();
  if (schemaVersion === 3) {
    if (!Array.isArray(raw.tracks.frames)) return null;
    for (const item of raw.tracks.frames) {
      if (!isObject(item)) return null;
      const observedAt = normalizeGfwUtcHour(item.observed_at);
      if (!observedAt || trackFrames.has(observedAt) || item.format !== "geojson" || item.content_encoding !== "gzip" ||
        !releaseAssetPath(item.path, releaseId, ".geojson.gz") || !sha256(item.sha256) ||
        !nonNegativeInt(item.bytes) || !nonNegativeInt(item.features)) return null;
      trackFrames.set(observedAt, {
        observedAt, observedAtMs: Date.parse(observedAt), path: item.path, sha256: item.sha256,
        bytes: item.bytes, features: item.features, format: "geojson", contentEncoding: "gzip",
      });
    }
    const expectedFrameCount = dates.length * 24;
    if (trackFrames.size !== expectedFrameCount) return null;
    for (let cursor = Date.parse(`${dateStart}T00:00:00Z`); cursor < Date.parse(`${dateEnd}T00:00:00Z`) + 86_400_000; cursor += 3_600_000) {
      const hour = new Date(cursor).toISOString().replace(".000Z", "Z");
      if (!trackFrames.has(hour)) return null;
    }
  }

  const gridHours = new Map<string, GfwUnifiedGridHour>();
  for (const item of raw.grid.hours) {
    if (!isObject(item)) return null;
    const observedAt = normalizeGfwUtcHour(item.observed_at);
    const compact = observedAt?.replace(/[-:]/g, "").replace("T", "T").slice(0, 11);
    const format = schemaVersion === 3 ? item.format : "geojson";
    if (format !== "geojson" && format !== "pmtiles") return null;
    // 未有 PMTiles source-layer / sidecar index 的上游契約前，保留 manifest 可驗證，
    // 但絕不從 path 推論 tile schema 或檔名（loader 會明確拒絕 pmtiles）。
    const geojsonPath = observedAt ? `releases/${releaseId}/grid/hours/${compact}Z.geojson` : "";
    const pmtilesPathIsSafe = releaseAssetPath(item.path, releaseId, ".pmtiles");
    const detailBuckets = schemaVersion === 3 ? parseDetailBuckets(item.detail_buckets, releaseId) : [];
    if (
      !observedAt || (format === "geojson" ? item.path !== geojsonPath : !pmtilesPathIsSafe) || gridHours.has(observedAt) || !sha256(item.sha256) ||
      !detailBuckets || !nonNegativeInt(item.bytes) || !nonNegativeInt(item.features) || !nonNegativeInt(item.vessel_count)
    ) return null;
    gridHours.set(observedAt, {
      observedAt,
      observedAtMs: Date.parse(observedAt),
      path: item.path as string,
      bytes: item.bytes,
      features: item.features,
      vesselCount: item.vessel_count,
      format,
      detailBuckets,
    });
  }
  const expectedHourCount = dates.length * 24;
  if (gridHours.size !== expectedHourCount) return null;
  for (let cursor = Date.parse(`${dateStart}T00:00:00Z`); cursor < Date.parse(`${dateEnd}T00:00:00Z`) + 86_400_000; cursor += 3_600_000) {
    const hour = new Date(cursor).toISOString().replace(".000Z", "Z");
    if (!gridHours.has(hour)) return null;
  }

  const darkVesselsLatestCompleteDate = strictDate(raw.dark_vessels.latest_complete_date);
  const darkVesselsDateStart = strictDate(raw.dark_vessels.date_start);
  const darkVesselsDateEnd = strictDate(raw.dark_vessels.date_end);
  if (
    !darkVesselsLatestCompleteDate || !darkVesselsDateStart || !darkVesselsDateEnd ||
    darkVesselsLatestCompleteDate !== latestCompleteDate ||
    darkVesselsDateStart !== dateStart || darkVesselsDateEnd !== dateEnd
  ) return null;
  const darkVesselHours = new Map<string, GfwUnifiedDarkVesselHour>();
  let previousDarkHour = -Infinity;
  for (const item of raw.dark_vessels.hours) {
    if (!isObject(item)) return null;
    const observedAt = normalizeGfwUtcHour(item.observed_at);
    const compact = observedAt?.replace(/[-:]/g, "").slice(0, 11);
    const expectedPath = observedAt ? `releases/${releaseId}/dark_vessels/hours/${compact}Z.geojson` : "";
    const observedAtMs = observedAt ? Date.parse(observedAt) : Number.NaN;
    if (
      !observedAt || observedAtMs <= previousDarkHour || item.path !== expectedPath || !sha256(item.sha256) ||
      !nonNegativeInt(item.bytes) || !nonNegativeInt(item.features) || !nonNegativeInt(item.detections)
    ) return null;
    previousDarkHour = observedAtMs;
    darkVesselHours.set(observedAt, {
      observedAt, observedAtMs, path: expectedPath, bytes: item.bytes,
      features: item.features, detections: item.detections,
    });
  }
  const darkHourCount = dates.length * 24;
  const darkWindowEndExclusive = Date.parse(`${darkVesselsLatestCompleteDate}T00:00:00Z`) + 86_400_000;
  const darkWindowStart = darkWindowEndExclusive - darkHourCount * 3_600_000;
  if (darkVesselHours.size !== darkHourCount) return null;
  for (let cursor = darkWindowStart; cursor < darkWindowEndExclusive; cursor += 3_600_000) {
    const hour = new Date(cursor).toISOString().replace(".000Z", "Z");
    if (!darkVesselHours.has(hour)) return null;
  }

  return {
    manifestUrl,
    releaseId,
    latestCompleteDate,
    dateStart,
    dateEnd,
    generatedAt: typeof raw.generated_at === "string" ? raw.generated_at : null,
    bbox: raw.bbox as [number, number, number, number],
    datasetAlias: raw.source.dataset_alias,
    resolvedDatasetVersions: raw.source.resolved_dataset_versions as string[],
    schemaVersion,
    fullFidelity,
    sourceCoordinateSemantics: schemaVersion === 3
      ? raw.source.coordinate_semantics as string
      : "GFW_HIGH_grid_cell_center",
    gridGeometrySemantics: schemaVersion === 3
      ? "inferred_0_01_degree_footprint"
      : "GFW_HIGH_grid_cell_center",
    gridSourceLayer,
    gridDetailContract,
    trackDays,
    trackSourceLayers,
    trackDetailContract,
    trackFrames,
    gridHours,
    darkVesselsLatestCompleteDate,
    darkVesselHours,
    attribution: { label: raw.attribution.label, href: raw.attribution.href },
  };
}

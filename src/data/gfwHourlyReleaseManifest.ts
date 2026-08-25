const ROOT_PATH = "global-maritime/gfw-hourly/manifest.json";

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

export interface GfwUnifiedTrackDay {
  displayDate: string;
  path: string;
  bytes: number;
  features: number;
  points: number;
}

export interface GfwUnifiedGridHour {
  observedAt: string;
  observedAtMs: number;
  path: string;
  bytes: number;
  features: number;
  vesselCount: number;
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
  trackDays: ReadonlyMap<string, GfwUnifiedTrackDay>;
  gridHours: ReadonlyMap<string, GfwUnifiedGridHour>;
  darkVesselsLatestCompleteDate: string;
  darkVesselHours: ReadonlyMap<string, GfwUnifiedDarkVesselHour>;
  attribution: { label: string; href: string };
}

export function resolveGfwHourlyRootManifestUrl(
  localFallback: string,
  cdnBase = import.meta.env.VITE_GLOBAL_MARITIME_CDN_BASE ?? "",
  isDev = import.meta.env.DEV,
): string | null {
  if (isDev) return localFallback;
  const normalized = cdnBase.trim().replace(/\/+$/, "");
  if (normalized) return `${normalized}/${ROOT_PATH}`;
  return `/${ROOT_PATH}`;
}

export function isGfwHourlyProductionManifestUrl(url: string): boolean {
  return url.endsWith(`/${ROOT_PATH}`);
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
  if (!isObject(raw) || raw.schema_version !== 2) return null;
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
    const expectedPath = displayDate ? `releases/${releaseId}/tracks/days/${displayDate}.geojson` : "";
    if (
      !displayDate || item.path !== expectedPath || trackDays.has(displayDate) || !sha256(item.sha256) ||
      !nonNegativeInt(item.bytes) || !nonNegativeInt(item.features) || !nonNegativeInt(item.points) ||
      !isObject(item.overlap) || item.overlap.lookback_hours !== 3 || item.overlap.lookahead_hours !== 1
    ) return null;
    trackDays.set(displayDate, {
      displayDate, path: expectedPath, bytes: item.bytes, features: item.features, points: item.points,
    });
  }
  if (trackDays.size !== dates.length || dates.some((date) => !trackDays.has(date))) return null;

  const gridHours = new Map<string, GfwUnifiedGridHour>();
  for (const item of raw.grid.hours) {
    if (!isObject(item)) return null;
    const observedAt = normalizeGfwUtcHour(item.observed_at);
    const compact = observedAt?.replace(/[-:]/g, "").replace("T", "T").slice(0, 11);
    const expectedPath = observedAt ? `releases/${releaseId}/grid/hours/${compact}Z.geojson` : "";
    if (
      !observedAt || item.path !== expectedPath || gridHours.has(observedAt) || !sha256(item.sha256) ||
      !nonNegativeInt(item.bytes) || !nonNegativeInt(item.features) || !nonNegativeInt(item.vessel_count)
    ) return null;
    gridHours.set(observedAt, {
      observedAt,
      observedAtMs: Date.parse(observedAt),
      path: expectedPath,
      bytes: item.bytes,
      features: item.features,
      vesselCount: item.vessel_count,
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
    trackDays,
    gridHours,
    darkVesselsLatestCompleteDate,
    darkVesselHours,
    attribution: { label: raw.attribution.label, href: raw.attribution.href },
  };
}

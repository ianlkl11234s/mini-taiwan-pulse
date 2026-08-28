import { parseGfwHourlyGridVessels, serializeGfwHourlyGridVessels, type GfwHourlyGridVessel } from "./gfwHourlyGridTypes";
import type { GfwDetailBucket } from "./gfwHourlyReleaseManifest";
import { withLoading } from "../lib/loadingRegistry";
import type { GfwHourlyGridManifest } from "./gfwHourlyGridLoader";
import type { GfwHourlyTrackManifest } from "./gfwHourlyTracksLoader";

type JsonObject = Record<string, unknown>;
const isObject = (value: unknown): value is JsonObject => value !== null && typeof value === "object" && !Array.isArray(value);
const isNonNegativeInt = (value: unknown): value is number => Number.isInteger(value) && (value as number) >= 0;
const utc = (value: unknown): value is string => typeof value === "string" && /(?:Z|[+]00:00)$/.test(value) && Number.isFinite(Date.parse(value));

export interface GfwGridDetailEntry {
  vesselCount: number;
  vessels: GfwHourlyGridVessel[];
}

export interface GfwTrackDetailEntry {
  trackId: string;
  vessel: GfwHourlyGridVessel;
  startAt: string;
  endAt: string;
  pointCount: number;
  observedTimes: string[];
}

type GridDetailHour = {
  observedAt: string;
  detailBuckets: readonly GfwDetailBucket[];
  detailMode?: "hash-prefix" | "adaptive-shard";
};
type TrackDetailDay = { displayDate: string; detailBuckets: readonly GfwDetailBucket[] };

let gridContext: GfwHourlyGridManifest | null = null;
let tracksContext: GfwHourlyTrackManifest | null = null;

/** Normalise the producer's tile identifier aliases before sidecar hashing/click hydration. */
export function canonicalGfwGridCellId(properties: Record<string, unknown>, featureId?: unknown): string | null {
  for (const candidate of [properties.cell_id, properties.grid_id, featureId]) {
    if (typeof candidate === "string" && candidate.trim() !== "") return candidate;
  }
  return null;
}

/**
 * PMTiles feature properties are an untrusted preview.  A present string is not sufficient:
 * only a strict, non-empty member list whose length matches the rendered count can skip the
 * lazy sidecar verification.  Every other form must hydrate (or fail closed there).
 */
export function hasVerifiedGfwGridVesselList(properties: Record<string, unknown>): boolean {
  const vesselCount = properties.vessel_count;
  if (!isNonNegativeInt(vesselCount) || vesselCount === 0) return false;
  const vessels = parseGfwHourlyGridVessels(properties.vessels_json);
  return vessels !== null && vessels.length > 0 && vessels.length === vesselCount;
}

/**
 * v3 tile properties are only a rendering preview.  Even an apparently valid inline list
 * must be verified against its content-addressed bucket before a full-fidelity popup claims
 * to show all members.  v2 keeps its already-validated inline fallback.
 */
export function needsGfwGridDetailHydration(properties: Record<string, unknown>): boolean {
  return properties.geometry_semantics === "inferred_0_01_degree_footprint" ||
    properties.geometry_semantics === "globally_aligned_0_1_degree_cell" ||
    typeof properties.detail_shard === "string" || !hasVerifiedGfwGridVesselList(properties);
}

/** Hooks own the current release; click plumbing only consumes this immutable snapshot. */
export function setGfwHourlyGridDetailContext(manifest: GfwHourlyGridManifest | null): void {
  gridContext = manifest;
}

export function setGfwHourlyTracksDetailContext(manifest: GfwHourlyTrackManifest | null): void {
  tracksContext = manifest;
}

export async function gfwDetailBucketForKey(key: string): Promise<string | null> {
  if (!key || typeof key !== "string" || !globalThis.crypto?.subtle) return null;
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(key));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("").slice(0, 1);
}

function parseGridEntries(raw: unknown, expected: { releaseId: string; observedAt: string; bucket: string }): Map<string, GfwGridDetailEntry> | null {
  if (!isObject(raw) || raw.schema_version !== 1 || raw.release_id !== expected.releaseId || raw.observed_at !== expected.observedAt ||
    raw.bucket !== expected.bucket || raw.key !== "cell_id" || !isNonNegativeInt(raw.entry_count) ||
    !isNonNegativeInt(raw.vessel_count) || !isObject(raw.entries)) return null;
  const keys = Object.keys(raw.entries);
  if (keys.length !== raw.entry_count) return null;
  const entries = new Map<string, GfwGridDetailEntry>();
  let vesselCount = 0;
  for (const cellId of keys) {
    const value = raw.entries[cellId];
    if (!cellId || !isObject(value) || !isNonNegativeInt(value.vessel_count)) return null;
    const vessels = parseGfwHourlyGridVessels(value.vessels);
    if (!vessels || vessels.length !== value.vessel_count) return null;
    vesselCount += value.vessel_count;
    entries.set(cellId, { vesselCount: value.vessel_count, vessels });
  }
  return vesselCount === raw.vessel_count ? entries : null;
}

function parseAdaptiveGridEntries(raw: unknown, expectedObservedAt: string): Map<string, GfwGridDetailEntry> | null {
  if (!isObject(raw) || raw.schema_version !== 1 || raw.observed_at !== expectedObservedAt || raw.key !== "cell_id" ||
    !isNonNegativeInt(raw.entry_count) || !isNonNegativeInt(raw.vessel_count) || !isObject(raw.entries)) return null;
  const keys = Object.keys(raw.entries);
  if (keys.length !== raw.entry_count) return null;
  const entries = new Map<string, GfwGridDetailEntry>();
  let vesselCount = 0;
  for (const cellId of keys) {
    const value = raw.entries[cellId];
    if (!cellId || !isObject(value) || !isNonNegativeInt(value.vessel_count) || !Array.isArray(value.members)) return null;
    const vessels = parseGfwHourlyGridVessels(value.members);
    if (!vessels || vessels.length !== value.vessel_count || vessels.some((vessel) =>
      vessel.imo === undefined || vessel.callsign === undefined || vessel.dataset === undefined ||
      vessel.geartype === undefined || vessel.firstTransmissionDate === undefined ||
      vessel.lastTransmissionDate === undefined || vessel.hours === undefined ||
      vessel.entryTimestamp === undefined || vessel.exitTimestamp === undefined,
    )) return null;
    vesselCount += value.vessel_count;
    entries.set(cellId, { vesselCount: value.vessel_count, vessels });
  }
  return vesselCount === raw.vessel_count ? entries : null;
}

function parseTrackEntries(raw: unknown, expected: { releaseId: string; displayDate: string; bucket: string }): Map<string, GfwTrackDetailEntry> | null {
  if (!isObject(raw) || raw.schema_version !== 1 || raw.release_id !== expected.releaseId || raw.display_date !== expected.displayDate ||
    raw.bucket !== expected.bucket || raw.key !== "track_id" || !isNonNegativeInt(raw.entry_count) ||
    !isNonNegativeInt(raw.point_count) || !isObject(raw.entries)) return null;
  const keys = Object.keys(raw.entries);
  if (keys.length !== raw.entry_count) return null;
  const entries = new Map<string, GfwTrackDetailEntry>();
  let pointCount = 0;
  for (const trackId of keys) {
    const value = raw.entries[trackId];
    if (!trackId || !isObject(value) || value.track_id !== trackId || !isNonNegativeInt(value.point_count) ||
      !utc(value.start_at) || !utc(value.end_at) || Date.parse(value.start_at) > Date.parse(value.end_at) ||
      !Array.isArray(value.observed_times) || !value.observed_times.every(utc)) return null;
    const observedTimes = value.observed_times as string[];
    if (observedTimes.length !== value.point_count || observedTimes.some((time, index) => index > 0 && Date.parse(time) <= Date.parse(observedTimes[index - 1]!))) return null;
    const vessels = parseGfwHourlyGridVessels([{
      vessel_id: value.vessel_id, mmsi: value.mmsi, ship_name: value.ship_name, vessel_type: value.vessel_type, flag: value.flag,
    }]);
    if (!vessels) return null;
    pointCount += value.point_count;
    entries.set(trackId, { trackId, vessel: vessels[0]!, startAt: value.start_at, endAt: value.end_at, pointCount: value.point_count, observedTimes });
  }
  return pointCount === raw.point_count ? entries : null;
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

function resolveAssetUrl(manifestUrl: string, path: string): string {
  return new URL(path, new URL(manifestUrl, globalThis.location?.origin ?? "http://localhost")).toString();
}

export async function loadGfwGzipJsonAsset(
  manifestUrl: string,
  entry: Pick<GfwDetailBucket, "path" | "sha256" | "bytes">,
  transparentGzip = false,
): Promise<unknown | null> {
  try {
    const response = await fetch(resolveAssetUrl(manifestUrl, entry.path), { cache: "force-cache" });
    if (!response.ok) return null;
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength === entry.bytes && (await sha256Hex(bytes))?.toLowerCase() === entry.sha256.toLowerCase()) {
      return decodeGzipJson(bytes);
    }
    // Vite transparently decodes public *.gz responses in DEV. The immutable root already
    // cross-checks this path/bytes/sha against its artifact ledger and collector readback;
    // require Vite's exact encoded length/header here, then validate the decoded payload below.
    const contentEncoding = response.headers?.get?.("content-encoding")?.toLowerCase();
    const contentLength = Number(response.headers?.get?.("content-length"));
    const isLocalV4Shadow = import.meta.env.DEV &&
      new URL(manifestUrl, globalThis.location?.origin ?? "http://localhost").pathname === "/gfw-v4-poc/manifest.json";
    if (!transparentGzip || !isLocalV4Shadow || contentEncoding !== "gzip" || contentLength !== entry.bytes) return null;
    try { return JSON.parse(new TextDecoder().decode(bytes)); } catch { return null; }
  } catch {
    return null;
  }
}

function bucketEntry(entries: readonly GfwDetailBucket[], bucket: string): GfwDetailBucket | null {
  return entries.find((entry) => entry.bucket === bucket) ?? null;
}

function loadedGfwGridDetailProperties(
  properties: Record<string, unknown>,
  detail: GfwGridDetailEntry,
  attribution: { label: string; href: string } | undefined,
): Record<string, unknown> {
  return {
    ...properties, vessel_count: detail.vesselCount, vessels_json: serializeGfwHourlyGridVessels(detail.vessels), detail_status: "loaded",
    full_fidelity: 1, attribution_label: attribution?.label ?? "Global Fishing Watch", attribution_href: attribution?.href ?? "https://globalfishingwatch.org/",
  };
}

export async function loadGfwGridCellDetail(
  manifestUrl: string,
  releaseId: string,
  hour: GridDetailHour,
  cellId: string,
  detailShard?: string,
): Promise<GfwGridDetailEntry | null> {
  if (hour.detailMode === "adaptive-shard") {
    if (!detailShard || !/^part-\d{4}\.json\.gz$/.test(detailShard)) return null;
    const entry = hour.detailBuckets.find((candidate) => candidate.bucket === detailShard);
    if (!entry || !entry.path.endsWith(`/${detailShard}`)) return null;
    const parsed = parseAdaptiveGridEntries(
      await loadGfwGzipJsonAsset(manifestUrl, entry, true),
      hour.observedAt,
    );
    return parsed?.get(cellId) ?? null;
  }
  const bucket = await gfwDetailBucketForKey(cellId);
  const entry = bucket ? bucketEntry(hour.detailBuckets, bucket) : null;
  if (!bucket || !entry) return null;
  const parsed = parseGridEntries(await loadGfwGzipJsonAsset(manifestUrl, entry), { releaseId, observedAt: hour.observedAt, bucket });
  return parsed?.get(cellId) ?? null;
}

export async function loadGfwTrackDetail(
  manifestUrl: string,
  releaseId: string,
  day: TrackDetailDay,
  trackId: string,
): Promise<GfwTrackDetailEntry | null> {
  const bucket = await gfwDetailBucketForKey(trackId);
  const entry = bucket ? bucketEntry(day.detailBuckets, bucket) : null;
  if (!bucket || !entry) return null;
  const parsed = parseTrackEntries(await loadGfwGzipJsonAsset(manifestUrl, entry), { releaseId, displayDate: day.displayDate, bucket });
  return parsed?.get(trackId) ?? null;
}

export async function hydrateGfwGridDetail(properties: Record<string, unknown>): Promise<Record<string, unknown>> {
  const cellId = typeof properties.cell_id === "string" ? properties.cell_id : null;
  const observedAt = typeof properties.dominant_observed_at === "string" ? properties.dominant_observed_at
    : typeof properties.observed_at === "string" ? properties.observed_at : null;
  const hour = observedAt ? gridContext?.hours.find((candidate) => candidate.observedAt === observedAt) : null;
  const detailShard = typeof properties.detail_shard === "string" ? properties.detail_shard : undefined;
  if (!gridContext?.fullFidelity || !cellId || !hour?.detailBuckets?.length) {
    return { ...properties, detail_status: "error", detail_error: "此 feature 沒有可驗證的完整清單" };
  }
  const detail = await withLoading(
    `gfw-hourly-grid:detail:${gridContext.releaseId}:${observedAt}:${cellId}`,
    "GFW 格網完整船舶清單",
    loadGfwGridCellDetail(gridContext.manifestUrl, gridContext.releaseId, hour, cellId, detailShard),
  );
  if (!detail || (typeof properties.vessel_count === "number" && properties.vessel_count !== detail.vesselCount)) {
    return { ...properties, detail_status: "error", detail_error: "完整船舶清單驗證失敗" };
  }
  return loadedGfwGridDetailProperties(properties, detail, gridContext.attribution);
}

export async function hydrateGfwTrackDetail(properties: Record<string, unknown>): Promise<Record<string, unknown>> {
  const trackId = typeof properties.track_id === "string" ? properties.track_id : null;
  const selected = typeof properties.selected_time === "string" ? Date.parse(properties.selected_time) : Number.NaN;
  const displayDate = typeof properties.display_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(properties.display_date)
    ? properties.display_date
    : Number.isFinite(selected) ? new Date(selected).toISOString().slice(0, 10) : null;
  const day = displayDate ? tracksContext?.days.get(displayDate) : null;
  if (!tracksContext?.fullFidelity || !trackId || !day?.detailBuckets?.length) {
    return { ...properties, detail_status: "error", detail_error: "此航段沒有可驗證的完整詳情" };
  }
  const detail = await withLoading(
    `gfw-hourly-tracks:detail:${tracksContext.releaseId}:${displayDate}:${trackId}`,
    "GFW 航段完整詳情",
    loadGfwTrackDetail(tracksContext.manifestUrl, tracksContext.releaseId, day as TrackDetailDay, trackId),
  );
  if (!detail) return { ...properties, detail_status: "error", detail_error: "航段完整詳情驗證失敗" };
  return {
    ...properties, vessel_id: detail.vessel.vesselId, mmsi: detail.vessel.mmsi, ship_name: detail.vessel.shipName,
    vessel_type: detail.vessel.vesselType, flag: detail.vessel.flag, point_count: detail.pointCount,
    start_at: detail.startAt, end_at: detail.endAt, observed_times: JSON.stringify(detail.observedTimes), detail_status: "loaded",
    full_fidelity: 1, attribution_label: tracksContext.attribution?.label ?? "Global Fishing Watch", attribution_href: tracksContext.attribution?.href ?? "https://globalfishingwatch.org/",
  };
}

export const __testOnly = { parseGridEntries, parseAdaptiveGridEntries, parseTrackEntries, resolveAssetUrl, loadedGfwGridDetailProperties };

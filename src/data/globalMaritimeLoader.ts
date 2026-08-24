import { supabase, supabaseConfigured } from "../lib/supabase";
import { withLoading } from "../lib/loadingRegistry";
import { cachedByKey } from "../lib/loaderCache";

export interface MaritimeBounds {
  minLon: number;
  minLat: number;
  maxLon: number;
  maxLat: number;
}

export interface AisstreamVessel {
  provider: string;
  mmsi: string;
  shipName: string | null;
  shipType: string | null;
  imo: string | null;
  callSign: string | null;
  destination: string | null;
  navStatus: string | null;
  speedKnots: number | null;
  courseOverGround: number | null;
  trueHeading: number | null;
  longitude: number;
  latitude: number;
  observedAt: string | null;
  receivedAt: string | null;
  ageSeconds: number | null;
  positionQuality: string | null;
  qualityFlags: unknown;
  coverageZone: string | null;
}

export interface GfwVesselPresence {
  provider: string;
  vesselId: string;
  mmsi: string | null;
  shipName: string | null;
  vesselType: string | null;
  flag: string | null;
  longitude: number;
  latitude: number;
  sourceSnapshotDate: string | null;
  observedAt: string | null;
  receivedAt: string | null;
  ageHours: number | null;
  presenceQuality: string | null;
  qualityFlags: unknown;
  sourceDatasetId: string | null;
}

const str = (value: unknown): string | null =>
  value === null || value === undefined || value === "" ? null : String(value);
const num = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

function boundsKey(bounds: MaritimeBounds): string {
  return [bounds.minLon, bounds.minLat, bounds.maxLon, bounds.maxLat].map((v) => v.toFixed(3)).join(",");
}

function rpcBounds(bounds: MaritimeBounds): Record<string, number> {
  return {
    p_min_lon: bounds.minLon,
    p_min_lat: bounds.minLat,
    p_max_lon: bounds.maxLon,
    p_max_lat: bounds.maxLat,
  };
}

async function fetchAisstreamUncached(key: string): Promise<AisstreamVessel[]> {
  if (!supabaseConfigured) return [];
  const bounds = key.split(",").map(Number) as [number, number, number, number];
  const { data, error } = await withLoading(
    `aisstream:vessels:${key}`,
    "AISStream 船舶位置",
    supabase.rpc("get_aisstream_vessels_current", {
      ...rpcBounds({ minLon: bounds[0]!, minLat: bounds[1]!, maxLon: bounds[2]!, maxLat: bounds[3]! }),
      p_max_age_minutes: 30,
      p_limit: 3000,
    }),
  );
  if (error) {
    console.warn("[GlobalMaritime] AISStream RPC failed:", error.message);
    return [];
  }
  const out: AisstreamVessel[] = [];
  for (const row of (data ?? []) as Record<string, unknown>[]) {
    const longitude = Number(row.longitude);
    const latitude = Number(row.latitude);
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) continue;
    out.push({
      provider: String(row.provider ?? "aisstream"),
      mmsi: String(row.mmsi ?? ""),
      shipName: str(row.ship_name),
      shipType: str(row.ship_type),
      imo: str(row.imo),
      callSign: str(row.call_sign),
      destination: str(row.destination),
      navStatus: str(row.nav_status),
      speedKnots: num(row.speed_knots),
      courseOverGround: num(row.course_over_ground),
      trueHeading: num(row.true_heading),
      longitude,
      latitude,
      observedAt: str(row.observed_at),
      receivedAt: str(row.received_at),
      ageSeconds: num(row.age_seconds),
      positionQuality: str(row.position_quality),
      qualityFlags: row.quality_flags ?? null,
      coverageZone: str(row.coverage_zone),
    });
  }
  return out;
}

async function fetchGfwUncached(key: string): Promise<GfwVesselPresence[]> {
  if (!supabaseConfigured) return [];
  const bounds = key.split(",").map(Number) as [number, number, number, number];
  const { data, error } = await withLoading(
    `gfw:vessel-presence:${key}`,
    "Global Fishing Watch 船舶 presence",
    supabase.rpc("get_gfw_vessel_presence_current", {
      ...rpcBounds({ minLon: bounds[0]!, minLat: bounds[1]!, maxLon: bounds[2]!, maxLat: bounds[3]! }),
      p_max_age_days: 7,
      p_limit: 3000,
    }),
  );
  if (error) {
    console.warn("[GlobalMaritime] GFW RPC failed:", error.message);
    return [];
  }
  const out: GfwVesselPresence[] = [];
  for (const row of (data ?? []) as Record<string, unknown>[]) {
    const longitude = Number(row.longitude);
    const latitude = Number(row.latitude);
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) continue;
    out.push({
      provider: String(row.provider ?? "global_fishing_watch"),
      vesselId: String(row.vessel_id ?? ""),
      mmsi: str(row.mmsi),
      shipName: str(row.ship_name),
      vesselType: str(row.vessel_type),
      flag: str(row.flag),
      longitude,
      latitude,
      sourceSnapshotDate: str(row.source_snapshot_date),
      observedAt: str(row.observed_at),
      receivedAt: str(row.received_at),
      ageHours: num(row.age_hours),
      presenceQuality: str(row.presence_quality),
      qualityFlags: row.quality_flags ?? null,
      sourceDatasetId: str(row.source_dataset_id),
    });
  }
  return out;
}

const fetchAisstreamCached = cachedByKey(fetchAisstreamUncached, 60_000, 8);
const fetchGfwCached = cachedByKey(fetchGfwUncached, 6 * 60 * 60_000, 8);

export function fetchAisstreamVessels(bounds: MaritimeBounds): Promise<AisstreamVessel[]> {
  return fetchAisstreamCached(boundsKey(bounds));
}

export function fetchGfwVesselPresence(bounds: MaritimeBounds): Promise<GfwVesselPresence[]> {
  return fetchGfwCached(boundsKey(bounds));
}

export function aisstreamToGeoJSON(rows: AisstreamVessel[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: rows.filter((row) => Number.isFinite(row.longitude) && Number.isFinite(row.latitude)).map((row) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [row.longitude, row.latitude] },
      properties: {
        provider: row.provider,
        mmsi: row.mmsi,
        ship_name: row.shipName,
        ship_type: row.shipType,
        imo: row.imo,
        call_sign: row.callSign,
        destination: row.destination,
        nav_status: row.navStatus,
        speed_knots: row.speedKnots,
        course_over_ground: row.courseOverGround,
        true_heading: row.trueHeading,
        observed_at: row.observedAt,
        received_at: row.receivedAt,
        age_seconds: row.ageSeconds,
        position_quality: row.positionQuality,
        quality_flags: row.qualityFlags,
        coverage_zone: row.coverageZone,
        source_attribution: "AISStream（AIS message feed）",
        layer_source: "aisstream",
      },
    })),
  };
}

export function gfwToGeoJSON(rows: GfwVesselPresence[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: rows.filter((row) => Number.isFinite(row.longitude) && Number.isFinite(row.latitude)).map((row) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [row.longitude, row.latitude] },
      properties: {
        provider: row.provider,
        vessel_id: row.vesselId,
        mmsi: row.mmsi,
        ship_name: row.shipName,
        vessel_type: row.vesselType,
        flag: row.flag,
        source_snapshot_date: row.sourceSnapshotDate,
        observed_at: row.observedAt,
        received_at: row.receivedAt,
        age_hours: row.ageHours,
        presence_quality: row.presenceQuality,
        quality_flags: row.qualityFlags,
        source_dataset_id: row.sourceDatasetId,
        source_attribution: "Global Fishing Watch（daily vessel presence）",
        layer_source: "gfw",
      },
    })),
  };
}

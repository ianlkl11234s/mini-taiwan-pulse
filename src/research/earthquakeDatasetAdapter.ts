import { withLoading } from "../lib/loadingRegistry";
import { supabase } from "../lib/supabase";
import { boundedAccess, DEFAULT_VALUE_SEMANTICS, type DatasetDescriptor, type Scalar, type SourceReceipt } from "./dataContracts";
import type { AdapterReadResult, QueryAdapter } from "./queryExecutor";

/** A deliberately bounded raw row from public.earthquake_replay_events(). */
export interface EarthquakeReplayRawRow {
  event_id: string | number | null;
  occurred_at: string | null;
  magnitude: number | null;
  depth_km: number | null;
  epicenter_lat: number | null;
  epicenter_lng: number | null;
  location: string | null;
  station_count: number | null;
  has_town: boolean | null;
  town_origin_time: string | null;
  has_grid: boolean | null;
  grid_event_time: string | null;
  has_tensor: boolean | null;
  tensor_origin_utc: string | null;
}

export type EarthquakeReplayFetcher = (eventId: string, signal?: AbortSignal) => Promise<readonly EarthquakeReplayRawRow[]>;

export const earthquakeReplayDescriptor: DatasetDescriptor = {
  schemaVersion: "pulse-dataset/0.1",
  datasetId: "cwa-earthquake-replay-events",
  label: "CWA 國內地震回放事件",
  description: "依 event_id 等值讀取的 CWA 地震回放事件收據。震央可作 point context；不是受災範圍、建築級定位或完整地震目錄。",
  layerRefs: ["earthquakeReplay"],
  kind: "event",
  recordGrain: "event",
  primaryKey: ["event_id"],
  fields: [
    { name: "event_id", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "occurred_at", type: "datetime", nullable: false, nullMeaning: null, unit: null },
    { name: "magnitude", type: "number", nullable: true, nullMeaning: "CWA 回放 RPC 未提供規模；不可代填為 0", unit: "M" },
    { name: "depth_km", type: "number", nullable: true, nullMeaning: "CWA 回放 RPC 未提供深度；不可代填為 0", unit: "km" },
    { name: "location", type: "string", nullable: true, nullMeaning: "CWA 回放 RPC 未提供位置描述", unit: null },
    { name: "station_count", type: "number", nullable: true, nullMeaning: "CWA 回放 RPC 未提供已配對測站數", unit: "stations" },
    { name: "has_town", type: "boolean", nullable: true, nullMeaning: "未提供鄉鎮震度配對狀態", unit: null },
    { name: "has_grid", type: "boolean", nullable: true, nullMeaning: "未提供震度網格配對狀態", unit: null },
    { name: "has_tensor", type: "boolean", nullable: true, nullMeaning: "未提供機制解配對狀態", unit: null },
    { name: "geometry", type: "json", nullable: true, nullMeaning: "震央座標缺失或不合法；保留為未定位事件", unit: null },
  ],
  geometry: {
    type: "Point", crs: "EPSG:4326", role: "actual",
    precision: "CWA source epicenter coordinates as published (currently two decimal places); an epicenter point is not an affected area or building-precision location",
    spatialAnalysisEligible: true,
  },
  timeFields: [{ name: "occurred_at", role: "occurred", timezone: "UTC" }],
  coverage: "One requested event_id from a public RPC response capped at two rows; a bounded acquired snapshot, not a complete earthquake catalog or current feed.",
  license: "CWA source terms and downstream replay availability require per-receipt verification",
  valueSemantics: {
    ...DEFAULT_VALUE_SEMANTICS,
    null: "Raw RPC nulls, including magnitude and depth, remain null and are never converted to zero.",
    missing: "Missing event rows or replay detail are not evidence that no earthquake occurred.",
  },
  versions: [],
  source: {
    publisher: "中央氣象署（CWA）",
    reference: "supabase:public.earthquake_replay_events",
    lineage: "CWA earthquake observations -> replay ingestion -> public RPC bounded by event_id -> research event receipt",
  },
  access: boundedAccess({
    mode: "public", method: "rpc",
    fields: ["event_id", "occurred_at", "magnitude", "depth_km", "location", "station_count", "has_town", "has_grid", "has_tensor", "geometry"],
    filters: ["event_id"], timeFields: ["occurred_at"], supportsBbox: true,
    maxRowsPerQuery: 2, maxScanRows: 2,
  }),
  parameters: [{ name: "eventId", type: "string", required: true }],
  supportedOperations: ["query_records", "nearest"],
  adapterId: "cwa-earthquake-replay-event-rpc-v1",
};

function stable(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map(key => `${JSON.stringify(key)}:${stable(object[key])}`).join(",")}}`;
}

async function snapshotHash(value: unknown): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(stable(value)));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

function finiteCoordinate(value: unknown, limit: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= limit;
}

function requiredEventId(parameters: Readonly<Record<string, Scalar>>): string {
  const eventId = parameters.eventId;
  if (typeof eventId !== "string" || !eventId.trim() || eventId.length > 160) throw new Error("INVALID_EVENT_ID");
  return eventId;
}

/** Uses PostgREST RPC output filters so an event context read never hydrates the replay list. */
export const fetchEarthquakeReplayEvent: EarthquakeReplayFetcher = async (eventId, signal) => {
  let request = supabase.rpc("earthquake_replay_events").eq("event_id", eventId).limit(2);
  if (signal) request = request.abortSignal(signal);
  const { data, error } = await request;
  if (error) throw new Error(`Supabase earthquake_replay_events (${eventId}): ${error.message}`);
  return (data ?? []) as EarthquakeReplayRawRow[];
};

export function createEarthquakeReplayAdapter(fetcher: EarthquakeReplayFetcher = fetchEarthquakeReplayEvent): QueryAdapter {
  return {
    descriptor: earthquakeReplayDescriptor,
    allowedParameters: { eventId: "string" },
    requiredParameters: ["eventId"],
    async read(parameters, signal): Promise<AdapterReadResult> {
      const eventId = requiredEventId(parameters);
      const rawRows = await withLoading(
        `research:earthquake-replay:${eventId}`,
        `讀取 CWA 地震回放事件 ${eventId}`,
        fetcher(eventId, signal),
      );
      if (rawRows.length > 2) throw new Error("EARTHQUAKE_EVENT_SCAN_BUDGET_EXCEEDED");
      const checksumSha256 = await snapshotHash(rawRows);
      const acquiredAt = new Date().toISOString();
      const source: SourceReceipt = {
        sourceId: "cwa-earthquake-replay-events",
        version: `event:${eventId}:snapshot:${checksumSha256}`,
        acquiredAt,
        checksumSha256,
        reference: earthquakeReplayDescriptor.source.reference,
      };
      const exclusions = { missing_geometry: 0, invalid_geometry: 0, invalid_occurred_at: 0, duplicate_event_id: 0 };
      const ids = new Set<string>();
      const rows: Record<string, unknown>[] = [];
      for (const raw of rawRows) {
        const rowEventId = typeof raw.event_id === "string" || typeof raw.event_id === "number" ? String(raw.event_id) : "";
        if (rowEventId !== eventId) throw new Error("EARTHQUAKE_EVENT_ID_FILTER_CONTRACT_MISMATCH");
        if (ids.has(rowEventId)) {
          exclusions.duplicate_event_id++;
          throw new Error("DUPLICATE_EARTHQUAKE_EVENT_ID");
        }
        ids.add(rowEventId);
        if (typeof raw.occurred_at !== "string" || !Number.isFinite(Date.parse(raw.occurred_at))) {
          exclusions.invalid_occurred_at++;
          continue;
        }
        const hasCoordinates = raw.epicenter_lng !== null && raw.epicenter_lat !== null;
        const geometry = finiteCoordinate(raw.epicenter_lng, 180) && finiteCoordinate(raw.epicenter_lat, 90)
          ? { type: "Point", coordinates: [raw.epicenter_lng, raw.epicenter_lat] }
          : null;
        if (geometry === null) {
          if (hasCoordinates) exclusions.invalid_geometry++;
          else exclusions.missing_geometry++;
        }
        rows.push({
          event_id: rowEventId,
          occurred_at: raw.occurred_at,
          magnitude: raw.magnitude,
          depth_km: raw.depth_km,
          location: raw.location,
          station_count: raw.station_count,
          has_town: raw.has_town,
          has_grid: raw.has_grid,
          has_tensor: raw.has_tensor,
          geometry,
        });
      }
      return {
        rows, sourceRefs: [source], coverage: earthquakeReplayDescriptor.coverage, freshness: "unknown", exclusions,
        rowsScanned: rawRows.length, bytesScanned: null, downloadedBytes: null, requests: 1, cacheHit: false, expiresAt: null,
      };
    },
  };
}

export const earthquakeReplayAdapter = createEarthquakeReplayAdapter();

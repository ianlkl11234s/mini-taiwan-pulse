import { withLoading } from "../lib/loadingRegistry";
import { supabase } from "../lib/supabase";
import { boundedAccess, DEFAULT_VALUE_SEMANTICS, type DatasetDescriptor, type Scalar, type SourceReceipt } from "./dataContracts";
import type { AdapterReadResult, QueryAdapter } from "./queryExecutor";

const MAX_ROWS = 50;
const SOURCE_LIMIT = 51 as const;
const SOURCES = ["live_freeway", "live_highway", "live_city", "event_city"] as const;
const EVENT_TYPES = new Set([1, 2, 3, 4, 5, 6, 7, 8]);

type RoadEventSource = typeof SOURCES[number];
type Lifecycle = "scheduled" | "active" | "expired" | "unknown";
export interface RoadEventCurrentRawRow {
  event_id: string | null;
  source: string | null;
  event_type: number | null;
  severity: number | null;
  road_name: string | null;
  direction: string | null;
  start_km: number | null;
  end_km: number | null;
  title: string | null;
  description: string | null;
  location_other: string | null;
  blocked_lanes: string | null;
  geom: string | null;
  matched_section_id: string | null;
  enrich_status: string | null;
  effective_time: string | null;
  expire_time: string | null;
  last_updated: string | null;
}
export type RoadEventCurrentQuery = Readonly<{ source: RoadEventSource; eventType: number | null; limit: 51 }>;
export type RoadEventCurrentFetcher = (query: RoadEventCurrentQuery, signal?: AbortSignal) => Promise<readonly RoadEventCurrentRawRow[]>;

export const roadEventCurrentDescriptor: DatasetDescriptor = {
  schemaVersion: "pulse-dataset/0.1", datasetId: "tdx-road-events-current", label: "TDX 目前道路事件",
  description: "依固定 TDX source 讀取的 bounded current snapshot。生命週期以本次取得時間與來源有效區間判讀；來源缺席不表示撤回或取消。source_geometry 僅是可解析的來源 JSON，未宣稱 GeoJSON 有效或分析精度。",
  layerRefs: [], kind: "event", recordGrain: "event", primaryKey: ["source", "event_id"],
  fields: [
    { name: "source", type: "string", nullable: false, nullMeaning: null, unit: null }, { name: "event_id", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "event_type", type: "number", nullable: true, nullMeaning: "TDX source did not supply an event type.", unit: null }, { name: "severity", type: "number", nullable: true, nullMeaning: "TDX source did not supply severity.", unit: null },
    { name: "road_name", type: "string", nullable: true, nullMeaning: "TDX source did not supply road name.", unit: null }, { name: "direction", type: "string", nullable: true, nullMeaning: "TDX source did not supply direction.", unit: null },
    { name: "title", type: "string", nullable: true, nullMeaning: "TDX source did not supply title.", unit: null }, { name: "description", type: "string", nullable: true, nullMeaning: "TDX source did not supply description.", unit: null },
    { name: "effective_time_raw", type: "string", nullable: true, nullMeaning: "TDX did not supply EffectiveTime.", unit: null }, { name: "expire_time_raw", type: "string", nullable: true, nullMeaning: "TDX did not supply ExpireTime.", unit: null }, { name: "last_updated_raw", type: "string", nullable: true, nullMeaning: "TDX did not supply LastUpdateTime.", unit: null },
    { name: "effective_time", type: "datetime", nullable: true, nullMeaning: "EffectiveTime raw token missing or unparsable; lifecycle is unknown.", unit: null }, { name: "expire_time", type: "datetime", nullable: true, nullMeaning: "ExpireTime raw token missing or unparsable; lifecycle is unknown.", unit: null },
    { name: "last_updated", type: "datetime", nullable: true, nullMeaning: "LastUpdateTime raw token missing or unparsable; it is source-supplied and not a version or freshness claim.", unit: null }, { name: "assessed_at", type: "datetime", nullable: false, nullMeaning: null, unit: null }, { name: "lifecycle_status", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "source_geometry_raw", type: "string", nullable: true, nullMeaning: "RPC supplied no geometry string.", unit: null }, { name: "source_geometry", type: "json", nullable: true, nullMeaning: "Geometry raw token missing or not a parseable JSON object; no spatial analysis geometry is declared.", unit: null }, { name: "source_geometry_status", type: "string", nullable: false, nullMeaning: null, unit: null },
  ],
  geometry: { type: "none", crs: null, role: "none", precision: "TDX source geometry is mixed and lacks a registered analytical precision contract; retained only as source_geometry.", spatialAnalysisEligible: false }, timeFields: [
    { name: "effective_time", role: "available", timezone: "Asia/Taipei" }, { name: "expire_time", role: "available", timezone: "Asia/Taipei" }, { name: "last_updated", role: "available", timezone: "Asia/Taipei" },
  ],
  coverage: "One allowlisted source current snapshot, returned only when at most 50 rows; a 51st source row rejects the query instead of truncating. Missing current rows are not retractions.",
  license: "TDX terms and attribution apply; verify source terms before redistribution.", valueSemantics: { ...DEFAULT_VALUE_SEMANTICS, null: "Source null stays null; never converted to a lifecycle or geometry value.", missing: "Absent from this current source snapshot is not cancellation, retraction, or proof of no event." }, versions: [],
  source: { publisher: "交通部運輸資料流通服務平臺（TDX）", reference: "supabase:public.get_road_events_current", lineage: "TDX RoadEvent fields -> collector current snapshot -> bounded RPC -> lifecycle assessed at receipt acquiredAt" },
  access: boundedAccess({ mode: "public", method: "rpc", fields: ["source", "event_id", "event_type", "severity", "road_name", "direction", "title", "description", "effective_time_raw", "expire_time_raw", "last_updated_raw", "effective_time", "expire_time", "last_updated", "assessed_at", "lifecycle_status", "source_geometry_raw", "source_geometry", "source_geometry_status"], filters: ["event_type"], timeFields: ["effective_time", "expire_time", "last_updated", "assessed_at"], maxRowsPerQuery: MAX_ROWS, maxScanRows: SOURCE_LIMIT }),
  parameters: [{ name: "source", type: "string", required: true, options: SOURCES }, { name: "eventType", type: "number", required: false }], supportedOperations: ["query_records", "aggregate"], adapterId: "tdx-road-events-current-v1",
};

function stable(value: unknown): string { if (value === null || typeof value !== "object") return JSON.stringify(value); if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`; const object = value as Record<string, unknown>; return `{${Object.keys(object).sort().map(key => `${JSON.stringify(key)}:${stable(object[key])}`).join(",")}}`; }
async function snapshotHash(value: unknown): Promise<string> { const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(stable(value))); return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join(""); }
function source(value: Scalar): RoadEventSource { if (typeof value !== "string" || !(SOURCES as readonly string[]).includes(value)) throw new Error("ROAD_EVENT_SOURCE_NOT_ALLOWED"); return value as RoadEventSource; }
function eventType(value: Scalar | undefined): number | null { if (value === undefined) return null; if (typeof value !== "number" || !Number.isInteger(value) || !EVENT_TYPES.has(value)) throw new Error("ROAD_EVENT_TYPE_NOT_ALLOWED"); return value; }
function timestamp(value: string | null): number | null { return typeof value === "string" && Number.isFinite(Date.parse(value)) ? Date.parse(value) : null; }
function lifecycle(row: RoadEventCurrentRawRow, assessedAt: number): Lifecycle { const effective = timestamp(row.effective_time), expire = timestamp(row.expire_time); if (effective === null || expire === null || effective >= expire) return "unknown"; if (assessedAt < effective) return "scheduled"; if (assessedAt >= expire) return "expired"; return "active"; }
function geometry(value: string | null): { value: Record<string, unknown> | null; status: "missing" | "parsed" | "unparseable" } { if (value === null) return { value: null, status: "missing" }; try { const parsed: unknown = JSON.parse(value); return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? { value: parsed as Record<string, unknown>, status: "parsed" } : { value: null, status: "unparseable" }; } catch { return { value: null, status: "unparseable" }; } }

export const fetchRoadEventsCurrent: RoadEventCurrentFetcher = async (query, signal) => {
  let request = supabase.rpc("get_road_events_current", { p_source: query.source, p_event_type: query.eventType, p_only_active: false, p_limit: query.limit });
  if (signal) request = request.abortSignal(signal);
  const { data, error } = await request;
  if (error) throw new Error(`Supabase get_road_events_current (${query.source}): ${error.message}`);
  return (data ?? []) as RoadEventCurrentRawRow[];
};

export function createRoadEventCurrentAdapter(fetcher: RoadEventCurrentFetcher = fetchRoadEventsCurrent, now: () => Date = () => new Date()): QueryAdapter {
  return {
    descriptor: roadEventCurrentDescriptor, allowedParameters: { source: "string", eventType: "number" }, requiredParameters: ["source"],
    async read(parameters, signal): Promise<AdapterReadResult> {
      const requestedSource = source(parameters.source ?? null); const requestedType = eventType(parameters.eventType);
      const rawRows = await withLoading(`research:road-events:${requestedSource}`, `讀取 TDX 道路事件 ${requestedSource}`, fetcher({ source: requestedSource, eventType: requestedType, limit: SOURCE_LIMIT }, signal));
      if (rawRows.length > SOURCE_LIMIT) throw new Error("ROAD_EVENT_SCAN_BUDGET_EXCEEDED");
      if (rawRows.length === SOURCE_LIMIT) throw new Error("ROAD_EVENT_WINDOW_TOO_DENSE");
      const acquiredAt = now().toISOString(); const assessedAt = Date.parse(acquiredAt); const ids = new Set<string>();
      const rows: Record<string, unknown>[] = [];
      for (const raw of rawRows) {
        if (raw.source !== requestedSource || typeof raw.event_id !== "string" || !raw.event_id) throw new Error("ROAD_EVENT_SOURCE_FILTER_CONTRACT_MISMATCH");
        if (requestedType !== null && raw.event_type !== requestedType) throw new Error("ROAD_EVENT_TYPE_FILTER_CONTRACT_MISMATCH");
        const key = `${raw.source}\u0000${raw.event_id}`; if (ids.has(key)) throw new Error("DUPLICATE_ROAD_EVENT_ID"); ids.add(key);
        const sourceGeometry = geometry(raw.geom);
        rows.push({ source: raw.source, event_id: raw.event_id, event_type: raw.event_type, severity: raw.severity, road_name: raw.road_name, direction: raw.direction, title: raw.title, description: raw.description, effective_time_raw: raw.effective_time, expire_time_raw: raw.expire_time, last_updated_raw: raw.last_updated, effective_time: timestamp(raw.effective_time) === null ? null : raw.effective_time, expire_time: timestamp(raw.expire_time) === null ? null : raw.expire_time, last_updated: timestamp(raw.last_updated) === null ? null : raw.last_updated, assessed_at: acquiredAt, lifecycle_status: lifecycle(raw, assessedAt), source_geometry_raw: raw.geom, source_geometry: sourceGeometry.value, source_geometry_status: sourceGeometry.status });
      }
      const checksumSha256 = await snapshotHash(rawRows); const receipt: SourceReceipt = { sourceId: `tdx-road-events-current:${requestedSource}`, version: `current:${requestedSource}:snapshot:${checksumSha256}`, acquiredAt, checksumSha256, reference: roadEventCurrentDescriptor.source.reference };
      return { rows, sourceRefs: [receipt], coverage: roadEventCurrentDescriptor.coverage, freshness: "unknown", exclusions: {}, rowsScanned: rawRows.length, bytesScanned: null, downloadedBytes: null, requests: 1, cacheHit: false, expiresAt: null };
    },
  };
}

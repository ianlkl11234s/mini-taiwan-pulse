/**
 * 航班軌跡列 → `Flight[]` 的**純函數**（EM-16 共用件）
 *
 * 原本住在 `airspaceLoader.ts`（主站，資料來自 `get_flight_trails` RPC）。
 * `/embed` 回放讀的是同一組欄位的靜態快照鏡像
 * （`scripts/export/export-embed-snapshot.sh flights` → `data-collectors/scripts/export_daily_trails.py`
 * 的 `write_gzip_json` 形狀），解析邏輯完全相同，故抽出共用 —— **只是搬家，行為不變**。
 *
 * ⚠️ 依賴必須單向：本檔**不得** import supabase / loadingRegistry / three，
 * 否則 embed 基礎 bundle 會被拖進 Supabase client。
 *   airspaceLoader（主站）→ flightTrails ← replayRuntime（embed）
 */
import type { Flight, TrailPoint } from "../types";

/** 匯出鏡像列（欄位順序與語意同 `get_flight_trails`）。 */
export interface FlightTrailRow {
  flight_id: string;
  callsign: string;
  aircraft_type: string;
  origin: string;
  destination: string;
  /** `"lat,lng,alt,ts;lat,lng,alt,ts;..."` */
  trail: string;
}

/** 解析航班 trail `"lat,lng,alt,ts;..."` → TrailPoint[] */
export function parseFlightTrail(trail: string): TrailPoint[] {
  const points = trail.split(";");
  const result: TrailPoint[] = new Array(points.length);
  for (let i = 0; i < points.length; i++) {
    const parts = points[i]!.split(",");
    result[i] = [+parts[0]!, +parts[1]!, +parts[2]!, +parts[3]!];
  }
  return result;
}

/**
 * 把一條軌跡依時間間隙拆分成多段（同一 callsign 可能包含多趟航班）
 * @param path 原始軌跡點（已按時間排序）
 * @param maxGap 最大允許間隙秒數（預設 1800 = 30 分鐘）
 */
export function splitTrailByGap(path: TrailPoint[], maxGap: number = 1800): TrailPoint[][] {
  if (path.length < 2) return [path];
  const segments: TrailPoint[][] = [];
  let current: TrailPoint[] = [path[0]!];
  for (let i = 1; i < path.length; i++) {
    const gap = path[i]![3] - path[i - 1]![3];
    if (gap > maxGap) {
      if (current.length >= 2) segments.push(current);
      current = [];
    }
    current.push(path[i]!);
  }
  if (current.length >= 2) segments.push(current);
  return segments;
}

export interface FlightRowsResult {
  flights: Flight[];
  /** [最早, 最晚] unix 秒；無資料時為 [0, 0] */
  timeRange: [number, number];
  /** 被拆成多段的原始列數（呼叫端自行決定要不要 log） */
  splitCount: number;
}

/** 鏡像列 → Flight[]（含多段航班拆分與時間範圍計算）。 */
export function flightRowsToFlights(rows: readonly FlightTrailRow[]): FlightRowsResult {
  let tsMin = Infinity;
  let tsMax = -Infinity;
  let splitCount = 0;

  const flights: Flight[] = [];
  for (const row of rows) {
    const fullPath = parseFlightTrail(row.trail);
    const segments = splitTrailByGap(fullPath, 1800);
    if (segments.length > 1) splitCount++;

    for (let si = 0; si < segments.length; si++) {
      const path = segments[si]!;
      if (path.length < 2) continue;
      const firstTs = path[0]![3];
      const lastTs = path[path.length - 1]![3];
      if (firstTs < tsMin) tsMin = firstTs;
      if (lastTs > tsMax) tsMax = lastTs;

      flights.push({
        fr24_id: segments.length > 1 ? `${row.flight_id}_${si}` : row.flight_id,
        callsign: row.callsign,
        registration: "",
        aircraft_type: row.aircraft_type,
        origin_icao: row.origin,
        origin_iata: "",
        dest_icao: row.destination,
        dest_iata: "",
        dep_time: firstTs,
        arr_time: lastTs,
        status: "",
        trail_points: path.length,
        path,
      });
    }
  }

  return {
    flights,
    timeRange: [tsMin === Infinity ? 0 : tsMin, tsMax === -Infinity ? 0 : tsMax],
    splitCount,
  };
}

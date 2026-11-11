/**
 * 鐵道 adapter 的瀏覽器端預設 fetchers（重用 railLoader／railScheduleLoader，不新增 RPC）。
 * 獨立成檔，讓 railAdapter（預設 load）與 mvpBSources 共用而不互相 import。
 */
import { loadAllRail } from "../../data/railLoader";
import { fetchSupabaseSchedule, fetchTraDailySchedule } from "../../data/railScheduleLoader";
import type { RailStationTime } from "../../types";
import type { RailDaySchedule, RailDepartureInput, RailFetchers, RailSystemId, RailTrackInput } from "./railAdapter";

const SYSTEMS: readonly string[] = ["trtc", "tra", "thsr", "krtc", "tmrt", "klrt"];

function lineCoords(f: GeoJSON.Feature | undefined): [number, number][] | null {
  if (!f || f.geometry?.type !== "LineString") return null;
  return (f.geometry.coordinates as number[][]).map((c) => [c[0]!, c[1]!] as [number, number]);
}

interface RawDeparture {
  departure_time?: string;
  train_id?: string;
  total_travel_time?: number;
  stations?: RailStationTime[];
  od_track_id?: string;
}

function toDeparture(trackId: string, d: RawDeparture): RailDepartureInput | null {
  if (!d.departure_time || !d.train_id || !Array.isArray(d.stations) || typeof d.total_travel_time !== "number") return null;
  return { trainId: d.train_id, trackId, departureTime: d.departure_time, totalTravelTime: d.total_travel_time, stations: d.stations };
}

/** fetchSupabaseSchedule 的兩種形狀（TRTC：陣列含 track_id；其他：{ trackId: schedule }）→ departures */
export function parseSystemSchedule(data: unknown): RailDepartureInput[] | null {
  if (!data || typeof data !== "object") return null;
  const out: RailDepartureInput[] = [];
  const add = (trackId: string, sched: unknown) => {
    const deps = (sched as { departures?: RawDeparture[] } | null)?.departures;
    if (!Array.isArray(deps)) return;
    for (const d of deps) {
      const x = toDeparture(trackId, d);
      if (x) out.push(x);
    }
  };
  if (Array.isArray(data)) {
    for (const item of data) if (item && typeof item === "object" && (item as { track_id?: string }).track_id) add((item as { track_id: string }).track_id, item);
  } else {
    for (const [trackId, sched] of Object.entries(data as Record<string, unknown>)) add(trackId, sched);
  }
  return out.length ? out : null;
}

/** 台鐵每日班表（schedules[] 每列有 od_track_id）→ departures */
export function parseTraSchedule(data: { schedules?: unknown[] } | null): RailDepartureInput[] | null {
  if (!data?.schedules) return null;
  const out: RailDepartureInput[] = [];
  for (const raw of data.schedules as RawDeparture[]) {
    if (!raw?.od_track_id) continue;
    const x = toDeparture(raw.od_track_id, raw);
    if (x) out.push(x);
  }
  return out.length ? out : null;
}

export const liveRailFetchers: RailFetchers = {
  async network() {
    const data = await loadAllRail();
    const out: RailTrackInput[] = [];
    for (const sys of data.systems) {
      if (!SYSTEMS.includes(sys.id)) continue;
      for (const [trackId, f] of sys.tracks) {
        const coords = lineCoords(f);
        const sp = sys.stationProgress[trackId];
        if (coords && sp) out.push({ system: sys.id as RailSystemId, trackId, coords, stationProgress: sp });
      }
    }
    if (data.traData) {
      for (const [trackId, f] of data.traData.odTracks) {
        const coords = lineCoords(f);
        const sp = data.traData.stationProgress[trackId];
        if (coords && sp) out.push({ system: "tra", trackId, coords, stationProgress: sp });
      }
    }
    return out;
  },
  async schedule(system, opDay): Promise<RailDaySchedule> {
    // fetchSupabaseSchedule 沒有 _daily 時會退回 _fixed（固定時刻表），前端分不出 → daily_or_fixed_unverified
    if (system === "tra") {
      const deps = parseTraSchedule(await fetchTraDailySchedule(opDay));
      return { departures: deps, basis: "daily_or_fixed_unverified", reason: deps ? undefined : "tra_schedule_not_found" };
    }
    const deps = parseSystemSchedule(await fetchSupabaseSchedule(system, opDay));
    return { departures: deps, basis: "daily_or_fixed_unverified", reason: deps ? undefined : `${system}_schedule_not_found` };
  },
};

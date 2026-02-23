import type { RailSystem, RailTrain, RailStationTime } from "../types";

/**
 * 時間字串 "HH:MM:SS" 轉為當天秒數，支援延長日制（00:00-05:59 → 24:00-29:59）
 */
function timeToSeconds(timeStr: string): number {
  const parts = timeStr.split(":");
  const h = parseInt(parts[0] ?? "0", 10);
  const m = parseInt(parts[1] ?? "0", 10);
  const s = parts[2] ? parseInt(parts[2], 10) : 0;
  const totalSec = h * 3600 + m * 60 + s;
  // 延長日制：凌晨 0-5 點視為前一天的 24-29 點
  return h < 6 ? totalSec + 86400 : totalSec;
}

/**
 * Unix timestamp 轉為延長日秒數（台灣時區 UTC+8）
 */
function unixToExtendedDaySeconds(unixTs: number): number {
  const daySeconds = ((unixTs + 8 * 3600) % 86400);
  // 延長日制
  return daySeconds < 6 * 3600 ? daySeconds + 86400 : daySeconds;
}

/**
 * 計算線段總長度
 */
function calculateTotalLength(coords: [number, number][]): number {
  let total = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    const a = coords[i]!;
    const b = coords[i + 1]!;
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    total += Math.sqrt(dx * dx + dy * dy);
  }
  return total;
}

/**
 * 在 LineString 上進行線性內插
 */
function interpolateOnLineString(
  coords: [number, number][],
  progress: number,
): [number, number] {
  if (coords.length === 0) return [0, 0];
  if (coords.length === 1) return coords[0]!;
  if (progress <= 0) return coords[0]!;
  if (progress >= 1) return coords[coords.length - 1]!;

  const totalLength = calculateTotalLength(coords);
  const targetDistance = totalLength * progress;

  let accumulated = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    const a = coords[i]!;
    const b = coords[i + 1]!;
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const segLen = Math.sqrt(dx * dx + dy * dy);
    if (accumulated + segLen >= targetDistance) {
      const t = (targetDistance - accumulated) / segLen;
      return [
        a[0] + dx * t,
        a[1] + dy * t,
      ];
    }
    accumulated += segLen;
  }

  return coords[coords.length - 1]!;
}

/**
 * 根據已過時間找到當前所在的區段
 */
function findCurrentSegment(
  stations: RailStationTime[],
  elapsedTime: number,
): {
  status: "running" | "stopped" | "arrived" | "waiting";
  stationIndex: number;
  nextStationIndex: number;
  segmentProgress: number;
} {
  if (elapsedTime < 0) {
    return { status: "waiting", stationIndex: 0, nextStationIndex: 0, segmentProgress: 0 };
  }

  for (let i = 0; i < stations.length; i++) {
    const s = stations[i]!;
    if (elapsedTime >= s.arrival && elapsedTime < s.departure) {
      return {
        status: "stopped",
        stationIndex: i,
        nextStationIndex: Math.min(i + 1, stations.length - 1),
        segmentProgress: 0,
      };
    }

    if (i < stations.length - 1) {
      const next = stations[i + 1]!;
      if (elapsedTime >= s.departure && elapsedTime < next.arrival) {
        const travelTime = next.arrival - s.departure;
        const t = travelTime > 0 ? (elapsedTime - s.departure) / travelTime : 0;
        return {
          status: "running",
          stationIndex: i,
          nextStationIndex: i + 1,
          segmentProgress: Math.max(0, Math.min(1, t)),
        };
      }
    }
  }

  return {
    status: "arrived",
    stationIndex: stations.length - 1,
    nextStationIndex: stations.length - 1,
    segmentProgress: 1,
  };
}

const TERMINAL_DWELL_TIME = 30;

/**
 * 軌道列車引擎 — 從 mini-taipei-v3 TrainEngine 簡化移植
 * 移除碰撞檢測，保留延長日制
 */
export class RailEngine {
  private systems: RailSystem[];

  constructor(systems: RailSystem[]) {
    this.systems = systems;
  }

  /**
   * 根據 Unix timestamp 更新所有活躍列車
   */
  update(unixTimestamp: number): RailTrain[] {
    const extendedTime = unixToExtendedDaySeconds(unixTimestamp);
    const trains: RailTrain[] = [];

    for (const system of this.systems) {
      for (const [trackId, schedule] of system.schedules) {
        const track = system.tracks.get(trackId);
        if (!track) continue;

        const coords = (track.geometry as GeoJSON.LineString).coordinates as [number, number][];
        if (coords.length < 2) continue;

        const color = (schedule.train_color || (track.properties as any)?.color || "#ffffff") as string;
        const totalStations = schedule.stations?.length || schedule.departures[0]?.stations?.length || 0;
        const progressMap = system.stationProgress[trackId];

        for (const dep of schedule.departures) {
          const depSeconds = timeToSeconds(dep.departure_time);
          const elapsed = extendedTime - depSeconds;

          // 跳過不在範圍內的班次
          if (elapsed < -60 || elapsed > dep.total_travel_time + TERMINAL_DWELL_TIME + 60) {
            continue;
          }

          const seg = findCurrentSegment(dep.stations, elapsed);
          if (seg.status === "waiting") continue;

          // 已抵達終點的列車
          if (seg.status === "arrived") {
            const timeAfter = elapsed - dep.total_travel_time;
            if (timeAfter > TERMINAL_DWELL_TIME) continue;
          }

          const displayStatus: "running" | "stopped" =
            seg.status === "arrived" ? "stopped" : (seg.status as "running" | "stopped");

          // 計算位置
          let position: [number, number];
          const curStation = dep.stations[seg.stationIndex];
          const nextStation = dep.stations[seg.nextStationIndex];

          const getProgress = (stationId: string, fallbackIdx: number): number => {
            if (progressMap && typeof progressMap[stationId] === "number") {
              return progressMap[stationId];
            }
            return totalStations > 1 ? fallbackIdx / (totalStations - 1) : 0;
          };

          if (displayStatus === "stopped") {
            const p = curStation
              ? getProgress(curStation.station_id, seg.stationIndex)
              : (totalStations > 1 ? seg.stationIndex / (totalStations - 1) : 0);
            position = interpolateOnLineString(coords, p);
          } else {
            const fromP = curStation
              ? getProgress(curStation.station_id, seg.stationIndex)
              : (totalStations > 1 ? seg.stationIndex / (totalStations - 1) : 0);
            const toP = nextStation
              ? getProgress(nextStation.station_id, seg.nextStationIndex)
              : (totalStations > 1 ? seg.nextStationIndex / (totalStations - 1) : 0);
            const actualP = fromP + (toP - fromP) * seg.segmentProgress;
            position = interpolateOnLineString(coords, actualP);
          }

          trains.push({
            trainId: dep.train_id,
            trackId,
            systemId: system.id,
            position,
            color,
            status: displayStatus,
          });
        }
      }
    }

    return trains;
  }
}

import type { RailSystem, RailTrain, RailStationTime } from "../types";

/**
 * 延長日制起始點：05:50（與 mini-taipei-v3 一致，台鐵/捷運營運日分界）
 */
const DAY_START_SECONDS = 5 * 3600 + 50 * 60; // 05:50 = 21000 秒

/**
 * 時間字串 "HH:MM:SS" 轉為延長日秒數
 * 05:50 前的時間視為前一天延續（+86400）
 */
function timeToSeconds(timeStr: string): number {
  const parts = timeStr.split(":");
  const h = parseInt(parts[0] ?? "0", 10);
  const m = parseInt(parts[1] ?? "0", 10);
  const s = parts[2] ? parseInt(parts[2], 10) : 0;
  const totalSec = h * 3600 + m * 60 + s;
  return totalSec < DAY_START_SECONDS ? totalSec + 86400 : totalSec;
}

/**
 * Unix timestamp 轉為延長日秒數（台灣時區 UTC+8）
 */
function unixToExtendedDaySeconds(unixTs: number): number {
  const daySeconds = ((unixTs + 8 * 3600) % 86400);
  return daySeconds < DAY_START_SECONDS ? daySeconds + 86400 : daySeconds;
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

          // 環狀線特殊處理：終點站 progress 若回到 0.0（起點），強制設為 1.0
          const fixLoopProgress = (p: number, stationIdx: number): number => {
            if (stationIdx === dep.stations.length - 1 && stationIdx > 0 && p < 0.5) {
              return 1.0;
            }
            return p;
          };

          if (displayStatus === "stopped") {
            let p: number;
            if (curStation) {
              p = getProgress(curStation.station_id, seg.stationIndex);
              p = fixLoopProgress(p, seg.stationIndex);
            } else {
              p = totalStations > 1 ? seg.stationIndex / (totalStations - 1) : 0;
            }
            position = interpolateOnLineString(coords, p);
          } else {
            let fromP: number;
            if (curStation) {
              fromP = getProgress(curStation.station_id, seg.stationIndex);
              fromP = fixLoopProgress(fromP, seg.stationIndex);
            } else {
              fromP = totalStations > 1 ? seg.stationIndex / (totalStations - 1) : 0;
            }
            let toP: number;
            if (nextStation) {
              toP = getProgress(nextStation.station_id, seg.nextStationIndex);
              toP = fixLoopProgress(toP, seg.nextStationIndex);
            } else {
              toP = totalStations > 1 ? seg.nextStationIndex / (totalStations - 1) : 0;
            }
            const actualP = fromP + (toP - fromP) * seg.segmentProgress;
            position = interpolateOnLineString(coords, actualP);
          }

          // DEBUG: 追蹤 THSR 列車進度（用完可移除）
          if (system.id === "thsr" && displayStatus === "running") {
            const actualP = (() => {
              if (!curStation || !nextStation) return -1;
              const fp = getProgress(curStation.station_id, seg.stationIndex);
              const tp = getProgress(nextStation.station_id, seg.nextStationIndex);
              return fp + (tp - fp) * seg.segmentProgress;
            })();
            // 每 10 秒 log 一次（避免刷屏）
            if (Math.floor(elapsed) % 600 === 0) {
              console.log(
                `[THSR] ${dep.train_id} | elapsed=${(elapsed / 60).toFixed(0)}min | progress=${(actualP * 100).toFixed(1)}% | stations=${dep.stations.length}/${totalStations} | seg=${seg.stationIndex}→${seg.nextStationIndex} (${seg.segmentProgress.toFixed(2)}) | hasProgressMap=${!!progressMap}`,
              );
            }
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

import type { RailSystem, RailTrain, RailStationTime } from "../types";
import { timeToSeconds, unixToExtendedDaySeconds, interpolateOnLineString } from "./railUtils";

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
          const isLoop = dep.stations.length > 1 &&
            dep.stations[0]!.station_id === dep.stations[dep.stations.length - 1]!.station_id;
          const fixLoopProgress = (p: number, stationIdx: number): number => {
            if (isLoop && stationIdx === dep.stations.length - 1 && stationIdx > 0 && p < 0.5) {
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

/**
 * TraTrainEngine - 台鐵列車專用引擎
 * 從 mini-taipei-v3 完整移植，使用 O-D 專屬軌道計算列車位置
 */

import type { RailTrain, RailStationTime, TraData, TraDeparture, TraSchedule } from "../types";
import { getTrainColor } from "../constants/traTrainTypes";
import { timeToSeconds, unixToExtendedDaySeconds, interpolateOnLineString } from "./railUtils";

const TERMINAL_DWELL_TIME = 60;
const ORIGIN_EARLY_APPEAR_TIME = 120;

/**
 * 從 O-D 軌道 ID 取得顯示用 trackId
 * 完整移植自 mini-taipei-v3（~300 行映射邏輯）
 */
function getTrackIdFromOdTrackId(odTrackId: string): string {
  const parts = odTrackId.split('-');
  const lineId = parts[0];

  // OD-/BB-/SP- 跨線軌道 → 推斷顯示軌道
  if (lineId === 'OD' || lineId === 'BB' || lineId === 'SP') {
    const trackStr = odTrackId.toUpperCase();

    // 南迴線軌道（以 -SK 結尾或包含 -SK-）
    if (trackStr.endsWith('-SK') || trackStr.includes('-SK-')) {
      const parts2 = odTrackId.split('-');
      if (parts2[1] === 'HL' || parts2[1] === 'TT') {
        return 'SK-0';
      }
      return 'SK-1';
    }

    // 海線車站
    if (trackStr.includes('-C-') && !trackStr.includes('-CH-')) {
      return 'WL-C-CH-ZN-0';
    }
    if (trackStr.includes('JJ')) return 'JJ-0';
    if (trackStr.includes('SHL') || trackStr.includes('沙崙')) return 'SH-0';
    if (trackStr.includes('HL2')) return 'WL-M-ZN-CH-0';
    if (trackStr.includes('屏東') || trackStr.includes('PL')) return 'PT-0';
    if (trackStr.includes('CY') || trackStr.includes('TN') || trackStr.includes('KS') || trackStr.includes('CZ')) {
      return 'WL-S-CH-ZY-0';
    }
    if (trackStr.includes('CH')) return 'WL-M-ZN-CH-0';
    if (trackStr.includes('KL') || trackStr.includes('QD')) return 'WL-N-SL-BD-0';
    if (trackStr.includes('ML') || trackStr.includes('三義')) return 'WL-M-ZN-CH-0';
    if (trackStr.includes('TT')) return 'TL-0';
    if (trackStr.includes('HL')) return 'BH-SX-HL-0';
    return 'WL-N-ZN-SL-0';
  }

  // WL 西部幹線
  if (lineId === 'WL') {
    if (odTrackId === 'WL-CH-ZY-0') return 'WL-S-CH-ZY-0';
    if (odTrackId === 'WL-ZY-CH-1') return 'WL-S-CH-ZY-1';
    if (odTrackId === 'WL-C-CH-ZN-0') return 'WL-C-CH-ZN-0';
    if (odTrackId === 'WL-C-ZN-CH-1') return 'WL-C-ZN-CH-1';
    if (odTrackId === 'WL-M-ZN-CH-0') return 'WL-M-ZN-CH-0';
    if (odTrackId === 'WL-M-CH-ZN-1') return 'WL-M-CH-ZN-1';
    if (odTrackId === 'WL-ZN-SL-0') return 'WL-N-ZN-SL-0';
    if (odTrackId === 'WL-SL-ZN-1') return 'WL-N-ZN-SL-1';
    const direction = parts[parts.length - 1];
    return `WL-N-SL-BD-${direction}`;
  }

  const [, , dest] = parts;

  // YL 宜蘭線
  if (lineId === 'YL') {
    if (odTrackId === 'YL-SL-ZY-0') return 'YL-BD-SA-0';
    if (odTrackId === 'YL-ZY-SL-1') return 'YL-SA-BD-1';
    if (odTrackId === 'YL-SL-TT-0') return 'YL-BD-SA-0';
    if (odTrackId === 'YL-TT-SL-1') return 'YL-SA-BD-1';
    if (odTrackId === 'YL-SL-HL-0') return 'YL-BD-SA-0';
    if (odTrackId === 'YL-HL-SL-1') return 'YL-SA-BD-1';
    if (odTrackId === 'YL-SL-SA-0') return 'YL-BD-SA-0';
    if (odTrackId === 'YL-SA-SL-1') return 'YL-SA-BD-1';
    if (odTrackId.startsWith('YL-BD-SA') || odTrackId.startsWith('YL-SA-BD')) return odTrackId;
    const direction = dest === 'TP' ? '1' : '0';
    return `YL-${direction}`;
  }

  // BH 北迴線
  if (lineId === 'BH') {
    if (odTrackId.startsWith('BH-SX-HL') || odTrackId.startsWith('BH-HL-SX')) return odTrackId;
    const direction = dest === 'SX' ? '1' : '0';
    return `BH-${direction}`;
  }

  // KL 基隆支線
  if (lineId === 'KL') {
    if (odTrackId.startsWith('KL-BD-KL') || odTrackId.startsWith('KL-KL-BD')) return odTrackId;
    const direction = dest === 'TP' ? '1' : '0';
    return `KL-${direction}`;
  }

  // TL 臺東線
  if (lineId === 'TL') {
    if (odTrackId === 'TL-HL-TT') return 'TL-0';
    if (odTrackId === 'TL-TT-HL') return 'TL-1';
    const direction = dest === 'HL' ? '1' : '0';
    return `TL-${direction}`;
  }

  // NW 內灣線
  if (lineId === 'NW') {
    if (odTrackId === 'NW-HC-NB' || odTrackId === 'NW-JJ-NB') return 'NW-0';
    if (odTrackId === 'NW-NB-HC' || odTrackId === 'NW-NB-JJ') return 'NW-1';
    return 'NW-0';
  }

  // LJ 六家線
  if (lineId === 'LJ') {
    if (odTrackId === 'LJ-HC-LJ') return 'LJ-0';
    if (odTrackId === 'LJ-LJ-HC') return 'LJ-1';
    return 'LJ-0';
  }

  // SH 沙崙線
  if (lineId === 'SH') {
    if (odTrackId === 'SH-TN-SL') return 'SH-0';
    if (odTrackId === 'SH-SL-TN') return 'SH-1';
    return 'SH-0';
  }

  // JJ 集集線
  if (lineId === 'JJ') {
    if (odTrackId === 'JJ-ES-CT') return 'JJ-0';
    if (odTrackId === 'JJ-CT-ES') return 'JJ-1';
    return 'JJ-0';
  }

  // CZ 成追線
  if (lineId === 'CZ') {
    if (odTrackId === 'CZ-CG-ZF') return 'CZ-0';
    if (odTrackId === 'CZ-ZF-CG') return 'CZ-1';
    return 'CZ-0';
  }

  // PX 平溪線
  if (lineId === 'PX') {
    if (odTrackId === 'PX-SD-JT') return 'PX-0';
    if (odTrackId === 'PX-JT-SD') return 'PX-1';
    return 'PX-0';
  }

  // SK 南迴線
  if (lineId === 'SK') {
    if (odTrackId === 'SK-TT-ZY-0') return 'SK-0';
    if (odTrackId === 'SK-ZY-TT-1') return 'SK-1';
    return 'SK-0';
  }

  // PT 屏東線
  if (lineId === 'PT') {
    if (odTrackId === 'PT-ZY-PL-0') return 'PT-0';
    if (odTrackId === 'PT-PL-ZY-1') return 'PT-1';
    return 'PT-0';
  }

  // SA 深澳線
  if (lineId === 'SA') {
    if (odTrackId === 'SA-RF-BD-0') return 'SA-RF-BD-0';
    if (odTrackId === 'SA-BD-RF-1') return 'SA-BD-RF-1';
    return 'SA-RF-BD-0';
  }

  // 預設
  const mainStations: Record<string, string> = {
    'NW': 'HC', 'LJ': 'HC', 'SH': 'TN', 'PX': 'SD', 'JJ': 'ES', 'CZ': 'CG',
  };
  const mainStation = mainStations[lineId!] || 'HC';
  const direction = dest === mainStation ? '0' : '1';
  return `${lineId}-${direction}`;
}

/**
 * 根據已過時間找到當前所在的區段（簡化版，不含資訊面板欄位）
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

/**
 * TRA 列車專用引擎
 */
export class TraTrainEngine {
  private schedules: Map<string, TraSchedule>;
  private odTracks: Map<string, GeoJSON.Feature>;
  private stationProgress: Record<string, Record<string, number>>;

  constructor(data: TraData) {
    this.schedules = data.schedules;
    this.odTracks = data.odTracks;
    this.stationProgress = data.stationProgress;
  }

  update(unixTimestamp: number): RailTrain[] {
    const extendedTime = unixToExtendedDaySeconds(unixTimestamp);
    const trains: RailTrain[] = [];

    for (const [, schedule] of this.schedules) {
      for (const departure of schedule.departures) {
        const depSeconds = timeToSeconds(departure.departure_time);
        const elapsed = extendedTime - depSeconds;

        if (elapsed < -ORIGIN_EARLY_APPEAR_TIME || elapsed > departure.total_travel_time + TERMINAL_DWELL_TIME + 60) {
          continue;
        }

        const odTrackId = departure.od_track_id;
        const odTrack = this.odTracks.get(odTrackId);
        if (!odTrack) continue;

        const coords = (odTrack.geometry as GeoJSON.LineString).coordinates as [number, number][];
        if (coords.length === 0) continue;

        const trackProgress = this.stationProgress[odTrackId];
        if (!trackProgress) continue;

        const seg = findCurrentSegment(departure.stations, elapsed);

        let displayStatus: "running" | "stopped";
        let isWaitingAtOrigin = false;

        if (seg.status === "waiting") {
          displayStatus = "stopped";
          isWaitingAtOrigin = true;
        } else if (seg.status === "arrived") {
          const timeAfter = elapsed - departure.total_travel_time;
          if (timeAfter > TERMINAL_DWELL_TIME) continue;
          displayStatus = "stopped";
        } else {
          displayStatus = seg.status as "running" | "stopped";
        }

        // 計算位置
        const fromStationId = departure.stations[seg.stationIndex]?.station_id;
        const toStationId = departure.stations[seg.nextStationIndex]?.station_id;

        const fromProgress = fromStationId ? (trackProgress[fromStationId] ?? 0) : 0;
        const toProgress = toStationId ? (trackProgress[toStationId] ?? 1) : 1;

        let position: [number, number];
        if (isWaitingAtOrigin || displayStatus === "stopped") {
          position = interpolateOnLineString(coords, fromProgress);
        } else {
          const actualProgress = fromProgress + (toProgress - fromProgress) * seg.segmentProgress;
          position = interpolateOnLineString(coords, actualProgress);
        }

        trains.push({
          trainId: departure.train_id,
          trackId: getTrackIdFromOdTrackId(odTrackId),
          systemId: "tra",
          position,
          color: getTrainColor(departure.train_type_code),
          status: displayStatus,
          trainTypeCode: departure.train_type_code,
        });
      }
    }

    return trains;
  }
}

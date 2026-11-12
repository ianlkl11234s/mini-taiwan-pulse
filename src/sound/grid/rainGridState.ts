/**
 * 雨網格目前畫在地圖上的狀態（模組級；hook 寫、popup 讀）＋點格查詢。
 *
 * 點格 popup 不讀網格陣列，而是對該格心呼叫 rainEstimateAt（和 queryReceiver 同一支）——
 * 網格值與 popup 由同一規則產生，且 popup 能多給來源、資料時刻與最近雨量站。
 */
import { gateFamilyRecords } from "../engines/receiverQuery";
import { rainEstimateAt, type AnyRainRecord } from "../sourceAdapters/rainFieldAdapter";
import type { SetOrigin } from "../soundAtlasData";
import type { SoundSourceSet } from "../types";
import { cellCenter, cellIndexOf, countyOf, GRID_UNKNOWN } from "./gridSpec";
import { RADAR_RAIN_PROVIDER } from "./radarRainPack";

export const RAIN_GRID_STEP_S = 600;

export interface RainGridState {
  set: SoundSourceSet | null;
  origin: SetOrigin | null;
  /** 目前顯示的 10 分格起點（unix 秒） */
  binStart: number | null;
  /** 量測：最近一次算幀＋上傳貼圖（ms） */
  lastFrameMs: number | null;
  lastUploadMs: number | null;
  frames: number;
}

const state: RainGridState = { set: null, origin: null, binStart: null, lastFrameMs: null, lastUploadMs: null, frames: 0 };

export const rainGridState = (): Readonly<RainGridState> => state;
export function setRainGridState(patch: Partial<RainGridState>): void {
  Object.assign(state, patch);
}

/** 時間 t 所在的 10 分格起點（臺灣時區整點對齊，+08:00 是 600 s 的倍數） */
export const rainGridBin = (t: number): number => Math.floor(t / RAIN_GRID_STEP_S) * RAIN_GRID_STEP_S;

/**
 * 點地圖查格：不在北北範圍或圖層沒資料 → null（讓點擊落到下一個處理者）。
 * 回傳 popup 屬性（FeatureInfo layerType "soundRainCell"）。
 */
export function pickSoundRainCell(lng: number, lat: number): Record<string, unknown> | null {
  const { set, binStart, origin } = state;
  return rainCellInfo(set, origin, binStart, lng, lat);
}

/** 點選查詢（W6-5）：給定 set 與 10 分格，查 (lng, lat) 所在格；不在北北範圍 → null */
export function rainCellInfo(set: SoundSourceSet | null, origin: SetOrigin | null, binStart: number | null, lng: number, lat: number): Record<string, unknown> | null {
  if (!set || binStart == null) return null;
  const cell = cellIndexOf(lng, lat);
  if (cell < 0 || countyOf(cell) === 0) return null;
  const [lon, la] = cellCenter(cell);
  const t0 = binStart, t1 = binStart + RAIN_GRID_STEP_S - 1e-6;
  const gate = gateFamilyRecords("rain", [set], t0, t1);
  const radarPack = set.coverage.find((c) => c.provider === RADAR_RAIN_PROVIDER)?.status === "ok" ? "ok" : "none";
  const base = { cell, county: countyOf(cell), binStart, cellLon: lon, cellLat: la, origin: origin ?? "live", radarPack };
  if (gate.kind !== "ok") return { ...base, rainClass: GRID_UNKNOWN, source: null, unknownReason: gate.reason };
  const est = rainEstimateAt(gate.records as AnyRainRecord[], lon, la, t0, t1);
  const g = est.gauge;
  return {
    ...base,
    rainClass: est.info.rainClass,
    source: est.info.source,
    radarClass: est.info.radarClass,
    radarSlotStart: est.info.radarSlotStart,
    gaugeClass: est.info.gaugeClass,
    gaugeObservedAt: est.info.gaugeObservedAt,
    gaugeMm: g.bestRow?.payload.precipitation1hMm ?? null,
    stationName: g.nearest ? g.nearest.stationName ?? g.nearest.stationId : null,
    stationDistanceM: g.nearest?.distanceM ?? null,
    unknownReason: est.info.rainClass === GRID_UNKNOWN
      ? (g.rainClass == null && est.info.radarClass != null ? "radar_frame_unavailable" : g.unknownReason ?? "rain_unknown")
      : null,
  };
}

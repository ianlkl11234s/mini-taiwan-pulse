/**
 * 道路網格目前畫在地圖上的狀態（模組級；hook 寫、popup 讀）＋點格查詢（W6-2）。
 *
 * 點格 popup 不讀網格陣列，而是對格心呼叫 roadTrafficEstimateAt（和 queryReceiver 同一支），
 * 所以 popup 的分級＝網格顏色，且能多給證據等級、來源 VD／道路等級、資料時刻。
 */
import { gateFamilyRecords } from "../engines/receiverQuery";
import { isRoadNetworkRecord, roadTrafficEstimateAt, type RoadNetworkRecord } from "../sourceAdapters/roadTrafficAdapter";
import type { SetOrigin } from "../soundAtlasData";
import type { SoundSourceRecord, SoundSourceSet } from "../types";
import { cellCenter, cellIndexOf, countyOf, GRID_UNKNOWN } from "./gridSpec";
import { decodeRoadGridCode, roadGridCode } from "./roadNetwork";

export const ROAD_GRID_STEP_S = 600;

export interface RoadGridState {
  set: SoundSourceSet | null;
  origin: SetOrigin | null;
  binStart: number | null;
  lastFrameMs: number | null;
  lastUploadMs: number | null;
  /** 建每格候選來源（載入後一次） */
  fieldMs: number | null;
  frames: number;
}

const state: RoadGridState = { set: null, origin: null, binStart: null, lastFrameMs: null, lastUploadMs: null, fieldMs: null, frames: 0 };

export const roadGridState = (): Readonly<RoadGridState> => state;
export function setRoadGridState(patch: Partial<RoadGridState>): void {
  Object.assign(state, patch);
}

export const roadGridBin = (t: number): number => Math.floor(t / ROAD_GRID_STEP_S) * ROAD_GRID_STEP_S;

/** 點地圖查格：不在北北範圍或圖層沒資料 → null。回傳 popup 屬性（FeatureInfo layerType "soundRoadCell"）。 */
export function pickSoundRoadCell(lng: number, lat: number): Record<string, unknown> | null {
  const { set, binStart, origin } = state;
  return roadCellInfo(set, origin, binStart, lng, lat);
}

/** 點選查詢（W6-5）：給定 set 與 10 分格，查 (lng, lat) 所在格；不在北北範圍 → null */
export function roadCellInfo(set: SoundSourceSet | null, origin: SetOrigin | null, binStart: number | null, lng: number, lat: number): Record<string, unknown> | null {
  if (!set || binStart == null) return null;
  const cell = cellIndexOf(lng, lat);
  if (cell < 0 || countyOf(cell) === 0) return null;
  const [lon, la] = cellCenter(cell);
  const t0 = binStart, t1 = binStart + ROAD_GRID_STEP_S - 1e-6;
  const base = { cell, county: countyOf(cell), binStart, cellLon: lon, cellLat: la, origin: origin ?? "live" };
  const gate = gateFamilyRecords("road_traffic", [set], t0, t1);
  if (gate.kind !== "ok") return { ...base, code: GRID_UNKNOWN, unknownReason: gate.reason };
  const rec = gate.records.find((r) => isRoadNetworkRecord(r as SoundSourceRecord<unknown, "road_traffic">)) as RoadNetworkRecord | undefined;
  if (!rec) return { ...base, code: GRID_UNKNOWN, unknownReason: "source_not_loaded" };
  const est = roadTrafficEstimateAt(rec, lon, la, t0, t1);
  const code = roadGridCode(est);
  const dec = decodeRoadGridCode(code);
  const top = est.top;
  const src = top ? rec.payload.net.sources[top.source]! : null;
  const flow = top?.flow.known ? top.flow : null;
  return {
    ...base,
    code,
    level: dec?.level ?? null,
    status: est.status,
    evidence: top ? dec?.evidence ?? null : null,
    sourceKind: src?.kind ?? null,
    roadName: src?.name ?? null,
    roadDir: src?.dir ?? null,
    roadClass: src?.cls ?? null,
    vdId: src?.vdId ?? null,
    distanceM: top?.distanceM ?? null,
    vehPerHour: flow?.vehPerHour ?? null,
    sampleT: flow?.sampleT ?? null,
    /** active 時另有無法判斷的候選（含小路）→ popup 註明 */
    otherUnknown: est.status === "active" && est.unknownReason != null,
    unknownReason: est.unknownReason,
    freewayPack: rec.payload.ctx.pack ? "ok" : "none",
    typicalApplies: rec.payload.ctx.typical.applies,
  };
}

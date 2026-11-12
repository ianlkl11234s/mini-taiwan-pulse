/**
 * W6-3 連續潛勢網格（飛機、鐵道、風吹樹葉、海浪、河川）目前畫在地圖上的狀態（模組級；hook 寫、popup 讀）＋點格查詢。
 *
 * 點格 popup 不讀網格陣列，而是對格心呼叫 queryFamilyInterval（和 queryReceiver、網格同一套規則），
 * 所以 popup 的分級＝網格顏色；飛機包只存分箱碼，popup 另給精確潛勢。
 */
import { queryFamilyInterval } from "../engines/receiverQuery";
import { contributionPlace, indexRecords, type SetOrigin } from "../soundAtlasData";
import type { Receiver, SoundSourceFamily, SoundSourceSet } from "../types";
import { cellCenter, cellIndexOf, countyOf, GRID_UNKNOWN } from "./gridSpec";
import { familyResultCode, potentialLevelOfCode } from "./potentialCode";

export type PotentialGridFamily = "aviation" | "rail" | "wind_vegetation" | "coastal_wave" | "river_water";
export const POTENTIAL_GRID_FAMILIES: readonly PotentialGridFamily[] = ["aviation", "rail", "wind_vegetation", "coastal_wave", "river_water"];
export const POTENTIAL_GRID_STEP_S = 600;

export interface PotentialGridState {
  set: SoundSourceSet | null;
  origin: SetOrigin | null;
  binStart: number | null;
  /** 顯示門檻（潛勢；只有飛機 ≠ 0） */
  gate: number;
  /** 整幀無法判斷或不畫的原因（no_full_area_source／no_pack_for_date／pack_source_mismatch／receiver_outside_grid／gate reason） */
  frameNote: string | null;
  lastFrameMs: number | null;
  lastUploadMs: number | null;
  /** 建空間場（自然三族）或讀包（飛機）的時間 */
  prepMs: number | null;
  frames: number;
}

const blank = (): PotentialGridState => ({ set: null, origin: null, binStart: null, gate: 0, frameNote: null, lastFrameMs: null, lastUploadMs: null, prepMs: null, frames: 0 });
const states: Record<PotentialGridFamily, PotentialGridState> = {
  aviation: blank(), rail: blank(), wind_vegetation: blank(), coastal_wave: blank(), river_water: blank(),
};

export const potentialGridState = (f: PotentialGridFamily): Readonly<PotentialGridState> => states[f];
export function setPotentialGridState(f: PotentialGridFamily, patch: Partial<PotentialGridState>): void {
  Object.assign(states[f], patch);
}

export const potentialGridBin = (t: number): number => Math.floor(t / POTENTIAL_GRID_STEP_S) * POTENTIAL_GRID_STEP_S;

/** 這些原因是「網格這幀沒有算」（不是查詢結果），popup 直接照實說 */
const WHOLE_FRAME_NOTES = new Set(["no_full_area_source", "no_pack_for_date", "pack_source_mismatch", "outside_pack_time", "source_not_loaded"]);

/** 格心接收點（預設耳高，同網格） */
export function cellReceiver(cell: number): Receiver {
  const [lon, lat] = cellCenter(cell);
  return { id: `grid-cell-${cell}`, longitude: lon, latitude: lat, heightM: 1.5, environment: "outdoor" };
}

/**
 * 點地圖查格：不在北北範圍、圖層沒資料、或這幀不畫（接收點在網格外）→ null。
 * 回傳 popup 屬性（FeatureInfo layerType "soundPotentialCell"）。
 */
export function pickSoundPotentialCell(family: PotentialGridFamily, lng: number, lat: number): Record<string, unknown> | null {
  const { set, binStart, origin, gate, frameNote } = states[family];
  if (!set || binStart == null || frameNote === "receiver_outside_grid") return null;
  const cell = cellIndexOf(lng, lat);
  if (cell < 0 || countyOf(cell) === 0) return null;
  const [lon, la] = cellCenter(cell);
  const t0 = binStart, t1 = binStart + POTENTIAL_GRID_STEP_S - 1e-6;
  const base = { family, cell, county: countyOf(cell), binStart, cellLon: lon, cellLat: la, origin: origin ?? "live", gate, frameNote };
  // 整幀無法判斷（這天沒有全範圍來源檔、沒有每日包）→ 網格是斜線，popup 照實說，不另外算
  if (frameNote && WHOLE_FRAME_NOTES.has(frameNote)) return { ...base, code: GRID_UNKNOWN, level: null, status: "unknown", unknownReason: frameNote };
  const r = queryFamilyInterval(family as SoundSourceFamily, [set], cellReceiver(cell), t0, t1);
  const code = familyResultCode(r);
  const top = r.contributions.filter((c) => c.status === "active").sort((a, b) => (b.relativePotential ?? 0) - (a.relativePotential ?? 0))[0]
    ?? r.contributions.find((c) => c.status === "unknown") ?? null;
  const rec = top ? indexRecords([set]).get(top.sourceId) : undefined;
  const place = rec ? contributionPlace(rec, Date.parse(top!.sourceTime) / 1000) : null;
  return {
    ...base,
    code,
    level: potentialLevelOfCode(code, gate),
    status: r.status,
    potential: r.relativePotential,
    unknownReason: r.status === "active" || r.status === "inactive" ? null : (r.reason ?? top?.unknownReason ?? "unknown"),
    activeCount: r.contributions.filter((c) => c.status === "active").length,
    unknownCount: r.contributions.filter((c) => c.status === "unknown").length,
    topLabel: place?.label ?? null,
    topDistanceM: top?.spatialDistanceM ?? null,
    topSourceTime: top?.sourceTime ?? null,
    topUnknownReason: top?.status === "unknown" ? top.unknownReason ?? null : null,
    proxyKind: top?.proxyKind ?? null,
  };
}

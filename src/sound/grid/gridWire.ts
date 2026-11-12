/**
 * 聲景網格 Worker 的訊息格式與「送進 Worker 前的編碼」（W6-4）。
 *
 * 為什麼要編碼：postMessage 的 structured clone 在主執行緒同步執行。實測（node，11-09）鐵道 set 直接 clone 248–397 ms，
 * 其中 286 條軌道的 71 萬個 [lon, lat] 小陣列就佔 228 ms → 軌道改成 Float64Array（transfer，每條只送一次），
 * 班次 records 改成 JSON 字串（stringify 約 18 ms，字串 clone 近乎 memcpy）。道路路網只送一次（之後只送當日脈絡）。
 * 其他族直接 clone（雨含雷達包 27 ms、自然三族 ≤ 17 ms、飛機只送每日包 9 ms）。
 * Worker 端還原成和主執行緒相同形狀的物件 → 用同一套 kernel（railGrid／roadGrid／rainGrid／naturalGrid），不複製邏輯。
 */
import type { SetOrigin } from "../soundAtlasData";
import type { PreparedTrack, RailRecord } from "../sourceAdapters/railAdapter";
import type { RoadNetworkPayload, RoadNetworkRecord } from "../sourceAdapters/roadTrafficAdapter";
import type { SoundSourceSet } from "../types";
import type { CompositeFamily } from "./compositeGrid";
import type { PotentialPack } from "./potentialPack";
import type { RoadNetwork } from "./roadNetwork";

export type GridFamily = CompositeFamily;

// ── 軌道 ───────────────────────────────────────────────

export interface PackedTrack {
  id: number;
  system: PreparedTrack["system"];
  trackId: string;
  /** [lon0, lat0, lon1, lat1, …] */
  coords: Float64Array;
  cum: Float64Array;
  total: number;
  stationProgress: Record<string, number>;
  intervals: PreparedTrack["intervals"];
  bbox: PreparedTrack["bbox"];
}

export function packTrack(id: number, t: PreparedTrack): PackedTrack {
  const coords = new Float64Array(t.coords.length * 2);
  for (let i = 0; i < t.coords.length; i++) { coords[2 * i] = t.coords[i]![0]; coords[2 * i + 1] = t.coords[i]![1]; }
  return { id, system: t.system, trackId: t.trackId, coords, cum: Float64Array.from(t.cum), total: t.total, stationProgress: t.stationProgress, intervals: t.intervals, bbox: t.bbox };
}

export function unpackTrack(p: PackedTrack): PreparedTrack {
  const coords: [number, number][] = new Array(p.coords.length >> 1);
  for (let i = 0; i < coords.length; i++) coords[i] = [p.coords[2 * i]!, p.coords[2 * i + 1]!];
  return { system: p.system, trackId: p.trackId, coords, cum: Array.from(p.cum), total: p.total, stationProgress: p.stationProgress, intervals: p.intervals, bbox: p.bbox };
}

/** 主執行緒：軌道物件 → 編號（同一物件只送一次；Worker 也以編號保存） */
export class TrackRegistry {
  private ids = new WeakMap<PreparedTrack, number>();
  private next = 0;
  /** 回傳 records 用的編號，並把新軌道放進 fresh */
  idOf(t: PreparedTrack, fresh: PackedTrack[]): number {
    let id = this.ids.get(t);
    if (id == null) {
      id = this.next++;
      this.ids.set(t, id);
      fresh.push(packTrack(id, t));
    }
    return id;
  }
}

export interface EncodedRailSet {
  kind: "rail";
  tracks: PackedTrack[];
  /** JSON：{ family, dateKey, coverage, records（payload.track 換成編號）} */
  json: string;
}

export function encodeRailSet(set: SoundSourceSet, reg: TrackRegistry): EncodedRailSet {
  const tracks: PackedTrack[] = [];
  const records = (set.records as RailRecord[]).map((r) => ({ ...r, payload: { ...r.payload, track: reg.idOf(r.payload.track, tracks) } }));
  return { kind: "rail", tracks, json: JSON.stringify({ family: set.family, dateKey: set.dateKey, coverage: set.coverage, records }) };
}

export function decodeRailSet(enc: EncodedRailSet, tracks: Map<number, PreparedTrack>): SoundSourceSet {
  for (const p of enc.tracks) if (!tracks.has(p.id)) tracks.set(p.id, unpackTrack(p));
  const raw = JSON.parse(enc.json) as SoundSourceSet;
  for (const r of raw.records as unknown as { payload: { track: unknown } }[]) {
    const t = tracks.get(r.payload.track as number);
    if (!t) throw new Error(`rail track ${String(r.payload.track)} not sent`);
    r.payload.track = t;
  }
  return raw;
}

// ── 道路路網 ────────────────────────────────────────────

export class NetRegistry {
  private ids = new WeakMap<RoadNetwork, number>();
  private next = 0;
  idOf(net: RoadNetwork): { id: number; fresh: boolean } {
    const id = this.ids.get(net);
    if (id != null) return { id, fresh: false };
    const n = this.next++;
    this.ids.set(net, n);
    return { id: n, fresh: true };
  }
}

export interface EncodedRoadSet {
  kind: "road";
  netId: number;
  /** 第一次出現的路網才帶 */
  net: RoadNetwork | null;
  /** records 的 payload.net 換成 null（Worker 依 netId 補回） */
  set: SoundSourceSet;
}

export function encodeRoadSet(set: SoundSourceSet, reg: NetRegistry): EncodedRoadSet {
  let netId = -1;
  let net: RoadNetwork | null = null;
  const records = set.records.map((r) => {
    const p = r.payload as RoadNetworkPayload | null;
    if (p?.kind !== "road_network") return r;
    const { id, fresh } = reg.idOf(p.net);
    netId = id;
    if (fresh) net = p.net;
    return { ...r, payload: { ...p, net: null } };
  });
  return { kind: "road", netId, net, set: { ...set, records } as SoundSourceSet };
}

export function decodeRoadSet(enc: EncodedRoadSet, nets: Map<number, RoadNetwork>): SoundSourceSet {
  if (enc.net) nets.set(enc.netId, enc.net);
  const net = nets.get(enc.netId) ?? null;
  for (const r of enc.set.records as RoadNetworkRecord[]) {
    if ((r.payload as { kind?: string }).kind === "road_network") {
      if (!net) throw new Error(`road network ${enc.netId} not sent`);
      (r.payload as { net: RoadNetwork }).net = net;
    }
  }
  return enc.set;
}

// ── 訊息 ───────────────────────────────────────────────

export interface EncodedPlainSet { kind: "plain"; set: SoundSourceSet }
export interface EncodedAviation {
  kind: "aviation";
  /** 每日包（null＝沒有或雜湊不符，原因在 note） */
  pack: PotentialPack | null;
  note: string | null;
}
export type EncodedFamily = EncodedPlainSet | EncodedRailSet | EncodedRoadSet | EncodedAviation;

export type ToWorker =
  | { type: "set"; family: GridFamily; version: number; origin: SetOrigin | null; data: EncodedFamily | null }
  | { type: "frame"; id: number; key: string; family: GridFamily; bin: number }
  | { type: "composite"; id: number; key: string; bin: number; gate: number }
  | { type: "cell"; id: number; key: string; bin: number; cell: number };

export type FromWorker =
  | { type: "frame"; id: number; family: GridFamily; bin: number; version: number; values: Uint8Array; note: string | null; ms: number }
  | { type: "composite"; id: number; bin: number; gate: number; a: Uint8Array; b: Uint8Array; notes: Record<GridFamily, string | null>; ms: number }
  | { type: "cell"; id: number; bin: number; cell: number; codes: number[]; notes: Record<GridFamily, string | null> }
  | { type: "superseded"; id: number }
  | { type: "error"; id: number; message: string };

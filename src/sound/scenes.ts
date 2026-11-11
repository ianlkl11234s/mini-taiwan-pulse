/**
 * City Sound Atlas — 真實場景（計畫書 §8 B「案例必用實際有資料日」）。
 *
 * 兩層：
 * 1. 內建清單 `SOUND_SCENES`：只有 id、日期、鏡頭。接收點、焦點時刻、選點理由都讀快照。
 * 2. 場景快照 `public/sound-atlas/scenes/<id>.json`（schema pulse-sound-scene-v1，W3 產出）：
 *    有快照就用快照的 aviation／thunder／rain 區塊，coverage 直接取快照的 health（不以筆數重判）；
 *    **缺哪一塊，那一塊就走即時 RPC**；
 *    RPC 也查不到 → adapter 回 empty／error，引擎回 unknown／unavailable（T12），不以今天資料回填。
 *
 * ⚠️ 快照只涵蓋 bbox：接收點移出 bbox、或時間軸日期不是場景日期 → 整份快照不用，改走 RPC，
 *    否則 bbox 外會被算成「健康但沒有來源」＝0（T18）。
 */
import type { FlightTrailRow } from "../data/flightTrails";
import type { LightningSource } from "../data/lightningLoader";
import type { RainGaugeDayRow } from "../data/rainGaugeLoader";
import { withLoading } from "../lib/loadingRegistry";
import type { SoundSourceFamily } from "./types";

export const SOUND_SCENE_SCHEMA = "pulse-sound-scene-v1";

export type SoundSceneId = "taipei-1109" | "taichung-heping-1108" | "taipei-typhoon-1024";

export interface SoundSceneDef {
  id: SoundSceneId;
  /** 臺灣日期 YYYY-MM-DD（快照讀不到時，時間軸只能跳到這天中午） */
  date: string;
  zoom: number;
  /** 場景建議同時開的既有圖層（例：颱風路徑） */
  companionLayers?: readonly "typhoonTracks"[];
  /** 「播放此場景」：從焦點時刻前 leadS 秒開始，以 speed 倍（模擬秒／牆鐘秒）播放 */
  playback: { leadS: number; speed: number };
}

/**
 * 內建場景清單：只放 id、日期、鏡頭與搭配圖層。
 * 接收點、焦點時刻、選點理由一律以快照（W3 實查產出）為準，這裡不寫死，避免兩邊說法不一致。
 */
export const SOUND_SCENES: readonly SoundSceneDef[] = [
  // 一般場景：焦點前 2 分鐘、10 倍速（約 12 秒看完）
  { id: "taipei-1109", date: "2026-11-09", zoom: 12.5, playback: { leadS: 120, speed: 10 } },
  // 雷場景放慢到 2 倍速：落雷在焦點前約 8 秒，雷聲約 6.5 秒後抵達，畫面上看得出延遲
  { id: "taichung-heping-1108", date: "2026-11-08", zoom: 11, playback: { leadS: 20, speed: 2 } },
  { id: "taipei-typhoon-1024", date: "2026-10-24", zoom: 12, companionLayers: ["typhoonTracks"], playback: { leadS: 120, speed: 10 } },
];

export function findScene(id: string | null | undefined): SoundSceneDef | null {
  return SOUND_SCENES.find((s) => s.id === id) ?? null;
}

/** 快照讀不到時的退路：場景日期臺灣時間中午（不猜接收點） */
export function sceneFallbackFocusUnix(def: SoundSceneDef): number {
  return Date.parse(`${def.date}T12:00:00+08:00`) / 1000;
}

// ── 快照契約 ─────────────────────────────────────────────

export type SnapshotHealth = "ok" | "empty" | "error";
const isHealth = (v: unknown): v is SnapshotHealth => v === "ok" || v === "empty" || v === "error";

export interface SceneThunderEvent {
  event_id: number;
  /** CWA event_id 會超過 2^53，比對一律用字串 */
  event_id_str?: string;
  source: string;
  strike_ts: number;
  lon: number;
  lat: number;
  strike_type: number;
  intensity_ka: number | null;
}

export interface SoundSceneSnapshot {
  schema: typeof SOUND_SCENE_SCHEMA;
  id: string;
  title_zh?: string;
  date: string;
  focus_time?: string;
  receiver?: { lon: number; lat: number; height_m?: number; label_zh?: string; reason_zh?: string };
  bbox: [number, number, number, number];
  /** health 是整日來源健康度；rows 只留 bbox 內（bbox 內 0 筆 + ok ＝ 真的沒有） */
  aviation?: { origin?: string; health?: SnapshotHealth; rows: FlightTrailRow[] };
  thunder?: {
    origin?: string;
    health?: Partial<Record<LightningSource, SnapshotHealth>>;
    events: SceneThunderEvent[];
  };
  rain?: { origin?: string; health?: SnapshotHealth; rows: RainGaugeDayRow[] };
  notes_zh?: string[];
  generated_at?: string;
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isBbox = (v: unknown): v is [number, number, number, number] =>
  Array.isArray(v) && v.length === 4 && v.every((x) => typeof x === "number" && Number.isFinite(x));

/**
 * 驗證快照（dev server 對缺檔可能回 200＋HTML，所以一定要驗 schema）。
 * 整份不合規 → null；個別區塊形狀不對 → 丟掉該區塊（該來源改走 RPC），不猜。
 */
export function parseSceneSnapshot(json: unknown): SoundSceneSnapshot | null {
  if (!isObj(json) || json.schema !== SOUND_SCENE_SCHEMA) return null;
  if (typeof json.id !== "string" || typeof json.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(json.date)) return null;
  if (!isBbox(json.bbox)) return null;
  const out: SoundSceneSnapshot = { schema: SOUND_SCENE_SCHEMA, id: json.id, date: json.date, bbox: json.bbox };
  if (typeof json.title_zh === "string") out.title_zh = json.title_zh;
  if (typeof json.focus_time === "string" && Number.isFinite(Date.parse(json.focus_time))) out.focus_time = json.focus_time;
  const r = json.receiver;
  if (isObj(r) && typeof r.lon === "number" && typeof r.lat === "number") {
    out.receiver = {
      lon: r.lon,
      lat: r.lat,
      height_m: typeof r.height_m === "number" ? r.height_m : undefined,
      label_zh: typeof r.label_zh === "string" ? r.label_zh : undefined,
      reason_zh: typeof r.reason_zh === "string" ? r.reason_zh : undefined,
    };
  }
  const a = json.aviation;
  if (isObj(a) && Array.isArray(a.rows)) {
    out.aviation = { origin: typeof a.origin === "string" ? a.origin : undefined, health: isHealth(a.health) ? a.health : undefined, rows: a.rows as FlightTrailRow[] };
  }
  const th = json.thunder;
  if (isObj(th) && Array.isArray(th.events)) {
    // health 只收認得的值；認不得的來源視為沒寫（呼叫端改走即時），不猜
    const health = isObj(th.health)
      ? (Object.fromEntries(Object.entries(th.health).filter(([, v]) => isHealth(v))) as Partial<Record<LightningSource, SnapshotHealth>>)
      : undefined;
    out.thunder = {
      origin: typeof th.origin === "string" ? th.origin : undefined,
      health,
      events: (th.events as SceneThunderEvent[]).map((e) => ({
        ...e,
        event_id_str: typeof e.event_id_str === "string" ? e.event_id_str : undefined,
      })),
    };
  }
  const rn = json.rain;
  if (isObj(rn) && Array.isArray(rn.rows)) {
    out.rain = { origin: typeof rn.origin === "string" ? rn.origin : undefined, health: isHealth(rn.health) ? rn.health : undefined, rows: rn.rows as RainGaugeDayRow[] };
  }
  if (Array.isArray(json.notes_zh)) out.notes_zh = json.notes_zh.filter((n): n is string => typeof n === "string");
  if (typeof json.generated_at === "string") out.generated_at = json.generated_at;
  return out;
}

export function sceneSnapshotUrl(id: string): string {
  return `/sound-atlas/scenes/${encodeURIComponent(id)}.json`;
}

/** 讀快照；缺檔、非 JSON、schema 不符一律 null（呼叫端改走 RPC）。 */
export async function fetchSceneSnapshot(id: string, fetchImpl: typeof fetch = fetch): Promise<SoundSceneSnapshot | null> {
  return withLoading(`sound-scene:${id}`, `聲景場景快照 ${id}`, (async () => {
    try {
      const res = await fetchImpl(sceneSnapshotUrl(id));
      if (!res.ok) return null;
      const text = await res.text();
      return parseSceneSnapshot(JSON.parse(text));
    } catch {
      return null;
    }
  })());
}

/** 快照是否適用：日期一致，且接收點在 bbox 內 */
export function snapshotApplies(
  snapshot: SoundSceneSnapshot | null,
  dateKey: string,
  receiver: { longitude: number; latitude: number } | null,
): boolean {
  if (!snapshot || snapshot.date !== dateKey || !receiver) return false;
  const [w, s, e, n] = snapshot.bbox;
  return receiver.longitude >= w && receiver.longitude <= e && receiver.latitude >= s && receiver.latitude <= n;
}

/** 快照的區塊來源說明（面板「資料來源」用） */
export function snapshotOrigin(snapshot: SoundSceneSnapshot, family: SoundSourceFamily): string | null {
  if (family === "aviation") return snapshot.aviation ? snapshot.aviation.origin ?? "" : null;
  if (family === "thunder") return snapshot.thunder ? snapshot.thunder.origin ?? "" : null;
  if (family === "rain") return snapshot.rain ? snapshot.rain.origin ?? "" : null;
  return null;
}

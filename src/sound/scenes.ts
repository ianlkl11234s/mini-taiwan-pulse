/**
 * City Sound Atlas — 真實場景（計畫書 §8 B「案例必用實際有資料日」）。
 *
 * 兩層：
 * 1. 內建定義 `SOUND_SCENES`：日期、焦點時刻、接收點與選點理由。快照還沒產出時場景照樣可用
 *    （來源走即時 RPC）。
 * 2. 場景快照 `public/sound-atlas/scenes/<id>.json`（schema pulse-sound-scene-v1，W3 產出）：
 *    有快照就用快照的 aviation／thunder／rain 區塊；**缺哪一塊，那一塊就走即時 RPC**；
 *    RPC 也查不到 → adapter 回 empty／error，引擎回 unknown／unavailable（T12），不以今天資料回填。
 *
 * ⚠️ 快照只涵蓋 bbox：接收點移出 bbox、或時間軸日期不是場景日期 → 整份快照不用，改走 RPC，
 *    否則 bbox 外會被算成「健康但沒有來源」＝0（T18）。
 */
import type { Flight } from "../types";
import { flightRowsToFlights, type FlightTrailRow } from "../data/flightTrails";
import type { LightningSource, LightningStrike } from "../data/lightningLoader";
import type { RainGaugeDayRow } from "../data/rainGaugeLoader";
import { withLoading } from "../lib/loadingRegistry";
import type { SoundSourceFamily } from "./types";

export const SOUND_SCENE_SCHEMA = "pulse-sound-scene-v1";

export type SoundSceneId = "taipei-1109" | "taichung-heping-1108" | "taipei-typhoon-1024";

export interface SoundSceneReceiver {
  lon: number;
  lat: number;
  heightM: number;
  labelZh: string;
  reasonZh: string;
}

export interface SoundSceneDef {
  id: SoundSceneId;
  titleZh: string;
  /** 臺灣日期 YYYY-MM-DD */
  date: string;
  /** ISO-8601（+08:00）焦點時刻 */
  focusTime: string;
  receiver: SoundSceneReceiver;
  /** [w, s, e, n] */
  bbox: [number, number, number, number];
  zoom: number;
  /** 場景建議同時開的既有圖層（例：颱風路徑） */
  companionLayers?: readonly "typhoonTracks"[];
}

/**
 * 內建場景（2026-11-11 以 get_rain_gauge_day／get_flight_trails 實查挑點）。
 * 快照的 receiver／focus_time 若不同，以快照為準。
 */
export const SOUND_SCENES: readonly SoundSceneDef[] = [
  {
    id: "taipei-1109",
    titleZh: "臺北 11/9：雨＋松山航班＋垃圾車",
    date: "2026-11-09",
    // 09:22 JAL96 以約 460 m 高度從東側進場，最近約 1.75 km；09 時東湖國小站有 0.5 mm
    focusTime: "2026-11-09T09:22:00+08:00",
    receiver: {
      lon: 121.6068,
      lat: 25.071,
      heightM: 1.5,
      labelZh: "內湖東湖國小雨量站旁",
      reasonZh:
        "臺北市內 11/9 有降雨紀錄的雨量站（東湖國小，07、09、11、17、19 時各 0.5 mm）；位在松山機場跑道東側延長線上（距機場約 5.5 km），當天約 20 班航機從 2.5 km 內通過。",
    },
    bbox: [121.45, 24.97, 121.75, 25.17],
    zoom: 12.5,
  },
  {
    id: "taichung-heping-1108",
    titleZh: "臺中和平 11/8：台電落雷＋航班",
    date: "2026-11-08",
    focusTime: "2026-11-08T10:25:00+08:00",
    receiver: {
      lon: 121.44,
      lat: 24.315,
      heightM: 1.5,
      labelZh: "臺中和平區山區",
      reasonZh: "11/8 10:25 前後台電落雷（3.97 kA）附近；最近的南湖圈谷雨量站當天 0 mm。",
    },
    bbox: [121.14, 24.015, 121.74, 24.615],
    zoom: 11,
  },
  {
    id: "taipei-typhoon-1024",
    titleZh: "Champi 颱風 10/24：北投小油坑",
    date: "2026-10-24",
    // 小油坑站 14 時 46.5 mm（當日臺北最大）
    focusTime: "2026-10-24T14:30:00+08:00",
    receiver: {
      lon: 121.5406,
      lat: 25.1821,
      heightM: 1.5,
      labelZh: "北投小油坑雨量站旁",
      reasonZh: "Champi 颱風外圍環流期間，小油坑站 10/24 14 時 46.5 mm，為當日臺北最大時雨量。",
    },
    bbox: [121.24, 24.88, 121.84, 25.48],
    zoom: 12,
    companionLayers: ["typhoonTracks"],
  },
];

export function findScene(id: string | null | undefined): SoundSceneDef | null {
  return SOUND_SCENES.find((s) => s.id === id) ?? null;
}

// ── 快照契約 ─────────────────────────────────────────────

type HealthValue = "ok" | "empty" | "error";

export interface SoundSceneSnapshot {
  schema: typeof SOUND_SCENE_SCHEMA;
  id: string;
  title_zh?: string;
  date: string;
  focus_time?: string;
  receiver?: { lon: number; lat: number; height_m?: number; label_zh?: string; reason_zh?: string };
  bbox: [number, number, number, number];
  aviation?: { origin?: string; rows: FlightTrailRow[] };
  thunder?: {
    origin?: string;
    health?: Partial<Record<LightningSource, HealthValue>>;
    events: Array<{ event_id: number; source: string; strike_ts: number; lon: number; lat: number; strike_type: number; intensity_ka: number | null }>;
  };
  rain?: { origin?: string; rows: RainGaugeDayRow[] };
  notes_zh?: string[];
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
  if (isObj(a) && Array.isArray(a.rows)) out.aviation = { origin: typeof a.origin === "string" ? a.origin : undefined, rows: a.rows as FlightTrailRow[] };
  const th = json.thunder;
  if (isObj(th) && Array.isArray(th.events)) {
    out.thunder = {
      origin: typeof th.origin === "string" ? th.origin : undefined,
      health: isObj(th.health) ? (th.health as Partial<Record<LightningSource, HealthValue>>) : undefined,
      events: th.events as NonNullable<SoundSceneSnapshot["thunder"]>["events"],
    };
  }
  const rn = json.rain;
  if (isObj(rn) && Array.isArray(rn.rows)) out.rain = { origin: typeof rn.origin === "string" ? rn.origin : undefined, rows: rn.rows as RainGaugeDayRow[] };
  if (Array.isArray(json.notes_zh)) out.notes_zh = json.notes_zh.filter((n): n is string => typeof n === "string");
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

// ── 快照 → adapter fetcher ───────────────────────────────

export interface SnapshotFetchers {
  aviation?: (date: string) => Promise<{ flights: Flight[] }>;
  thunder?: (date: string, source: LightningSource) => Promise<LightningStrike[]>;
  rain?: (date: string) => Promise<RainGaugeDayRow[]>;
}

/**
 * 把快照區塊轉成 adapter 可注入的 fetcher。
 * - 只回傳快照有的區塊；缺的家族呼叫端用預設（RPC）fetcher。
 * - 落雷：health=error → throw（adapter 記 error）；empty → []；ok → 該源事件；
 *   health 沒寫到的來源 → 交回 `fallbackThunder`（即時 RPC），不當成 empty。
 */
export function snapshotFetchers(
  snapshot: SoundSceneSnapshot,
  fallbackThunder: (date: string, source: LightningSource) => Promise<LightningStrike[]>,
): SnapshotFetchers {
  const out: SnapshotFetchers = {};
  if (snapshot.aviation) {
    const rows = snapshot.aviation.rows;
    out.aviation = async () => ({ flights: flightRowsToFlights(rows).flights });
  }
  if (snapshot.thunder) {
    const th = snapshot.thunder;
    out.thunder = async (date, source) => {
      const h = th.health?.[source];
      if (h === "error") throw new Error(`scene_snapshot_source_error:${source}`);
      if (h === "empty") return [];
      if (h === "ok") {
        return th.events
          .filter((e) => e.source === source)
          .map((e) => ({ event_id: e.event_id, strike_ts: e.strike_ts, intensity_ka: e.intensity_ka ?? null, strike_type: e.strike_type, lon: e.lon, lat: e.lat }));
      }
      return fallbackThunder(date, source);
    };
  }
  if (snapshot.rain) {
    const rows = snapshot.rain.rows;
    out.rain = async () => rows;
  }
  return out;
}

/** 快照的區塊來源說明（面板「資料來源」用） */
export function snapshotOrigin(snapshot: SoundSceneSnapshot, family: SoundSourceFamily): string | null {
  if (family === "aviation") return snapshot.aviation ? snapshot.aviation.origin ?? "" : null;
  if (family === "thunder") return snapshot.thunder ? snapshot.thunder.origin ?? "" : null;
  if (family === "rain") return snapshot.rain ? snapshot.rain.origin ?? "" : null;
  return null;
}

/**
 * `/embed` 鐵路回放的資料組裝（EM-16 Phase 3）—— **零 three 依賴**。
 *
 * 鐵路與 flights / ships 是不同物種：
 * - flights / ships = **軌跡插值型**：快照就是一整天的歷史 GPS 點串，前端只做內插。
 * - rail            = **時刻表推算型**：快照只有「那一天的時刻表」，列車位置由
 *   `TraTrainEngine` / `RailEngine` 每幀即時算出來（與主站同一套引擎、同一份程式碼）。
 *
 * 所以載入的是**兩塊**資料，只有第一塊每天變：
 *   1. 時刻表 `/embed-snapshots/rail/<date>.json.gz`（6 列 = 6 系統，見 export 腳本）
 *   2. 幾何   `/embed-rail/rail_slim.json.gz`（**日期無關的共用資產** —— 267 條 TRA
 *      O-D 軌道 + 37 條 golden + 5 系統路線，68MB 瘦身成 358KB，且對簡化後的折線
 *      重算過 `station_progress`。整站共用一個 URL ⇒ CDN 快取友善，讀者換日期不重下載）
 *
 * 本檔只負責把這兩塊拼成引擎吃的形狀（`TraData` / `RailSystem[]`），
 * 渲染與 Scene 接線在 `replayRuntime.ts`。
 *
 * ── 時鐘語意（重要）─────────────────────────────────────────────
 * 兩顆引擎都把 unix 秒丟進 `unixToExtendedDaySeconds()`：只取「台北時區的當日秒數」，
 * 且 **05:50 前的時刻 +86400**（台鐵／捷運的營運日分界，凌晨的車算前一個營運日）。
 * 換句話說引擎**只看時刻不看日期**，時間軸是不連續的。
 *
 * 因此回放區間取 **該日台北時間 00:00:00 → 24:00:00（整整 86400 秒）**，
 * 而不是像 flights/ships 那樣取「資料實際跨度」：
 * - 延長日軸不連續（00:00→05:50 落在 86400–107400，05:50→24:00 落在 21000–86400），
 *   對時刻表取 min/max 再映射回 unix 是錯的，會漏掉整段凌晨。
 * - 整日 24 小時窗**涵蓋所有班次**：00:30 的車在 00:30 出現（實測見下），
 *   23:50 開、跨到隔日 00:30 才到站的車，在 00:00–00:30 那段仍算「還在跑」而繼續顯示 ——
 *   這正是延長日制想要的行為（凌晨看得到昨晚的末班車）。
 * - 副作用（沿用主站既有行為，**刻意不修**）：05:50 分界瞬間，延長日秒數從 107400
 *   跳回 21000，跨越分界仍在行駛的車會閃一下消失。主站即此行為，回放版不另立規則。
 *
 * 多層共時鐘時（`layers=rail,flights`）這個區間會與其他層取聯集，由 `startReplay` 統一處理。
 */
import type {
  RailData, RailSchedule, RailStationTime, RailSystem, TraData, TraDeparture, TraSchedule,
} from "../types";
import { fetchMaybeGzipJson, fetchReplaySnapshot } from "./replayLayers";

/** 幾何 bundle：日期無關，整站共用一個 URL（見檔頭）。 */
export const RAIL_GEOMETRY_URL = "/embed-rail/rail_slim.json.gz";

/**
 * 系統預設色 —— 與 `src/data/railLoader.ts` 的 `RAIL_SYSTEMS` 同一組數字。
 * **刻意複製而非 import**：`railLoader` 會拉進 `lib/supabase`，而嵌入版的鐵則是
 * 絕不打 Supabase、也不該把 client 塞進 bundle。改動時兩邊要一起改。
 */
const SYSTEM_COLORS: Record<string, string> = {
  trtc: "#d90023",
  thsr: "#ee6c00",
  krtc: "#f8961e",
  klrt: "#43aa8b",
  tmrt: "#577590",
};

/** TRA golden track 的顯示色（同 railLoader postProcess）。 */
const TRA_TRACK_COLOR = "#7B7B7B";

/** 走 RailEngine 的 5 系統（TRA 由 TraTrainEngine 獨立處理）。 */
const RAIL_ENGINE_SYSTEMS = ["thsr", "trtc", "krtc", "klrt", "tmrt"] as const;

/** 快照列 → 系統 id 的對照（`tra_daily` / `trtc_fixed` 都要還原成 `tra` / `trtc`）。 */
function systemIdOf(rowSystem: string): string {
  return rowSystem.replace(/_(daily|fixed)$/, "");
}

/** 快照的一列（export-embed-snapshot.sh rail case 產出）。 */
export interface RailScheduleRow {
  /** `tra_daily` / `thsr_daily` / `trtc_fixed` … */
  system: string;
  /** _daily 是指定日；_fixed 恆為 2025-01-01（週期性班表，與日期無關） */
  schedule_date: string;
  train_count: number | null;
  data: unknown;
}

// ── 幾何 bundle 的形狀（build-rail-slim-bundle.py 產出）──

interface SlimTrack {
  coordinates: [number, number][];
  properties: Record<string, unknown>;
}

interface SlimSystem {
  tracks: Record<string, SlimTrack>;
  stationProgress: Record<string, Record<string, number>>;
  /** 只有 tra 有：37 條精修顯示用軌道 */
  goldenTracks?: Record<string, SlimTrack>;
}

interface RailSlimBundle {
  metadata?: unknown;
  systems: Record<string, SlimSystem>;
}

/**
 * bundle 的 `{coordinates, properties}` → GeoJSON Feature（引擎吃 Feature）。
 * 沒有 `color` 的補上系統預設色 —— 與 railLoader `postProcess` 同一套 fallback，
 * 少了這步 THSR / 部分 TRTC 路線與全部 TRA 軌道會變成白線白點。
 */
function toFeature(track: SlimTrack, defaultColor: string): GeoJSON.Feature {
  const properties = { ...track.properties };
  if (!properties.color) properties.color = defaultColor;
  return {
    type: "Feature",
    properties,
    geometry: { type: "LineString", coordinates: track.coordinates },
  };
}

/** TRA 每日時刻表（`data.schedules[]`）→ 依 od_track_id 分組，同 railLoader parseTraSchedules。 */
function parseTraSchedules(data: unknown): Map<string, TraSchedule> {
  const map = new Map<string, TraSchedule>();
  const schedules = (data as { schedules?: unknown[] } | null)?.schedules;
  if (!Array.isArray(schedules)) return map;

  for (const raw of schedules) {
    const train = raw as Record<string, unknown>;
    const trackId = train.od_track_id as string | undefined;
    if (!trackId) continue;
    let entry = map.get(trackId);
    if (!entry) {
      entry = { departures: [] };
      map.set(trackId, entry);
    }
    entry.departures.push({
      departure_time: train.departure_time as string,
      train_id: train.train_id as string,
      train_no: train.train_no as string | undefined,
      train_type: train.train_type as string | undefined,
      train_type_code: train.train_type_code as string | undefined,
      total_travel_time: train.total_travel_time as number,
      origin_station: (train.origin_station as string) ?? "",
      destination_station: (train.destination_station as string) ?? "",
      od_track_id: trackId,
      stations: train.stations as RailStationTime[],
    } satisfies TraDeparture);
  }
  return map;
}

/**
 * 5 系統時刻表 → Map<trackId, RailSchedule>。兩種來源形狀（同 railLoader）：
 * - TRTC：陣列，每項自帶 `track_id`
 * - 其餘：物件 `{ trackId: schedule }`，其中 `_metadata` 之類的底線鍵不是軌道，要濾掉
 */
function parseRailSchedules(data: unknown): Map<string, RailSchedule> {
  const map = new Map<string, RailSchedule>();
  if (Array.isArray(data)) {
    for (const item of data) {
      const s = item as RailSchedule | null;
      if (s?.track_id) map.set(s.track_id, s);
    }
  } else if (data && typeof data === "object") {
    for (const [trackId, schedule] of Object.entries(data as Record<string, unknown>)) {
      if (trackId.startsWith("_")) continue;
      map.set(trackId, schedule as RailSchedule);
    }
  }
  return map;
}

/**
 * 回放區間 = 該日台北時間 00:00 – 24:00（理由見檔頭「時鐘語意」）。
 * `date` 已由 urlState 驗過格式；解析失敗回 null 讓呼叫端略過該層。
 */
export function railReplayRange(date: string): [number, number] | null {
  const dayStartMs = Date.parse(`${date}T00:00:00+08:00`);
  if (Number.isNaN(dayStartMs)) return null;
  const t0 = dayStartMs / 1000;
  return [t0, t0 + 86400];
}

export interface RailReplayData extends RailData {
  /** 診斷用：各系統的班次數（TRA = 班車數，其餘 = 該系統所有 departures 總和） */
  departureCounts: Record<string, number>;
}

/**
 * 讀時刻表快照 + 幾何 bundle，組成引擎輸入。
 * 任一塊缺失（404 / 壞檔 / 沒有 TRA 也沒有任何系統）一律回 null，呼叫端靜默略過該層。
 */
export async function loadRailReplayData(date: string): Promise<RailReplayData | null> {
  // 兩塊平行抓：幾何是共用資產（多半已在快取），不該被時刻表卡住。
  const [rows, bundle] = await Promise.all([
    fetchReplaySnapshot<RailScheduleRow>("rail", date),
    fetchMaybeGzipJson<RailSlimBundle>(RAIL_GEOMETRY_URL),
  ]);
  if (!rows || rows.length === 0 || !bundle?.systems) return null;

  const rowBySystem = new Map<string, RailScheduleRow>();
  for (const row of rows) rowBySystem.set(systemIdOf(row.system), row);

  const departureCounts: Record<string, number> = {};
  const allFeatures: GeoJSON.Feature[] = [];

  // ── TRA（TraTrainEngine）──
  // 位置用 267 條 O-D 軌道算，**顯示**只畫 37 條 golden —— 與主站一致：
  // O-D 軌道彼此高度重疊，全畫會糊成一團粗線。
  let traData: TraData | null = null;
  const traBundle = bundle.systems.tra;
  const traRow = rowBySystem.get("tra");
  if (traBundle && traRow) {
    const schedules = parseTraSchedules(traRow.data);
    if (schedules.size > 0) {
      const odTracks = new Map<string, GeoJSON.Feature>();
      for (const [trackId, track] of Object.entries(traBundle.tracks)) {
        odTracks.set(trackId, toFeature(track, TRA_TRACK_COLOR));
      }
      const goldenTracks = Object.values(traBundle.goldenTracks ?? {}).map((t) =>
        toFeature(t, TRA_TRACK_COLOR),
      );
      traData = {
        schedules,
        odTracks,
        stationProgress: traBundle.stationProgress,
        goldenTracks,
      };
      allFeatures.push(...goldenTracks);
      let count = 0;
      for (const s of schedules.values()) count += s.departures.length;
      departureCounts.tra = count;
    }
  }

  // ── THSR + 4 捷運（RailEngine）──
  const systems: RailSystem[] = [];
  for (const id of RAIL_ENGINE_SYSTEMS) {
    const sysBundle = bundle.systems[id];
    const row = rowBySystem.get(id);
    if (!sysBundle || !row) continue;

    const schedules = parseRailSchedules(row.data);
    const tracks = new Map<string, GeoJSON.Feature>();
    const defaultColor = SYSTEM_COLORS[id] ?? "#ffffff";
    for (const [trackId, track] of Object.entries(sysBundle.tracks)) {
      // 貓空纜車（MK-*）掛在 trtc 底下但不是捷運，主站 postProcess 也剔除。
      if (id === "trtc" && trackId.startsWith("MK-")) continue;
      tracks.set(trackId, toFeature(track, defaultColor));
    }
    if (id === "trtc") {
      for (const key of [...schedules.keys()]) {
        if (key.startsWith("MK-")) schedules.delete(key);
      }
    }
    if (schedules.size === 0 || tracks.size === 0) continue;

    systems.push({ id, tracks, schedules, stationProgress: sysBundle.stationProgress });
    allFeatures.push(...tracks.values());
    let count = 0;
    for (const s of schedules.values()) count += s.departures?.length ?? 0;
    departureCounts[id] = count;
  }

  if (!traData && systems.length === 0) return null;

  return {
    systems,
    traData,
    allTracks: { type: "FeatureCollection", features: allFeatures },
    departureCounts,
  };
}

/**
 * MVP-B 三族（鐵道、道路車流、施工）的載入入口與場景快照轉換（W4）。
 *
 * 刻意獨立一個檔案、不改 soundAtlasData.ts：W4 不碰 UI 載入流程，主 agent 接線時在
 * `loadSoundFamily` 的 switch 加三個 case 呼叫這裡的 `loadMvpBFamily`／`mvpBSnapshotSet` 即可。
 *
 * - 鐵道：班表類，一律即時算（不進快照）；不拿今天的班表回填歷史日。
 * - 道路車流：即時讀 get_freeway_congestion_day（只有國道道路類型 proxy，無流量）；不進快照（理由見 MVP_B_SOURCES.md §3）。
 * - 施工：有快照區塊 `roadwork` 就用快照（coverage 取快照 health，不以 bbox 內筆數重判），否則讀 get_road_events_day。
 */
import type { RoadEvent } from "../data/roadEventsLoader";
import { taipeiMidnightMs } from "../lib/taipeiDay";
import { TDX_CITY_ZH } from "./model/cityBbox";
import { loadRail, type RailPayload } from "./sourceAdapters/railAdapter";
import { liveRailFetchers } from "./sourceAdapters/railLiveFetchers";

export { liveRailFetchers, parseSystemSchedule, parseTraSchedule } from "./sourceAdapters/railLiveFetchers";
import { loadRoadTraffic, type RoadTrafficPayload } from "./sourceAdapters/roadTrafficAdapter";
import { loadRoadwork, roadEventsToRecords, ROADWORK_PROVIDER, type RoadworkPayload } from "./sourceAdapters/roadworkAdapter";
import type { MvpBSoundFamily, SoundSourceSet } from "./types";

export type MvpBSet =
  | SoundSourceSet<RailPayload, "rail">
  | SoundSourceSet<RoadTrafficPayload, "road_traffic">
  | SoundSourceSet<RoadworkPayload, "roadwork">;

// ── 場景快照區塊（施工） ─────────────────────────────────────

export type SnapshotHealth = "ok" | "empty" | "error";

export interface SceneRoadworkBlock {
  origin?: string;
  health: SnapshotHealth;
  /** 歸檔的 per_city（TDX 縣市代碼 → 筆數，**含非施工事件**；只供參考，不用來判斷涵蓋） */
  per_city?: Record<string, number>;
  /** 各縣市 EventType=2（施工）筆數；>0 的縣市才算有發布施工。缺這欄 → 全部視為未涵蓋 */
  per_city_roadwork?: Record<string, number>;
  /** 施工事件的裁切範圍（接收點 ±5 km，比場景 bbox 小）；接收點在外 → unknown */
  bbox?: [number, number, number, number];
  events: RoadEvent[];
}

const isHealth = (v: unknown): v is SnapshotHealth => v === "ok" || v === "empty" || v === "error";

/** 從快照 JSON 取 MVP-B 區塊；形狀不對 → 丟掉（改走即時），不猜 */
export function parseMvpBSceneBlocks(json: unknown): { roadwork?: SceneRoadworkBlock } {
  if (!json || typeof json !== "object") return {};
  const rw = (json as Record<string, unknown>).roadwork;
  if (!rw || typeof rw !== "object" || !Array.isArray((rw as { events?: unknown }).events) || !isHealth((rw as { health?: unknown }).health)) return {};
  const b = rw as SceneRoadworkBlock;
  const bbox = Array.isArray(b.bbox) && b.bbox.length === 4 && b.bbox.every((x) => typeof x === "number" && Number.isFinite(x)) ? b.bbox : undefined;
  return { roadwork: { origin: typeof b.origin === "string" ? b.origin : undefined, health: b.health, per_city: b.per_city, per_city_roadwork: b.per_city_roadwork, bbox, events: b.events } };
}

export function coveredCitiesFromPerCity(perCity: Record<string, number> | undefined): string[] {
  if (!perCity) return [];
  return Object.entries(perCity)
    .filter(([, n]) => typeof n === "number" && n > 0)
    .map(([k]) => TDX_CITY_ZH[k])
    .filter((c): c is string => !!c)
    .sort();
}

/** 快照施工區塊 → SoundSourceSet（coverage 直接取 health，不以 bbox 內筆數重判） */
export function roadworkSnapshotSet(block: SceneRoadworkBlock, date: string): SoundSourceSet<RoadworkPayload, "roadwork"> {
  const start = taipeiMidnightMs(date) / 1000;
  const { records } = roadEventsToRecords(block.events, date, coveredCitiesFromPerCity(block.per_city_roadwork), block.bbox ?? null);
  return {
    family: "roadwork",
    dateKey: date,
    records,
    coverage: [
      { family: "roadwork", provider: ROADWORK_PROVIDER, dateKey: date, status: block.health, windowStart: start, windowEnd: start + 86_400, temporalKind: "day_series", reason: `snapshot:${block.origin ?? ""}` },
    ],
  };
}

// ── 統一入口 ───────────────────────────────────────────────

/**
 * 載入一個 MVP-B 家族。`snapshotJson` 是已通過 parseSceneSnapshot 且 snapshotApplies 為真的快照原始 JSON
 * （日期與 bbox 不符時呼叫端要傳 null，否則 bbox 外會被算成「健康但沒有來源」）。
 */
export async function loadMvpBFamily(
  family: MvpBSoundFamily,
  date: string,
  snapshotJson: unknown | null = null,
): Promise<{ set: MvpBSet; origin: "scene" | "live" }> {
  if (family === "rail") return { set: await loadRail({ date }, liveRailFetchers), origin: "live" };
  if (family === "road_traffic") return { set: await loadRoadTraffic({ date }), origin: "live" };
  const block = snapshotJson ? parseMvpBSceneBlocks(snapshotJson).roadwork : undefined;
  if (block) return { set: roadworkSnapshotSet(block, date), origin: "scene" };
  return { set: await loadRoadwork({ date }), origin: "live" };
}

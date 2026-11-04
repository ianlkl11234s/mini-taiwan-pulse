import { supabase } from "../lib/supabase";
import { withLoading } from "../lib/loadingRegistry";
import { electionCampKey, electionEventSpan } from "./electionEventsTypes";

/**
 * 2026 選舉活動 owner-only 載入器（見 docs/features/owner-gated-layers）。
 *
 * public.get_election_events_2026() → jsonb
 *   { type: "FeatureCollection", meta: { total, mapped, loaded_at }, features: [Point…] }
 * RPC 由 gis-platform migration 494 建立並登記 public.gated_layers（owner）；
 * 非 owner 前端 toggle 已擋（不會呼叫本檔）。
 *
 * 載入時衍生三個屬性給 paint／filter 用：
 *   camp_key（陣營分組）、start_ts／end_ts（unix 秒；見 electionEventSpan）。
 * 起訖算不出來（缺 event_date）的活動不上圖。
 */

export interface ElectionEventsMeta {
  total: number | null;
  mapped: number | null;
  loadedAt: string | null;
}

export interface ElectionEventsData {
  fc: GeoJSON.FeatureCollection;
  meta: ElectionEventsMeta;
}

/** RPC 錯誤：保留 PostgREST code，讓 hook 分辨無權限（42501）與函式不存在（PGRST202） */
export class ElectionEventsError extends Error {
  readonly code: string;
  readonly status?: number;
  constructor(message: string, code: string, status?: number) {
    super(message);
    this.name = "ElectionEventsError";
    this.code = code;
    this.status = status;
  }
}

/** 函式尚未部署（migration 未套）：PostgREST 回 PGRST202／404 */
export function isMissingRpc(err: unknown): boolean {
  const v = err as { code?: unknown; status?: unknown; message?: unknown } | null;
  return String(v?.code ?? "") === "PGRST202" || v?.status === 404
    || /could not find the function/i.test(String(v?.message ?? ""));
}

function num(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

/** RPC 原始回應 → 上圖用資料（純函式，測試用） */
export function normalizeElectionEvents(raw: unknown): ElectionEventsData {
  const obj = (raw ?? {}) as { features?: unknown; meta?: Record<string, unknown> };
  const rawFeatures = Array.isArray(obj.features) ? (obj.features as GeoJSON.Feature[]) : [];
  const features: GeoJSON.Feature[] = [];
  for (const f of rawFeatures) {
    if (!f || f.geometry?.type !== "Point") continue;
    const props = { ...(f.properties ?? {}) } as Record<string, unknown>;
    const span = electionEventSpan(props);
    if (!span) continue;
    props.camp_key = electionCampKey(props.camp);
    props.start_ts = span.start;
    props.end_ts = span.end;
    features.push({ type: "Feature", geometry: f.geometry, properties: props });
  }
  const meta = obj.meta ?? {};
  return {
    fc: { type: "FeatureCollection", features },
    meta: {
      total: num(meta.total),
      mapped: num(meta.mapped),
      loadedAt: typeof meta.loaded_at === "string" ? meta.loaded_at : null,
    },
  };
}

export async function fetchElectionEvents(): Promise<ElectionEventsData> {
  const { data, error, status } = await withLoading(
    "election:events2026",
    "2026 選舉活動",
    supabase.rpc("get_election_events_2026"),
  );
  if (error) {
    throw new ElectionEventsError(`get_election_events_2026: ${error.message}`, String(error.code ?? ""), status);
  }
  return normalizeElectionEvents(data);
}

// ── 圖例用的 meta（載入後才有值；useSyncExternalStore 訂閱）──
let metaSnapshot: ElectionEventsMeta | null = null;
const metaListeners = new Set<() => void>();

export function setElectionEventsMeta(meta: ElectionEventsMeta | null): void {
  metaSnapshot = meta;
  for (const cb of metaListeners) cb();
}

export const electionEventsMetaStore = {
  subscribe(cb: () => void): () => void {
    metaListeners.add(cb);
    return () => { metaListeners.delete(cb); };
  },
  getSnapshot(): ElectionEventsMeta | null {
    return metaSnapshot;
  },
};

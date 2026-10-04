/**
 * 衛星情報面板 — 資料狀態推導（純函式）
 *
 * 原則（spec §6.4／§6.5）：載入中、讀取失敗、查無資料、正常各自有文字，
 * 缺值不合成為 0、「無變軌」或「正常」。
 */
import type { ManeuverRow, ManeuversFetchResult } from "./satelliteManeuversLoader";
import { judgeFreshness } from "../components/intel/monitor/monitorFreshness";

export type DataStatus = "loading" | "ok" | "error";

// ── 變軌清單 ────────────────────────────────────────────

export interface ManeuversState {
  status: DataStatus;
  rows: ManeuverRow[];
  /** 最近一次成功讀取（epoch ms）；從未成功為 null */
  fetchedAt: number | null;
  /** 曾成功、但最近一次更新失敗（畫面仍顯示舊資料） */
  stale: boolean;
  errorReason: "unconfigured" | "rpc" | null;
}

export const MANEUVERS_INITIAL: ManeuversState = {
  status: "loading",
  rows: [],
  fetchedAt: null,
  stale: false,
  errorReason: null,
};

/** 把一次 fetch 結果併進狀態：成功覆蓋；失敗時有舊資料就保留並標 stale，沒有才進 error */
export function reduceManeuversResult(prev: ManeuversState, res: ManeuversFetchResult): ManeuversState {
  if (res.ok) {
    return { status: "ok", rows: res.rows, fetchedAt: res.fetchedAt, stale: false, errorReason: null };
  }
  if (prev.fetchedAt != null) {
    return { ...prev, status: "ok", stale: true, errorReason: res.reason };
  }
  return { status: "error", rows: [], fetchedAt: null, stale: false, errorReason: res.reason };
}

export type ManeuversBanner =
  | { kind: "loading"; text: string }
  | { kind: "error"; text: string }
  | { kind: "empty"; text: string }
  | { kind: "ok" };

export function describeManeuversBanner(state: ManeuversState): ManeuversBanner {
  if (state.status === "loading") return { kind: "loading", text: "變軌偵測資料讀取中…" };
  if (state.status === "error") {
    return {
      kind: "error",
      text: state.errorReason === "unconfigured" ? "資料讀取失敗 · 未設定資料來源" : "資料讀取失敗",
    };
  }
  if (state.rows.length === 0) return { kind: "empty", text: "近 24h 無變軌偵測 · 監測中" };
  return { kind: "ok" };
}

// ── 新鮮度 ──────────────────────────────────────────────

const pad2 = (n: number) => String(n).padStart(2, "0");

/** 台灣時間 HH:MM */
export function formatTaipeiClock(ms: number): string {
  const d = new Date(ms + 8 * 3600_000);
  return `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
}

export interface FreshnessLabel {
  text: string;
  /** warn：失敗、中斷或過期，用警示色 */
  tone: "normal" | "warn";
}

export interface FreshnessInput {
  /** 資料名稱，例「TLE」「變軌」 */
  label: string;
  status: DataStatus;
  /** 最近一次成功讀取（epoch ms） */
  fetchedAt: number | null;
  /** 曾成功、最近一次更新失敗 */
  stale?: boolean;
  nowMs: number;
  /** 預期更新週期（分）；給了才用 judgeFreshness 判過期 */
  periodMin?: number;
}

export function describeFreshness(input: FreshnessInput): FreshnessLabel {
  const { label, status, fetchedAt, stale, nowMs, periodMin } = input;
  if (fetchedAt == null) {
    return status === "error"
      ? { text: `${label} 讀取失敗`, tone: "warn" }
      : { text: `${label} 讀取中…`, tone: "normal" };
  }
  const base = `${label} 更新 ${formatTaipeiClock(fetchedAt)}`;
  if (stale) return { text: `${base}（更新中斷，顯示舊資料）`, tone: "warn" };
  if (periodMin != null) {
    const f = judgeFreshness({ cadence: "stream", periodMin }, fetchedAt, nowMs);
    if (f.state === "stale" || f.state === "stopped") return { text: `${base}（資料過期）`, tone: "warn" };
  }
  return { text: base, tone: "normal" };
}

// ── 變軌前後過台次數對比 ─────────────────────────────────

export interface PassDiff {
  before: number;
  after: number;
  diff: number;
  /** 前段為 0 時為 null（百分比無意義），只呈現次數差 */
  pct: number | null;
}

export function computePassDiff(before: number, after: number): PassDiff {
  const diff = after - before;
  return { before, after, diff, pct: before > 0 ? Math.round((diff / before) * 100) : null };
}

// ── 台灣衛星隊 ──────────────────────────────────────────

export type FleetView =
  | { kind: "loading"; text: string }
  | { kind: "error"; text: string }
  | { kind: "empty"; text: string }
  | { kind: "ready"; skipped: number };

/**
 * total = TLE 目錄中的台灣衛星數；computed = 目前成功算出位置的顆數。
 * total > computed 的差額是「暫無法計算」（TLE 解析或傳播失敗），不是消失。
 */
export function deriveFleetView(status: DataStatus, total: number, computed: number): FleetView {
  if (status === "loading") return { kind: "loading", text: "台灣衛星 — 載入中…" };
  if (status === "error") return { kind: "error", text: "台灣衛星 — 資料讀取失敗" };
  if (total === 0) return { kind: "empty", text: "台灣衛星 — 目前沒有資料" };
  if (computed === 0) return { kind: "error", text: `台灣衛星 — ${total} 顆暫無法計算` };
  return { kind: "ready", skipped: Math.max(0, total - computed) };
}

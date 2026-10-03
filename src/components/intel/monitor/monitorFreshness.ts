/**
 * 監看卡來源新鮮度（spec §5.35 G2＋狀態字表）。
 *
 * 只看「資料本身的時間」（觀測時間、資料日期），不看瀏覽器收到的時間；
 * 每格的預期更新週期登記在 `monitorCardMeta.ts` 的 `fresh`。
 *
 * 狀態：即時 live／延遲 delay（只把時間變色）／過期 stale／停更 stopped／無資料 none／收盤 paused。
 * 過期與停更時卡片要畫 G2：主數字 `MonitorMetric muted`、走勢尾段斜線（`staleUntil`）、
 * 卡底 `MonitorNote` 一行原因（`reason`）。
 */
import { useEffect, useState } from "react";
import { useMonitorCardHeader, type MonitorCardState } from "./MonitorCardFrame";
import { MONITOR_CARD_META } from "./monitorCardMeta";
import type { MonitorWidgetId } from "./monitorLayout";

const MIN_MS = 60_000;
const DAY_MS = 86_400_000;

/**
 * 預期更新週期。
 * - stream：每 `periodMin` 分鐘一筆；>2 週期延遲、>6 週期過期、>7 天停更。
 * - days：日／週批次，以台灣日期差判斷；>staleDays 過期（預設 2）、>stoppedDays 停更（預設 7）。
 * - market：盤中每 `periodMin` 分鐘；呼叫端傳 `paused`（收盤）且資料在 `pausedDays` 天內時只出中性 pill。
 * - event：事件型（地震、落雷、颱風），最新事件時間不代表來源活著，不判斷過期。
 */
export type MonitorFreshnessSpec =
  | { cadence: "stream"; periodMin: number }
  | { cadence: "days"; staleDays?: number; stoppedDays?: number }
  | { cadence: "market"; periodMin: number; pausedDays?: number }
  | { cadence: "event" };

export type MonitorFreshnessState = "live" | "delay" | "stale" | "stopped" | "none" | "paused";

export interface MonitorFreshness {
  state: MonitorFreshnessState;
  /** 過期／停更／無資料：主數字降灰 */
  muted: boolean;
  /** 過期／停更：走勢尾段斜線畫到這裡（unix seconds＝現在）；其餘 null */
  staleUntil: number | null;
  /** 卡底一行原因（過期／停更／無資料）；其餘 null */
  reason: string | null;
  /** 送標題列的狀態（即時、無資料為 null） */
  header: MonitorCardState | null;
}

export interface MonitorFreshnessOptions {
  /** 來源依時段正常暫停（收盤、休市） */
  paused?: boolean;
  /** 中性 pill 文字，預設「收盤」 */
  pausedLabel?: string;
  /** 來源已下架 */
  retired?: boolean;
  /** 覆寫卡底原因（例「上游未更新」）；不給用預設句 */
  reason?: string;
}

/** 台灣日期（YYYY-MM-DD 的序號天數），跟瀏覽器時區無關 */
function taipeiDayIndex(ms: number): number {
  return Math.floor((ms + 8 * 3600_000) / DAY_MS);
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/** 卡底原因用的資料時間：台灣 MM/DD HH:MM（日批次只到 MM/DD） */
function fmtTaipei(ms: number, withTime: boolean): string {
  const d = new Date(ms + 8 * 3600_000);
  const md = `${pad2(d.getUTCMonth() + 1)}/${pad2(d.getUTCDate())}`;
  return withTime ? `${md} ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}` : md;
}

function ageLabel(ageMs: number): string {
  if (ageMs >= DAY_MS) return `${Math.floor(ageMs / DAY_MS)} 天`;
  if (ageMs >= 3600_000) return `${Math.floor(ageMs / 3600_000)} 小時`;
  return `${Math.max(1, Math.floor(ageMs / MIN_MS))} 分`;
}

const LIVE: MonitorFreshness = { state: "live", muted: false, staleUntil: null, reason: null, header: null };

/**
 * 純函式：依週期、資料時間（epoch 毫秒）與現在判斷狀態。
 * 資料時間在未來（時鐘誤差）視為即時。
 */
export function judgeFreshness(
  spec: MonitorFreshnessSpec | undefined,
  dataMs: number | null | undefined,
  nowMs: number,
  opts: MonitorFreshnessOptions = {},
): MonitorFreshness {
  const nowSec = Math.floor(nowMs / 1000);
  if (opts.retired) {
    return {
      state: "stopped", muted: true, staleUntil: dataMs != null ? nowSec : null,
      reason: opts.reason ?? "來源已下架",
      header: { kind: "stopped", label: "來源已下架" },
    };
  }
  if (dataMs == null || !Number.isFinite(dataMs)) {
    return { state: "none", muted: true, staleUntil: null, reason: opts.reason ?? "尚無資料", header: null };
  }
  if (!spec || spec.cadence === "event") return LIVE;

  const ageMs = Math.max(0, nowMs - dataMs);
  const dayAge = taipeiDayIndex(nowMs) - taipeiDayIndex(dataMs);
  const withTime = spec.cadence !== "days";
  const since = fmtTaipei(dataMs, withTime);

  const stopped = (days: number): MonitorFreshness => ({
    state: "stopped", muted: true, staleUntil: nowSec,
    reason: opts.reason ?? `資料停在 ${since}，來源已 ${days} 天沒有更新`,
    header: { kind: "stopped", label: `停更 ${days} 天` },
  });
  const stale = (label: string): MonitorFreshness => ({
    state: "stale", muted: true, staleUntil: nowSec,
    reason: opts.reason ?? `資料停在 ${since}，超過預期更新時間`,
    header: { kind: "stale", label: `過期 ${label}` },
  });
  const delay: MonitorFreshness = { state: "delay", muted: false, staleUntil: null, reason: null, header: { kind: "delay" } };

  if (spec.cadence === "days") {
    const stoppedDays = spec.stoppedDays ?? 7;
    if (dayAge > stoppedDays) return stopped(dayAge);
    if (dayAge > (spec.staleDays ?? 2)) return stale(`${dayAge} 天`);
    return LIVE;
  }

  // stream／market：先看天數停更，再看週期倍數
  const days = Math.floor(ageMs / DAY_MS);
  if (days > 7) return stopped(days);
  if (spec.cadence === "market" && opts.paused && dayAge <= (spec.pausedDays ?? 4)) {
    return { ...LIVE, state: "paused", header: { kind: "paused", label: opts.pausedLabel ?? "收盤" } };
  }
  const periodMs = spec.periodMin * MIN_MS;
  if (ageMs > 6 * periodMs) return stale(ageLabel(ageMs));
  if (ageMs > 2 * periodMs) return delay;
  return LIVE;
}

/** 讓「現在」每分鐘前進一次，過期判斷不必等下一次輪詢 */
function useNowMinute(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), MIN_MS);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

export interface MonitorFreshnessInput extends MonitorFreshnessOptions {
  /** 標題列顯示的資料時間（epoch 毫秒） */
  time?: number | null;
  /** 標題列顯示的資料期別（例「W37」「09/29」）；有值時取代 time 的顯示 */
  timeText?: string | null;
  /** 判斷用的資料時間（epoch 毫秒）；不給用 time。只有 timeText 的格子必須給 */
  dataMs?: number | null;
}

/**
 * 卡片用：判斷新鮮度並把時間＋狀態送到標題列（取代直接呼叫 `useMonitorCardHeader`）。
 * 舊版（不在 v2 殼內）標題列不變；回傳值只在 v2 分支使用。
 */
export function useMonitorFreshness(widgetId: MonitorWidgetId, input: MonitorFreshnessInput): MonitorFreshness {
  const now = useNowMinute();
  const { time = null, timeText = null, dataMs, ...opts } = input;
  const f = judgeFreshness(MONITOR_CARD_META[widgetId].fresh, dataMs !== undefined ? dataMs : time, now, opts);
  useMonitorCardHeader({ time, timeText, state: f.header });
  return f;
}

/** 給沒有自己元件可放 hook 的格子（MonitorPanel 組裝的新聞四格）送時間＋新鮮度 */
export function MonitorFreshTime({ widgetId, ...input }: MonitorFreshnessInput & { widgetId: MonitorWidgetId }): null {
  useMonitorFreshness(widgetId, input);
  return null;
}

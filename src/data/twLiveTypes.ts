/**
 * 台灣即時快照三層（台灣圖層延伸 B8）的色票、類別與篩選 id（純常數，無 import；
 * layerParamsSpec 與腳本可安全引用）。抓取與快照狀態在 twLiveSnapshots.ts。
 */

export const DENGUE_COLOR = "#ef4444";

// ── 航船布告 ──────────────────────────────────────────────────────

export const NAV_KINDS = ["礙航公告", "射擊公告", "航標公告", "離岸風場施工公告"] as const;
export type NavKind = (typeof NAV_KINDS)[number];
export const NAV_KIND_COLOR: Record<NavKind, string> = {
  礙航公告: "#f59e0b",
  射擊公告: "#ef4444",
  航標公告: "#22d3ee",
  離岸風場施工公告: "#a78bfa",
};
export const NAV_OTHER_COLOR = "#9ca3af";
/** 篩選用 ASCII id（URL／bitmask 順序＝NAV_KINDS 順序） */
export const NAV_KIND_IDS = ["obstruction", "firing", "aton", "windfarm"] as const;
export const NAV_KIND_BY_ID: Record<string, NavKind> = Object.fromEntries(NAV_KIND_IDS.map((id, i) => [id, NAV_KINDS[i]!]));
/** 期限：永久類預設不顯示（站主 2026-11-22；來源常未下架多年前的永久公告） */
export const NAV_LIFETIMES = ["非永久", "永久"] as const;
export const NAV_LIFETIME_IDS = ["temporary", "permanent"] as const;
export const NAV_LIFETIME_BY_ID: Record<string, string> = { temporary: "非永久", permanent: "永久" };
/** 篩選選項顯示名（與圖例一致；來源值「非永久」不直接給人看） */
export const NAV_LIFETIME_OPTION_LABEL: Record<string, string> = { temporary: "有期限", permanent: "永久" };
export const NAV_LIFETIME_DEFAULT_IDS: readonly string[] = ["temporary"];


// ── 大潮／長浪警戒 ────────────────────────────────────────────────

export const TIDE_KINDS = ["spring", "swell"] as const;
export type TideKind = (typeof TIDE_KINDS)[number];
export const TIDE_KIND_LABEL: Record<TideKind, string> = { spring: "大潮監測", swell: "長浪監測" };
/** 等級色（序位，不算名目類別）：0 低於警戒、1 注意／長浪、2 警戒／巨浪；null＝沒看過的警戒字串 */
export const TIDE_LEVEL_COLOR = { 0: "#38bdf8", 1: "#f59e0b", 2: "#ef4444" } as const;
export const TIDE_UNKNOWN_COLOR = "#9ca3af";
export const TIDE_LEVELS = [0, 1, 2] as const;

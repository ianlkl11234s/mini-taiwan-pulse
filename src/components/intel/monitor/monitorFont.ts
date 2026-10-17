/**
 * 監看模式專用字級（spec §5.35 S13，2026-10-01 拍板）——只用在新版（v2）監看卡。
 *
 * 新版取消內容放大（MONITOR_CONTENT_ZOOM 只給舊版），直接用實際 px：最小 13。
 * 數值同時寫在 monitorCard.css 的 `--mon-f-*` 變數（P5 淡色版、活頁都讀變數）。
 * 舊版仍用全站 FONT_SIZE 7 階 × 放大 1.15，不受影響。
 */

export const MON_FONT_PX = {
  /** 軸上日期、英文小字、來源列、角標 */
  cap: 13,
  /** 小節標、KPI 標籤、資料時間、pill */
  label: 13,
  /** 正文、清單、單位 */
  body: 14,
  /** 卡片標題 */
  title: 16,
  /** KPI 數值 */
  kpi: 19,
  /** 主數字 */
  main: 24,
} as const;

export type MonFontRole = keyof typeof MON_FONT_PX;

/** 給 inline style 用的 CSS 變數（值見 monitorCard.css） */
export const MF: Record<MonFontRole, string> = {
  cap: "var(--mon-f-cap)",
  label: "var(--mon-f-label)",
  body: "var(--mon-f-body)",
  title: "var(--mon-f-title)",
  kpi: "var(--mon-f-kpi)",
  main: "var(--mon-f-main)",
};

/** 一次性的大字（戰情概覽環中央 40px）不進字級表，原樣保留 */
const HERO_MIN_PX = 36;

/**
 * 舊版字級（全站 7 階或手寫值，單位 px）→ 監看新版字級。
 * ≤9.5 → cap、≤10.5 → label、≤12.5 → body、≤15 → title、≤21 → kpi、≥22 → main。
 */
export function monFontFor(px: number): string | number {
  if (px >= HERO_MIN_PX) return px;
  if (px <= 9.5) return MF.cap;
  if (px <= 10.5) return MF.label;
  if (px <= 12.5) return MF.body;
  if (px <= 15) return MF.title;
  if (px <= 21) return MF.kpi;
  return MF.main;
}

/**
 * 卡片元件用：`fontSize: fs(v2, FONT_SIZE.sm)`。
 * 舊版回傳原值（畫面不變），新版回傳監看字級變數。
 */
export function fs(v2: boolean, legacyPx: number): string | number {
  return v2 ? monFontFor(legacyPx) : legacyPx;
}

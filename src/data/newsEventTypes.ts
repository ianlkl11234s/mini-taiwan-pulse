/**
 * News Events — 分類定義（單一真實來源）
 *
 * 對應 LLM（Gemini Flash-Lite）輸出的 7 類，collector 寫入
 * `realtime.news_events.category`，前端用同一份表做：
 *  - overlayRegistry circle-color match expression
 *  - LegendPanel NewsEventLegend
 *  - NewsEventPanel popup 中文標籤 + 對應分類色
 *
 * 順序 = 圖例顯示順序（重要性遞減：時序性事件 → 政策 → 兜底 other）。
 */

export type NewsCategory =
  | "accident"
  | "crime"
  | "disaster"
  | "traffic"
  | "health"
  | "policy"
  | "other";

export interface NewsCategoryDef {
  key: NewsCategory;
  label: string;
  color: string;
}

export const NEWS_CATEGORIES: NewsCategoryDef[] = [
  { key: "accident", label: "事故",     color: "#ef4444" },
  { key: "crime",    label: "治安",     color: "#a855f7" },
  { key: "disaster", label: "災害",     color: "#f97316" },
  { key: "traffic",  label: "交通",     color: "#eab308" },
  { key: "health",   label: "健康",     color: "#22c55e" },
  { key: "policy",   label: "政策",     color: "#3b82f6" },
  { key: "other",    label: "其他",     color: "#9ca3af" },
];

const OTHER_COLOR = "#9ca3af";

/**
 * Mapbox `match` expression — 給 overlayRegistry circle-color 用。
 * 未匹配 → other 色（兜底）。
 */
export const NEWS_CATEGORY_COLOR_EXPR: unknown = [
  "match",
  ["get", "category"],
  ...NEWS_CATEGORIES.flatMap((c) => [c.key, c.color]),
  OTHER_COLOR,
];

const OTHER_DEF: NewsCategoryDef = { key: "other", label: "其他", color: OTHER_COLOR };

export function getNewsCategoryDef(key: string | null | undefined): NewsCategoryDef {
  return NEWS_CATEGORIES.find((c) => c.key === key) ?? OTHER_DEF;
}

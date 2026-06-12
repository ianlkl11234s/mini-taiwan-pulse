/**
 * NCDR 災害示警 — 5 個主題群組定義
 *
 * disasterAlerts 單層拆成 5 個群組 layer（2026-06-12）：
 * 共用同一個 loader + Mapbox source，只差 group filter 與 event_term 分色。
 * 此表為單一真實來源，供 loader / hook / LegendPanel 三處共用。
 *
 * 排除不進地圖的類型：
 * - 地震：已有專屬 earthquakes 圖層（CWA 來源更完整）
 * - 消防安全檢查重大不合格場所：是名單不是事件（一掛數週、59 筆常駐）
 * - ncdrSystemTest：系統測試
 */

export type AlertGroupKey =
  | "lifelineAlerts"
  | "floodAlerts"
  | "weatherAlerts"
  | "transitAlerts"
  | "safetyAlerts";

export const ALERT_GROUP_KEYS: AlertGroupKey[] = [
  "lifelineAlerts",
  "floodAlerts",
  "weatherAlerts",
  "transitAlerts",
  "safetyAlerts",
];

interface AlertGroupDef {
  label: string;
  /** event_term → 顯示色 */
  types: Record<string, string>;
  /** 是否為小範圍事件群（除大面積氣象特報外都補 centroid 點，低 zoom 仍可見） */
  emitPoints: boolean;
}

export const ALERT_GROUPS: Record<AlertGroupKey, AlertGroupDef> = {
  lifelineAlerts: {
    label: "民生中斷 Lifeline",
    types: {
      停水: "#38bdf8",
      電力中斷: "#facc15",
      行動電話中斷: "#a78bfa",
      停班停課: "#f472b6",
    },
    emitPoints: true,
  },
  floodAlerts: {
    label: "水文防汛 Flood",
    types: {
      淹水: "#2563eb",
      淹水感測: "#60a5fa",
      水庫放流: "#0891b2",
      河川高水位: "#1d4ed8",
      區排警戒: "#818cf8",
      土石流及大規模崩塌: "#92400e",
      枯旱預警: "#d97706",
    },
    emitPoints: true,
  },
  weatherAlerts: {
    label: "氣象特報 Weather",
    types: {
      雷雨: "#7c3aed",
      降雨: "#3b82f6",
      強風: "#14b8a6",
      高溫: "#ef4444",
      低溫: "#93c5fd",
      濃霧: "#9ca3af",
      颱風: "#dc2626",
      海嘯: "#0f766e",
    },
    emitPoints: false,
  },
  transitAlerts: {
    label: "交通阻斷 Transit",
    types: {
      道路封閉: "#f97316",
      鐵路事故: "#dc2626",
      捷運營運: "#10b981",
      高速公路路況事件: "#fb923c",
    },
    emitPoints: true,
  },
  safetyAlerts: {
    label: "安全環境 Safety",
    types: {
      火災: "#ef4444",
      海洋污染: "#0ea5e9",
      空氣品質: "#84cc16",
      國家森林遊樂區: "#22c55e",
    },
    emitPoints: true,
  },
};

/** 不進地圖的 event_term */
export const EXCLUDED_TERMS = new Set([
  "地震",
  "消防安全檢查重大不合格場所",
  "ncdrSystemTest",
]);

/** 未知新類型的歸宿（NCDR 共 61 類，未列舉者落到安全環境群、灰色） */
const FALLBACK_GROUP: AlertGroupKey = "safetyAlerts";
const FALLBACK_COLOR = "#9ca3af";

const TERM_TO_GROUP = new Map<string, AlertGroupKey>();
for (const key of ALERT_GROUP_KEYS) {
  for (const term of Object.keys(ALERT_GROUPS[key].types)) {
    TERM_TO_GROUP.set(term, key);
  }
}

export function alertGroupOf(term: string | null | undefined): AlertGroupKey {
  if (!term) return FALLBACK_GROUP;
  return TERM_TO_GROUP.get(term) ?? FALLBACK_GROUP;
}

export function alertTypeColor(term: string | null | undefined): string {
  if (!term) return FALLBACK_COLOR;
  const group = TERM_TO_GROUP.get(term);
  if (!group) return FALLBACK_COLOR;
  return ALERT_GROUPS[group].types[term] ?? FALLBACK_COLOR;
}

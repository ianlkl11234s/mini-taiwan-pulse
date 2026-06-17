/**
 * Intel Panel — 集中 token / 樣式常數
 *
 * 沿用既有 dark glass-panel 語彙，避免在元件間漂移。
 * 字型：CJK 用系統，數字 / 時間用 mono。
 */

export const FONT_CJK = `"Noto Sans TC", "PingFang TC", "Microsoft JhengHei", system-ui, sans-serif`;
export const FONT_DATA = `"JetBrains Mono", "SF Mono", ui-monospace, Menlo, monospace`;

/** 半透明 / 邊框 token */
export const COLORS = {
  panelBg: "rgba(0,0,0,0.52)",
  panelBorder: "rgba(255,255,255,0.10)",
  borderSoft: "rgba(255,255,255,0.06)",
  borderMid: "rgba(255,255,255,0.14)",
  borderStrong: "rgba(255,255,255,0.22)",
  borderAccent: "rgba(100,170,255,0.55)",

  textStrong: "#f3f4f6",
  textDefault: "#d8dce3",
  textMuted: "#9ca3af",
  textDim: "#6b7280",
  textFaint: "#4b5560",
  textGhost: "#363b44",

  accent: "#64aaff",
  accentSoft: "rgba(100,170,255,0.55)",
  accentFaint: "rgba(100,170,255,0.16)",

  statusLive: "#22c55e",
  statusLiveSoft: "rgba(34,197,94,0.16)",
  statusLiveBorder: "rgba(34,197,94,0.45)",
  statusWarn: "#ff9800",
  statusWarnSoft: "rgba(255,152,0,0.16)",
  statusWarnBorder: "rgba(255,152,0,0.45)",
  statusErr: "#ef4444",

  surge: "#ff9800",
  cluster: "#1ad9e5",
} as const;

/** 分級色（gis_relevance 0–3） */
export const GIS_LEVELS = [
  { label: "無關", en: "NONE",    color: "rgba(255,255,255,0.22)" },
  { label: "提及", en: "MENTION", color: "rgba(255,255,255,0.42)" },
  { label: "地方", en: "LOCAL",   color: "#64aaff" },
  { label: "重大", en: "MAJOR",   color: "#ff9800" },
];

/** 嚴重程度色（severity 0–3） */
export const SEV_LEVELS = [
  { label: "無",     en: "NONE",     color: "rgba(255,255,255,0.22)" },
  { label: "個案",   en: "MINOR",    color: "#eab308" },
  { label: "區域",   en: "REGIONAL", color: "#f97316" },
  { label: "大規模", en: "MAJOR",    color: "#ef4444" },
];

/** 縣市 dropdown 順序（前段大都市，後段含全國/離島） */
export const COUNTY_OPTIONS = [
  "全部", "臺北市", "新北市", "桃園市", "臺中市", "臺南市", "高雄市",
  "基隆市", "新竹市", "新竹縣", "苗栗縣", "彰化縣", "南投縣",
  "雲林縣", "嘉義市", "嘉義縣", "屏東縣", "宜蘭縣", "花蓮縣", "臺東縣",
  "澎湖縣", "金門縣", "連江縣", "全國",
];

export function relTime(ts: number, now: number): string {
  const d = Math.max(0, now - ts);
  if (d < 60) return "剛剛";
  if (d < 3600) return `${Math.floor(d / 60)} 分鐘前`;
  if (d < 86400) {
    const h = Math.floor(d / 3600);
    const m = Math.floor((d % 3600) / 60);
    return m ? `${h} 小時 ${m} 分前` : `${h} 小時前`;
  }
  return `${Math.floor(d / 86400)} 天前`;
}

export function clockTime(ts: number): string {
  return new Date(ts * 1000).toLocaleTimeString("zh-TW", {
    timeZone: "Asia/Taipei",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function fmtCountdown(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// ─── Monitor Mode Phase 2 ─────────────────────────────────────────

/** 4 檔戰情等級（壓力指數 0–100 對應顏色 + 動畫） */
export type PressureLevelKey = "peace" | "notice" | "alert" | "emergency";

export interface PressureLevelDef {
  key: PressureLevelKey;
  label: string;
  en: string;
  min: number;
  max: number;
  color: string;
  soft: string;
  glow: string;
  anim: "none" | "breathe" | "pulse";
  period: number;
}

export const PRESSURE_LEVELS: PressureLevelDef[] = [
  { key: "peace",     label: "平時", en: "PEACETIME", min: 0,  max: 35,  color: "#4caf50",
    soft: "rgba(76,175,80,0.16)",  glow: "rgba(76,175,80,0)",     anim: "none",    period: 0 },
  { key: "notice",    label: "留意", en: "NOTICE",    min: 36, max: 55,  color: "#eab308",
    soft: "rgba(234,179,8,0.16)",  glow: "rgba(234,179,8,0)",     anim: "breathe", period: 4 },
  { key: "alert",     label: "警戒", en: "ALERT",     min: 56, max: 75,  color: "#ff9800",
    soft: "rgba(255,152,0,0.16)",  glow: "rgba(255,152,0,0.35)",  anim: "breathe", period: 2 },
  { key: "emergency", label: "緊急", en: "EMERGENCY", min: 76, max: 100, color: "#ff3b30",
    soft: "rgba(255,59,48,0.18)",  glow: "rgba(255,59,48,0.55)",  anim: "pulse",   period: 1 },
];

export function pressureLevel(score: number): PressureLevelDef {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  return PRESSURE_LEVELS.find((l) => clamped >= l.min && clamped <= l.max) ?? PRESSURE_LEVELS[0]!;
}

/** Monitor 模式的補充 icon set（沿用 IntelIcon 的 lucide-flavor stroke） */
export const MICON: Record<string, string[]> = {
  grid:      ["M3 3h7v7H3z", "M14 3h7v7h-7z", "M14 14h7v7h-7z", "M3 14h7v7H3z"],
  maximize:  ["M8 3H5a2 2 0 0 0-2 2v3", "M21 8V5a2 2 0 0 0-2-2h-3", "M3 16v3a2 2 0 0 0 2 2h3", "M16 21h3a2 2 0 0 0 2-2v-3"],
  minimize:  ["M8 3v3a2 2 0 0 1-2 2H3", "M21 8h-3a2 2 0 0 1-2-2V3", "M3 16h3a2 2 0 0 1 2 2v3", "M16 21v-3a2 2 0 0 1 2-2h3"],
  flame:     ["M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z"],
  plane:     ["M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"],
  trendUp:   ["M22 7 13.5 15.5 8.5 10.5 2 17", "M16 7h6v6"],
  trendDown: ["M22 17 13.5 8.5 8.5 13.5 2 7", "M16 17h6v-6"],
  pulse:     ["M22 12h-4l-3 9L9 3l-3 9H2"],
};

/** 5min EMA 平滑（30s polling, N=10 → alpha≈0.18）。score=null 表示首次採樣，直接回新值。 */
export function smoothPressure(prev: number | null, next: number, alpha = 0.18): number {
  if (prev == null || Number.isNaN(prev)) return next;
  return prev + (next - prev) * alpha;
}

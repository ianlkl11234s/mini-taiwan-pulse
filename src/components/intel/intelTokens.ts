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

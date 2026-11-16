/**
 * 即時 119 案件（fire119Live）與警廣即時路況（pbsRoadEventsLive）的色票、標籤與顯示規則 SSOT。
 * 地圖（useFire119LiveLayer／usePbsRoadEventsLiveLayer）、圖例（liveIncidentsLegends）、
 * popup（liveIncidentsPanels）三邊共用（development-rules §4a 規則 2）。
 *
 * 資料契約：gis-platform migration 555（get_fire119_live／get_pbs_road_events_live，站主限定）。
 * 呈現決策：taipei-gis-analytics docs/topic-research/realtime_incidents/decision-log.md（站主 2026-11-16）。
 */

/** 案件類別（mig 555 CHECK） */
export type Fire119Category = "fire" | "ems" | "rescue" | "other";
export const FIRE119_CATEGORIES: readonly Fire119Category[] = ["fire", "ems", "rescue", "other"];

/** 資料色（design-system §3.16：資料色不進 token）。火災沿用 spec §3.15 fire 語意色 */
export const FIRE119_CATEGORY_COLOR: Record<Fire119Category, string> = {
  fire: "#ff5722",
  ems: "#3b82f6",
  rescue: "#fb923c",
  other: "#9ca3af",
};

export const FIRE119_CATEGORY_LABEL: Record<Fire119Category, string> = {
  fire: "火災",
  ems: "救護",
  rescue: "救援",
  other: "其他",
};

export function asFire119Category(v: unknown): Fire119Category {
  return (FIRE119_CATEGORIES as readonly unknown[]).includes(v) ? (v as Fire119Category) : "other";
}

/** 案件狀態（mig 555 CHECK） */
export type Fire119Status = "received" | "dispatched" | "arrived" | "transporting" | "returned" | "other";
export const FIRE119_STATUS_LABEL: Record<Fire119Status, string> = {
  received: "受理",
  dispatched: "出動",
  arrived: "到達現場",
  transporting: "送醫中",
  returned: "返隊",
  other: "狀態不明",
};

export function asFire119Status(v: unknown): Fire119Status {
  return v && typeof v === "string" && v in FIRE119_STATUS_LABEL ? (v as Fire119Status) : "other";
}

/**
 * 狀態 → 地圖畫法：
 *   pulse  受理／出動／到達現場（進行中，脈動）
 *   hollow 送醫中（空心）
 *   faded  返隊（灰化，之後淡出）
 *   solid  狀態不明（實心、不脈動）
 */
export type Fire119Mark = "pulse" | "hollow" | "faded" | "solid";
export function fire119Mark(status: Fire119Status): Fire119Mark {
  if (status === "received" || status === "dispatched" || status === "arrived") return "pulse";
  if (status === "transporting") return "hollow";
  if (status === "returned") return "faded";
  return "solid";
}

/** 位置精度（mig 555 CHECK） */
export type Fire119Precision = "exact" | "fuzzy" | "road" | "district" | "none";
export function asFire119Precision(v: unknown): Fire119Precision {
  return v === "exact" || v === "fuzzy" || v === "road" || v === "district" ? v : "none";
}

/** 返隊灰色（兩種底圖都看得到的中性灰） */
export const FIRE119_RETURNED_COLOR = "#6b7280";
/** 返隊後多久淡出到消失（分鐘）：依「最後一次內容變化」updated_at 起算 */
export const FIRE119_RETURNED_FADE_MIN = 60;
/** 同時脈動上限（map-layers P-6／viz-library M8：同時 ≤ 20 個脈衝，取最新受理的） */
export const FIRE119_PULSE_CAP = 20;
/** 行政區面量：件數分級（1、2–4、5 以上） */
export const FIRE119_DISTRICT_BREAKS = [2, 5] as const;
export const FIRE119_DISTRICT_COLORS = ["#fca5a5", "#f87171", "#dc2626"] as const;
/** 新北醫院徽章（送醫中救護車的目的醫院）用救護色 */
export const FIRE119_HOSPITAL_COLOR = FIRE119_CATEGORY_COLOR.ems;

/** 時間範圍（依受理時間；沒有受理時間的看最後一次狀態變化） */
export const LIVE_INCIDENT_WINDOWS = [
  { value: "60", label: "最近 1 小時" },
  { value: "180", label: "最近 3 小時" },
  { value: "360", label: "最近 6 小時" },
] as const;
export type LiveIncidentWindow = (typeof LIVE_INCIDENT_WINDOWS)[number]["value"];
export function asLiveIncidentWindow(v: unknown): LiveIncidentWindow {
  return v === "60" || v === "360" ? v : "180";
}

// ── 警廣 ──────────────────────────────────────────────
export type PbsCategory = "traffic_incident" | "other";
export const PBS_CATEGORY_COLOR: Record<PbsCategory, string> = {
  traffic_incident: "#facc15",
  other: "#9ca3af",
};
export const PBS_CATEGORY_LABEL: Record<PbsCategory, string> = {
  traffic_incident: "事故",
  other: "其他路況",
};
export function asPbsCategory(v: unknown): PbsCategory {
  return v === "traffic_incident" ? v : "other";
}
export type PbsStatus = "reported" | "ongoing" | "cleared";
export const PBS_STATUS_LABEL: Record<PbsStatus, string> = {
  reported: "通報",
  ongoing: "處理中",
  cleared: "已排除",
};
export function asPbsStatus(v: unknown): PbsStatus {
  return v === "ongoing" || v === "cleared" ? v : "reported";
}
export const PBS_CLEARED_COLOR = FIRE119_RETURNED_COLOR;

/** 每分鐘重抓（收集器每分鐘寫入） */
export const LIVE_INCIDENT_POLL_MS = 60_000;

/** ISO 字串 → unix 毫秒；空值／壞值回 null（不當 0） */
export function isoMs(v: unknown): number | null {
  if (typeof v !== "string" || !v) return null;
  const t = Date.parse(v);
  return Number.isFinite(t) ? t : null;
}

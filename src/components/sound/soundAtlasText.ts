/**
 * City Sound Atlas 顯示文字對照（i18n key 寫成字面值，localeParity 靠字面值判斷 key 有沒有人用）。
 * 引擎的機器碼（provider、precision、unknownReason）一律先過這裡，不直接印（design-system §6.3）。
 */
import type { MessageKey } from "../../i18n/keys";
import type { ContributionEvidence, FamilyStatus, SoundSourceFamily, SourceHealth } from "../../sound/types";
import type { SoundSceneId } from "../../sound/scenes";

export const FAMILY_KEYS: Record<SoundSourceFamily, MessageKey> = {
  aviation: "soundAtlas.family.aviation",
  rain: "soundAtlas.family.rain",
  thunder: "soundAtlas.family.thunder",
  waste_collection: "soundAtlas.family.waste",
};

export const STATUS_KEYS: Record<FamilyStatus, MessageKey> = {
  active: "soundAtlas.status.active",
  inactive: "soundAtlas.status.inactive",
  unknown: "soundAtlas.status.unknown",
  unavailable: "soundAtlas.status.unavailable",
};

export const EVIDENCE_KEYS: Record<ContributionEvidence, MessageKey> = {
  observed: "soundAtlas.evidence.observed",
  scheduled: "soundAtlas.evidence.scheduled",
  modeled: "soundAtlas.evidence.modeled",
  inferred: "soundAtlas.evidence.inferred",
};

export const HEALTH_KEYS: Record<SourceHealth, MessageKey> = {
  ok: "soundAtlas.health.ok",
  empty: "soundAtlas.health.empty",
  error: "soundAtlas.health.error",
  unavailable: "soundAtlas.health.unavailable",
};

/** 場景下拉選單標題（選點理由不在這裡：一律讀快照 receiver.reason_zh） */
export const SCENE_KEYS: Record<SoundSceneId, { title: MessageKey }> = {
  "taipei-1109": { title: "soundAtlas.scene.taipei1109" },
  "taichung-heping-1108": { title: "soundAtlas.scene.heping1108" },
  "taipei-typhoon-1024": { title: "soundAtlas.scene.typhoon1024" },
};

export function providerKey(provider: string): MessageKey {
  switch (provider) {
    case "flight_trails": return "soundAtlas.provider.flightTrails";
    case "cwa_rain_gauge": return "soundAtlas.provider.rainGauge";
    case "cwa": return "soundAtlas.provider.cwa";
    case "taipower": return "soundAtlas.provider.taipower";
    case "waste_schedule_static": return "soundAtlas.provider.waste";
    default: return "soundAtlas.precision.other";
  }
}

export function spatialPrecisionKey(code: string): MessageKey {
  if (code === "adsb_track_point") return "soundAtlas.precision.track";
  if (code.startsWith("nearest_gauge")) return "soundAtlas.precision.gauge";
  if (code === "strike_point_2d") return "soundAtlas.precision.strike";
  if (code === "scheduled_stop_point") return "soundAtlas.precision.stop";
  return "soundAtlas.precision.other";
}

export function temporalPrecisionKey(code: string): MessageKey {
  if (code === "trail_point_or_linear_interpolation") return "soundAtlas.timePrecision.track";
  if (code === "hourly") return "soundAtlas.timePrecision.hourly";
  if (code === "strike_ts_plus_modeled_delay") return "soundAtlas.timePrecision.strike";
  if (code === "timetable") return "soundAtlas.timePrecision.timetable";
  if (code === "schedule_inferred_times") return "soundAtlas.timePrecision.inferred";
  return "soundAtlas.precision.other";
}

/** unknownReason（或家族 reason）→ 白話 */
export function reasonKey(reason: string | null | undefined): MessageKey {
  const r = reason ?? "";
  if (r.startsWith("calendar_")) return "soundAtlas.reason.calendar";
  if (r === "altitude_unit_unknown") return "soundAtlas.reason.altitude";
  if (r.startsWith("trail_gap")) return "soundAtlas.reason.trailGap";
  if (r.startsWith("no_rain_station_within")) return "soundAtlas.reason.noStation";
  if (r === "station_hour_missing") return "soundAtlas.reason.hourMissing";
  if (r === "precipitation_1hr_null") return "soundAtlas.reason.valueNull";
  if (r.startsWith("no_healthy_source")) return "soundAtlas.reason.noHealthy";
  if (r === "source_not_loaded") return "soundAtlas.reason.notLoaded";
  if (r === "outside_source_time_coverage") return "soundAtlas.reason.outsideWindow";
  return "soundAtlas.reason.other";
}

/** 0–1 相對潛勢 → 兩位小數字串；null → 「—」（不是 0） */
export function formatPotential(v: number | null | undefined): string {
  return v == null || !Number.isFinite(v) ? "—" : v.toFixed(2);
}

export function formatDistanceM(m: number | null | undefined): string {
  if (m == null || !Number.isFinite(m)) return "—";
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
}

/** ISO／unix → 臺灣時間 HH:MM（跨日附 MM/DD） */
export function formatTaipeiTime(iso: string | number, withDate = false): string {
  const d = typeof iso === "number" ? new Date(iso * 1000) : new Date(iso);
  if (!Number.isFinite(d.getTime())) return "—";
  const s = d.toLocaleString("sv-SE", { timeZone: "Asia/Taipei" });
  return withDate ? `${s.slice(5, 10).replace("-", "/")} ${s.slice(11, 16)}` : s.slice(11, 16);
}

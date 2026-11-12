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
  rail: "soundAtlas.family.rail",
  road_traffic: "soundAtlas.family.roadTraffic",
  roadwork: "soundAtlas.family.roadwork",
  wind_vegetation: "soundAtlas.family.wind",
  coastal_wave: "soundAtlas.family.wave",
  river_water: "soundAtlas.family.river",
};

export const STRUCTURE_KEYS: Record<"elevated" | "at_grade" | "surface" | "unknown", MessageKey> = {
  elevated: "soundAtlas.structure.elevated",
  at_grade: "soundAtlas.structure.atGrade",
  surface: "soundAtlas.structure.surface",
  unknown: "soundAtlas.structure.unknown",
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
  estimated: "soundAtlas.evidence.estimated",
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
  "taipei-typhoon-1024-jinshan": { title: "soundAtlas.scene.typhoon1024Jinshan" },
  "taipei-typhoon-1024-zhonghe": { title: "soundAtlas.scene.typhoon1024Zhonghe" },
};

/** 資料來自哪一份（場景快照／W6-3 全範圍來源檔／即時） */
export function originKey(origin: unknown): MessageKey {
  return origin === "scene" ? "soundAtlas.origin.scene" : origin === "grid" ? "soundAtlas.origin.grid" : "soundAtlas.origin.live";
}

export function providerKey(provider: string): MessageKey {
  switch (provider) {
    case "flight_trails": return "soundAtlas.provider.flightTrails";
    case "cwa_rain_gauge": return "soundAtlas.provider.rainGauge";
    case "cwa_radar_grid": return "soundAtlas.provider.radar";
    case "cwa": return "soundAtlas.provider.cwa";
    case "taipower": return "soundAtlas.provider.taipower";
    case "waste_schedule_static": return "soundAtlas.provider.waste";
    case "freeway_sections": return "soundAtlas.provider.freeway";
    case "tdx_road_event_city": return "soundAtlas.provider.roadwork";
    case "vd_typical_taipei": return "soundAtlas.provider.vdTypical";
    case "freeway_vd": return "soundAtlas.provider.freewayVd";
    case "osm_road_class": return "soundAtlas.provider.osmRoad";
    case "cwa_weather_obs": return "soundAtlas.provider.windObs";
    case "cwa_marine_obs": return "soundAtlas.provider.waveObs";
    case "wra_river_water_level": return "soundAtlas.provider.riverLevel";
    default: return provider.startsWith("rail_") ? "soundAtlas.provider.rail" : "soundAtlas.precision.other";
  }
}

export function spatialPrecisionKey(code: string): MessageKey {
  if (code === "adsb_track_point") return "soundAtlas.precision.track";
  if (code === "radar_grid_250m") return "soundAtlas.precision.radarGrid";
  if (code === "radar_grid_250m+nearest_gauge") return "soundAtlas.precision.radarGauge";
  if (code.startsWith("nearest_gauge")) return "soundAtlas.precision.gauge";
  if (code === "strike_point_2d") return "soundAtlas.precision.strike";
  if (code === "scheduled_stop_point") return "soundAtlas.precision.stop";
  if (code === "track_geometry_progress_interpolation") return "soundAtlas.precision.trackProgress";
  if (code === "freeway_section_line") return "soundAtlas.precision.roadLine";
  if (code === "vd_point") return "soundAtlas.precision.vdPoint";
  if (code === "freeway_section_by_vd_mileage") return "soundAtlas.precision.freewayVd";
  if (code === "vd_extended_along_road(assumption)") return "soundAtlas.precision.vdExtended";
  if (code === "osm_road_class") return "soundAtlas.precision.roadClass";
  if (code === "grid_cell_250m") return "soundAtlas.precision.gridCell";
  if (code.startsWith("permit_")) return "soundAtlas.precision.permit";
  if (code === "nearest_station_wind_x_receiver_canopy") return "soundAtlas.precision.windCanopy";
  if (code === "offshore_station_x_coast_distance_proxy") return "soundAtlas.precision.waveCoast";
  if (code === "nearest_level_station_x_channel_distance") return "soundAtlas.precision.riverChannel";
  if (code === "nearest_station") return "soundAtlas.precision.nearestStation";
  return "soundAtlas.precision.other";
}

export function temporalPrecisionKey(code: string): MessageKey {
  if (code === "trail_point_or_linear_interpolation") return "soundAtlas.timePrecision.track";
  if (code === "hourly") return "soundAtlas.timePrecision.hourly";
  if (code === "radar_10min") return "soundAtlas.timePrecision.radar10min";
  if (code === "radar_10min+hourly") return "soundAtlas.timePrecision.radarHourly";
  if (code === "strike_ts_plus_modeled_delay") return "soundAtlas.timePrecision.strike";
  if (code === "timetable" || code.startsWith("timetable(")) return "soundAtlas.timePrecision.timetable";
  if (code === "none(road_type_static)" || code === "none(road_class_static)") return "soundAtlas.timePrecision.static";
  if (code === "vd_1min_sample_per_10min") return "soundAtlas.timePrecision.vd1min";
  if (code === "typical_weekday_hourly") return "soundAtlas.timePrecision.typicalHourly";
  if (code.startsWith("permit_window")) return "soundAtlas.timePrecision.permit";
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
  if (r === "radar_frame_unavailable") return "soundAtlas.reason.radarFrame";
  // W5 自然三族：風、浪即時沒有讀取路徑（coverage unavailable）→「僅場景快照提供」
  if (r.endsWith("(snapshot_only)") || (r.startsWith("no_healthy_source") && /(cwa_weather_obs|cwa_marine_obs|wra_river_water_level):unavailable/.test(r))) return "soundAtlas.reason.snapshotOnly";
  if (r === "vegetation_not_sampled") return "soundAtlas.reason.noVegetation";
  if (r === "canopy_masked_ambiguous") return "soundAtlas.reason.canopyAmbiguous";
  if (r.startsWith("coastline_") || r.startsWith("river_network_")) return "soundAtlas.reason.naturalNotLoaded";
  if (/^outside_(wind|wave|river)_station_extent$/.test(r)) return "soundAtlas.reason.outsideStations";
  if (/^no_(wind|wave|water_level)_station_within/.test(r)) return "soundAtlas.reason.noNearbyStation";
  if (r === "no_station_history_quantiles") return "soundAtlas.reason.noQuantiles";
  if (r === "wind_speed_null" || r === "wave_height_or_period_null" || r === "water_level_null") return "soundAtlas.reason.naturalValueNull";
  if (r.startsWith("no_healthy_source")) return "soundAtlas.reason.noHealthy";
  if (r === "source_not_loaded") return "soundAtlas.reason.notLoaded";
  if (r === "outside_source_time_coverage") return "soundAtlas.reason.outsideWindow";
  if (r.startsWith("rail_structure_unknown")) return "soundAtlas.reason.railStructure";
  if (r === "station_not_in_track_progress") return "soundAtlas.reason.railStation";
  if (r === "rail_schedule_unavailable" || r.endsWith("_schedule_not_found")) return "soundAtlas.reason.railSchedule";
  if (r.startsWith("road_network_not_covered")) return "soundAtlas.reason.roadNotCovered";
  if (r === "volume_sample_gap") return "soundAtlas.reason.volumeGap";
  if (r === "freeway_vd_pack_missing") return "soundAtlas.reason.freewayPackMissing";
  if (r === "freeway_no_vd_within_gap") return "soundAtlas.reason.freewayNoVd";
  if (r === "freeway_vd_sample_missing") return "soundAtlas.reason.freewaySample";
  if (r.startsWith("freeway_vd_")) return "soundAtlas.reason.freewayVdFault";
  if (r === "taipei_road_not_reached_by_vd") return "soundAtlas.reason.taipeiNoVd";
  if (r === "minor_road_no_data") return "soundAtlas.reason.minorRoad";
  if (r === "typical_vd_missing") return "soundAtlas.reason.typicalMissing";
  if (r === "typical_not_applicable(anomaly_day)") return "soundAtlas.reason.typicalAnomaly";
  if (r === "typical_not_applicable(calendar_not_covered)") return "soundAtlas.reason.typicalCalendar";
  if (r.startsWith("typical_not_applicable(")) return "soundAtlas.reason.typicalWeekend";
  if (r === "typical_flow_null") return "soundAtlas.reason.typicalMissing";
  if (r === "typical_sample_insufficient") return "soundAtlas.reason.typicalSample";
  if (r === "roadwork_city_not_covered") return "soundAtlas.reason.roadworkNotCovered";
  if (r === "outside_snapshot_bbox") return "soundAtlas.reason.outsideSnapshot";
  // W6-3 連續潛勢網格：整幀沒有算的原因
  if (r === "no_full_area_source") return "soundAtlas.reason.noFullAreaSource";
  if (r === "no_pack_for_date") return "soundAtlas.reason.noPackForDate";
  if (r === "pack_source_mismatch") return "soundAtlas.reason.packSourceMismatch";
  if (r === "outside_pack_time") return "soundAtlas.reason.outsidePackTime";
  if (r === "receiver_outside_grid") return "soundAtlas.reason.receiverOutsideGrid";
  if (r === "permit_window_work_hours_unknown") return "soundAtlas.reason.workHours";
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

/** W6-1 雨勢分級碼（0–4、255）→ 文字 key */
const RAIN_CLASS_KEYS: readonly MessageKey[] = [
  "soundAtlas.rain.class.0", "soundAtlas.rain.class.1", "soundAtlas.rain.class.2", "soundAtlas.rain.class.3", "soundAtlas.rain.class.4",
];
export function rainClassKey(code: number | null | undefined): MessageKey {
  return (code != null && RAIN_CLASS_KEYS[code]) || "soundAtlas.rain.class.unknown";
}

/** W6-2 道路網格分級（0–4、其他＝無法判斷）→ 文字 key */
const ROAD_LEVEL_KEYS: readonly MessageKey[] = [
  "soundAtlas.road.level.0", "soundAtlas.road.level.1", "soundAtlas.road.level.2", "soundAtlas.road.level.3", "soundAtlas.road.level.4",
];
export function roadLevelKey(level: number | null | undefined): MessageKey {
  return (level != null && ROAD_LEVEL_KEYS[level]) || "soundAtlas.road.level.unknown";
}

export const ROAD_EVIDENCE_KEYS: Record<"observed" | "estimated" | "inferred", MessageKey> = {
  observed: "soundAtlas.road.evidence.observed",
  estimated: "soundAtlas.road.evidence.estimated",
  inferred: "soundAtlas.road.evidence.inferred",
};

export function roadClassKey(cls: string | null | undefined): MessageKey | null {
  switch (cls) {
    case "trunk": return "soundAtlas.road.class.trunk";
    case "primary": return "soundAtlas.road.class.primary";
    case "secondary": return "soundAtlas.road.class.secondary";
    case "tertiary": return "soundAtlas.road.class.tertiary";
    default: return null;
  }
}

/** 道路貢獻的出處（依 proxyKind）：國道 VD／臺北 VD 典型／OSM 等級 */
export function roadProviderOf(proxyKind: unknown): string {
  return proxyKind === "observed_volume" ? "freeway_vd" : proxyKind === "typical_weekday_volume" ? "vd_typical_taipei" : "osm_road_class";
}

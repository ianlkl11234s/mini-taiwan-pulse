import { Row } from "./shared";
import { useLocale } from "../../state/localeStore";
import { placeName, placeTown } from "../../i18n/placeText";
import { useFeatureTheme } from "./featureTheme";
import {
  LIGHTNING_TYPE_LABELS,
  lightningTypeColor,
} from "../../data/lightningLoader";
import {
  classifyNuclearDose, nuclearDoseColor,
  NUCLEAR_LEVEL_LABELS, NUCLEAR_DOSE_THRESHOLDS,
} from "../../data/nuclearLoader";
import { intensityColor, intensityLabel } from "../../data/earthquakeReplayTypes";
import { mountainRescueCauseColor, mountainRescueCauseLabel } from "../../data/mountainSafetyTypes";
import { FONT_SIZE } from "../../styles/designTokens";
import type { LocaleSnapshot } from "../../state/localeStore";

type I18n = Pick<LocaleSnapshot, "t" | "formatDateTime">;

function fmtAge(ts: unknown, tr: I18n["t"]): string {
  if (typeof ts !== "number" || !Number.isFinite(ts)) return "—";
  const now = Math.floor(Date.now() / 1000);
  const dt = now - ts;
  if (dt < 60) return tr("popup.hazard.secondsAgo", { count: dt });
  if (dt < 3600) return tr("popup.hazard.minutesAgo", { count: Math.floor(dt / 60) });
  if (dt < 86400) return tr("popup.hazard.hoursAgo", { count: Math.floor(dt / 3600) });
  return tr("popup.hazard.daysAgo", { count: Math.floor(dt / 86400) });
}

function fmtTime(ts: unknown, formatDateTime: I18n["formatDateTime"]): string {
  if (typeof ts !== "number" || !Number.isFinite(ts)) return "—";
  const d = new Date(ts * 1000);
  return formatDateTime(d, {
    month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  });
}

/** 發生時間強制以台灣時區顯示（不依賴瀏覽器本地時區） */
function fmtTimeTaipei(ts: unknown, formatDateTime: I18n["formatDateTime"]): string {
  if (typeof ts !== "number" || !Number.isFinite(ts)) return "—";
  return formatDateTime(new Date(ts * 1000), {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
    hour12: false,
  });
}

function magBadgeColor(mag: number): string {
  if (mag >= 7) return "#dc2626";
  if (mag >= 6) return "#ef4444";
  if (mag >= 5) return "#f97316";
  if (mag >= 4) return "#facc15";
  return "#94a3b8";
}

// 與 useEarthquakeLayer 的 COLOR_EXPR 同步（依深度分級）
function depthColor(depth: number): string {
  if (depth <= 30) return "#ff3b30";
  if (depth <= 70) return "#ff9500";
  if (depth <= 150) return "#ffcc00";
  if (depth <= 300) return "#42a5f5";
  return "#3949ab";
}

/**
 * 山域意外事故救援案件 popup。
 * 出動人次分 6 欄（消防在地／消防支援／警察／國家公園／林業／民間），
 * 直升機・搜救犬・無人機是「架次／次數」跟人次分開列，不要加總。
 */
export function MountainRescuePanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const i18n = useLocale();
  const { t: tr } = i18n;
  const cause = props.cause == null ? null : String(props.cause);
  const color = mountainRescueCauseColor(cause);
  const int0 = (v: unknown) => (typeof v === "number" ? v : 0);
  const persons =
    int0(props.fire_local_persons) + int0(props.fire_support_persons) + int0(props.police_persons) +
    int0(props.npark_persons) + int0(props.forestry_persons) + int0(props.civilian_persons);
  const sorties = int0(props.mnd_heli_sorties) + int0(props.nasc_heli_sorties);
  const str = (v: unknown) => (v == null || v === "" ? null : String(v));
  const area = str(props.mountain_area);
  const entry = str(props.entry_point);
  const dest = str(props.destination);
  const deaths = int0(props.deaths);
  const missing = int0(props.missing);
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: 5, background: color, flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>
          {mountainRescueCauseLabel(cause)}
        </div>
      </div>
      <Row label={tr("popup.hazard.caseId")} value={String(props.case_id ?? "—")} />
      <Row label={tr("popup.hazard.year")} value={props.year == null ? "—" : String(props.year)} />
      <Row field="county" value={placeName(String(props.city ?? "—"), i18n)} />
      {area ? <Row label={tr("popup.hazard.mountainArea")} value={area} /> : null}
      {entry ? <Row label={tr("popup.hazard.entryPoint")} value={entry} /> : null}
      {dest ? <Row label={tr("popup.hazard.destination")} value={dest} /> : null}
      <Row label={tr("popup.hazard.reportedAt")} value={String(props.reported_at ?? "—")} />
      <Row label={tr("popup.hazard.closedAt")} value={String(props.closed_at ?? "—")} />
      {props.over_48hr ? <Row label={tr("popup.hazard.over48")} value={String(props.over_48hr)} color={props.over_48hr === "是" ? "#f97316" : undefined} /> : null}
      <Row label={tr("popup.hazard.dispatched")} value={tr("popup.hazard.persons", { count: persons })} />
      {sorties > 0 ? <Row label={tr("popup.hazard.helicopter")} value={tr("popup.hazard.sortiesValue", { count: sorties })} /> : null}
      {int0(props.sar_dog_times) > 0 ? <Row label={tr("popup.hazard.sarDog")} value={tr("popup.hazard.times", { count: int0(props.sar_dog_times) })} /> : null}
      {int0(props.drone_sorties) > 0 ? <Row label={tr("popup.hazard.drone")} value={tr("popup.hazard.sortiesValue", { count: int0(props.drone_sorties) })} /> : null}
      <Row label={tr("popup.hazard.rescued")} value={tr("popup.hazard.persons", { count: int0(props.rescued) })} />
      {deaths > 0 ? <Row field="deaths" value={tr("popup.hazard.persons", { count: deaths })} color="#ff2d2d" /> : null}
      {missing > 0 ? <Row label={tr("popup.hazard.missing")} value={tr("popup.hazard.persons", { count: missing })} color="#f97316" /> : null}
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, marginTop: 4, lineHeight: 1.4 }}>
        {tr("popup.hazard.mountainSource")}
      </div>
    </div>
  );
}

export function LightningStrikePanel({ props }: { props: Record<string, unknown> }) {
  const { t: tr, formatDateTime } = useLocale();
  const t = typeof props.strike_type === "number" ? props.strike_type : null;
  const intensity = typeof props.intensity_ka === "number" ? props.intensity_ka : null;
  const color = lightningTypeColor(t);
  return (
    <div>
      <Row field="type" value={t != null ? (LIGHTNING_TYPE_LABELS[t] ?? "—") : "—"} color={color} />
      <Row
        label={tr("popup.hazard.intensity")}
        value={intensity != null ? `${intensity.toFixed(1)} kA` : "—"}
        color={intensity != null && Math.abs(intensity) > 30 ? "#ef4444" : undefined}
      />
      <Row label={tr("popup.hazard.strikeTime")} value={fmtTime(props.strike_ts, formatDateTime)} />
      <Row field="age" value={fmtAge(props.strike_ts, tr)} />
    </div>
  );
}

export function NuclearStationPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const { t: tr, formatDateTime } = useLocale();
  const dose = typeof props.dose_usvh === "number" ? props.dose_usvh : null;
  const isStale = props.is_stale === true;
  const level = classifyNuclearDose(dose, isStale);
  const color = nuclearDoseColor(dose, isStale);
  return (
    <div>
      <Row field="stationName" value={String(props.station_name ?? "—")} />
      <Row field="stationNo" value={String(props.station_id ?? "—")} />
      <Row
        label={tr("popup.hazard.liveDose")}
        value={dose != null ? `${dose.toFixed(3)} µSv/h` : "—"}
        color={color}
      />
      <Row label={tr("popup.hazard.level")} value={NUCLEAR_LEVEL_LABELS[level]} color={color} />
      <Row field="observedAt" value={fmtTime(props.observed_ts, formatDateTime)} />
      <Row field="age" value={fmtAge(props.observed_ts, tr)} />
      {isStale && (
        <div
          style={{
            marginTop: 8, padding: "6px 8px", borderRadius: 6,
            background: "rgba(107,114,128,0.15)",
            border: `1px solid ${t.border}`,
            fontSize: 11, lineHeight: 1.4, color: t.textDim,
          }}
        >
          {tr("popup.hazard.staleA")}<br />
          <b>{tr("popup.hazard.staleB")}</b>{tr("popup.hazard.staleC")}<b>{tr("popup.hazard.staleD")}</b>{tr("popup.hazard.staleE")}
        </div>
      )}
      {!isStale && level === "alarm" && (
        <div
          style={{
            marginTop: 8, padding: "6px 8px", borderRadius: 6,
            background: "rgba(239,68,68,0.12)",
            border: "1px solid rgba(239,68,68,0.4)",
            fontSize: 11, lineHeight: 1.4, color: "#fca5a5",
          }}
        >
          {tr("popup.hazard.alarmNote", { threshold: NUCLEAR_DOSE_THRESHOLDS.warning })}
        </div>
      )}
    </div>
  );
}

/**
 * 本土地震（CWA earthquake_events，useEarthquakeLayer 的 pre/post 兩態）。
 * ripple 動畫圈不接 click（見 useMapInteraction GIS_LAYERS 註解）。
 */
export function EarthquakePanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const { t: tr, formatDateTime } = useLocale();
  const mag = typeof props.magnitude === "number" ? props.magnitude : null;
  const depth = typeof props.depth_km === "number" ? props.depth_km : null;
  const magColor = mag != null ? magBadgeColor(mag) : t.textDim;
  const dColor = depth != null ? depthColor(depth) : t.textDim;
  return (
    <div>
      <Row label={tr("popup.hazard.magnitudeM")} value={mag != null ? `M ${mag.toFixed(1)}` : "—"} color={magColor} />
      <Row label={tr("popup.hazard.depth")} value={depth != null ? `${depth.toFixed(1)} km` : "—"} color={dColor} />
      <Row field="occurredAt" value={fmtTimeTaipei(props.occurred_ts, formatDateTime)} />
      <Row label={tr("popup.hazard.epicenterLocation")} value={String(props.location_desc || "—")} />
      <Row label={tr("popup.hazard.reportType")} value={String(props.report_type || "—")} />
    </div>
  );
}

/**
 * 地震回放 — 強震測站（earthquake_station_obs）。
 * 震度色階與網格 / 鄉鎮面量圖同源（earthquakeReplayTypes.CWA_INTENSITY_BANDS）。
 */
export function EarthquakeReplayStationPanel({ props }: { props: Record<string, unknown> }) {
  const { t: tr } = useLocale();
  const iv = typeof props.intensity_value === "number" ? props.intensity_value : null;
  const pga = typeof props.pga_int === "number" ? props.pga_int : null;
  const dist = typeof props.epicenter_distance_km === "number" ? props.epicenter_distance_km : null;
  return (
    <div>
      <Row field="station" value={String(props.station_id ?? "—")} />
      <Row
        label={tr("popup.hazard.intensityLevel")}
        value={iv != null ? intensityLabel(iv) : "—"}
        color={iv != null ? intensityColor(iv) : undefined}
      />
      <Row label="PGA" value={pga != null ? `${pga.toFixed(1)} gal` : "—"} />
      <Row label={tr("popup.hazard.epicenterDistance")} value={dist != null ? `${dist.toFixed(1)} km` : "—"} />
      <Row
        label={tr("popup.hazard.sArrival")}
        value={dist != null ? tr("popup.hazard.afterQuake", { seconds: (dist / 3.5).toFixed(1) }) : "—"}
      />
    </div>
  );
}

/**
 * 地震回放 — 鄉鎮震度（earthquake_town_intensity join 鄉鎮 polygon）。
 * 震度值來自 feature-state `eqi`（PMTiles 幾何本身沒有震度屬性）。
 */
export function EarthquakeReplayTownPanel({ props }: { props: Record<string, unknown> }) {
  const i18n = useLocale();
  const { t: tr } = i18n;
  const iv = typeof props.eqi === "number" ? props.eqi : null;
  return (
    <div>
      <Row label={tr("popup.hazard.township")} value={placeTown(String(props.COUNTYNAME ?? ""), String(props.TOWNNAME ?? "—"), i18n)} />
      <Row field="county" value={placeName(String(props.COUNTYNAME ?? "—"), i18n)} />
      <Row
        label={tr("popup.hazard.intensityLevel")}
        value={iv != null ? intensityLabel(iv) : "—"}
        color={iv != null ? intensityColor(iv) : undefined}
      />
      <Row field="source" value={tr("popup.hazard.townSource")} />
    </div>
  );
}

import { Row } from "./shared";
import { RADIUS, FONT_SIZE } from "../../styles/designTokens";
import { useFeatureTheme } from "./featureTheme";
import { useLocale } from "../../state/localeStore";
import { enumLabel } from "../../i18n/dataText";
import { placeName, placeTown } from "../../i18n/placeText";
import type { StaticMessageKey } from "../../i18n/keys";

type PanelProps = { props: Record<string, unknown> };

function Header({ color, name }: { color: string; name: string }) {
  const t = useFeatureTheme();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
      <div style={{ width: 10, height: 10, borderRadius: RADIUS.full, background: color, flexShrink: 0 }} />
      <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5, wordBreak: "break-word" }}>
        {name}
      </div>
    </div>
  );
}

// 座標精度誠實標記共用（同 funeralPanels / welfarePanels 慣例：小字 + ⚠️ 前綴，不做彩色告警框）。
function Note({ children }: { children: React.ReactNode }) {
  const t = useFeatureTheme();
  return (
    <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, marginTop: 4, lineHeight: 1.4 }}>
      {children}
    </div>
  );
}

const POLICE_SUBTYPE_ZH: Record<string, string> = {
  substation: "派出所",
  precinct: "分局",
  police_dept: "警察局",
  specialized: "專業警隊",
  headquarters: "總部",
  security: "保安",
  other: "其他",
};

const CORRECTIONAL_TYPE_ZH: Record<string, string> = {
  prison: "監獄",
  detention: "看守所",
  drug_rehab: "戒治所",
  juvenile_obs: "少年觀護所",
  correction_school: "矯正學校",
};

const COURT_TYPE_ZH: Record<string, string> = {
  supreme: "最高法院",
  high: "高等法院",
  district: "地方法院",
  admin: "行政法院",
  ipc: "智慧財產及商業法院",
  juvenile_family: "少年及家事法院",
};

const PROS_TYPE_ZH: Record<string, string> = {
  supreme: "最高檢察署",
  high: "高等檢察署",
  district: "地方檢察署",
};

const SPEED_CAM_ZH: Record<string, string> = {
  speed_camera_general: "一般測速",
  speed_camera_freeway: "國道測速",
  speed_camera_red_light: "闖紅燈",
  speed_camera_railway_crossing: "鐵路平交道",
};

// ── 警政 ──
export function PoliceStationPanel({ props }: PanelProps) {
  const i18n = useLocale();
  const { t } = i18n;
  const sub = String(props.facility_subtype ?? "");
  return (
    <>
      <Header color="#1e40af" name={String(props.name ?? t("popup.policeJustice.policeDefault"))} />
      <Row field="type" value={POLICE_SUBTYPE_ZH[sub] ? enumLabel("policeSubtype", sub, POLICE_SUBTYPE_ZH[sub], i18n) : sub} />
      <Row field="address" value={String(props.address ?? "")} />
      <Row field="phone" value={String(props.phone ?? "")} />
    </>
  );
}

export function WomenChildWarningPanel({ props }: PanelProps) {
  const { t } = useLocale();
  return (
    <>
      <Header color="#ec4899" name={String(props.name ?? t("popup.policeJustice.womenChildDefault"))} />
      <Row field="address" value={String(props.address ?? "")} />
      <Row label={t("popup.policeJustice.branch")} value={String(props.branch ?? "")} />
      <Row label={t("popup.policeJustice.contact")} value={String(props.contact ?? "")} />
      <Row field="phone" value={String(props.phone ?? "")} />
    </>
  );
}

export function SpeedCameraPanel({ props }: PanelProps) {
  const i18n = useLocale();
  const { t } = i18n;
  const sub = String(props.facility_subtype ?? "");
  return (
    <>
      <Header color="#dc2626" name={SPEED_CAM_ZH[sub] ? enumLabel("speedCamera", sub, SPEED_CAM_ZH[sub], i18n) : t("popup.policeJustice.speedCameraDefault")} />
      <Row field="place" value={String(props.address ?? "")} />
      <Row field="direction" value={String(props.direction ?? "")} />
      <Row label={t("popup.policeJustice.speedLimit")} value={props.limit_kph ? `${props.limit_kph} km/h` : ""} />
      <Row field="county" value={`${String(props.city ?? "")} ${String(props.region ?? "")}`.trim()} />
      <Row label={t("popup.policeJustice.branch")} value={String(props.branch ?? "")} />
    </>
  );
}

export function SpeedZoneSegmentPanel({ props }: PanelProps) {
  const { t } = useLocale();
  return (
    <>
      <Header color="#b91c1c" name={t("popup.policeJustice.speedZoneTitle")} />
      <Row field="location" value={String(props.location ?? "")} />
      <Row label={t("popup.policeJustice.speedLimit")} value={String(props.limit_kph ?? "")} />
      <Row label={t("popup.policeJustice.enforcementItem")} value={String(props.enforcement_item ?? "")} />
      <Row field="county" value={String(props.city ?? "")} />
    </>
  );
}

// ── 司法矯正 ──
export function CourtPanel({ props }: PanelProps) {
  const i18n = useLocale();
  const { t } = i18n;
  const ct = String(props.court_type ?? "");
  return (
    <>
      <Header color="#7c3aed" name={String(props.name ?? t("popup.policeJustice.courtDefault"))} />
      <Row field="type" value={COURT_TYPE_ZH[ct] ? enumLabel("courtType", ct, COURT_TYPE_ZH[ct], i18n) : ct} />
      <Row field="address" value={String(props.address ?? "")} />
      <Row field="phone" value={String(props.phone ?? "")} />
      <Row field="website" value={String(props.url ?? "")} />
    </>
  );
}

export function ProsecutorsOfficePanel({ props }: PanelProps) {
  const i18n = useLocale();
  const { t } = i18n;
  const pt = String(props.pros_type ?? "");
  return (
    <>
      <Header color="#a855f7" name={String(props.name ?? t("popup.policeJustice.prosecutorDefault"))} />
      <Row field="type" value={PROS_TYPE_ZH[pt] ? enumLabel("prosecutorType", pt, PROS_TYPE_ZH[pt], i18n) : pt} />
      <Row field="address" value={String(props.address ?? "")} />
      <Row field="phone" value={String(props.phone ?? "")} />
      <Row field="website" value={String(props.url ?? "")} />
    </>
  );
}

export function CorrectionalFacilityPanel({ props }: PanelProps) {
  const t = useFeatureTheme();
  const i18n = useLocale();
  const ft = String(props.facility_type ?? "");
  return (
    <>
      <Header color="#374151" name={String(props.name ?? i18n.t("popup.policeJustice.correctionalDefault"))} />
      <Row field="type" value={CORRECTIONAL_TYPE_ZH[ft] ? enumLabel("correctionalType", ft, CORRECTIONAL_TYPE_ZH[ft], i18n) : String(props.nature_zh ?? ft)} />
      <Row field="address" value={String(props.address ?? "")} />
      <Row field="phone" value={String(props.phone ?? "")} />
      <Row field="website" value={String(props.url ?? "")} />
      <div style={{ marginTop: 8, fontSize: FONT_SIZE.xs, color: t.textDim, lineHeight: 1.5 }}>
        {i18n.t("popup.policeJustice.correctionalNote")}
      </div>
    </>
  );
}

export function CourtJurisdictionPanel({ props }: PanelProps) {
  const { t } = useLocale();
  return (
    <>
      <Header color="#7c3aed" name={t("popup.policeJustice.jurisdictionTitle", { county: String(props.county ?? "") })} />
      <Row label={t("popup.policeJustice.districtCourt")} value={String(props.district_court ?? "")} />
      <Row label={t("popup.policeJustice.highCourt")} value={String(props.high_court ?? "")} />
      <Row label={t("popup.policeJustice.adminCourt")} value={String(props.admin_court ?? "")} />
      <Row label={t("popup.policeJustice.ipCourt")} value={String(props.ipc_court ?? "")} />
      <Row label={t("popup.policeJustice.juvenileFamilyCourt")} value={String(props.juvenile_family_court ?? "")} />
      <Row label={t("popup.policeJustice.supremeCourt")} value={String(props.supreme_court ?? "")} />
      <Row field="legalBasis" value={String(props.source_law ?? "")} />
    </>
  );
}

// ── 治安態勢 ──
export function CrimeAreaMonthlyPanel({ props }: PanelProps) {
  const t = useFeatureTheme();
  const i18n = useLocale();
  const { t: tr, active } = i18n;
  const byType = (() => {
    try {
      const v = props.by_type;
      if (typeof v === "string") return JSON.parse(v) as Record<string, number>;
      if (v && typeof v === "object") return v as Record<string, number>;
      return {};
    } catch { return {}; }
  })();
  const byYear = (() => {
    try {
      const v = props.by_year;
      if (typeof v === "string") return JSON.parse(v) as Record<string, number>;
      if (v && typeof v === "object") return v as Record<string, number>;
      return {};
    } catch { return {}; }
  })();
  const topTypes = Object.entries(byType)
    .sort(([, a], [, b]) => Number(b) - Number(a))
    .slice(0, 5);
  const years = Object.keys(byYear).map(Number).filter(Number.isFinite).sort();
  // 年份是民國年；外文介面改西元（+1911）
  const yrOffset = active === "zh-TW" ? 0 : 1911;
  const yrLabel = years.length > 0
    ? tr("popup.policeJustice.crimeYears", { from: years[0]! + yrOffset, to: years[years.length - 1]! + yrOffset, count: years.length })
    : "";
  return (
    <>
      <Header color="#991b1b" name={`${placeName(String(props.county ?? ""), i18n)} ${placeTown(String(props.county ?? ""), String(props.town ?? ""), i18n)}`} />
      <div style={{ display: "inline-block", padding: "1px 6px", borderRadius: 4, background: "#7f1d1d", color: "#fff", fontSize: FONT_SIZE.xs, marginBottom: 6 }}>
        {yrLabel || tr("popup.policeJustice.crimeYearsDefault")}
      </div>
      <Row label={tr("popup.policeJustice.totalEvents")} value={String(props.total_events ?? "0")} />
      {topTypes.length > 0 && (
        <div style={{ marginTop: 6 }}>
          <div style={{ color: t.textMuted, fontSize: FONT_SIZE.sm, marginBottom: 2 }}>{tr("popup.policeJustice.topTypes")}</div>
          {topTypes.map(([k, v]) => <Row key={k} label={k} value={String(v)} />)}
        </div>
      )}
      <div style={{ marginTop: 8, fontSize: FONT_SIZE.xs, color: t.textDim }}>
        {tr("popup.policeJustice.crimeSource")}<br />
        {tr("popup.policeJustice.cumulativeWarn")}
      </div>
    </>
  );
}

export function TheftTaoyuanPanel({ props }: PanelProps) {
  const { t } = useLocale();
  return (
    <>
      <Header color="#f59e0b" name={String(props.case_type ?? t("popup.policeJustice.theftDefault"))} />
      <div style={{ display: "inline-block", padding: "1px 6px", borderRadius: 4, background: "#92400e", color: "#fff", fontSize: FONT_SIZE.xs, marginBottom: 6 }}>
        {t("popup.policeJustice.theftRange")}
      </div>
      <Row label={t("popup.policeJustice.year")} value={String(props.year ?? "")} />
      <Row field="date" value={String(props.date ?? "")} />
      <Row field="district" value={String(props.district ?? "")} />
    </>
  );
}

export function TrafficAccidentYearlyPanel({ props }: PanelProps) {
  const { t } = useLocale();
  return (
    <>
      <Header color="#fb7185" name={t("popup.policeJustice.a1Title")} />
      <div style={{ display: "inline-block", padding: "1px 6px", borderRadius: 4, background: "#9f1239", color: "#fff", fontSize: FONT_SIZE.xs, marginBottom: 6 }}>
        {t("popup.policeJustice.yearlyBadge")}
      </div>
      <Row field="time" value={`${String(props.date ?? "")} ${String(props.time ?? "")}`.trim()} />
      <Row field="place" value={String(props.location ?? "")} />
      <Row label={t("popup.policeJustice.agency")} value={String(props.agency ?? "")} />
      <Row label={t("popup.policeJustice.weather")} value={String(props.weather ?? "")} />
      <Row label={t("popup.policeJustice.lighting")} value={String(props.light ?? "")} />
      <Row label={t("popup.policeJustice.roadType")} value={String(props.road_type ?? "")} />
      <Row field="speedLimit" value={props.speed_limit ? `${props.speed_limit} km/h` : ""} />
    </>
  );
}

export function AccidentTaipeiPanel({ props }: PanelProps) {
  const { t } = useLocale();
  const cls = String(props.case_class ?? "");
  return (
    <>
      <Header color={cls === "1" ? "#dc2626" : "#fda4af"} name={cls === "1" ? t("popup.policeJustice.a1Title") : t("popup.policeJustice.a2Title")} />
      <div style={{ display: "inline-block", padding: "1px 6px", borderRadius: 4, background: "#9f1239", color: "#fff", fontSize: FONT_SIZE.xs, marginBottom: 6 }}>
        {t("popup.policeJustice.taipeiBadge")}
      </div>
      <Row field="time" value={String(props.occurred_at ?? "")} />
      <Row field="place" value={String(props.location ?? "")} />
    </>
  );
}

export function A1AccidentRealtimePanel({ props }: PanelProps) {
  const t = useFeatureTheme();
  const { t: tr } = useLocale();
  const ageH = Number(props.age_hours ?? 0);
  const ageLabel = ageH < 1 ? tr("popup.policeJustice.ageMinutes", { value: Math.round(ageH * 60) })
    : ageH < 24 ? tr("popup.policeJustice.ageHoursToday", { value: ageH.toFixed(1) })
    : ageH < 168 ? tr("popup.policeJustice.ageDaysWeek", { value: (ageH / 24).toFixed(1) })
    : tr("popup.policeJustice.ageDays", { value: (ageH / 24).toFixed(0) });
  const ageColor = ageH < 24 ? "#ef4444" : ageH < 168 ? "#dc2626" : "#7f1d1d";
  return (
    <>
      <Header color={ageColor} name={tr("popup.policeJustice.a1Title")} />
      <div style={{ display: "inline-block", padding: "1px 6px", borderRadius: 4, background: ageColor, color: "#fff", fontSize: FONT_SIZE.xs, fontWeight: 600, marginBottom: 6 }}>
        {ageLabel}
      </div>
      <Row field="occurredAt" value={String(props.occurred_at ?? "")} />
      <Row field="place" value={String(props.location ?? "")} />
      <Row label={tr("popup.policeJustice.agency")} value={String(props.agency ?? "")} />
      <Row label={tr("popup.policeJustice.weather")} value={String(props.weather ?? "")} />
      <Row label={tr("popup.policeJustice.roadType")} value={String(props.road_type ?? "")} />
      <Row label={tr("popup.policeJustice.causeMajor")} value={String(props.cause_main_major ?? "")} />
      <Row label={tr("popup.policeJustice.causeSub")} value={String(props.cause_main_sub ?? "")} />
      <Row label={tr("popup.policeJustice.casualties")} value={String(props.death_injury ?? "")} />
      <div style={{ marginTop: 8, fontSize: FONT_SIZE.xs, color: t.textDim, lineHeight: 1.5 }}>
        {tr("popup.policeJustice.a1Source")}<br />
        {tr("popup.policeJustice.a1Rolling")}
      </div>
    </>
  );
}

// ── 廉政移民海巡 ──
export function InvestigationBureauPanel({ props }: PanelProps) {
  const { t } = useLocale();
  return (
    <>
      <Header color="#0f766e" name={String(props.name ?? t("popup.policeJustice.investigationDefault"))} />
      <Row field="address" value={String(props.address ?? "")} />
      <Row field="phone" value={String(props.phone ?? "")} />
    </>
  );
}

export function AntiCorruptionOfficePanel({ props }: PanelProps) {
  const i18n = useLocale();
  const { t } = i18n;
  const level = String(props.level ?? "");
  return (
    <>
      <Header color="#14b8a6" name={String(props.name ?? t("popup.policeJustice.anticorruptionDefault"))} />
      <Row field="tier" value={level === "central" ? enumLabel("anticorruptionLevel", level, "中央", i18n) : level === "local" ? enumLabel("anticorruptionLevel", level, "地方", i18n) : level} />
      <Row field="address" value={String(props.address ?? "")} />
      <Row label={t("popup.policeJustice.reportPhone")} value={String(props.phone1 ?? props.phone ?? "")} />
      <Row label={t("popup.policeJustice.reportHotline")} value={String(props.phone2 ?? "")} />
      <Row label={t("popup.policeJustice.email")} value={String(props.email ?? "")} />
    </>
  );
}

export function ImmigrationOfficePanel({ props }: PanelProps) {
  const t = useFeatureTheme();
  const { t: tr } = useLocale();
  return (
    <>
      <Header color="#0ea5e9" name={String(props.name ?? tr("popup.policeJustice.immigrationDefault"))} />
      <Row field="englishName" value={String(props.name_en ?? "")} />
      <Row field="address" value={String(props.address ?? "")} />
      <Row field="phone" value={String(props.phone ?? "")} />
      <Row label={tr("popup.policeJustice.fax")} value={String(props.fax ?? "")} />
      <Row field="website" value={String(props.url ?? "")} />
      <div style={{ marginTop: 8, fontSize: FONT_SIZE.xs, color: t.textDim }}>
        {tr("popup.policeJustice.immigrationSource")}
      </div>
    </>
  );
}

export function CoastGuardStationPanel({ props }: PanelProps) {
  const i18n = useLocale();
  const { t } = i18n;
  const sub = String(props.facility_subtype ?? "");
  return (
    <>
      <Header color="#0284c7" name={String(props.name ?? t("popup.policeJustice.coastGuardDefault"))} />
      <Row field="type" value={sub === "patrol_station" ? enumLabel("coastGuardType", sub, "巡防隊", i18n) : sub === "ocean_pier" ? enumLabel("coastGuardType", sub, "漁港", i18n) : sub} />
      <Row label={t("popup.policeJustice.affiliation")} value={String(props.area ?? "")} />
      <Row field="address" value={String(props.address ?? "")} />
    </>
  );
}

// ── 警察覆蓋分析 isochrone（共用 panel） ──
function IsochronePanel({ props, titleKey, color }: PanelProps & { titleKey: StaticMessageKey; color: string }) {
  const t = useFeatureTheme();
  const { t: tr } = useLocale();
  const cnt = Number(props.overlap_count ?? 0);
  const tier = String(props.tier ?? "");
  const mode = String(props.mode ?? "");
  const mins = String(props.minutes ?? "");
  const lvl = tr(
    cnt >= 20 ? "popup.policeJustice.overlapExtreme"
      : cnt >= 12 ? "popup.policeJustice.overlapHigh"
      : cnt >= 5 ? "popup.policeJustice.overlapMid"
      : cnt >= 2 ? "popup.policeJustice.overlapDouble"
      : "popup.policeJustice.overlapSingle",
  );
  const tierLabel = tr(tier === "substation" ? "popup.policeJustice.tierSubstation" : tier === "precinct" ? "popup.policeJustice.tierPrecinct" : "popup.policeJustice.tierCityDept");
  const modeShort = tr(mode === "walk" ? "popup.policeJustice.modeWalk" : "popup.policeJustice.modeDrive");
  return (
    <>
      <Header color={color} name={tr(titleKey)} />
      <div style={{ display: "inline-block", padding: "1px 8px", borderRadius: 4, background: color, color: "#fff", fontSize: FONT_SIZE.sm, fontWeight: 700, marginBottom: 8 }}>
        {tr("popup.policeJustice.coverageCount", { count: cnt, level: lvl })}
      </div>
      <Row field="tier" value={tierLabel} />
      <Row label={tr("popup.policeJustice.mode")} value={mode === "walk" ? tr("popup.policeJustice.modeWalk") : mode === "drive" ? tr("popup.policeJustice.modeDrive") : mode} />
      <Row field="time" value={tr("popup.policeJustice.minutesValue", { value: mins })} />
      <div style={{ marginTop: 8, fontSize: FONT_SIZE.xs, color: t.textDim, lineHeight: 1.5 }}>
        {tr("popup.policeJustice.overlapNote", { count: cnt, tier: tierLabel, minutes: mins, mode: modeShort })}
      </div>
    </>
  );
}
export function PoliceIsoSubstationPanel({ props }: PanelProps) {
  return <IsochronePanel props={props} titleKey="popup.policeJustice.isoSubstation" color="#1e40af" />;
}
export function PoliceIsoPrecinctPanel({ props }: PanelProps) {
  return <IsochronePanel props={props} titleKey="popup.policeJustice.isoPrecinct" color="#3b82f6" />;
}
export function PoliceIsoCityDeptPanel({ props }: PanelProps) {
  return <IsochronePanel props={props} titleKey="popup.policeJustice.isoCityDept" color="#60a5fa" />;
}

// ── 航空：航空器空域 eAIP ──
const AIRSPACE_LAYER_COLOR: Record<string, string> = {
  FIR: "#6495ED", TMA: "#4682B4",
  CTR: "#1E90FF", CONTROL: "#1E90FF", SURFACE: "#1E90FF",
  RCR: "#DC3545", DANGER: "#FF5722",
  ULZ: "#FFC107", CIRCUIT: "#4CAF50",
};
const AIRSPACE_LAYER_ZH: Record<string, string> = {
  FIR: "飛航情報區", TMA: "終端管制區", CTR: "機場管制空域",
  CONTROL: "一般管制空域", SURFACE: "機場地面層",
  RCR: "限航區", DANGER: "危險區", ULZ: "超輕型活動區", CIRCUIT: "起降航線",
};
function fmtAlt(m: unknown, raw: unknown, i18n: ReturnType<typeof useLocale>): string {
  if (raw && String(raw).trim()) return String(raw);
  const v = Number(m);
  if (!Number.isFinite(v)) return "";
  if (v >= 99999) return i18n.t("popup.policeJustice.altUnlimited");
  if (v <= 0) return i18n.t("popup.policeJustice.altSurface");
  return `${i18n.formatNumber(v)} m`;
}
export function AviationAirspacePanel({ props }: PanelProps) {
  const i18n = useLocale();
  const { t } = i18n;
  const layer = String(props.layer ?? "");
  const color = AIRSPACE_LAYER_COLOR[layer] ?? "#94a3b8";
  const layerZh = AIRSPACE_LAYER_ZH[layer] ? enumLabel("airspaceLayer", layer, AIRSPACE_LAYER_ZH[layer], i18n) : layer;
  const name = String(props.name_zh ?? props.name_en ?? props.code ?? t("popup.policeJustice.airspaceDefault"));
  return (
    <>
      <Header color={color} name={name} />
      <Row field="category" value={layer ? t("popup.policeJustice.layerWithName", { layer, name: layerZh }) : ""} />
      <Row field="code" value={String(props.code ?? "")} />
      <Row label={t("popup.policeJustice.floor")} value={fmtAlt(props.floor_m, props.floor_raw, i18n)} />
      <Row label={t("popup.policeJustice.ceiling")} value={fmtAlt(props.ceiling_m, props.ceiling_raw, i18n)} />
      <Row label={t("popup.policeJustice.airspaceClass")} value={String(props.airspace_class ?? "")} />
      <Row field="remarks" value={String(props.remarks ?? "")} />
    </>
  );
}

// ── 航空：無人機禁航區 ──
const DRONE_COLOR: Record<string, string> = {
  "紅區": "#DC3545",
  "黃區": "#FFC107",
};
export function DroneZonesPanel({ props }: PanelProps) {
  const i18n = useLocale();
  const { t } = i18n;
  const zoneColor = String(props["空域顏色"] ?? t("popup.common.unclassified"));
  const headerColor = DRONE_COLOR[zoneColor] ?? "#6C757D";
  return (
    <>
      <Header color={headerColor} name={String(props["空域名稱"] ?? t("popup.policeJustice.droneDefault"))} />
      <Row label={t("popup.policeJustice.droneColor")} value={DRONE_COLOR[zoneColor] ? enumLabel("droneZoneColor", zoneColor, zoneColor, i18n) : zoneColor} />
      <Row label={t("popup.policeJustice.droneCategory")} value={String(props["空域類別"] ?? "")} />
      <Row field="authority" value={String(props["主管機關名稱"] ?? "")} />
      <Row label={t("popup.policeJustice.penalty")} value={String(props["罰則"] ?? "")} />
      <Row label={t("popup.policeJustice.contactInfo")} value={String(props["聯絡方式"] ?? "")} />
      <Row field="description" value={String(props["空域說明"] ?? "")} />
      <Row field="county" value={String(props.countyname ?? "")} />
      <Note>{t("popup.policeJustice.droneNote")}</Note>
    </>
  );
}

// ── 民防 ──
/**
 * 座標精度誠實標記（2026-08-24 併入 TGOS 內政主題 API、62,695→110,291 筆後新增）。
 * ⚠️ 上游整條路段的不同門牌常共用同一 fallback 座標（實測最誇張一組 274 筆／148 個
 *    相異門牌落在同一點）——非 exact 或 suspect 一律明講，避免使用者拿去導航被誤導。
 *    coord_shared_n 只在 GeoJSON 有、未進 PMTiles，故不在此顯示。
 */
function ShelterCoordNote({ props }: PanelProps) {
  const { t } = useLocale();
  const precision = String(props.coord_precision ?? "");
  const suspect = props.coord_suspect === true;
  return (
    <>
      {suspect && <Note>{t("popup.policeJustice.shelterSuspect")}</Note>}
      {precision === "approximate" && (
        <Note>{t("popup.policeJustice.shelterApprox")}</Note>
      )}
      {precision === "street_block" && <Note>{t("popup.policeJustice.shelterBlock")}</Note>}
    </>
  );
}

export function CivilDefenseShelterPanel({ props }: PanelProps) {
  const { t } = useLocale();
  return (
    <>
      <Header color="#64748b" name={String(props.name ?? t("popup.policeJustice.shelterDefault"))} />
      <Row field="type" value={String(props.subtype ?? "")} />
      <Row field="address" value={String(props.address ?? "")} />
      <Row field="capacity" value={props.capacity ? t("popup.policeJustice.capacityPeople", { value: String(props.capacity) }) : ""} />
      <Row field="district" value={String(props.district ?? "")} />
      <ShelterCoordNote props={props} />
    </>
  );
}

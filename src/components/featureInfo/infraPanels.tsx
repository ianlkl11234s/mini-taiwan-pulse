import { useEffect, useState } from "react";
import { CctvStreamView } from "../CctvStreamView";
import { Row, SourceFooter } from "./shared";
import { useLocale, type LocaleSnapshot } from "../../state/localeStore";
import { enumLabel } from "../../i18n/dataText";
import { RADIUS, FONT_SIZE } from "../../styles/designTokens";
import { useFeatureTheme } from "./featureTheme";
import { TimeseriesSparkline, type SparklinePoint } from "../TimeseriesSparkline";
import { fetchAirportHourlyPax } from "../../data/airportPaxLoader";
import { ixpRegionColor, anfrOperatorColor, ripeAtlasNodeColor } from "../../data/telecomTypes";
import { OOKLA_GRID_META } from "../../data/telecomTypes";
import { portClassColor } from "../../data/transportHubTypes";

/** 超商品牌對應色 */
const BRAND_COLORS: Record<string, string> = {
  "7-ELEVEN": "#00843D",
  "全家": "#00843D",
  "FamilyMart": "#00843D",
  "萊爾富": "#E31937",
  "Hi-Life": "#E31937",
  "OK": "#FF8C00",
  "OKmart": "#FF8C00",
};

/** 機關便民據點 type → 中文 label + 色 */
const GOV_OFFICE_TYPE: Record<string, { color: string; label: string }> = {
  district_office: { color: "#8d6e63", label: "公所" },
  household_registration: { color: "#7986cb", label: "戶政事務所" },
  land_office: { color: "#9ccc65", label: "地政事務所" },
};

/** 公廁清潔評鑑等級 → 色（缺值 fallback 灰）*/
const TOILET_GRADE_COLOR: Record<string, string> = {
  特優級: "#7e57c2",
  優等級: "#ab47bc",
  普通級: "#ffb300",
  不合格: "#e53935",
};

/** CCTV source 對應色 / 標籤 */
const CCTV_SOURCE: Record<string, { color: string; label: string }> = {
  freeway: { color: "#ff9800", label: "國道" },
  highway: { color: "#ffd54f", label: "省道快速道路" },
  city:    { color: "#26c6da", label: "市區道路" },
};

export function SubmarineCablePanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const i18n = useLocale();
  const { t: tr } = i18n;
  const accentColor = "#26c6da";

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.sm, background: accentColor, flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>
          {String(props.name ?? "Unknown Cable")}
        </div>
      </div>
      <Row field="dataRole" value={tr("popup.infra.cableRole")} color={accentColor} />
      <Row field="status" value={String(props.status ?? "")} />
      <Row field="operator" value={String(props.operator ?? "")} />
      <Row label={tr("popup.infra.owner")} value={String(props.owner ?? "")} />
      <Row label={tr("popup.infra.osmIdent")} value={`${String(props.osm_type ?? "")}/${String(props.osm_id ?? "")}`} />
      <Row label={tr("popup.infra.lineQuality")} value={String(props.geometry_source ?? "")} />
      <Row field="coverageLimit" value={tr("popup.infra.cableCoverage")} />
      <Row field="license" value={`${String(props.license ?? "ODbL 1.0")} · ${String(props.attribution ?? "© OpenStreetMap contributors")}`} />
    </>
  );
}

export function LandingStationPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const i18n = useLocale();
  const { t: tr } = i18n;
  const accentColor = "#ffb74d";

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.full, background: accentColor, flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>
          {String(props.name ?? "Unknown Station")}
        </div>
      </div>
      <Row field="dataRole" value={tr("popup.infra.landingRole")} color={accentColor} />
      <Row field="operator" value={String(props.operator ?? "")} />
      <Row label={tr("popup.infra.owner")} value={String(props.owner ?? "")} />
      <Row field="status" value={String(props.status ?? "")} />
      <Row label={tr("popup.infra.cableCount")} value={String(props.cable_count ?? "")} />
      <Row label={tr("popup.infra.cableNames")} value={String(props.cable_names ?? "")} />
      <Row label={tr("popup.infra.osmIdent")} value={`${String(props.osm_type ?? "")}/${String(props.osm_id ?? "")}`} />
      <Row field="coverageLimit" value={tr("popup.infra.landingCoverage")} />
      <Row field="license" value={`${String(props.license ?? "ODbL 1.0")} · ${String(props.attribution ?? "© OpenStreetMap contributors")}`} />
    </>
  );
}

export function InternetExchangePointPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const i18n = useLocale();
  const { t: tr } = i18n;
  const region = String(props.region ?? "");
  const accentColor = ixpRegionColor(region);
  const participants = String(props.participants ?? "");
  const updated = String(props.updated ?? "");

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.full, background: accentColor, flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>
          {String(props.name ?? "Unknown IXP")}
        </div>
      </div>
      <Row label={tr("popup.infra.ixpCityCountry")} value={[props.city, props.country].filter(Boolean).map(String).join(" · ")} />
      <Row label={tr("popup.infra.ixpContinent")} value={region} color={accentColor} />
      <Row label={tr("popup.infra.ixpParticipants")} value={participants ? tr("popup.infra.ixpParticipantsValue", { count: participants }) : ""} />
      <Row field="status" value={String(props.status ?? "")} />
      <Row label={tr("popup.infra.dataUpdated")} value={updated && updated !== "0000-00-00" ? updated : tr("popup.common.notProvided")} />
      <Row label={tr("popup.infra.coordQa")} value={String(props.coord_qc_status ?? "")} />
      <Row field="sourceLicense" value={`${String(props.source_org ?? "PCH")} · ${String(props.license ?? "")}`} />
    </>
  );
}

export function AnfrWirelessSitePanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const i18n = useLocale();
  const { t: tr } = i18n;
  const operators = Array.isArray(props.operators) ? props.operators.map(String) : [];
  const primary = operators[0] ?? "other";
  return <>
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
      <div style={{ width: 10, height: 10, borderRadius: RADIUS.full, background: anfrOperatorColor(primary) }} />
      <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong }}>{tr("popup.infra.anfrTitle")}</div>
    </div>
    <Row label="SUP ID" value={String(props.sup_id ?? "")} />
    <Row label={tr("popup.infra.anfrOperator")} value={operators.join(" · ")} color={anfrOperatorColor(primary)} />
    <Row label={tr("popup.infra.anfrTechSystem")} value={`${String((props.technologies as string[] | undefined)?.join(" · ") ?? "")} · ${String((props.systems as string[] | undefined)?.join(" · ") ?? "")}`} />
    <Row field="status" value={String((props.statuses as string[] | undefined)?.join(" · ") ?? "")} />
    <Row label={tr("popup.infra.recordCount")} value={String(props.record_count ?? "")} />
    <Row field="source" value={tr("popup.infra.anfrSource")} />
    <Row field="license" value={String(props.license ?? "Licence Ouverte 2.0")} />
  </>;
}

export function OsmCommunicationSitePanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const i18n = useLocale();
  const { t: tr } = i18n;
  const rawKinds = props.communication_types;
  let kinds: string[];
  if (Array.isArray(rawKinds)) {
    kinds = rawKinds.map(String);
  } else {
    const value = String(rawKinds ?? "");
    try {
      const parsed = JSON.parse(value);
      kinds = Array.isArray(parsed) ? parsed.map(String) : [value];
    } catch {
      kinds = value.split(";").map((item) => item.trim()).filter(Boolean);
    }
  }
  return <>
    <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, marginBottom: 6 }}>
      {tr("popup.infra.osmCommTitle")}
    </div>
    <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, marginBottom: 6 }}>
      {tr("popup.infra.osmCommSubtitle")}
    </div>
    <Row field="osmId" value={`${String(props.osm_type ?? "")}/${String(props.osm_id ?? "")}`} />
    <Row label={tr("popup.infra.osmCommNameOperator")} value={[props.name, props.operator].filter(Boolean).map(String).join(" · ")} />
    <Row label={tr("popup.infra.osmCommTypes")} value={kinds.join(" · ")} />
    <Row label={tr("popup.infra.osmCommSiteKind")} value={`${String(props.site_kind ?? "general")} · ${String(props.relevance ?? "")}`} />
    <Row label={tr("popup.infra.osmCommRegion")} value={String(props.query_region ?? "")} />
    <Row label={tr("popup.infra.osmCommHeightRef")} value={[props.height, props.ref].filter(Boolean).map(String).join(" · ")} />
    <Row field="sourceLicense" value={`OpenStreetMap · ${String(props.license ?? "ODbL")}`} />
    <Row label={tr("popup.infra.fetchedTime")} value={String(props.fetched_at ?? "")} />
  </>;
}

export function RipeAtlasProbePanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const i18n = useLocale();
  const { t: tr } = i18n;
  const isAnchor = props.is_anchor === true || props.is_anchor === 1 || props.is_anchor === "true" || props.is_anchor === "1";
  return <>
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
      <div style={{ width: 10, height: 10, borderRadius: RADIUS.full, background: ripeAtlasNodeColor(props.is_anchor) }} />
      <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong }}>{tr("popup.infra.ripeTitle")}</div>
    </div>
    <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, marginBottom: 6 }}>{tr("popup.infra.ripeSubtitle")}</div>
    <Row label={tr("popup.infra.ripeProbeCountry")} value={[props.probe_id, props.country_code, props.country_name].filter(Boolean).map(String).join(" · ")} />
    <Row label={tr("popup.infra.ripeTypeStatus")} value={`${isAnchor ? "Anchor" : "Probe"} · ${String(props.status_name ?? props.status_id ?? "")}`} color={ripeAtlasNodeColor(props.is_anchor)} />
    <Row label={tr("popup.infra.ripeConnected")} value={[props.last_connected, props.status_since].filter(Boolean).map(String).join(" · ")} />
    <Row label="Uptime" value={String(props.total_uptime ?? "")} />
    <Row label={tr("popup.infra.ripeCoordQuality")} value={`${String(props.coord_qc_status ?? "obfuscated")} · ${String(props.location_obfuscation_m ?? "80–400")}m`} />
    <Row label={tr("popup.infra.ripeUse")} value={tr("popup.infra.ripeUseValue")} />
    <Row field="sourceLicense" value="RIPE NCC · © RIPE NCC" />
  </>;
}

function formatOoklaMbps(value: unknown, tr: LocaleSnapshot["t"]): string {
  const kbps = Number(value);
  if (!Number.isFinite(kbps)) return tr("popup.common.notProvided");
  return `${(kbps / 1000).toFixed(kbps >= 100_000 ? 0 : 1)} Mbps`;
}

function formatOoklaLatency(value: unknown, tr: LocaleSnapshot["t"]): string {
  const latency = Number(value);
  return Number.isFinite(latency) ? `${latency.toFixed(1)} ms` : tr("popup.common.notProvided");
}

/**
 * 格級描述 —— `--slim` 產物不再逐格帶 coarse_zoom：
 *   全球層有 `z`（6／10）、台灣 z14 層有 tile_count、z16 原生層兩者皆無。
 */
function ooklaGridScale(props: Record<string, unknown>, tr: LocaleSnapshot["t"]): string {
  const z = Number(props.z);
  if (z === 6) return tr("popup.infra.ooklaScaleZ6");
  if (z === 10) return tr("popup.infra.ooklaScaleZ10");
  const tiles = props.tile_count;
  if (tiles === undefined || tiles === null) return tr("popup.infra.ooklaScaleZ16");
  return tr("popup.infra.ooklaScaleZ14", { count: String(tiles) });
}

function OoklaGridPanel({ props, service }: { props: Record<string, unknown>; service: string }) {
  const t = useFeatureTheme();
  const i18n = useLocale();
  const { t: tr } = i18n;
  const tests = Number(props.tests);
  const thin = Number.isFinite(tests) && tests < 10;
  return <>
    <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, marginBottom: 6 }}>
      {tr("popup.infra.ooklaTitle")}
    </div>
    <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, marginBottom: 6 }}>
      {tr("popup.infra.ooklaSubtitle", { service })}
    </div>
    <Row label={tr("popup.infra.ooklaDownUp")} value={`${formatOoklaMbps(props.avg_d_kbps, tr)} · ${formatOoklaMbps(props.avg_u_kbps, tr)}`} />
    <Row label={tr("popup.infra.ooklaLatency")} value={formatOoklaLatency(props.avg_lat_ms, tr)} />
    <Row
      label={tr("popup.infra.ooklaTestsDevices")}
      value={`${tr("popup.infra.ooklaDevicesLine", {
        tests: String(props.tests ?? tr("popup.common.notProvided")),
        devices: String(props.devices ?? tr("popup.common.notProvided")),
        method: OOKLA_GRID_META.devicesMethod,
      })}${thin ? ` ${tr("popup.infra.ooklaLowSample")}` : ""}`}
    />
    <Row label={tr("popup.infra.ooklaGridLevel")} value={ooklaGridScale(props, tr)} />
    <Row label={tr("popup.infra.ooklaPeriod")} value={OOKLA_GRID_META.period} />
    <Row field="limits" value={OOKLA_GRID_META.coverageCaveat} />
    <Row label={tr("popup.infra.ooklaSampleBias")} value={OOKLA_GRID_META.sampleBias} />
    <Row field="sourceLicense" value={OOKLA_GRID_META.attribution} />
  </>;
}

export function OoklaMobileGridPanel({ props }: { props: Record<string, unknown> }) {
  const { t: tr } = useLocale();
  return <OoklaGridPanel props={props} service={tr("popup.infra.ooklaMobile")} />;
}

export function OoklaFixedGridPanel({ props }: { props: Record<string, unknown> }) {
  const { t: tr } = useLocale();
  return <OoklaGridPanel props={props} service={tr("popup.infra.ooklaFixed")} />;
}

export function ConvenienceStorePanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const brand = String(props.brand ?? "");
  const accentColor = BRAND_COLORS[brand] ?? "#26c6da";

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.sm, background: accentColor, flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>
          {String(props.name ?? "Unknown Store")}
        </div>
      </div>
      <Row field="brand" value={brand} color={accentColor} />
      <Row field="address" value={String(props.addr ?? props.address ?? "")} />
    </>
  );
}

export function PostOfficePanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const i18n = useLocale();
  const { t: tr } = i18n;
  const accentColor = "#d32f2f";
  const flag = (v: unknown) => (v === true || v === "true" || v === 1 ? "✓" : "✗");
  const city = String(props.city ?? "");
  const district = String(props.district ?? "");
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.full, background: accentColor, flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>
          {String(props.name ?? "Unknown Post Office")}
        </div>
      </div>
      <Row field="address" value={String(props.address ?? "")} />
      <Row field="phone" value={String(props.phone ?? "")} />
      <Row field="countyDistrict" value={[city, district].filter(Boolean).join(" ")} />
      <Row label={tr("popup.infra.weekdayService")} value={flag(props.weekday_service)} color={accentColor} />
      <Row label={tr("popup.infra.weekdayExtended")} value={flag(props.weekday_extended_service)} />
      <Row label={tr("popup.infra.saturdayService")} value={flag(props.saturday_service)} />
      <Row label={tr("popup.infra.sundayService")} value={flag(props.sunday_service)} />
    </>
  );
}

export function IPostBoxPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const i18n = useLocale();
  const { t: tr } = i18n;
  const accentColor = "#ef6c00";
  const lockerCount = props.locker_count != null ? String(props.locker_count) : "";
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.full, background: accentColor, flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>
          {String(props.name ?? "Unknown iPost Box")}
        </div>
      </div>
      <Row field="address" value={String(props.address ?? "")} />
      <Row label={tr("popup.infra.relativeLocation")} value={String(props.relative_location ?? "")} />
      <Row field="businessHours" value={String(props.business_hours ?? "")} color={accentColor} />
      <Row label={tr("popup.infra.lockers")} value={lockerCount ? tr("popup.infra.lockerCount", { count: Number(lockerCount) || 0 }) : ""} />
      <Row label={tr("popup.infra.cabinetType")} value={String(props.cabinet_type ?? "")} />
    </>
  );
}

export function CommunityCenterPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const accentColor = "#26a69a";
  const county = String(props.county ?? "");
  const town = String(props.town ?? "");
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.full, background: accentColor, flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>
          {String(props.name ?? "Unknown Community Center")}
        </div>
      </div>
      <Row field="district" value={[county, town].filter(Boolean).join(" ")} color={accentColor} />
      <Row field="address" value={String(props.address ?? "")} />
    </>
  );
}

export function GovServiceOfficePanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const i18n = useLocale();
  const { t: tr } = i18n;
  const type = String(props.type ?? "");
  const info = GOV_OFFICE_TYPE[type] ?? { color: "#8d6e63", label: type };
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.sm, background: info.color, flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>
          {String(props.name ?? "Unknown Office")}
        </div>
      </div>
      <Row field="type" value={enumLabel("infraGovOffice", type, info.label, i18n)} color={info.color} />
      <Row field="county" value={String(props.county ?? "")} />
      <Row label={tr("popup.infra.jurisdiction")} value={String(props.jurisdiction ?? "")} />
    </>
  );
}

export function PublicLibraryPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const accentColor = "#5c6bc0";
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.full, background: accentColor, flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>
          {String(props.name ?? "Unknown Library")}
        </div>
      </div>
      <Row field="county" value={String(props.county ?? "")} color={accentColor} />
      <Row field="type" value={String(props.type ?? "")} />
    </>
  );
}

export function WelfareCenterPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const i18n = useLocale();
  const { t: tr } = i18n;
  const accentColor = "#ec407a";
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.full, background: accentColor, flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>
          {String(props.name ?? "Unknown Welfare Center")}
        </div>
      </div>
      <Row field="county" value={String(props.county ?? "")} color={accentColor} />
      <Row label={tr("popup.infra.serviceArea")} value={String(props.service_area ?? "")} />
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, marginTop: 6 }}>
        {tr("popup.infra.welfareVintage")}
      </div>
    </>
  );
}

export function RetailMarketPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const accentColor = "#66bb6a";
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.full, background: accentColor, flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>
          {String(props.name ?? "Unknown Market")}
        </div>
      </div>
      <Row field="county" value={String(props.county ?? "")} color={accentColor} />
      <Row field="businessHours" value={String(props.business_hours ?? "")} />
    </>
  );
}

export function PublicToiletPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const i18n = useLocale();
  const { t: tr } = i18n;
  const grade = String(props.grade ?? "");
  const gradeColor = TOILET_GRADE_COLOR[grade] ?? "#9e9e9e";
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.full, background: gradeColor, flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>
          {String(props.name ?? tr("popup.infra.unnamedToilet"))}
        </div>
      </div>
      <Row field="dataRole" value={tr("popup.infra.toiletRole")} color={gradeColor} />
      <Row field="county" value={String(props.county ?? "")} />
      <Row field="level" value={grade ? enumLabel("infraToiletGrade", grade, grade, i18n) : ""} color={gradeColor} />
      <Row field="category" value={String(props.type2 ?? "")} />
      <SourceFooter props={{
        ...props,
        source_org: tr("popup.infra.toiletSourceOrg"),
        source_url: "https://data.moenv.gov.tw/api/v2/fac_p_07",
        license: tr("popup.infra.toiletLicense"),
        fetched_at: props.fetched_at ?? "2026-07-17",
      }} />
    </>
  );
}

export function LighthousePanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.full, background: "#ffd700", flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>
          {String(props.Name ?? "Unknown Lighthouse")}
        </div>
      </div>
      <Row field="latitude" value={String(props.Lat ?? "")} />
      <Row field="longitude" value={String(props.Lon ?? "")} />
    </>
  );
}

export function PortPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const portClass = String(props.port_class ?? "");
  const accentColor = portClassColor(portClass);

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.sm, background: accentColor, flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>
          {String(props.name ?? "Unknown Port")}
        </div>
      </div>
      <Row field="classification" value={portClass} color={accentColor} />
      <Row field="county" value={String(props.county ?? "")} />
      <Row field="dataSource" value={String(props.source ?? "")} />
    </>
  );
}

export function AirportPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const i18n = useLocale();
  const { t: tr } = i18n;
  const iata = String(props.iata ?? "");
  const [series, setSeries] = useState<{ inSeries: SparklinePoint[]; outSeries: SparklinePoint[] }>({ inSeries: [], outSeries: [] });
  const [loadingTs, setLoadingTs] = useState(true);
  const [hasData, setHasData] = useState(false);

  useEffect(() => {
    if (!iata) { setLoadingTs(false); return; }
    let cancelled = false;
    setLoadingTs(true);
    fetchAirportHourlyPax(iata, 24)
      .then((rows) => {
        if (cancelled) return;
        const inSeries = rows.map((r) => ({ t: Date.parse(r.hour_bucket) / 1000, v: Number(r.pax_in) || 0 }));
        const outSeries = rows.map((r) => ({ t: Date.parse(r.hour_bucket) / 1000, v: Number(r.pax_out) || 0 }));
        setSeries({ inSeries, outSeries });
        setHasData(rows.length > 0);
      })
      .catch((e) => console.warn("[AirportPanel] hourly pax fetch failed:", e))
      .finally(() => { if (!cancelled) setLoadingTs(false); });
    return () => { cancelled = true; };
  }, [iata]);

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.full, background: "#daa520", flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>
          {String(props.name ?? "Unknown Airport")}
        </div>
      </div>
      <Row field="englishShort" value={String(props.name_en ?? "")} />
      <Row label="ICAO" value={String(props.icao ?? "")} />
      <Row label="IATA" value={iata} />

      {iata && (
        <>
          <div style={{ marginTop: 10, fontSize: FONT_SIZE.xs, color: t.textMuted, letterSpacing: 0.5 }}>
            {tr("popup.infra.airportIn24h")}
          </div>
          {loadingTs ? (
            <div style={{ fontSize: FONT_SIZE.sm, color: t.textDim, padding: "8px 4px", textAlign: "center" }}>
              {tr("popup.common.loading")}
            </div>
          ) : !hasData ? (
            <div style={{ fontSize: FONT_SIZE.sm, color: t.textDim, padding: "8px 4px", textAlign: "center" }}>
              {tr("popup.infra.airportNoData")}
            </div>
          ) : (
            <>
              <TimeseriesSparkline data={series.inSeries} unit={tr("popup.infra.unitPerson")} lineColor="#10b981" height={80} />
              <div style={{ marginTop: 6, fontSize: FONT_SIZE.xs, color: t.textMuted, letterSpacing: 0.5 }}>
                {tr("popup.infra.airportOut24h")}
              </div>
              <TimeseriesSparkline data={series.outSeries} unit={tr("popup.infra.unitPerson")} lineColor="#fb7185" height={80} />
            </>
          )}
        </>
      )}
    </>
  );
}

export function CctvPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const i18n = useLocale();
  const { t: tr } = i18n;
  const source = String(props.source ?? "");
  const info = CCTV_SOURCE[source] ?? { color: "#26c6da", label: source };
  const streamUrl = String(props.VideoStreamURL ?? "");
  const imageUrlRaw = props.VideoImageURL != null ? String(props.VideoImageURL) : "";
  const imageUrl = imageUrlRaw && imageUrlRaw !== "null" && imageUrlRaw !== "undefined" ? imageUrlRaw : "";
  // 換選別支時用 CCTVID 當 key 強制 remount，確保串流狀態機與 MJPEG 連線重置
  const cctvKey = String(props.CCTVID ?? streamUrl);
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.full, background: info.color, flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>
          {String(props.RoadName ?? props.CCTVID ?? "CCTV")}
        </div>
      </div>
      <Row field="source" value={source ? enumLabel("infraCctvSource", source, info.label, i18n) : ""} color={info.color} />
      <Row field="direction" value={String(props.RoadDirection ?? "")} />
      <Row label="ID" value={String(props.CCTVID ?? "")} />
      {streamUrl ? (
        <CctvStreamView
          key={cctvKey}
          streamUrl={streamUrl}
          imageUrl={imageUrl}
          source={source}
          accentColor={info.color}
        />
      ) : (
        <div style={{ marginTop: 8, fontSize: FONT_SIZE.base, color: t.textMuted }}>
          {tr("popup.infra.streamMissing")}
        </div>
      )}
    </>
  );
}

export function EtcGantryPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const i18n = useLocale();
  const { t: tr } = i18n;
  const accentColor = "#f06292";
  const start = String(props.StartInterchange ?? "");
  const end = String(props.EndInterchange ?? "");
  const segment = start && end ? `${start} → ${end}` : (start || end);
  const fareSmall = String(props.FareSmall ?? "");
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.sm, background: accentColor, flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>
          {String(props.GantryID ?? "ETC Gantry")}
        </div>
      </div>
      <Row label={tr("popup.infra.freeway")} value={String(props.Freeway ?? "")} color={accentColor} />
      <Row field="direction" value={String(props.Direction ?? "")} />
      <Row label={tr("popup.infra.segment")} value={segment} />
      <Row label={tr("popup.infra.mileage")} value={props.TollMile ? `${String(props.TollMile)} km` : ""} />
      <Row label={tr("popup.infra.smallCarRate")} value={fareSmall ? tr("popup.infra.smallCarRateValue", { fare: fareSmall }) : ""} color={accentColor} />
    </>
  );
}

export function ServiceAreaPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const i18n = useLocale();
  const { t: tr } = i18n;
  const accentColor = "#4db6ac";
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.full, background: accentColor, flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>
          {String(props.Name ?? "Service Area")}
        </div>
      </div>
      <Row label={tr("popup.infra.freeway")} value={String(props.Freeway ?? "")} color={accentColor} />
      <Row field="location" value={String(props.Location ?? "")} />
      <Row field="direction" value={String(props.Direction ?? "")} />
      <Row label={tr("popup.infra.operatorCompany")} value={String(props.Operator ?? "")} />
      <Row field="address" value={String(props.Address ?? "")} />
      <Row label={tr("popup.infra.theme")} value={String(props.Theme ?? "")} />
    </>
  );
}

export function ServiceAreaPolygonPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const i18n = useLocale();
  const { t: tr } = i18n;
  const accentColor = "#4db6ac";
  const areaHa = typeof props.area_ha === "number"
    ? props.area_ha.toFixed(2)
    : String(props.area_ha ?? "");
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.sm, background: accentColor, flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>
          {String(props.Name ?? "Service Area")}
        </div>
      </div>
      <Row label={tr("popup.infra.operatorCompany")} value={String(props.Operator ?? "")} color={accentColor} />
      <Row label={tr("popup.infra.theme")} value={String(props.Theme ?? "")} />
      <Row label={tr("popup.infra.freeway")} value={String(props.Freeway ?? "")} />
      <Row field="area" value={areaHa ? tr("popup.infra.areaHa", { value: areaHa }) : ""} />
    </>
  );
}

export function TaxiStandPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const i18n = useLocale();
  const { t: tr } = i18n;
  const accentColor = "#f9a825";
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.full, background: accentColor, flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>
          {String(props.Name ?? "Taxi Stand")}
        </div>
      </div>
      <Row field="district" value={String(props.District ?? "")} color={accentColor} />
      <Row field="location" value={String(props.StreetName ?? "")} />
      <Row label={tr("popup.infra.slots")} value={props.Slots ? tr("popup.infra.slotCount", { count: Number(props.Slots) || 0 }) : ""} />
      <Row label={tr("popup.infra.schedule")} value={String(props.Schedule ?? "")} />
      <Row field="city" value={String(props.city ?? "")} />
    </>
  );
}

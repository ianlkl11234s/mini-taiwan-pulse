import { Row, SourceFooter, Title } from "./shared";
import {
  ANNUAL_DTM_NODATA, ANNUAL_V2_NOTE, LANDSLIDE_LAYER_COLORS, dodRiskColor, highwayCategoryColor, highwayCategoryLabel,
} from "../../data/landslideTypes";
import { useLocale } from "../../state/localeStore";
import { displayRocYear, enumLabel } from "../../i18n/dataText";
import { placeName } from "../../i18n/placeText";
import type { LocaleSnapshot } from "../../state/localeStore";

/**
 * 崩塌 4 層 popup。來源 footer 由 FeatureInfoPanel 統一掛（GeoJSON／省道 PMTiles 已帶
 * source_org / source_url / license / fetched_at）；年度崩塌地切片不帶來源欄，由本 panel 自掛 SourceFooter（landslideAnnual 已列入 FOOTER_SELF_MANAGED）。
 */
type Props = { props: Record<string, unknown> };

const str = (v: unknown): string => (v == null || v === "" ? "" : String(v));
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const fmt = (v: unknown, digits: number, unit: string, { formatNumber }: LocaleSnapshot): string => {
  const n = num(v);
  return n == null ? "" : `${formatNumber(n, { maximumFractionDigits: digits })}${unit ? ` ${unit}` : ""}`;
};
/** ISO（+08:00）→「2014-06-05 06:52」；不經瀏覽器時區轉換。 */
const localTime = (v: unknown): string => str(v).replace("T", " ").slice(0, 16);
const admin = (props: Record<string, unknown>, i18n: LocaleSnapshot) =>
  [placeName(`${str(props.county)}${str(props.town)}`, i18n), str(props.village)].filter(Boolean).join(i18n.active === "zh-TW" ? "" : " ");
const risk = (v: unknown, i18n: LocaleSnapshot) => (str(v) ? enumLabel("landslideRisk", str(v), `${str(v)}風險`, i18n) : "");

export function LandslideDodAreaPanel({ props }: Props) {
  const i18n = useLocale();
  const { t, formatNumber } = i18n;
  const color = dodRiskColor(props.risk);
  const dwelling = num(props.dwelling_count);
  return <>
    <Title color={color}>{str(props.settlement_name) || str(props.lslno) || t("popup.landslide.dodAreaTitle")}</Title>
    <Row label={t("popup.landslide.yearVersion")} value={str(props.year_roc) ? t("popup.landslide.yearEdition", { year: displayRocYear(str(props.year_roc), i18n) }) : ""} mono />
    <Row label={t("popup.landslide.riskLevel")} value={risk(props.risk, i18n)} color={color} />
    <Row label={t("popup.landslide.residents")} value={[dwelling != null ? t("popup.landslide.households", { count: dwelling, value: formatNumber(dwelling) }) : "", str(props.res_class)].filter(Boolean).join("（") + (dwelling != null && str(props.res_class) ? "）" : "")} />
    <Row label={t("popup.landslide.type")} value={str(props.landslide_type)} />
    <Row field="district" value={admin(props, i18n)} />
    <Row label={t("popup.landslide.landmark")} value={str(props.landmark)} />
    <Row label={t("popup.landslide.accessRoad")} value={str(props.road_name)} />
    <Row field="basin" value={[props.basin, props.sub_basin].map(str).filter(Boolean).join("／")} />
    <Row field="area" value={fmt(props.geom_area_ha, 2, t("popup.landslide.unitHectare"), i18n)} />
    <Row field="number" value={str(props.lslno)} mono />
    <Row field="authority" value={str(props.authority)} />
  </>;
}

export function LandslideDodImpactPanel({ props }: Props) {
  const i18n = useLocale();
  const { t } = i18n;
  const color = dodRiskColor(props.risk);
  return <>
    <Title color={color}>{t("popup.landslide.dodImpactTitle", { code: str(props.lslno) }).trim()}</Title>
    <Row label={t("popup.landslide.yearVersion")} value={str(props.year_roc) ? t("popup.landslide.yearEdition", { year: displayRocYear(str(props.year_roc), i18n) }) : ""} mono />
    <Row label={t("popup.landslide.riskLevel")} value={risk(props.risk, i18n)} color={color} />
    <Row label={t("popup.landslide.householdsCount")} value={fmt(props.total_res, 0, t("popup.landslide.unitHousehold"), i18n)} />
    <Row label={t("popup.landslide.householdClass")} value={str(props.res_class)} />
    <Row field="district" value={admin(props, i18n)} />
    <Row field="area" value={fmt(props.geom_area_ha, 2, t("popup.landslide.unitHectare"), i18n)} />
    <Row field="authority" value={str(props.authority)} />
  </>;
}

export function HighwayDisasterPanel({ props }: Props) {
  const i18n = useLocale();
  const { t } = i18n;
  const color = highwayCategoryColor(props.category_group);
  return <>
    <Title color={color}>{`${str(props.route)} ${str(props.category_sub) || enumLabel("landslideHighwayGroup", String(props.category_group ?? "other"), highwayCategoryLabel(props.category_group), i18n)}`.trim()}</Title>
    <Row field="category" value={[props.category_main, props.category_sub].map(str).filter(Boolean).join("・")} color={color} />
    <Row field="location" value={str(props.location_text)} />
    <Row label={t("popup.landslide.reportedAt")} value={localTime(props.reported_at)} mono />
    <Row label={t("popup.landslide.releasedAt")} value={localTime(props.released_at)} mono />
    <Row label={t("popup.landslide.reportCategory")} value={str(props.report_category)} />
    <Row label={t("popup.landslide.event")} value={str(props.event_name)} />
    <Row label={t("popup.landslide.cause")} value={str(props.cause)} />
    <Row label={t("popup.landslide.maintenanceUnit")} value={str(props.agency_section)} />
  </>;
}

/** 圖例記載的年度崩塌地來源（tile 不帶來源欄） */
const ANNUAL_SOURCE = {
  source_org: "農業部農村發展及水土保持署（衛星影像判釋）",
  license: "政府資料開放授權條款第1版",
};

export function LandslideAnnualPanel({ props }: Props) {
  const i18n = useLocale();
  const { t } = i18n;
  const year = num(props.year);
  const dtm = num(props.min_dtm);
  return <>
    <Title color={LANDSLIDE_LAYER_COLORS.landslideAnnual}>{year != null ? t("popup.landslide.annualTitleYear", { year }) : t("popup.landslide.annualTitle")}</Title>
    <Row field="area" value={fmt(props.area_ha, 2, t("popup.landslide.unitHectare"), i18n)} />
    <Row label={t("popup.landslide.slope")} value={fmt(props.slope, 1, t("popup.landslide.unitDegree"), i18n)} />
    <Row label={t("popup.landslide.minDtm")} value={dtm == null ? "" : dtm === ANNUAL_DTM_NODATA ? t("popup.landslide.dtmMissing") : fmt(dtm, 0, t("popup.landslide.unitMeter"), i18n)} />
    <Row label={t("popup.landslide.imageDate")} value={str(props.image_date)} mono />
    {year === 2024 && <Row field="version" value={enumLabel("landslideNote", "annualV2", ANNUAL_V2_NOTE, i18n)} />}
    <SourceFooter props={{ source_org: enumLabel("landslideSource", "annualOrg", ANNUAL_SOURCE.source_org, i18n), license: enumLabel("landslideSource", "annualLicense", ANNUAL_SOURCE.license, i18n), fetched_at: year != null ? t("popup.landslide.yearEdition", { year: displayRocYear(year, i18n) }) : "" }} />
  </>;
}

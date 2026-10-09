import { Row, Title } from "./shared";
import {
  ANNUAL_DTM_NODATA, ANNUAL_V2_NOTE, LANDSLIDE_LAYER_COLORS, dodRiskColor, highwayCategoryColor, highwayCategoryLabel,
} from "../../data/landslideTypes";

/**
 * 崩塌 4 層 popup。來源 footer 由 FeatureInfoPanel 統一掛（GeoJSON／省道 PMTiles 已帶
 * source_org / source_url / license / fetched_at）；年度崩塌地切片不帶來源欄，來源見圖例。
 */
type Props = { props: Record<string, unknown> };

const str = (v: unknown): string => (v == null || v === "" ? "" : String(v));
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const fmt = (v: unknown, digits = 0, unit = ""): string => {
  const n = num(v);
  return n == null ? "" : `${n.toLocaleString("zh-TW", { maximumFractionDigits: digits })}${unit ? ` ${unit}` : ""}`;
};
/** ISO（+08:00）→「2014-06-05 06:52」；不經瀏覽器時區轉換。 */
const localTime = (v: unknown): string => str(v).replace("T", " ").slice(0, 16);
const admin = (props: Record<string, unknown>) => [props.county, props.town, props.village].map(str).join("");
const risk = (v: unknown) => (str(v) ? `${str(v)}風險` : "");

export function LandslideDodAreaPanel({ props }: Props) {
  const color = dodRiskColor(props.risk);
  const dwelling = num(props.dwelling_count);
  return <>
    <Title color={color}>{str(props.settlement_name) || str(props.lslno) || "大規模崩塌潛勢區"}</Title>
    <Row label="年度版本" value={str(props.year_roc) ? `${str(props.year_roc)} 年版` : ""} mono />
    <Row label="風險等級" value={risk(props.risk)} color={color} />
    <Row label="保全住戶" value={[dwelling != null ? `${dwelling.toLocaleString("zh-TW")} 戶` : "", str(props.res_class)].filter(Boolean).join("（") + (dwelling != null && str(props.res_class) ? "）" : "")} />
    <Row label="崩塌類型" value={str(props.landslide_type)} />
    <Row label="行政區" value={admin(props)} />
    <Row label="地標" value={str(props.landmark)} />
    <Row label="聯外道路" value={str(props.road_name)} />
    <Row label="流域" value={[props.basin, props.sub_basin].map(str).filter(Boolean).join("／")} />
    <Row label="面積" value={fmt(props.geom_area_ha, 2, "公頃")} />
    <Row label="編號" value={str(props.lslno)} mono />
    <Row label="主管機關" value={str(props.authority)} />
  </>;
}

export function LandslideDodImpactPanel({ props }: Props) {
  const color = dodRiskColor(props.risk);
  return <>
    <Title color={color}>{`大規模崩塌影響範圍 ${str(props.lslno)}`.trim()}</Title>
    <Row label="年度版本" value={str(props.year_roc) ? `${str(props.year_roc)} 年版` : ""} mono />
    <Row label="風險等級" value={risk(props.risk)} color={color} />
    <Row label="保全戶數" value={fmt(props.total_res, 0, "戶")} />
    <Row label="戶數級距" value={str(props.res_class)} />
    <Row label="行政區" value={admin(props)} />
    <Row label="面積" value={fmt(props.geom_area_ha, 2, "公頃")} />
    <Row label="主管機關" value={str(props.authority)} />
  </>;
}

export function HighwayDisasterPanel({ props }: Props) {
  const color = highwayCategoryColor(props.category_group);
  return <>
    <Title color={color}>{`${str(props.route)} ${str(props.category_sub) || highwayCategoryLabel(props.category_group)}`.trim()}</Title>
    <Row label="類別" value={[props.category_main, props.category_sub].map(str).filter(Boolean).join("・")} color={color} />
    <Row label="位置" value={str(props.location_text)} />
    <Row label="通報時間" value={localTime(props.reported_at)} mono />
    <Row label="解除時間" value={localTime(props.released_at)} mono />
    <Row label="通報性質" value={str(props.report_category)} />
    <Row label="事件" value={str(props.event_name)} />
    <Row label="原因" value={str(props.cause)} />
    <Row label="養護單位" value={str(props.agency_section)} />
  </>;
}

export function LandslideAnnualPanel({ props }: Props) {
  const year = num(props.year);
  const dtm = num(props.min_dtm);
  return <>
    <Title color={LANDSLIDE_LAYER_COLORS.landslideAnnual}>{year != null ? `${year} 年崩塌地` : "年度崩塌地"}</Title>
    <Row label="面積" value={fmt(props.area_ha, 2, "公頃")} />
    <Row label="坡度" value={fmt(props.slope, 1, "度")} />
    <Row label="最低高程（DTM）" value={dtm == null ? "" : dtm === ANNUAL_DTM_NODATA ? "缺（無高程值）" : fmt(dtm, 0, "公尺")} />
    <Row label="影像日期" value={str(props.image_date)} mono />
    {year === 2024 && <Row label="版本" value={ANNUAL_V2_NOTE} />}
  </>;
}

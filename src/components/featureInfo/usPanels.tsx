// 美國圖層 popup（2026-11-25 第 0–1 波）。規格 SSOT 在 data/usDataLayers.ts；規格驅動層重用菲律賓 makePhPanel。
// 來源與授權由 panel 自掛 SourceFooter（FOOTER_SELF_MANAGED）。空值列由 Row 自動隱藏，不寫 0；沒有值的區寫「未涵蓋」。
import type { FC } from "react";
import { Row, SourceFooter, Title } from "./shared";
import { useLocale } from "../../state/localeStore";
import { caText } from "../../data/intlLayerShared";
import { makePhPanel } from "./intlSpecPanel";
import { US_ADMIN_COLOR, US_ADMIN_LEVEL_LABELS, US_DATA_SPECS, US_FETCHED_AT, US_NOT_COVERED_COLOR, pickL3, type L3 } from "../../data/usDataLayers";
import type { UsDataKey } from "../../data/usDataKeys";

type P = { props: Record<string, unknown> };

function fmtNum(v: unknown, digits = 0): string {
  const s = caText(v);
  const n = Number(s);
  return s !== "" && Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: digits }) : "";
}

const CB = { org: "U.S. Census Bureau, Cartographic Boundary Files 2025", url: "https://www.census.gov/geographies/mapping-files/time-series/geo/cartographic-boundary.html" };
const ACS = { org: "U.S. Census Bureau, ACS 2020–2024 5-year (B01003)", url: "https://www.census.gov/programs-surveys/acs/data/summary-file.html" };
const PD: L3 = { zh: "美國聯邦政府作品（公有領域）", en: "U.S. Government Work (public domain)", ja: "米国連邦政府著作物（パブリックドメイン）" };

/** 層級：州（有 n_counties 或 geoid 2 碼）、郡（county_geoid 或 geoid 5 碼）、普查區（geoid 11 碼）。 */
function levelOf(props: Record<string, unknown>): "state" | "county" | "tract" {
  const g = caText(props.geoid);
  if (g.length === 11) return "tract";
  if (g.length === 5 || caText(props.county_geoid) !== "") return "county";
  return "state";
}
function nameOf(props: Record<string, unknown>, level: string): string {
  if (level === "tract") return `Census Tract ${caText(props.geoid)}`;
  if (level === "county") return caText(props.county_namelsad) || caText(props.county_name);
  return caText(props.state_name);
}

/** 行政邊界：名稱、層級、所屬州、郡數。 */
export function UsAdminBoundariesPanel({ props }: P) {
  const { locale } = useLocale();
  const pick = (t: L3) => pickL3(t, locale);
  const level = levelOf(props);
  return <>
    <Title color={US_ADMIN_COLOR}>{nameOf(props, level) || pick({ zh: "行政區", en: "Administrative area", ja: "行政区域" })}</Title>
    <Row label={pick({ zh: "層級", en: "Level", ja: "階層" })} value={pick(US_ADMIN_LEVEL_LABELS[level]!)} />
    {level === "county" ? <Row label={pick({ zh: "所屬州", en: "State", ja: "所属州" })} value={caText(props.state_name)} /> : null}
    {level === "county" ? <Row label="GEOID" value={caText(props.county_geoid)} /> : null}
    {level === "state" ? <Row label={pick({ zh: "郡數", en: "Counties", ja: "郡数" })} value={fmtNum(props.n_counties)} /> : null}
    <Row label={pick({ zh: "面積", en: "Area", ja: "面積" })} value={fmtNum(props.area_km2) ? `${fmtNum(props.area_km2)} km²` : ""} />
    <SourceFooter props={{ source_org: CB.org, source_url: CB.url, license: pick(PD), fetched_at: US_FETCHED_AT }} />
  </>;
}

/** 人口：ACS 5 年估計總人口、誤差界、密度。 */
export function UsPopulationPanel({ props }: P) {
  const { locale } = useLocale();
  const pick = (t: L3) => pickL3(t, locale);
  const level = levelOf(props);
  const noData = pick({ zh: "未涵蓋", en: "Not covered", ja: "未収録" });
  const has = caText(props.pop) !== "";
  const unit = pick({ zh: "人／km²", en: "people/km²", ja: "人／km²" });
  const density = fmtNum(props.density_per_km2, 1);
  const moe = fmtNum(props.moe);
  return <>
    <Title color={has ? "#f59e0b" : US_NOT_COVERED_COLOR}>{nameOf(props, level) || pick({ zh: "行政區", en: "Administrative area", ja: "行政区域" })}</Title>
    <Row label={pick({ zh: "層級", en: "Level", ja: "階層" })} value={pick(US_ADMIN_LEVEL_LABELS[level]!)} />
    {level !== "state" ? <Row label={pick({ zh: "所屬州", en: "State", ja: "所属州" })} value={caText(props.state_name)} /> : null}
    {level === "tract" ? <Row label={pick({ zh: "所屬郡", en: "County", ja: "所属郡" })} value={caText(props.county_name)} /> : null}
    <Row label={pick({ zh: "人口（ACS 5 年估計）", en: "Population (ACS 5-year)", ja: "人口（ACS 5 年推計）" })} value={fmtNum(props.pop) || noData} />
    <Row label={pick({ zh: "誤差界（90%）", en: "Margin of error (90%)", ja: "誤差（90%）" })} value={moe ? `±${moe}` : ""} />
    <Row label={pick({ zh: "人口密度", en: "Density", ja: "人口密度" })} value={density ? `${density} ${unit}` : noData} />
    <Row label={pick({ zh: "陸地面積", en: "Land area", ja: "陸地面積" })} value={fmtNum(props.land_km2, 1) ? `${fmtNum(props.land_km2, 1)} km²` : ""} />
    <SourceFooter props={{ source_org: ACS.org, source_url: ACS.url, license: pick(PD), fetched_at: US_FETCHED_AT }} />
  </>;
}

export const US_DATA_PANELS = Object.fromEntries(US_DATA_SPECS.map((s) => [s.key, makePhPanel(s)])) as Record<UsDataKey, FC<P>>;

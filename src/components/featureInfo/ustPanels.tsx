// 美國屬地圖層 popup（2026-11-25 波多黎各、關島第 0–1 波）。規格 SSOT 在 data/ustDataLayers.ts；規格驅動層重用菲律賓 makePhPanel。
// 來源與授權由 panel 自掛 SourceFooter。空值列由 Row 自動隱藏，不寫 0；沒有人口值的區塊群寫「未涵蓋」。
import type { FC } from "react";
import { Row, SourceFooter, Title } from "./shared";
import { useLocale } from "../../state/localeStore";
import { caText } from "../../data/intlLayerShared";
import { makePhPanel } from "./intlSpecPanel";
import { UST_ADMIN_COLOR, UST_AREA_SOURCE, UST_DATA_SPECS, UST_FETCHED_AT, UST_NOT_COVERED_COLOR, pickL3, type L3, type UstCc } from "../../data/ustDataLayers";
import type { UstAreaKey, UstDataKey } from "../../data/ustDataKeys";

type P = { props: Record<string, unknown> };

function fmtNum(v: unknown, digits = 0): string {
  const s = caText(v);
  const n = Number(s);
  return s !== "" && Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: digits }) : "";
}

function Footer({ k }: { k: UstAreaKey }) {
  const { locale } = useLocale();
  const s = UST_AREA_SOURCE[k];
  return <SourceFooter props={{ source_org: pickL3(s.org, locale), source_url: s.url, license: pickL3(s.license, locale), fetched_at: UST_FETCHED_AT }} />;
}

function makeAdminPanel(cc: UstCc): FC<P> {
  return function UstAdminPanel({ props }) {
    const { locale } = useLocale();
    const pick = (t: L3) => pickL3(t, locale);
    return <>
      <Title color={UST_ADMIN_COLOR}>{caText(props.name) || pick({ zh: "行政區", en: "Administrative area", ja: "行政区域" })}</Title>
      <Row label={pick({ zh: "所屬市", en: "Municipio", ja: "所属ムニシピオ" })} value={caText(props.municipio)} />
      <Row label={pick({ zh: "Census 代碼", en: "Census GEOID", ja: "Census コード" })} value={caText(props.geoid)} mono />
      <Row label={pick({ zh: "陸地面積", en: "Land area", ja: "陸地面積" })} value={fmtNum(props.aland_km2, 1) ? `${fmtNum(props.aland_km2, 1)} km²` : ""} />
      <Footer k={cc === "pr" ? "prAdminBoundaries" : "guAdminBoundaries"} />
    </>;
  };
}

/** 波多黎各人口：ACS 五年估計與誤差範圍。 */
function PrPopulationPanel({ props }: P) {
  const { locale } = useLocale();
  const pick = (t: L3) => pickL3(t, locale);
  const noData = pick({ zh: "未涵蓋", en: "Not covered", ja: "未収録" });
  const density = fmtNum(props.density, 1);
  const moe = fmtNum(props.pop_moe);
  return <>
    <Title color={density ? "#f59e0b" : UST_NOT_COVERED_COLOR}>{caText(props.name) || pick({ zh: "行政區", en: "Administrative area", ja: "行政区域" })}</Title>
    <Row label={pick({ zh: "所屬市", en: "Municipio", ja: "所属ムニシピオ" })} value={caText(props.municipio)} />
    <Row label={pick({ zh: "人口（ACS 2020–2024）", en: "Population (ACS 2020–2024)", ja: "人口（ACS 2020–2024）" })} value={fmtNum(props.pop) ? `${fmtNum(props.pop)}${moe ? ` ±${moe}` : ""}` : noData} />
    <Row label={pick({ zh: "人口密度", en: "Density", ja: "人口密度" })} value={density ? `${density} ${pick({ zh: "人／km²", en: "people/km²", ja: "人／km²" })}` : noData} />
    <Row label={pick({ zh: "陸地面積", en: "Land area", ja: "陸地面積" })} value={fmtNum(props.aland_km2, 1) ? `${fmtNum(props.aland_km2, 1)} km²` : ""} />
    <Footer k="prPopulation" />
  </>;
}

/** 關島人口：2020 普查；來源表缺值的區塊群寫「未涵蓋」，所在村標「總數偏低」。 */
function GuPopulationPanel({ props }: P) {
  const { locale } = useLocale();
  const pick = (t: L3) => pickL3(t, locale);
  const noData = pick({ zh: "未涵蓋（來源表空白）", en: "Not covered (blank in source table)", ja: "未収録（元表が空欄）" });
  const pop = fmtNum(props.pop2020);
  const density = fmtNum(props.density, 1);
  const partial = caText(props.pop2020_partial) === "true";
  return <>
    <Title color={pop ? "#f59e0b" : UST_NOT_COVERED_COLOR}>{caText(props.name) || caText(props.village) || pick({ zh: "區塊群", en: "Block group", ja: "ブロックグループ" })}</Title>
    <Row label={pick({ zh: "所屬村", en: "Village", ja: "所属ビレッジ" })} value={caText(props.name) ? "" : caText(props.village)} />
    <Row label={pick({ zh: "2020 普查人口", en: "Population (2020 Census)", ja: "2020 年国勢調査人口" })} value={pop || noData} />
    {partial ? <Row label={pick({ zh: "備註", en: "Note", ja: "備考" })} value={pick({ zh: `${fmtNum(props.n_bg_pop_missing)} 個區塊群來源表空白，總數偏低`, en: `${fmtNum(props.n_bg_pop_missing)} block group(s) blank in the source; total is partial`, ja: `${fmtNum(props.n_bg_pop_missing)} ブロックグループが元表で空欄、合計は過小` })} /> : null}
    <Row label={pick({ zh: "人口密度", en: "Density", ja: "人口密度" })} value={density ? `${density} ${pick({ zh: "人／km²", en: "people/km²", ja: "人／km²" })}` : pop ? "" : noData} />
    <Row label={pick({ zh: "2010 普查人口", en: "Population (2010 Census)", ja: "2010 年国勢調査人口" })} value={fmtNum(props.pop2010)} />
    <Row label={pick({ zh: "2020 住宅數", en: "Housing units (2020)", ja: "2020 年住宅数" })} value={fmtNum(props.hu2020)} />
    <Footer k="guPopulation" />
  </>;
}

export const UST_AREA_PANELS: Record<UstAreaKey, FC<P>> = {
  prAdminBoundaries: makeAdminPanel("pr"), guAdminBoundaries: makeAdminPanel("gu"), prPopulation: PrPopulationPanel, guPopulation: GuPopulationPanel,
};
export const UST_DATA_PANELS = Object.fromEntries(UST_DATA_SPECS.map((s) => [s.key, makePhPanel(s)])) as Record<UstDataKey, FC<P>>;

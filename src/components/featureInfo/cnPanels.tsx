// 中國圖層 popup（2026-11-13 第 0–1 波，站主限定）。規格與署名 SSOT 在 data/cnDataLayers.ts；規格驅動層沿用菲律賓 makePhPanel。
// 來源與授權由 panel 自掛 SourceFooter（FOOTER_SELF_MANAGED）。空值列由 Row 自動隱藏，不寫 0。
import type { FC } from "react";
import { Row, SourceFooter, Title } from "./shared";
import { useLocale } from "../../state/localeStore";
import { caText } from "../../data/caInfraTypes";
import {
  CN_ADMIN_COLOR, CN_ADMIN_SOURCE, CN_DATA_SPECS, CN_FETCHED_AT, CN_NOT_COVERED_COLOR, CN_POPULATION_SOURCE, CN_UNIT_TYPE,
  asPhSpec, pickL3, type L3,
} from "../../data/cnDataLayers";
import type { CnDataKey } from "../../data/cnDataKeys";
import { makePhPanel } from "./phPanels";

type P = { props: Record<string, unknown> };
const LEVEL: Record<string, L3> = { province: { zh: "省級", en: "Province-level", ja: "省級" }, prefecture: { zh: "地級", en: "Prefecture-level", ja: "地級" } };

function fmtNum(v: unknown, digits = 0): string {
  const s = caText(v);
  const n = Number(s);
  return s !== "" && Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: digits }) : "";
}
const placeName = (props: Record<string, unknown>) => caText(props.name_zh_hant) || caText(props.name_zh);

function AdminRows({ props, pick }: { props: Record<string, unknown>; pick: (t: L3) => string }) {
  const level = caText(props.level);
  const unit = CN_UNIT_TYPE[caText(props.unit_type)];
  return <>
    {LEVEL[level] ? <Row label={pick({ zh: "層級", en: "Level", ja: "階層" })} value={pick(unit ?? LEVEL[level]!)} /> : null}
    <Row label={pick({ zh: "簡體原名", en: "Name (simplified)", ja: "簡体字名" })} value={caText(props.name_zh) !== placeName(props) ? caText(props.name_zh) : ""} />
    <Row label={pick({ zh: "英文名", en: "English name", ja: "英語名" })} value={caText(props.name_en)} />
    {level === "prefecture" ? <Row label={pick({ zh: "所屬省", en: "Province", ja: "所属省" })} value={caText(props.province_name)} /> : null}
    <Row label={pick({ zh: "行政區劃代碼", en: "Division code", ja: "行政区画コード" })} value={caText(props.code) || caText(props.province_code)} mono />
  </>;
}

/** 行政邊界：名稱、層級、所屬省、民政部代碼。 */
export function CnAdminBoundariesPanel({ props }: P) {
  const { locale } = useLocale();
  const pick = (t: L3) => pickL3(t, locale);
  return <>
    <Title color={CN_ADMIN_COLOR}>{placeName(props) || pick({ zh: "行政區", en: "Administrative area", ja: "行政区域" })}</Title>
    <AdminRows props={props} pick={pick} />
    <Row label={pick({ zh: "備註", en: "Note", ja: "備考" })} value={pick({ zh: "邊界依 OCHA 資料，不代表任何立場", en: "Boundaries follow OCHA data and do not imply any position", ja: "境界は OCHA データによるもので、いかなる立場も示さない" })} />
    <SourceFooter props={{ source_org: CN_ADMIN_SOURCE.org, source_url: CN_ADMIN_SOURCE.url, license: CN_ADMIN_SOURCE.license, fetched_at: CN_FETCHED_AT }} />
  </>;
}

/** 人口：省＝2020 普查＋GHS 模型值對照；地級＝GHS 模型值（一律標「模型推估，非統計」）；沒有值寫「未涵蓋」。 */
export function CnPopulationPanel({ props }: P) {
  const { locale } = useLocale();
  const pick = (t: L3) => pickL3(t, locale);
  const isProvince = caText(props.level) === "province";
  const noData = pick({ zh: "未涵蓋", en: "Not covered", ja: "未収録" });
  const perKm2 = pick({ zh: "人／km²", en: "people/km²", ja: "人／km²" });
  const model = pick({ zh: "（GHS 模型推估，非統計）", en: " (GHS model estimate, not statistics)", ja: "（GHS モデル推計、統計ではない）" });
  const censusPop = fmtNum(props.census2020_pop);
  const censusDensity = fmtNum(props.census2020_density, 1);
  const ghsPop = fmtNum(props.ghs2025_pop);
  const ghsDensity = fmtNum(props.ghs2025_density, 1);
  const covered = isProvince ? !!censusDensity : !!ghsDensity;
  const diff = caText(props.ghs_vs_census_pct);
  return <>
    <Title color={covered ? "#f59e0b" : CN_NOT_COVERED_COLOR}>{placeName(props) || pick({ zh: "行政區", en: "Administrative area", ja: "行政区域" })}</Title>
    <AdminRows props={props} pick={pick} />
    {isProvince ? <>
      <Row label={pick({ zh: "2020 普查人口", en: "Population (2020 census)", ja: "2020 年国勢調査人口" })} value={censusPop || noData} />
      <Row label={pick({ zh: "2020 普查密度", en: "Density (2020 census)", ja: "2020 年国勢調査密度" })} value={censusDensity ? `${censusDensity} ${perKm2}` : noData} />
    </> : null}
    <Row label={pick({ zh: "2025 人口（模型值）", en: "Population 2025 (model)", ja: "2025 年人口（モデル値）" })} value={ghsPop ? `${ghsPop}${model}` : noData} />
    <Row label={pick({ zh: "2025 密度（模型值）", en: "Density 2025 (model)", ja: "2025 年密度（モデル値）" })} value={ghsDensity ? `${ghsDensity} ${perKm2}` : noData} />
    {isProvince && diff ? <Row label={pick({ zh: "模型值與普查差", en: "Model vs census", ja: "モデル値と国勢調査の差" })} value={`${Number(diff) > 0 ? "+" : ""}${diff}%`} /> : null}
    <SourceFooter props={{ source_org: CN_POPULATION_SOURCE.org, source_url: CN_POPULATION_SOURCE.url, license: CN_POPULATION_SOURCE.license, fetched_at: CN_FETCHED_AT }} />
  </>;
}

export const CN_DATA_PANELS = Object.fromEntries(CN_DATA_SPECS.map((s) => [s.key, makePhPanel(asPhSpec(s))])) as Record<CnDataKey, FC<P>>;

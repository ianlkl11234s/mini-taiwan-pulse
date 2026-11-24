// 印尼圖層 popup（2026-11-23 第 0–4 波）。規格 SSOT 在 data/idDataLayers.ts、data/idWavesLayers.ts；規格驅動層重用菲律賓 makePhPanel。
// 來源與授權由 panel 自掛 SourceFooter（FOOTER_SELF_MANAGED）。空值列由 Row 自動隱藏，不寫 0；沒有值的縣市寫「未涵蓋」。
import type { FC } from "react";
import { Row, SourceFooter, Title } from "./shared";
import { useLocale } from "../../state/localeStore";
import { caText } from "../../data/caInfraTypes";
import { makePhPanel } from "./phPanels";
import {
  ID_ADMIN_COLOR, ID_ADMIN_LEVEL_LABELS, ID_BOUNDARY_NOTE, ID_DATA_SPECS, ID_FETCHED_AT, ID_IDM_STATUS_KEYS, ID_NOT_COVERED_COLOR, phText, pickL3, type L3, type IdAdminLevel,
} from "../../data/idDataLayers";
import { ID_SPEC_BY_KEY } from "../../data/idDataLayers";
import type { IdDataKey } from "../../data/idDataKeys";

type P = { props: Record<string, unknown> };

function fmtNum(v: unknown, digits = 0): string {
  const s = caText(v);
  const n = Number(s);
  return s !== "" && Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: digits }) : "";
}

const COD_AB = { org: "OCHA COD-AB Indonesia v01 (source BIG, BPS), via HDX", url: "https://data.humdata.org/dataset/cod-ab-idn", license: "CC BY-IGO 3.0" };
const POP_SOURCE = { org: "UNFPA／BPS COD-PS Indonesia 2020 (v3), via HDX", url: "https://data.humdata.org/dataset/cod-ps-idn" };
const IDM_SOURCE = { org: "Kemendes PDTT, Indeks Desa Membangun 2024", url: "https://idm.kemendesa.go.id/" };

function nameOf(props: Record<string, unknown>): string {
  const level = caText(props.level);
  if (level === "country") return caText(props.country_en) || caText(props.country_id);
  if (level === "kabkota") return caText(props.kabkota_name);
  return caText(props.province_name);
}

function AdminRows({ props, pick }: { props: Record<string, unknown>; pick: (t: L3) => string }) {
  const level = caText(props.level) as IdAdminLevel;
  return <>
    {ID_ADMIN_LEVEL_LABELS[level] ? <Row label={pick({ zh: "層級", en: "Level", ja: "階層" })} value={pick(ID_ADMIN_LEVEL_LABELS[level])} /> : null}
    {level === "kabkota" ? <Row label={pick({ zh: "類型", en: "Type", ja: "種別" })} value={caText(props.kabkota_type)} /> : null}
    {level === "kabkota" ? <Row label={pick({ zh: "所屬省", en: "Province", ja: "所属州" })} value={caText(props.province_name)} /> : null}
    {level === "province" ? <Row label={pick({ zh: "縣市數", en: "Regencies / cities", ja: "県市数" })} value={fmtNum(props.kabkota_count)} /> : null}
  </>;
}

/** 行政邊界：名稱、層級、所屬省；邊界立場聲明。 */
export function IdAdminBoundariesPanel({ props }: P) {
  const { locale } = useLocale();
  const pick = (t: L3) => pickL3(t, locale);
  return <>
    <Title color={ID_ADMIN_COLOR}>{nameOf(props) || pick({ zh: "行政區", en: "Administrative area", ja: "行政区域" })}</Title>
    <AdminRows props={props} pick={pick} />
    <Row label={pick({ zh: "邊界說明", en: "Boundary note", ja: "境界の注記" })} value={pick(ID_BOUNDARY_NOTE)} />
    <SourceFooter props={{ source_org: COD_AB.org, source_url: COD_AB.url, license: COD_AB.license, fetched_at: ID_FETCHED_AT }} />
  </>;
}

/** 人口：2020 推估人口與密度、65 歲以上比例。 */
export function IdPopulationPanel({ props }: P) {
  const { locale } = useLocale();
  const pick = (t: L3) => pickL3(t, locale);
  const noData = pick({ zh: "未涵蓋", en: "Not covered", ja: "未収録" });
  const has = caText(props.population) !== "";
  const unit = pick({ zh: "人／km²", en: "people/km²", ja: "人／km²" });
  const density = fmtNum(props.density_per_km2, 1);
  const pct = fmtNum(props.pct_65_plus, 1);
  return <>
    <Title color={has ? "#f59e0b" : ID_NOT_COVERED_COLOR}>{nameOf(props) || pick({ zh: "行政區", en: "Administrative area", ja: "行政区域" })}</Title>
    <AdminRows props={props} pick={pick} />
    <Row label={pick({ zh: "2020 推估人口", en: "Population (2020 estimate)", ja: "2020 年推計人口" })} value={fmtNum(props.population) || noData} />
    <Row label={pick({ zh: "人口密度", en: "Density", ja: "人口密度" })} value={density ? `${density} ${unit}` : noData} />
    <Row label={pick({ zh: "65 歲以上", en: "Aged 65+", ja: "65 歳以上" })} value={pct ? `${pct}%` : ""} />
    <Row label={pick({ zh: "男性", en: "Male", ja: "男性" })} value={fmtNum(props.male)} />
    <Row label={pick({ zh: "女性", en: "Female", ja: "女性" })} value={fmtNum(props.female)} />
    <Row label={pick({ zh: "面積", en: "Area", ja: "面積" })} value={fmtNum(props.area_km2, 1) ? `${fmtNum(props.area_km2, 1)} km²` : ""} />
    <SourceFooter props={{ source_org: POP_SOURCE.org, source_url: POP_SOURCE.url, license: pick({ zh: "授權未明示", en: "License not stated", ja: "ライセンス未明示" }), fetched_at: ID_FETCHED_AT }} />
  </>;
}

/** 農村發展指數 IDM：村均值、五級狀態村數；沒有村的縣市寫「未涵蓋」。 */
export function IdRuralDevelopmentPanel({ props }: P) {
  const { locale } = useLocale();
  const pick = (t: L3) => pickL3(t, locale);
  const noData = pick({ zh: "未涵蓋（無村）", en: "Not covered (no villages)", ja: "未収録（村なし）" });
  const idm = fmtNum(props.idm_mean, 3);
  const pctWorse = fmtNum(props.pct_tertinggal_or_worse, 1);
  return <>
    <Title color={idm ? "#2dd4bf" : ID_NOT_COVERED_COLOR}>{nameOf(props) || pick({ zh: "行政區", en: "Administrative area", ja: "行政区域" })}</Title>
    <AdminRows props={props} pick={pick} />
    <Row label={pick({ zh: "IDM 2024 村均值", en: "IDM 2024 village mean", ja: "IDM 2024 村平均" })} value={idm || noData} />
    <Row label={pick({ zh: "村數", en: "Villages", ja: "村数" })} value={fmtNum(props.villages)} />
    {idm ? ID_IDM_STATUS_KEYS.map((s) => <Row key={s.prop} label={pick(s.label)} value={fmtNum(props[s.prop])} />) : null}
    <Row label={pick({ zh: "落後以下占比", en: "Share lagging or worse", ja: "遅れ以下の割合" })} value={pctWorse ? `${pctWorse}%` : ""} />
    <SourceFooter props={{ source_org: IDM_SOURCE.org, source_url: IDM_SOURCE.url, license: "Open Data Commons Attribution License", fetched_at: ID_FETCHED_AT }} />
  </>;
}

export const ID_DATA_PANELS = Object.fromEntries(ID_DATA_SPECS.map((s) => [s.key, makePhPanel(s)])) as Record<IdDataKey, FC<P>>;
void ID_SPEC_BY_KEY;
void phText;

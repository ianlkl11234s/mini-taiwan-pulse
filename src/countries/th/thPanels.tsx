// 泰國圖層 popup（2026-11-22 第 0–1 波）。規格與署名 SSOT 在 data/thDataLayers.ts；規格驅動層重用菲律賓 makePhPanel。
// 來源與授權由 panel 自掛 SourceFooter（FOOTER_SELF_MANAGED）。空值列由 Row 自動隱藏，不寫 0。
import type { FC } from "react";
import { Row, SourceFooter, Title } from "../../components/featureInfo/shared";
import { useLocale } from "../../state/localeStore";
import { caText } from "../../data/intlLayerShared";
import { makePhPanel } from "../../components/featureInfo/intlSpecPanel";
import {
  TH_ADMIN_COLOR, TH_ADMIN_LEVEL_LABELS, TH_ADMIN_SOURCE, TH_BOUNDARY_NOTE, TH_DATA_SPECS, TH_FETCHED_AT, TH_NOT_COVERED_COLOR, TH_POP_STATUS,
  TH_POP_YEARS, TH_POPULATION_SOURCE, phText, pickL3, type L3, type ThAdminLevel,
} from "./thDataLayers";
import type { ThDataKey } from "./keys";

type P = { props: Record<string, unknown> };

function fmtNum(v: unknown, digits = 0): string {
  const s = caText(v);
  const n = Number(s);
  return s !== "" && Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: digits }) : "";
}

/** 泰文＋英文名並列（泰文名為主，英文名相同或缺值時省略）。 */
const bilingual = (th: unknown, en: unknown) => {
  const a = caText(th);
  const b = caText(en);
  return a && b && a !== b ? `${a}（${b}）` : a || b;
};

function AdminRows({ props, pick }: { props: Record<string, unknown>; pick: (t: L3) => string }) {
  const level = caText(props.level) as ThAdminLevel;
  return <>
    {TH_ADMIN_LEVEL_LABELS[level] ? <Row label={pick({ zh: "層級", en: "Level", ja: "階層" })} value={pick(TH_ADMIN_LEVEL_LABELS[level])} /> : null}
    {level === "tambon" || level === "amphoe" || !level ? <Row label={pick({ zh: "所屬府", en: "Province", ja: "所属県" })} value={bilingual(props.province_th, props.province_en)} /> : null}
    {level === "tambon" ? <Row label={pick({ zh: "所屬縣（amphoe／khet）", en: "District (amphoe / khet)", ja: "所属郡（amphoe／khet）" })} value={bilingual(props.amphoe_th, props.amphoe_en)} /> : null}
  </>;
}

function nameOf(props: Record<string, unknown>): string {
  const level = caText(props.level);
  if (level === "tambon") return bilingual(props.tambon_th, props.tambon_en);
  if (level === "amphoe") return bilingual(props.amphoe_th, props.amphoe_en);
  if (level === "country") return bilingual(props.country_th, props.country_en);
  return bilingual(props.province_th, props.province_en);
}

/** 行政邊界：泰文＋英文名、層級、上層行政區、代碼。 */
export function ThAdminBoundariesPanel({ props }: P) {
  const { locale } = useLocale();
  const pick = (t: L3) => pickL3(t, locale);
  const level = caText(props.level);
  const code = caText(props.tambon_code) || caText(props.amphoe_code) || caText(props.province_code) || caText(props.country_code);
  return <>
    <Title color={TH_ADMIN_COLOR}>{nameOf(props) || pick({ zh: "行政區", en: "Administrative area", ja: "行政区域" })}</Title>
    <AdminRows props={props} pick={pick} />
    <Row label={pick({ zh: "COD-AB 代碼", en: "COD-AB code", ja: "COD-AB コード" })} value={code} mono />
    {level === "tambon" && /Bangkok|กรุงเทพ/.test(caText(props.province_en) + caText(props.province_th))
      ? <Row label={pick({ zh: "備註", en: "Note", ja: "備考" })} value={pick({ zh: "曼谷 khwaeng 版本落後（本層 169，官方現行 180）", en: "Bangkok khwaeng: outdated edition (this layer 169, official 180)", ja: "バンコクの khwaeng：版が古い（本レイヤー 169、公式現行 180）" })} /> : null}
    <Row label={pick({ zh: "邊界說明", en: "Boundary note", ja: "境界の注記" })} value={pick(TH_BOUNDARY_NOTE)} />
    <SourceFooter props={{ source_org: phText(TH_ADMIN_SOURCE.org, locale), source_url: TH_ADMIN_SOURCE.url, license: phText(TH_ADMIN_SOURCE.license, locale), fetched_at: TH_FETCHED_AT }} />
  </>;
}

/** 人口：戶籍人口（2025，另列 2021–2025）與密度；未涵蓋寫「未涵蓋」不寫 0。 */
export function ThPopulationPanel({ props }: P) {
  const { locale } = useLocale();
  const pick = (t: L3) => pickL3(t, locale);
  const status = caText(props.pop_status);
  const notCovered = status === "not_covered";
  const noData = pick({ zh: "未涵蓋", en: "Not covered", ja: "未収録" });
  const year = caText(props.latest_year) || "2025";
  const density = notCovered ? "" : fmtNum(props.density_latest, 1);
  const total = (y: number) => (notCovered ? "" : fmtNum(props[`pop_total_${y}`]));
  return <>
    <Title color={notCovered ? TH_NOT_COVERED_COLOR : "#f59e0b"}>{nameOf(props) || pick({ zh: "行政區", en: "Administrative area", ja: "行政区域" })}</Title>
    <AdminRows props={props} pick={pick} />
    <Row label={pick({ zh: `${year} 戶籍人口`, en: `Registered population ${year}`, ja: `${year} 年住民登録人口` })} value={total(Number(year)) || noData} />
    <Row label={pick({ zh: "人口密度", en: "Density", ja: "人口密度" })} value={density ? `${density} ${pick({ zh: "人／km²", en: "people/km²", ja: "人／km²" })}` : noData} />
    <Row label={pick({ zh: "男性", en: "Male", ja: "男性" })} value={notCovered ? "" : fmtNum(props[`pop_male_${year}`])} />
    <Row label={pick({ zh: "女性", en: "Female", ja: "女性" })} value={notCovered ? "" : fmtNum(props[`pop_female_${year}`])} />
    {TH_POP_YEARS.filter((y) => String(y) !== year).reverse().map((y) => <Row key={y} label={pick({ zh: `${y} 戶籍人口`, en: `Registered population ${y}`, ja: `${y} 年住民登録人口` })} value={total(y)} />)}
    <Row label={pick({ zh: "面積", en: "Area", ja: "面積" })} value={fmtNum(props.area_km2, 1) ? `${fmtNum(props.area_km2, 1)} km²` : ""} />
    {TH_POP_STATUS[status] ? <Row label={pick({ zh: "人口來源", en: "Population basis", ja: "人口の根拠" })} value={pick(TH_POP_STATUS[status]!)} /> : null}
    <Row label={pick({ zh: "說明", en: "Note", ja: "備考" })} value={pick({ zh: "戶籍人口（DOPA 登記），不是普查實住人口", en: "Registered population (DOPA), not census residents", ja: "住民登録人口（DOPA）で、国勢調査の居住人口ではない" })} />
    <SourceFooter props={{ source_org: phText(TH_POPULATION_SOURCE.org, locale), source_url: TH_POPULATION_SOURCE.url, license: phText(TH_POPULATION_SOURCE.license, locale), fetched_at: TH_FETCHED_AT }} />
  </>;
}

export const TH_DATA_PANELS = Object.fromEntries(TH_DATA_SPECS.map((s) => [s.key, makePhPanel(s)])) as Record<ThDataKey, FC<P>>;

// 菲律賓圖層 popup（2026-11-13 第 0–1 波）。規格與署名 SSOT 在 data/phDataLayers.ts；
// 來源與授權由 panel 自掛 SourceFooter（FOOTER_SELF_MANAGED）。空值列由 Row 自動隱藏，不寫 0。
import type { FC } from "react";
import { Row, SourceFooter, Title } from "./shared";
import { useLocale } from "../../state/localeStore";
import { caText } from "../../data/caInfraTypes";
import {
  PH_ADMIN_COLOR, PH_ADMIN_LEVEL_LABELS, PH_ADMIN_SOURCE, PH_DATA_SPECS, PH_FETCHED_AT, PH_NOT_COVERED_COLOR, PH_POP_STATUS,
  PH_POPULATION_SOURCE, PH_URBAN_CLASS, phCatOf, pickL3, type L3, type PhField, type PhLayerSpec, type PhAdminLevel,
} from "../../data/phDataLayers";
import type { PhDataKey } from "../../data/phDataKeys";

type P = { props: Record<string, unknown> };

function fmtNum(v: unknown, digits = 0): string {
  const s = caText(v);
  const n = Number(s);
  return s !== "" && Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: digits }) : "";
}

function AdminRows({ props, pick }: { props: Record<string, unknown>; pick: (t: L3) => string }) {
  const level = caText(props.level) as PhAdminLevel;
  return <>
    {PH_ADMIN_LEVEL_LABELS[level] ? <Row label={pick({ zh: "層級", en: "Level", ja: "階層" })} value={pick(PH_ADMIN_LEVEL_LABELS[level])} /> : null}
    {level !== "region" ? <Row label={pick({ zh: "所屬區域", en: "Region", ja: "所属地方" })} value={caText(props.region_name)} /> : null}
    {level === "municipality" || level === "barangay" ? <Row label={pick({ zh: "所屬省", en: "Province", ja: "所属州" })} value={caText(props.province_name)} /> : null}
    {level === "barangay" ? <Row label={pick({ zh: "所屬市鎮", en: "City / municipality", ja: "所属市町" })} value={caText(props.municipality_name)} /> : null}
  </>;
}

/** 行政邊界：名稱、層級、上層行政區、PSGC 代碼。 */
export function PhAdminBoundariesPanel({ props }: P) {
  const { locale } = useLocale();
  const pick = (t: L3) => pickL3(t, locale);
  return <>
    <Title color={PH_ADMIN_COLOR}>{caText(props.name) || pick({ zh: "行政區", en: "Administrative area", ja: "行政区域" })}</Title>
    <AdminRows props={props} pick={pick} />
    <Row label={pick({ zh: "PSGC 代碼", en: "PSGC code", ja: "PSGC コード" })} value={caText(props.psgc)} mono />
    <SourceFooter props={{ source_org: PH_ADMIN_SOURCE.org, source_url: PH_ADMIN_SOURCE.url, license: PH_ADMIN_SOURCE.license, fetched_at: PH_FETCHED_AT }} />
  </>;
}

/** 人口：2024 普查人口與密度；未涵蓋寫「未涵蓋」不寫 0；合併值另註。 */
export function PhPopulationPanel({ props }: P) {
  const { locale } = useLocale();
  const pick = (t: L3) => pickL3(t, locale);
  const status = caText(props.pop_status);
  const notCovered = status === "not_covered";
  const noData = pick({ zh: "未涵蓋", en: "Not covered", ja: "未収録" });
  const pop = notCovered ? "" : fmtNum(props.population);
  const density = notCovered ? "" : fmtNum(props.density_per_km2, 1);
  return <>
    <Title color={notCovered ? PH_NOT_COVERED_COLOR : "#f59e0b"}>{caText(props.name) || pick({ zh: "行政區", en: "Administrative area", ja: "行政区域" })}</Title>
    <AdminRows props={props} pick={pick} />
    <Row label={pick({ zh: "2024 人口", en: "Population 2024", ja: "2024 年人口" })} value={pop || noData} />
    <Row label={pick({ zh: "人口密度", en: "Density", ja: "人口密度" })} value={density ? `${density} ${pick({ zh: "人／km²", en: "people/km²", ja: "人／km²" })}` : noData} />
    {PH_POP_STATUS[status] ? <Row label={pick({ zh: "人口來源", en: "Population basis", ja: "人口の根拠" })} value={pick(PH_POP_STATUS[status]!)} /> : null}
    {PH_URBAN_CLASS[caText(props.urban_class)] ? <Row label={pick({ zh: "都市／鄉村", en: "Urban / rural", ja: "都市・農村" })} value={pick(PH_URBAN_CLASS[caText(props.urban_class)]!)} /> : null}
    <Row label={pick({ zh: "PSGC 代碼", en: "PSGC code", ja: "PSGC コード" })} value={caText(props.psgc)} mono />
    <SourceFooter props={{ source_org: PH_POPULATION_SOURCE.org, source_url: PH_POPULATION_SOURCE.url, license: PH_POPULATION_SOURCE.license, fetched_at: PH_FETCHED_AT }} />
  </>;
}

function formatField(f: PhField, props: Record<string, unknown>, locale: string): string {
  const raw = props[f.prop];
  if (f.kind === "num") {
    const s = fmtNum(raw, f.digits ?? 0);
    return s ? `${s}${f.unit ? ` ${f.unit}` : ""}` : "";
  }
  const s = caText(raw);
  if (!s) return "";
  if (f.map?.[s]) return pickL3(f.map[s]!, locale);
  return s;
}

export function makePhPanel(spec: PhLayerSpec<string>): FC<P> {
  return function PhDataPanel({ props }) {
    const { locale } = useLocale();
    const cat = phCatOf(spec, props);
    let title = spec.title.props.map((p) => caText(props[p])).find(Boolean);
    if (!title && spec.title.fallbackBy) {
      const t = spec.title.fallbackBy.map[caText(props[spec.title.fallbackBy.prop])];
      if (t) title = pickL3(t, locale);
    }
    return <>
      <Title color={cat?.color ?? spec.otherColor ?? spec.color}>{title || pickL3(spec.title.fallback, locale)}</Title>
      {spec.fields.map((f) => <Row key={f.prop} label={pickL3(f.label, locale)} value={formatField(f, props, locale)} mono={f.kind === "code"} />)}
      {spec.popupNotes.filter((n) => !n.when || n.when(props)).map((n, i) => <Row key={i} label={locale === "en" ? "Note" : locale === "ja" ? "備考" : "備註"} value={pickL3(n.text, locale)} />)}
      <SourceFooter props={{ source_org: spec.sourceOrg, source_url: spec.sourceUrl, license: spec.license, fetched_at: spec.fetchedAt }} />
    </>;
  };
}

export const PH_DATA_PANELS = Object.fromEntries(PH_DATA_SPECS.map((s) => [s.key, makePhPanel(s)])) as Record<PhDataKey, FC<P>>;

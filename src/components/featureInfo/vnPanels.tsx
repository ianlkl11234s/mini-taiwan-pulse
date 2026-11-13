// 越南圖層 popup（2026-11-13 第 0–1 波）。規格與署名 SSOT 在 data/vnDataLayers.ts；規格驅動層重用菲律賓 makePhPanel。
// 來源與授權由 panel 自掛 SourceFooter（FOOTER_SELF_MANAGED）；分檔的層依 feature `source` 欄選署名。空值列由 Row 自動隱藏，不寫 0。
import type { FC } from "react";
import { Row, SourceFooter, Title } from "./shared";
import { TrendChart } from "./landSubsidencePanels";
import { useLocale } from "../../state/localeStore";
import { caText } from "../../data/caInfraTypes";
import { makePhPanel } from "./phPanels";
import {
  VN_ADMIN_COLOR, VN_ADMIN_SOURCE, VN_DATA_SPECS, VN_FETCHED_AT, VN_POP_YEARS, VN_POPULATION_SOURCE, pickL3, vnMoreSpec, type L3,
} from "../../data/vnDataLayers";
import type { VnDataKey } from "../../data/vnDataKeys";

type P = { props: Record<string, unknown> };

function fmtNum(v: unknown, digits = 0): string {
  const s = caText(v);
  const n = Number(s);
  return s !== "" && Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: digits }) : "";
}

/** 行政邊界：省名、類型、新社數、併入的舊省、面積。 */
export function VnAdminBoundariesPanel({ props }: P) {
  const { locale } = useLocale();
  const pick = (t: L3) => pickL3(t, locale);
  const name = locale === "en" ? caText(props.name_ascii) || caText(props.name) : caText(props.name);
  const area = fmtNum(props.area_km2, 1);
  return <>
    <Title color={VN_ADMIN_COLOR}>{name || pick({ zh: "省", en: "Province", ja: "省" })}</Title>
    <Row label={pick({ zh: "全名", en: "Full name", ja: "正式名称" })} value={caText(props.name_full)} />
    <Row label={pick({ zh: "類型（NSO）", en: "Type (NSO)", ja: "種別（NSO）" })} value={caText(props.unit_type)} />
    <Row label={pick({ zh: "新制社數", en: "Communes (2025)", ja: "社の数（2025 新制）" })} value={fmtNum(props.communes)} />
    <Row label={pick({ zh: "併入的舊省", en: "Former provinces merged", ja: "統合された旧省" })} value={caText(props.old_provinces)} />
    <Row label={pick({ zh: "面積", en: "Area", ja: "面積" })} value={area ? `${area} km²` : ""} />
    <Row label={pick({ zh: "省代碼（NSO）", en: "Province code (NSO)", ja: "省コード（NSO）" })} value={caText(props.province_code)} mono />
    <SourceFooter props={{ source_org: VN_ADMIN_SOURCE.org, source_url: VN_ADMIN_SOURCE.url, license: VN_ADMIN_SOURCE.license, fetched_at: VN_FETCHED_AT }} />
  </>;
}

/** 人口：2025 人口與密度、2011–2025 折線（舊 63 省加總）；Đồng Tháp、Tây Ninh 顯示歷年說明。 */
export function VnPopulationPanel({ props }: P) {
  const { locale } = useLocale();
  const pick = (t: L3) => pickL3(t, locale);
  const noData = pick({ zh: "未涵蓋", en: "Not covered", ja: "未収録" });
  const name = locale === "en" ? caText(props.name_ascii) || caText(props.name) : caText(props.name);
  const density = fmtNum(props.density_per_km2, 1);
  const points = VN_POP_YEARS.map((y) => ({ t: Date.UTC(y, 0, 1), v: Number(caText(props[`pop_${y}`])) }))
    .filter((p) => caText(props[`pop_${new Date(p.t).getUTCFullYear()}`]) !== "" && Number.isFinite(p.v));
  return <>
    <Title color="#f59e0b">{name || pick({ zh: "省", en: "Province", ja: "省" })}</Title>
    <Row label={pick({ zh: "2025 人口", en: "Population 2025", ja: "2025 年人口" })} value={fmtNum(props.population) || noData} />
    <Row label={pick({ zh: "人口密度", en: "Density", ja: "人口密度" })} value={density ? `${density} ${pick({ zh: "人／km²", en: "people/km²", ja: "人／km²" })}` : noData} />
    {points.length > 1 ? <TrendChart points={points} color="#f59e0b" unit={pick({ zh: "人口（2011–2025）", en: "Population (2011–2025)", ja: "人口（2011–2025）" })} /> : null}
    <Row label={pick({ zh: "歷年說明", en: "History note", ja: "経年の注記" })} value={caText(props.history_note)} />
    <SourceFooter props={{ source_org: VN_POPULATION_SOURCE.org, source_url: VN_POPULATION_SOURCE.url, license: VN_POPULATION_SOURCE.license, fetched_at: VN_FETCHED_AT }} />
  </>;
}

/** 規格驅動層：分檔的層依 `source` 選主檔或第二檔的 panel（署名不同）。 */
function makeVnPanel(key: VnDataKey): FC<P> {
  const spec = VN_DATA_SPECS.find((s) => s.key === key)!;
  const Main = makePhPanel(spec);
  const more = vnMoreSpec(spec);
  if (!more) return Main;
  const More = makePhPanel(more);
  const value = spec.more!.sourceValue;
  return function VnDataPanel({ props }) {
    return caText(props.source) === value ? <More props={props} /> : <Main props={props} />;
  };
}

export const VN_DATA_PANELS = Object.fromEntries(VN_DATA_SPECS.map((s) => [s.key, makeVnPanel(s.key)])) as Record<VnDataKey, FC<P>>;

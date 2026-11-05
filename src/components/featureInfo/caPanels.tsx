// 加拿大圖層 popup（第 0＋1 波）。欄位規格 SSOT 在 data/caInfraTypes.ts 的 CA_*_POPUP；
// 同一 key 有多個 tile layer 時，點擊端（useMapInteraction）會把命中的 source-layer 放進 `_ca_source_layer`。
// 來源與授權由 panel 自掛 SourceFooter（FOOTER_SELF_MANAGED）。
import { Row, SourceFooter, Title } from "./shared";
import { useLocale } from "../../state/localeStore";
import { LinkRow } from "./atlasPanels";
import { caCimdColors, caRentColors, CA_NA_POINT_COLOR } from "../../hooks/useCaAreaLayers";
import { LIGHT_FEATURE, useFeatureTheme } from "./featureTheme";
import {
  CA_ADMIN_COLOR, CA_ADMIN_LEVEL_LABELS, CA_ADMIN_SOURCE, CA_AIRPORT_POPUP, CA_AIRPORTS_SOURCE, CA_FALLBACK_COLOR, CA_FETCHED_AT, CA_GRID_SOURCE,
  CA_NO_DATA, CA_OIL_GAS_POPUPS, CA_OIL_GAS_SOURCE, CA_PLANT_POPUP, CA_PLANTS_SOURCE, CA_POP_POPUP, CA_POP_PROVINCE_PART, CA_POP_SOURCE,
  CA_PORT_POPUP, CA_POWER_LINE_COLOR, CA_POWER_LINE_POPUP, CA_RAIL_SOURCE, CA_RAIL_STATION_POPUP, CA_RAIL_TRACK_POPUP, CA_ROAD_POPUP,
  CA_ROADS_SOURCE, CA_SUBSTATION_COLOR, CA_SUBSTATION_POPUP, CA_TRANSIT_COLOR, CA_TRANSIT_POPUP, CA_TRANSIT_SOURCE, CA_WIND_COLOR,
  CA_WIND_POPUP, CA_WIND_SOURCE, CA_CIMD_DIMENSIONS, CA_CIMD_ETHNO_NOTE, CA_CIMD_SOURCE, CA_FED_POPUP, CA_FED_SOURCE, CA_FSA_CLASSES, CA_FSA_POPUP,
  CA_FSA_SOURCE, CA_INDIGENOUS_POPUP, CA_INDIGENOUS_SOURCE, CA_INDIGENOUS_TYPES, CA_PLACE_GROUPS, CA_PLACE_NAMES_POPUP, CA_PLACE_NAMES_SOURCE,
  CA_RENT_UNITS, CA_RENTS_NOT_PUBLISHED, CA_RENTS_SOURCE, caText, pickL3, type CaOilGasPart, type CaPopupSpec, type CaSource, type L3,
} from "../../data/caInfraTypes";

type P = { props: Record<string, unknown> };

function fmtNum(v: unknown, digits = 0): string {
  const n = typeof v === "number" ? v : Number(caText(v));
  return Number.isFinite(n) && caText(v) !== "" ? n.toLocaleString(undefined, { maximumFractionDigits: digits }) : "";
}

function Footer({ source, fetchedAt = CA_FETCHED_AT }: { source: CaSource; fetchedAt?: string }) {
  return <SourceFooter props={{ source_org: source.org, source_url: source.url, license: source.license, fetched_at: fetchedAt }} />;
}

/** 依 CaPopupSpec 畫標題與欄位；空值整列省略。第 3 波（caEnvPanels）共用，傳自己的 fetchedAt。 */
export function SpecPanel({ props, spec, source, color, extra, hideFooter, fetchedAt }: P & { spec: CaPopupSpec; source: CaSource; color: string; extra?: string; hideFooter?: boolean; fetchedAt?: string }) {
  const { locale } = useLocale();
  const pick = (t: L3) => pickL3(t, locale);
  const title = spec.title.props.map((p) => caText(props[p])).find(Boolean) || pick(spec.title.fallback);
  return <>
    <Title color={color}>{title}</Title>
    {spec.typeLabel ? <Row label={pick({ zh: "類型", en: "Type", ja: "種別" })} value={pick(spec.typeLabel)} /> : null}
    {spec.fields.map((f) => {
      const raw = caText(props[f.prop]);
      if (!raw) return null;
      let value = raw;
      if (f.map) value = f.map[raw] ? pick(f.map[raw]!) : raw;
      else if (f.kind === "num") {
        if (f.positive && !(Number(props[f.prop]) > 0)) return null;
        const n = fmtNum(props[f.prop], f.digits ?? 0);
        if (!n) return null;
        value = f.unit ? `${n} ${f.unit}` : n;
      } else if (f.kind === "bool") value = /^(true|1|yes)$/i.test(raw) ? pick({ zh: "是", en: "Yes", ja: "はい" }) : pick({ zh: "否", en: "No", ja: "いいえ" });
      return <Row key={f.prop} label={pick(f.label)} value={value} mono={f.kind === "code"} />;
    })}
    {extra ? <Row label={pick({ zh: "備註", en: "Note", ja: "備考" })} value={extra} /> : null}
    {(spec.notes ?? []).map((n, i) => <Row key={`n${i}`} label={i === 0 ? pick({ zh: "說明", en: "About", ja: "説明" }) : ""} value={pick(n)} />)}
    {hideFooter ? null : <Footer source={source} fetchedAt={fetchedAt} />}
  </>;
}

const layerOf = (props: Record<string, unknown>) => caText(props._ca_source_layer);

/** 行政邊界：名稱依語系（省級有英／法名）、層級、所屬、人口（無資料不寫 0）、陸地面積。 */
export function CaAdminBoundariesPanel({ props }: P) {
  const { locale } = useLocale();
  const pick = (t: L3) => pickL3(t, locale);
  const level = caText(props.level) as keyof typeof CA_ADMIN_LEVEL_LABELS;
  const name = (level === "pr" ? caText(locale === "zh-TW" || locale === "ja" ? props.name : props.name_en) : "") || caText(props.name);
  const bilingual = level === "pr" && caText(props.name_en) && caText(props.name_fr) && caText(props.name_en) !== caText(props.name_fr)
    ? `${caText(props.name_en)} / ${caText(props.name_fr)}` : "";
  const popAvailable = props.pop_available === true || props.pop_available === "true";
  const pop = popAvailable ? fmtNum(props.population) : "";
  const area = fmtNum(props.land_area_km2, 1);
  return <>
    <Title color={CA_ADMIN_COLOR}>{name || pick({ zh: "行政區", en: "Administrative area", ja: "行政区域" })}</Title>
    {CA_ADMIN_LEVEL_LABELS[level] ? <Row label={pick({ zh: "層級", en: "Level", ja: "階層" })} value={pick(CA_ADMIN_LEVEL_LABELS[level])} /> : null}
    {bilingual ? <Row label={pick({ zh: "英／法名", en: "English / French", ja: "英語・仏語名" })} value={bilingual} /> : null}
    {level !== "pr" && caText(props.province) ? <Row label={pick({ zh: "省／地區", en: "Province / territory", ja: "州・準州" })} value={caText(props.province)} /> : null}
    {level === "csd" && caText(props.cd_name) ? <Row label={pick({ zh: "所屬普查區", en: "Census division", ja: "所属センサス区" })} value={caText(props.cd_name)} /> : null}
    {caText(props.cd_type) || caText(props.csd_type) ? <Row label={pick({ zh: "類型代碼", en: "Type code", ja: "種別コード" })} value={caText(props.cd_type) || caText(props.csd_type)} mono /> : null}
    <Row label={pick({ zh: "2021 人口", en: "Population 2021", ja: "2021 年人口" })} value={pop || pick(CA_NO_DATA)} />
    {area ? <Row label={pick({ zh: "陸地面積", en: "Land area", ja: "陸地面積" })} value={`${area} km²`} /> : null}
    {caText(props.dguid) ? <Row label="DGUID" value={caText(props.dguid)} mono /> : null}
    <Footer source={CA_ADMIN_SOURCE} />
  </>;
}

export function CaTransitStopsPanel({ props }: P) {
  return <SpecPanel props={props} spec={CA_TRANSIT_POPUP} source={CA_TRANSIT_SOURCE} color={CA_TRANSIT_COLOR} />;
}

export function CaAirportsPortsPanel({ props }: P) {
  const isPort = layerOf(props) === "ca_ports";
  return <SpecPanel props={props} spec={isPort ? CA_PORT_POPUP : CA_AIRPORT_POPUP} source={CA_AIRPORTS_SOURCE} color={CA_FALLBACK_COLOR} />;
}

export function CaMajorRoadsPanel({ props }: P) {
  return <SpecPanel props={props} spec={CA_ROAD_POPUP} source={CA_ROADS_SOURCE} color={CA_FALLBACK_COLOR} />;
}

export function CaRailwaysPanel({ props }: P) {
  const isStation = layerOf(props) === "ca_rail_stations";
  return <SpecPanel props={props} spec={isStation ? CA_RAIL_STATION_POPUP : CA_RAIL_TRACK_POPUP} source={CA_RAIL_SOURCE} color={CA_FALLBACK_COLOR} />;
}

export function CaPowerPlantsPanel({ props }: P) {
  return <SpecPanel props={props} spec={CA_PLANT_POPUP} source={CA_PLANTS_SOURCE} color={CA_FALLBACK_COLOR} />;
}

export function CaWindTurbinesPanel({ props }: P) {
  return <SpecPanel props={props} spec={CA_WIND_POPUP} source={CA_WIND_SOURCE} color={CA_WIND_COLOR} />;
}

export function CaPowerGridPanel({ props }: P) {
  const isSub = layerOf(props) === "ca_power_substations";
  return <SpecPanel props={props} spec={isSub ? CA_SUBSTATION_POPUP : CA_POWER_LINE_POPUP} source={CA_GRID_SOURCE} color={isSub ? CA_SUBSTATION_COLOR : CA_POWER_LINE_COLOR} />;
}

const OIL_GAS_LAYER_PART: Record<string, CaOilGasPart> = {
  ca_oil_gas_major_pipelines: "major_pipelines",
  ca_oil_gas_major_facilities: "major_facilities",
  ca_oil_gas_wells: "wells",
  ca_oil_gas_facilities: "facilities",
  ca_oil_gas_pipelines: "pipelines",
  ca_oil_gas_pipeline_points: "pipeline_points",
};
export function CaOilGasPanel({ props }: P) {
  const part = OIL_GAS_LAYER_PART[layerOf(props)] ?? "facilities";
  return <SpecPanel props={props} spec={CA_OIL_GAS_POPUPS[part]} source={CA_OIL_GAS_SOURCE} color={CA_FALLBACK_COLOR} />;
}

export function CaPopulationCentresPanel({ props }: P) {
  const { locale } = useLocale();
  const whole = fmtNum(props.population_2021_whole_pc);
  const part = fmtNum(props.population_2021);
  const extra = whole && part && whole !== part ? pickL3(CA_POP_PROVINCE_PART, locale).replace("{n}", whole) : undefined;
  return <SpecPanel props={props} spec={CA_POP_POPUP} source={CA_POP_SOURCE} color={CA_FALLBACK_COLOR} extra={extra} />;
}

// ─────────────────────────── 第 2 波 ───────────────────────────

const catColorOf = (cats: readonly { values: readonly string[]; color: string }[], raw: string) => cats.find((c) => c.values.includes(raw))?.color ?? CA_FALLBACK_COLOR;

export function CaFederalDistrictsPanel({ props }: P) {
  return <SpecPanel props={props} spec={CA_FED_POPUP} source={CA_FED_SOURCE} color={CA_ADMIN_COLOR} />;
}

export function CaPostalFsaPanel({ props }: P) {
  return <SpecPanel props={props} spec={CA_FSA_POPUP} source={CA_FSA_SOURCE} color={catColorOf(CA_FSA_CLASSES, caText(props.rural))} />;
}

/** 原住民法定土地：固定註記「不可用於界定邊界」＋ CLSS 地圖連結（web_ref）。 */
export function CaIndigenousLandsPanel({ props }: P) {
  const { locale } = useLocale();
  const url = caText(props.web_ref);
  return <>
    <SpecPanel props={props} spec={{ ...CA_INDIGENOUS_POPUP, notes: [] }} source={CA_INDIGENOUS_SOURCE} color={catColorOf(CA_INDIGENOUS_TYPES, caText(props.dist_type_en))} hideFooter />
    {/^https?:\/\//.test(url) ? <LinkRow label={pickL3({ zh: "CLSS 地圖", en: "CLSS map", ja: "CLSS 地図" }, locale)} url={url} /> : null}
    {(CA_INDIGENOUS_POPUP.notes ?? []).map((n, i) => <Row key={i} label={pickL3({ zh: "說明", en: "About", ja: "説明" }, locale)} value={pickL3(n, locale)} />)}
    <Footer source={CA_INDIGENOUS_SOURCE} />
  </>;
}

/** CIMD：四面向五分位（score 小字）；缺值寫「無指數」，不當 0。 */
export function CaDeprivationPanel({ props }: P) {
  const { locale } = useLocale();
  const isDark = useFeatureTheme() !== LIGHT_FEATURE;
  const pick = (x: L3) => pickL3(x, locale);
  const colors = caCimdColors(isDark);
  const q0 = Number(caText(props.econ_dep_q));
  return <>
    <Title color={Number.isFinite(q0) && q0 >= 1 && q0 <= 5 ? colors[q0 - 1]! : CA_NA_POINT_COLOR}>{`DA ${caText(props.dauid)}`}</Title>
    {caText(props.province) ? <Row label={pick({ zh: "省", en: "Province", ja: "州" })} value={caText(props.province)} /> : null}
    {fmtNum(props.da_population) ? <Row label={pick({ zh: "DA 人口（2021）", en: "DA population (2021)", ja: "DA 人口（2021）" })} value={fmtNum(props.da_population)} /> : null}
    {CA_CIMD_DIMENSIONS.map((d) => {
      const q = caText(props[`${d.value}_q`]);
      const sc = fmtNum(props[`${d.value}_s`], 2);
      const value = q ? `${q} / 5${sc ? `（score ${sc}）` : ""}` : pick({ zh: "無指數", en: "No index", ja: "指数なし" });
      return <Row key={d.value} label={pick(d.label)} value={value} />;
    })}
    <Row label={pick({ zh: "說明", en: "About", ja: "説明" })} value={pick({ zh: "全國 DA 五分位：1 最不剝奪、5 最剝奪", en: "National DA quintile: 1 least, 5 most deprived", ja: "全国 DA 五分位：1 最も少ない、5 最も多い" })} />
    <Row label="" value={pick(CA_CIMD_ETHNO_NOTE)} />
    <Footer source={CA_CIMD_SOURCE} />
  </>;
}

/** CMHC 租金：四房型月租（空值寫「不公布」，不當 0）、資料年、CMHC 原地區名（與邊界名不同時）。 */
export function CaRentsPanel({ props }: P) {
  const { locale } = useLocale();
  const isDark = useFeatureTheme() !== LIGHT_FEATURE;
  const pick = (x: L3) => pickL3(x, locale);
  const name = caText(props.name);
  const cmhc = caText(props.cmhc_geo);
  const br2 = Number(caText(props.rent_br2));
  const u2 = CA_RENT_UNITS[0];
  const color = Number.isFinite(br2) && caText(props.rent_br2) ? caRentColors(isDark)[u2.breaks.filter((b) => br2 >= b).length]! : CA_NA_POINT_COLOR;
  return <>
    <Title color={color}>{name || pick({ zh: "都會區", en: "Metropolitan area", ja: "都市圏" })}</Title>
    {caText(props.cma_type) ? <Row label={pick({ zh: "類型", en: "Type", ja: "種別" })} value={caText(props.cma_type).replace("（分 tract）", pick({ zh: "（分 tract）", en: " (tracted)", ja: "（tract 区分あり）" }))} /> : null}
    {caText(props.province) ? <Row label={pick({ zh: "省／地區", en: "Province / territory", ja: "州・準州" })} value={caText(props.province)} /> : null}
    {CA_RENT_UNITS.map((u) => {
      const v = fmtNum(props[u.prop]);
      return <Row key={u.value} label={pick(u.label)} value={v ? `CAD ${v}` : pick(CA_RENTS_NOT_PUBLISHED)} />;
    })}
    {caText(props.ref_year) ? <Row label={pick({ zh: "資料年", en: "Year", ja: "データ年" })} value={`${caText(props.ref_year)}（10 月）`} /> : null}
    {cmhc && !cmhc.startsWith(name) ? <Row label={pick({ zh: "CMHC 地區名", en: "CMHC area name", ja: "CMHC 地域名" })} value={cmhc} /> : null}
    <Footer source={CA_RENTS_SOURCE} />
  </>;
}

export function CaPlaceNamesPanel({ props }: P) {
  return <SpecPanel props={props} spec={CA_PLACE_NAMES_POPUP} source={CA_PLACE_NAMES_SOURCE} color={catColorOf(CA_PLACE_GROUPS, caText(props.group))} />;
}

// 加拿大第 0＋1 波圖例（行政邊界、交通 4 層、能源 4 層、人口中心）。色票、類別、備註與署名 SSOT 在 data/caInfraTypes.ts。
// 未涵蓋的省份寫「未涵蓋」；電廠、電網標資料年份；油氣標「亞伯達井點非全量」；GTFS 標「授權依各機構」。
import type { ReactNode } from "react";
import { LegendNote, LegendRow, LegendSizeRow, LegendTitle, SwatchDot, SwatchGradient, SwatchHatch, SwatchLine, SwatchSquare, SwatchSteps, useLegendTheme } from "./legendKit";
import { useKeyOverlayParams } from "../../layers/layerParamsAccess";
import { CA_NA_POINT_COLOR, caCimdColors, caCimdDimensionFromIdx, caRentColors, caRentUnitFromIdx } from "../../hooks/useCaAreaLayers";
import { DenseHeatmapLegendRow } from "./legendShared";
import { LAYER_MANIFEST, type LayerName } from "../../data/layerManifest";
import { localizeLayerName } from "../../i18n/layerText";
import { useLocale } from "../../state/localeStore";
import { BOUNDARY_GRAY, LINE_DASH, LINE_WIDTH } from "../../map/mapStyleScale";
import {
  CA_ADMIN_NOTES, CA_ADMIN_SOURCE, CA_AIRPORT_CLASSES, CA_AIRPORTS_NOTES, CA_AIRPORTS_SOURCE, CA_CAPACITY_BANDS, CA_FALLBACK_COLOR, CA_GRID_NOTES,
  CA_GRID_SOURCE, CA_MAJOR_FACILITY_TYPES, CA_OIL_GAS_FACILITY_COLOR, CA_OIL_GAS_NOTES, CA_OIL_GAS_PARTS, CA_OIL_GAS_PIPE_POINT_COLOR, CA_OIL_GAS_SOURCE,
  CA_OIL_GAS_WELL_COLOR, CA_PIPELINE_SUBSTANCES, CA_PLANT_FUELS, CA_PLANTS_NOTES, CA_PLANTS_SOURCE, CA_POP_BANDS, CA_POP_CLASSES, CA_POP_NOTES, CA_POP_SOURCE,
  CA_PORT_TYPES, CA_POWER_LINE_COLOR, CA_RAIL_NOTES, CA_RAIL_SOURCE, CA_RAIL_STATION_TYPES, CA_RAIL_TRACK_CLASSES, CA_ROAD_CLASSES, CA_ROADS_NOTES, CA_ROADS_SOURCE,
  CA_CIMD_DIMENSIONS, CA_CIMD_NOTES, CA_CIMD_QUINTILE_LABELS, CA_CIMD_SOURCE, CA_FED_NOTES, CA_FED_SOURCE, CA_FSA_CLASSES, CA_FSA_NOTES, CA_FSA_SOURCE,
  CA_HILLSHADE_NOTES, CA_HILLSHADE_SOURCE, CA_INDIGENOUS_NOTES, CA_INDIGENOUS_SOURCE, CA_INDIGENOUS_TYPES, CA_PLACE_GROUPS, CA_PLACE_NAMES_NOTES,
  CA_PLACE_NAMES_SOURCE, CA_RENT_UNITS, CA_RENTS_NOTES, CA_RENTS_SOURCE,
  CA_SUBSTATION_COLOR, CA_TRANSIT_NOTES, CA_TRANSIT_SOURCE, CA_TRANSIT_TYPES, CA_WIND_COLOR, CA_WIND_NOTES, CA_WIND_SOURCE, pickL3, type CaCat, type CaSource, type L3,
} from "../../data/caInfraTypes";

type I18n = ReturnType<typeof useLocale>;
function useTitle(key: string): { title: string; i18n: I18n; pick: (t: L3) => string } {
  const i18n = useLocale();
  const name = (LAYER_MANIFEST as Record<string, { name?: LayerName }>)[key]?.name;
  return { title: name ? localizeLayerName(key, name, i18n).primary : key, i18n, pick: (t: L3) => pickL3(t, i18n.locale) };
}
const SUB = (text: string): ReactNode => <LegendTitle zh={text} style={{ marginTop: 6, marginBottom: 2 }} />;
function Cats({ cats, pick, line }: { cats: readonly CaCat[]; pick: (t: L3) => string; line?: number }) {
  return <>{cats.map((c) => <LegendRow key={c.id} swatch={line ? <SwatchLine color={c.color} width={line} /> : <SwatchDot color={c.color} />}>{pick(c.label)}</LegendRow>)}</>;
}
function Notes({ notes, source, pick }: { notes: readonly L3[]; source: CaSource; pick: (t: L3) => string }) {
  return <>
    {notes.map((n, i) => <LegendNote key={i}>{pick(n)}</LegendNote>)}
    <LegendNote>{source.short}</LegendNote>
  </>;
}

export function CaAdminBoundariesLegend() {
  const { title, pick } = useTitle("caAdminBoundaries");
  const t = useLegendTheme();
  return <div>
    <LegendTitle zh={title} />
    <LegendRow swatch={<SwatchLine color={BOUNDARY_GRAY[t.isDark ? "dark" : "light"]} />}>{pick({ zh: "行政區界（省／地區、普查區、普查分區）", en: "Boundary (province / census division / subdivision)", ja: "行政区域界（州・センサス区・小区）" })}</LegendRow>
    <Notes notes={CA_ADMIN_NOTES} source={CA_ADMIN_SOURCE} pick={pick} />
  </div>;
}

export function CaTransitStopsLegend() {
  const { title, pick } = useTitle("caTransitStops");
  return <div>
    <LegendTitle zh={title} />
    <Cats cats={CA_TRANSIT_TYPES} pick={pick} />
    <Notes notes={CA_TRANSIT_NOTES} source={CA_TRANSIT_SOURCE} pick={pick} />
    <DenseHeatmapLegendRow layers={["caTransitStops"]} />
  </div>;
}

export function CaAirportsPortsLegend() {
  const { title, pick } = useTitle("caAirportsPorts");
  return <div>
    <LegendTitle zh={title} />
    {SUB(pick({ zh: "機場", en: "Airports", ja: "空港" }))}
    <Cats cats={CA_AIRPORT_CLASSES} pick={pick} />
    {SUB(pick({ zh: "港口", en: "Ports", ja: "港湾" }))}
    <Cats cats={CA_PORT_TYPES} pick={pick} />
    <Notes notes={CA_AIRPORTS_NOTES} source={CA_AIRPORTS_SOURCE} pick={pick} />
  </div>;
}

export function CaMajorRoadsLegend() {
  const { title, pick } = useTitle("caMajorRoads");
  return <div>
    <LegendTitle zh={title} />
    {CA_ROAD_CLASSES.map((c) => <LegendRow key={c.id} swatch={<SwatchLine color={c.color} width={LINE_WIDTH[c.width][1]} />}>{pick(c.label)}</LegendRow>)}
    <Notes notes={CA_ROADS_NOTES} source={CA_ROADS_SOURCE} pick={pick} />
  </div>;
}

export function CaRailwaysLegend() {
  const { title, pick } = useTitle("caRailways");
  return <div>
    <LegendTitle zh={title} />
    {CA_RAIL_TRACK_CLASSES.map((c) => <LegendRow key={c.id} swatch={<SwatchLine color={c.color} width={LINE_WIDTH[c.width][1]} opacity={c.opacity} />}>{pick(c.label)}</LegendRow>)}
    {SUB(pick({ zh: "車站（z8 起）", en: "Stations (zoom 8+)", ja: "駅（ズーム 8 以上）" }))}
    <Cats cats={CA_RAIL_STATION_TYPES} pick={pick} />
    <Notes notes={CA_RAIL_NOTES} source={CA_RAIL_SOURCE} pick={pick} />
  </div>;
}

export function CaPowerPlantsLegend() {
  const { title, pick } = useTitle("caPowerPlants");
  return <div>
    <LegendTitle zh={`${title}（2017）`} />
    <Cats cats={CA_PLANT_FUELS} pick={pick} />
    <LegendSizeRow fill={CA_FALLBACK_COLOR} title={pick({ zh: "裝置容量（MW）", en: "Capacity (MW)", ja: "設備容量（MW）" })} items={CA_CAPACITY_BANDS.map((b) => ({ r: b.radius, label: b.label }))} />
    <Notes notes={CA_PLANTS_NOTES} source={CA_PLANTS_SOURCE} pick={pick} />
  </div>;
}

export function CaWindTurbinesLegend() {
  const { title, pick } = useTitle("caWindTurbines");
  return <div>
    <LegendTitle zh={title} />
    <LegendRow swatch={<SwatchDot color={CA_WIND_COLOR} />}>{pick({ zh: "風機（陸域）", en: "Wind turbine (onshore)", ja: "風車（陸上）" })}</LegendRow>
    <Notes notes={CA_WIND_NOTES} source={CA_WIND_SOURCE} pick={pick} />
  </div>;
}

export function CaPowerGridLegend() {
  const { title, pick } = useTitle("caPowerGrid");
  return <div>
    <LegendTitle zh={`${title}（CanVec 2019）`} />
    <LegendRow swatch={<SwatchLine color={CA_POWER_LINE_COLOR} width={2} />}>{pick({ zh: "電力線（不分電壓）", en: "Power line (voltage not given)", ja: "送電線（電圧区分なし）" })}</LegendRow>
    <LegendRow swatch={<SwatchLine color={CA_POWER_LINE_COLOR} width={2} dash={LINE_DASH.general} />}>{pick({ zh: "電力線（水下）", en: "Power line (underwater)", ja: "送電線（水中）" })}</LegendRow>
    <LegendRow swatch={<SwatchDot color={CA_SUBSTATION_COLOR} />}>{pick({ zh: "變電站（z7 起）", en: "Substation (zoom 7+)", ja: "変電所（ズーム 7 以上）" })}</LegendRow>
    <Notes notes={CA_GRID_NOTES} source={CA_GRID_SOURCE} pick={pick} />
  </div>;
}

export function CaOilGasLegend() {
  const { title, pick } = useTitle("caOilGas");
  return <div>
    <LegendTitle zh={title} />
    {SUB(pick(CA_OIL_GAS_PARTS[0].label))}
    {SUB(pick({ zh: "管線物質（主要與集輸管線共用）", en: "Pipeline substance (major and gathering lines)", ja: "パイプラインの物質（主要・集輸共通）" }))}
    <Cats cats={CA_PIPELINE_SUBSTANCES} pick={pick} line={2} />
    {SUB(pick(CA_OIL_GAS_PARTS[1].label))}
    <Cats cats={CA_MAJOR_FACILITY_TYPES} pick={pick} />
    {SUB(pick({ zh: "ODI 點位", en: "ODI points", ja: "ODI 地点" }))}
    <LegendRow swatch={<SwatchDot color={CA_OIL_GAS_WELL_COLOR} />}>{pick(CA_OIL_GAS_PARTS[2].label)}</LegendRow>
    <LegendRow swatch={<SwatchDot color={CA_OIL_GAS_FACILITY_COLOR} />}>{pick(CA_OIL_GAS_PARTS[3].label)}</LegendRow>
    <LegendRow swatch={<SwatchDot color={CA_OIL_GAS_PIPE_POINT_COLOR} />}>{pick(CA_OIL_GAS_PARTS[5].label)}</LegendRow>
    <Notes notes={CA_OIL_GAS_NOTES} source={CA_OIL_GAS_SOURCE} pick={pick} />
    <DenseHeatmapLegendRow layers={["caOilGas"]} />
  </div>;
}

export function CaPopulationCentresLegend() {
  const { title, pick } = useTitle("caPopulationCentres");
  return <div>
    <LegendTitle zh={`${title}（2021）`} />
    <Cats cats={CA_POP_CLASSES} pick={pick} />
    <LegendSizeRow fill={CA_POP_CLASSES[1]!.color} title={pick({ zh: "代表點大小：2021 人口", en: "Point size: population 2021", ja: "代表点の大きさ：2021 年人口" })} items={CA_POP_BANDS.map((b) => ({ r: b.radius, label: b.label }))} />
    <Notes notes={CA_POP_NOTES} source={CA_POP_SOURCE} pick={pick} />
  </div>;
}

// ─────────────────────────── 第 2 波 ───────────────────────────

export function CaFederalDistrictsLegend() {
  const { title, pick } = useTitle("caFederalDistricts");
  const t = useLegendTheme();
  return <div>
    <LegendTitle zh={title} />
    <LegendRow swatch={<SwatchLine color={BOUNDARY_GRAY[t.isDark ? "dark" : "light"]} />}>{pick({ zh: "聯邦選區（2013 代表令，338 區）", en: "Federal electoral district (2013 Representation Order, 338)", ja: "連邦選挙区（2013 年代表令、338 区）" })}</LegendRow>
    <Notes notes={CA_FED_NOTES} source={CA_FED_SOURCE} pick={pick} />
  </div>;
}

export function CaPostalFsaLegend() {
  const { title, pick } = useTitle("caPostalFsa");
  return <div>
    <LegendTitle zh={title} />
    {CA_FSA_CLASSES.map((c) => <LegendRow key={c.id} swatch={<SwatchSquare color={c.color} />}>{pick(c.label)}</LegendRow>)}
    <Notes notes={CA_FSA_NOTES} source={CA_FSA_SOURCE} pick={pick} />
    <DenseHeatmapLegendRow layers={["caPostalFsa"]} />
  </div>;
}

export function CaIndigenousLandsLegend() {
  const { title, pick } = useTitle("caIndigenousLands");
  return <div>
    <LegendTitle zh={title} />
    {CA_INDIGENOUS_TYPES.map((c) => <LegendRow key={c.id} swatch={<SwatchSquare color={c.color} />}>{pick(c.label)}</LegendRow>)}
    <Notes notes={CA_INDIGENOUS_NOTES} source={CA_INDIGENOUS_SOURCE} pick={pick} />
  </div>;
}

export function CaDeprivationLegend() {
  const { title, pick } = useTitle("caDeprivation");
  const t = useLegendTheme();
  const p = useKeyOverlayParams("caDeprivation");
  const dim = caCimdDimensionFromIdx(p.caDeprivationDimensionIdx);
  const dimLabel = CA_CIMD_DIMENSIONS.find((d) => d.value === dim)!.label;
  return <div>
    <LegendTitle zh={`${title}（2021）`} />
    {SUB(pick(dimLabel))}
    <SwatchSteps colors={caCimdColors(t.isDark)} breaks={CA_CIMD_QUINTILE_LABELS.map((l, i) => (i === 0 || i === 4 ? pick(l) : ""))} />
    <LegendRow swatch={<SwatchHatch />}>{pick({ zh: "無指數（面為斜線、點為灰）", en: "No index (hatched area / grey dot)", ja: "指数なし（面は斜線、点は灰色）" })}</LegendRow>
    <LegendRow swatch={<SwatchDot color={CA_NA_POINT_COLOR} />}>{pick({ zh: "無指數代表點", en: "Representative point without index", ja: "指数なしの代表点" })}</LegendRow>
    <Notes notes={CA_CIMD_NOTES} source={CA_CIMD_SOURCE} pick={pick} />
  </div>;
}

export function CaRentsLegend() {
  const { title, pick } = useTitle("caRents");
  const t = useLegendTheme();
  const p = useKeyOverlayParams("caRents");
  const unit = CA_RENT_UNITS.find((u) => u.value === caRentUnitFromIdx(p.caRentsUnitIdx))!;
  const fmt = (n: number) => n.toLocaleString("en-US");
  return <div>
    <LegendTitle zh={`${title}（2025）`} />
    {SUB(pick({ zh: `${unit.label.zh}平均月租（加元）`, en: `Average rent, ${unit.label.en} (CAD)`, ja: `${unit.label.ja}の平均月額家賃（カナダドル）` }))}
    <SwatchSteps colors={caRentColors(t.isDark)} breaks={["", ...unit.breaks.map(fmt), ""]} />
    <LegendRow swatch={<SwatchHatch />}>{pick({ zh: "不公布／無資料（面為斜線、點為灰）", en: "Not published / no data (hatched area / grey dot)", ja: "非公表・データなし（面は斜線、点は灰色）" })}</LegendRow>
    <Notes notes={CA_RENTS_NOTES} source={CA_RENTS_SOURCE} pick={pick} />
  </div>;
}

export function CaPlaceNamesLegend() {
  const { title, pick } = useTitle("caPlaceNames");
  return <div>
    <LegendTitle zh={title} />
    <Cats cats={CA_PLACE_GROUPS} pick={pick} />
    <Notes notes={CA_PLACE_NAMES_NOTES} source={CA_PLACE_NAMES_SOURCE} pick={pick} />
  </div>;
}

export function CaHillshadeLegend() {
  const { title, pick } = useTitle("caHillshade");
  return <div>
    <LegendTitle zh={pick({ zh: `${title}（MRDEM-30，240 m）`, en: `${title} (MRDEM-30, 240 m)`, ja: `${title}（MRDEM-30、240 m）` })} />
    <SwatchGradient gradient="linear-gradient(90deg, #000000, #ffffff)" labels={[pick({ zh: "背光坡", en: "Shaded", ja: "陰" }), pick({ zh: "向光坡", en: "Lit", ja: "陽" })]} />
    <Notes notes={CA_HILLSHADE_NOTES} source={CA_HILLSHADE_SOURCE} pick={pick} />
  </div>;
}

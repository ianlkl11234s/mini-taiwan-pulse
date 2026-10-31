// 南韓第 1 波（國土基礎）圖例：交通 6 層＋能源 7 層。色票與署名 SSOT 在 data/krInfraTypes.ts。
// OSM 補缺的層一律分開標「OSM 補缺」並署名 © OpenStreetMap contributors；沒涵蓋的地區寫「未涵蓋」。
import { LegendNote, LegendRow, LegendSizeRow, LegendTitle, SwatchDot, SwatchLine, SwatchSquare } from "./legendKit";
import { DenseHeatmapLegendRow } from "./legendShared";
import { LAYER_MANIFEST, type LayerName } from "../../data/layerManifest";
import {
  KR_AIRPORT_COLOR, KR_AIRPORTS_ATTRIBUTION, KR_BUS_STOPS_ATTRIBUTION, KR_BUS_STOPS_COLOR, KR_CAPACITY_BANDS, KR_FALLBACK_COLOR, KR_FUEL_GROUPS,
  KR_FUEL_STATIONS_ATTRIBUTION, KR_FUEL_TYPES, KR_NATIONAL_ROAD_COLOR, KR_NATIONAL_ROADS_ATTRIBUTION, KR_OIL_GAS_TYPES, KR_OSM_ATTRIBUTION,
  KR_PIPELINE_COLORS, KR_PLANT_FUELS, KR_PORT_COLOR, KR_PORTS_ATTRIBUTION, KR_RAIL_LINE_CLASSES, KR_RAIL_NETWORKS, KR_RAIL_STATIONS_ATTRIBUTION,
  KR_RENEWABLE_FUELS, KR_TOWERS_COLOR, KR_VOLTAGE_CLASSES,
  type KrFuelGroup, type KrFuelType, type KrOilGasType, type KrRailLineClass, type KrRailNetwork, type KrVoltageClass,
} from "../../data/krInfraTypes";
import { LINE_DASH, LINE_WIDTH } from "../../map/mapStyleScale";
import type { ReactNode } from "react";
import { KR_SPEC_BY_KEY, pickL3, type KrLayerSpec } from "../../data/krDataLayers";
import type { KrDataKey } from "../../data/krDataKeys";
import { useLocale } from "../../state/localeStore";
import { localizeLayerName } from "../../i18n/layerText";
import type { MessageKey } from "../../i18n/keys";

type I18n = ReturnType<typeof useLocale>;
function layerTitle(key: string, i18n: I18n): string {
  const name = (LAYER_MANIFEST as Record<string, { name?: LayerName }>)[key]?.name;
  return name ? localizeLayerName(key, name, i18n).primary : key;
}

export const KR_RAIL_NETWORK_KEYS: Record<KrRailNetwork, MessageKey> = {
  korail_only: "legend.transport.krNetKorail", urban_only: "legend.transport.krNetUrban", both: "legend.transport.krNetBoth",
};
export const KR_RAIL_CLASS_KEYS: Record<KrRailLineClass, MessageKey> = {
  main: "legend.transport.krRailMain", branch: "legend.transport.krRailBranch", subway: "legend.transport.krRailSubway",
  light_rail: "legend.transport.krRailLight", yard_service: "legend.transport.krRailYard", other: "legend.transport.krRailOther",
};
export const KR_FUEL_GROUP_KEYS: Record<KrFuelGroup, MessageKey> = {
  solar: "legend.energy.krFuelSolar", wind: "legend.energy.krFuelWind", hydro: "legend.energy.krFuelHydro",
  pumped_hydro: "legend.energy.krFuelPumpedHydro", biomass: "legend.energy.krFuelBiomass", marine: "legend.energy.krFuelMarine",
  geothermal: "legend.energy.krFuelGeothermal", nuclear: "legend.energy.krFuelNuclear", coal: "legend.energy.krFuelCoal",
  gas: "legend.energy.krFuelGas", oil: "legend.energy.krFuelOil", other: "legend.energy.krFuelOther", unknown: "legend.energy.krFuelOther",
};
export const KR_VOLTAGE_KEYS: Record<KrVoltageClass, MessageKey> = {
  ehv_765: "legend.energy.krVoltage765", hv_345: "legend.energy.krVoltage345", hv_154: "legend.energy.krVoltage154",
  mv_lt100: "legend.energy.krVoltageLt100", unknown: "legend.energy.krVoltageUnknown",
};
export const KR_FUEL_TYPE_KEYS: Record<KrFuelType, MessageKey> = {
  ev_kepco: "legend.energy.krFuelEv", lpg: "legend.energy.krFuelLpg", hydrogen: "legend.energy.krFuelH2", cng_lng: "legend.energy.krFuelCng",
};
export const KR_OIL_GAS_TYPE_KEYS: Record<KrOilGasType, MessageKey> = {
  refinery: "legend.energy.krOgRefinery", oil_depot: "legend.energy.krOgDepot", gas: "legend.energy.krOgGas",
  lng_terminal: "legend.energy.krOgLng", storage_tank: "legend.energy.krOgTank",
};

// ─────────────────────────── 交通 ───────────────────────────

export function KrBusStopsLegend() {
  const i18n = useLocale();
  return <div>
    <LegendTitle zh={layerTitle("krBusStops", i18n)} en="Bus Stops" />
    <LegendRow swatch={<SwatchDot color={KR_BUS_STOPS_COLOR} />}>{i18n.t("legend.transport.krBusRow")}</LegendRow>
    <LegendNote>{i18n.t("legend.transport.krBusScope")}</LegendNote>
    <LegendNote>{i18n.t("legend.transport.krBusZoom")}</LegendNote>
    <LegendNote>{KR_BUS_STOPS_ATTRIBUTION}</LegendNote>
    <DenseHeatmapLegendRow layers={["krBusStops"]} />
  </div>;
}

export function KrRailStationsLegend() {
  const i18n = useLocale();
  return <div>
    <LegendTitle zh={layerTitle("krRailStations", i18n)} en="Rail Stations" />
    {KR_RAIL_NETWORKS.map((n) => <LegendRow key={n.value} swatch={<SwatchDot color={n.color} />}>{i18n.t(KR_RAIL_NETWORK_KEYS[n.value])}</LegendRow>)}
    <LegendNote>{i18n.t("legend.transport.krRailScope")}</LegendNote>
    <LegendNote>{KR_RAIL_STATIONS_ATTRIBUTION}</LegendNote>
  </div>;
}

export function KrAirportsLegend() {
  const i18n = useLocale();
  return <div>
    <LegendTitle zh={layerTitle("krAirports", i18n)} en="Airports" />
    <LegendRow swatch={<SwatchDot color={KR_AIRPORT_COLOR} />}>{i18n.t("legend.transport.krAirportKac")}</LegendRow>
    <LegendRow swatch={<SwatchDot color={KR_AIRPORT_COLOR} stroke={KR_AIRPORT_COLOR} opacity={0.45} />}>{i18n.t("legend.transport.krAirportOsm")}</LegendRow>
    <LegendNote>{i18n.t("legend.transport.krAirportScope")}</LegendNote>
    <LegendNote>{KR_AIRPORTS_ATTRIBUTION}</LegendNote>
  </div>;
}

export function KrPortsLegend() {
  const i18n = useLocale();
  return <div>
    <LegendTitle zh={layerTitle("krPorts", i18n)} en="Port Areas" />
    <LegendRow swatch={<SwatchSquare color={KR_PORT_COLOR} stroke={KR_PORT_COLOR} />}>{i18n.t("legend.transport.krPortRow")}</LegendRow>
    <LegendNote>{i18n.t("legend.transport.krPortScope")}</LegendNote>
    <LegendNote>{KR_PORTS_ATTRIBUTION}</LegendNote>
  </div>;
}

export function KrNationalRoadsLegend() {
  const i18n = useLocale();
  return <div>
    <LegendTitle zh={layerTitle("krNationalRoads", i18n)} en="National Roads" />
    <LegendRow swatch={<SwatchLine color={KR_NATIONAL_ROAD_COLOR} width={1.5} />}>{i18n.t("legend.transport.krRoadRow")}</LegendRow>
    <LegendNote>{i18n.t("legend.transport.krRoadScope")}</LegendNote>
    <LegendNote>{KR_NATIONAL_ROADS_ATTRIBUTION}</LegendNote>
  </div>;
}

export function KrRailLinesLegend() {
  const i18n = useLocale();
  return <div>
    <LegendTitle zh={layerTitle("krRailLines", i18n)} en="Rail Lines" />
    {KR_RAIL_LINE_CLASSES.map((c) => <LegendRow key={c.value} swatch={<SwatchLine color={c.color} width={c.width === "emphasis" ? 2.5 : c.width === "standard" ? 1.5 : 1} opacity={c.opacity} />}>{i18n.t(KR_RAIL_CLASS_KEYS[c.value])}</LegendRow>)}
    <LegendNote>{i18n.t("legend.transport.krOsmSupplement")}</LegendNote>
    <LegendNote>{i18n.t("legend.transport.krRailLinesNote")}</LegendNote>
    <LegendNote>{KR_OSM_ATTRIBUTION}</LegendNote>
  </div>;
}

// ─────────────────────────── 能源 ───────────────────────────

function FuelRows({ fuels }: { fuels: readonly KrFuelGroup[] }) {
  const i18n = useLocale();
  return <>{KR_FUEL_GROUPS.filter((g) => fuels.includes(g.value)).map((g) => <LegendRow key={g.value} swatch={<SwatchDot color={g.color} />}>{i18n.t(KR_FUEL_GROUP_KEYS[g.value])}</LegendRow>)}</>;
}

export function KrPowerPlantsLegend() {
  const i18n = useLocale();
  return <div>
    <LegendTitle zh={layerTitle("krPowerPlants", i18n)} en="Power Stations" />
    <LegendNote>{i18n.t("legend.energy.krOsmSupplement")}</LegendNote>
    <FuelRows fuels={KR_PLANT_FUELS} />
    <LegendSizeRow fill={KR_FALLBACK_COLOR} title={i18n.t("legend.energy.krCapacityTitle")} items={KR_CAPACITY_BANDS.map((b) => ({ r: b.radius, label: b.label }))} />
    <LegendNote>{i18n.t("legend.energy.krCapacityNote")}</LegendNote>
    <LegendNote>{i18n.t("legend.energy.krPlantsCoverage")}</LegendNote>
    <LegendNote>{i18n.t("legend.energy.krPlantsOverlap")}</LegendNote>
    <LegendNote>{KR_OSM_ATTRIBUTION}</LegendNote>
  </div>;
}

export function KrRenewablesLegend() {
  const i18n = useLocale();
  return <div>
    <LegendTitle zh={layerTitle("krRenewables", i18n)} en="Renewable Energy Sites" />
    <LegendNote>{i18n.t("legend.energy.krOsmSupplement")}</LegendNote>
    <FuelRows fuels={KR_RENEWABLE_FUELS} />
    <LegendSizeRow fill={KR_FALLBACK_COLOR} title={i18n.t("legend.energy.krCapacityTitle")} items={KR_CAPACITY_BANDS.map((b) => ({ r: b.radius, label: b.label }))} />
    <LegendNote>{i18n.t("legend.energy.krCapacityNote")}</LegendNote>
    <LegendNote>{i18n.t("legend.energy.krRenewCoverage")}</LegendNote>
    <LegendNote>{i18n.t("legend.energy.krStatsNotOnMap")}</LegendNote>
    <LegendNote>{KR_OSM_ATTRIBUTION}</LegendNote>
  </div>;
}

export function KrPowerLinesLegend() {
  const i18n = useLocale();
  const hv = KR_VOLTAGE_CLASSES[2]!;
  return <div>
    <LegendTitle zh={layerTitle("krPowerLines", i18n)} en="Power Lines" />
    <LegendNote>{i18n.t("legend.energy.krOsmSupplement")}</LegendNote>
    {KR_VOLTAGE_CLASSES.map((v) => <LegendRow key={v.value} swatch={<SwatchLine color={v.color} width={Math.max(1, v.width)} opacity={v.opacity} />}>{i18n.t(KR_VOLTAGE_KEYS[v.value])}</LegendRow>)}
    <LegendRow swatch={<SwatchLine color={hv.color} width={1.5} dash={[...LINE_DASH.general]} />}>{i18n.t("legend.energy.krCable")}</LegendRow>
    <LegendNote>{i18n.t("legend.energy.krGridNote")}</LegendNote>
    <LegendNote>{KR_OSM_ATTRIBUTION}</LegendNote>
  </div>;
}

export function KrSubstationsLegend() {
  const i18n = useLocale();
  return <div>
    <LegendTitle zh={layerTitle("krSubstations", i18n)} en="Substations" />
    <LegendNote>{i18n.t("legend.energy.krOsmSupplement")}</LegendNote>
    {KR_VOLTAGE_CLASSES.map((v) => <LegendRow key={v.value} swatch={<SwatchDot color={v.color} opacity={v.opacity} />}>{i18n.t(KR_VOLTAGE_KEYS[v.value])}</LegendRow>)}
    <LegendNote>{i18n.t("legend.energy.krGridNote")}</LegendNote>
    <LegendNote>{KR_OSM_ATTRIBUTION}</LegendNote>
  </div>;
}

export function KrPowerTowersLegend() {
  const i18n = useLocale();
  return <div>
    <LegendTitle zh={layerTitle("krPowerTowers", i18n)} en="Power Towers" />
    <LegendNote>{i18n.t("legend.energy.krOsmSupplement")}</LegendNote>
    <LegendRow swatch={<SwatchDot color={KR_TOWERS_COLOR} />}>{i18n.t("legend.energy.krTowerRow")}</LegendRow>
    <LegendNote>{i18n.t("legend.energy.krTowersZoom")}</LegendNote>
    <LegendNote>{KR_OSM_ATTRIBUTION}</LegendNote>
  </div>;
}

export function KrFuelStationsLegend() {
  const i18n = useLocale();
  return <div>
    <LegendTitle zh={layerTitle("krFuelStations", i18n)} en="Fuel & Charging Stations" />
    {KR_FUEL_TYPES.map((f) => <LegendRow key={f.value} swatch={<SwatchDot color={f.color} />}>{i18n.t(KR_FUEL_TYPE_KEYS[f.value])}</LegendRow>)}
    <LegendNote>{i18n.t("legend.energy.krFuelScope")}</LegendNote>
    <LegendNote>{i18n.t("legend.energy.krFuelDates")}</LegendNote>
    <LegendNote>{KR_FUEL_STATIONS_ATTRIBUTION}</LegendNote>
    <DenseHeatmapLegendRow layers={["krFuelStations"]} />
  </div>;
}

export function KrOilGasLegend() {
  const i18n = useLocale();
  return <div>
    <LegendTitle zh={layerTitle("krOilGas", i18n)} en="Oil & Gas Facilities" />
    <LegendNote>{i18n.t("legend.energy.krOgSparse")}</LegendNote>
    {KR_OIL_GAS_TYPES.map((t) => <LegendRow key={t.value} swatch={<SwatchSquare color={t.color} stroke={t.color} />}>{i18n.t(KR_OIL_GAS_TYPE_KEYS[t.value])}</LegendRow>)}
    <LegendRow swatch={<SwatchLine color={KR_PIPELINE_COLORS.gas} width={1.5} />}>{i18n.t("legend.energy.krOgPipeGas")}</LegendRow>
    <LegendRow swatch={<SwatchLine color={KR_PIPELINE_COLORS.oil} width={1.5} />}>{i18n.t("legend.energy.krOgPipeOil")}</LegendRow>
    <LegendRow swatch={<SwatchLine color={KR_PIPELINE_COLORS.hydrocarbons} width={1.5} />}>{i18n.t("legend.energy.krOgPipeHc")}</LegendRow>
    <LegendNote>{i18n.t("legend.energy.krOgScope")}</LegendNote>
    <LegendNote>{i18n.t("legend.energy.krOgNoSubstance")}</LegendNote>
    <LegendNote>{KR_OSM_ATTRIBUTION}</LegendNote>
  </div>;
}

// ───────── 南韓第 3–5 波 18 層：規格驅動的共用圖例（規格見 data/krDataLayers.ts）─────────
function swatch(spec: KrLayerSpec, color: string): ReactNode {
  return spec.geom === "point" ? <SwatchDot color={color} /> : spec.geom === "line" ? <SwatchLine color={color} width={LINE_WIDTH.standard[1]} /> : <SwatchSquare color={color} />;
}

export function KrDataLegend({ layerKey }: { layerKey: KrDataKey }) {
  const i18n = useLocale();
  const spec = KR_SPEC_BY_KEY[layerKey];
  const name = (LAYER_MANIFEST as Record<string, { name?: LayerName }>)[layerKey]?.name;
  const title = name ? localizeLayerName(layerKey, name, i18n).primary : layerKey;
  const locale = i18n.locale;
  return <div>
    <LegendTitle zh={title} />
    {spec.cats ? spec.cats.map((c) => <LegendRow key={c.id} swatch={swatch(spec, c.color)}>{pickL3(c.label, locale)}</LegendRow>) : <LegendRow swatch={swatch(spec, spec.color)}>{title}</LegendRow>}
    {spec.cats && spec.otherLabel ? <LegendRow swatch={swatch(spec, spec.otherColor ?? spec.color)}>{pickL3(spec.otherLabel, locale)}</LegendRow> : null}
    {spec.legendNotes.map((n, i) => <LegendNote key={i}>{pickL3(n, locale)}</LegendNote>)}
    <LegendNote>{spec.sourceOrg}（{spec.license}）</LegendNote>
    {spec.heat ? <DenseHeatmapLegendRow layers={[layerKey]} /> : null}
  </div>;
}

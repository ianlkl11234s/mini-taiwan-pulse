// 英國第 6 波能源圖例（2026-10-29）：電廠、再生能源、電網線、變電所、加油站、離岸油氣田。
// 色票與署名 SSOT 在 data/gbEnergyTypes.ts；每層標涵蓋範圍、未收項目與來源署名。
import { LegendNote, LegendRow, LegendSizeRow, LegendTitle, SwatchDot, SwatchLine, SwatchSquare } from "./legendKit";
import { LAYER_MANIFEST, type LayerName } from "../../data/layerManifest";
import {
  GB_CAPACITY_BANDS, GB_CONSTRUCTION_STROKE, GB_FIELD_INACTIVE_FACTOR, GB_FIELD_TYPES, GB_FUEL_GROUPS, GB_FUEL_STATION_COLOR,
  GB_NSTA_ATTRIBUTION, GB_OSM_ATTRIBUTION, GB_POWER_PLANTS_ATTRIBUTION, GB_RENEWABLES_ATTRIBUTION, GB_STATUS_COUNTS, GB_TECH_GROUPS,
  GB_VOLTAGE_CLASSES, GB_ENERGY_FALLBACK_COLOR, type GbFieldType, type GbFuelGroup, type GbStatusGroup, type GbTechGroup, type GbVoltageClass,
} from "../../data/gbEnergyTypes";
import { LINE_DASH } from "../../map/mapStyleScale";
import { useLocale } from "../../state/localeStore";
import { localizeLayerName } from "../../i18n/layerText";
import type { MessageKey } from "../../i18n/keys";

type I18n = ReturnType<typeof useLocale>;
function layerTitle(key: string, i18n: I18n): string {
  const name = (LAYER_MANIFEST as Record<string, { name?: LayerName }>)[key]?.name;
  return name ? localizeLayerName(key, name, i18n).primary : key;
}

export const GB_FUEL_GROUP_KEYS: Record<GbFuelGroup, MessageKey> = {
  gas: "legend.energy.gbFuelGas", nuclear: "legend.energy.gbFuelNuclear", oil: "legend.energy.gbFuelOil",
  bioenergy: "legend.energy.gbFuelBioenergy", hydro: "legend.energy.gbFuelHydro", pumped_hydro: "legend.energy.gbFuelPumpedHydro",
  wind_onshore: "legend.energy.gbFuelWindOnshore", wind_offshore: "legend.energy.gbFuelWindOffshore", solar: "legend.energy.gbFuelSolar",
};

/** 英國電廠：燃料別 9 色（沿用台灣燃料色）＋裝置容量 4 級圓；燃煤 2024 年已全數關閉。 */
export function GbPowerPlantsLegend() {
  const i18n = useLocale();
  return <div>
    <LegendTitle zh={layerTitle("gbPowerPlants", i18n)} en="Power Stations" />
    {GB_FUEL_GROUPS.map((g) => <LegendRow key={g.value} swatch={<SwatchDot color={g.color} />}>{i18n.t(GB_FUEL_GROUP_KEYS[g.value])}</LegendRow>)}
    <LegendSizeRow fill={GB_ENERGY_FALLBACK_COLOR} title={i18n.t("legend.energy.gbCapacityTitle")} items={GB_CAPACITY_BANDS.map((b) => ({ r: b.radius, label: b.label }))} />
    <LegendNote>{i18n.t("legend.energy.gbPlantsNote")}</LegendNote>
    <LegendNote>{i18n.t("legend.energy.gbPlantsOverlap")}</LegendNote>
    <LegendNote>{GB_POWER_PLANTS_ATTRIBUTION}</LegendNote>
  </div>;
}

export const GB_TECH_GROUP_KEYS: Record<GbTechGroup, MessageKey> = {
  solar: "legend.energy.gbFuelSolar", wind_onshore: "legend.energy.gbFuelWindOnshore", wind_offshore: "legend.energy.gbFuelWindOffshore",
  storage: "legend.energy.gbTechStorage", bioenergy: "legend.energy.gbFuelBioenergy", hydro: "legend.energy.gbFuelHydro",
  geothermal: "legend.energy.gbTechGeothermal", other: "legend.energy.gbTechOther",
};
export const GB_STATUS_GROUP_KEYS: Record<GbStatusGroup, MessageKey> = {
  operational: "legend.energy.gbStatusOperational", construction: "legend.energy.gbStatusConstruction", consented: "legend.energy.gbStatusConsented",
  in_planning: "legend.energy.gbStatusInPlanning", not_proceeding: "legend.energy.gbStatusNotProceeding", decommissioned: "legend.energy.gbStatusDecommissioned",
};

/** 英國再生能源專案（REPD）：技術別色；審查階段用「審查階段」選項切換，施工中加描邊。 */
export function GbRenewablesLegend() {
  const i18n = useLocale();
  return <div>
    <LegendTitle zh={layerTitle("gbRenewables", i18n)} en="Renewable Energy Projects" />
    {GB_TECH_GROUPS.map((g) => <LegendRow key={g.value} swatch={<SwatchDot color={g.color} />}>{i18n.t(GB_TECH_GROUP_KEYS[g.value])}</LegendRow>)}
    <LegendRow swatch={<SwatchDot color={GB_ENERGY_FALLBACK_COLOR} stroke={GB_CONSTRUCTION_STROKE} strokeWidth={1.5} opacity={1} />}>{i18n.t("legend.energy.gbRenewConstructionRing")}</LegendRow>
    <LegendSizeRow fill={GB_ENERGY_FALLBACK_COLOR} title={i18n.t("legend.energy.gbCapacityTitle")} items={GB_CAPACITY_BANDS.map((b) => ({ r: b.radius, label: b.label }))} />
    <LegendNote>{i18n.t("legend.energy.gbRenewSizeNote")}</LegendNote>
    <LegendNote>{i18n.t("legend.energy.gbRenewStatusNote", {
      operational: i18n.formatNumber(GB_STATUS_COUNTS.operational), construction: i18n.formatNumber(GB_STATUS_COUNTS.construction),
    })}</LegendNote>
    <LegendNote>{i18n.t("legend.energy.gbRenewNote")}</LegendNote>
    <LegendNote>{GB_RENEWABLES_ATTRIBUTION}</LegendNote>
  </div>;
}

export const GB_VOLTAGE_KEYS: Record<GbVoltageClass, MessageKey> = {
  transmission_275_400: "legend.energy.gbVoltage275400", hv_132: "legend.energy.gbVoltage132",
  sub_transmission_33_66: "legend.energy.gbVoltage3366", distribution_lt33: "legend.energy.gbVoltageLt33", unknown: "legend.energy.gbVoltageUnknown",
};

/** 英國電網線（OSM）：電壓 5 級；地下／海底電纜虛線；z4–8 只有 ≥132kV。 */
export function GbPowerLinesLegend() {
  const i18n = useLocale();
  const ehv = GB_VOLTAGE_CLASSES[1]!;
  return <div>
    <LegendTitle zh={layerTitle("gbPowerLines", i18n)} en="Power Lines" />
    {GB_VOLTAGE_CLASSES.map((v) => <LegendRow key={v.value} swatch={<SwatchLine color={v.color} width={Math.max(1, v.width)} opacity={v.opacity} />}>{i18n.t(GB_VOLTAGE_KEYS[v.value])}</LegendRow>)}
    <LegendRow swatch={<SwatchLine color={ehv.color} width={1.5} dash={[...LINE_DASH.general]} />}>{i18n.t("legend.energy.gbCable")}</LegendRow>
    <LegendNote>{i18n.t("legend.energy.gbLinesZoom")}</LegendNote>
    <LegendNote>{i18n.t("legend.energy.gbGridOsmNote")}</LegendNote>
    <LegendNote>{i18n.t("legend.energy.gbGridHold")}</LegendNote>
    <LegendNote>{GB_OSM_ATTRIBUTION}</LegendNote>
  </div>;
}

/** 英國變電所（OSM）：依電壓分色與大小；z4–9 只有 ≥132kV。 */
export function GbSubstationsLegend() {
  const i18n = useLocale();
  return <div>
    <LegendTitle zh={layerTitle("gbSubstations", i18n)} en="Substations" />
    {GB_VOLTAGE_CLASSES.map((v) => <LegendRow key={v.value} swatch={<SwatchDot color={v.color} opacity={v.opacity} />}>{i18n.t(GB_VOLTAGE_KEYS[v.value])}</LegendRow>)}
    <LegendNote>{i18n.t("legend.energy.gbSubstationsZoom")}</LegendNote>
    <LegendNote>{i18n.t("legend.energy.gbGridOsmNote")}</LegendNote>
    <LegendNote>{GB_OSM_ATTRIBUTION}</LegendNote>
  </div>;
}

/** 英國加油站（OSM）：單一色；無即時油價。 */
export function GbFuelStationsLegend() {
  const i18n = useLocale();
  return <div>
    <LegendTitle zh={layerTitle("gbFuelStations", i18n)} en="Fuel Stations" />
    <LegendRow swatch={<SwatchDot color={GB_FUEL_STATION_COLOR} />}>{i18n.t("legend.energy.gbFuelStation")}</LegendRow>
    <LegendNote>{i18n.t("legend.energy.gbFuelStationNote")}</LegendNote>
    <LegendNote>{i18n.t("legend.energy.gbFuelStationZoom")}</LegendNote>
    <LegendNote>{GB_OSM_ATTRIBUTION}</LegendNote>
  </div>;
}

export const GB_FIELD_TYPE_KEYS: Record<GbFieldType, MessageKey> = {
  OIL: "legend.energy.gbFieldOil", GAS: "legend.energy.gbFieldGas", COND: "legend.energy.gbFieldCond",
};

/** 英國離岸油氣田（NSTA）：油／氣／凝結油三色，生產中深色、其他淡化；NSTA 指定署名原句＋非商用。 */
export function GbOilGasFieldsLegend() {
  const i18n = useLocale();
  return <div>
    <LegendTitle zh={layerTitle("gbOilGasFields", i18n)} en="Offshore Oil & Gas Fields" />
    {GB_FIELD_TYPES.map((f) => <LegendRow key={f.value} swatch={<SwatchSquare color={f.color} stroke={f.color} />}>{i18n.t(GB_FIELD_TYPE_KEYS[f.value])}</LegendRow>)}
    <LegendRow swatch={<SwatchSquare color={GB_FIELD_TYPES[0]!.color} stroke={GB_FIELD_TYPES[0]!.color} opacity={0.9 * GB_FIELD_INACTIVE_FACTOR} />}>{i18n.t("legend.energy.gbFieldInactive")}</LegendRow>
    <LegendNote>{i18n.t("legend.energy.gbFieldScope")}</LegendNote>
    <LegendNote>{i18n.t("legend.energy.gbFieldHold")}</LegendNote>
    <LegendNote>{i18n.t("legend.energy.gbNstaLicense")}</LegendNote>
    <LegendNote>{GB_NSTA_ATTRIBUTION}</LegendNote>
  </div>;
}

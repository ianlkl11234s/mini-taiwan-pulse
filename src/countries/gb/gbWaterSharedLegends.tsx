// 英國國家包：從共用檔搬來的國家專屬元件（B1 P5a；由 scripts/layers/move-country-pack.ts 從中央登記簿搬來，之後就在這裡維護）。
// ⚠️ 只能經 src/countries/packs.ts 的 ensureCountryPack 動態載入，不可從國家目錄以外靜態 import（lint 擋）。
import { LegendNote, LegendRow, LegendTitle, SwatchDot, SwatchLine, SwatchSquare, useLegendTheme } from "../../components/legend/legendKit";
import { DenseHeatmapLegendRow } from "../../components/legend/legendShared";
import { layerTitle } from "../../components/legend/waterLegends";
import { type MessageKey } from "../../i18n/keys";
import { LINE_WIDTH } from "../../map/mapStyleScale";
import { useLocale } from "../../state/localeStore";
import { GB_BATHING_CLASSES, GB_BATHING_DESIGNATED_COUNT, GB_BATHING_NO_CLASS_STROKE, GB_EROSION_RISKS, GB_EROSION_SOURCES, GB_EROSION_ZONES, GB_FLOOD_DEFENCE_CLASSES, GB_FLOOD_DEFENCE_NATURAL_FACTOR, GB_HYDRO_KINDS, GB_HYDRO_UNTAGGED_COLOR, GB_RIVER_FORMS, GB_RIVER_STRAHLER_BANDS, GB_RIVERS_CANAL_COLOR, GB_RIVERS_COLOR, GB_RIVERS_COLOR_LIGHT, GB_RIVERS_FADED_FACTOR, type GbBathingClass, type GbFloodDefenceClass, type GbHydroKind, type GbNation, type GbRiverForm } from "./gbWaterTypes";


/** 英國河川：大不列顛依 form、北愛依 Strahler，兩套分開列（北愛不是「無級數」的 GB）。 */
export function GbRiversLegend() {
  const i18n = useLocale();
  const t = useLegendTheme();
  const river = t.isDark ? GB_RIVERS_COLOR : GB_RIVERS_COLOR_LIGHT;
  return <div>
    <LegendTitle zh={layerTitle("gbRivers", i18n)} en="Rivers" />
    <LegendNote>{i18n.t("legend.water.gbRiversGbHeading")}</LegendNote>
    {GB_RIVER_FORMS.map((f) => (
      <LegendRow key={f.value} swatch={<SwatchLine color={f.canal ? GB_RIVERS_CANAL_COLOR : river} width={LINE_WIDTH[f.width][1]} opacity={f.faded ? GB_RIVERS_FADED_FACTOR : 1} />}>
        {i18n.t(GB_RIVER_FORM_LEGEND_KEYS[f.value])}
      </LegendRow>
    ))}
    <LegendNote>{i18n.t("legend.water.gbRiversNiHeading")}</LegendNote>
    {GB_RIVER_STRAHLER_BANDS.map((b) => (
      <LegendRow key={b.min} swatch={<SwatchLine color={river} width={LINE_WIDTH[b.width][1]} />}>
        {i18n.t("legend.water.gbRiversStrahler", { min: b.min, max: b.max })}
      </LegendRow>
    ))}
    <LegendNote>{i18n.t("legend.water.gbRiversZoom")}</LegendNote>
  </div>;
}


/** 英國水文測站：依觀測類型分色；空心＝位置只到 1 公里方格；威爾斯、北愛未涵蓋。 */
export function GbHydroStationsLegend() {
  const i18n = useLocale();
  return <div>
    <LegendTitle zh={layerTitle("gbHydroStations", i18n)} en="Hydrometric Stations" />
    {GB_HYDRO_KINDS.map((k) => <LegendRow key={k.value} swatch={<SwatchDot color={k.color} />}>{i18n.t(GB_HYDRO_LEGEND_KEYS[k.value])}</LegendRow>)}
    <LegendRow swatch={<SwatchDot color={GB_HYDRO_UNTAGGED_COLOR} />}>{i18n.t("legend.water.gbHydroUntagged")}</LegendRow>
    <LegendRow swatch={<SwatchDot color="transparent" stroke={GB_HYDRO_KINDS[0]!.color} strokeWidth={1.5} />}>{i18n.t("legend.water.gbHydroGridPrecision")}</LegendRow>
    <LegendNote>{i18n.t("legend.water.gbHydroCoverage")}</LegendNote>
    <LegendNote>{i18n.t("legend.water.gbHydroNoReadings")}</LegendNote>
  </div>;
}


/** 英國防洪設施：5 類＋其他；天然高地淡化、z10 起；北愛未涵蓋、蘇格蘭只有海岸人工防護。 */
export function GbFloodDefenceAssetsLegend() {
  const i18n = useLocale();
  return <div>
    <LegendTitle zh={layerTitle("gbFloodDefenceAssets", i18n)} en="Flood Defences" />
    {GB_FLOOD_DEFENCE_CLASSES.map((c) => (
      <LegendRow key={c.value} swatch={<SwatchLine color={c.color} width={LINE_WIDTH.standard[1]} opacity={c.faded ? GB_FLOOD_DEFENCE_NATURAL_FACTOR : 1} />}>
        {i18n.t(GB_FLOOD_LEGEND_KEYS[c.value])}
      </LegendRow>
    ))}
    <LegendNote>{i18n.t("legend.water.gbFloodZoom")}</LegendNote>
    <LegendNote>{i18n.t("legend.water.gbFloodScotland")}</LegendNote>
    <LegendNote>{i18n.t("legend.water.gbFloodNi")}</LegendNote>
    <LegendNote>{i18n.t("legend.water.gbDynamicCoastNote")}</LegendNote>
  </div>;
}


/** 英國海岸侵蝕：四地方法不同 → 依地區＋期別分列，不做統一色階；北愛是風險等級線。 */
export function GbCoastalErosionRiskLegend() {
  const i18n = useLocale();
  const nations: Exclude<GbNation, "Northern Ireland">[] = ["England", "Wales", "Scotland"];
  return <div>
    <LegendTitle zh={layerTitle("gbCoastalErosionRisk", i18n)} en="Coastal Erosion Risk" />
    {nations.map((n) => <div key={n}>
      <LegendNote>{i18n.t(GB_NATION_LEGEND_KEYS[n], { version: GB_EROSION_SOURCES[n].version })}</LegendNote>
      {GB_EROSION_ZONES.filter((z) => z.nation === n).map((z) => (
        <LegendRow key={z.year} swatch={<SwatchSquare color={z.color} />}>
          {i18n.t(z.period === "short" ? "legend.water.gbErosionShort" : "legend.water.gbErosionLong", { year: z.year, nation: i18n.t(GB_NATION_SHORT_KEYS[z.nation]) })}
        </LegendRow>
      ))}
    </div>)}
    <LegendNote>{i18n.t(GB_NATION_LEGEND_KEYS["Northern Ireland"], { version: GB_EROSION_SOURCES["Northern Ireland"].version })}</LegendNote>
    {GB_EROSION_RISKS.map((r) => <LegendRow key={r.value} swatch={<SwatchLine color={r.color} width={LINE_WIDTH.emphasis[1]} />}>{i18n.t(GB_RISK_LEGEND_KEYS[r.value]!, { nation: i18n.t(GB_NATION_SHORT_KEYS["Northern Ireland"]) })}</LegendRow>)}
    <DenseHeatmapLegendRow layers={["gbCoastalErosionRisk"]} />
    <LegendNote>{i18n.t("legend.water.gbErosionNotComparable")}</LegendNote>
    <LegendNote>{i18n.t("legend.water.gbErosionPeriodNote")}</LegendNote>
    <LegendNote>{i18n.t("legend.water.gbDynamicCoastNote")}</LegendNote>
  </div>;
}


/** 英國浴場：水質分級好→差；北愛來源未附分級＝空心點「無分級資料」（不是差）。 */
export function GbBathingWatersLegend() {
  const i18n = useLocale();
  return <div>
    <LegendTitle zh={layerTitle("gbBathingWaters", i18n)} en="Bathing Waters" />
    {GB_BATHING_CLASSES.map((c) => <LegendRow key={c.value} swatch={<SwatchDot color={c.color} />}>{i18n.t(GB_BATHING_LEGEND_KEYS[c.value])}</LegendRow>)}
    <LegendRow swatch={<SwatchDot color="transparent" stroke={GB_BATHING_NO_CLASS_STROKE} strokeWidth={1.5} />}>{i18n.t("legend.water.gbBathingNoClass")}</LegendRow>
    <LegendNote>{i18n.t("legend.water.gbBathingYear")}</LegendNote>
    <LegendNote>{i18n.t("legend.water.gbBathingDesignated", { count: GB_BATHING_DESIGNATED_COUNT })}</LegendNote>
  </div>;
}

// ─────────────────────────── 英國第 3 波：水資源／海岸 ───────────────────────────

const GB_RIVER_FORM_LEGEND_KEYS: Record<GbRiverForm, MessageKey> = {
  inlandRiver: "legend.water.gbRiverFormInland", tidalRiver: "legend.water.gbRiverFormTidal",
  canal: "legend.water.gbRiverFormCanal", lake: "legend.water.gbRiverFormLake",
};

const GB_HYDRO_LEGEND_KEYS: Record<GbHydroKind, MessageKey> = {
  level: "legend.water.gbHydroLevel", rainfall: "legend.water.gbHydroRainfall", flow: "legend.water.gbHydroFlow", other: "legend.water.gbHydroOther",
};

const GB_FLOOD_LEGEND_KEYS: Record<GbFloodDefenceClass, MessageKey> = {
  embankment: "legend.water.gbFloodEmbankment", wall: "legend.water.gbFloodWall", gate: "legend.water.gbFloodGate",
  coastal: "legend.water.gbFloodCoastal", natural: "legend.water.gbFloodNatural", other: "legend.water.gbFloodOther",
};

const GB_NATION_LEGEND_KEYS: Record<GbNation, MessageKey> = {
  England: "legend.water.gbErosionEngland", Wales: "legend.water.gbErosionWales",
  Scotland: "legend.water.gbErosionScotland", "Northern Ireland": "legend.water.gbErosionNi",
};

const GB_NATION_SHORT_KEYS: Record<GbNation, MessageKey> = {
  England: "legend.water.gbNationEngland", Wales: "legend.water.gbNationWales",
  Scotland: "legend.water.gbNationScotland", "Northern Ireland": "legend.water.gbNationNi",
};

const GB_RISK_LEGEND_KEYS: Record<string, MessageKey> = { High: "legend.water.gbRiskHigh", Moderate: "legend.water.gbRiskModerate", Low: "legend.water.gbRiskLow" };

const GB_BATHING_LEGEND_KEYS: Record<GbBathingClass, MessageKey> = {
  Excellent: "legend.water.gbBathingExcellent", Good: "legend.water.gbBathingGood", Sufficient: "legend.water.gbBathingSufficient",
  Poor: "legend.water.gbBathingPoor", unassessed: "legend.water.gbBathingUnassessed",
};

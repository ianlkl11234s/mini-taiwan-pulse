// 英國第 9 波災害地質 5 層圖例（2026-10-29）。色票與署名 SSOT 在 data/gbHazardTypes.ts。
import { LegendNote, LegendRow, LegendSizeRow, LegendTitle, SwatchDot, SwatchSquare, useLegendTheme } from "./legendKit";
import { DenseHeatmapLegendRow } from "./legendShared";
import { LAYER_MANIFEST, type LayerName } from "../../data/layerManifest";
import {
  GB_GAMMA_ATTRIBUTION, GB_GAMMA_CLASSES, GB_GAMMA_COUNT, GB_GAMMA_MISSING_STROKE, GB_GAMMA_UNIT, GB_GEO_HAZARDS, GB_GEOSURE_ATTRIBUTION,
  GB_LANDSLIDE_ATTRIBUTION, GB_LANDSLIDE_CHECKED, GB_LANDSLIDE_COLOR, GB_LANDSLIDE_HOLLOW_STROKE, GB_QUAKE_ATTRIBUTION, GB_QUAKE_COLOR,
  GB_QUAKE_COUNTS, GB_QUAKE_DATA_END, GB_QUAKE_MAG_BANDS, GB_QUAKE_MINOR_MINZOOM, GB_QUAKE_YEARS, GB_RADON_ATTRIBUTION, GB_RADON_CLASSES,
  GB_SUSCEPTIBILITY, gbRadonColors, type GbGeoHazard, type GbSusceptibility,
} from "../../data/gbHazardTypes";
import { gbQuakeRadiusPx } from "../../hooks/useGbHazardLayers";
import { useLocale } from "../../state/localeStore";
import { localizeLayerName } from "../../i18n/layerText";
import type { MessageKey } from "../../i18n/keys";

type I18n = ReturnType<typeof useLocale>;
function layerTitle(key: string, i18n: I18n): string {
  const name = (LAYER_MANIFEST as Record<string, { name?: LayerName }>)[key]?.name;
  return name ? localizeLayerName(key, name, i18n).primary : key;
}

export const GB_SUSCEPTIBILITY_KEYS: Record<GbSusceptibility, MessageKey> = {
  Low: "legend.hazard.gbSuscLow", Moderate: "legend.hazard.gbSuscModerate", Significant: "legend.hazard.gbSuscSignificant",
};
export const GB_GEO_HAZARD_KEYS: Record<GbGeoHazard, MessageKey> = {
  landslides: "popup.hazard.gbHazLandslides", shrink_swell: "popup.hazard.gbHazShrinkSwell", compressible_ground: "popup.hazard.gbHazCompressible",
  collapsible_deposits: "popup.hazard.gbHazCollapsible", running_sand: "popup.hazard.gbHazRunningSand", soluble_rocks: "popup.hazard.gbHazSoluble",
};

/** GeoSure：三級易發性（借台灣土壤液化潛勢三階色，但不是液化）；一次顯示一種災害。 */
export function GbGroundStabilityLegend() {
  const i18n = useLocale();
  return <div>
    <LegendTitle zh={layerTitle("gbGroundStability", i18n)} en="GeoSure Ground Stability" />
    {GB_SUSCEPTIBILITY.map((s) => <LegendRow key={s.value} swatch={<SwatchSquare color={s.color} />}>{i18n.t(GB_SUSCEPTIBILITY_KEYS[s.value])}</LegendRow>)}
    <LegendNote>{i18n.t("legend.hazard.gbGeoSureHazards", { list: GB_GEO_HAZARDS.map((h) => i18n.t(GB_GEO_HAZARD_KEYS[h.value])).join("、") })}</LegendNote>
    <LegendNote>{i18n.t("legend.hazard.gbGeoSureNotLiquefaction")}</LegendNote>
    <LegendNote>{i18n.t("legend.hazard.gbGeoSureNotice")}</LegendNote>
    <LegendNote>{i18n.t("legend.hazard.gbCoverageGb3")}</LegendNote>
    <LegendNote>{GB_GEOSURE_ATTRIBUTION}</LegendNote>
  </div>;
}

/** 山崩紀錄：BGS 已複核位置實心、未複核空心（同色）。 */
export function GbLandslideLegend() {
  const i18n = useLocale();
  return <div>
    <LegendTitle zh={layerTitle("gbLandslide", i18n)} en="Landslide Records (NLD)" />
    <LegendRow swatch={<SwatchDot color={GB_LANDSLIDE_COLOR} />}>{i18n.t("legend.hazard.gbLandslideChecked", { n: i18n.formatNumber(GB_LANDSLIDE_CHECKED.checked) })}</LegendRow>
    <LegendRow swatch={<SwatchDot color="transparent" stroke={GB_LANDSLIDE_COLOR} strokeWidth={GB_LANDSLIDE_HOLLOW_STROKE} />}>{i18n.t("legend.hazard.gbLandslideUnchecked", { n: i18n.formatNumber(GB_LANDSLIDE_CHECKED.unchecked) })}</LegendRow>
    <DenseHeatmapLegendRow layers={["gbLandslide"]} />
    <LegendNote>{i18n.t("legend.hazard.gbLandslideNote")}</LegendNote>
    <LegendNote>{i18n.t("legend.hazard.gbLandslideCoverage")}</LegendNote>
    <LegendNote>{i18n.t("legend.hazard.gbLandslideLicense")}</LegendNote>
    <LegendNote>{GB_LANDSLIDE_ATTRIBUTION}</LegendNote>
  </div>;
}

/** 氡氣指示圖：6 級（網格色盤 YlOrBr 重取樣，隨底圖切換）。 */
export function GbRadonLegend() {
  const i18n = useLocale();
  const t = useLegendTheme();
  const colors = gbRadonColors(t.isDark);
  return <div>
    <LegendTitle zh={layerTitle("gbRadon", i18n)} en="Indicative Atlas of Radon" />
    {GB_RADON_CLASSES.map((c, i) => (
      <LegendRow key={c.value} swatch={<SwatchSquare color={colors[i]!} />}>
        {i18n.t("legend.hazard.gbRadonClass", { band: c.band, n: i18n.formatNumber(c.count) })}
      </LegendRow>
    ))}
    <LegendNote>{i18n.t("legend.hazard.gbRadonMeaning")}</LegendNote>
    <LegendNote>{i18n.t("legend.hazard.gbCoverageUk4")}</LegendNote>
    <LegendNote>{GB_RADON_ATTRIBUTION}</LegendNote>
  </div>;
}

/** 加馬劑量率：月平均四級（台灣環境輻射同色系）；缺值灰框空心。 */
export function GbRadiationLegend() {
  const i18n = useLocale();
  const f = (v: number) => i18n.formatNumber(v, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return <div>
    <LegendTitle zh={layerTitle("gbRadiation", i18n)} en="Ambient Gamma Dose Rate" />
    {GB_GAMMA_CLASSES.map((c, i) => {
      const lower = i === 0 ? null : GB_GAMMA_CLASSES[i - 1]!.upper;
      const label = lower == null ? `< ${f(c.upper!)}` : c.upper == null ? `≥ ${f(lower)}` : `${f(lower)}–${f(c.upper)}`;
      return <LegendRow key={i} swatch={<SwatchDot color={c.color} />}>{`${label} ${GB_GAMMA_UNIT}`}</LegendRow>;
    })}
    <LegendRow swatch={<SwatchDot color="transparent" stroke={GB_GAMMA_MISSING_STROKE} strokeWidth={1.5} />}>{i18n.t("legend.hazard.gbNoData")}</LegendRow>
    <LegendNote>{i18n.t("legend.hazard.gbGammaNote")}</LegendNote>
    <LegendNote>{i18n.t("legend.hazard.gbGammaScope", { n: i18n.formatNumber(GB_GAMMA_COUNT) })}</LegendNote>
    <LegendNote>{GB_GAMMA_ATTRIBUTION}</LegendNote>
  </div>;
}

/** 地震目錄：儀器記錄實心、歷史地震空心；點大小依規模。 */
export function GbEarthquakesLegend() {
  const i18n = useLocale();
  return <div>
    <LegendTitle zh={layerTitle("gbEarthquakes", i18n)} en="BGS Earthquake Catalogue" />
    <LegendRow swatch={<SwatchDot color={GB_QUAKE_COLOR} />}>
      {i18n.t("legend.hazard.gbQuakeInstrumental", { years: GB_QUAKE_YEARS.instrumental, n: i18n.formatNumber(GB_QUAKE_COUNTS.instrumental) })}
    </LegendRow>
    <LegendRow swatch={<SwatchDot color="transparent" stroke={GB_QUAKE_COLOR} strokeWidth={1.5} />}>
      {i18n.t("legend.hazard.gbQuakeHistorical", { years: GB_QUAKE_YEARS.historical, n: i18n.formatNumber(GB_QUAKE_COUNTS.historical) })}
    </LegendRow>
    <LegendSizeRow
      title={i18n.t("legend.hazard.gbQuakeSize")}
      items={GB_QUAKE_MAG_BANDS.map((b) => ({ r: gbQuakeRadiusPx(b.at), label: b.label }))}
      fill={GB_QUAKE_COLOR}
    />
    <LegendNote>{i18n.t("legend.hazard.gbQuakeUnknown", { n: i18n.formatNumber(GB_QUAKE_COUNTS.unknownMagnitude) })}</LegendNote>
    <LegendNote>{i18n.t("legend.hazard.gbQuakeMinor", { zoom: GB_QUAKE_MINOR_MINZOOM })}</LegendNote>
    <LegendNote>{i18n.t("legend.hazard.gbQuakeOffshore", { n: i18n.formatNumber(GB_QUAKE_COUNTS.offshore) })}</LegendNote>
    <LegendNote>{i18n.t("legend.hazard.gbQuakeDataEnd", { date: GB_QUAKE_DATA_END })}</LegendNote>
    <LegendNote>{GB_QUAKE_ATTRIBUTION}</LegendNote>
  </div>;
}

// 崩塌 4 層圖例（legendKit；色票與地圖 paint 同源，皆 import landslideTypes）。
import { useLocale } from "../../state/localeStore";
import { LAYER_MANIFEST } from "../../data/layerManifest";
import { enumLabel } from "../../i18n/dataText";
import { localizeLayerName } from "../../i18n/layerText";
import { LegendNote, LegendRow, LegendTitle, SwatchDot, SwatchLine, SwatchSquare } from "./legendKit";
import {
  ANNUAL_V2_NOTE, DOD_RISK_OPTIONS, HIGHWAY_CATEGORY_GROUPS, LANDSLIDE_LAYER_COLORS,
} from "../../data/landslideTypes";

export function LandslideDodAreasLegend() {
  const i18n = useLocale();
  const dod = i18n.t("legend.landslide.dodNote");
  return <div>
    <LegendTitle zh={localizeLayerName("landslideDodAreas", LAYER_MANIFEST.landslideDodAreas.name, i18n).primary} en="Large-scale Landslide Areas" />
    {DOD_RISK_OPTIONS.map((option) => <LegendRow key={option.value} swatch={<SwatchSquare color={option.color} />}>{enumLabel("landslideRisk", option.value, option.label, i18n)}</LegendRow>)}
    <LegendNote>{i18n.t("legend.landslide.areasNote", { dod })}</LegendNote>
  </div>;
}

export function LandslideDodImpactLegend() {
  const i18n = useLocale();
  const dod = i18n.t("legend.landslide.dodNote");
  return <div>
    <LegendTitle zh={localizeLayerName("landslideDodImpact", LAYER_MANIFEST.landslideDodImpact.name, i18n).primary} en="Landslide Impact Zones" />
    {DOD_RISK_OPTIONS.map((option) => <LegendRow key={option.value} swatch={<SwatchLine color={option.color} dash={[3, 2]} />}>{enumLabel("landslideRisk", option.value, option.label, i18n)}</LegendRow>)}
    <LegendNote>{i18n.t("legend.landslide.impactNote", { dod })}</LegendNote>
  </div>;
}

export function HighwayDisasterHistoryLegend() {
  const i18n = useLocale();
  return <div>
    <LegendTitle zh={localizeLayerName("highwayDisasterHistory", LAYER_MANIFEST.highwayDisasterHistory.name, i18n).primary} en="Highway Disaster History" />
    {HIGHWAY_CATEGORY_GROUPS.map((option) => <LegendRow key={option.value} swatch={<SwatchDot color={option.color} />}>{enumLabel("landslideHighwayGroup", option.value, option.label, i18n)}</LegendRow>)}
    <LegendNote>{i18n.t("legend.landslide.highwayNote")}</LegendNote>
  </div>;
}

export function LandslideAnnualLegend() {
  const i18n = useLocale();
  return <div>
    <LegendTitle zh={localizeLayerName("landslideAnnual", LAYER_MANIFEST.landslideAnnual.name, i18n).primary} en="Annual Landslide Inventory" />
    <LegendRow swatch={<SwatchSquare color={LANDSLIDE_LAYER_COLORS.landslideAnnual} />}>{i18n.t("legend.landslide.annualRow")}</LegendRow>
    <LegendNote>{i18n.t("legend.landslide.annualNote", {
      zoom: i18n.t("legend.landslide.annualZoom"),
      years: i18n.t("legend.landslide.annualYears"),
      v2: enumLabel("landslideNote", "annualV2", ANNUAL_V2_NOTE, i18n),
    })}</LegendNote>
  </div>;
}

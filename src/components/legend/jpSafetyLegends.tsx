// 日本第二輪 C083（2026-11-06）人身交通事故圖例（legendKit；色票與地圖 paint 同源，皆 import jpTrafficAccidentsTypes）。
import { useLocale } from "../../state/localeStore";
import { LAYER_MANIFEST } from "../../data/layerManifest";
import { enumLabel } from "../../i18n/dataText";
import { localizeLayerName } from "../../i18n/layerText";
import { LegendNote, LegendRow, LegendTitle, SwatchDot } from "./legendKit";
import { DenseHeatmapLegendRow } from "./legendShared";
import { JP_TRAFFIC_ACCIDENT_PERIOD, JP_TRAFFIC_ACCIDENT_SEVERITY_OPTIONS, JP_TRAFFIC_ACCIDENT_TOTAL } from "../../data/jpTrafficAccidentsTypes";

export function JpTrafficAccidents2025Legend() {
  const i18n = useLocale();
  return <div>
    <LegendTitle zh={localizeLayerName("jpTrafficAccidents2025", LAYER_MANIFEST.jpTrafficAccidents2025.name, i18n).primary} en="Injury Crashes 2025" />
    {JP_TRAFFIC_ACCIDENT_SEVERITY_OPTIONS.map((option) => (
      <LegendRow key={option.value} swatch={<SwatchDot color={option.color} />}>
        {enumLabel("jpTrafficAccidentSeverity", option.value, option.label, i18n)} · {i18n.formatNumber(option.count)}
      </LegendRow>
    ))}
    <DenseHeatmapLegendRow layers={["jpTrafficAccidents2025"]} />
    <LegendNote>
      {i18n.t("legend.jpSafety.accidentsPeriod", { period: JP_TRAFFIC_ACCIDENT_PERIOD, total: i18n.formatNumber(JP_TRAFFIC_ACCIDENT_TOTAL) })}<br />
      {i18n.t("legend.jpSafety.accidentsScope")}<br />
      {i18n.t("legend.jpSafety.accidentsSource")}
    </LegendNote>
  </div>;
}

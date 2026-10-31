// G36（2026-10-31）消防、民防、情勢與交通事故圖例（legendKit；色票與地圖 paint 同源，皆 import safetyG36Types）。
import { useLocale } from "../../state/localeStore";
import { LAYER_MANIFEST } from "../../data/layerManifest";
import { enumLabel } from "../../i18n/dataText";
import { localizeLayerName } from "../../i18n/layerText";
import { LegendNote, LegendRow, LegendTitle, SwatchDot, SwatchLine } from "./legendKit";
import { DenseHeatmapLegendRow } from "./legendShared";
import {
  DISASTER_RESOURCE_HOLDER_OPTIONS, FIRING_AGENCY_OPTIONS, NUCLEAR_EPZ_KIND_OPTIONS, TRAFFIC_ACCIDENT_CLASS_OPTIONS,
  TRAFFIC_ACCIDENT_PERIOD, TSUNAMI_SIREN_COLOR,
} from "../../data/safetyG36Types";

function CountRows({ domain, options }: { domain: string; options: readonly { value: string; label: string; color: string; count: number }[] }) {
  const i18n = useLocale();
  return <>{options.map((option) => (
    <LegendRow key={option.value} swatch={<SwatchDot color={option.color} />}>
      {enumLabel(domain, option.value, option.label, i18n)} · {i18n.formatNumber(option.count)}
    </LegendRow>
  ))}</>;
}

export function TrafficAccidents2025Legend() {
  const i18n = useLocale();
  return <div>
    <LegendTitle zh={localizeLayerName("trafficAccidents2025", LAYER_MANIFEST.trafficAccidents2025.name, i18n).primary} en="A1/A2 Crashes 2025" />
    <CountRows domain="trafficAccidentClass" options={TRAFFIC_ACCIDENT_CLASS_OPTIONS} />
    <DenseHeatmapLegendRow layers={["trafficAccidents2025"]} />
    <LegendNote>
      {i18n.t("legend.civic.trafficAccidents2025Period", { period: TRAFFIC_ACCIDENT_PERIOD })}<br />
      {i18n.t("legend.civic.trafficAccidents2025Note")}
    </LegendNote>
  </div>;
}

export function DisasterResourceSitesLegend() {
  const i18n = useLocale();
  return <div>
    <LegendTitle zh={localizeLayerName("disasterResourceSites", LAYER_MANIFEST.disasterResourceSites.name, i18n).primary} en="Disaster Resource Sites" />
    <CountRows domain="disasterResourceHolder" options={DISASTER_RESOURCE_HOLDER_OPTIONS} />
    <LegendNote>{i18n.t("legend.hazard.disasterResourceNote")}</LegendNote>
  </div>;
}

export function TsunamiSirensLegend() {
  const i18n = useLocale();
  return <div>
    <LegendTitle zh={localizeLayerName("tsunamiSirens", LAYER_MANIFEST.tsunamiSirens.name, i18n).primary} en="Tsunami Sirens" />
    <LegendRow swatch={<SwatchDot color={TSUNAMI_SIREN_COLOR} />}>{i18n.t("legend.civic.tsunamiSirensRow", { count: i18n.formatNumber(376) })}</LegendRow>
    <LegendNote>{i18n.t("legend.civic.tsunamiSirensNote")}</LegendNote>
  </div>;
}

export function NuclearEpzEvacuationLegend() {
  const i18n = useLocale();
  return <div>
    <LegendTitle zh={localizeLayerName("nuclearEpzEvacuation", LAYER_MANIFEST.nuclearEpzEvacuation.name, i18n).primary} en="Nuclear EPZ Evacuation" />
    <CountRows domain="nuclearEpzKind" options={NUCLEAR_EPZ_KIND_OPTIONS} />
    <LegendNote>{i18n.t("legend.civic.nuclearEpzNote")}</LegendNote>
  </div>;
}

export function FiringNoticeAreasLegend() {
  const i18n = useLocale();
  return <div>
    <LegendTitle zh={localizeLayerName("firingNoticeAreas", LAYER_MANIFEST.firingNoticeAreas.name, i18n).primary} en="Live-fire Notice Areas" />
    {FIRING_AGENCY_OPTIONS.map((option) => (
      <LegendRow key={option.value} swatch={<SwatchLine color={option.color} dash={[4, 3]} />}>
        {enumLabel("firingAgency", option.value, option.label, i18n)} · {i18n.formatNumber(option.count)}
      </LegendRow>
    ))}
    <LegendNote>{i18n.t("legend.civic.firingNoticeNote")}</LegendNote>
  </div>;
}

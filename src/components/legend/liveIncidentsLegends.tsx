// 即時案件圖例：即時 119 案件、警廣即時路況（色票 SSOT = src/data/liveIncidentsTypes.ts）
import { useSyncExternalStore } from "react";
import { LegendNote, LegendRow, LegendTitle, SwatchDot, SwatchSquare, useLegendTheme } from "./legendKit";
import {
  FIRE119_CATEGORIES,
  FIRE119_CATEGORY_COLOR,
  FIRE119_DISTRICT_COLORS,
  FIRE119_HOSPITAL_COLOR,
  FIRE119_RETURNED_COLOR,
  PBS_CATEGORY_COLOR,
  PBS_CLEARED_COLOR,
} from "../../data/liveIncidentsTypes";
import { fire119SnapshotStore, pbsSnapshotStore } from "../../data/liveIncidentsLoader";
import { useLocale } from "../../state/localeStore";
import { localizeLayerName } from "../../i18n/layerText";
import { LAYER_MANIFEST } from "../../data/layerManifest";

// i18n key 寫成字面值（localeParity 測試靠字面值判斷 key 有人用）
const CAT_KEY = {
  fire: "legend.liveIncidents.cat.fire",
  ems: "legend.liveIncidents.cat.ems",
  rescue: "legend.liveIncidents.cat.rescue",
  other: "legend.liveIncidents.cat.other",
} as const;

/** 空心圓（送醫中）＝描邊色票 */
function SwatchHollow({ color }: { color: string }) {
  return <SwatchDot color={color} opacity={0} stroke={color} strokeWidth={2} />;
}

export function Fire119LiveLegend() {
  const i18n = useLocale();
  const { t } = i18n;
  const theme = useLegendTheme();
  const snap = useSyncExternalStore(fire119SnapshotStore.subscribe, fire119SnapshotStore.getSnapshot, fire119SnapshotStore.getSnapshot);
  return (
    <div>
      <LegendTitle zh={localizeLayerName("fire119Live", LAYER_MANIFEST.fire119Live.name, i18n).primary} en="Live 119" />
      {FIRE119_CATEGORIES.map((c) => (
        <LegendRow key={c} swatch={<SwatchDot color={FIRE119_CATEGORY_COLOR[c]} />}>{t(CAT_KEY[c])}</LegendRow>
      ))}
      <div style={{ height: 6 }} />
      <LegendRow swatch={<SwatchDot color={FIRE119_CATEGORY_COLOR.ems} glow={FIRE119_CATEGORY_COLOR.ems} />}>{t("legend.liveIncidents.status.active")}</LegendRow>
      <LegendRow swatch={<SwatchHollow color={FIRE119_CATEGORY_COLOR.ems} />}>{t("legend.liveIncidents.status.transporting")}</LegendRow>
      <LegendRow swatch={<SwatchDot color={FIRE119_RETURNED_COLOR} opacity={0.6} />}>{t("legend.liveIncidents.status.returned")}</LegendRow>
      <div style={{ height: 6 }} />
      <LegendRow swatch={<SwatchDot color={theme.textMuted} />}>{t("legend.liveIncidents.shape.point")}</LegendRow>
      <LegendRow swatch={<SwatchSquare color={FIRE119_DISTRICT_COLORS[1]} />}>{t("legend.liveIncidents.shape.district")}</LegendRow>
      <LegendRow swatch={<SwatchHollow color={FIRE119_HOSPITAL_COLOR} />}>{t("legend.liveIncidents.shape.hospital")}</LegendRow>
      <LegendNote>{t("legend.liveIncidents.note")}</LegendNote>
      {snap && <LegendNote>{t("legend.liveIncidents.counts", { total: snap.total, unmapped: snap.unmapped })}</LegendNote>}
      {snap?.truncated && <LegendNote>{t("legend.liveIncidents.truncated")}</LegendNote>}
    </div>
  );
}

export function PbsRoadEventsLiveLegend() {
  const i18n = useLocale();
  const { t } = i18n;
  const snap = useSyncExternalStore(pbsSnapshotStore.subscribe, pbsSnapshotStore.getSnapshot, pbsSnapshotStore.getSnapshot);
  return (
    <div>
      <LegendTitle zh={localizeLayerName("pbsRoadEventsLive", LAYER_MANIFEST.pbsRoadEventsLive.name, i18n).primary} en="PBS Road" />
      <LegendRow swatch={<SwatchDot color={PBS_CATEGORY_COLOR.traffic_incident} />}>{t("legend.liveIncidents.pbs.incident")}</LegendRow>
      <LegendRow swatch={<SwatchDot color={PBS_CATEGORY_COLOR.other} />}>{t("legend.liveIncidents.pbs.other")}</LegendRow>
      <LegendRow swatch={<SwatchDot color={PBS_CLEARED_COLOR} opacity={0.45} />}>{t("legend.liveIncidents.pbs.cleared")}</LegendRow>
      <LegendNote>{t("legend.liveIncidents.pbsNote")}</LegendNote>
      {snap && <LegendNote>{t("legend.liveIncidents.pbsCounts", { total: snap.total, unmapped: snap.unmapped })}</LegendNote>}
      {snap?.truncated && <LegendNote>{t("legend.liveIncidents.truncated")}</LegendNote>}
    </div>
  );
}

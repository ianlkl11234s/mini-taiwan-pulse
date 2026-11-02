// 政治 Politics 圖例：2026 選舉活動（色票 SSOT = src/data/electionEventsTypes.ts）
import { useSyncExternalStore } from "react";
import { LegendNote, LegendRow, LegendSizeRow, LegendTitle, SwatchDot } from "./legendKit";
import { FireCatRows } from "./legendShared";
import { ELECTION_CAMPS, ELECTION_CAMP_COLOR, ELECTION_PAST_OPACITY, ELECTION_TIER_RADIUS } from "../../data/electionEventsTypes";
import { electionEventsMetaStore } from "../../data/electionEventsLoader";
import { useLocale } from "../../state/localeStore";
import { localizeLayerName } from "../../i18n/layerText";
import { LAYER_MANIFEST } from "../../data/layerManifest";

// i18n key 寫成字面值（localeParity 測試靠字面值判斷 key 有人用）
const CAMP_KEY = {
  dpp: "legend.politics.camp.dpp",
  kmt: "legend.politics.camp.kmt",
  tpp: "legend.politics.camp.tpp",
  npp: "legend.politics.camp.npp",
  other: "legend.politics.camp.other",
} as const;

export function ElectionEventsLegend() {
  const i18n = useLocale();
  const { t, formatDateTime } = i18n;
  const meta = useSyncExternalStore(electionEventsMetaStore.subscribe, electionEventsMetaStore.getSnapshot);
  const unmapped = meta && meta.total !== null && meta.mapped !== null ? Math.max(0, meta.total - meta.mapped) : null;
  const loadedAt = meta?.loadedAt ? new Date(meta.loadedAt) : null;
  const grey = ELECTION_CAMP_COLOR.other;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <LegendTitle zh={localizeLayerName("electionEvents2026", LAYER_MANIFEST.electionEvents2026.name, i18n).primary} en="Election Events" />
      <FireCatRows cats={ELECTION_CAMPS.map((c) => ({ color: c.color, label: t(CAMP_KEY[c.key]) }))} />
      <LegendSizeRow
        title={t("legend.politics.size")}
        fill={grey}
        items={[
          { r: ELECTION_TIER_RADIUS.L, label: t("legend.politics.tierL") },
          { r: ELECTION_TIER_RADIUS.M, label: t("legend.politics.tierM") },
          { r: ELECTION_TIER_RADIUS.S, label: t("legend.politics.tierS") },
        ]}
      />
      <LegendRow swatch={<SwatchDot color={grey} opacity={ELECTION_PAST_OPACITY} />}>{t("legend.politics.past")}</LegendRow>
      <LegendRow swatch={<SwatchDot color="transparent" stroke={grey} strokeWidth={2} />}>{t("legend.politics.hollow")}</LegendRow>
      <LegendNote>{t("legend.politics.bias")}</LegendNote>
      {unmapped !== null && unmapped > 0 && <LegendNote>{t("legend.politics.unmapped", { count: unmapped })}</LegendNote>}
      {loadedAt && !Number.isNaN(loadedAt.getTime()) && (
        <LegendNote>{t("legend.politics.updated", { time: formatDateTime(loadedAt, { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }) })}</LegendNote>
      )}
      <LegendNote>{t("legend.politics.source")}</LegendNote>
    </div>
  );
}

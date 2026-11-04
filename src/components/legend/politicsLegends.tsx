// 政治 Politics 圖例：2026 選舉活動（色票 SSOT = src/data/electionEventsTypes.ts）、2024 投開票所（src/data/pollingStationsTypes.ts）
import { useSyncExternalStore } from "react";
import { LegendNote, LegendRow, LegendSizeRow, LegendTitle, SwatchDot, SwatchSteps } from "./legendKit";
import { FireCatRows } from "./legendShared";
import { ELECTION_CAMPS, ELECTION_CAMP_COLOR, ELECTION_PAST_OPACITY, ELECTION_TIER_RADIUS } from "../../data/electionEventsTypes";
import { electionEventsMetaStore } from "../../data/electionEventsLoader";
import { pollingLegendStore } from "../../data/pollingStationsLoader";
import {
  POLLING_COLOR_MODES, POLLING_FETCH_LIMIT, POLLING_LEAD_COLOR, POLLING_LEAD_KEYS,
  POLLING_ROAD_OPACITY, POLLING_TURNOUT_BREAKS, POLLING_TURNOUT_COLORS,
} from "../../data/pollingStationsTypes";
import { oneOfParam, paramStr, useLayerParams } from "../../layers/layerParamsAccess";
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
        ring={grey}
        items={[
          { r: ELECTION_TIER_RADIUS.L, label: t("legend.politics.tierL") },
          { r: ELECTION_TIER_RADIUS.M, label: t("legend.politics.tierM") },
          { r: ELECTION_TIER_RADIUS.S, label: t("legend.politics.tierS") },
        ]}
      />
      <LegendRow swatch={<SwatchDot color={ELECTION_CAMP_COLOR.dpp} opacity={ELECTION_PAST_OPACITY} />}>{t("legend.politics.past")}</LegendRow>
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

// ── 2024 投開票所（公開）──
const LEAD_KEY = {
  dpp: "legend.politics.polling.lead.dpp",
  kmt: "legend.politics.polling.lead.kmt",
  tpp: "legend.politics.polling.lead.tpp",
  tie: "legend.politics.polling.lead.tie",
} as const;

export function PollingStationsLegend() {
  const i18n = useLocale();
  const { t, formatNumber } = i18n;
  const values = useLayerParams("pollingStations2024");
  const mode = oneOfParam(paramStr(values, "pollingStations2024", "pollingStations2024ColorBy"), POLLING_COLOR_MODES, "lead");
  const { meta, belowMinZoom } = useSyncExternalStore(pollingLegendStore.subscribe, pollingLegendStore.getSnapshot);
  const unmapped = meta && meta.total !== null && meta.mapped !== null ? Math.max(0, meta.total - meta.mapped) : null;
  const sample = POLLING_LEAD_COLOR.dpp;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <LegendTitle zh={localizeLayerName("pollingStations2024", LAYER_MANIFEST.pollingStations2024.name, i18n).primary} en="2024 Polling Stations" />
      {mode === "turnout" ? (
        <>
          <LegendNote>{t("legend.politics.polling.turnoutTitle")}</LegendNote>
          <SwatchSteps
            colors={POLLING_TURNOUT_COLORS}
            breaks={["", ...POLLING_TURNOUT_BREAKS.map((b) => `${formatNumber(b)}%`), ""]}
          />
        </>
      ) : (
        <>
          <LegendNote>{t("legend.politics.polling.leadTitle")}</LegendNote>
          <FireCatRows cats={POLLING_LEAD_KEYS.map((k) => ({ color: POLLING_LEAD_COLOR[k], label: t(LEAD_KEY[k]) }))} />
        </>
      )}
      <LegendRow swatch={<SwatchDot color={sample} opacity={0.9 * POLLING_ROAD_OPACITY} />}>{t("legend.politics.polling.road")}</LegendRow>
      {belowMinZoom && <LegendNote>{t("legend.politics.polling.zoomHint")}</LegendNote>}
      {!belowMinZoom && meta?.truncated && (
        <LegendNote>{t("legend.politics.polling.truncated", { shown: formatNumber(POLLING_FETCH_LIMIT), count: formatNumber(meta.inBbox ?? 0) })}</LegendNote>
      )}
      <LegendNote>
        {unmapped !== null
          ? t("legend.politics.polling.unmappedExact", { count: formatNumber(unmapped) })
          : t("legend.politics.polling.unmapped")}
      </LegendNote>
      <LegendNote>{t("legend.politics.polling.year")}</LegendNote>
      <LegendNote>{t("legend.politics.polling.source")}</LegendNote>
    </div>
  );
}

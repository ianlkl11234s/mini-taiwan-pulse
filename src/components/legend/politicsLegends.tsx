// 政治 Politics 圖例：2026 選舉活動（色票 SSOT = src/data/electionEventsTypes.ts）、2024 投開票所（src/data/pollingStationsTypes.ts）
import { useSyncExternalStore } from "react";
import { LEGEND_SWATCH, LegendNote, LegendRow, LegendSizeRow, LegendTitle, SwatchDot, SwatchSquare, SwatchSteps, useLegendTheme } from "./legendKit";
import { FireCatRows } from "./legendShared";
import { ELECTION_CAMPS, ELECTION_CAMP_COLOR, ELECTION_PAST_OPACITY, ELECTION_RING_FILL_OPACITY, ELECTION_RING_STROKE, ELECTION_RING_STROKE_OPACITY, ELECTION_TIER_RADIUS, type ElectionApproxPrecision } from "../../data/electionEventsTypes";
import { electionEventsMetaStore } from "../../data/electionEventsLoader";
import { ELECTION_GROUP_ICON_COLORS } from "../../map/electionGroupIcon";
import { FONT_DATA } from "../../styles/designTokens";
import { pollingLegendStore } from "../../data/pollingStationsLoader";
import { COUNCIL_DISTRICT_COLOR } from "../../data/councilDistrictsLoader";
import {
  POLLING_COLOR_MODES, POLLING_DEFAULT_COLOR_MODE, POLLING_FETCH_LIMIT, POLLING_HEAT_PARTIES, POLLING_LEAD_COLOR, POLLING_LEAD_KEYS,
  POLLING_NEUTRAL_COLOR, POLLING_ROAD_OPACITY, POLLING_TURNOUT_BREAKS, POLLING_TURNOUT_COLORS,
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

// 圖例示意的外環位移（圖例 22px 內畫不下地圖實際位移，依同一順序等比縮小：越粗略離點越遠）
const LEGEND_RING: Record<ElectionApproxPrecision, { r: number; gap: number }> = {
  settlement: { r: 4, gap: 3 },
  town_centroid: { r: 3, gap: 5.5 },
  city_centroid: { r: 2.5, gap: 7.5 },
};
const PRECISION_SWATCH = 22;

/** 位置精度示意：主點＋精度外環（同地圖 precision 子圖層的填色／描邊透明度） */
function SwatchPrecision({ precision, color }: { precision: ElectionApproxPrecision | "venue"; color: string }) {
  const t = useLegendTheme();
  const c = PRECISION_SWATCH / 2;
  const ring = precision === "venue" ? null : LEGEND_RING[precision];
  const r = ring ? ring.r : LEGEND_SWATCH.dot / 2;
  return (
    <svg aria-hidden="true" width={PRECISION_SWATCH} height={PRECISION_SWATCH} style={{ flexShrink: 0 }}>
      {ring && precision !== "venue" && (
        <circle cx={c} cy={c} r={ring.r + ring.gap} fill={color} fillOpacity={ELECTION_RING_FILL_OPACITY.upcoming}
          stroke={color} strokeOpacity={ELECTION_RING_STROKE_OPACITY.upcoming} strokeWidth={ELECTION_RING_STROKE[precision]} />
      )}
      <circle cx={c} cy={c} r={r} fill={color} fillOpacity={0.9} stroke={t.seam} strokeWidth={1} />
    </svg>
  );
}

/** 同一代表點多場示意：分段外環（兩陣營）＋中心場次數 */
function SwatchGroup() {
  const c = PRECISION_SWATCH / 2;
  const R = 10;
  const segs: [string, number][] = [[ELECTION_CAMP_COLOR.kmt, 0.6], [ELECTION_CAMP_COLOR.dpp, 0.4]];
  let a0 = -90;
  const arcs = segs.map(([col, f]) => {
    const a1 = a0 + 360 * f;
    const pt = (d: number) => [c + R * Math.cos((d * Math.PI) / 180), c + R * Math.sin((d * Math.PI) / 180)] as const;
    const [x0, y0] = pt(a0 + 4);
    const [x1, y1] = pt(a1 - 4);
    a0 = a1;
    return <path key={col} d={`M${x0},${y0} A${R},${R} 0 ${f > 0.5 ? 1 : 0} 1 ${x1},${y1}`} fill="none" stroke={col} strokeWidth={2} />;
  });
  return (
    <svg aria-hidden="true" width={PRECISION_SWATCH} height={PRECISION_SWATCH} style={{ flexShrink: 0 }}>
      {arcs}
      <circle cx={c} cy={c} r={6} fill={ELECTION_GROUP_ICON_COLORS.centerFill} stroke={ELECTION_GROUP_ICON_COLORS.centerStroke} />
      <text x={c} y={c + 3} textAnchor="middle" fontSize={8} fill={ELECTION_GROUP_ICON_COLORS.label} fontFamily={FONT_DATA}>5</text>
    </svg>
  );
}

/** 同一確切地點多場示意：實心分色圓（陣營比例，不帶精度外環）＋中心場次數（同 electionGroupIcon 的 venue 畫法） */
function SwatchVenueGroup() {
  const c = PRECISION_SWATCH / 2;
  const R = 8;
  const segs: [string, number][] = [[ELECTION_CAMP_COLOR.kmt, 0.6], [ELECTION_CAMP_COLOR.dpp, 0.4]];
  let a0 = -90;
  const pt = (d: number) => [c + R * Math.cos((d * Math.PI) / 180), c + R * Math.sin((d * Math.PI) / 180)] as const;
  const wedges = segs.map(([col, f]) => {
    const a1 = a0 + 360 * f;
    const [x0, y0] = pt(a0);
    const [x1, y1] = pt(a1);
    a0 = a1;
    return <path key={col} d={`M${c},${c} L${x0},${y0} A${R},${R} 0 ${f > 0.5 ? 1 : 0} 1 ${x1},${y1} Z`} fill={col} />;
  });
  return (
    <svg aria-hidden="true" width={PRECISION_SWATCH} height={PRECISION_SWATCH} style={{ flexShrink: 0 }}>
      {wedges}
      <circle cx={c} cy={c} r={R} fill="none" stroke={ELECTION_GROUP_ICON_COLORS.centerFill} strokeWidth={1.2} />
      <circle cx={c} cy={c} r={R * 0.62} fill={ELECTION_GROUP_ICON_COLORS.centerFill} />
      <text x={c} y={c + 3} textAnchor="middle" fontSize={8} fill={ELECTION_GROUP_ICON_COLORS.label} fontFamily={FONT_DATA}>3</text>
    </svg>
  );
}

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
      <div style={{ marginTop: 6 }}>
        <LegendTitle zh={t("legend.politics.precision.title")} />
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <LegendRow swatch={<SwatchPrecision precision="venue" color={grey} />}>{t("legend.politics.precision.venue")}</LegendRow>
          <LegendRow swatch={<SwatchVenueGroup />}>{t("legend.politics.precision.venueGroup")}</LegendRow>
          <LegendRow swatch={<SwatchPrecision precision="settlement" color={grey} />}>{t("legend.politics.precision.settlement")}</LegendRow>
          <LegendRow swatch={<SwatchPrecision precision="town_centroid" color={grey} />}>{t("legend.politics.precision.town")}</LegendRow>
          <LegendRow swatch={<SwatchPrecision precision="city_centroid" color={grey} />}>{t("legend.politics.precision.city")}</LegendRow>
          <LegendRow swatch={<SwatchGroup />}>{t("legend.politics.precision.group")}</LegendRow>
        </div>
        <LegendNote>{t("legend.politics.precision.note")}</LegendNote>
      </div>
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
  const mode = oneOfParam(paramStr(values, "pollingStations2024", "pollingStations2024ColorBy"), POLLING_COLOR_MODES, POLLING_DEFAULT_COLOR_MODE);
  const heatOn = (party: (typeof POLLING_HEAT_PARTIES)[number]) =>
    values[`pollingStations2024Heat${party[0]!.toUpperCase()}${party.slice(1)}`] !== false;
  const { meta, belowMinZoom } = useSyncExternalStore(pollingLegendStore.subscribe, pollingLegendStore.getSnapshot);
  const unmapped = meta && meta.total !== null && meta.mapped !== null ? Math.max(0, meta.total - meta.mapped) : null;
  const sample = mode === "neutral" ? POLLING_NEUTRAL_COLOR : POLLING_LEAD_COLOR.dpp;
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
      ) : mode === "lead" ? (
        <>
          <LegendNote>{t("legend.politics.polling.leadTitle")}</LegendNote>
          <FireCatRows cats={POLLING_LEAD_KEYS.map((k) => ({ color: POLLING_LEAD_COLOR[k], label: t(LEAD_KEY[k]) }))} />
        </>
      ) : (
        <LegendRow swatch={<SwatchDot color={POLLING_NEUTRAL_COLOR} />}>{t("legend.politics.polling.neutral")}</LegendRow>
      )}
      {mode === "lead" ? (
        <LegendNote>
          {t("legend.politics.polling.heatParties", {
            parties: POLLING_HEAT_PARTIES.filter(heatOn).map((k) => t(LEAD_KEY[k])).join("、") || t("legend.politics.polling.heatNone"),
          })}
        </LegendNote>
      ) : (
        <LegendNote>{t("legend.politics.polling.heatElectors")}</LegendNote>
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

// ── 2026 議員選區（公開）──
export function CouncilDistrictsLegend() {
  const i18n = useLocale();
  const { t } = i18n;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <LegendTitle zh={localizeLayerName("councilDistricts2026", LAYER_MANIFEST.councilDistricts2026.name, i18n).primary} en="2026 Council Districts" />
      <LegendRow swatch={<SwatchSquare color={COUNCIL_DISTRICT_COLOR} opacity={0.25} stroke={COUNCIL_DISTRICT_COLOR} />}>{t("legend.politics.council.area")}</LegendRow>
      <LegendNote>{t("legend.politics.council.noIndigenous")}</LegendNote>
      <LegendNote>{t("legend.politics.council.source")}</LegendNote>
    </div>
  );
}

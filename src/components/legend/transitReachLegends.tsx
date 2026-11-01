/**
 * 交通可及性圖例（模擬面板，公開、情境推演）。
 * - 網格：目前指標的分階色（由高到低列出每階的界）＋未涵蓋（不當 0）。
 * - 播放：分階色條（前 2 小時每 15 分、之後每 30 分）或比較兩色、航／船虛線、無路網／離島未接上。
 * 資料載入錯誤（404、SHA 不符、路徑不合法）一律在圖例顯示，不靜默。
 */
import { useSyncExternalStore } from "react";
import { LegendNote, LegendRow, LegendTitle, SwatchHatch, SwatchLine, SwatchSquare, SwatchSteps } from "./legendKit";
import { simBundleStatus, subscribeSimBundleStatus } from "../../data/simBundle";
import type { SimBundleErrorCode } from "../../data/simBundleTypes";
import { subscribeTransitReachGrid, subscribeTransitReachNotice, transitReachGridData, transitReachNotice, transitReachPlaybackState, subscribeTransitReachPlayback } from "../../data/transitReachStore";
import {
  TRANSIT_REACH_COMPARE_COLORS, TRANSIT_REACH_FIXED_RANGE_H, TRANSIT_REACH_GRID_KEY, TRANSIT_REACH_GRID_METRICS, TRANSIT_REACH_GRID_METRIC_LABELS,
  TRANSIT_REACH_GRID_VIEWS, TRANSIT_REACH_GRID_VIEW_LABELS, TRANSIT_REACH_MODE_LABELS, TRANSIT_REACH_MODES, TRANSIT_REACH_PLAYBACK_KEY,
  TRANSIT_REACH_ROUTE_COLORS, TRANSIT_REACH_SLUG, TRANSIT_REACH_SPEED_LABELS, TRANSIT_REACH_SPEEDS, TRANSIT_REACH_UNCOVERED_COLOR,
  isCompareMode, isTimeMetric, nStepsFor, viridisAt,
} from "../../data/transitReachTypes";
import { transitReachGridClasses } from "../../hooks/useTransitReachGridLayer";
import { oneOfParam, paramStr, useLayerParams } from "../../layers/layerParamsAccess";
import { paramText } from "../../i18n/paramText";
import { useLocale } from "../../state/localeStore";
import { formatMinutes, formatPopulation } from "../featureInfo/transitReachPanels";

const ERROR_KEYS = {
  not_found: "legend.transitReach.error.not_found",
  http: "legend.transitReach.error.http",
  timeout: "legend.transitReach.error.timeout",
  network: "legend.transitReach.error.network",
  sha_mismatch: "legend.transitReach.error.sha_mismatch",
  size_mismatch: "legend.transitReach.error.size_mismatch",
  path: "legend.transitReach.error.path",
  schema: "legend.transitReach.error.schema",
  not_listed: "legend.transitReach.error.not_listed",
} as const satisfies Record<SimBundleErrorCode, string>;

function useBundleError(): string | null {
  const status = useSyncExternalStore(subscribeSimBundleStatus, () => simBundleStatus(TRANSIT_REACH_SLUG));
  const { t } = useLocale();
  return status.status === "error" ? t(ERROR_KEYS[status.code]) : null;
}

function ErrorNote({ text }: { text: string | null }) {
  if (!text) return null;
  return <LegendRow swatch={<SwatchHatch />}>{text}</LegendRow>;
}

export function TransitReachGridLegend() {
  const i18n = useLocale();
  const { t } = i18n;
  const K = TRANSIT_REACH_GRID_KEY;
  const values = useLayerParams(K);
  const metric = oneOfParam(paramStr(values, K, "transitReachGridMetric"), TRANSIT_REACH_GRID_METRICS, "pop2h");
  const view = oneOfParam(paramStr(values, K, "transitReachGridView"), TRANSIT_REACH_GRID_VIEWS, "abs");
  const speed = oneOfParam(paramStr(values, K, "transitReachGridSpeed"), TRANSIT_REACH_SPEEDS, "free");
  const loaded = useSyncExternalStore(subscribeTransitReachGrid, transitReachGridData);
  const error = useBundleError();
  const classes = loaded ? transitReachGridClasses(loaded.bundle, loaded.grid, { metric, view, speed }) : null;
  const fmt = (x: number) => (isTimeMetric(metric) ? formatMinutes(x, t) : formatPopulation(x, i18n));
  const rows = classes ? classes.colors.map((color, k) => {
    const lo = classes.breaks[k - 1], hi = classes.breaks[k];
    const label = k === 0 ? `< ${fmt(hi ?? 0)}` : hi === undefined ? `≥ ${fmt(lo!)}` : `${fmt(lo!)} – ${fmt(hi)}`;
    return { color, label };
  }).reverse() : [];
  const ruleKey = !isTimeMetric(metric) ? "legend.transitReach.rulePop" : metric === "thub" && view !== "gain" ? "legend.transitReach.ruleHub" : "legend.transitReach.rule15";
  return <div>
    <LegendTitle zh={paramText(TRANSIT_REACH_GRID_METRIC_LABELS[metric], i18n)} en="Transit Reach" />
    <LegendRow swatch={null}>{`${paramText(TRANSIT_REACH_GRID_VIEW_LABELS[view], i18n)}・${paramText(TRANSIT_REACH_SPEED_LABELS[speed], i18n)}`}</LegendRow>
    <ErrorNote text={error} />
    {!classes && !error && <LegendNote>{t("legend.transitReach.loading")}</LegendNote>}
    <div style={{ marginTop: 4 }}>
      {rows.map((row) => <LegendRow key={row.color + row.label} swatch={<SwatchSquare color={row.color} />}>{row.label}</LegendRow>)}
      <LegendRow swatch={<SwatchSquare color={TRANSIT_REACH_UNCOVERED_COLOR} opacity={0.45} />}>{t("legend.transitReach.uncoveredGrid")}</LegendRow>
    </div>
    <LegendNote>{t(ruleKey)}</LegendNote>
    {view === "gain" && <LegendNote>{t("legend.transitReach.gainNote")}</LegendNote>}
    <LegendNote>{t("legend.transitReach.gridCaliber")}</LegendNote>
  </div>;
}

export function TransitReachPlaybackLegend() {
  const i18n = useLocale();
  const { t } = i18n;
  const K = TRANSIT_REACH_PLAYBACK_KEY;
  const values = useLayerParams(K);
  const mode = oneOfParam(paramStr(values, K, "transitReachMode"), TRANSIT_REACH_MODES, "all");
  const range = paramStr(values, K, "transitReachRange");
  const notice = useSyncExternalStore(subscribeTransitReachNotice, transitReachNotice);
  const error = useBundleError();
  // 範圍：目前畫在地圖上的那組（每次切起點後由 hook 寫入）
  const playback = useSyncExternalStore(subscribeTransitReachPlayback, transitReachPlaybackState);
  const hours = playback?.rangeHours ?? TRANSIT_REACH_FIXED_RANGE_H;
  const n = nStepsFor(hours);
  const steps = Array.from({ length: n }, (_, k) => viridisAt(n > 1 ? k / (n - 1) : 0));
  return <div>
    <LegendTitle zh={t("legend.transitReach.playbackTitle")} en="Arrival Time" />
    <LegendRow swatch={null}>{paramText(TRANSIT_REACH_MODE_LABELS[mode], i18n)}</LegendRow>
    <ErrorNote text={error} />
    {notice && <LegendRow swatch={<SwatchHatch />}>{t("legend.transitReach.noMode", { name: notice.originName })}</LegendRow>}
    <div style={{ marginTop: 4 }}>
      {isCompareMode(mode) ? <>
        <LegendRow swatch={<SwatchSquare color={TRANSIT_REACH_COMPARE_COLORS.gain} />}>{t(mode === "cmp_air" ? "legend.transitReach.gainAir" : "legend.transitReach.gainThsr")}</LegendRow>
        <LegendRow swatch={<SwatchSquare color={TRANSIT_REACH_COMPARE_COLORS.base} />}>{t("legend.transitReach.gainOther")}</LegendRow>
      </> : <>
        <SwatchSteps colors={steps} breaks={["0", t("legend.transitReach.hours", { h: hours })]} />
        <LegendNote>{t(range === "fixed" ? "legend.transitReach.stepsFixed" : "legend.transitReach.stepsAuto", { h: hours })}</LegendNote>
      </>}
      <LegendRow swatch={<SwatchLine color={TRANSIT_REACH_ROUTE_COLORS.air} dash={[2, 2]} />}>{t("legend.transitReach.air")}</LegendRow>
      <LegendRow swatch={<SwatchLine color={TRANSIT_REACH_ROUTE_COLORS.ship} dash={[2, 2]} />}>{t("legend.transitReach.ship")}</LegendRow>
      <LegendRow swatch={<SwatchSquare color={TRANSIT_REACH_UNCOVERED_COLOR} opacity={0.3} />}>{t("legend.transitReach.noRoad")}</LegendRow>
      <LegendRow swatch={<SwatchHatch />}>{t("legend.transitReach.islandUncovered")}</LegendRow>
    </div>
    <LegendNote>{t("legend.transitReach.front")}</LegendNote>
    <LegendNote>{t("legend.transitReach.playbackCaliber")}</LegendNote>
  </div>;
}

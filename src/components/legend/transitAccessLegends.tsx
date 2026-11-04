/**
 * 雙北大眾運輸可及性圖例（模擬面板，公開、情境推演）。
 * - 網格：依指標列分階（三級分區另列各級人口與目前門檻）；比較模式列 GPS−表定的雙向分階。
 * - 單起點：分階色條或雙向比較 7 色、起點圓點。
 * 到不了（不是缺資料）用中性灰；資料載入錯誤一律在圖例顯示，不靜默。
 */
import { useMemo, useSyncExternalStore } from "react";
import { LegendNote, LegendRow, LegendTitle, SwatchDot, SwatchHatch, SwatchSquare, SwatchSteps } from "./legendKit";
import { simBundleStatus, subscribeSimBundleStatus } from "../../data/simBundle";
import type { SimBundleErrorCode } from "../../data/simBundleTypes";
import {
  subscribeTransitAccessGrid, subscribeTransitAccessGridNotice, subscribeTransitAccessPlayback, transitAccessGridNotice, transitAccessGridState,
  transitAccessPlaybackState, type TransitAccessGridState,
} from "../../data/transitAccessStore";
import {
  TIER_LABEL_KEYS, COMPARE_METRICS, GRID_PERCENTILE_LABELS, NIGHT_BUCKET_LABELS, NIGHT_COLORS, PUOR, PUOR_NEG, PUOR_POS, TIER_COLORS, TIERS, TRANSIT_ACCESS_GRID_KEY,
  TRANSIT_ACCESS_GROUP_LABELS, TRANSIT_ACCESS_METRIC_LABELS, TRANSIT_ACCESS_NETWORK_LABELS, TRANSIT_ACCESS_PLAYBACK_KEY,
  TRANSIT_ACCESS_SLOT_LABELS, TRANSIT_ACCESS_SLUG, TRANSIT_ACCESS_UNREACHED_COLOR, countColors, nearColors, spreadColors, tierOf,
  type GridPercentile, type TransitAccessClassification, type TransitAccessTier, type TierSettings,
} from "../../data/transitAccessTypes";
import { nStepsFor, viridisAt } from "../../data/transitReachTypes";
import { TRANSIT_ACCESS_DIVERGE, TRANSIT_ACCESS_PLAYBACK_TOL } from "../../hooks/useTransitAccessPlaybackLayer";
import { transitAccessGridControls, transitAccessPlaybackControls, useTransitAccessClassification } from "../../layers/hosts/transitAccessHosts";
import { useLayerParams } from "../../layers/layerParamsAccess";
import { paramText } from "../../i18n/paramText";
import { useLocale } from "../../state/localeStore";
import { formatPopulation } from "../featureInfo/transitReachPanels";

function useBundleError(): string | null {
  const status = useSyncExternalStore(subscribeSimBundleStatus, () => simBundleStatus(TRANSIT_ACCESS_SLUG));
  const { t } = useLocale();
  // 錯誤代碼文字沿用全台交通可及性那組（同一個公開模擬資料家族）
  return status.status === "error" ? t(`legend.transitReach.error.${status.code satisfies SimBundleErrorCode}` as "legend.transitReach.error.http") : null;
}

/** 分階列（由高到低）：labels[k] 對應 colors[k] */
function ClassRows({ colors, labels, opacity }: { colors: readonly string[]; labels: readonly string[]; opacity?: number }) {
  return <>{colors.map((c, k) => ({ c, l: labels[k]! })).reverse().map(({ c, l }) => <LegendRow key={c + l} swatch={<SwatchSquare color={c} opacity={opacity} />}>{l}</LegendRow>)}</>;
}

/** 界 → 區間文字：[<b0, b0–b1, …, ≥bn] */
function rangeLabels(breaks: readonly number[], unit: string, integer = true): string[] {
  const out: string[] = [];
  for (let k = 0; k <= breaks.length; k++) {
    const lo = breaks[k - 1], hi = breaks[k];
    if (k === 0) out.push(`< ${hi}${unit}`);
    else if (hi === undefined) out.push(`≥ ${lo}${unit}`);
    else out.push(integer && hi - lo! === 1 ? `${lo}${unit}` : `${lo}–${integer ? hi - 1 : hi}${unit}`);
  }
  return out;
}

/** 三級人口（目前類別、分位數、門檻） */
function tierPopulation(state: TransitAccessGridState, groupIdx: number, pctIdx: number, s: TierSettings, cls: TransitAccessClassification, which: "main" | "sched") {
  const data = which === "main" ? state.main : state.sched;
  const out: Record<TransitAccessTier, number> = { ok: 0, edge: 0, dep: 0 };
  if (!data) return out;
  const { cells, meta, car } = state.base;
  const n = cells.h3.length, P = meta.percentiles.length;
  for (let i = 0; i < n; i++) {
    const t = data.near[(groupIdx * P + pctIdx) * n + i]!;
    out[tierOf(t, car[groupIdx * n + i]!, s, cls)] += cells.pop[i] ?? 0;
  }
  return out;
}

export function TransitAccessGridLegend() {
  const i18n = useLocale();
  const { t } = i18n;
  const values = useLayerParams(TRANSIT_ACCESS_GRID_KEY);
  const cls = useTransitAccessClassification();
  const c = transitAccessGridControls(values, cls);
  const state = useSyncExternalStore(subscribeTransitAccessGrid, transitAccessGridState);
  const notice = useSyncExternalStore(subscribeTransitAccessGridNotice, transitAccessGridNotice);
  const error = useBundleError();
  const cmp = c.network === "cmp";
  const metric = cmp && !COMPARE_METRICS.includes(c.metric) ? "near" : c.metric;
  const min = t("legend.transitAccess.min");
  const pctLabel = paramText(GRID_PERCENTILE_LABELS[String(c.pct) as GridPercentile] ?? `P${c.pct}`, i18n);

  const groupIdx = state ? state.base.meta.groups.indexOf(c.group) : -1;
  const pctIdx = state ? state.base.meta.percentiles.indexOf(c.pct) : -1;
  const s = c.tier;
  const tiers = useMemo(() => (metric === "tier" && state && groupIdx >= 0 && pctIdx >= 0
    ? { main: tierPopulation(state, groupIdx, pctIdx, s, cls, "main"), sched: state.sched ? tierPopulation(state, groupIdx, pctIdx, s, cls, "sched") : null }
    : null), [metric, state, groupIdx, pctIdx, s.a, s.b, s.r, s.overhead, s.peak, cls]);
  const totalPop = state ? state.base.cells.pop.reduce((a, b) => a + b, 0) : 0;
  const share = (x: number) => (totalPop > 0 ? `${((x / totalPop) * 100).toFixed(1)}%` : "—");
  const tierName = (k: TransitAccessTier) => t(TIER_LABEL_KEYS[k]);
  const schedV1 = state?.base.bundle.manifest.caliber && (state.base.bundle.manifest.caliber as Record<string, unknown>).scheduled_version === "v1";

  let body: React.ReactNode = null;
  if (cmp && metric === "tier") {
    body = <>
      <ClassRows colors={[PUOR_NEG[0], PUOR_NEG[1], TRANSIT_ACCESS_UNREACHED_COLOR, PUOR_POS[1], PUOR_POS[2]]}
        labels={[t("legend.transitAccess.cmpTierBetter2"), t("legend.transitAccess.cmpTierBetter1"), t("legend.transitAccess.cmpSame"), t("legend.transitAccess.cmpTierWorse1"), t("legend.transitAccess.cmpTierWorse2")]} />
      {tiers?.sched && <LegendNote>{t("legend.transitAccess.cmpTierDep", { sched: formatPopulation(tiers.sched.dep, i18n), gps: formatPopulation(tiers.main.dep, i18n) })}</LegendNote>}
    </>;
  } else if (cmp) {
    const tol = cls.compareTol;
    body = <>
      <ClassRows colors={[PUOR_NEG[0], PUOR_NEG[1], PUOR_NEG[2], TRANSIT_ACCESS_UNREACHED_COLOR, PUOR_POS[0], PUOR_POS[1], PUOR_POS[2]]}
        labels={[`≤ −20${min}`, `−19 – −10${min}`, `−9 – −${tol + 1}${min}`, t("legend.transitAccess.cmpWithin", { tol }), `+${tol + 1} – +9${min}`, `+10 – +19${min}`, `≥ +20${min}`]} />
      <LegendNote>{t("legend.transitAccess.cmpDirection")}</LegendNote>
      {metric === "spread"
        ? <LegendRow swatch={<SwatchSquare color={TRANSIT_ACCESS_UNREACHED_COLOR} />}>{t("legend.transitAccess.cmpSpreadMissing")}</LegendRow>
        : <LegendNote>{t("legend.transitAccess.cmpOnlyOne")}</LegendNote>}
    </>;
  } else if (metric === "count") {
    body = <ClassRows colors={countColors(cls.countBreaks.length + 1)} labels={["0", ...rangeLabels(cls.countBreaks, "").slice(1)]} />;
  } else if (metric === "spread") {
    body = <>
      <ClassRows colors={spreadColors(cls.spreadBreaks.length + 1)} labels={rangeLabels(cls.spreadBreaks, min)} />
      <LegendNote>{t("legend.transitAccess.spreadNote")}</LegendNote>
    </>;
  } else if (metric === "ratio") {
    body = <>
      <ClassRows colors={PUOR} labels={rangeLabels(cls.ratioBreaks, "", false)} />
      <LegendNote>{t("legend.transitAccess.ratioDirection")}</LegendNote>
    </>;
  } else if (metric === "tier") {
    body = <>
      {TIERS.map((k) => <LegendRow key={k} swatch={<SwatchSquare color={TIER_COLORS[k]} />}>
        {tiers ? t("legend.transitAccess.tierRow", { name: tierName(k), pop: formatPopulation(tiers.main[k], i18n), share: share(tiers.main[k]) }) : tierName(k)}
      </LegendRow>)}
      <LegendNote>{t("legend.transitAccess.tierRule", { pct: pctLabel, a: s.a, b: s.b, r: s.r })}</LegendNote>
      <LegendNote>{t(s.peak ? "legend.transitAccess.carPeak" : "legend.transitAccess.carFree", { ovh: s.overhead, f: cls.peakFactor })}</LegendNote>
      <LegendNote>{t("legend.transitAccess.tierAssumption")}</LegendNote>
    </>;
  } else if (metric === "night") {
    body = <>
      <ClassRows colors={NIGHT_COLORS} labels={NIGHT_BUCKET_LABELS} />
      <LegendNote>{t("legend.transitAccess.nightNote", { T: c.nightT })}</LegendNote>
    </>;
  } else {
    body = <ClassRows colors={nearColors(cls.nearBreaks.length + 1)} labels={rangeLabels(cls.nearBreaks, min)} />;
  }

  const unreachedRow = !(cmp && metric !== "spread") && metric !== "count" && metric !== "night" && metric !== "tier";
  return <div>
    <LegendTitle zh={paramText(TRANSIT_ACCESS_METRIC_LABELS[metric], i18n)} en="Transit Access" />
    <LegendRow swatch={null}>{[
      paramText(TRANSIT_ACCESS_GROUP_LABELS[c.group], i18n), paramText(TRANSIT_ACCESS_SLOT_LABELS[c.slot], i18n), paramText(TRANSIT_ACCESS_NETWORK_LABELS[c.network], i18n),
      ...(metric === "near" || metric === "ratio" || metric === "tier" || (cmp && metric !== "spread") ? [pctLabel] : []),
      ...(metric === "count" && !cmp ? [t("legend.transitAccess.withinMin", { m: c.countTh })] : []),
    ].join("・")}</LegendRow>
    {error && <LegendRow swatch={<SwatchHatch />}>{error}</LegendRow>}
    {notice && <LegendRow swatch={<SwatchHatch />}>{t("legend.transitAccess.noSlot")}</LegendRow>}
    {!state && !error && !notice && <LegendNote>{t("legend.transitAccess.loading")}</LegendNote>}
    {cmp && !COMPARE_METRICS.includes(c.metric) && <LegendNote>{t("legend.transitAccess.cmpFallback")}</LegendNote>}
    <div style={{ marginTop: 4 }}>
      {body}
      {unreachedRow && <LegendRow swatch={<SwatchSquare color={TRANSIT_ACCESS_UNREACHED_COLOR} opacity={0.35} />}>{t("legend.transitAccess.unreached120")}</LegendRow>}
    </div>
    {schedV1 && <LegendNote>{t("legend.transitAccess.schedV1")}</LegendNote>}
    <LegendNote>{t("legend.transitAccess.gridCaliber")}</LegendNote>
  </div>;
}

export function TransitAccessPlaybackLegend() {
  const i18n = useLocale();
  const { t } = i18n;
  const values = useLayerParams(TRANSIT_ACCESS_PLAYBACK_KEY);
  const c = transitAccessPlaybackControls(values);
  const playback = useSyncExternalStore(subscribeTransitAccessPlayback, transitAccessPlaybackState);
  const error = useBundleError();
  const hours = playback?.rangeHours ?? 4;
  const n = nStepsFor(hours);
  const steps = Array.from({ length: n }, (_, k) => viridisAt(n > 1 ? k / (n - 1) : 0));
  const min = t("legend.transitAccess.min");
  const tol = TRANSIT_ACCESS_PLAYBACK_TOL;
  return <div>
    <LegendTitle zh={t("legend.transitAccess.playbackTitle")} en="Transit Access" />
    <LegendRow swatch={null}>{[
      paramText(TRANSIT_ACCESS_SLOT_LABELS[c.slot], i18n), paramText(TRANSIT_ACCESS_NETWORK_LABELS[c.network], i18n),
      paramText(GRID_PERCENTILE_LABELS[c.pct], i18n),
    ].join("・")}</LegendRow>
    {error && <LegendRow swatch={<SwatchHatch />}>{error}</LegendRow>}
    {!playback && !error && <LegendNote>{t("legend.transitAccess.loading")}</LegendNote>}
    <div style={{ marginTop: 4 }}>
      {c.network === "cmp" ? <>
        <ClassRows colors={TRANSIT_ACCESS_DIVERGE}
          labels={[`≤ −20${min}`, `−19 – −10${min}`, `−9 – −${tol + 1}${min}`, t("legend.transitAccess.cmpWithin", { tol }), `+${tol + 1} – +9${min}`, `+10 – +19${min}`, `≥ +20${min}`]} />
        <LegendNote>{t("legend.transitAccess.cmpDirection")}</LegendNote>
        <LegendNote>{t("legend.transitAccess.cmpOnlyOne")}</LegendNote>
      </> : <>
        <SwatchSteps colors={steps} breaks={["0", t("legend.transitReach.hours", { h: hours })]} />
        <LegendNote>{t("legend.transitAccess.steps", { h: hours })}</LegendNote>
      </>}
      <LegendRow swatch={<SwatchDot color="#ef4444" stroke="#ffffff" />}>{t("legend.transitAccess.origin")}</LegendRow>
    </div>
    {!!playback?.base.bundle.manifest.caliber && (playback.base.bundle.manifest.caliber as Record<string, unknown>).scheduled_version === "v1" && <LegendNote>{t("legend.transitAccess.schedV1")}</LegendNote>}
    <LegendNote>{t("legend.transitAccess.playbackCaliber")}</LegendNote>
  </div>;
}

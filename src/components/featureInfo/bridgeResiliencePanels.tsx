import { useEffect, useMemo } from "react";
import { FONT_DATA, FONT_SIZE, FONT_WEIGHT, RADIUS } from "../../styles/designTokens";
import {
  BRIDGE_JOINT_KEY, BRIDGE_MODES, BRIDGE_MODE_LABELS, BRIDGE_WEIGHTINGS, BRIDGE_WEIGHTING_LABELS, BRIDGE_RESILIENCE_KEY, BRIDGE_RESILIENCE_LIMITS_TEXT,
  BRIDGE_RESILIENCE_COLORS, BRIDGE_RESILIENCE_UNVALIDATED_TEXT, FINGERPRINT_DIMENSIONS, FINGERPRINT_LABELS, bridgeModeStatus, decodeDestinationView,
  effectiveScenarioUid, geometryConfidenceText, isJointMember, isUnvalidated,
  scenarioKey, secondsToMinutes, sharePermilleText,
  type BridgeAltCandidate, type BridgeFingerprint, type BridgeMode, type BridgeModeStatus, type BridgeSummaryEntry, type BridgeWeighting, type DecayModeSummary,
  type DecaySummary, type DestinationView, type FingerprintBridgeEntry, type FingerprintDimension,
} from "../../data/bridgeResilienceTypes";
import {
  bridgeResilienceOrigin, bridgeResilienceSelection, useBridgeResilienceData, useBridgeResilienceDestinations,
  useBridgeResilienceDestinationStatus, useBridgeResilienceOrigin,
} from "../../data/bridgeResilienceStore";
import { paramBool, paramStr } from "../../layers/layerParamsAccess";
import { layerParamsStore, useLayerParams } from "../../state/layerParamsStore";
import { localeStore, useLocale, type LocaleSnapshot } from "../../state/localeStore";
import { enumLabel } from "../../i18n/dataText";
import { PopupDetails, PopupScroll, Row, Title } from "./shared";
import { useFeatureTheme } from "./featureTheme";

const KEY = BRIDGE_RESILIENCE_KEY;
const TOP_N = 3;
const DEST_TOP_LIST = 5;
const setParam = (name: string, value: string | boolean) => layerParamsStore.setParam(KEY, name, value);

type I18n = LocaleSnapshot;
/** 匯出的純函式不收 hook；測試與非元件呼叫端不傳就用目前語系。 */
const currentI18n = (): I18n => localeStore.getSnapshot();

const modeLabel = (mode: BridgeMode, i18n: I18n) => enumLabel("bridgeResilienceMode", mode, BRIDGE_MODE_LABELS[mode], i18n);
const weightingLabel = (w: BridgeWeighting, i18n: I18n) => enumLabel("bridgeResilienceWeighting", w, BRIDGE_WEIGHTING_LABELS[w], i18n);
const dimLabel = (dim: FingerprintDimension, i18n: I18n) => enumLabel("bridgeResilienceDim", dim, FINGERPRINT_LABELS[dim], i18n);

/** 單位與缺值文字：缺值一律「未提供」，不當 0。數字依語系千分位。 */
function formatters(i18n: I18n) {
  const { t, formatNumber } = i18n;
  const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
  const notProvided = () => t("popup.common.notProvided");
  return {
    seconds: (v: unknown, digits = 1) => finite(v)
      ? t("popup.bridgeResilience.unitSeconds", { value: formatNumber(v, { minimumFractionDigits: digits, maximumFractionDigits: digits }) }) : notProvided(),
    minutes: (v: unknown, nullText?: string) => {
      const m = secondsToMinutes(v);
      return m === null ? (nullText ?? t("popup.bridgeResilience.noAffectedDest")) : t("popup.bridgeResilience.unitMinutes", { value: formatNumber(m, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) });
    },
    people: (v: unknown) => finite(v) ? t("popup.bridgeResilience.unitPeople", { value: formatNumber(Math.round(v)) }) : notProvided(),
    millionPersonSeconds: (v: unknown) => finite(v)
      ? t("popup.bridgeResilience.unitMillionPS", { value: formatNumber(v / 1e6, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) }) : notProvided(),
    lossPercent: (v: unknown) => finite(v) ? `${formatNumber(v * 100, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%` : notProvided(),
    rank: (v: number | null | undefined) => finite(v) ? t("popup.bridgeResilience.rankN", { n: v }) : t("popup.bridgeResilience.noRank"),
  };
}

/** 「名稱（占比%）」前 3 名；空陣列回「無」。占比是前 50 組受影響起訖對的權重占比，非流量預測。 */
export function altBridgesText(items: BridgeAltCandidate[] | undefined, n: number = TOP_N, i18n: I18n = currentI18n()): string {
  if (!items?.length) return i18n.t("popup.common.none");
  return items.slice(0, n).map((item) => i18n.t("popup.bridgeResilience.altItem", { label: item.label, pct: (item.weight_share * 100).toFixed(1) })).join(i18n.t("popup.common.listSeparator"));
}

function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: readonly { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="fi-seg" role="group" aria-label={label}>
      {options.map((option) => (
        <button key={option.value} type="button" aria-pressed={value === option.value} onClick={() => onChange(option.value)}>{option.label}</button>
      ))}
    </div>
  );
}
function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return <button type="button" className="fi-btn" aria-pressed={on} onClick={() => onChange(!on)}>{label}</button>;
}

/** 名次「第 N 名（不分遠近 第 M 名）」；聯合情境沒有名次（null）→「不列名次」。 */
export function decayRankText(m: DecayModeSummary, i18n: I18n = currentI18n()): string {
  const f = formatters(i18n);
  return m.decay_impact_rank === null || m.decay_impact_rank === undefined
    ? f.rank(null)
    : i18n.t("popup.bridgeResilience.rankWithUniform", { rank: f.rank(m.decay_impact_rank), uniform: f.rank(m.uniform_impact_rank) });
}
/** τ=10／20／30 的影響名次（敏感度）；缺值或聯合情境以「—」表示，不當 0。 */
export function decayTauRankText(m: DecayModeSummary): string {
  const r = (v: number | null | undefined) => (typeof v === "number" ? String(v) : "—");
  return `${r(m.rank_tau10)}／${r(m.decay_impact_rank)}／${r(m.rank_tau30)}`;
}
/** 影響最大的前 3 個村里：「里名（區）+秒・人口」。 */
export function decayTopVillagesText(m: DecayModeSummary | undefined, i18n: I18n = currentI18n()): string {
  if (!m?.top5_villages?.length) return i18n.t("popup.common.notProvided");
  const f = formatters(i18n);
  return m.top5_villages.slice(0, TOP_N).map((v) => i18n.t("popup.bridgeResilience.villageItem", {
    village: v.village, town: v.town, delta: v.decay_mean_dT_s === null ? "" : ` +${f.seconds(v.decay_mean_dT_s, 0)}`, pop: f.people(v.pop_hh),
  })).join(i18n.t("popup.common.semicolon"));
}

/** 距離遞減版橋層級指標：主畫面只列目前交通模式的 3 項；其餘放「說明與限制」。 */
export function DecayRows({ decay, mode }: { decay: DecaySummary["bridges"][string] | undefined; mode: BridgeMode }) {
  const t = useFeatureTheme();
  const i18n = useLocale();
  const { t: tr } = i18n;
  const f = formatters(i18n);
  const m = decay?.modes[mode];
  if (!m) return <div style={{ padding: "6px 0", color: t.textDim, fontSize: FONT_SIZE.sm }}>{tr("popup.bridgeResilience.noDecay", { mode: modeLabel(mode, i18n) })}</div>;
  return <>
    <Row label={tr("popup.bridgeResilience.perTrip")} value={f.seconds(m.decay_mean_dT_per_trip)} />
    <Row label={tr("popup.bridgeResilience.popGt60")} value={f.people(m.pop_gt60s)} />
    <Row label={tr("popup.bridgeResilience.impactRank")} value={decayRankText(m, i18n)} />
  </>;
}
/** 距離遞減版的補充列（收在「說明與限制」）。 */
export function DecayDetailRows({ decay, mode }: { decay: DecaySummary["bridges"][string] | undefined; mode: BridgeMode }) {
  const i18n = useLocale();
  const { t: tr } = i18n;
  const f = formatters(i18n);
  const m = decay?.modes[mode];
  if (!m) return null;
  return <>
    <Row label={tr("popup.bridgeResilience.impactTotal")} value={f.millionPersonSeconds(m.decay_impact)} />
    <Row label={tr("popup.bridgeResilience.popGt30")} value={f.people(m.pop_gt30s)} />
    <Row label={tr("popup.bridgeResilience.topVillages")} value={decayTopVillagesText(m, i18n)} />
    <Row label={tr("popup.bridgeResilience.tauSensitivity")} value={decayTauRankText(m)} />
    <Row label={tr("popup.bridgeResilience.weightNote")} value={tr("popup.bridgeResilience.weightNoteText")} />
  </>;
}

/** 百分位顯示值：四捨五入並夾在 0–100；非數字（null／缺）回 null，畫面寫「未提供」，不當 0。 */
export function fingerprintValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(100, Math.max(0, Math.round(value))) : null;
}

const FP_COLS = "56px 1fr 28px";

/**
 * 百分位缺值的說明：該模式路網未收此橋／沒有受影響起訖對（缺乏替代無從算）各有自己的話，其餘「未提供」；從不當 0。
 */
export function fingerprintNullText(status: BridgeModeStatus | null | undefined, dim: FingerprintDimension, mode: BridgeMode, i18n: I18n = currentI18n()): string {
  if (status === "not_in_mode_graph" && dim !== "barrier") return i18n.t("popup.bridgeResilience.modeNotInGraph", { mode: modeLabel(mode, i18n) });
  if (status === "no_affected_od" && dim === "lack_of_redundancy") return i18n.t("popup.bridgeResilience.noAffectedPairs");
  return i18n.t("popup.common.notProvided");
}

/**
 * 「為什麼重要」：四維 fingerprint（73 座單橋內百分位，越高越關鍵），只畫目前交通模式。
 * 不加總、不合成分數；聯合情境不參與排名；null 依狀態寫說明、不畫長條。
 */
export function FingerprintBlock({ fingerprint, uid, joint, mode, status }: {
  fingerprint: BridgeFingerprint | undefined; uid: string; joint: boolean; mode: BridgeMode; status?: BridgeModeStatus | null;
}) {
  const t = useFeatureTheme();
  const i18n = useLocale();
  const { t: tr } = i18n;
  const entry = fingerprint?.bridges[joint ? BRIDGE_JOINT_KEY : uid];
  const percentiles = entry?.modes[mode]?.percentiles;
  const note = (text: string) => <div style={{ color: t.textDim, fontSize: FONT_SIZE.sm, padding: "2px 0" }}>{text}</div>;
  return <div className="fi-fingerprint" style={{ borderTop: `1px solid ${t.borderSoft}`, marginTop: 4, paddingTop: 4 }}>
    <div style={{ color: t.textMuted, fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.semibold, padding: "2px 0" }}>{tr("popup.bridgeResilience.fpTitle")}</div>
    {!fingerprint ? note(tr("popup.common.loading"))
      : !entry ? note(tr("popup.common.notProvided"))
      : entry.is_joint ? note(tr("popup.bridgeResilience.jointNoRank"))
      : FINGERPRINT_DIMENSIONS.map((dim) => {
        const v = fingerprintValue(percentiles?.[dim]);
        return <div key={dim} style={{ display: "grid", gridTemplateColumns: FP_COLS, alignItems: "center", columnGap: 6, padding: "2px 0", fontSize: FONT_SIZE.sm }}>
          <span style={{ color: t.textMuted }}>{dimLabel(dim, i18n)}</span>
          {v === null
            ? <span style={{ gridColumn: "2 / 4", color: t.textDim }}>{fingerprintNullText(status, dim, mode, i18n)}</span>
            : <>
              <span role="img" aria-label={tr("popup.bridgeResilience.fpAria", { label: dimLabel(dim, i18n), value: v })} style={{ height: 6, borderRadius: RADIUS.pill, background: t.bgStrong, overflow: "hidden" }}>
                <span style={{ display: "block", height: "100%", width: `${v}%`, background: BRIDGE_RESILIENCE_COLORS[mode], borderRadius: RADIUS.pill }} />
              </span>
              <span style={{ color: t.textStrong, textAlign: "right", fontFamily: FONT_DATA, fontVariantNumeric: "tabular-nums" }}>{v}</span>
            </>}
        </div>;
      })}
  </div>;
}

const pctList = (values: Partial<Record<FingerprintDimension, number | null>> | undefined, i18n: I18n) =>
  FINGERPRINT_DIMENSIONS.map((dim) => `${dimLabel(dim, i18n)} ${fingerprintValue(values?.[dim]) ?? "—"}`).join(i18n.t("popup.bridgeResilience.dotSep"));

/** 原 26 座內百分位（只有原 26 座有值）；全部缺值回 null（不顯示該列）。 */
export function within26Text(entry: FingerprintBridgeEntry | undefined, mode: BridgeMode, i18n: I18n = currentI18n()): string | null {
  const values = entry?.modes[mode]?.percentiles_within_original_26;
  return values && FINGERPRINT_DIMENSIONS.some((dim) => fingerprintValue(values[dim]) !== null) ? pctList(values, i18n) : null;
}
/** 同河替代「不限距離」變體：缺乏替代百分位＋同河替代占比；沒有值回 null。 */
export function anyDistanceVariantText(entry: FingerprintBridgeEntry | undefined, mode: BridgeMode, i18n: I18n = currentI18n()): string | null {
  const v = entry?.modes[mode]?.substitute_rule_variant_any_distance;
  const pct = fingerprintValue(v?.lack_of_redundancy_any_pct);
  if (pct === null) return null;
  const share = v?.same_river_any_share_top50;
  return i18n.t("popup.bridgeResilience.anyDistance", {
    pct,
    base: fingerprintValue(entry?.modes[mode]?.percentiles.lack_of_redundancy) ?? "—",
    share: typeof share === "number" ? i18n.t("popup.bridgeResilience.anyDistanceShare", { pct: Math.round(share * 100) }) : "",
  });
}

/** 「四維怎麼算」：每維一句定義＋主要限制（收合）；有值時附原 26 座內百分位與不限距離變體。 */
export function FingerprintDetailRows({ entry, mode }: { entry?: FingerprintBridgeEntry; mode?: BridgeMode } = {}) {
  const i18n = useLocale();
  const { t: tr } = i18n;
  const w26 = mode && !entry?.is_joint ? within26Text(entry, mode, i18n) : null;
  const anyDist = mode && !entry?.is_joint ? anyDistanceVariantText(entry, mode, i18n) : null;
  return <>
    {w26 && <Row label={tr("popup.bridgeResilience.within26")} value={w26} />}
    {anyDist && <Row label={tr("popup.bridgeResilience.anyDistanceRow")} value={anyDist} />}
    <Row label={dimLabel("barrier", i18n)} value={tr("popup.bridgeResilience.fpBarrier")} />
    <Row label={dimLabel("network", i18n)} value={tr("popup.bridgeResilience.fpNetwork")} />
    <Row label={dimLabel("population", i18n)} value={tr("popup.bridgeResilience.fpPopulation")} />
    <Row label={dimLabel("lack_of_redundancy", i18n)} value={tr("popup.bridgeResilience.fpRedundancy")} />
    <Row field="caution" value={tr("popup.bridgeResilience.fpCautionGuandu")} />
    <Row field="caution" value={tr("popup.bridgeResilience.fpCautionXinbei")} />
    <Row label={tr("popup.bridgeResilience.variant")} value={tr("popup.bridgeResilience.fpVariant")} />
    <Row label={tr("popup.bridgeResilience.howToRead")} value={tr("popup.bridgeResilience.fpRead")} />
  </>;
}

const DEST_COLS = "minmax(48px, 1.1fr) 1fr 1fr 1fr";

/** 目的地視角：依行政區彙整表（依受影響人口比排序）＋前 5 名受影響村里。null／不可達各有自己的說明，不當 0。 */
export function DestinationSection({ view, status, originCode, modeLabel: modeText, uniformNote = false }: {
  view: DestinationView | null; status: "idle" | "loading" | "error"; originCode: string; modeLabel: string; uniformNote?: boolean;
}) {
  const t = useFeatureTheme();
  const i18n = useLocale();
  const { t: tr } = i18n;
  const f = formatters(i18n);
  const cell = { fontSize: FONT_SIZE.sm, padding: "2px 0" } as const;
  return <div className="fi-dest" style={{ borderTop: `1px solid ${t.border}`, marginTop: 6, paddingTop: 6 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "space-between" }}>
      <span style={{ fontSize: FONT_SIZE.base, fontWeight: FONT_WEIGHT.semibold, color: t.textStrong }}>
        {tr("popup.bridgeResilience.destTitle", { origin: view ? `${view.originName}（${view.originDistrictLabel}）` : tr("popup.bridgeResilience.destVillage", { code: originCode }) })}
      </span>
      <button type="button" className="fi-btn" onClick={() => bridgeResilienceOrigin.clear()}>{tr("popup.bridgeResilience.backToOrigin")}</button>
    </div>
    <div style={{ color: t.textDim, fontSize: FONT_SIZE.sm, padding: "3px 0" }}>
      {tr("popup.bridgeResilience.destIntro", { mode: modeText })}
    </div>
    {uniformNote && <div style={{ color: t.warn, fontSize: FONT_SIZE.sm, padding: "2px 0" }}>
      {tr("popup.bridgeResilience.destUniformNote")}
    </div>}
    {!view && status === "loading" && <div style={{ color: t.textDim, fontSize: FONT_SIZE.sm }}>{tr("popup.bridgeResilience.destLoading")}</div>}
    {!view && status === "error" && <div style={{ color: t.warn, fontSize: FONT_SIZE.sm }}>{tr("popup.bridgeResilience.destError")}</div>}
    {!view && status === "idle" && <div style={{ color: t.textDim, fontSize: FONT_SIZE.sm }}>{tr("popup.bridgeResilience.destIdle")}</div>}
    {view?.noAffected && <div style={{ color: t.textMuted, fontSize: FONT_SIZE.sm }}>
      {view.unreachable.length ? tr("popup.bridgeResilience.destNoSlowButUnreachable") : tr("popup.bridgeResilience.destNoAffected")}
    </div>}
    {view && view.districts.length > 0 && <div style={{ maxHeight: 180, overflowY: "auto" }}>
      <div style={{ display: "grid", gridTemplateColumns: DEST_COLS, columnGap: 6, color: t.textMuted, ...cell, borderBottom: `1px solid ${t.borderSoft}` }}>
        <span>{tr("popup.bridgeResilience.colDistrict")}</span><span>{tr("popup.bridgeResilience.colShare")}</span><span>{tr("popup.bridgeResilience.colMean")}</span><span>{tr("popup.bridgeResilience.colMax")}</span>
      </div>
      {view.districts.map((row) => <div key={row.district} style={{ display: "grid", gridTemplateColumns: DEST_COLS, columnGap: 6, color: t.textStrong, ...cell, borderBottom: `1px solid ${t.borderSoft}` }}>
        <span>{row.label}</span>
        <span title={tr("popup.bridgeResilience.unitPeople", { value: i18n.formatNumber(row.affectedPop) })}>{sharePermilleText(row.sharePermille)}</span>
        <span>{f.minutes(row.meanDtS)}</span>
        <span>{f.minutes(row.maxDtS)}</span>
      </div>)}
    </div>}
    {view && view.unreachable.length > 0 && <div style={{ padding: "4px 0" }}>
      {view.unreachable.map((row) => <div key={row.district} style={{ color: BRIDGE_RESILIENCE_COLORS.destUnreachable, fontSize: FONT_SIZE.sm }}>
        {tr("popup.bridgeResilience.unreachable", { label: row.label, villages: row.villages, pop: f.people(row.pop) })}
      </div>)}
    </div>}
    {view && view.top.length > 0 && <>
      <div style={{ color: t.textMuted, fontSize: FONT_SIZE.sm, padding: "4px 0 1px" }}>{tr("popup.bridgeResilience.topAffected", { n: Math.min(DEST_TOP_LIST, view.top.length) })}</div>
      {view.top.slice(0, DEST_TOP_LIST).map((row, i) => <Row key={row.code} label={`${i + 1}`} value={`${row.districtLabel}${row.name}　+${f.minutes(row.dtS)}・${f.people(row.pop)}`} />)}
    </>}
    {view && !view.noAffected && <div style={{ color: t.textDim, fontSize: FONT_SIZE.sm, paddingTop: 3 }}>
      {tr("popup.bridgeResilience.mapNote", { n: view.top.length })}
    </div>}
  </div>;
}

export function BridgeResiliencePanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const i18n = useLocale();
  const { t: tr } = i18n;
  const f = formatters(i18n);
  const data = useBridgeResilienceData();
  const values = useLayerParams(KEY);
  const uid = typeof props.bridge_uid === "string" ? props.bridge_uid : "";
  // 面板存在＝選取存在：hook 依此高亮、上村里色、畫替代路線；關閉面板即清除。
  useEffect(() => {
    if (!uid) return;
    bridgeResilienceSelection.select(uid);
    return () => bridgeResilienceSelection.clear();
  }, [uid]);

  const mode: BridgeMode = paramStr(values, KEY, "bridgeResilienceMode") === "scooter" ? "scooter" : "car";
  const weighting: BridgeWeighting = paramStr(values, KEY, "bridgeResilienceWeighting") === "uniform" ? "uniform" : "decay";
  const showVillages = paramBool(values, KEY, "bridgeResilienceShowVillages");
  const showRoutes = paramBool(values, KEY, "bridgeResilienceShowRoutes");
  const canJoint = isJointMember(uid);
  const joint = canJoint && paramBool(values, KEY, "bridgeResilienceJoint");
  const entry: BridgeSummaryEntry | undefined = data?.summary.bridges[joint ? BRIDGE_JOINT_KEY : uid];
  const modeSummary = entry?.modes[mode];
  const review = entry?.human_review;
  const river = entry?.river ?? (typeof props.river === "string" ? props.river : "");
  const title = joint ? tr("popup.bridgeResilience.jointTitle") : uid || tr("popup.bridgeResilience.bridgeFallback");
  const origin = useBridgeResilienceOrigin();
  const destinations = useBridgeResilienceDestinations();
  const destStatus = useBridgeResilienceDestinationStatus();
  const scenarioUid = effectiveScenarioUid(uid || null, joint);
  const view = useMemo(
    () => (origin && destinations && scenarioUid ? decodeDestinationView(destinations, scenarioKey(scenarioUid, mode), origin) : null),
    [origin, destinations, scenarioUid, mode],
  );
  const dayNight = modeSummary?.alt_population_weights;
  const ban = modeSummary?.sensitivity_scooter_expressway_ban;

  const decay = data?.decaySummary.bridges[joint ? BRIDGE_JOINT_KEY : uid];
  const sameRiver = modeSummary?.replacement_bridges?.same_river_within_5km;
  const otherOnRoute = modeSummary?.replacement_bridges?.other_bridges_on_route;
  const stranded = modeSummary?.stranded_population;
  const grade = entry ? (review?.geometry_confidence ? geometryConfidenceText(review.geometry_confidence) : tr("popup.common.notProvided")) : "";
  const status = bridgeModeStatus(modeSummary, decay?.modes[mode]);
  const statusText = status && status !== "ok"
    ? (status === "not_in_mode_graph" ? tr("popup.bridgeResilience.modeNotInGraph", { mode: modeLabel(mode, i18n) }) : tr("popup.bridgeResilience.modelNoAffected"))
    : null;
  const unvalidated = !joint && isUnvalidated(entry);
  const fpEntry = data?.fingerprint.bridges[joint ? BRIDGE_JOINT_KEY : uid];
  const modeText = modeLabel(mode, i18n);

  return <>
    <Title color={BRIDGE_RESILIENCE_COLORS[mode]}>{title}</Title>
    {unvalidated && <div className="fi-badge" style={{ display: "inline-block", margin: "2px 0", padding: "1px 6px", borderRadius: RADIUS.pill, border: `1px dashed ${t.warn}`, color: t.warn, fontSize: FONT_SIZE.sm }}>
      {tr("popup.bridgeResilience.unvalidatedBadge", { text: enumLabel("bridgeResilienceMisc", "unvalidated", BRIDGE_RESILIENCE_UNVALIDATED_TEXT, i18n) })}
    </div>}
    <Row label={tr("popup.bridgeResilience.riverGrade")} value={grade ? `${river}・${grade}` : river} />
    <div className="fi-actions">
      <Segmented label={tr("popup.bridgeResilience.weighting")} value={weighting} options={BRIDGE_WEIGHTINGS.map((w) => ({ value: w, label: weightingLabel(w, i18n) }))} onChange={(v) => setParam("bridgeResilienceWeighting", v)} />
      <Segmented label={tr("popup.bridgeResilience.transportMode")} value={mode} options={BRIDGE_MODES.map((m) => ({ value: m, label: modeLabel(m, i18n) }))} onChange={(v) => setParam("bridgeResilienceMode", v)} />
      <Toggle label={tr("popup.bridgeResilience.showVillages")} on={showVillages} onChange={(v) => setParam("bridgeResilienceShowVillages", v)} />
      <Toggle label={tr("popup.bridgeResilience.showRoutes")} on={showRoutes} onChange={(v) => setParam("bridgeResilienceShowRoutes", v)} />
      {canJoint && <Toggle label={tr("popup.bridgeResilience.jointToggle")} on={joint} onChange={(v) => setParam("bridgeResilienceJoint", v)} />}
    </div>
    {showVillages && !origin && <div style={{ color: t.textDim, fontSize: FONT_SIZE.sm, padding: "2px 0" }}>{tr("popup.bridgeResilience.clickVillage")}</div>}
    {/* 內容區有高度上限、可捲動；展開「說明與限制」後也在這裡捲動，不撐高整個 popup。 */}
    <PopupScroll>
      {showVillages && origin && <DestinationSection view={view} status={destStatus} originCode={origin} modeLabel={modeText} uniformNote={weighting === "decay"} />}
      {!entry && <div style={{ padding: "6px 0", color: t.textDim, fontSize: FONT_SIZE.sm }}>{data ? tr("popup.bridgeResilience.noMetrics") : tr("popup.bridgeResilience.metricsLoading")}</div>}
      {entry && statusText && <Row label={tr("popup.bridgeResilience.simResult")} value={statusText} />}
      {entry && !statusText && weighting === "decay" && <DecayRows decay={decay} mode={mode} />}
      {entry && !statusText && !modeSummary && <Row label={tr("popup.bridgeResilience.simResult")} value={tr("popup.bridgeResilience.modeNotProvided", { mode: modeText })} />}
      {entry && !statusText && weighting === "uniform" && modeSummary && <>
        <Row label={tr("popup.bridgeResilience.p90")} value={f.minutes(modeSummary.p90_dT_s)} />
        <Row label={tr("popup.bridgeResilience.accessLoss")} value={f.lossPercent(modeSummary.accessibility_loss)} />
        <Row label={tr("popup.bridgeResilience.exposedPop")} value={f.people(modeSummary.exposed_population_gt60s)} />
        {typeof stranded === "number" && <Row label={tr("popup.bridgeResilience.strandedPop")} value={f.people(stranded)} />}
      </>}
      {entry && !statusText && modeSummary && <Row label={tr("popup.bridgeResilience.altBridge")} value={sameRiver?.length ? altBridgesText(sameRiver, 2, i18n) : tr("popup.bridgeResilience.onRoute", { list: altBridgesText(otherOnRoute, 2, i18n) })} />}
      <FingerprintBlock fingerprint={data?.fingerprint} uid={uid} joint={joint} mode={mode} status={status} />
      <PopupDetails summary={tr("popup.bridgeResilience.fpDetailSummary")}><FingerprintDetailRows entry={fpEntry} mode={mode} /></PopupDetails>
      <PopupDetails summary={tr("popup.common.notesAndLimits")}>
        <Row label={tr("popup.bridgeResilience.researchStatus")} value={tr("popup.bridgeResilience.researchStatusText")} />
        <Row label={tr("popup.bridgeResilience.bridgeScope")} value={tr("popup.bridgeResilience.bridgeScopeText")} />
        {entry && <Row label={tr("popup.bridgeResilience.reviewDate")} value={review?.latest_review_date ?? ""} mono />}
        {weighting === "decay" && !statusText && <DecayDetailRows decay={decay} mode={mode} />}
        {weighting === "uniform" && modeSummary && !statusText && <Row label={tr("popup.bridgeResilience.meanExtra")} value={f.minutes(modeSummary.mean_dT_s, tr("popup.common.notProvided"))} />}
        {entry && !statusText && <Row label={tr("popup.bridgeResilience.altSameRiver", { mode: modeText })} value={altBridgesText(sameRiver, TOP_N, i18n)} />}
        {entry && !statusText && <Row label={tr("popup.bridgeResilience.altOnRouteLabel", { mode: modeText })} value={altBridgesText(otherOnRoute, TOP_N, i18n)} />}
        {!statusText && modeSummary?.replacement_bridges?.basis && <Row label={tr("popup.bridgeResilience.altBasis")} value={modeSummary.replacement_bridges.basis} />}
        {weighting === "uniform" && !statusText && dayNight?.day && <Row label={tr("popup.bridgeResilience.sensDay")} value={tr("popup.bridgeResilience.p90Loss", { p90: f.minutes(dayNight.day.p90_dT_s), loss: f.lossPercent(dayNight.day.accessibility_loss) })} />}
        {weighting === "uniform" && !statusText && dayNight?.night && <Row label={tr("popup.bridgeResilience.sensNight")} value={tr("popup.bridgeResilience.p90Loss", { p90: f.minutes(dayNight.night.p90_dT_s), loss: f.lossPercent(dayNight.night.accessibility_loss) })} />}
        {weighting === "uniform" && !statusText && mode === "scooter" && ban && <Row label={tr("popup.bridgeResilience.sensBan")} value={tr("popup.bridgeResilience.p90LossBan", { p90: f.minutes(ban.p90_dT_s), loss: f.lossPercent(ban.accessibility_loss) })} />}
        {entry && !statusText && <Row label={tr("popup.bridgeResilience.altRoute")} value={tr("popup.bridgeResilience.altRouteText")} />}
        {review?.notes?.map((note) => <Row key={note} label={tr("popup.bridgeResilience.reviewNote")} value={note} />)}
        {BRIDGE_RESILIENCE_LIMITS_TEXT.map((text, i) => <Row key={text} {...(i === 0 ? { field: "limits" as const } : { label: "" })} value={enumLabel("bridgeResilienceLimit", i, text, i18n)} />)}
      </PopupDetails>
    </PopupScroll>
  </>;
}

import { useEffect, useMemo } from "react";
import { FONT_SIZE, FONT_WEIGHT } from "../../styles/designTokens";
import {
  BRIDGE_JOINT_KEY, BRIDGE_MODES, BRIDGE_MODE_LABELS, BRIDGE_WEIGHTINGS, BRIDGE_WEIGHTING_LABELS, BRIDGE_RESILIENCE_KEY, BRIDGE_RESILIENCE_LIMITS_TEXT,
  BRIDGE_RESILIENCE_COLORS, decodeDestinationView, effectiveScenarioUid, geometryConfidenceText, isJointMember, lossPercentText,
  millionPersonSecondsText, minutesText, populationText, rankText, scenarioKey, secondsText, sharePermilleText,
  type BridgeAltCandidate, type BridgeMode, type BridgeSummaryEntry, type BridgeWeighting, type DecayModeSummary,
  type DecaySummary, type DestinationView,
} from "../../data/bridgeResilienceTypes";
import {
  bridgeResilienceOrigin, bridgeResilienceSelection, useBridgeResilienceData, useBridgeResilienceDestinations,
  useBridgeResilienceDestinationStatus, useBridgeResilienceOrigin,
} from "../../data/bridgeResilienceStore";
import { paramBool, paramStr } from "../../layers/layerParamsAccess";
import { layerParamsStore, useLayerParams } from "../../state/layerParamsStore";
import { PopupDetails, PopupScroll, Row, Title } from "./shared";
import { useFeatureTheme } from "./featureTheme";

const KEY = BRIDGE_RESILIENCE_KEY;
const TOP_N = 3;
const DEST_TOP_LIST = 5;
const setParam = (name: string, value: string | boolean) => layerParamsStore.setParam(KEY, name, value);

/** 「名稱（占比%）」前 3 名；空陣列回「無」。占比是前 50 組受影響起訖對的權重占比，非流量預測。 */
export function altBridgesText(items: BridgeAltCandidate[] | undefined, n: number = TOP_N): string {
  if (!items?.length) return "無";
  return items.slice(0, n).map((item) => `${item.label}（${(item.weight_share * 100).toFixed(1)}%）`).join("、");
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
export function decayRankText(m: DecayModeSummary): string {
  return m.decay_impact_rank === null || m.decay_impact_rank === undefined
    ? rankText(null)
    : `${rankText(m.decay_impact_rank)}（不分遠近 ${rankText(m.uniform_impact_rank)}）`;
}
/** τ=10／20／30 的影響名次（敏感度）；缺值或聯合情境以「—」表示，不當 0。 */
export function decayTauRankText(m: DecayModeSummary): string {
  const r = (v: number | null | undefined) => (typeof v === "number" ? String(v) : "—");
  return `${r(m.rank_tau10)}／${r(m.decay_impact_rank)}／${r(m.rank_tau30)}`;
}
/** 影響最大的前 3 個村里：「里名（區）+秒・人口」。 */
export function decayTopVillagesText(m: DecayModeSummary | undefined): string {
  if (!m?.top5_villages?.length) return "未提供";
  return m.top5_villages.slice(0, TOP_N).map((v) => `${v.village}（${v.town}）${v.decay_mean_dT_s === null ? "" : ` +${secondsText(v.decay_mean_dT_s, 0)}`}・${populationText(v.pop_hh)}`).join("；");
}

/** 距離遞減版橋層級指標：主畫面只列目前交通模式的 3 項；其餘放「說明與限制」。 */
export function DecayRows({ decay, mode }: { decay: DecaySummary["bridges"][string] | undefined; mode: BridgeMode }) {
  const t = useFeatureTheme();
  const m = decay?.modes[mode];
  if (!m) return <div style={{ padding: "6px 0", color: t.textDim, fontSize: FONT_SIZE.sm }}>此橋沒有距離遞減版指標（{BRIDGE_MODE_LABELS[mode]}）；可把「權重」切到「不分遠近」。</div>;
  return <>
    <Row label="每人每次多花" value={secondsText(m.decay_mean_dT_per_trip)} />
    <Row label="多花 >1 分鐘的人口" value={populationText(m.pop_gt60s)} />
    <Row label="影響排名" value={decayRankText(m)} />
  </>;
}
/** 距離遞減版的補充列（收在「說明與限制」）。 */
export function DecayDetailRows({ decay, mode }: { decay: DecaySummary["bridges"][string] | undefined; mode: BridgeMode }) {
  const m = decay?.modes[mode];
  if (!m) return null;
  return <>
    <Row label="影響總量" value={millionPersonSecondsText(m.decay_impact)} />
    <Row label="多花 >30 秒的人口" value={populationText(m.pop_gt30s)} />
    <Row label="影響最大的 3 個村里" value={decayTopVillagesText(m)} />
    <Row label="排名敏感度（τ 10／20／30 分）" value={decayTauRankText(m)} />
    <Row label="權重說明" value="距離遞減：目的地權重＝人口×exp(−基準行車時間／20 分)，τ=20 分鐘是假設值；影響＝村里人口×平均多花秒數加總；排名在同一交通模式的單橋之間" />
  </>;
}

const DEST_COLS = "minmax(48px, 1.1fr) 1fr 1fr 1fr";

/** 目的地視角：依行政區彙整表（依受影響人口比排序）＋前 5 名受影響村里。null／不可達各有自己的說明，不當 0。 */
export function DestinationSection({ view, status, originCode, modeLabel, uniformNote = false }: {
  view: DestinationView | null; status: "idle" | "loading" | "error"; originCode: string; modeLabel: string; uniformNote?: boolean;
}) {
  const t = useFeatureTheme();
  const cell = { fontSize: FONT_SIZE.sm, padding: "2px 0" } as const;
  return <div className="fi-dest" style={{ borderTop: `1px solid ${t.border}`, marginTop: 6, paddingTop: 6 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "space-between" }}>
      <span style={{ fontSize: FONT_SIZE.base, fontWeight: FONT_WEIGHT.semibold, color: t.textStrong }}>
        目的地視角：{view ? `${view.originName}（${view.originDistrictLabel}）` : `村里 ${originCode}`}
      </span>
      <button type="button" className="fi-btn" onClick={() => bridgeResilienceOrigin.clear()}>回到起點視角</button>
    </div>
    <div style={{ color: t.textDim, fontSize: FONT_SIZE.sm, padding: "3px 0" }}>
      從這個村里出發（{modeLabel}），橋中斷時去哪些行政區變慢。受影響＝額外時間超過 60 秒；平均與最多只算受影響的目的地。
    </div>
    {uniformNote && <div style={{ color: t.warn, fontSize: FONT_SIZE.sm, padding: "2px 0" }}>
      目的地明細是不分遠近版（沒有距離遞減版資料），口徑與目前的距離遞減村里色階不同；要一致口徑，請把「權重」切回「不分遠近」。
    </div>}
    {!view && status === "loading" && <div style={{ color: t.textDim, fontSize: FONT_SIZE.sm }}>目的地資料載入中…</div>}
    {!view && status === "error" && <div style={{ color: t.warn, fontSize: FONT_SIZE.sm }}>目的地資料載入失敗，請稍後再點一次村里。</div>}
    {!view && status === "idle" && <div style={{ color: t.textDim, fontSize: FONT_SIZE.sm }}>此情境沒有這個村里的目的地資料。</div>}
    {view?.noAffected && <div style={{ color: t.textMuted, fontSize: FONT_SIZE.sm }}>
      {view.unreachable.length ? "沒有「變慢」的目的地，但有無法抵達的目的地（見下）。" : "這個村里去其他村里都沒有受影響（額外時間未超過 60 秒）；這不是「0 分鐘」的量測，而是低於門檻。"}
    </div>}
    {view && view.districts.length > 0 && <div style={{ maxHeight: 180, overflowY: "auto" }}>
      <div style={{ display: "grid", gridTemplateColumns: DEST_COLS, columnGap: 6, color: t.textMuted, ...cell, borderBottom: `1px solid ${t.borderSoft}` }}>
        <span>目的地行政區</span><span>受影響人口比</span><span>平均多花</span><span>最多</span>
      </div>
      {view.districts.map((row) => <div key={row.district} style={{ display: "grid", gridTemplateColumns: DEST_COLS, columnGap: 6, color: t.textStrong, ...cell, borderBottom: `1px solid ${t.borderSoft}` }}>
        <span>{row.label}</span>
        <span title={`${row.affectedPop.toLocaleString("zh-TW")} 人`}>{sharePermilleText(row.sharePermille)}</span>
        <span>{minutesText(row.meanDtS)}</span>
        <span>{minutesText(row.maxDtS)}</span>
      </div>)}
    </div>}
    {view && view.unreachable.length > 0 && <div style={{ padding: "4px 0" }}>
      {view.unreachable.map((row) => <div key={row.district} style={{ color: BRIDGE_RESILIENCE_COLORS.destUnreachable, fontSize: FONT_SIZE.sm }}>
        無法抵達：{row.label} {row.villages} 個村里、{populationText(row.pop)}（不計入額外時間）
      </div>)}
    </div>}
    {view && view.top.length > 0 && <>
      <div style={{ color: t.textMuted, fontSize: FONT_SIZE.sm, padding: "4px 0 1px" }}>受影響最多的 {Math.min(DEST_TOP_LIST, view.top.length)} 個村里</div>
      {view.top.slice(0, DEST_TOP_LIST).map((row, i) => <Row key={row.code} label={`${i + 1}`} value={`${row.districtLabel}${row.name}　+${minutesText(row.dtS)}・${populationText(row.pop)}`} />)}
    </>}
    {view && !view.noAffected && <div style={{ color: t.textDim, fontSize: FONT_SIZE.sm, paddingTop: 3 }}>
      地圖顏色是目的地所在行政區的平均額外時間（同區同色，資料沒有逐村里的值）；藍色外框是前 {view.top.length} 名受影響村里，白色粗框是起點。
    </div>}
  </div>;
}

export function BridgeResiliencePanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
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
  const title = joint ? "關渡大橋＋淡江大橋（同時中斷）" : uid || "橋梁";
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
  const grade = entry ? geometryConfidenceText(review?.geometry_confidence) : "";

  return <>
    <Title color={BRIDGE_RESILIENCE_COLORS[mode]}>{title}</Title>
    <Row label="河川・評級" value={grade ? `${river}・${grade}` : river} />
    <div className="fi-actions">
      <Segmented label="權重" value={weighting} options={BRIDGE_WEIGHTINGS.map((w) => ({ value: w, label: BRIDGE_WEIGHTING_LABELS[w] }))} onChange={(v) => setParam("bridgeResilienceWeighting", v)} />
      <Segmented label="交通模式" value={mode} options={BRIDGE_MODES.map((m) => ({ value: m, label: BRIDGE_MODE_LABELS[m] }))} onChange={(v) => setParam("bridgeResilienceMode", v)} />
      <Toggle label="顯示受影響村里" on={showVillages} onChange={(v) => setParam("bridgeResilienceShowVillages", v)} />
      <Toggle label="顯示替代路線" on={showRoutes} onChange={(v) => setParam("bridgeResilienceShowRoutes", v)} />
      {canJoint && <Toggle label="與另一座同時中斷" on={joint} onChange={(v) => setParam("bridgeResilienceJoint", v)} />}
    </div>
    {showVillages && !origin && <div style={{ color: t.textDim, fontSize: FONT_SIZE.sm, padding: "2px 0" }}>點地圖上的村里，可看它去哪些地方變慢。</div>}
    {/* 內容區有高度上限、可捲動；展開「說明與限制」後也在這裡捲動，不撐高整個 popup。 */}
    <PopupScroll>
      {showVillages && origin && <DestinationSection view={view} status={destStatus} originCode={origin} modeLabel={BRIDGE_MODE_LABELS[mode]} uniformNote={weighting === "decay"} />}
      {!entry && <div style={{ padding: "6px 0", color: t.textDim, fontSize: FONT_SIZE.sm }}>{data ? "此橋沒有模擬指標。" : "指標載入中…"}</div>}
      {entry && weighting === "decay" && <DecayRows decay={decay} mode={mode} />}
      {entry && weighting === "uniform" && modeSummary && <>
        <Row label="額外時間 p90" value={minutesText(modeSummary.p90_dT_s)} />
        <Row label="可及性損失" value={lossPercentText(modeSummary.accessibility_loss)} />
        <Row label="暴露人口" value={populationText(modeSummary.exposed_population_gt60s)} />
        {typeof stranded === "number" && stranded > 0 && <Row label="孤立人口" value={populationText(stranded)} />}
      </>}
      {entry && <Row label="替代橋" value={sameRiver?.length ? altBridgesText(sameRiver, 2) : `路徑上其他橋：${altBridgesText(otherOnRoute, 2)}`} />}
      <PopupDetails summary="說明與限制">
        <Row label="研究狀態" value="研究中；站主限定（BSS 授權 HOLD）。是單橋失效後果，不是風險" />
        {entry && <Row label="複核日期" value={review?.latest_review_date ?? ""} mono />}
        {weighting === "decay" && <DecayDetailRows decay={decay} mode={mode} />}
        {weighting === "uniform" && modeSummary && <Row label="平均多花時間" value={minutesText(modeSummary.mean_dT_s, "未提供")} />}
        {entry && <Row label={`替代橋（同河 5 km・${BRIDGE_MODE_LABELS[mode]}）`} value={altBridgesText(sameRiver)} />}
        {entry && <Row label={`替代橋（路徑上其他橋・${BRIDGE_MODE_LABELS[mode]}）`} value={altBridgesText(otherOnRoute)} />}
        {modeSummary?.replacement_bridges?.basis && <Row label="替代橋依據" value={modeSummary.replacement_bridges.basis} />}
        {weighting === "uniform" && dayNight?.day && <Row label="敏感度・日間人口" value={`p90 ${minutesText(dayNight.day.p90_dT_s)}；損失 ${lossPercentText(dayNight.day.accessibility_loss)}`} />}
        {weighting === "uniform" && dayNight?.night && <Row label="敏感度・夜間人口" value={`p90 ${minutesText(dayNight.night.p90_dT_s)}；損失 ${lossPercentText(dayNight.night.accessibility_loss)}`} />}
        {weighting === "uniform" && mode === "scooter" && ban && <Row label="敏感度・機車不走快速公路" value={`p90 ${minutesText(ban.p90_dT_s)}；損失 ${lossPercentText(ban.accessibility_loss)}（對照值，非主結果）`} />}
        {entry && <Row label="替代路線" value="只畫戶籍權重最大的 3 組代表性起訖對，不一定是繞最遠的" />}
        {review?.notes?.map((note) => <Row key={note} label="複核備註" value={note} />)}
        {BRIDGE_RESILIENCE_LIMITS_TEXT.map((text, i) => <Row key={text} label={i === 0 ? "限制" : ""} value={text} />)}
      </PopupDetails>
    </PopupScroll>
  </>;
}

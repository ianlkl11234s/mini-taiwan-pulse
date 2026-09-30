import { useEffect } from "react";
import { FONT_SIZE } from "../../styles/designTokens";
import {
  BRIDGE_JOINT_KEY, BRIDGE_MODES, BRIDGE_MODE_LABELS, BRIDGE_RESILIENCE_KEY, BRIDGE_RESILIENCE_LIMITS_TEXT,
  BRIDGE_RESILIENCE_COLORS, geometryConfidenceText, isJointMember, lossPercentText, minutesText, populationText,
  type BridgeAltCandidate, type BridgeMode, type BridgeModeSummary, type BridgeSummaryEntry,
} from "../../data/bridgeResilienceTypes";
import { bridgeResilienceSelection, useBridgeResilienceData } from "../../data/bridgeResilienceStore";
import { paramBool, paramStr } from "../../layers/layerParamsAccess";
import { layerParamsStore, useLayerParams } from "../../state/layerParamsStore";
import { Row, Title } from "./shared";
import { useFeatureTheme } from "./featureTheme";

const KEY = BRIDGE_RESILIENCE_KEY;
const TOP_N = 3;
const setParam = (name: string, value: string | boolean) => layerParamsStore.setParam(KEY, name, value);

/** 「名稱（占比%）」前 3 名；空陣列回「無」。占比是前 50 組受影響起訖對的權重占比，非流量預測。 */
export function altBridgesText(items: BridgeAltCandidate[] | undefined): string {
  if (!items?.length) return "無";
  return items.slice(0, TOP_N).map((item) => `${item.label}（${(item.weight_share * 100).toFixed(1)}%）`).join("、");
}

/** 汽車／機車並列：每個指標一列，值是「汽車 …；機車 …」。 */
function perMode(entry: BridgeSummaryEntry, pick: (m: BridgeModeSummary) => string): string {
  return BRIDGE_MODES.map((mode) => {
    const modeSummary = entry.modes[mode];
    return `${BRIDGE_MODE_LABELS[mode]} ${modeSummary ? pick(modeSummary) : "未提供"}`;
  }).join("；");
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
  const showVillages = paramBool(values, KEY, "bridgeResilienceShowVillages");
  const showRoutes = paramBool(values, KEY, "bridgeResilienceShowRoutes");
  const canJoint = isJointMember(uid);
  const joint = canJoint && paramBool(values, KEY, "bridgeResilienceJoint");
  const entry: BridgeSummaryEntry | undefined = data?.summary.bridges[joint ? BRIDGE_JOINT_KEY : uid];
  const modeSummary = entry?.modes[mode];
  const review = entry?.human_review;
  const river = entry?.river ?? (typeof props.river === "string" ? props.river : "");
  const title = joint ? "關渡大橋＋淡江大橋（同時中斷）" : uid || "橋梁";
  const dayNight = modeSummary?.alt_population_weights;
  const ban = modeSummary?.sensitivity_scooter_expressway_ban;

  return <>
    <Title color={BRIDGE_RESILIENCE_COLORS[mode]}>{title}</Title>
    <Row label="研究狀態" value="研究中；站主限定（BSS 授權 HOLD）。是單橋失效後果，不是風險" />
    <Row label="河川" value={river} />
    {entry && <>
      <Row label="人工評級" value={geometryConfidenceText(review?.geometry_confidence)} />
      <Row label="複核日期" value={review?.latest_review_date ?? ""} mono />
    </>}
    <div className="fi-actions">
      <Segmented label="交通模式" value={mode} options={BRIDGE_MODES.map((m) => ({ value: m, label: BRIDGE_MODE_LABELS[m] }))} onChange={(v) => setParam("bridgeResilienceMode", v)} />
      <Toggle label="顯示受影響村里" on={showVillages} onChange={(v) => setParam("bridgeResilienceShowVillages", v)} />
      <Toggle label="顯示替代路線" on={showRoutes} onChange={(v) => setParam("bridgeResilienceShowRoutes", v)} />
      {canJoint && <Toggle label="與另一座同時中斷" on={joint} onChange={(v) => setParam("bridgeResilienceJoint", v)} />}
    </div>
    {!entry && <div style={{ padding: "6px 0", color: t.textDim, fontSize: FONT_SIZE.sm }}>{data ? "此橋沒有模擬指標。" : "指標載入中…"}</div>}
    {entry && <>
      <Row label="額外時間 p90" value={perMode(entry, (m) => minutesText(m.p90_dT_s))} />
      <Row label="平均多花時間" value={perMode(entry, (m) => minutesText(m.mean_dT_s, "未提供"))} />
      <Row label="可及性損失" value={perMode(entry, (m) => lossPercentText(m.accessibility_loss))} />
      <Row label="暴露人口" value={perMode(entry, (m) => populationText(m.exposed_population_gt60s))} />
      <Row label="孤立人口" value={perMode(entry, (m) => populationText(m.stranded_population))} />
      <Row label={`替代橋（同河 5 km・${BRIDGE_MODE_LABELS[mode]}）`} value={altBridgesText(modeSummary?.replacement_bridges?.same_river_within_5km)} />
      <Row label={`替代橋（路徑上其他橋・${BRIDGE_MODE_LABELS[mode]}）`} value={altBridgesText(modeSummary?.replacement_bridges?.other_bridges_on_route)} />
      {modeSummary?.replacement_bridges?.basis && <Row label="替代橋依據" value={modeSummary.replacement_bridges.basis} />}
      {dayNight?.day && <Row label="敏感度・日間人口" value={`${BRIDGE_MODE_LABELS[mode]} p90 ${minutesText(dayNight.day.p90_dT_s)}；損失 ${lossPercentText(dayNight.day.accessibility_loss)}`} />}
      {dayNight?.night && <Row label="敏感度・夜間人口" value={`${BRIDGE_MODE_LABELS[mode]} p90 ${minutesText(dayNight.night.p90_dT_s)}；損失 ${lossPercentText(dayNight.night.accessibility_loss)}`} />}
      {mode === "scooter" && ban && <Row label="敏感度・機車不走快速公路" value={`p90 ${minutesText(ban.p90_dT_s)}；損失 ${lossPercentText(ban.accessibility_loss)}（對照值，非主結果）`} />}
      <Row label="替代路線" value="只畫戶籍權重最大的 3 組代表性起訖對，不一定是繞最遠的" />
      {review?.notes?.map((note) => <Row key={note} label="複核備註" value={note} />)}
    </>}
    {BRIDGE_RESILIENCE_LIMITS_TEXT.map((text, i) => <Row key={text} label={i === 0 ? "限制" : ""} value={text} />)}
  </>;
}

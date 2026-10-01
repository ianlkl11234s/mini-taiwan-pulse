/**
 * §13 監看卡標準殼（spec §5.35，P1）：真 MonitorCardFrame＋MonitorCardTime。
 * 監看模式淡色版排在 P5，目前只有暗色一欄。
 */
import { COLORS, FONT_SIZE } from "../../styles/designTokens";
import { MonitorCardFrame, MonitorCardTime, type MonitorCardHeaderSlot } from "../../components/intel/monitor/MonitorCardFrame";
import { Kv, Section, Spec, Sub, type SectionDef } from "../kit";

export const MONITOR_SECTION: SectionDef = { id: "monitor", no: "13", title: "監看卡（新版）" };

const HOUR_MS = 3600_000;

function Demo({ title, en, slot, width, body }: { title: string; en: string; slot: MonitorCardHeaderSlot; width: number; body: string }) {
  return (
    <div style={{ width, display: "flex" }}>
      <MonitorCardFrame title={title} en={en} widgetId="demo">
        <MonitorCardTime {...slot} />
        <div style={{ fontSize: FONT_SIZE.base, color: COLORS.textMuted }}>{body}</div>
      </MonitorCardFrame>
    </div>
  );
}

export function MonitorSection() {
  const now = Date.now();
  return (
    <Section def={MONITOR_SECTION}>
      <Spec section="§5.35" impl={["src/components/intel/monitor/MonitorCardFrame.tsx", "src/components/intel/monitor/monitorCard.css", "src/components/intel/monitor/monitorCardMeta.ts"]} />
      <Sub title="標題列四種狀態（暗色；淡色 P5）" kind="real">
        <div className="mtp-mon" style={{ display: "flex", flexWrap: "wrap", gap: 10, padding: 14, background: "var(--surface-app)", borderRadius: 8 }}>
          <Demo title="供電" en="Power grid" width={300} slot={{ time: now - 10 * 60_000 }} body="即時：只顯示資料時間（當日 HH:MM）" />
          <Demo title="食品價格" en="Food prices" width={300} slot={{ timeText: "09/26", state: { kind: "stale", label: "過期 5 天" } }} body="過期：橘色 pill＋時間變色" />
          <Demo title="在監人數" en="Inmates" width={300} slot={{ timeText: "05/15", state: { kind: "stopped", label: "停更 139 天" } }} body="停更：紅色 pill" />
          <Demo title="加權指數" en="TAIEX" width={300} slot={{ time: now - 2 * HOUR_MS, state: { kind: "paused", label: "收盤" } }} body="收盤：中性 pill，不降灰" />
          <Demo title="環境輻射" en="Radiation" width={230} slot={{ time: now - 5 * 60_000 }} body="窄格（< 260px）：英文附註先隱藏" />
        </div>
      </Sub>
      <Kv rows={[
        ["外框", "1px --border-panel、--radius-lg、padding 10px 12px、overflow hidden"],
        ["標題", "13px 700 中文＋9px --text-dim 英文"],
        ["時間", "10px --font-data；當日 HH:MM、跨日 MM/DD"],
        ["切換", "面板標頭「新版／舊版」，localStorage mtp-monitor-style"],
      ]} />
    </Section>
  );
}

/**
 * §13 監看卡標準殼（spec §5.35，P1）：真 MonitorCardFrame＋MonitorCardTime。
 * 監看模式淡色版排在 P5，目前只有暗色一欄。
 */
import { COLORS } from "../../styles/designTokens";
import { MF, MON_FONT_PX } from "../../components/intel/monitor/monitorFont";
import { MonitorCardFrame, MonitorCardTime, type MonitorCardHeaderSlot } from "../../components/intel/monitor/MonitorCardFrame";
import { MonitorStyleContext } from "../../components/intel/monitor/monitorStyle";
import { MonitorKpis, MonitorMetric, MonitorNote, MonitorRows, MonitorSub } from "../../components/intel/monitor/MonitorMetric";
import { MON_CHART_H } from "../../components/intel/monitor/monitorChart";
import { TimeseriesSparkline, type SparklinePoint } from "../../components/TimeseriesSparkline";
import { HazardTrendBars, type HazardBar } from "../../components/intel/monitor/HazardTrendBars";
import { Kv, Section, Spec, Sub, type SectionDef } from "../kit";

export const MONITOR_SECTION: SectionDef = { id: "monitor", no: "13", title: "監看卡（新版）" };

const HOUR_MS = 3600_000;

function Demo({ title, en, slot, width, body }: { title: string; en: string; slot: MonitorCardHeaderSlot; width: number; body: string }) {
  return (
    <div style={{ width, display: "flex" }}>
      <MonitorCardFrame title={title} en={en} widgetId="demo">
        <MonitorCardTime {...slot} />
        <div style={{ fontSize: MF.body, color: COLORS.textMuted }}>{body}</div>
      </MonitorCardFrame>
    </div>
  );
}

const DAY_S = 86_400;

/** 示意：14 天日資料，第 6–8 天缺（斷線＋斜線帶） */
function demoLine(): SparklinePoint[] {
  const end = Math.floor(Date.now() / 1000 / DAY_S) * DAY_S;
  const out: SparklinePoint[] = [];
  for (let i = 0; i < 14; i++) {
    if (i >= 6 && i <= 8) continue;
    out.push({ t: end - (13 - i) * DAY_S, v: 12 + Math.round(6 * Math.sin(i / 2) + i * 0.4) });
  }
  return out;
}

/** 示意：14 天計數柱，含 null（灰樁）與 0（底線） */
const DEMO_BARS: HazardBar[] = [3, 5, 0, 2, null, null, 7, 4, 0, 1, 6, 9, 2, 3].map((v, i) => ({
  label: `09/${String(18 + i).padStart(2, "0")}`,
  value: v,
  level: v != null && v >= 6 ? 1 : 0,
}));
const DEMO_LEVELS = [COLORS.accent, COLORS.statusWarn];

/** 示意：共機 14 天，part＝越中線架次（底部子段） */
const DEMO_PLA_BARS: HazardBar[] = [12, 8, 21, 5, null, 14, 30, 9, 0, 17, 11, 26, 7, 15].map((v, i) => ({
  label: `09/${String(18 + i).padStart(2, "0")}`,
  value: v,
  level: v != null && v >= 20 ? 1 : 0,
  part: v == null ? null : Math.round(v * 0.6),
}));

/** 示意：另一條 14 天序列（小倍數列各自比例尺） */
function demoLine2(scale: number, phase: number): SparklinePoint[] {
  const end = Math.floor(Date.now() / 1000 / DAY_S) * DAY_S;
  return Array.from({ length: 14 }, (_, i) => ({
    t: end - (13 - i) * DAY_S,
    v: Math.round(scale * (1 + 0.25 * Math.sin(i / 2 + phase))),
  }));
}

function MetricDemo() {
  const line = demoLine();
  return (
    <MonitorStyleContext.Provider value="v2">
      <div className="mtp-mon" style={{ display: "flex", flexWrap: "wrap", gap: 10, padding: 14, background: "var(--surface-app)", borderRadius: 8 }}>
        <div style={{ width: 300, display: "flex" }}>
          <MonitorCardFrame title="備轉容量率" en="Operating reserve" widgetId="demo-metric">
            <MonitorMetric value="12.4" unit="%" delta="▲ 1.2" tone="down" />
            <MonitorKpis items={[
              { label: "供電能力", value: "41,230", unit: "MW" },
              { label: "尖峰負載", value: "36,700", unit: "MW" },
              { label: "備轉容量", value: "4,530", unit: "MW" },
            ]} />
            <MonitorSub items={["預估尖峰 14:00", "台電 · 每 10 分鐘"]} />
            <TimeseriesSparkline data={line} heightTier="std" gapSec={1.5 * DAY_S} unit="%" tooltipDateFormat="date" />
          </MonitorCardFrame>
        </div>
        <div style={{ width: 300, display: "flex" }}>
          <MonitorCardFrame title="在監人數" en="Inmates" widgetId="demo-muted">
            <MonitorCardTime timeText="05/15" state={{ kind: "stopped", label: "停更 139 天" }} />
            <MonitorMetric value="54,812" unit="人" muted />
            <MonitorNote tone="err">停更 139 天：上游未更新</MonitorNote>
          </MonitorCardFrame>
        </div>
        <div style={{ width: 300, display: "flex" }}>
          <MonitorCardFrame title="過期（G2）" en="Stale" widgetId="demo-stale">
            <MonitorCardTime timeText="09/29" state={{ kind: "stale", label: "過期 4 天" }} />
            <MonitorMetric value="12.4" unit="%" muted />
            <TimeseriesSparkline
              data={line.slice(0, -4)} heightTier="std" gapSec={1.5 * DAY_S} unit="%" tooltipDateFormat="date"
              staleUntil={Math.floor(Date.now() / 1000)}
            />
            <MonitorNote tone="warn">資料停在 09/29，超過預期更新時間</MonitorNote>
          </MonitorCardFrame>
        </div>
        <div style={{ width: 300, display: "flex" }}>
          <MonitorCardFrame title="地震次數" en="Earthquakes" widgetId="demo-bars">
            <MonitorMetric value="42" unit="次" />
            <HazardTrendBars bars={DEMO_BARS} levelColors={DEMO_LEVELS} heightTier="std" caption="近 14 天 · 次數（柱）" footer="共 42 次" unit=" 次" />
          </MonitorCardFrame>
        </div>
        <div style={{ width: 300, display: "flex" }}>
          <MonitorCardFrame title="共機架次" en="PLA aircraft" widgetId="demo-part">
            <MonitorMetric value="15" unit="架次" />
            <HazardTrendBars
              bars={DEMO_PLA_BARS} levelColors={DEMO_LEVELS} heightTier="std"
              caption="近 14 天 · 架次（柱）／越中線（底段）" unit=" 架次"
              partColor={COLORS.statusErr} partLabel="越中線"
            />
          </MonitorCardFrame>
        </div>
        <div style={{ width: 300, display: "flex" }}>
          <MonitorCardFrame title="正常範圍色帶" en="Normal band" widgetId="demo-band">
            <TimeseriesSparkline
              data={line} heightTier="std" gapSec={1.5 * DAY_S} tooltipDateFormat="date" showTooltip
              band={{ lo: 10, hi: 18, label: "近 7 天 p10–p90" }}
            />
          </MonitorCardFrame>
        </div>
        <div style={{ width: 300, display: "flex" }}>
          <MonitorCardFrame title="小倍數列" en="Small multiples" widgetId="demo-rows">
            <MonitorRows rows={[
              { label: "急診", chart: <TimeseriesSparkline data={demoLine2(120, 0)} heightTier="mini" bare fillArea={false} />, value: "132", unit: "人" },
              { label: "供電", chart: <TimeseriesSparkline data={demoLine2(38000, 1)} heightTier="mini" bare band={{ lo: 33000, hi: 43000 }} />, value: "41,230", unit: "MW" },
              { label: "共機", chart: <HazardTrendBars bars={DEMO_PLA_BARS} levelColors={DEMO_LEVELS} heightTier="mini" bare partColor={COLORS.statusErr} partLabel="越中線" unit=" 架次" />, value: "15", unit: "架次" },
            ]} />
          </MonitorCardFrame>
        </div>
        <div style={{ width: 620, display: "flex" }}>
          <MonitorCardFrame title="大圖（全寬主角圖）" en="Large" widgetId="demo-lg">
            <TimeseriesSparkline data={line} heightTier="lg" gapSec={1.5 * DAY_S} tooltipDateFormat="date" showTooltip />
          </MonitorCardFrame>
        </div>
      </div>
    </MonitorStyleContext.Provider>
  );
}

export function MonitorSection() {
  const now = Date.now();
  return (
    <Section def={MONITOR_SECTION}>
      <Spec section="§5.35" impl={["src/components/intel/monitor/MonitorCardFrame.tsx", "src/components/intel/monitor/MonitorMetric.tsx", "src/components/intel/monitor/monitorChart.ts", "src/components/intel/monitor/monitorCard.css", "src/components/intel/monitor/monitorCardMeta.ts"]} />
      <Sub title="標題列四種狀態（暗色；淡色 P5）" kind="real">
        <div className="mtp-mon" style={{ display: "flex", flexWrap: "wrap", gap: 10, padding: 14, background: "var(--surface-app)", borderRadius: 8 }}>
          <Demo title="供電" en="Power grid" width={300} slot={{ time: now - 10 * 60_000 }} body="即時：只顯示資料時間（當日 HH:MM）" />
          <Demo title="食品價格" en="Food prices" width={300} slot={{ timeText: "09/26", state: { kind: "stale", label: "過期 5 天" } }} body="過期：橘色 pill＋時間變色" />
          <Demo title="在監人數" en="Inmates" width={300} slot={{ timeText: "05/15", state: { kind: "stopped", label: "停更 139 天" } }} body="停更：紅色 pill" />
          <Demo title="加權指數" en="TAIEX" width={300} slot={{ time: now - 2 * HOUR_MS, state: { kind: "paused", label: "收盤" } }} body="收盤：中性 pill，不降灰" />
          <Demo title="環境輻射" en="Radiation" width={260} slot={{ time: now - 5 * 60_000 }} body="窄格（< 300px）：英文附註先隱藏" />
        </div>
      </Sub>
      <Sub title="數值列與走勢（暗色；淡色 P5）" kind="real">
        <MetricDemo />
      </Sub>
      <Kv rows={[
        ["數值列", "MonitorMetric 主數字 --mon-f-main；MonitorKpis 標籤 --mon-f-label、數值 --mon-f-kpi、每格最小 110px；MonitorSub 每項不拆"],
        ["圖高（圖區 px）", MON_CHART_H],
        ["折線缺值", "gapSec 斷線＋缺段斜線帶；最後一個有值點畫實心點"],
        ["柱缺值", "null 灰樁、0 底線"],
        ["小倍數列", "MonitorRows：名稱｜圖（1fr，同寬）｜最新值；列間 1px --border-soft；圖用 bare＋heightTier mini"],
        ["正常範圍", "TimeseriesSparkline band { lo, hi, label }：淡色水平帶，值域納入 lo／hi"],
        ["柱子量", "HazardBar.part＋partColor／partLabel：底部子段高＝part／max，part > value 截到 value"],
        ["外框", "1px --border-panel、--radius-lg、padding 10px 12px、overflow hidden"],
        ["字級 S13（px）", MON_FONT_PX],
        ["標題", "--mon-f-title 700 中文＋--mon-f-cap --text-dim 英文"],
        ["時間", "--mon-f-label --font-data；當日 HH:MM、跨日 MM/DD"],
        ["切換", "面板標頭「新版／舊版」，localStorage mtp-monitor-style"],
      ]} />
    </Section>
  );
}

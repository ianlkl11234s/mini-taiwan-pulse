/**
 * §3 面板外殼＋H2、§4 停靠 popup、§5 控制項、§7 載入狀態條、§8 Agent 光暈、§9 圖例。
 * 被展示的元件都從實作檔 import；只有「元件本身拉進資料載入鏈」時才仿製外殼（標「結構仿製，樣式為真」）。
 */
import { SEQUENTIAL_PALETTES } from "../../map/palettes";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Camera, HelpCircle, Share2 } from "lucide-react";
import {
  BORDER, COLORS, CONTROL, ELEVATION, FONT_CJK, FONT_SIZE, LIGHT, RADIUS, SLIDER, SURFACE,
} from "../../styles/designTokens";
import { PanelHeader } from "../../components/sidebar/PanelHeader";
import { FeatureThemeProvider, DARK_FEATURE, LIGHT_FEATURE } from "../../components/featureInfo/featureTheme";
import { Row, SourceFooter, Title } from "../../components/featureInfo/shared";
import "../../components/featureInfo/featureInfo.css";
import { Slider } from "../../components/controls/Slider";
import { LAYER_TOGGLE_PALETTE, LayerToggleSwitch } from "../../components/sidebar/LayerToggleSwitch";
import { ToolbarButton } from "../../components/toolbar/ToolbarButton";
import { getToolbarPalette } from "../../components/toolbar/toolbarTheme";
import { ModeToggle } from "../../components/ModeToggle";
import { ControlSegmented, LayerControlArea, ParamControlList } from "../../components/sidebar/LayerParamControls";
import type { ParamControl } from "../../state/layerParamsControls";
import { LoadingStatus, statusText } from "../../components/LoadingStatus";
import "../../components/loadingStatus.css";
import { loadingRegistry } from "../../lib/loadingRegistry";
import { LOADING_STATUS_TIMING, type LoadingStatusView } from "../../lib/loadingStatusController";
import { GLOW_LINGER_MS, ResearchActivity } from "../../research/ResearchActivityCard";
import type { Activity } from "../../research/researchActivity";
import {
  DARK_LEGEND, LEGEND_SIZE_RING_WIDTH, LEGEND_SWATCH, LIGHT_LEGEND, LegendCompactCtx, LegendNote, LegendNum, LegendRow, LegendSizeRow, LegendThemeCtx, LegendTitle,
  SwatchArrow, SwatchDot, SwatchGradient, SwatchHatch, SwatchLine, SwatchSquare, SwatchSteps,
} from "../../components/legend/legendKit";
import { LINE_DASH } from "../../map/mapStyleScale";
import { POWER_OUTPUT_LEGEND_MW, powerOutputRadius, RESERVOIR_CAPACITY_LEGEND_WAN, RESERVOIR_NODATA_COLOR, RESERVOIR_WATER_COLOR, reservoirCapacityRadius } from "../../map/r6FlatEncodings";
import { Kv, Pair, Section, Spec, Sub, Tag, objRows, type SectionDef } from "../kit";

// ── §3 面板外殼＋H2 ────────────────────────────────────────
const shellFor = (isDark: boolean) => isDark
  ? { background: SURFACE.strong, border: BORDER.panel, radius: RADIUS.xl, shadow: ELEVATION.lg, text: COLORS.textStrong, muted: COLORS.textMuted, body: COLORS.textDefault }
  : { background: LIGHT.surfacePanel, border: LIGHT.border, radius: RADIUS.xl, shadow: LIGHT.elevationLg, text: LIGHT.textStrong, muted: LIGHT.textMuted, body: LIGHT.textDefault };

export const PANEL_SECTION: SectionDef = { id: "panel", no: "3", title: "面板外殼＋H2 標頭" };
export function PanelSection() {
  return (
    <Section def={PANEL_SECTION}>
      <Spec section="§5.1" impl="src/components/sidebar/PanelHeader.tsx" />
      <p className="ds-note">標頭是 <b>真 PanelHeader</b>（傳 <code>eyebrow</code> 走 H2）；外殼依 §5.1 用 token 組出（外殼沒有獨立元件）。PanelHeader 的 eyebrow 寫死 <code>var(--text-dim)</code>，淡色欄在容器上把 <code>--text-dim</code> 指到 <code>--light-text-dim</code>（專案既有的淡色慣例）。</p>
      <Pair lightRemap render={(isDark) => {
        const s = shellFor(isDark);
        return <>
          <div style={{ width: 300, maxWidth: "100%", background: s.background, border: `1px solid ${s.border}`, borderRadius: s.radius, boxShadow: s.shadow, fontFamily: FONT_CJK, overflow: "hidden" }}>
            <PanelHeader eyebrow="資料" title="資料來源" onClose={() => undefined} borderColor={s.border} mutedColor={s.muted} textColor={s.text} />
            <div style={{ padding: "10px 14px 12px", fontSize: FONT_SIZE.base, color: s.body, lineHeight: 1.6 }}>
              內容捲動區。eyebrow 9px、字距 1.4px；標題 13px bold；關閉鈕 24×24。
            </div>
          </div>
          <Kv rows={[
            ["外殼底", isDark ? `SURFACE.strong = ${SURFACE.strong}` : `LIGHT.surfacePanel = ${LIGHT.surfacePanel}`],
            ["框", isDark ? `1px BORDER.panel = ${BORDER.panel}` : `1px LIGHT.border = ${LIGHT.border}`],
            ["圓角", `RADIUS.xl = ${RADIUS.xl}px`],
            ["陰影", isDark ? `ELEVATION.lg = ${ELEVATION.lg}` : `LIGHT.elevationLg = ${LIGHT.elevationLg}`],
            ["H2 padding", "10px 14px"],
          ]} />
        </>;
      }} />
    </Section>
  );
}

// ── §4 停靠 popup ─────────────────────────────────────────
const MOCK_PROPS: Record<string, unknown> = {
  source_org: "文化部文化資產局",
  source_url: "https://example.org/dataset",
  source_tier: 1,
  license: "OGDL-TW-1.0",
  fetched_at: "2026-09-28 14:05",
};

export const POPUP_SECTION: SectionDef = { id: "popup", no: "4", title: "停靠 popup" };
export function PopupSection() {
  return (
    <Section def={POPUP_SECTION}>
      <Spec section="§5.2、§5.3" impl={["src/components/FeatureInfoPanel.tsx", "src/components/featureInfo/{shared.tsx,featureTheme.tsx,featureInfo.css}"]} />
      <p className="ds-note">
        內容是 <b>真元件</b>：<code>FeatureThemeProvider</code>＋<code>Title</code>／<code>Row</code>／<code>SourceFooter</code>＋<code>featureInfo.css</code>。
        外殼 <Tag kind="replica" />：<code>FeatureInfoPanel</code> 經 <code>PANEL_REGISTRY</code> 會載入各圖層資料 loader（連到 Supabase），本頁不引入；外殼數值照該檔寫法以 token 組出。
      </p>
      <Pair render={(isDark) => {
        const palette = isDark ? DARK_FEATURE : LIGHT_FEATURE;
        const border = isDark ? "rgba(100, 170, 255, 0.25)" : LIGHT.border;
        const shell: CSSProperties = {
          position: "relative", width: 280, maxWidth: "100%", boxSizing: "border-box", background: isDark ? SURFACE.strong : LIGHT.surfacePanel,
          backdropFilter: "blur(14px)", border: `1px solid ${border}`, borderRadius: RADIUS.xl, padding: "12px 14px", fontFamily: FONT_CJK,
          ["--fi-border-soft" as string]: palette.borderSoft,
        };
        return <>
          <div className="ds-row">
            <FeatureThemeProvider palette={palette}>
              <div style={shell}>
                <div style={{ fontSize: FONT_SIZE.xs, color: isDark ? COLORS.textDim : LIGHT.textDim, letterSpacing: 1.2, marginBottom: 6 }}>宗教 · 寺廟</div>
                <Title color="#f59e0b">龍山寺</Title>
                <Row label="地址" value="臺北市萬華區廣州街 211 號" />
                <Row label="主祀" value="觀世音菩薩" />
                <Row label="建立年" value="1738" mono />
                <Row label="座標" value="25.0372, 121.4999" mono />
                <Row label="空值" value="null" />
                <SourceFooter props={MOCK_PROPS} />
              </div>
            </FeatureThemeProvider>
            <FeatureThemeProvider palette={palette}>
              <div style={shell}>
                <Title color="#38bdf8">來源缺漏時</Title>
                <Row label="名稱" value="示例測站" />
                <SourceFooter props={{}} />
              </div>
            </FeatureThemeProvider>
          </div>
          <Kv rows={[
            ["容器寬", "280px（CCTV 460px）"],
            ["底", isDark ? `SURFACE.strong = ${SURFACE.strong}` : `LIGHT.surfacePanel = ${LIGHT.surfacePanel}`],
            ["框", border],
            ...objRows(isDark ? "DARK_FEATURE" : "LIGHT_FEATURE", palette as unknown as Record<string, unknown>),
          ]} />
        </>;
      }} />
      <p className="ds-note">「空值」列傳入 <code>"null"</code>，Row 不渲染（§5.2 狀態）。</p>
    </Section>
  );
}

// ── §5 控制項 ────────────────────────────────────────────
const SPEED_OPTS = [
  { label: "30×", value: "30" }, { label: "60×", value: "60" }, { label: "120×", value: "120" }, { label: "300×", value: "300" }, { label: "600×", value: "600" },
];

function ControlsDemo({ isDark }: { isDark: boolean }) {
  const palette = getToolbarPalette(isDark);
  const [mode, setMode] = useState<"realtime" | "historical">("realtime");
  const [opacity, setOpacity] = useState(0.8);
  const [size, setSize] = useState(1.2);
  const [select, setSelect] = useState("120");
  const [seg, setSeg] = useState("day");
  const [t1, setT1] = useState(true);
  const [t2, setT2] = useState(false);
  const [t3, setT3] = useState(true);
  const [ms, setMs] = useState<string[]>(["a", "c"]);
  const [sw, setSw] = useState(true);
  const [raw, setRaw] = useState(40);
  const [pal, setPal] = useState("magma");
  const detailsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // 多選清單是 <details>，預設收合；參考頁展開它以便看到兩欄 checkbox
    detailsRef.current?.querySelectorAll("details").forEach((d) => { d.open = true; });
  }, []);

  const controls: ParamControl[] = [
    {
      type: "palette", label: "熱區顏色", value: pal, defaultValue: "magma", role: "heatmap",
      options: SEQUENTIAL_PALETTES.map((p) => ({ label: p.zh, value: p.id })), onChange: setPal,
    },
    { label: `透明度 ${opacity.toFixed(2)}`, name: "透明度", valueText: opacity.toFixed(2), value: opacity, min: 0, max: 1, step: 0.05, onChange: setOpacity },
    { label: `大小 ×${size.toFixed(1)}`, name: "大小", valueText: `×${size.toFixed(1)}`, value: size, min: 0.5, max: 3, step: 0.1, onChange: setSize },
    { type: "select", label: "播放倍速", value: select, options: SPEED_OPTS, onChange: setSelect },
    { type: "select", label: "粒度", value: seg, options: [{ label: "年", value: "year" }, { label: "月", value: "month" }, { label: "日", value: "day" }], onChange: setSeg },
    { type: "toggle", label: "顯示標籤", value: t1, onChange: setT1 },
    { type: "toggle", label: "只看即時", value: t2, onChange: setT2 },
    { type: "toggle", label: "3D 高度", value: t3, onChange: setT3 },
    {
      type: "multiSelect", label: "類別", value: ms,
      options: [{ label: "醫院", value: "a" }, { label: "診所", value: "b" }, { label: "藥局", value: "c" }, { label: "停用項", value: "d", disabled: true }],
      onChange: (v) => setMs([...v]), onSelectAll: () => setMs(["a", "b", "c"]), onSelectNone: () => setMs([]),
    },
  ];

  return <>
    <Sub title="工具列（ToolbarButton＋ModeToggle）" kind="real">
      <div style={{ display: "inline-flex", alignItems: "center", flexWrap: "wrap", gap: 4, padding: 3, borderRadius: 7, background: palette.surfaceBg, border: `1px solid ${palette.borderPanel}`, boxShadow: palette.shadow }}>
        <ModeToggle appMode={mode} isDarkTheme={isDark} onAppModeChange={(m) => setMode(m === "historical" ? "historical" : "realtime")} />
        <span style={{ width: 1, height: 16, background: palette.controlBorder }} />
        <ToolbarButton palette={palette}>底圖</ToolbarButton>
        <ToolbarButton palette={palette} icon title="分享"><Share2 size={13} /></ToolbarButton>
        <ToolbarButton palette={palette} icon title="說明"><HelpCircle size={13} /></ToolbarButton>
        <ToolbarButton palette={palette} primary><Camera size={13} />拍攝模式</ToolbarButton>
      </div>
      <Kv rows={[["按鈕高", "26px"], ["圓角", `RADIUS.md = ${RADIUS.md}px`], ["主要底／框字", `${palette.accentFaint} ／ ${palette.accent}`], ["hover 底", palette.controlBgHover], ["分隔線", `1×16 ${palette.controlBorder}`]]} />
    </Sub>
    <Sub title="圖層控制區（ParamControlList：滑桿／選單／分段／迷你開關／多選）" kind="real">
      <div ref={detailsRef} style={{ width: 260, maxWidth: "100%", fontFamily: FONT_CJK }}>
        <LayerControlArea isDarkTheme={isDark}>
          <ParamControlList controls={controls} />
        </LayerControlArea>
      </div>
      <p className="ds-note" style={{ marginTop: 4 }}>&gt;3 選項＝原生 <code>select.lpc-select</code>；≤3＝<code>ControlSegmented</code>；連續 ≥3 個開關排兩欄。</p>
    </Sub>
    <Sub title="分段控制（ControlSegmented 單獨）" kind="real">
      <div className={isDark ? "lpc-theme" : "lpc-theme lpc-theme--light"}>
        <ControlSegmented label="範圍" value={seg} options={[{ label: "季", value: "year" }, { label: "月", value: "month" }, { label: "週", value: "day", disabled: true }]} onChange={setSeg} />
      </div>
    </Sub>
    <Sub title="共用滑桿 Slider（S1）" kind="real">
      <div style={{ width: 220, display: "flex", flexDirection: "column", gap: 6 }}>
        <Slider value={raw} min={0} max={100} onChange={setRaw} ariaLabel="示例滑桿" ariaValueText={`${raw}%`} />
        <Slider value={30} min={0} max={100} onChange={() => undefined} disabled ariaLabel="停用滑桿" />
      </div>
      <Kv rows={isDark ? objRows("SLIDER", SLIDER) : [["LIGHT.sliderTrack", LIGHT.sliderTrack], ["LIGHT.sliderFill", LIGHT.sliderFill], ["LIGHT.sliderThumb", LIGHT.sliderThumb]]} />
    </Sub>
    <Sub title="列開關 LayerToggleSwitch（§5.10 第一階）" kind="real">
      <div className="ds-row" style={{ alignItems: "center" }}>
        <LayerToggleSwitch on={sw} onChange={() => setSw(!sw)} label="示例開關" isDarkTheme={isDark} />
        <LayerToggleSwitch on={!sw} onChange={() => setSw(!sw)} label="示例開關（反）" isDarkTheme={isDark} />
      </div>
      <Kv rows={Object.entries(LAYER_TOGGLE_PALETTE[isDark ? "dark" : "light"]).map(([k, v]) => [`LAYER_TOGGLE_PALETTE.${isDark ? "dark" : "light"}.${k}`, v])} />
      <p className="ds-note" style={{ marginTop: 4 }}><span className="ds-mono">28×16</span>、圓點 <span className="ds-mono">12</span>；開＝黑白（依主題）。細項開關（第二階，<span className="ds-mono">20×11</span>、開＝強調藍）見上方圖層控制區的「開關」。</p>
    </Sub>
    <Kv rows={[["CONTROL.bg", isDark ? CONTROL.bg : LIGHT.controlBg], ["CONTROL.bgHover", isDark ? CONTROL.bgHover : LIGHT.controlBgHover], ["CONTROL.border", isDark ? CONTROL.border : LIGHT.controlBorder], ["CONTROL.optionBg", isDark ? CONTROL.optionBg : LIGHT.surfaceSolid], ["disabledOpacity", CONTROL.disabledOpacity]]} />
  </>;
}

export const CONTROLS_SECTION: SectionDef = { id: "controls", no: "5", title: "控制項" };
export function ControlsSection() {
  return (
    <Section def={CONTROLS_SECTION}>
      <Spec section="§5.7–§5.13、§5.17、§5.28" impl={["src/components/toolbar/ToolbarButton.tsx", "src/components/ModeToggle.tsx", "src/components/sidebar/LayerParamControls.tsx", "src/components/controls/Slider.tsx", "src/components/sidebar/LayerToggleSwitch.tsx"]} />
      <Pair lightRemap render={(isDark) => <ControlsDemo isDark={isDark} />} />
    </Section>
  );
}

// ── §7 載入狀態條 ────────────────────────────────────────
const STATIC_VIEWS: readonly { name: string; view: LoadingStatusView }[] = [
  { name: "載入中", view: { visible: true, phase: "loading", label: "空氣品質測站", extra: 2, count: 0 } },
  { name: "已載入（單項）", view: { visible: true, phase: "done", label: "空氣品質測站", extra: 0, count: 1 } },
  { name: "已載入（多項）", view: { visible: true, phase: "done", label: "", extra: 0, count: 3 } },
  { name: "失敗", view: { visible: true, phase: "error", label: "颱風路徑", extra: 0, count: 0 } },
];

/** 用 LoadingStatus 的真 class 與真 statusText() 畫靜態狀態（元件本身只吃全域 registry，無法同時呈現多種狀態）。 */
function StaticStatus({ view, isDark }: { view: LoadingStatusView; isDark: boolean }) {
  const text = statusText(view);
  const cls = ["loading-status", `loading-status--${view.phase}`, "loading-status--on", isDark ? "" : "loading-status--light"].filter(Boolean).join(" ");
  return (
    <div className={cls} style={{ position: "relative", top: 0, right: 0, transform: "none" }} role="presentation">
      <span className="loading-status__icon" aria-hidden="true">
        {view.phase === "loading" && <span className="loading-status__ring" />}
        {view.phase === "done" && <svg width="10" height="10" viewBox="0 0 10 10"><path d="M1.5 5.2 4 7.6 8.6 2.6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>}
        {view.phase === "error" && <svg width="10" height="10" viewBox="0 0 10 10"><path d="M5 1.2 9.2 8.6H.8Z" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /><path d="M5 4v2.2M5 7.3v.2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>}
      </span>
      <span className="loading-status__text">
        <span className="loading-status__label">{text.main}</span>
        {text.extra && <span className="loading-status__extra">{text.extra}</span>}
      </span>
    </div>
  );
}

const DEMO_TASK = "design-system-demo";
let demoSeq = 0;

export const LOADING_SECTION: SectionDef = { id: "loading-status", no: "7", title: "載入狀態條" };
export function LoadingStatusSection() {
  useEffect(() => {
    // 一開頁就掛一個不結束的任務，靜態快照會停在「載入中」
    loadingRegistry.start(DEMO_TASK, "示例圖層");
    return () => loadingRegistry.end(DEMO_TASK);
  }, []);
  const run = (fail: boolean) => {
    const id = `${DEMO_TASK}-${++demoSeq}`;
    loadingRegistry.start(id, fail ? "颱風路徑" : "空氣品質測站");
    window.setTimeout(() => loadingRegistry.end(id, fail), 900);
  };
  return (
    <Section def={LOADING_SECTION}>
      <Spec section="§5.30" impl={["src/components/LoadingStatus.tsx", "src/components/loadingStatus.css", "src/lib/loadingStatusController.ts"]} />
      <Sub title="即時元件（訂閱全域 loadingRegistry）" kind="real">
        <p className="ds-note">暗／淡兩個是同一個 registry 的兩個實例，狀態永遠一致。開頁即有一個不結束的「示例圖層」任務。</p>
        <div className="ds-row" style={{ margin: "6px 0" }}>
          <button type="button" className="ds-btn" onClick={() => run(false)}>觸發一個會成功的任務</button>
          <button type="button" className="ds-btn" onClick={() => run(true)}>觸發一個會失敗的任務</button>
        </div>
      </Sub>
      <Pair render={(isDark) => (
        <div className="ds-frame" style={{ height: 60 }}>
          <LoadingStatus isDarkTheme={isDark} top={12} rightOffset="16px" />
        </div>
      )} />
      <Sub title="各狀態（靜態）" kind="replica">
        <p className="ds-note">標記與 class 照元件複製、文案用元件匯出的 <code>statusText()</code>，樣式來自真的 <code>loadingStatus.css</code>。</p>
      </Sub>
      <Pair render={(isDark) => <>
        {STATIC_VIEWS.map((s) => (
          <div key={s.name} className="ds-row" style={{ alignItems: "center" }}>
            <span style={{ width: 96, fontSize: FONT_SIZE.sm, color: isDark ? COLORS.textDim : LIGHT.textDim }}>{s.name}</span>
            <StaticStatus view={s.view} isDark={isDark} />
          </div>
        ))}
        <Kv rows={[["高", "22px"], ["padding", "0 9px"], ["圓角", `RADIUS.lg = ${RADIUS.lg}px`], ["字", `FONT_SIZE.sm = ${FONT_SIZE.sm}px`]]} />
      </>} />
      <Sub title="節奏（LOADING_STATUS_TIMING）" kind="real">
        <Kv rows={objRows("LOADING_STATUS_TIMING", LOADING_STATUS_TIMING)} />
      </Sub>
    </Section>
  );
}

// ── §8 Agent 光暈 ────────────────────────────────────────
const WORKING: Activity = { phase: "working", title: "查詢附近醫療據點", detail: "正在讀取 1 公里內的資料" };
const DONE: Activity = { phase: "complete", title: "已完成分析", detail: "結果已放到地圖上" };
const HISTORY: readonly Activity[] = [{ phase: "complete", title: "設定分析範圍", detail: "臺北車站周邊 1 公里" }];

export const GLOW_SECTION: SectionDef = { id: "agent-glow", no: "8", title: "Agent 處理中光暈" };
export function GlowSection() {
  const frame = (isDark: boolean, activity: Activity, label: string) => (
    <div>
      <div style={{ fontSize: FONT_SIZE.sm, color: isDark ? COLORS.textDim : LIGHT.textDim, marginBottom: 4 }}>{label}</div>
      <div className="ds-frame" style={{ height: 210, background: isDark ? "#1b1c20" : "#eef0ec" }}>
        <div
          className={`research-activity-position${isDark ? "" : " research-activity-position--light"}`}
          style={{ ["--research-activity-top" as string]: "16px", maxHeight: "none" } as CSSProperties}
        >
          <ResearchActivity activity={activity} history={HISTORY} />
        </div>
      </div>
    </div>
  );
  return (
    <Section def={GLOW_SECTION}>
      <Spec section="§5.31" impl={["src/research/ResearchActivityCard.tsx", "src/research/researchActivity.css"]} />
      <p className="ds-note">真 <code>ResearchActivity</code>。光暈節點是 <code>position: fixed; inset: 0</code>，放在 transform 容器裡，範圍就是這個框（地圖底為替身色）。活動卡上緣在 App 是 100px，這裡把 <code>--research-activity-top</code> 改成 16px 以放進框內。熄滅延遲 <span className="ds-mono">GLOW_LINGER_MS = {GLOW_LINGER_MS}</span>。</p>
      <Pair render={(isDark) => <>
        {frame(isDark, WORKING, "working：光暈開")}
        {frame(isDark, DONE, "complete：光暈關")}
      </>} />
    </Section>
  );
}

// ── §9 圖例 ─────────────────────────────────────────────
const STEP_COLORS = ["#fee5d9", "#fcae91", "#fb6a4a", "#de2d26", "#a50f15"] as const;

function LegendDemo() {
  return <>
    <LegendTitle zh="醫療據點" en="Medical" />
    <LegendRow swatch={<SwatchDot color="#e53935" />}>醫院</LegendRow>
    <LegendRow swatch={<SwatchDot color="#fb8c00" />}>診所</LegendRow>
    <LegendRow swatch={<SwatchSquare color="#43a047" />}>保護區（面）</LegendRow>
    <LegendRow swatch={<SwatchSquare color="#1e88e5" outline />}>服務範圍（框線面）</LegendRow>
    <LegendRow swatch={<SwatchLine color="#8e24aa" />}>路線</LegendRow>
    <LegendRow swatch={<SwatchLine color="#8e24aa" dash={LINE_DASH.general} />}>規劃中（虛線 {LINE_DASH.general.join(",")}）</LegendRow>
    <LegendRow swatch={<SwatchLine color="#00897b" dash={LINE_DASH.boundary} />}>海域界（虛線 {LINE_DASH.boundary.join(",")}）</LegendRow>
    <LegendRow swatch={<SwatchHatch kind="missing" />}>缺值</LegendRow>
    <LegendRow swatch={<SwatchHatch kind="suppressed" />}>遮蔽</LegendRow>
    <LegendRow swatch={<SwatchArrow color="#fbbf24" />}>行進方向箭頭（LG-6，移動物件平面模式拉近）</LegendRow>
    <div style={{ marginTop: 10 }}>
      <LegendTitle zh="人口密度" en="Population density" />
      <SwatchSteps colors={STEP_COLORS} breaks={["0", "500", "2k", "8k", "20k", "40k"]} />
    </div>
    <div style={{ marginTop: 10 }}>
      <LegendTitle zh="熱區" en="Heatmap" />
      <SwatchGradient gradient="linear-gradient(90deg, #000004, #3b0f70, #8c2981, #de4968, #fe9f6d, #fcfdbf)" labels={["稀", "密"]} />
    </div>
    <LegendNote>單位 人／<LegendNum>km²</LegendNum>；資料 <LegendNum>2025</LegendNum> 年。這一行是 LegendNote，精簡版會收起。</LegendNote>
  </>;
}

export const LEGEND_SECTION: SectionDef = { id: "legend", no: "9", title: "圖例 legendKit" };
export function LegendSection() {
  const panel = (isDark: boolean, compact: boolean) => (
    <LegendThemeCtx.Provider value={isDark ? DARK_LEGEND : LIGHT_LEGEND}>
      <LegendCompactCtx.Provider value={compact}>
        <div style={{ width: 230, boxSizing: "border-box", padding: "8px 10px", fontFamily: FONT_CJK, background: isDark ? SURFACE.strong : LIGHT.surfacePanel, border: `1px solid ${isDark ? BORDER.panel : LIGHT.border}`, borderRadius: RADIUS.xl, boxShadow: isDark ? ELEVATION.lg : LIGHT.elevationLg }}>
          <div style={{ fontSize: FONT_SIZE.xs, color: isDark ? COLORS.textDim : LIGHT.textDim, marginBottom: 6 }}>{compact ? "精簡版 compact" : "一般"}</div>
          <LegendDemo />
        </div>
      </LegendCompactCtx.Provider>
    </LegendThemeCtx.Provider>
  );
  return (
    <Section def={LEGEND_SECTION}>
      <Spec section="§5.32（地圖規格 §4.2 LG-1–LG-12）" impl="src/components/legend/legendKit.tsx" />
      <p className="ds-note">legendKit 每個匯出都是真元件，包在 <code>LegendThemeCtx</code>（DARK_LEGEND／LIGHT_LEGEND）裡。面板外殼 <Tag kind="replica" />（<code>LegendPanel</code> 會引入所有子圖例，本頁不引入）。右欄是精簡版：<code>LegendNote</code> 不顯示。</p>
      <Pair render={(isDark) => <>
        <div className="ds-row">{panel(isDark, false)}{panel(isDark, true)}</div>
        <Kv rows={[
          ...objRows(isDark ? "DARK_LEGEND" : "LIGHT_LEGEND", (isDark ? DARK_LEGEND : LIGHT_LEGEND) as unknown as Record<string, unknown>),
        ]} />
      </>} />
      <Sub title="LEGEND_SWATCH 尺寸" kind="real">
        <Kv rows={objRows("LEGEND_SWATCH", LEGEND_SWATCH)} />
      </Sub>
      <Sub title="LegendSizeRow 大小圈（LG-5）：實心 fill／空心 ring" kind="real">
        <p className="ds-note">直徑＝地圖實際直徑（R6 平面圓點固定 px）。預設 <code>fill</code> 實心＋底圖色細縫（機組出力用中性灰：大小與燃料色無關）。圖層另有灰色「無資料」類別時改用 <code>ring</code> 空心圈、描邊 <span className="ds-mono">{LEGEND_SIZE_RING_WIDTH}px</span>，色取該圖層自己的系統色——水庫用水庫面的水系色 <span className="ds-mono">RESERVOIR_WATER_COLOR</span>（2026-10-09 決議：原中性灰實心圈會跟「無資料」撞色）。</p>
        <Pair render={(isDark) => (
          <LegendThemeCtx.Provider value={isDark ? DARK_LEGEND : LIGHT_LEGEND}>
            <div style={{ width: 230, boxSizing: "border-box", padding: "8px 10px", fontFamily: FONT_CJK, background: isDark ? SURFACE.strong : LIGHT.surfacePanel, border: `1px solid ${isDark ? BORDER.panel : LIGHT.border}`, borderRadius: RADIUS.xl }}>
              <LegendSizeRow fill={RESERVOIR_NODATA_COLOR} title="fill：即時出力（機組圓點大小）" items={POWER_OUTPUT_LEGEND_MW.map((mw) => ({ r: powerOutputRadius(mw), label: `${mw.toLocaleString()} MW` }))} />
              <LegendSizeRow ring={isDark ? RESERVOIR_WATER_COLOR.dark : RESERVOIR_WATER_COLOR.light} title="ring：有效容量（水庫圓點大小）" items={RESERVOIR_CAPACITY_LEGEND_WAN.map((wan) => ({ r: reservoirCapacityRadius(wan), label: `${(wan / 10_000).toLocaleString()} 億 m³` }))} />
              <LegendRow swatch={<SwatchDot color={RESERVOIR_NODATA_COLOR} />}>無資料（維持灰實心點）</LegendRow>
            </div>
          </LegendThemeCtx.Provider>
        )} />
      </Sub>
    </Section>
  );
}

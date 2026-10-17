/**
 * §1 Token、§2 字型、§12 左側停靠版面。
 * 全部 iterate designTokens.ts 匯出的物件，新增 key 會自動出現；CSS 變數值用 getComputedStyle 讀 tokens.css。
 */
import type { CSSProperties } from "react";
import {
  BORDER, COLORS, CONTROL, ELEVATION, FONT_CJK, FONT_DATA, FONT_SIZE, FONT_WEIGHT, LAYOUT, LIGHT, RADIUS,
  SELECTION_RING, SLIDER, SPACING, SURFACE, WHITE_ALPHA, Z_INDEX,
} from "../../styles/designTokens";
import { TC3_COLLAPSED_WIDTH, TC3_EXPANDED_WIDTH } from "../../components/timeline/TimelineShell";
import { Kv, Pair, Section, Spec, Sub, Tag, kebab, objRows, readCssVar, sameValue, type SectionDef } from "../kit";

type Preview = "color" | "radius" | "fontSize" | "fontWeight" | "spacing" | "elevation" | "plain";

interface TokenGroup {
  name: string;
  obj: Record<string, string | number>;
  preview: Preview;
  cssVar: ((key: string) => string) | null;
  spec: string;
  note?: string;
}

const GROUPS: readonly TokenGroup[] = [
  { name: "SURFACE", obj: SURFACE, preview: "color", cssVar: (k) => `--surface-${kebab(k)}`, spec: "§3.1" },
  {
    name: "COLORS", obj: COLORS, preview: "color", cssVar: (k) => `--${kebab(k)}`, spec: "§3.2 文字／§3.4 強調／§3.5 狀態",
    note: "含 intelTokens 沿用的 legacy key（panelBg、border*、surge、cluster…），這些沒有 CSS 變數，新元件改用 SURFACE／BORDER。",
  },
  { name: "WHITE_ALPHA", obj: WHITE_ALPHA, preview: "color", cssVar: (k) => `--white-a${k}`, spec: "§3.3" },
  { name: "BORDER", obj: BORDER, preview: "color", cssVar: (k) => `--border-${kebab(k)}`, spec: "§3.3" },
  { name: "CONTROL", obj: CONTROL, preview: "color", cssVar: (k) => `--control-${kebab(k)}`, spec: "§3.6" },
  { name: "SLIDER", obj: SLIDER, preview: "color", cssVar: (k) => `--slider-${kebab(k)}`, spec: "§3.7" },
  { name: "SELECTION_RING", obj: SELECTION_RING, preview: "color", cssVar: null, spec: "§3.8", note: "寫入地圖容器的 --selection-ring-accent（執行期），:root 沒有對應變數。" },
  { name: "LIGHT", obj: LIGHT, preview: "color", cssVar: (k) => `--light-${kebab(k)}`, spec: "§3.9" },
  { name: "RADIUS", obj: RADIUS, preview: "radius", cssVar: (k) => `--radius-${kebab(k)}`, spec: "§3.10" },
  { name: "SPACING", obj: SPACING, preview: "spacing", cssVar: (k) => `--space-${kebab(k)}`, spec: "§3.11" },
  { name: "ELEVATION", obj: ELEVATION, preview: "elevation", cssVar: (k) => `--elevation-${kebab(k)}`, spec: "§3.12" },
  { name: "FONT_SIZE", obj: FONT_SIZE, preview: "fontSize", cssVar: (k) => `--font-${kebab(k)}`, spec: "§3.13" },
  { name: "FONT_WEIGHT", obj: FONT_WEIGHT, preview: "fontWeight", cssVar: (k) => `--font-weight-${kebab(k)}`, spec: "§3.14" },
];

const isColor = (v: unknown) => typeof v === "string" && /^(#|rgba?\(|hsla?\()/.test(v);
const isShadow = (v: unknown) => typeof v === "string" && /px/.test(v) && /rgba/.test(v);
const px = (v: string | number) => (typeof v === "number" ? `${v}px` : v);

function TokenPreview({ preview, value }: { preview: Preview; value: string | number }) {
  if (isShadow(value)) {
    return <div style={{ height: 30, display: "grid", placeItems: "center" }}><div style={{ width: "70%", height: 20, borderRadius: RADIUS.lg, background: SURFACE.strong, boxShadow: String(value) }} /></div>;
  }
  if (isColor(value) || (preview === "color" && typeof value === "string")) {
    return <div className="ds-swatch"><i style={{ background: String(value) }} /></div>;
  }
  if (preview === "radius") {
    return <div style={{ width: 44, height: 30, borderRadius: px(value), border: `1px solid ${COLORS.accent}`, background: COLORS.accentFaint }} />;
  }
  if (preview === "spacing") {
    return <div style={{ height: 30, display: "flex", alignItems: "center" }}><div style={{ width: px(value), height: 12, background: COLORS.accent }} /></div>;
  }
  if (preview === "fontSize") {
    return <div style={{ height: 30, display: "flex", alignItems: "center", fontSize: px(value), color: COLORS.textStrong, fontFamily: FONT_CJK }}>字級 Aa</div>;
  }
  if (preview === "fontWeight") {
    return <div style={{ height: 30, display: "flex", alignItems: "center", fontSize: FONT_SIZE.lg, fontWeight: Number(value), color: COLORS.textStrong, fontFamily: FONT_CJK }}>字重 Aa</div>;
  }
  if (typeof value === "number" && value <= 1) {
    return <div style={{ height: 30, display: "flex", alignItems: "center" }}><div style={{ width: 60, height: 14, background: COLORS.textStrong, opacity: value, borderRadius: RADIUS.sm }} /></div>;
  }
  return <div style={{ height: 30 }} />;
}

function TokenCard({ group, k, value }: { group: TokenGroup; k: string; value: string | number }) {
  const varName = group.cssVar?.(k) ?? null;
  const cssValue = varName ? readCssVar(varName) : "";
  const match = cssValue ? sameValue(value, cssValue) : null;
  return (
    <div className="ds-tok">
      <TokenPreview preview={group.preview} value={value} />
      <span className="ds-tok__name ds-mono">{group.name}.{k}</span>
      <span className="ds-tok__val ds-mono">{String(value)}</span>
      {varName && cssValue ? (
        <span className="ds-tok__var">
          <span className="ds-mono">{varName}</span>
          {match ? " 同值" : <span className="ds-warn"> 不一致：<span className="ds-mono">{cssValue}</span></span>}
        </span>
      ) : (
        <span className="ds-tok__var">無 CSS 變數</span>
      )}
    </div>
  );
}

function TokenGroupBlock({ group }: { group: TokenGroup }) {
  return (
    <Sub title={group.name} kind="real" tagText="真值">
      <p className="ds-spec">規格 <code>docs/design-system/spec.md</code> {group.spec}　／　實作 <code>src/styles/designTokens.ts</code>、<code>src/styles/tokens.css</code></p>
      {group.note && <p className="ds-note" style={{ margin: "4px 0" }}>{group.note}</p>}
      <div className="ds-tokgrid" style={{ marginTop: 8 }}>
        {Object.entries(group.obj).map(([k, v]) => <TokenCard key={k} group={group} k={k} value={v} />)}
      </div>
    </Sub>
  );
}

/** LIGHT 每個 key 找暗色對應（同名 COLORS／去前綴 SURFACE、CONTROL、SLIDER、BORDER、ELEVATION）。 */
function darkCounterpart(lightKey: string): [string, string] | null {
  const lc = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
  const colors = COLORS as Record<string, string>;
  if (lightKey.startsWith("border")) {
    const key = lc(lightKey.slice("border".length)) || "panel";
    const b = BORDER as Record<string, string>;
    if (b[key]) return [`BORDER.${key}`, b[key]!];
  }
  if (colors[lightKey]) return [`COLORS.${lightKey}`, colors[lightKey]!];
  const tries: [string, Record<string, string | number>, string][] = [
    ["surface", SURFACE, "SURFACE"], ["control", CONTROL, "CONTROL"], ["slider", SLIDER, "SLIDER"], ["elevation", ELEVATION, "ELEVATION"],
  ];
  for (const [prefix, obj, name] of tries) {
    if (lightKey.startsWith(prefix)) {
      const key = lc(lightKey.slice(prefix.length));
      if (key in obj) return [`${name}.${key}`, String(obj[key])];
    }
  }
  return null;
}

function LightMapping() {
  return (
    <table className="ds-kv" style={{ maxWidth: 820 }}>
      <thead><tr><th>暗色 token</th><th>暗</th><th>淡</th><th>LIGHT key</th></tr></thead>
      <tbody>
        {Object.entries(LIGHT).map(([k, v]) => {
          const dark = darkCounterpart(k);
          return (
            <tr key={k}>
              <td className="ds-mono">{dark ? `${dark[0]} = ${dark[1]}` : "—"}</td>
              <td style={{ width: 70 }}>{dark && (isShadow(dark[1]) ? <div style={{ width: 60, height: 18, background: SURFACE.strong, boxShadow: dark[1], borderRadius: RADIUS.md }} /> : <div className="ds-swatch" style={{ height: 18 }}><i style={{ background: dark[1] }} /></div>)}</td>
              <td style={{ width: 70, background: LIGHT.surfaceSolid }}>{isShadow(v) ? <div style={{ width: 60, height: 18, background: LIGHT.surfaceSolid, boxShadow: v, borderRadius: RADIUS.md }} /> : <div className="ds-swatch" style={{ height: 18 }}><i style={{ background: v }} /></div>}</td>
              <td className="ds-mono">LIGHT.{k} = {v}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/** §5.25 已登記的寫死層級特例（文件值，程式沒有匯出常數） */
const Z_SPECIAL: readonly { name: string; value: number }[] = [
  { name: "LoadingScreen 開站遮罩", value: 9999 },
  { name: "資料更新中遮罩（App day-loading）", value: 1000 },
  { name: "TransientNotice／私人圖層提示", value: 3000 },
  { name: "AdminPanel", value: 10001 },
  { name: "圖層 host 錯誤提示", value: 10000 },
  { name: "ChartHoverTooltip（TOOLTIP_Z）", value: 10050 },
];

function ZLadder() {
  const entries = Object.entries(Z_INDEX).sort((a, b) => a[1] - b[1]);
  return (
    <div className="ds-row" style={{ alignItems: "stretch" }}>
      <div style={{ position: "relative", width: 330 + entries.length * 18, height: 30 + entries.length * 30, flexShrink: 0 }}>
        {entries.map(([k, v], i) => {
          const style: CSSProperties = {
            position: "absolute", left: i * 18, top: (entries.length - 1 - i) * 30, width: 330, height: 56,
            zIndex: v, borderRadius: RADIUS.lg, border: `1px solid ${BORDER.strong}`,
            background: `color-mix(in srgb, ${COLORS.accent} ${12 + i * 8}%, ${SURFACE.app})`,
            boxShadow: ELEVATION.sm, padding: "4px 10px", boxSizing: "border-box", color: COLORS.textStrong, fontSize: FONT_SIZE.sm,
            display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 8,
          };
          return (
            <div key={k} style={style}>
              <span className="ds-mono">Z_INDEX.{k} = {v}</span>
              <span className="ds-mono" style={{ color: COLORS.textMuted }}>--z-{kebab(k)}: {readCssVar(`--z-${kebab(k)}`) || "（缺）"}</span>
            </div>
          );
        })}
      </div>
      <div style={{ minWidth: 260, flex: 1 }}>
        <Sub title="寫死特例（已登記）" kind="doc">
          <Kv rows={Z_SPECIAL.map((s) => [s.name, s.value])} />
        </Sub>
      </div>
    </div>
  );
}

export const TOKENS_SECTION: SectionDef = { id: "tokens", no: "1", title: "Token" };
export function TokensSection() {
  return (
    <Section def={TOKENS_SECTION}>
      <p className="ds-note">每張卡：預覽、<b>TS 名 → 值</b>、對應 CSS 變數與它在 <code>:root</code> 的實際值（執行期讀 <code>tokens.css</code>，與 TS 不一致會標橘色）。物件新增 key 會自動出現。</p>
      {GROUPS.map((g) => <TokenGroupBlock key={g.name} group={g} />)}
      <Sub title="LIGHT ↔ 暗色對照" kind="real" tagText="真值">
        <Spec section="§3.9" impl="src/styles/designTokens.ts" />
        <LightMapping />
      </Sub>
      <Sub title="Z_INDEX 層級" kind="real" tagText="真值">
        <Spec section="§5.25" impl={["src/styles/designTokens.ts", "src/styles/tokens.css"]} />
        <p className="ds-note">由下往上疊：每層用 <code>Z_INDEX.*</code> 實值當 z-index 畫出。同層靠 DOM 順序，不寫死數字。</p>
        <ZLadder />
      </Sub>
      <Sub title="LAYOUT" kind="real" tagText="真值">
        <Spec section="§5.1、§5.24" impl="src/styles/designTokens.ts" />
        <Kv rows={objRows("LAYOUT", LAYOUT)} />
        <p className="ds-note">版面示意見第 12 節。</p>
      </Sub>
    </Section>
  );
}

// ── §2 字型 ────────────────────────────────────────────────
/** §4.2 品牌字標（文件值；字標寫在 App.tsx，沒有匯出常數） */
const BRAND = { size: 20, weight: 700, letterSpacing: 2, dark: "#fff", light: "#333" } as const;

export const TYPE_SECTION: SectionDef = { id: "typography", no: "2", title: "字型" };
export function TypographySection() {
  return (
    <Section def={TYPE_SECTION}>
      <Spec section="§4.1、§4.2" impl={["src/components/intel/intelTokens.ts（FONT_CJK／FONT_DATA）", "src/styles/tokens.css"]} />
      <Kv rows={[["FONT_CJK", FONT_CJK], ["--font-cjk", readCssVar("--font-cjk")], ["FONT_DATA", FONT_DATA], ["--font-data", readCssVar("--font-data")]]} />
      <Pair bg="page" render={(isDark) => {
        const strong = isDark ? COLORS.textStrong : LIGHT.textStrong;
        const dim = isDark ? COLORS.textDim : LIGHT.textDim;
        return <>
          <Sub title="FONT_CJK 字級（FONT_SIZE）" kind="real">
            <div style={{ display: "flex", flexDirection: "column", gap: 4, fontFamily: FONT_CJK, color: strong }}>
              {Object.entries(FONT_SIZE).map(([k, v]) => (
                <div key={k} style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
                  <span className="ds-mono" style={{ width: 96, flexShrink: 0, fontSize: FONT_SIZE.sm, color: dim }}>{k} {v}px</span>
                  <span style={{ fontSize: v }}>即時情報 圖層控制 Layers</span>
                </div>
              ))}
            </div>
          </Sub>
          <Sub title="FONT_DATA 數字（tabular-nums）" kind="real">
            <div style={{ fontFamily: FONT_DATA, fontVariantNumeric: "tabular-nums", color: strong, fontSize: FONT_SIZE.md, display: "flex", flexDirection: "column", gap: 2 }}>
              <span>25.0464, 121.5318 · z12.5</span>
              <span>14:05:32 · 1,234,567</span>
              <span>1111.11</span>
              <span>8888.88</span>
            </div>
            <p className="ds-note" style={{ color: dim, marginTop: 4 }}>混排：中文留在 FONT_CJK，數字包最小節點，例「更新 <span style={{ fontFamily: FONT_DATA }}>14:05</span>」。</p>
          </Sub>
          <Sub title="品牌字標（刻意例外）" kind="doc">
            <div style={{ fontFamily: FONT_DATA, fontWeight: BRAND.weight, fontSize: BRAND.size, letterSpacing: BRAND.letterSpacing, color: isDark ? BRAND.dark : BRAND.light, lineHeight: "26px" }}>Mini Taiwan Pulse</div>
            <Kv rows={[["fontFamily", "FONT_DATA"], ["fontWeight", BRAND.weight], ["fontSize", `${BRAND.size}px`], ["letterSpacing", BRAND.letterSpacing], ["color", isDark ? BRAND.dark : BRAND.light]]} />
          </Sub>
        </>;
      }} />
    </Section>
  );
}

// ── §12 左側停靠版面 ──────────────────────────────────────
/** 版面示意用的文件值（不在 token 裡）：IconRailSidebar RAIL_WIDTH 56、工具列列底 58、popup 寬 280 */
const DOC_LAYOUT = { railWidth: 56, panelLeft: 64, toolbarBottom: 58, edge: 16, popupWidth: 280, panelWidth: 300 } as const;

export const LAYOUT_SECTION: SectionDef = { id: "left-dock", no: "12", title: "左側停靠版面" };
export function LeftDockSection() {
  const W = 1440;
  const H = 900;
  const scale = 0.5;
  const tlLeft = DOC_LAYOUT.railWidth + DOC_LAYOUT.edge;
  const label = (text: string, style: CSSProperties) => (
    <span className="ds-mono" style={{ position: "absolute", fontSize: 20, color: COLORS.textStrong, whiteSpace: "nowrap", ...style }}>{text}</span>
  );
  const box = (style: CSSProperties) => <div style={{ position: "absolute", boxSizing: "border-box", borderRadius: RADIUS.xl, ...style }} />;
  return (
    <Section def={LAYOUT_SECTION}>
      <Spec section="§5.1、§5.24、§5.26" impl={["src/styles/designTokens.ts（LAYOUT）", "src/components/timeline/TimelineShell.tsx", "src/App.tsx"]} />
      <p className="ds-note">1440×900 視窗縮 50%。紅字＝<code>LAYOUT</code> 真值；<code>TC3_*_WIDTH</code> 由 <code>TimelineShell.tsx</code> 匯入；rail 寬、工具列列底、popup 寬為文件值 <Tag kind="doc" />。</p>
      <div style={{ width: W * scale, height: H * scale, maxWidth: "100%", overflow: "hidden", borderRadius: RADIUS.lg, border: `1px solid ${BORDER.panel}` }}>
        <div style={{ position: "relative", width: W, height: H, transform: `scale(${scale})`, transformOrigin: "0 0", background: "#1b1c20" }}>
          {box({ left: 0, top: 0, bottom: 0, width: DOC_LAYOUT.railWidth, background: SURFACE.app, borderRadius: 0, borderRight: `1px solid ${BORDER.panel}` })}
          {label(`rail ${DOC_LAYOUT.railWidth}`, { left: 4, top: H / 2, transform: "rotate(-90deg)", transformOrigin: "0 0" })}
          {box({ left: DOC_LAYOUT.panelLeft, top: 0, height: DOC_LAYOUT.toolbarBottom, width: 360, border: `2px dashed ${BORDER.strong}`, borderRadius: 0 })}
          {label(`標題＋座標列 底 ${DOC_LAYOUT.toolbarBottom}`, { left: DOC_LAYOUT.panelLeft + 10, top: 14 })}
          {box({ left: DOC_LAYOUT.panelLeft, top: LAYOUT.leftDockTop, width: DOC_LAYOUT.panelWidth, height: 520, background: SURFACE.strong, border: `1px solid ${BORDER.panel}` })}
          {label(`左側面板 left ${DOC_LAYOUT.panelLeft} · top LAYOUT.leftDockTop = ${LAYOUT.leftDockTop}`, { left: DOC_LAYOUT.panelLeft + 14, top: LAYOUT.leftDockTop + 14, color: COLORS.statusErr })}
          <div style={{ position: "absolute", left: 0, right: 0, top: LAYOUT.leftDockTop, borderTop: `2px solid ${COLORS.statusErr}` }} />
          {box({ right: DOC_LAYOUT.edge, top: DOC_LAYOUT.edge, height: DOC_LAYOUT.toolbarBottom - DOC_LAYOUT.edge, width: 520, background: SURFACE.strong, border: `1px solid ${BORDER.panel}` })}
          {label("工具列（T2）", { right: 40, top: 26 })}
          {box({ left: tlLeft, bottom: LAYOUT.mapBottomInset, width: TC3_EXPANDED_WIDTH, height: 44, border: `2px dashed ${COLORS.accent}` })}
          {box({ left: tlLeft, bottom: LAYOUT.mapBottomInset, width: TC3_COLLAPSED_WIDTH, height: 36, background: SURFACE.strong, border: `1px solid ${BORDER.panel}`, borderRadius: RADIUS.pill })}
          {label(`時間軸 收合 ${TC3_COLLAPSED_WIDTH} ／ 展開 ${TC3_EXPANDED_WIDTH}（虛線）`, { left: tlLeft, bottom: LAYOUT.mapBottomInset + 56 })}
          {box({ right: DOC_LAYOUT.edge, bottom: LAYOUT.mapBottomInset, width: DOC_LAYOUT.popupWidth, height: 220, background: SURFACE.strong, border: "1px solid rgba(100,170,255,0.25)" })}
          {label(`右下停靠 popup ${DOC_LAYOUT.popupWidth}`, { right: DOC_LAYOUT.edge + 14, bottom: LAYOUT.mapBottomInset + 180 })}
          <div style={{ position: "absolute", left: 0, right: 0, bottom: LAYOUT.mapBottomInset, borderTop: `2px solid ${COLORS.statusErr}` }} />
          {label(`底邊對齊 LAYOUT.mapBottomInset = ${LAYOUT.mapBottomInset}`, { left: DOC_LAYOUT.panelLeft + 10, bottom: LAYOUT.mapBottomInset - 34, color: COLORS.statusErr })}
        </div>
      </div>
    </Section>
  );
}

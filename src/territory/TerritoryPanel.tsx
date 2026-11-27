/**
 * 「領土格」左側面板（rail 六角形入口）：三個標籤大按鈕＋依 tag 分組的屬性單選＋圖例＋透明度。
 * 外殼由 IconRailSidebar 提供（同資料來源面板）；這裡只有內容。
 */
import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { Siren, Coins, Store, Hexagon, ChevronRight, type LucideIcon } from "lucide-react";
import { PanelHeader } from "../components/sidebar/PanelHeader";
import { useRailTheme } from "../components/sidebar/railTheme";
import { Slider } from "../components/controls/Slider";
import {
  DARK_LEGEND, LIGHT_LEGEND, LegendFillOpacityCtx, LegendNote, LegendRow, LegendThemeCtx, LegendTitle, SwatchHatch, SwatchSquare, SwatchSteps,
} from "../components/legend/legendKit";
import { COLORS, CONTROL, FONT_CJK, FONT_SIZE, FONT_WEIGHT, LIGHT, RADIUS, SPACING } from "../styles/designTokens";
import { useLocale } from "../state/localeStore";
import { SCORE_TAGS, TAG_ORDER, useTerritoryText } from "./territoryText";
import {
  accentFor, availableAtRes, buildColorScale, isScoreKey, META_KEYS, resolveActiveAttr, colorsForBreaks, coverageText, displayUnit, gridBase, isFraction, ZERO_SPLIT_EPS,
  type TerritoryAttribute, type TerritoryRes,
} from "./territoryAttributes";
import { territoryStore, useTerritory } from "./territoryStore";
import { useTerritoryAttributes } from "./useTerritoryAttributes";
import "./territory.css";

const SCORE_ICONS: Record<string, LucideIcon> = { score_response: Siren, score_wealth: Coins, score_convenience: Store };

function controlPalette(isDark: boolean) {
  return isDark
    ? { bg: CONTROL.bg, bgHover: CONTROL.bgHover, border: CONTROL.border, text: COLORS.textDefault, strong: COLORS.textStrong, muted: COLORS.textMuted, dim: COLORS.textDim }
    : { bg: LIGHT.controlBg, bgHover: LIGHT.controlBgHover, border: LIGHT.controlBorder, text: LIGHT.textDefault, strong: LIGHT.textStrong, muted: LIGHT.textMuted, dim: LIGHT.textDim };
}

function SectionTitle({ title, hint, color, hintColor }: { title: string; hint: string; color: string; hintColor: string }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: SPACING.sm, padding: "10px 14px 6px" }}>
      <span style={{ fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold, letterSpacing: 1.5, color }}>{title}</span>
      <span style={{ fontSize: FONT_SIZE.xs, color: hintColor }}>{hint}</span>
    </div>
  );
}

export function TerritoryPanel({ isDark, onClose }: { isDark: boolean; onClose: () => void }) {
  const rail = useRailTheme();
  const c = controlPalette(isDark);
  const { activeKey, opacity, res, rankScope } = useTerritory();
  const attrs = useTerritoryAttributes(true);
  const T = useTerritoryText();

  const list = attrs.status === "ready" ? attrs.data.attributes : [];
  const byKey = useMemo(() => new Map(list.map((a) => [a.key, a] as const)), [list]);
  const groups = useMemo(() => {
    const m = new Map<string, TerritoryAttribute[]>();
    for (const a of list) {
      if (a.tag === "標籤" || a.key.startsWith("score_") || META_KEYS.has(a.key)) continue; // 三個標籤在上方大按鈕
      const arr = m.get(a.tag) ?? [];
      arr.push(a);
      m.set(a.tag, arr);
    }
    const order = [...TAG_ORDER, ...[...m.keys()].filter((k) => !(TAG_ORDER as readonly string[]).includes(k))];
    return order.filter((t) => m.has(t)).map((t) => ({ tag: t, items: m.get(t)! }));
  }, [list]);
  const active = useMemo(
    () => resolveActiveAttr(list, activeKey, rankScope, T.countySuffix, activeKey && isScoreKey(activeKey) ? T.scoreLabel(activeKey as (typeof SCORE_TAGS)[number]["key"]) : undefined),
    [list, activeKey, rankScope, T],
  );

  return (
    <div className="territory-panel" style={{ display: "flex", flexDirection: "column", minHeight: 0, flex: 1, fontFamily: FONT_CJK }}>
      <PanelHeader title={T.panelTitle} eyebrow={T.panelEyebrow} onClose={onClose} borderColor={rail.PANEL_BORDER} mutedColor={rail.DIM} textColor={rail.TEXT_STRONG} />
      <div className="layer-sidebar-scroll" style={{ flex: 1, overflowY: "auto", paddingBottom: SPACING.md }}>
        <div style={{ display: "flex", gap: SPACING.sm, padding: "10px 14px 0", fontSize: FONT_SIZE.sm, color: c.muted, lineHeight: 1.5 }}>
          <Hexagon size={14} style={{ flexShrink: 0, marginTop: 2 }} aria-hidden />
          <span>{T.intro}</span>
        </div>

        {attrs.status === "loading" && <div role="status" style={{ padding: "10px 14px", fontSize: FONT_SIZE.sm, color: c.dim }}>{T.loading}</div>}
        {attrs.status === "error" && <div role="alert" style={{ padding: "10px 14px", fontSize: FONT_SIZE.sm, color: isDark ? COLORS.statusErr : LIGHT.statusErr }}>{T.loadFailed}</div>}

        {/* ── 標籤：三顆大按鈕 ── */}
        <SectionTitle title={T.tagSection} hint={T.tagHint} color={rail.DIM} hintColor={c.dim} />
        {/* 排名方式：全台｜縣市內（只影響三個標籤分數） */}
        <div role="group" aria-label={T.rankScopeLabel} style={{ display: "flex", gap: SPACING.xs, padding: "0 14px 8px" }}>
          {(["nation", "county"] as const).map((s) => (
            <button key={s} type="button" className="territory-btn" aria-pressed={rankScope === s} onClick={() => territoryStore.setRankScope(s)}
              style={{ ...chipStyle(rankScope === s, c, isDark ? COLORS.accent : LIGHT.accent), flex: 1, justifyContent: "center", textAlign: "center" }}>
              {s === "nation" ? T.rankNation : T.rankCounty}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: SPACING.sm, padding: "0 14px" }}>
          {SCORE_TAGS.map((tag) => {
            const attr = byKey.get(tag.key);
            const on = activeKey === tag.key;
            const accent = accentFor({ key: tag.key, tag: "標籤" }, isDark);
            const Icon = SCORE_ICONS[tag.key] ?? Hexagon;
            return (
              <button
                key={tag.key}
                type="button"
                className="territory-btn"
                aria-pressed={on}
                disabled={attrs.status === "ready" && !attr}
                onClick={() => territoryStore.setActiveKey(on ? null : tag.key)}
                style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", textAlign: "left",
                  borderRadius: RADIUS.lg, cursor: "pointer", fontFamily: FONT_CJK,
                  border: `1px solid ${on ? accent : c.border}`,
                  background: on ? `color-mix(in srgb, ${accent} 16%, transparent)` : c.bg,
                  color: c.text,
                }}
              >
                <span aria-hidden style={{
                  width: 32, height: 32, borderRadius: RADIUS.full, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                  background: `color-mix(in srgb, ${accent} ${on ? 30 : 18}%, transparent)`, color: accent,
                }}>
                  <Icon size={17} />
                </span>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.bold, color: on ? c.strong : c.text }}>{T.scoreLabel(tag.key)}</span>
                  <span style={{ display: "block", fontSize: FONT_SIZE.sm, color: c.muted, marginTop: 1 }}>{T.scoreBlurb(tag.key, rankScope === "county")}</span>
                </span>
              </button>
            );
          })}
        </div>


        {/* ── 屬性：依 tag 分組單選 ── */}
        <SectionTitle title={T.attrSection} hint={T.attrHint} color={rail.DIM} hintColor={c.dim} />
        <div style={{ padding: "0 14px" }}>
          <button type="button" className="territory-btn" aria-pressed={activeKey === null} onClick={() => territoryStore.setActiveKey(null)}
            style={chipStyle(activeKey === null, c, isDark ? COLORS.accent : LIGHT.accent)}>
            {T.clearColor}
          </button>
        </div>
        {groups.map(({ tag, items }) => (
          <div key={tag} style={{ padding: "8px 14px 0" }}>
            <div style={{ fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.semibold, color: c.muted, marginBottom: 4 }}>{tag}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: SPACING.xs }}>
              {items.filter((a) => !isBizDiv(a)).map((a) => (
                <AttrChip key={a.key} attr={a} on={activeKey === a.key} res={res} c={c} isDark={isDark} />
              ))}
            </div>
            {items.some(isBizDiv) && (
              <BizDivList items={items.filter(isBizDiv)} activeKey={activeKey} res={res} c={c} isDark={isDark} />
            )}
          </div>
        ))}
      </div>
      {/* ── 圖例＋透明度：釘在面板底部，捲到屬性區也看得到 ── */}
      <div style={{ flexShrink: 0, borderTop: `1px solid ${rail.PANEL_BORDER}` }}>
      <LegendThemeCtx.Provider value={isDark ? DARK_LEGEND : LIGHT_LEGEND}>
        <div style={{ margin: "8px 14px 12px", padding: "10px 12px", borderRadius: RADIUS.lg, border: `1px solid ${c.border}`, background: c.bg }}>
          {active
            ? <LegendFillOpacityCtx.Provider value={opacity}><TerritoryLegend attr={active} isDark={isDark} res={res} /></LegendFillOpacityCtx.Provider>
            : <LegendRow swatch={<SwatchSquare color={gridBase(isDark).fill} opacity={0.5} />}>{T.legendGrayBase}</LegendRow>}
          {active && (
            <div style={{ display: "flex", alignItems: "center", gap: SPACING.md, marginTop: 10 }}>
              <span style={{ fontSize: FONT_SIZE.sm, color: c.muted, flexShrink: 0 }}>{T.opacity}</span>
              <Slider value={opacity} min={0.2} max={1} step={0.05} onChange={(v) => territoryStore.setOpacity(v)} ariaLabel={T.opacity} ariaValueText={`${Math.round(opacity * 100)}%`} style={{ flex: 1 }}
                {...(isDark ? {} : { trackColor: LIGHT.sliderTrack, fillColor: LIGHT.sliderFill, thumbColor: LIGHT.sliderThumb, accentColor: LIGHT.accent })} />
            </div>
          )}
        </div>
      </LegendThemeCtx.Provider>
      </div>
    </div>
  );
}

export const isBizDiv = (a: { key: string }) => a.key.startsWith("biz_div_");

function AttrChip({ attr: a, on, res, c, isDark }: { attr: TerritoryAttribute; on: boolean; res: TerritoryRes; c: ReturnType<typeof controlPalette>; isDark: boolean }) {
  const T = useTerritoryText();
  const cov = coverageText(a, T.allExcept);
  const here = availableAtRes(a, res);
  return (
    <button type="button" className="territory-btn" aria-pressed={on}
      title={[a.note, cov ? T.coverageOnly(cov) : null, here ? null : T.zoomOut].filter(Boolean).join("\n") || undefined}
      onClick={() => territoryStore.setActiveKey(on ? null : a.key)}
      style={{ ...chipStyle(on, c, accentFor(a, isDark), here ? "solid" : "dashed"), ...(here ? {} : { color: c.dim }) }}>
      {a.kind === "village_value" ? a.label.replace(/（村里值）$/, "") : a.label}
      {a.kind === "village_value" && <VillageBadge color={c.dim} />}
    </button>
  );
}

/** 19 個產業大類家數：預設收合成一個子清單，不攤平 */
function BizDivList({ items, activeKey, res, c, isDark }: { items: TerritoryAttribute[]; activeKey: string | null; res: TerritoryRes; c: ReturnType<typeof controlPalette>; isDark: boolean }) {
  const T = useTerritoryText();
  const hasActive = items.some((a) => a.key === activeKey);
  const [open, setOpen] = useState(hasActive);
  const shown = open || hasActive;
  return (
    <div style={{ marginTop: SPACING.xs }}>
      <button type="button" className="territory-btn" aria-expanded={shown} onClick={() => setOpen((v) => !v)}
        style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 0", border: "none", background: "transparent", color: c.muted, cursor: "pointer", fontFamily: FONT_CJK, fontSize: FONT_SIZE.sm }}>
        <ChevronRight size={12} style={{ transform: shown ? "rotate(90deg)" : undefined, transition: "transform 0.15s" }} aria-hidden />
        {T.bizGroup(items.length)}
      </button>
      {shown && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: SPACING.xs, paddingLeft: 16, marginTop: 2 }}>
          {items.map((a) => <AttrChip key={a.key} attr={{ ...a, label: a.label.replace(/家數$/, "") }} on={activeKey === a.key} res={res} c={c} isDark={isDark} />)}
        </div>
      )}
    </div>
  );
}

function chipStyle(on: boolean, c: ReturnType<typeof controlPalette>, accent: string, borderStyle: "solid" | "dashed" = "solid"): CSSProperties {
  return {
    display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 8px", borderRadius: RADIUS.md, cursor: "pointer",
    fontFamily: FONT_CJK, fontSize: FONT_SIZE.base, fontWeight: on ? FONT_WEIGHT.semibold : FONT_WEIGHT.regular,
    border: `1px ${borderStyle} ${on ? accent : c.border}`,
    background: on ? `color-mix(in srgb, ${accent} 18%, transparent)` : c.bg,
    color: on ? c.strong : c.text,
  };
}

export function VillageBadge({ color }: { color: string }) {
  const T = useTerritoryText();
  return <span style={{ fontSize: FONT_SIZE.xs, color, border: `1px solid currentColor`, borderRadius: RADIUS.sm, padding: "0 3px", lineHeight: 1.4 }}>{T.villageValue}</span>;
}

function TerritoryLegend({ attr, isDark, res }: { attr: TerritoryAttribute; isDark: boolean; res: TerritoryRes }) {
  const { formatNumber } = useLocale();
  const T = useTerritoryText();
  const scale = useMemo(() => buildColorScale(attr, isDark), [attr, isDark]);
  const cov = coverageText(attr, T.allExcept);
  const fraction = isFraction(attr);
  const unit = displayUnit(attr);
  const fmt = (v: number): string => {
    if (v === ZERO_SPLIT_EPS) return ">0";
    if (fraction) return `${formatNumber(v * 100, { maximumFractionDigits: 0 })}%`;
    if (unit === "公尺" && Math.abs(v) >= 1000) return `${formatNumber(v / 1000, { maximumFractionDigits: 1 })}k`;
    const abs = Math.abs(v);
    return formatNumber(v, { maximumFractionDigits: abs >= 100 ? 0 : abs >= 10 ? 1 : 2 });
  };
  let body: ReactNode;
  if (scale.type === "categories") {
    body = (
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {scale.entries.map((e) => <LegendRow key={e.value} swatch={<SwatchSquare color={e.color} />}>{e.label}</LegendRow>)}
        <LegendRow swatch={<SwatchSquare color={scale.otherColor} />}>{T.legendOther}</LegendRow>
      </div>
    );
  } else {
    const breaks = scale.breaksByRes[res];
    const stats = attr.stats?.[String(res)];
    const linear = attr.kind === "ratio" || attr.kind === "score";
    if (!availableAtRes(attr, res) || (!linear && !stats)) {
      body = <LegendNote>{T.legendNoStatsAtRes}</LegendNote>;
    } else if (!breaks || breaks.length === 0) {
      body = <LegendNote>{T.legendNoBreaks}</LegendNote>;
    } else {
      const lo = attr.kind === "ratio" ? 0 : attr.kind === "score" ? 0 : stats?.min;
      const hi = attr.kind === "ratio" ? 1 : attr.kind === "score" ? 100 : stats?.max;
      const ends = lo !== undefined && hi !== undefined;
      const labels = ends ? [lo, ...breaks, hi].map(fmt) : breaks.map(fmt);
      body = (
        <>
          <SwatchSteps colors={colorsForBreaks(scale.colors, breaks.length)} breaks={labels} />
          <LegendNote style={{ marginTop: 3 }}>
            {attr.kind === "score" ? T.legendScore
              : scale.zeroSplitRes.includes(res) ? T.legendZeroSplit
              : attr.kind === "distance" ? T.legendLowHighDistance : T.legendLowHigh}
          </LegendNote>
        </>
      );
    }
  }
  return (
    <>
      <LegendTitle zh={<>{attr.label}{unit ? <span style={{ fontWeight: FONT_WEIGHT.regular }}>（{unit === "公尺" ? T.legendMeters : unit}）</span> : null}</>} />
      {body}
      <div style={{ marginTop: 6 }}>
        <LegendRow swatch={<SwatchHatch />}>{T.uncovered}</LegendRow>
      </div>
      <LegendNote>
        {T.resNote(T.resLabel(res) ?? "")}
        {cov ? `；${T.coverageOnly(cov)}` : ""}
        {attr.kind === "village_value" ? `；${T.villageValueNote}` : ""}
      </LegendNote>
    </>
  );
}

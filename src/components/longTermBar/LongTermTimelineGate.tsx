// 一次一條時間軸（STANDARD.md §2 第 3 條）：以最後打開的長期或即時圖層為準，另一條縮成上方的 chip。
// 即時時間軸本身（LiveTimelineControls／timeStore）不改，只是被包起來切換顯示。
// 只用在桌機即時模式；歷史模式照舊顯示 HistoricalTimeline，手機與 embed 不顯示時間條。
import { useEffect, useState, type ReactNode } from "react";
import { BORDER, COLORS, CONTROL, ELEVATION, FONT_CJK, FONT_SIZE, LAYOUT, LIGHT, RADIUS, SPACING, SURFACE, Z_INDEX } from "../../styles/designTokens";
import { useLayerVisibilityAll } from "../../state/layerVisibilityStore";
import { useLocale } from "../../state/localeStore";
import { LIVE_TIMELINE_KEYS, LONG_TERM_BAR_KEYS } from "../../data/longTermLayers";
import { longTermBarStore, useLongTermBarState } from "../../state/longTermBarStore";
import { LongTermBar } from "./LongTermBar";
import { layerDisplayName } from "./longTermText";
import { LONG_TERM_BAR_RESERVE_VAR } from "./longTermBarLayout";

const BAR_W = 600;
/** 與 TimelineShell 的 RIGHT_RESERVE 同值：右下停靠區 */
const RIGHT_RESERVE = 312;

function Chip({ label, active, onClick, isDark }: { label: string; active: boolean; onClick: () => void; isDark: boolean }) {
  return (
    <button type="button" aria-pressed={active} onClick={onClick}
      style={{
        font: "inherit", fontFamily: FONT_CJK, fontSize: FONT_SIZE.base, cursor: "pointer", whiteSpace: "nowrap",
        padding: "3px 10px", borderRadius: RADIUS.pill,
        color: active ? (isDark ? COLORS.textStrong : LIGHT.textStrong) : (isDark ? COLORS.textMuted : LIGHT.textMuted),
        background: active ? (isDark ? COLORS.accentFaint : LIGHT.accentFaint) : (isDark ? SURFACE.strong : LIGHT.surfaceStrong),
        border: `1px solid ${active ? (isDark ? BORDER.accent : LIGHT.accent) : (isDark ? CONTROL.border : LIGHT.controlBorder)}`,
        boxShadow: isDark ? ELEVATION.sm : undefined,
      }}>
      {label}
    </button>
  );
}

/** 量即時時間軸（TimelineShell 根節點）尺寸：收合／展開高度不同，chip 要貼著它的頂邊 */
function useLiveTimelineHeight(enabled: boolean): number {
  const [h, setH] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let ro: ResizeObserver | null = null;
    let tries = 0;
    let retry = 0;
    const attach = () => {
      const el = document.querySelector<HTMLElement>('[data-viewport-occluder="timeline"]');
      if (!el) { if (tries++ < 20) retry = window.setTimeout(attach, 200); return; }
      const read = () => setH(el.offsetHeight);
      ro = new ResizeObserver(read);
      ro.observe(el);
      read();
    };
    attach();
    return () => { window.clearTimeout(retry); ro?.disconnect(); };
  }, [enabled]);
  return h;
}

function useBarReserve(el: HTMLElement | null) {
  useEffect(() => {
    const root = document.documentElement;
    if (!el) { root.style.setProperty(LONG_TERM_BAR_RESERVE_VAR, "0px"); return; }
    const write = () => root.style.setProperty(LONG_TERM_BAR_RESERVE_VAR, `${LAYOUT.mapBottomInset + el.offsetHeight + SPACING.lg}px`);
    const ro = new ResizeObserver(write);
    ro.observe(el);
    write();
    return () => { ro.disconnect(); root.style.setProperty(LONG_TERM_BAR_RESERVE_VAR, "0px"); };
  }, [el]);
}

export function LongTermTimelineGate({ isDark, leftOffset, children }: { isDark: boolean; leftOffset: number; children: ReactNode }) {
  const vis = useLayerVisibilityAll() as unknown as Record<string, boolean>;
  const st = useLongTermBarState();
  const i18n = useLocale();
  const { t } = i18n;

  const order = (k: string) => st.openedAt[k] ?? 0;
  const byRecent = (x: string, y: string) => order(y) - order(x);
  const barKey = LONG_TERM_BAR_KEYS.filter((k) => vis[k]).sort(byRecent)[0] ?? null;
  const liveKey = LIVE_TIMELINE_KEYS.filter((k) => vis[k]).sort(byRecent)[0] ?? null;
  const showBar = !!barKey && (st.pinned ? st.pinned === "longTerm" : order(barKey) > (liveKey ? order(liveKey) : 0));
  // 長期圖層開著時，只要還有其他圖層開著，就給「即時時間軸」chip（其他圖層仍依即時時間軸運作）
  const othersOn = !!barKey && Object.entries(vis).some(([k, on]) => on && !LONG_TERM_BAR_KEYS.includes(k as never));
  const showChips = !!barKey && othersOn;
  const liveLabel = liveKey ? t("longTerm.chip.live", { layer: layerDisplayName(liveKey, i18n) }) : t("longTerm.chip.liveGeneric");
  const liveH = useLiveTimelineHeight(!showBar);
  const [barEl, setBarEl] = useState<HTMLDivElement | null>(null);
  useBarReserve(showBar ? barEl : null);

  useEffect(() => {
    if (!showBar && st.playing) longTermBarStore.pause();
  }, [showBar, st.playing]);

  const chips = showChips && barKey ? (
    <div style={{ display: "flex", gap: SPACING.sm, alignItems: "center", flexWrap: "wrap" }}>
      <Chip isDark={isDark} label={t("longTerm.chip.bar", { layer: layerDisplayName(barKey, i18n) })} active={showBar} onClick={() => longTermBarStore.pin("longTerm")} />
      <Chip isDark={isDark} label={liveLabel} active={!showBar} onClick={() => longTermBarStore.pin("live")} />
    </div>
  ) : null;

  return (
    <>
      <div style={{ display: showBar ? "none" : "contents" }}>{children}</div>
      {!showBar && chips && (
        <div style={{ position: "absolute", left: leftOffset, bottom: LAYOUT.mapBottomInset + liveH + SPACING.sm, zIndex: Z_INDEX.mapOverlay }}>
          {chips}
        </div>
      )}
      {showBar && barKey && (
        <div ref={setBarEl} data-viewport-occluder="longterm-bar" style={{
          position: "absolute", left: leftOffset, bottom: LAYOUT.mapBottomInset, zIndex: Z_INDEX.mapOverlay,
          width: BAR_W, maxWidth: `calc(100vw - ${leftOffset + RIGHT_RESERVE}px)`,
          display: "flex", flexDirection: "column", gap: SPACING.sm,
        }}>
          {chips}
          <div onWheel={(e) => e.stopPropagation()} style={{
            boxSizing: "border-box", padding: `${SPACING.sm}px ${SPACING.lg}px ${SPACING.md}px`,
            background: isDark ? SURFACE.strong : LIGHT.surfaceStrong,
            border: `1px solid ${isDark ? BORDER.panel : LIGHT.border}`, borderRadius: RADIUS.xl,
            boxShadow: isDark ? ELEVATION.lg : LIGHT.elevationLg,
          }}>
            <LongTermBar layerKey={barKey} isDark={isDark} />
          </div>
        </div>
      )}
    </>
  );
}

// 一次一條時間軸（STANDARD.md §2 第 3 條）：以最後打開的長期或即時圖層為準，另一條縮成上方的 chip。
// 即時時間軸本身（LiveTimelineControls／timeStore）不改，只是被包起來切換顯示。
// 只用在桌機即時模式；歷史模式照舊顯示 HistoricalTimeline，手機與 embed 不顯示時間條。
import { useEffect, useState, type ReactNode } from "react";
import { BORDER, COLORS, CONTROL, ELEVATION, FONT_CJK, FONT_SIZE, LAYOUT, LIGHT, RADIUS, SPACING, SURFACE, Z_INDEX } from "../../styles/designTokens";
import { useLayerVisibilityAll } from "../../state/layerVisibilityStore";
import { useLocale } from "../../state/localeStore";
import { longTermBarStore, setLongTermTrackingPaused, useLongTermBarState } from "../../state/longTermBarStore";
import { LongTermBar } from "./LongTermBar";
import { layerDisplayName } from "./longTermText";
import { resolveLongTermView } from "./longTermView";
import "./longTermBar.css";
import { LONG_TERM_BAR_RESERVE_VAR } from "./longTermBarLayout";

const BAR_W = 600;
/** 與 TimelineShell 的 RIGHT_RESERVE 同值：右下停靠區 */
const RIGHT_RESERVE = 312;

function Chip({ label, active, onClick, isDark }: { label: string; active: boolean; onClick: () => void; isDark: boolean }) {
  return (
    <button type="button" className="ltb-focus" aria-pressed={active} onClick={onClick}
      style={{
        font: "inherit", fontFamily: FONT_CJK, fontSize: FONT_SIZE.base, cursor: "pointer", whiteSpace: "nowrap",
        padding: "3px 10px", borderRadius: RADIUS.pill,
        color: active ? (isDark ? COLORS.textStrong : LIGHT.textStrong) : (isDark ? COLORS.textMuted : LIGHT.textMuted),
        background: active ? (isDark ? COLORS.accentFaint : LIGHT.accentFaint) : (isDark ? SURFACE.strong : LIGHT.surfaceStrong),
        border: `1px solid ${active ? (isDark ? BORDER.accent : LIGHT.accent) : (isDark ? CONTROL.border : LIGHT.controlBorder)}`,
        boxShadow: isDark ? ELEVATION.sm : undefined,
        ["--ltb-accent" as string]: isDark ? COLORS.accent : LIGHT.accent,
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

/**
 * rightReserve：右側要讓出的寬度（CSS 長度）。預設＝右下停靠區；監看模式分割版面時由 App 傳入
 * 「dock＋導航柱＋停靠區」，避免時間條蓋到被推到 dock 左邊的圖例與比例尺。
 */
export function LongTermTimelineGate({ isDark, leftOffset, rightReserve = `${RIGHT_RESERVE}px`, children }: { isDark: boolean; leftOffset: number; rightReserve?: string; children: ReactNode }) {
  const vis = useLayerVisibilityAll() as unknown as Record<string, boolean>;
  const st = useLongTermBarState();
  const i18n = useLocale();
  const { t } = i18n;

  const { barKey, liveKey, showBar, showChips } = resolveLongTermView(vis, st);
  const liveLabel = liveKey ? t("longTerm.chip.live", { layer: layerDisplayName(liveKey, i18n) }) : t("longTerm.chip.liveGeneric");
  const liveH = useLiveTimelineHeight(!showBar);
  const [barEl, setBarEl] = useState<HTMLDivElement | null>(null);
  useBarReserve(showBar ? barEl : null);

  // 本元件只在桌機即時模式掛著：卸載（進歷史模式、切到手機版）時暫停「最後打開」追蹤與播放，回來再恢復追蹤
  useEffect(() => {
    setLongTermTrackingPaused(false);
    return () => {
      setLongTermTrackingPaused(true);
      // 時間條看不到時不在背景繼續播放
      longTermBarStore.pause();
    };
  }, []);

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
          width: BAR_W, maxWidth: `calc(100vw - ${leftOffset}px - ${rightReserve})`,
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

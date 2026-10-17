/**
 * §6 左下時間軸 TC3：真 TimelineControls，收合／展開／「尚無資料」三種狀態。
 *
 * 展開與否是元件內部的 hover 狀態機（timelineExpand.ts）。參考頁不改元件，而是對根節點送一個
 * 合成的 mouse pointerover（React 由 over/out 合成 onPointerEnter），並在被真的滑鼠移出而收合時再送一次。
 */
import { useEffect, useRef, useState } from "react";
import { COLORS, FONT_SIZE, LAYOUT, LIGHT, RADIUS, Z_INDEX } from "../../styles/designTokens";
import { TimelineControls } from "../../components/TimelineControls";
import { TC3_COLLAPSED_WIDTH, TC3_EXPANDED_WIDTH } from "../../components/timeline/TimelineShell";
import { COLLAPSE_DELAY_MS } from "../../components/timeline/timelineExpand";
import { Kv, Pair, Section, Spec, Sub, mockMapBg, type SectionDef } from "../kit";

type Variant = "collapsed" | "expanded" | "future";

const HOUR = 3600;
/** 台北時間當天 00:00（UTC+8，無日光節約） */
function taipeiDayStart(nowSec: number): number {
  return Math.floor((nowSec + 8 * HOUR) / 86400) * 86400 - 8 * HOUR;
}

function holdExpanded(frame: HTMLElement | null): () => void {
  const root = frame?.querySelector<HTMLElement>(".tl3");
  if (!root) return () => undefined;
  const poke = () => root.dispatchEvent(new PointerEvent("pointerover", { bubbles: true, pointerType: "mouse" }));
  poke();
  const obs = new MutationObserver(() => { if (root.classList.contains("tl3--collapsed")) poke(); });
  obs.observe(root, { attributes: true, attributeFilter: ["class"] });
  return () => obs.disconnect();
}

function TimelineFrame({ isDark, variant }: { isDark: boolean; variant: Variant }) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [nowSec] = useState(() => Math.floor(Date.now() / 1000));
  const windowStart = taipeiDayStart(nowSec);
  const windowEnd = windowStart + 86400;
  // 「尚無資料」：回放游標在「現在」之後（isFuture 以 Date.now() 判斷）
  const initial = variant === "future" ? Math.min(windowEnd - 60, nowSec + 2 * HOUR) : Math.max(windowStart, nowSec - 2 * HOUR);
  const [currentTime, setCurrentTime] = useState(initial);
  const [speed, setSpeed] = useState(60);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (variant === "collapsed") return;
    return holdExpanded(frameRef.current);
  }, [variant]);

  return (
    <div ref={frameRef} className="ds-frame" style={{ height: LAYOUT.mapBottomInset + 44 + 60, background: mockMapBg(isDark), minWidth: TC3_EXPANDED_WIDTH + 40 }}>
      <TimelineControls
        playing={playing}
        speed={speed}
        progress={(currentTime - windowStart) / (windowEnd - windowStart)}
        currentTime={currentTime}
        timeMode={variant === "future" ? "replay" : "live"}
        selectedDate={new Date(windowStart * 1000)}
        rangeDays={1}
        windowStart={windowStart}
        windowEnd={windowEnd}
        isDarkTheme={isDark}
        leftOffset={16}
        onToggle={() => setPlaying((p) => !p)}
        onSpeedChange={setSpeed}
        onSeekByProgress={(p) => setCurrentTime(Math.round(windowStart + p * (windowEnd - windowStart)))}
        onJumpToTime={(t) => setCurrentTime(t)}
        onTimeModeChange={() => undefined}
        onDateChange={() => undefined}
        onShiftDate={() => undefined}
        onRangeDaysChange={() => undefined}
      />
      <div style={{ position: "absolute", left: 0, right: 0, bottom: LAYOUT.mapBottomInset, borderTop: `1px dashed ${COLORS.statusErr}` }} />
      <span className="ds-mono" style={{ position: "absolute", right: 8, bottom: LAYOUT.mapBottomInset - 16, fontSize: FONT_SIZE.xs, color: COLORS.statusErr }}>
        bottom = LAYOUT.mapBottomInset {LAYOUT.mapBottomInset}
      </span>
    </div>
  );
}

const VARIANTS: readonly { v: Variant; title: string }[] = [
  { v: "collapsed", title: "收合（預設膠囊）" },
  { v: "expanded", title: "展開（TC1 單列，即時）" },
  { v: "future", title: "展開＋尚無資料（回放游標在現在之後）" },
];

export const TIMELINE_SECTION: SectionDef = { id: "timeline", no: "6", title: "時間軸 TC3" };
export function TimelineSection() {
  return (
    <Section def={TIMELINE_SECTION}>
      <Spec section="§5.24" impl={["src/components/TimelineControls.tsx", "src/components/timeline/{TimelineShell.tsx,TimeAxis.tsx,timelineExpand.ts,timeline.css}"]} />
      <p className="ds-note">
        真 <code>TimelineControls</code>。展開態由參考頁送合成 hover 撐住（元件未改）；滑鼠移過會照常運作。
        「尚無資料」小標籤浮在卡片上方、中線對齊時間的冒號（掛在 <code>.tl3-colon</code> 上絕對定位）。框底色為地圖替身色。
      </p>
      {VARIANTS.map(({ v, title }) => (
        <Sub key={v} title={title} kind="real">
          <Pair stack render={(isDark) => <TimelineFrame isDark={isDark} variant={v} />} />
        </Sub>
      ))}
      <Pair bg="page" render={(isDark) => (
        <Kv rows={[
          ["收合寬 TC3_COLLAPSED_WIDTH", `${TC3_COLLAPSED_WIDTH}px`],
          ["展開寬 TC3_EXPANDED_WIDTH", `${TC3_EXPANDED_WIDTH}px`],
          ["底邊 LAYOUT.mapBottomInset", `${LAYOUT.mapBottomInset}px`],
          ["層級 Z_INDEX.mapOverlay", Z_INDEX.mapOverlay],
          ["收合延遲 COLLAPSE_DELAY_MS", `${COLLAPSE_DELAY_MS}ms`],
          ["收合圓角", `RADIUS.pill = ${RADIUS.pill}`],
          ["展開圓角", `RADIUS.xl = ${RADIUS.xl}px`],
          ["尚無資料字色", isDark ? `COLORS.statusWarn = ${COLORS.statusWarn}` : `LIGHT.statusWarn = ${LIGHT.statusWarn}`],
        ]} />
      )} />
    </Section>
  );
}

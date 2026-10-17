import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  expandReducer,
  INITIAL_EXPAND_STATE,
  isExpanded,
  type ExpandEvent,
  type ExpandState,
} from "../timelineExpand";
import { TimelineControls } from "../../TimelineControls";
import { HistoricalTimeline } from "../../HistoricalTimeline";
import { LAYOUT } from "../../../styles/designTokens";

const run = (events: ExpandEvent[], from: ExpandState = INITIAL_EXPAND_STATE) => events.reduce(expandReducer, from);

describe("TC3 展開／收合狀態機", () => {
  it("預設收合", () => {
    expect(INITIAL_EXPAND_STATE.phase).toBe("collapsed");
    expect(isExpanded(INITIAL_EXPAND_STATE)).toBe(false);
  });

  it("滑鼠移入 → 展開；移出 → 倒數（仍展開）；timeout → 收合", () => {
    const entered = run([{ type: "pointerEnter" }]);
    expect(entered.phase).toBe("expanded");
    const left = expandReducer(entered, { type: "pointerLeave" });
    expect(left.phase).toBe("closing");
    expect(isExpanded(left)).toBe(true);
    expect(expandReducer(left, { type: "timeout" }).phase).toBe("collapsed");
  });

  it("倒數期間移回來 → 取消收合，舊 timeout 不作用", () => {
    const back = run([{ type: "pointerEnter" }, { type: "pointerLeave" }, { type: "pointerEnter" }]);
    expect(back.phase).toBe("expanded");
    expect(expandReducer(back, { type: "timeout" }).phase).toBe("expanded");
  });

  it("鍵盤 focus 進入 → 展開；滑鼠移出但 focus 還在 → 不收", () => {
    const s = run([{ type: "focusIn" }, { type: "pointerEnter" }, { type: "pointerLeave" }]);
    expect(s.phase).toBe("expanded");
    const out = expandReducer(s, { type: "focusOut" });
    expect(out.phase).toBe("closing");
    expect(expandReducer(out, { type: "timeout" }).phase).toBe("collapsed");
  });

  it("拖曳刻度軸中移出卡片 → 不收；放開後才開始倒數", () => {
    const dragging = run([{ type: "pointerEnter" }, { type: "dragStart" }, { type: "pointerLeave" }]);
    expect(dragging.phase).toBe("expanded");
    expect(expandReducer(dragging, { type: "timeout" }).phase).toBe("expanded");
    const released = expandReducer(dragging, { type: "dragEnd" });
    expect(released.phase).toBe("closing");
  });

  it("收合時直接在細進度軸上拖曳 → 展開", () => {
    expect(run([{ type: "dragStart" }]).phase).toBe("expanded");
  });

  it("日期面板開著 → 移出也不收；關掉面板後才倒數", () => {
    const open = run([{ type: "pointerEnter" }, { type: "popup", open: true }, { type: "pointerLeave" }]);
    expect(open.phase).toBe("expanded");
    expect(expandReducer(open, { type: "timeout" }).phase).toBe("expanded");
    const closed = expandReducer(open, { type: "popup", open: false });
    expect(closed.phase).toBe("closing");
    expect(expandReducer(closed, { type: "timeout" }).phase).toBe("collapsed");
  });

  it("點膠囊（觸控，無 hover）→ 展開後倒數收合", () => {
    const tapped = run([{ type: "activate" }]);
    expect(isExpanded(tapped)).toBe(true);
    expect(tapped.phase).toBe("closing");
    expect(expandReducer(tapped, { type: "timeout" }).phase).toBe("collapsed");
  });

  it("收合狀態下的 timeout 不改狀態", () => {
    expect(expandReducer(INITIAL_EXPAND_STATE, { type: "timeout" })).toBe(INITIAL_EXPAND_STATE);
  });
});

const liveProps = {
  playing: false,
  speed: 60,
  progress: 0.4,
  currentTime: Date.UTC(2026, 8, 28, 1, 16) / 1000,
  timeMode: "replay" as const,
  selectedDate: new Date(Date.UTC(2026, 8, 27, 16)),
  rangeDays: 1,
  windowStart: Date.UTC(2026, 8, 27, 16) / 1000,
  windowEnd: Date.UTC(2026, 8, 28, 16) / 1000,
  onToggle: () => {},
  onSpeedChange: () => {},
  onSeekByProgress: () => {},
  onJumpToTime: () => {},
  onTimeModeChange: () => {},
  onDateChange: () => {},
  onShiftDate: () => {},
  onRangeDaysChange: () => {},
};

describe("TC3 時間軸渲染", () => {
  it("桌機預設收合：膠囊、細進度軸無刻度標籤、無倍速／日期膠囊，底邊用共用常數", () => {
    const html = renderToStaticMarkup(createElement(TimelineControls, liveProps));
    expect(html).toContain("tl3--collapsed");
    expect(html).toContain("tl3-axis--compact");
    expect(html).not.toContain("tl3-axis__lbl");
    expect(html).not.toContain("播放倍速");
    expect(html).toContain(`bottom:${LAYOUT.mapBottomInset}px`);
    expect(html).toContain('data-viewport-occluder="timeline"');
    expect(html).toContain('role="slider"');
    expect(html).toContain('tabindex="0"');
  });

  it("手機固定展開：刻度標籤、倍速與日期膠囊都在", () => {
    const html = renderToStaticMarkup(createElement(TimelineControls, { ...liveProps, isMobile: true }));
    expect(html).toContain("tl3--expanded");
    expect(html).toContain("tl3-axis__lbl");
    expect(html).toContain("播放倍速");
    expect(html).toContain("9/28");
    expect(html).toContain("tl3-chip");
  });

  it("歷史模式：保留 data-testid（viewportFit 遮擋判斷），手機展開時膠囊顯示民國年月", () => {
    const html = renderToStaticMarkup(createElement(HistoricalTimeline, {
      year: 115, month: 9, day: 27, availableYears: [113, 114, 115], playing: false, speed: 1,
      granularity: "month", isMobile: true,
      onTogglePlay: () => {}, onSpeedChange: () => {}, onYearChange: () => {}, onMonthChange: () => {},
      onDayChange: () => {}, onGranularityChange: () => {},
    }));
    expect(html).toContain('data-testid="historical-timeline"');
    expect(html).toContain("民國 <span class=\"mono\">115</span> 年");
    expect(html).toContain("<span class=\"mono\">9</span> 月");
  });
});

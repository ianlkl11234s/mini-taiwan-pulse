import { Pause, Play } from "lucide-react";
import { DAY, RE_PERIODS, type ReGran } from "../lib/realEstateTime";
import { TimeAxis } from "./timeline/TimeAxis";
import {
  buildDiscreteAxis,
  buildQuarterTicks,
  indexToRatio,
  keyboardIndexTarget,
  range,
  ratioToIndex,
} from "./timeline/timelineAxis";
import "./timeline/timeline.css";
import { Z_INDEX } from "../styles/designTokens";

export type HistoricalGranularity = "year" | "month" | "day";

interface Props {
  year: number;
  month: number; // 1~12
  day: number;   // 1~31
  availableYears: number[]; // 民國年，遞增
  playing: boolean;
  speed: number;
  granularity: HistoricalGranularity;
  isDarkTheme?: boolean;
  isMobile?: boolean;
  leftOffset?: number;
  onTogglePlay: () => void;
  /** 共機活動區是否開著（決定資料範圍提示） */
  plaActive?: boolean;
  /** 全球事件是否開著（依已發布 immutable versions 回放）。 */
  globalEventsActive?: boolean;
  onSpeedChange: (s: number) => void;
  onYearChange: (y: number) => void;
  onMonthChange: (m: number) => void;
  onDayChange: (d: number) => void;
  onGranularityChange: (g: HistoricalGranularity) => void;
  // 房地產時間軸（reActive 時取代火災年/月/日 UI，改顯示 季/月/週 + 連續日期游標）
  reActive?: boolean;
  reGran?: ReGran;
  onReGranChange?: (g: ReGran) => void;
  reCursorTs?: number;
  reCursorMin?: number;
  reCursorMax?: number;
  reCursorStep?: number;
  reCursorLabel?: string;
  onReCursorChange?: (ts: number) => void;
}

const ROC_OFFSET = 1911;
const SPEEDS = [0.5, 1, 2, 4, 8];
/** 卡片右側預留給右下停靠 popup（280px）＋間距 */
const RIGHT_RESERVE = 312;

const granLabel: Record<HistoricalGranularity, string> = {
  year: "年",
  month: "月",
  day: "日",
};
const reGranLabel: Record<ReGran, string> = { quarter: "季", month: "月", week: "週" };
/** 房地產游標的鍵盤步長（秒）；季由 App 端 snapQuarterStart 吸附 */
const RE_KEY_STEP: Record<ReGran, number> = { quarter: 92 * DAY, month: 30 * DAY, week: 7 * DAY };

function daysInMonth(rocYear: number, month: number): number {
  // 用 AD Date 末日 trick：new Date(year, month, 0) 回傳上個月最後一天
  return new Date(rocYear + ROC_OFFSET, month, 0).getDate();
}

const pad2 = (n: number) => String(n).padStart(2, "0");

function formatClock(year: number, month: number, day: number, granularity: HistoricalGranularity): string {
  if (granularity === "year") return String(year);
  if (granularity === "month") return `${year}/${pad2(month)}`;
  return `${year}/${pad2(month)}/${pad2(day)}`;
}

function formatValueText(year: number, month: number, day: number, granularity: HistoricalGranularity): string {
  if (granularity === "year") return `民國 ${year} 年（${year + ROC_OFFSET}）`;
  if (granularity === "month") return `民國 ${year} 年 ${month} 月`;
  return `民國 ${year} 年 ${month} 月 ${day} 日`;
}

export function HistoricalTimeline({
  year,
  month,
  day,
  availableYears,
  playing,
  speed,
  granularity,
  isDarkTheme = true,
  isMobile = false,
  leftOffset = 16,
  onTogglePlay,
  plaActive = false,
  globalEventsActive = false,
  onSpeedChange,
  onYearChange,
  onMonthChange,
  onDayChange,
  onGranularityChange,
  reActive = false,
  reGran = "quarter",
  onReGranChange,
  reCursorTs = 0,
  reCursorMin = 0,
  reCursorMax = 0,
  reCursorStep = 1,
  reCursorLabel = "",
  onReCursorChange,
}: Props) {
  const years = availableYears.length > 0 ? availableYears : range(104, 113);
  const dim = daysInMonth(year, month);
  const showMonth = granularity === "month" || granularity === "day";
  const showDay = granularity === "day";
  // 提示該模式下「現在開著的圖層」實際有資料的區間，避免使用者在空年份亂撥
  const dataNote = reActive
    ? "房地產：2024Q3~2026Q1"
    : globalEventsActive
      ? "全球重要事件：依已發布版本回放"
      : plaActive
      ? "共機活動區：115/01~115/07"
      : "火災資料：111~113";
  const playStepLabel = reActive ? reGranLabel[reGran] : granLabel[granularity];

  const rootClass = [
    "tl3",
    isDarkTheme ? "" : "tl3--light",
    isMobile ? "tl3--mobile" : "",
  ].filter(Boolean).join(" ");

  const rootStyle: React.CSSProperties = isMobile
    ? {}
    : {
        position: "absolute",
        bottom: 16,
        left: leftOffset,
        // 時間軸屬地圖控制列，刻意維持 mapOverlay（10），在浮動面板（20）之下
        zIndex: Z_INDEX.mapOverlay,
        width: 620,
        maxWidth: `calc(100vw - ${leftOffset + RIGHT_RESERVE}px)`,
        minWidth: 320,
        transition: "left 0.2s ease",
      };

  // ── 下排刻度軸 ──
  let axis: React.ReactNode;
  if (reActive) {
    const span = reCursorMax - reCursorMin;
    const ts = Math.min(Math.max(reCursorTs, reCursorMin), reCursorMax);
    const seek = (next: number) => {
      const clamped = Math.min(Math.max(next, reCursorMin), reCursorMax);
      const step = reCursorStep > 0 ? reCursorStep : 1;
      onReCursorChange?.(reCursorMin + Math.round((clamped - reCursorMin) / step) * step);
    };
    axis = (
      <TimeAxis
        ratio={span > 0 ? (ts - reCursorMin) / span : 0}
        ticks={buildQuarterTicks(RE_PERIODS, reCursorMin, reCursorMax)}
        needleLabel={reCursorLabel}
        ariaLabel={`房地產時間游標（${reGranLabel[reGran]}）`}
        ariaValueMin={reCursorMin}
        ariaValueMax={reCursorMax}
        ariaValueNow={ts}
        ariaValueText={reCursorLabel}
        onSeekRatio={(r) => seek(reCursorMin + r * span)}
        onKey={(key) => {
          const stepSec = RE_KEY_STEP[reGran];
          if (key === "ArrowLeft" || key === "ArrowDown") seek(ts - stepSec);
          else if (key === "ArrowRight" || key === "ArrowUp") seek(ts + stepSec);
          else if (key === "Home") seek(reCursorMin);
          else if (key === "End") seek(reCursorMax);
          else return false;
          return true;
        }}
      />
    );
  } else {
    const values = granularity === "year" ? years : granularity === "month" ? range(1, 12) : range(1, dim);
    const current = granularity === "year" ? year : granularity === "month" ? month : Math.min(day, dim);
    const onPick = granularity === "year" ? onYearChange : granularity === "month" ? onMonthChange : onDayChange;
    const unit = granularity === "year" ? undefined : granLabel[granularity];
    const discrete = buildDiscreteAxis(values, current, String);
    const pick = (index: number) => {
      const v = values[index];
      if (v !== undefined && v !== current) onPick(v);
    };
    axis = (
      <TimeAxis
        ratio={indexToRatio(discrete.index, values.length)}
        ticks={discrete.ticks}
        needleLabel={String(current)}
        unit={unit}
        ariaLabel={`歷史時間軸（${granLabel[granularity]}）`}
        ariaValueMin={values[0] ?? 0}
        ariaValueMax={values[values.length - 1] ?? 0}
        ariaValueNow={current}
        ariaValueText={formatValueText(year, month, day, granularity)}
        onSeekRatio={(r) => pick(ratioToIndex(r, values.length))}
        onKey={(key) => {
          const next = keyboardIndexTarget(key, discrete.index, values.length);
          if (next === null) return false;
          pick(next);
          return true;
        }}
      />
    );
  }

  return (
    <div data-testid="historical-timeline" className={rootClass} style={rootStyle}>
      <div className="tl3-top">
        <button
          type="button"
          className="tl3-btn tl3-btn--primary tl3-btn--play"
          onClick={onTogglePlay}
          title={playing ? "暫停" : `播放（依${playStepLabel}推進）`}
          aria-label={playing ? "暫停" : "播放"}
        >
          {playing ? <Pause size={13} fill="currentColor" strokeWidth={0} /> : <Play size={13} fill="currentColor" strokeWidth={0} />}
        </button>
        <span className="tl3-clock">{reActive ? reCursorLabel : formatClock(year, month, day, granularity)}</span>
        <select
          className="tl3-select tl3-select--mono"
          value={speed}
          onChange={(e) => onSpeedChange(Number(e.target.value))}
          title="每秒幾步"
          aria-label="播放倍速"
        >
          {SPEEDS.map((s) => <option key={s} value={s}>{s}×</option>)}
        </select>

        <span className="tl3-group tl3-group--end">
          {reActive ? (
            <div className="tl3-seg" role="group" aria-label="房地產時間粒度">
              {(["quarter", "month", "week"] as ReGran[]).map((g) => (
                <button key={g} type="button" aria-pressed={g === reGran} onClick={() => onReGranChange?.(g)}>
                  {reGranLabel[g]}
                </button>
              ))}
            </div>
          ) : (
            <>
              <span className="tl3-group">
                <label className="tl3-field">
                  民國
                  <select
                    className="tl3-select tl3-select--mono"
                    value={year}
                    onChange={(e) => onYearChange(Number(e.target.value))}
                    aria-label="民國年"
                  >
                    {years.map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                  年
                </label>
                <label className="tl3-field">
                  <select
                    className="tl3-select tl3-select--mono"
                    value={month}
                    disabled={!showMonth}
                    onChange={(e) => onMonthChange(Number(e.target.value))}
                    aria-label="月"
                  >
                    {range(1, 12).map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                  月
                </label>
                <label className="tl3-field">
                  <select
                    className="tl3-select tl3-select--mono"
                    value={Math.min(day, dim)}
                    disabled={!showDay}
                    onChange={(e) => onDayChange(Number(e.target.value))}
                    aria-label="日"
                  >
                    {range(1, dim).map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                  日
                </label>
              </span>
              <div className="tl3-seg" role="group" aria-label="時間粒度">
                {(["year", "month", "day"] as HistoricalGranularity[]).map((g) => (
                  <button key={g} type="button" aria-pressed={g === granularity} onClick={() => onGranularityChange(g)}>
                    {granLabel[g]}
                  </button>
                ))}
              </div>
            </>
          )}
        </span>
      </div>

      {axis}

      <div className="tl3-notes">
        <span className="tl3-warnchip">{dataNote}</span>
      </div>
    </div>
  );
}

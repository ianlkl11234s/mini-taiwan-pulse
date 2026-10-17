import { Pause, Play } from "lucide-react";
import { RE_PERIODS, stepReCursor, type ReGran } from "../lib/realEstateTime";
import { useLocale, type LocaleSnapshot } from "../state/localeStore";
import { displayRocYear } from "../i18n/dataText";
import { SLOTS, slotParts } from "./intel/intelTokens";
import { TimeAxis } from "./timeline/TimeAxis";
import { TimelineShell } from "./timeline/TimelineShell";
import {
  buildDiscreteAxis,
  buildQuarterTicks,
  indexToRatio,
  keyboardIndexTarget,
  range,
  ratioToIndex,
} from "./timeline/timelineAxis";

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

const GRAN_KEY = {
  year: "timeline.historical.step.year",
  month: "timeline.historical.step.month",
  day: "timeline.historical.step.day",
} as const satisfies Record<HistoricalGranularity, string>;
const RE_GRAN_KEY = {
  quarter: "timeline.historical.step.quarter",
  month: "timeline.historical.step.month",
  week: "timeline.historical.step.week",
} as const satisfies Record<ReGran, string>;

function daysInMonth(rocYear: number, month: number): number {
  // 用 AD Date 末日 trick：new Date(year, month, 0) 回傳上個月最後一天
  return new Date(rocYear + ROC_OFFSET, month, 0).getDate();
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/** 中文維持民國年，外文換算西元（displayRocYear） */
function formatClock(year: number, month: number, day: number, granularity: HistoricalGranularity, i18n: LocaleSnapshot): string {
  const y = displayRocYear(year, i18n);
  if (granularity === "year") return y;
  if (granularity === "month") return `${y}/${pad2(month)}`;
  return `${y}/${pad2(month)}/${pad2(day)}`;
}

/** 目前粒度的時間文字（chip 與 aria-valuetext 共用）；年粒度的 aria 另帶民國／西元對照 */
function formatChipText(year: number, month: number, day: number, granularity: HistoricalGranularity, { t, active }: LocaleSnapshot): string {
  const y = displayRocYear(year, { active });
  if (granularity === "year") return t("timeline.historical.chipYear", { y });
  if (granularity === "month") return t("timeline.historical.chipMonth", { y, m: month });
  return t("timeline.historical.chipDay", { y, m: month, d: day });
}

function formatValueText(year: number, month: number, day: number, granularity: HistoricalGranularity, i18n: LocaleSnapshot): string {
  if (granularity === "year") return i18n.t("timeline.historical.valueYear", { y: year, ad: year + ROC_OFFSET });
  return formatChipText(year, month, day, granularity, i18n);
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
  const i18n = useLocale();
  const { t } = i18n;
  const years = availableYears.length > 0 ? availableYears : range(104, 113);
  const dim = daysInMonth(year, month);
  const showMonth = granularity === "month" || granularity === "day";
  const showDay = granularity === "day";
  // 提示該模式下「現在開著的圖層」實際有資料的區間，避免使用者在空年份亂撥
  const dataNote = reActive
    ? t("timeline.historical.noteRe")
    : globalEventsActive
      ? t("timeline.historical.noteGlobal")
      : plaActive
      ? t("timeline.historical.notePla")
      : t("timeline.historical.noteFire");
  const yearField = slotParts(t("timeline.historical.fieldYear", { n: SLOTS[0] }));
  const monthField = slotParts(t("timeline.historical.fieldMonth", { n: SLOTS[0] }));
  const dayField = slotParts(t("timeline.historical.fieldDay", { n: SLOTS[0] }));
  const reGranText = t(RE_GRAN_KEY[reGran]);
  const granText = t(GRAN_KEY[granularity]);
  const playStepLabel = reActive ? reGranText : granText;

  // ── 刻度軸（收合時 compact，只畫基線／已播放段／指針） ──
  const renderAxis = (compact: boolean, onDragChange: (dragging: boolean) => void): React.ReactNode => {
    if (reActive) {
      const span = reCursorMax - reCursorMin;
      const ts = Math.min(Math.max(reCursorTs, reCursorMin), reCursorMax);
      const seek = (next: number) => {
        const clamped = Math.min(Math.max(next, reCursorMin), reCursorMax);
        const step = reCursorStep > 0 ? reCursorStep : 1;
        onReCursorChange?.(reCursorMin + Math.round((clamped - reCursorMin) / step) * step);
      };
      return (
        <TimeAxis
          compact={compact}
          onDragChange={onDragChange}
          ratio={span > 0 ? (ts - reCursorMin) / span : 0}
          ticks={buildQuarterTicks(RE_PERIODS, reCursorMin, reCursorMax)}
          ariaLabel={t("timeline.historical.reAxisAria", { step: reGranText })}
          ariaValueMin={reCursorMin}
          ariaValueMax={reCursorMax}
          ariaValueNow={ts}
          ariaValueText={reCursorLabel}
          onSeekRatio={(r) => seek(reCursorMin + r * span)}
          onKey={(key) => {
            // 日曆步進（季由 App 端 snapQuarterStart 吸附）
            if (key === "ArrowLeft" || key === "ArrowDown") seek(stepReCursor(ts, reGran, -1));
            else if (key === "ArrowRight" || key === "ArrowUp") seek(stepReCursor(ts, reGran, 1));
            else if (key === "Home") seek(reCursorMin);
            else if (key === "End") seek(reCursorMax);
            else return false;
            return true;
          }}
        />
      );
    }
    const values = granularity === "year" ? years : granularity === "month" ? range(1, 12) : range(1, dim);
    const current = granularity === "year" ? year : granularity === "month" ? month : Math.min(day, dim);
    const onPick = granularity === "year" ? onYearChange : granularity === "month" ? onMonthChange : onDayChange;
    const unit = granularity === "year" ? undefined : t(granularity === "month" ? "timeline.historical.unitMonth" : "timeline.historical.unitDay");
    // 月粒度：展開卡的軸約 330px，12 個「N月」標籤會黏在一起（11月12月），隔月標示；刻度仍每月一格
    const discrete = buildDiscreteAxis(values, current, granularity === "year" ? (v) => displayRocYear(v, i18n) : String, granularity === "month" ? 7 : undefined);
    const pick = (index: number) => {
      const v = values[index];
      if (v !== undefined && v !== current) onPick(v);
    };
    return (
      <TimeAxis
        compact={compact}
        onDragChange={onDragChange}
        ratio={indexToRatio(discrete.index, values.length)}
        ticks={discrete.ticks}
        unit={unit}
        ariaLabel={t("timeline.historical.axisAria", { step: granText })}
        ariaValueMin={values[0] ?? 0}
        ariaValueMax={values[values.length - 1] ?? 0}
        ariaValueNow={current}
        ariaValueText={formatValueText(year, month, day, granularity, i18n)}
        onSeekRatio={(r) => pick(ratioToIndex(r, values.length))}
        onKey={(key) => {
          const next = keyboardIndexTarget(key, discrete.index, values.length);
          if (next === null) return false;
          pick(next);
          return true;
        }}
      />
    );
  };

  const chipTemplate = granularity === "year" ? "timeline.historical.chipYear" : granularity === "month" ? "timeline.historical.chipMonth" : "timeline.historical.chipDay";
  const chipSlots = slotParts(t(chipTemplate, { y: SLOTS[0], m: SLOTS[1], d: SLOTS[2] }));
  const chip = reActive ? (
    <>{t("timeline.historical.reChip", { step: reGranText })}</>
  ) : (
    <>
      {chipSlots[0]}<span className="mono">{displayRocYear(year, i18n)}</span>{chipSlots[1]}
      {showMonth && <><span className="mono">{month}</span>{chipSlots[2]}</>}
      {showDay && <><span className="mono">{Math.min(day, dim)}</span>{chipSlots[3]}</>}
    </>
  );
  const chipText = reActive
    ? t("timeline.historical.reChip", { step: reGranText })
    : formatChipText(year, month, day, granularity, i18n);

  return (
    <TimelineShell
      isDarkTheme={isDarkTheme}
      isMobile={isMobile}
      leftOffset={leftOffset}
      rootAttrs={{ "data-testid": "historical-timeline" }}
    >
      {({ expanded, popupOpen, setPopupOpen, onDragChange }) => (
        <>
          <div className="tl3-row">
            <button
              type="button"
              className="tl3-btn tl3-btn--primary tl3-btn--play"
              onClick={onTogglePlay}
              title={playing ? t("timeline.pause") : t("timeline.historical.playBy", { step: playStepLabel.toLowerCase() })}
              aria-label={playing ? t("timeline.pause") : t("timeline.play")}
            >
              {playing ? <Pause size={12} fill="currentColor" strokeWidth={0} /> : <Play size={12} fill="currentColor" strokeWidth={0} />}
            </button>
            <span className="tl3-clock">{reActive ? reCursorLabel : formatClock(year, month, day, granularity, i18n)}</span>
            {renderAxis(!expanded, onDragChange)}
            {expanded && (
              <select
                className="tl3-select tl3-select--mono"
                value={speed}
                onChange={(e) => onSpeedChange(Number(e.target.value))}
                title={t("timeline.historical.speedTitle")}
                aria-label={t("timeline.speed")}
              >
                {SPEEDS.map((s) => <option key={s} value={s}>{s}×</option>)}
              </select>
            )}
            {expanded && (
              <button
                type="button"
                className="tl3-chip"
                onClick={() => setPopupOpen(!popupOpen)}
                title={t("timeline.historical.chipTitle", { note: dataNote })}
                aria-label={t("timeline.historical.chipAria", { chip: chipText })}
                aria-expanded={popupOpen}
                aria-haspopup="dialog"
              >
                {chip}
              </button>
            )}
          </div>

          {expanded && popupOpen && (
            <div className="tl3-pop" role="dialog" aria-label={t("timeline.historical.dialog")}>
              {reActive ? (
                <div className="tl3-pop-row">
                  <div className="tl3-seg" role="group" aria-label={t("timeline.historical.reGroup")}>
                    {(["quarter", "month", "week"] as ReGran[]).map((g) => (
                      <button key={g} type="button" aria-pressed={g === reGran} onClick={() => onReGranChange?.(g)}>
                        {t(RE_GRAN_KEY[g])}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  <div className="tl3-pop-row">
                    <label className="tl3-field">
                      {yearField[0]}
                      <select
                        className="tl3-select tl3-select--mono"
                        value={year}
                        onChange={(e) => onYearChange(Number(e.target.value))}
                        aria-label={t("timeline.historical.ariaYear")}
                      >
                        {years.map((y) => <option key={y} value={y}>{displayRocYear(y, i18n)}</option>)}
                      </select>
                      {yearField[1]}
                    </label>
                    <label className="tl3-field">
                      {monthField[0]}
                      <select
                        className="tl3-select tl3-select--mono"
                        value={month}
                        disabled={!showMonth}
                        onChange={(e) => onMonthChange(Number(e.target.value))}
                        aria-label={t("timeline.historical.ariaMonth")}
                      >
                        {range(1, 12).map((m) => <option key={m} value={m}>{m}</option>)}
                      </select>
                      {monthField[1]}
                    </label>
                    <label className="tl3-field">
                      {dayField[0]}
                      <select
                        className="tl3-select tl3-select--mono"
                        value={Math.min(day, dim)}
                        disabled={!showDay}
                        onChange={(e) => onDayChange(Number(e.target.value))}
                        aria-label={t("timeline.historical.ariaDay")}
                      >
                        {range(1, dim).map((d) => <option key={d} value={d}>{d}</option>)}
                      </select>
                      {dayField[1]}
                    </label>
                  </div>
                  <div className="tl3-pop-row">
                    <div className="tl3-seg" role="group" aria-label={t("timeline.historical.granGroup")}>
                      {(["year", "month", "day"] as HistoricalGranularity[]).map((g) => (
                        <button key={g} type="button" aria-pressed={g === granularity} onClick={() => onGranularityChange(g)}>
                          {t(GRAN_KEY[g])}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
              <div className="tl3-pop-row">
                <span className="tl3-warnchip">{dataNote}</span>
              </div>
            </div>
          )}
        </>
      )}
    </TimelineShell>
  );
}

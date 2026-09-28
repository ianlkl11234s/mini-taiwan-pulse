import { useRef } from "react";
import type { AxisGap, AxisTick } from "./timelineAxis";

interface Props {
  /** 指針位置 0–1（也是已播放段的寬度） */
  ratio: number;
  ticks: readonly AxisTick[];
  gaps?: readonly AxisGap[];
  gapTitle?: string;
  /** 標籤單位（中文，例「月」）：接在數字後、用 CJK 字型，避免等寬字包中文 */
  unit?: string;
  ariaLabel: string;
  ariaValueMin: number;
  ariaValueMax: number;
  ariaValueNow: number;
  ariaValueText: string;
  /** 點擊或拖曳到某個比例（0–1） */
  onSeekRatio: (ratio: number) => void;
  /** 鍵盤操作；回傳 true 表示已處理（會 preventDefault） */
  onKey: (key: string, shiftKey: boolean) => boolean;
  /** TC3 收合膠囊：只畫基線＋已播放段＋指針＋缺漏斜線，不畫刻度與標籤 */
  compact?: boolean;
  /** 拖曳開始／結束（讓 TC3 狀態機在拖曳中不收合） */
  onDragChange?: (dragging: boolean) => void;
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const pct = (v: number) => `${(clamp01(v) * 100).toFixed(3)}%`;

/** 兩端標籤貼齊邊緣，其餘置中在刻度上 */
function labelShift(pos: number): string {
  if (pos <= 0.001) return "translateX(0)";
  if (pos >= 0.999) return "translateX(-100%)";
  return "translateX(-50%)";
}

/**
 * TC3 刻度軸（沿用 TL3 的 TimeAxis）（role="slider"）。只負責畫與把指標／鍵盤轉成比例；
 * 拖曳狀態放 ref，不進 effect，也不訂閱時間（時間由父層以 props 傳入）。
 */
export function TimeAxis({
  ratio,
  ticks,
  gaps = [],
  gapTitle,
  unit,
  ariaLabel,
  ariaValueMin,
  ariaValueMax,
  ariaValueNow,
  ariaValueText,
  onSeekRatio,
  onKey,
  compact = false,
  onDragChange,
}: Props) {
  const draggingRef = useRef(false);
  const r = clamp01(Number.isFinite(ratio) ? ratio : 0);

  const endDrag = () => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    onDragChange?.(false);
  };

  const ratioFromEvent = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) return null;
    return clamp01((e.clientX - rect.left) / rect.width);
  };

  return (
    <div
      className={compact ? "tl3-axis tl3-axis--compact" : "tl3-axis"}
      role="slider"
      tabIndex={0}
      aria-label={ariaLabel}
      aria-valuemin={ariaValueMin}
      aria-valuemax={ariaValueMax}
      aria-valuenow={ariaValueNow}
      aria-valuetext={ariaValueText}
      aria-orientation="horizontal"
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        const next = ratioFromEvent(e);
        if (next === null) return;
        draggingRef.current = true;
        onDragChange?.(true);
        e.currentTarget.setPointerCapture?.(e.pointerId);
        e.currentTarget.focus({ preventScroll: true });
        onSeekRatio(next);
      }}
      onPointerMove={(e) => {
        if (!draggingRef.current) return;
        const next = ratioFromEvent(e);
        if (next !== null) onSeekRatio(next);
      }}
      onPointerUp={(e) => {
        endDrag();
        e.currentTarget.releasePointerCapture?.(e.pointerId);
      }}
      onPointerCancel={endDrag}
      onLostPointerCapture={endDrag}
      onKeyDown={(e) => {
        if (onKey(e.key, e.shiftKey)) e.preventDefault();
      }}
    >
      <span className="tl3-axis__base" />
      {gaps.map((g) => (
        <span
          key={`${g.start}-${g.end}`}
          className="tl3-axis__gap"
          title={gapTitle}
          style={{ left: pct(g.start), width: pct(g.end - g.start) }}
        />
      ))}
      <span className="tl3-axis__done" style={{ width: pct(r) }} />
      {!compact && ticks.map((t, i) => (
        <span
          key={`t${i}`}
          className={t.major ? "tl3-axis__tick" : "tl3-axis__tick tl3-axis__tick--minor"}
          style={{ left: pct(t.pos) }}
        />
      ))}
      {!compact && ticks.map((t, i) =>
        t.label === undefined ? null : (
          <span key={`l${i}`} className="tl3-axis__lbl" style={{ left: pct(t.pos), transform: labelShift(t.pos) }}>
            {t.label}{unit && <span className="tl3-axis__unit">{unit}</span>}
          </span>
        ),
      )}
      {/* TC3 單列：目前時間已顯示在左側大字，指針不再掛標籤（值仍在 aria-valuetext） */}
      <span className="tl3-axis__needle" style={{ left: pct(r) }} />
    </div>
  );
}

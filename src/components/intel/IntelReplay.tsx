import { IntelIcon, ICON } from "./IntelIcon";
import { COLORS, FONT_DATA, clockTime } from "./intelTokens";
import { RADIUS, FONT_SIZE } from "../../styles/designTokens";

interface Props {
  /** unix sec — 當前 scrub 位置 */
  playbackTs: number;
  /** unix sec — 視窗左界 */
  windowStartTs: number;
  /** unix sec — 視窗右界（= now） */
  nowTs: number;
  isLive: boolean;
  playing: boolean;
  onScrub: (ts: number) => void;
  onLive: () => void;
  onTogglePlay: () => void;
}

export function IntelReplay({
  playbackTs, windowStartTs, nowTs, isLive, playing,
  onScrub, onLive, onTogglePlay,
}: Props) {
  return (
    <div
      style={{
        flexShrink: 0,
        padding: "9px 14px 11px",
        borderTop: `1px solid ${COLORS.panelBorder}`,
        background: "rgba(0,0,0,0.3)",
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontFamily: FONT_DATA, fontSize: FONT_SIZE.xs, letterSpacing: "1.5px", color: COLORS.textFaint }}>
          回放 REPLAY
        </span>
        <span
          style={{
            fontFamily: FONT_DATA,
            fontSize: 10.5,
            fontWeight: 700,
            color: isLive ? COLORS.statusLive : COLORS.statusWarn,
          }}
        >
          {isLive ? "即時 NOW" : clockTime(playbackTs)}
        </span>
        <div style={{ flex: 1 }} />
        <button
          onClick={onTogglePlay}
          title="play/pause"
          style={{
            width: 24,
            height: 24,
            borderRadius: RADIUS.md,
            border: `1px solid ${COLORS.borderMid}`,
            background: "rgba(255,255,255,0.05)",
            color: COLORS.textDefault,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <IntelIcon
            d={playing ? ICON.pause : ICON.play}
            size={11}
            fill={playing ? "none" : "currentColor"}
          />
        </button>
        <button
          onClick={onLive}
          style={{
            padding: "3px 9px",
            borderRadius: RADIUS.md,
            cursor: "pointer",
            fontFamily: FONT_DATA,
            fontSize: FONT_SIZE.sm,
            background: isLive ? COLORS.statusLiveSoft : "rgba(255,255,255,0.05)",
            border: `1px solid ${isLive ? COLORS.statusLiveBorder : COLORS.borderMid}`,
            color: isLive ? COLORS.statusLive : COLORS.textMuted,
          }}
        >
          LIVE
        </button>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontFamily: FONT_DATA, fontSize: FONT_SIZE.xs, color: COLORS.textFaint }}>
          {clockTime(windowStartTs)}
        </span>
        <input
          type="range"
          min={windowStartTs}
          max={nowTs}
          step={60}
          value={playbackTs}
          onChange={(ev) => onScrub(Number(ev.target.value))}
          style={{ flex: 1, height: 3, accentColor: COLORS.accent, cursor: "pointer" }}
        />
        <span style={{ fontFamily: FONT_DATA, fontSize: FONT_SIZE.xs, color: COLORS.textFaint }}>
          {clockTime(nowTs)}
        </span>
      </div>
    </div>
  );
}

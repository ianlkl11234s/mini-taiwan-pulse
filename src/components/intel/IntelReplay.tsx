import { IntelIcon, ICON } from "./IntelIcon";
import { FONT_CJK, FONT_DATA, clockTime } from "./intelTokens";
import { neutralFill, useIntelTheme } from "./intelTheme";
import { RADIUS, FONT_SIZE, LIGHT } from "../../styles/designTokens";

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
  const palette = useIntelTheme();
  return (
    <div
      style={{
        flexShrink: 0,
        padding: "9px 14px 11px",
        borderTop: `1px solid ${palette.panelBorder}`,
        background: palette.isDark ? "rgba(0,0,0,0.3)" : LIGHT.fillStrong,
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontFamily: FONT_CJK, fontSize: FONT_SIZE.xs, color: palette.textFaint }}>
          回放
        </span>
        <span
          style={{
            fontFamily: isLive ? FONT_CJK : FONT_DATA,
            fontSize: 10.5,
            fontWeight: 700,
            color: isLive ? palette.statusLive : palette.statusWarn,
          }}
        >
          {isLive ? "即時" : clockTime(playbackTs)}
        </span>
        <div style={{ flex: 1 }} />
        <button
          onClick={onTogglePlay}
          title="play/pause"
          style={{
            width: 24,
            height: 24,
            borderRadius: RADIUS.md,
            border: `1px solid ${palette.borderMid}`,
            background: neutralFill(0.05, palette.isDark),
            color: palette.textDefault,
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
            background: isLive ? palette.statusLiveSoft : neutralFill(0.05, palette.isDark),
            border: `1px solid ${isLive ? palette.statusLiveBorder : palette.borderMid}`,
            color: isLive ? palette.statusLive : palette.textMuted,
          }}
        >
          LIVE
        </button>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontFamily: FONT_DATA, fontSize: FONT_SIZE.xs, color: palette.textFaint }}>
          {clockTime(windowStartTs)}
        </span>
        <input
          type="range"
          min={windowStartTs}
          max={nowTs}
          step={60}
          value={playbackTs}
          onChange={(ev) => onScrub(Number(ev.target.value))}
          style={{ flex: 1, height: 3, accentColor: palette.accent, cursor: "pointer" }}
        />
        <span style={{ fontFamily: FONT_DATA, fontSize: FONT_SIZE.xs, color: palette.textFaint }}>
          {clockTime(nowTs)}
        </span>
      </div>
    </div>
  );
}

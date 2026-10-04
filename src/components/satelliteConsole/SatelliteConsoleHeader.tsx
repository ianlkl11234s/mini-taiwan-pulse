import { COLORS, FONT_CJK, FONT_DATA, clockTime } from "./satelliteConsoleTokens";
import { chipOutline } from "../intel/intelTokens";
import { PanelHeader } from "../sidebar/PanelHeader";
import { FONT_SIZE } from "../../styles/designTokens";
import { isHistoryMode, formatTimelineOffset } from "../../hooks/useTimeStoreTime";

interface Props {
  totalManeuvers: number;
  /** 時間軸當下（秒）— panel 顯示用的「顯示時間」基準 */
  timelineSec: number;
  onClose: () => void;
}

// §5.21 狀態徽章：chipOutline（透明底＋框），圓角 3、10px
const chipBase = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  padding: "2px 5px",
  borderRadius: 3,
  fontSize: FONT_SIZE.sm,
  lineHeight: 1.2,
  whiteSpace: "nowrap",
} as const;

export function SatelliteConsoleHeader({ totalManeuvers, timelineSec, onClose }: Props) {
  const hot = totalManeuvers > 0;
  const isHistory = isHistoryMode(timelineSec);
  const offsetLabel = isHistory ? formatTimelineOffset(timelineSec) : null;
  const badgeColor = isHistory ? COLORS.statusWarn : COLORS.statusLive;

  return (
    <>
      {/* 標頭：共用 PanelHeader（H2 eyebrow 分支）；衛星情報 Console 目前只有暗色 */}
      <PanelHeader
        eyebrow="情報 · 太空"
        title="衛星情報"
        onClose={onClose}
        borderColor={COLORS.panelBorder}
        mutedColor={COLORS.textDim}
        textColor={COLORS.textStrong}
      />

      {/* 狀態列（H1）：即時／歷史徽章、顯示時間、變軌警報 */}
      <div
        style={{
          flexShrink: 0,
          padding: "6px 14px 7px",
          borderBottom: `1px solid ${COLORS.borderSoft}`,
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontFamily: FONT_CJK,
          fontSize: FONT_SIZE.sm,
          background: isHistory ? "rgba(255,152,0,0.06)" : "transparent",
        }}
      >
        <span style={{ ...chipBase, ...chipOutline(badgeColor) }}>{isHistory ? "歷史" : "即時"}</span>
        <span style={{ color: COLORS.textDim, whiteSpace: "nowrap" }}>顯示時間</span>
        <span style={{ fontFamily: FONT_DATA, fontVariantNumeric: "tabular-nums", fontWeight: 600, color: COLORS.textDefault }}>
          {clockTime(timelineSec)}
        </span>
        {offsetLabel && (
          <span style={{ color: COLORS.statusWarn, whiteSpace: "nowrap" }}>
            （{offsetLabel.split(/([+\-\d:]+)/).filter(Boolean).map((part, i) =>
              /^[+\-\d:]+$/.test(part) ? <span key={i} style={{ fontFamily: FONT_DATA }}>{part}</span> : part)}）
          </span>
        )}
        {/* 變軌警報是「DB 24h 內」的客觀事實，不受歷史模式影響 → 歷史模式只提示固定看近 24 小時 */}
        {isHistory ? (
          <span style={{ marginLeft: "auto", color: COLORS.textDim, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            變軌警報固定看近 24 小時
          </span>
        ) : (
          hot && (
            <span style={{ marginLeft: "auto", ...chipBase, ...chipOutline(COLORS.statusErr) }}>
              變軌 <span style={{ fontFamily: FONT_DATA }}>{totalManeuvers}</span>
            </span>
          )
        )}
      </div>
    </>
  );
}

import { IntelIcon, ICON } from "../intel/IntelIcon";
import { COLORS, FONT_CJK, FONT_DATA, clockTime } from "./satelliteConsoleTokens";
import { isHistoryMode, formatTimelineOffset } from "../../hooks/useTimeStoreTime";

interface Props {
  totalManeuvers: number;
  /** 時間軸當下（秒）— panel 顯示用的「顯示時間」基準 */
  timelineSec: number;
  onClose: () => void;
}

export function SatelliteConsoleHeader({ totalManeuvers, timelineSec, onClose }: Props) {
  const hot = totalManeuvers > 0;
  const isHistory = isHistoryMode(timelineSec);
  const offsetLabel = isHistory ? formatTimelineOffset(timelineSec) : null;

  // 即時 / 歷史模式的色票
  const badgeColor = isHistory ? COLORS.statusWarn : COLORS.statusLive;
  const badgeSoft = isHistory ? "rgba(255,152,0,0.16)" : COLORS.statusLiveSoft;
  const badgeBorder = isHistory ? "rgba(255,152,0,0.55)" : COLORS.statusLiveBorder;

  return (
    <>
      {/* ── 1 列：標題 + LIVE/ALERT/HISTORY 徽章 ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 9,
          padding: "13px 14px 11px",
          borderBottom: `1px solid ${COLORS.panelBorder}`,
          flexShrink: 0,
        }}
      >
        <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke={COLORS.accent}
             strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <circle cx="12" cy="12" r="2" />
          <path d="M4 12a8 8 0 1 0 16 0" />
          <path d="M20 12a8 8 0 0 1-16 0" strokeDasharray="2 3" />
          <circle cx="20" cy="12" r="1.2" fill={COLORS.accent} />
        </svg>
        <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.15 }}>
          <span style={{ fontFamily: FONT_CJK, fontSize: 13.5, fontWeight: 700, color: COLORS.textStrong }}>
            衛星情報
          </span>
          <span style={{ fontFamily: FONT_DATA, fontSize: 9, letterSpacing: "2.5px", color: COLORS.textDim }}>
            SATELLITE
          </span>
        </div>
        {/* 變軌 ALERT 徽章（紅）— 警報是「DB 24h 內」的客觀事實，不受歷史模式影響 */}
        {hot && !isHistory && (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              marginLeft: 6,
              padding: "2px 8px",
              borderRadius: 4,
              background: "rgba(239,68,68,0.16)",
              border: "1px solid rgba(239,68,68,0.45)",
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: COLORS.statusErr,
                boxShadow: `0 0 6px ${COLORS.statusErr}`,
                animation: "intelRing 1.6s ease-in-out infinite",
              }}
            />
            <span style={{ fontFamily: FONT_DATA, fontSize: 10, fontWeight: 700, color: COLORS.statusErr }}>
              ALERT
            </span>
          </span>
        )}
        <div style={{ flex: 1 }} />
        <button
          onClick={onClose}
          aria-label="close"
          style={{
            width: 24,
            height: 24,
            borderRadius: 4,
            border: "none",
            background: "transparent",
            color: COLORS.textDim,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
        >
          <IntelIcon d={ICON.x} size={14} />
        </button>
      </div>

      {/* ── 2 列：顯示時間徽章 ── */}
      <div
        style={{
          flexShrink: 0,
          padding: "7px 14px 8px",
          borderBottom: `1px solid ${COLORS.borderSoft}`,
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontFamily: FONT_DATA,
          fontSize: 10,
          background: isHistory ? "rgba(255,152,0,0.06)" : "transparent",
        }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            padding: "2px 8px",
            borderRadius: 4,
            background: badgeSoft,
            border: `1px solid ${badgeBorder}`,
            fontFamily: FONT_DATA,
            fontWeight: 700,
            color: badgeColor,
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: badgeColor }} />
          {isHistory ? "HISTORY" : "LIVE"}
        </span>
        <span style={{ color: COLORS.textDim }}>顯示時間</span>
        <span style={{ color: COLORS.textDefault, fontWeight: 600 }}>
          {clockTime(timelineSec)}
        </span>
        {offsetLabel && (
          <span style={{ color: badgeColor }}>（{offsetLabel}）</span>
        )}
        <span style={{ marginLeft: "auto", color: COLORS.textFaint }}>
          §A 警報固定看現實 24h
        </span>
      </div>
    </>
  );
}

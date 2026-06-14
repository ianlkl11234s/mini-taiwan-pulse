import { IntelIcon, ICON } from "../intel/IntelIcon";
import { COLORS, FONT_CJK, FONT_DATA, clockTime } from "./satelliteConsoleTokens";

interface Props {
  totalManeuvers: number;
  lastUpdateTs: number;
  onClose: () => void;
}

export function SatelliteConsoleHeader({ totalManeuvers, lastUpdateTs, onClose }: Props) {
  const hot = totalManeuvers > 0;
  return (
    <>
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
        {/* 衛星圖示（lucide-flavored circle + orbit） */}
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
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            marginLeft: 6,
            padding: "2px 8px",
            borderRadius: 4,
            background: hot ? "rgba(239,68,68,0.16)" : COLORS.statusLiveSoft,
            border: `1px solid ${hot ? "rgba(239,68,68,0.45)" : COLORS.statusLiveBorder}`,
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: hot ? COLORS.statusErr : COLORS.statusLive,
              boxShadow: `0 0 6px ${hot ? COLORS.statusErr : COLORS.statusLive}`,
              animation: "intelRing 1.6s ease-in-out infinite",
            }}
          />
          <span style={{ fontFamily: FONT_DATA, fontSize: 10, fontWeight: 700, color: hot ? COLORS.statusErr : COLORS.statusLive }}>
            {hot ? "ALERT" : "LIVE"}
          </span>
        </span>
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

      <div
        style={{
          flexShrink: 0,
          padding: "8px 14px",
          borderBottom: `1px solid ${COLORS.borderSoft}`,
          display: "flex",
          alignItems: "center",
          gap: 10,
          whiteSpace: "nowrap",
          fontFamily: FONT_DATA,
          fontSize: 10,
        }}
      >
        <span style={{ color: COLORS.textMuted }}>更新 {clockTime(lastUpdateTs)}</span>
        <span style={{ color: COLORS.textFaint }}>·</span>
        <span style={{ color: COLORS.textDefault }}>
          近 24h 變軌 <span style={{ color: hot ? COLORS.statusErr : COLORS.textDefault, fontWeight: 700 }}>{totalManeuvers}</span> 顆
        </span>
        <span style={{ marginLeft: "auto", color: COLORS.textDim }}>
          來源：Supabase satellite_maneuvers (2h refresh)
        </span>
      </div>
    </>
  );
}

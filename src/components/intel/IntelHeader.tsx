import { useState } from "react";
import { IntelIcon, ICON } from "./IntelIcon";
import { COLORS, FONT_CJK, FONT_DATA, clockTime, fmtCountdown } from "./intelTokens";
import { RADIUS, FONT_SIZE } from "../../styles/designTokens";
import type { SourceHealthSummary, SourceStatus } from "../../data/intelLoaders";

interface Props {
  totalCount: number;
  lastUpdateTs: number;
  countdownSec: number;
  sourceHealth: SourceHealthSummary;
  onClose: () => void;
  /** Global Events has its own immutable window/status; news health and LIVE badge do not apply. */
  showFeedStatus?: boolean;
}

const STATUS_COLOR: Record<SourceStatus, string> = {
  ok: COLORS.statusLive,
  lagging: COLORS.statusWarn,
  degraded: COLORS.statusErr,
  unknown: COLORS.textDim,
};

function fmtLag(sec: number | null): string {
  if (sec == null) return "-";
  if (sec < 120) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m`;
  return `${Math.floor(sec / 3600)}h`;
}

export function IntelHeader({ totalCount, lastUpdateTs, countdownSec, sourceHealth, onClose, showFeedStatus = true }: Props) {
  const [showHealth, setShowHealth] = useState(false);

  const degraded = sourceHealth.degraded + sourceHealth.lagging > 0;
  const okCount = sourceHealth.ok;
  const total = sourceHealth.total;

  return (
    <>
      {/* ── header row ── */}
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
        <IntelIcon d={ICON.radio} size={17} color={COLORS.accent} />
        <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.15 }}>
          <span style={{ fontFamily: FONT_CJK, fontSize: 13.5, fontWeight: 700, color: COLORS.textStrong }}>
            即時情報
          </span>
          <span style={{ fontFamily: FONT_DATA, fontSize: FONT_SIZE.xs, letterSpacing: "2.5px", color: COLORS.textDim }}>
            INTEL
          </span>
        </div>
        {showFeedStatus && <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            marginLeft: 6,
            padding: "2px 8px",
            borderRadius: RADIUS.md,
            background: COLORS.statusLiveSoft,
            border: `1px solid ${COLORS.statusLiveBorder}`,
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: RADIUS.full,
              background: COLORS.statusLive,
              boxShadow: `0 0 6px ${COLORS.statusLive}`,
              animation: "intelRing 1.6s ease-in-out infinite",
            }}
          />
          <span style={{ fontFamily: FONT_DATA, fontSize: FONT_SIZE.sm, fontWeight: 700, color: COLORS.statusLive }}>
            LIVE
          </span>
        </span>}
        <div style={{ flex: 1 }} />
        <button
          onClick={onClose}
          aria-label="close"
          style={{
            width: 24,
            height: 24,
            borderRadius: RADIUS.md,
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

      {/* ── status row ── */}
      {showFeedStatus && <div
        style={{
          flexShrink: 0,
          padding: "8px 14px",
          borderBottom: `1px solid ${COLORS.borderSoft}`,
          display: "flex",
          alignItems: "center",
          gap: 10,
          whiteSpace: "nowrap",
          fontFamily: FONT_DATA,
          fontSize: FONT_SIZE.sm,
        }}
      >
        <span style={{ color: COLORS.textMuted }}>更新 {clockTime(lastUpdateTs)}</span>
        <span style={{ color: COLORS.textFaint }}>·</span>
        <span style={{ color: COLORS.textDefault }}>共 {totalCount} 則</span>
        <button
          onClick={() => setShowHealth((v) => !v)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            marginLeft: "auto",
            padding: "2px 7px",
            borderRadius: RADIUS.md,
            background: "rgba(255,255,255,0.04)",
            border: `1px solid ${COLORS.borderSoft}`,
            cursor: "pointer",
            fontFamily: FONT_DATA,
            fontSize: 9.5,
            color: degraded ? COLORS.statusWarn : COLORS.statusLive,
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: RADIUS.full,
              background: degraded ? COLORS.statusWarn : COLORS.statusLive,
            }}
          />
          來源 {okCount}/{total}
          <IntelIcon d={showHealth ? ICON.chevDown : ICON.chevRight} size={10} color={COLORS.textDim} />
        </button>
        <span style={{ display: "flex", alignItems: "center", gap: 4, color: COLORS.textDim }}>
          <IntelIcon d={ICON.refresh} size={11} color={COLORS.textDim} /> {fmtCountdown(countdownSec)}
        </span>
      </div>}

      {/* ── source health popover ── */}
      {showFeedStatus && showHealth && (
        <div
          style={{
            flexShrink: 0,
            padding: "8px 14px 10px",
            borderBottom: `1px solid ${COLORS.borderSoft}`,
            background: "rgba(0,0,0,0.25)",
            maxHeight: 220,
            overflowY: "auto",
          }}
        >
          <div
            style={{
              fontFamily: FONT_DATA,
              fontSize: FONT_SIZE.xs,
              letterSpacing: "1.5px",
              color: COLORS.textFaint,
              marginBottom: 6,
            }}
          >
            來源管線 PIPELINE · RSS×{total} → Gemini 地理編碼
          </div>
          {total === 0 ? (
            <div style={{ fontFamily: FONT_CJK, fontSize: FONT_SIZE.sm, color: COLORS.textFaint }}>
              尚無資料（collector 還沒回報過）
            </div>
          ) : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 14px" }}>
                {sourceHealth.rows.map((f) => (
                  <div key={f.feed_url} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span
                      style={{
                        width: 5,
                        height: 5,
                        borderRadius: RADIUS.full,
                        flexShrink: 0,
                        background: STATUS_COLOR[f.status],
                      }}
                    />
                    <span
                      title={f.feed_url}
                      style={{
                        fontFamily: FONT_CJK,
                        fontSize: FONT_SIZE.sm,
                        color: COLORS.textDefault,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {f.source}{f.county_hint ? `·${f.county_hint}` : ""}
                    </span>
                    <span
                      style={{
                        marginLeft: "auto",
                        fontFamily: FONT_DATA,
                        fontSize: FONT_SIZE.xs,
                        color: f.status === "ok" ? COLORS.textFaint : STATUS_COLOR[f.status],
                      }}
                    >
                      {fmtLag(f.lag_sec)}
                    </span>
                  </div>
                ))}
              </div>
              {sourceHealth.degraded + sourceHealth.lagging > 0 && (
                <div style={{ marginTop: 6, fontFamily: FONT_CJK, fontSize: 9.5, color: COLORS.statusWarn }}>
                  ⚠ {sourceHealth.degraded + sourceHealth.lagging} 個來源延遲偏高
                </div>
              )}
            </>
          )}
        </div>
      )}
    </>
  );
}

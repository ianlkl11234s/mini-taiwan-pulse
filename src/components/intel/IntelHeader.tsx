import { useState } from "react";
import { IntelIcon, ICON } from "./IntelIcon";
import { FONT_CJK, FONT_DATA, clockTime, fmtCountdown } from "./intelTokens";
import { neutralFill, useIntelTheme, type IntelPalette } from "./intelTheme";
import { RADIUS, FONT_SIZE, LIGHT } from "../../styles/designTokens";
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

function statusColor(palette: IntelPalette): Record<SourceStatus, string> {
  return {
    ok: palette.statusLive,
    lagging: palette.statusWarn,
    degraded: palette.statusErr,
    unknown: palette.textDim,
  };
}

function fmtLag(sec: number | null): string {
  if (sec == null) return "-";
  if (sec < 120) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m`;
  return `${Math.floor(sec / 3600)}h`;
}

export function IntelHeader({ totalCount, lastUpdateTs, countdownSec, sourceHealth, onClose, showFeedStatus = true }: Props) {
  const palette = useIntelTheme();
  const STATUS_COLOR = statusColor(palette);
  const [showHealth, setShowHealth] = useState(false);

  const degraded = sourceHealth.degraded + sourceHealth.lagging > 0;
  const okCount = sourceHealth.ok;
  const total = sourceHealth.total;

  return (
    <>
      {/* ── header row（H2：eyebrow 在標題上方；LIVE 小膠囊；底線用 canonical border） ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 9,
          padding: "10px 14px",
          borderBottom: `1px solid ${palette.panelBorder}`,
          flexShrink: 0,
        }}
      >
        <IntelIcon d={ICON.radio} size={17} color={palette.accent} />
        <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.15 }}>
          <span style={{ fontFamily: FONT_CJK, fontSize: FONT_SIZE.xs, letterSpacing: "1.4px", color: palette.textDim }}>
            情報
          </span>
          <span style={{ fontFamily: FONT_CJK, fontSize: FONT_SIZE.lg, fontWeight: 700, color: palette.textStrong, marginTop: 1, display: "flex", alignItems: "center", gap: 8 }}>
            即時情報
            {showFeedStatus && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "2px 6px",
                  borderRadius: RADIUS.pill,
                  border: `1px solid ${palette.statusLiveBorder}`,
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: RADIUS.full,
                    background: palette.statusLive,
                    boxShadow: `0 0 6px ${palette.statusLive}`,
                    animation: "intelRing 1.6s ease-in-out infinite",
                  }}
                />
                <span style={{ fontFamily: FONT_DATA, fontSize: FONT_SIZE.xs, fontWeight: 600, letterSpacing: "0.6px", color: palette.statusLive }}>
                  LIVE
                </span>
              </span>
            )}
          </span>
        </div>
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
            color: palette.textDim,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
        >
          <IntelIcon d={ICON.x} size={14} />
        </button>
      </div>

      {/* ── status row（整列 CJK；時間／數字另包 FONT_DATA + tabular-nums） ── */}
      {showFeedStatus && <div
        style={{
          flexShrink: 0,
          padding: "8px 14px",
          borderBottom: `1px solid ${palette.borderSoft}`,
          display: "flex",
          alignItems: "center",
          gap: 10,
          whiteSpace: "nowrap",
          fontFamily: FONT_CJK,
          fontSize: FONT_SIZE.sm,
        }}
      >
        <span style={{ color: palette.textMuted }}>
          更新 <span style={{ fontFamily: FONT_DATA, fontVariantNumeric: "tabular-nums" }}>{clockTime(lastUpdateTs)}</span>
        </span>
        <span style={{ color: palette.textFaint }}>·</span>
        <span style={{ color: palette.textDefault }}>
          共 <span style={{ fontFamily: FONT_DATA, fontVariantNumeric: "tabular-nums" }}>{totalCount}</span> 則
        </span>
        <button
          onClick={() => setShowHealth((v) => !v)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            marginLeft: "auto",
            padding: "2px 7px",
            borderRadius: RADIUS.md,
            background: neutralFill(0.04, palette.isDark),
            border: `1px solid ${palette.borderSoft}`,
            cursor: "pointer",
            fontFamily: FONT_CJK,
            fontSize: 9.5,
            color: degraded ? palette.statusWarn : palette.statusLive,
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: RADIUS.full,
              background: degraded ? palette.statusWarn : palette.statusLive,
            }}
          />
          來源 <span style={{ fontFamily: FONT_DATA, fontVariantNumeric: "tabular-nums" }}>{okCount}/{total}</span>
          <IntelIcon d={showHealth ? ICON.chevDown : ICON.chevRight} size={10} color={palette.textDim} />
        </button>
        <span style={{ display: "flex", alignItems: "center", gap: 4, color: palette.textDim }}>
          <IntelIcon d={ICON.refresh} size={11} color={palette.textDim} />
          <span style={{ fontFamily: FONT_DATA, fontVariantNumeric: "tabular-nums" }}>{fmtCountdown(countdownSec)}</span>
        </span>
      </div>}

      {/* ── source health popover ── */}
      {showFeedStatus && showHealth && (
        <div
          style={{
            flexShrink: 0,
            padding: "8px 14px 10px",
            borderBottom: `1px solid ${palette.borderSoft}`,
            background: palette.isDark ? "rgba(0,0,0,0.25)" : LIGHT.fillStrong,
            maxHeight: 220,
            overflowY: "auto",
          }}
        >
          <div
            style={{
              fontFamily: FONT_CJK,
              fontSize: FONT_SIZE.xs,
              color: palette.textFaint,
              marginBottom: 6,
            }}
          >
            來源管線 · <span style={{ fontFamily: FONT_DATA }}>RSS×{total}</span> → <span style={{ fontFamily: FONT_DATA }}>Gemini</span> 地理編碼
          </div>
          {total === 0 ? (
            <div style={{ fontFamily: FONT_CJK, fontSize: FONT_SIZE.sm, color: palette.textFaint }}>
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
                        color: palette.textDefault,
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
                        color: f.status === "ok" ? palette.textFaint : STATUS_COLOR[f.status],
                      }}
                    >
                      {fmtLag(f.lag_sec)}
                    </span>
                  </div>
                ))}
              </div>
              {sourceHealth.degraded + sourceHealth.lagging > 0 && (
                <div style={{ marginTop: 6, fontFamily: FONT_CJK, fontSize: 9.5, color: palette.statusWarn }}>
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

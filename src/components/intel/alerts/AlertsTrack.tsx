import { useMemo, useRef, useState } from "react";
import {
  COLORS, FONT_DATA,
  ALERT_GROUPS_DEF, ALERT_GROUP_ORDER,
  type AlertGroupShort,
} from "../intelTokens";

interface Props {
  series: Record<AlertGroupShort, number[]>;
  /** 0-1 — 當下時間在 24h 中的相對位置 */
  nowFrac: number;
  /** 0-1 — 播放指針位置 */
  playbackFrac: number;
  isLive: boolean;
  /** frac 0-1 對應 24h 位置 */
  onScrubFrac: (frac: number) => void;
}

const TRACK_H = 30;

export function AlertsTrack({
  series, nowFrac, playbackFrac, isLive, onScrubFrac,
}: Props) {
  const areaRef = useRef<HTMLDivElement>(null);
  const [hoverH, setHoverH] = useState<number | null>(null);
  const draggingRef = useRef(false);

  const fracFromClientX = (clientX: number): number => {
    const el = areaRef.current;
    if (!el) return 0;
    const r = el.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - r.left) / r.width));
  };

  const buckets = useMemo(() => {
    const out: { h: number; total: number; parts: Record<AlertGroupShort, number> }[] = [];
    for (let h = 0; h < 24; h++) {
      const parts = {} as Record<AlertGroupShort, number>;
      let total = 0;
      for (const g of ALERT_GROUP_ORDER) {
        const v = series[g]?.[h] ?? 0;
        parts[g] = v;
        total += v;
      }
      out.push({ h, total, parts });
    }
    return out;
  }, [series]);

  const peak = Math.max(1, ...buckets.map((b) => b.total));

  return (
    <div
      style={{
        padding: "4px 14px 6px",
        borderTop: `1px solid ${COLORS.borderSoft}`,
      }}
    >
      <div
        style={{
          display: "flex", alignItems: "center", gap: 8, marginBottom: 3,
        }}
      >
        <span
          style={{
            fontFamily: FONT_DATA, fontSize: 8.5, letterSpacing: "1.8px",
            color: COLORS.textFaint,
          }}
        >
          ALERTS 24H
        </span>
        <div style={{ flex: 1 }} />
        {hoverH != null && buckets[hoverH] && (
          <span style={{ fontFamily: FONT_DATA, fontSize: 9.5, color: COLORS.textMuted }}>
            {String(hoverH).padStart(2, "0")}:00 · {buckets[hoverH].total} 則
          </span>
        )}
      </div>

      <div
        ref={areaRef}
        onMouseDown={(e) => {
          draggingRef.current = true;
          onScrubFrac(fracFromClientX(e.clientX));
        }}
        onMouseMove={(e) => {
          const f = fracFromClientX(e.clientX);
          setHoverH(Math.min(23, Math.floor(f * 24)));
          if (draggingRef.current) onScrubFrac(f);
        }}
        onMouseUp={() => { draggingRef.current = false; }}
        onMouseLeave={() => {
          setHoverH(null);
          draggingRef.current = false;
        }}
        style={{
          position: "relative",
          height: TRACK_H,
          cursor: "pointer",
          userSelect: "none",
        }}
      >
        {/* future cover */}
        <span
          style={{
            position: "absolute", top: 0, bottom: 0,
            left: `${nowFrac * 100}%`, right: 0,
            background: "rgba(0,0,0,0.32)",
            borderLeft: "1px dashed rgba(255,255,255,0.12)",
          }}
        />

        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "flex-end", gap: 2 }}>
          {buckets.map((b) => {
            const hPct = (b.total / peak) * 100;
            const isFuture = b.h > Math.floor(nowFrac * 24);
            const isHover = hoverH === b.h;
            return (
              <div
                key={b.h}
                style={{
                  flex: 1, height: "100%",
                  display: "flex", flexDirection: "column", justifyContent: "flex-end",
                  opacity: isFuture ? 0.25 : 1,
                }}
              >
                <div
                  style={{
                    display: "flex", flexDirection: "column-reverse",
                    height: `${hPct}%`, minHeight: b.total ? 2 : 0,
                    borderRadius: 1.5, overflow: "hidden",
                    outline: isHover ? "1px solid rgba(255,255,255,0.35)" : "none",
                  }}
                >
                  {ALERT_GROUP_ORDER.map((g) => {
                    const v = b.parts[g];
                    if (!v) return null;
                    return (
                      <span
                        key={g}
                        style={{
                          height: `${(v / b.total) * 100}%`,
                          background: ALERT_GROUPS_DEF[g].color,
                          opacity: isHover ? 1 : 0.82,
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* playhead */}
        <span
          style={{
            position: "absolute", top: -2, bottom: -2,
            left: `${playbackFrac * 100}%`, width: 2, marginLeft: -1,
            background: isLive ? COLORS.statusLive : COLORS.accent,
            boxShadow: `0 0 6px ${isLive ? COLORS.statusLive : COLORS.accent}`,
            pointerEvents: "none", zIndex: 3,
          }}
        />
      </div>
    </div>
  );
}

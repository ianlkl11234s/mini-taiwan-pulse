import { useEffect, useMemo, useRef, useState } from "react";
import { IntelIcon, ICON } from "../IntelIcon";
import { COLORS, FONT_CJK, FONT_DATA, clockTime } from "../intelTokens";
import { NEWS_CATEGORIES, type NewsCategory } from "../../../data/newsEventTypes";
import type { ClusterEvent } from "../../../data/newsEventsLoader";

interface Props {
  /** 過濾後的當日 events（用於畫直方圖） */
  events: ClusterEvent[];
  /** 當日 00:00 unix 秒（asia/taipei） */
  dayStartTs: number;
  /** 當下 unix 秒 */
  nowTs: number;
  /** 當前 playback unix 秒（live 時 = nowTs） */
  playbackTs: number;
  isLive: boolean;
  playing: boolean;
  onScrub: (ts: number) => void;
  onLive: () => void;
  onTogglePlay: () => void;
}

interface HourlyBucket {
  h: number;
  c: Record<NewsCategory, number>;
  total: number;
}

const CAT_KEYS = NEWS_CATEGORIES.map((c) => c.key);

function bucketByHour(events: ClusterEvent[], dayStartTs: number): HourlyBucket[] {
  const buckets: HourlyBucket[] = Array.from({ length: 24 }, (_, h) => ({
    h,
    c: { accident: 0, crime: 0, disaster: 0, traffic: 0, health: 0, policy: 0, other: 0 },
    total: 0,
  }));
  for (const e of events) {
    if (!e.published_ts) continue;
    const diff = e.published_ts - dayStartTs;
    if (diff < 0 || diff >= 86400) continue;
    const h = Math.floor(diff / 3600);
    if (h < 0 || h > 23) continue;
    const k = (CAT_KEYS.includes((e.category ?? "other") as NewsCategory)
      ? (e.category as NewsCategory)
      : "other") as NewsCategory;
    const bucket = buckets[h]!;
    bucket.c[k] += 1;
    bucket.total += 1;
  }
  return buckets;
}

const TICKS = [0, 6, 12, 18, 24];

export function TimelineDock({
  events, dayStartTs, nowTs, playbackTs, isLive, playing,
  onScrub, onLive, onTogglePlay,
}: Props) {
  const [hoverH, setHoverH] = useState<number | null>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const SPAN = 86400;
  const frac = Math.max(0, Math.min(1, (playbackTs - dayStartTs) / SPAN));
  const nowFrac = Math.max(0, Math.min(1, (nowTs - dayStartTs) / SPAN));

  const buckets = useMemo(() => bucketByHour(events, dayStartTs), [events, dayStartTs]);
  const peak = Math.max(1, ...buckets.map((b) => b.total));

  const tsFromClientX = (clientX: number): number | null => {
    const el = areaRef.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const f = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
    return Math.min(nowTs, dayStartTs + f * SPAN);
  };
  const scrubFromEvent = (e: { clientX: number }) => {
    const ts = tsFromClientX(e.clientX);
    if (ts != null) onScrub(ts);
  };

  useEffect(() => {
    const move = (e: MouseEvent) => {
      if (draggingRef.current) scrubFromEvent(e);
    };
    const up = () => {
      draggingRef.current = false;
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hovered = hoverH != null ? buckets[hoverH]! : null;

  return (
    <div
      style={{
        flexShrink: 0, padding: "10px 16px 8px",
        borderBottom: `1px solid ${COLORS.panelBorder}`,
        background: "rgba(0,0,0,0.28)",
      }}
    >
      {/* top row */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <span
          style={{
            fontFamily: FONT_DATA, fontSize: 9, letterSpacing: "2px",
            color: COLORS.textMuted, whiteSpace: "nowrap",
          }}
        >
          時間軸 TIMELINE DOCK
        </span>
        <span style={{ fontFamily: FONT_CJK, fontSize: 9.5, color: COLORS.textFaint, whiteSpace: "nowrap" }}>
          新聞密度 · 每小時
        </span>
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {NEWS_CATEGORIES.map((c) => (
            <span
              key={c.key}
              title={c.label}
              style={{
                width: 8, height: 8, borderRadius: 2, background: c.color, opacity: 0.85,
              }}
            />
          ))}
        </div>
        <span style={{ width: 1, height: 16, background: COLORS.borderMid, margin: "0 2px" }} />
        <button
          onClick={onTogglePlay}
          title="play/pause"
          style={{
            width: 26, height: 26, borderRadius: 5,
            border: `1px solid ${COLORS.borderMid}`,
            background: "rgba(255,255,255,0.05)",
            color: COLORS.textDefault, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <IntelIcon
            d={playing ? ICON.pause : ICON.play}
            size={12}
            fill={playing ? "none" : "currentColor"}
          />
        </button>
        <span
          style={{
            fontFamily: FONT_DATA, fontSize: 12, fontWeight: 700,
            minWidth: 58, textAlign: "center",
            color: isLive ? COLORS.statusLive : COLORS.statusWarn,
          }}
        >
          {isLive ? "即時 NOW" : clockTime(playbackTs)}
        </span>
        <button
          onClick={onLive}
          style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            padding: "4px 10px", borderRadius: 5, cursor: "pointer",
            fontFamily: FONT_DATA, fontSize: 10, fontWeight: 700, letterSpacing: "0.5px",
            background: isLive ? COLORS.statusLiveSoft : "rgba(255,255,255,0.05)",
            border: isLive ? `1px solid ${COLORS.statusLiveBorder}` : `1px solid ${COLORS.borderMid}`,
            color: isLive ? COLORS.statusLive : COLORS.textMuted,
          }}
        >
          <span
            style={{
              width: 6, height: 6, borderRadius: "50%",
              background: isLive ? COLORS.statusLive : COLORS.textDim,
              boxShadow: isLive ? `0 0 6px ${COLORS.statusLive}` : "none",
            }}
          />
          LIVE
        </button>
      </div>

      {/* chart */}
      <div
        ref={areaRef}
        onMouseDown={(e) => {
          draggingRef.current = true;
          scrubFromEvent(e);
        }}
        onMouseLeave={() => setHoverH(null)}
        style={{ position: "relative", height: 84, cursor: "pointer", userSelect: "none" }}
      >
        {[0, 0.25, 0.5, 0.75, 1].map((g) => (
          <span
            key={g}
            style={{
              position: "absolute", left: 0, right: 0, top: `${g * 100}%`,
              height: 1, background: "rgba(255,255,255,0.05)",
            }}
          />
        ))}
        <span
          style={{
            position: "absolute", top: 0, bottom: 0,
            left: `${nowFrac * 100}%`, right: 0,
            background: "rgba(0,0,0,0.32)",
            borderLeft: "1px dashed rgba(255,255,255,0.12)",
          }}
        />

        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "flex-end", gap: 2 }}>
          {buckets.map((hd) => {
            const isHover = hoverH === hd.h;
            const isFuture = hd.h > Math.floor(nowFrac * 24);
            const hPct = (hd.total / peak) * 100;
            return (
              <div
                key={hd.h}
                onMouseEnter={() => setHoverH(hd.h)}
                style={{
                  flex: 1, height: "100%",
                  display: "flex", flexDirection: "column", justifyContent: "flex-end",
                  position: "relative", opacity: isFuture ? 0.25 : 1,
                }}
              >
                <div
                  style={{
                    display: "flex", flexDirection: "column-reverse",
                    height: `${hPct}%`, minHeight: hd.total ? 3 : 0,
                    borderRadius: 2, overflow: "hidden",
                    outline: isHover ? "1px solid rgba(255,255,255,0.35)" : "none",
                  }}
                >
                  {NEWS_CATEGORIES.map((c) =>
                    hd.c[c.key] ? (
                      <span
                        key={c.key}
                        style={{
                          height: `${(hd.c[c.key] / hd.total) * 100}%`,
                          background: c.color, opacity: isHover ? 1 : 0.82,
                        }}
                      />
                    ) : null,
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <span
          style={{
            position: "absolute", top: -3, bottom: -3,
            left: `${frac * 100}%`, width: 2, marginLeft: -1,
            background: isLive ? COLORS.statusLive : COLORS.accent,
            boxShadow: `0 0 8px ${isLive ? COLORS.statusLive : COLORS.accent}`,
            pointerEvents: "none", zIndex: 3,
          }}
        >
          <span
            style={{
              position: "absolute", top: -4, left: -3,
              width: 8, height: 8, borderRadius: "50%",
              background: isLive ? COLORS.statusLive : COLORS.accent,
            }}
          />
        </span>

        {hovered && (
          <div
            style={{
              position: "absolute", bottom: "100%", marginBottom: 6,
              left: `${((hovered.h + 0.5) / 24) * 100}%`,
              transform: "translateX(-50%)", zIndex: 5,
              background: "rgba(0,0,0,0.88)",
              border: `1px solid ${COLORS.borderMid}`, borderRadius: 7,
              padding: "7px 9px", whiteSpace: "nowrap", pointerEvents: "none",
              backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
              boxShadow: "0 6px 20px rgba(0,0,0,0.5)",
            }}
          >
            <div
              style={{
                fontFamily: FONT_DATA, fontSize: 10.5,
                color: "#fff", fontWeight: 700, marginBottom: 4,
              }}
            >
              {String(hovered.h).padStart(2, "0")}:00 · {hovered.total} 則
            </div>
            <div style={{ display: "flex", gap: 7, flexWrap: "wrap", maxWidth: 180 }}>
              {NEWS_CATEGORIES.filter((c) => hovered.c[c.key]).map((c) => (
                <span
                  key={c.key}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 3,
                    fontFamily: FONT_DATA, fontSize: 9.5, color: COLORS.textDefault,
                  }}
                >
                  <span
                    style={{
                      width: 6, height: 6, borderRadius: "50%", background: c.color,
                    }}
                  />
                  {c.label} {hovered.c[c.key]}
                </span>
              ))}
              {hovered.total === 0 && (
                <span style={{ fontFamily: FONT_CJK, fontSize: 9.5, color: COLORS.textFaint }}>
                  無事件
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      <div style={{ position: "relative", height: 14, marginTop: 3 }}>
        {TICKS.map((t) => (
          <span
            key={t}
            style={{
              position: "absolute", left: `${(t / 24) * 100}%`,
              transform:
                t === 0 ? "none" : t === 24 ? "translateX(-100%)" : "translateX(-50%)",
              fontFamily: FONT_DATA, fontSize: 9, color: COLORS.textFaint,
            }}
          >
            {t === 24 ? "23:59" : `${String(t).padStart(2, "0")}:00`}
          </span>
        ))}
      </div>
    </div>
  );
}

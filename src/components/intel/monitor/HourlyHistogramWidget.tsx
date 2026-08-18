import { useMemo } from "react";
import { COLORS, FONT_CJK, FONT_DATA } from "../intelTokens";
import { RADIUS, FONT_SIZE } from "../../../styles/designTokens";
import { NEWS_CATEGORIES, type NewsCategory } from "../../../data/newsEventTypes";
import type { ClusterEvent } from "../../../data/newsEventsLoader";
import { SectionLabel, Widget } from "./PressureRing";
import { useChartTooltip, fmtChartValue } from "../../ChartHoverTooltip";

interface HourlyBucket {
  h: number;
  c: Record<NewsCategory, number>;
  total: number;
}

const CAT_KEYS = NEWS_CATEGORIES.map((c) => c.key);

function bucketByHour(events: ClusterEvent[]): HourlyBucket[] {
  const buckets: HourlyBucket[] = Array.from({ length: 24 }, (_, h) => ({
    h,
    c: { accident: 0, crime: 0, disaster: 0, traffic: 0, health: 0, policy: 0, other: 0 },
    total: 0,
  }));
  for (const e of events) {
    if (!e.published_ts) continue;
    const h = new Date(e.published_ts * 1000).getHours();
    const k = (CAT_KEYS.includes((e.category ?? "other") as NewsCategory)
      ? (e.category as NewsCategory)
      : "other") as NewsCategory;
    const bucket = buckets[h];
    if (!bucket) continue;
    bucket.c[k] += 1;
    bucket.total += 1;
  }
  return buckets;
}

interface Props {
  events: ClusterEvent[];
}

export function HourlyHistogramWidget({ events }: Props) {
  const buckets = useMemo(() => bucketByHour(events), [events]);
  const peak = Math.max(1, ...buckets.map((b) => b.total));
  const nowHour = new Date().getHours();
  const tip = useChartTooltip();

  return (
    <Widget style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          flexShrink: 0,
        }}
      >
        <SectionLabel>24h 事件直方圖 · BREAKDOWN</SectionLabel>
        <div
          style={{
            display: "flex", flexWrap: "wrap", justifyContent: "flex-end",
            gap: "4px 9px", marginBottom: 9, maxWidth: "62%",
          }}
        >
          {NEWS_CATEGORIES.map((c) => (
            <span
              key={c.key}
              style={{
                display: "inline-flex", alignItems: "center", gap: 3,
                fontFamily: FONT_CJK, fontSize: FONT_SIZE.xs, color: COLORS.textDim,
                whiteSpace: "nowrap",
              }}
            >
              <span
                style={{
                  width: 7, height: 7, borderRadius: RADIUS.sm, background: c.color,
                }}
              />
              {c.label}
            </span>
          ))}
        </div>
      </div>
      <div
        style={{
          display: "flex", alignItems: "flex-end", gap: 2,
          flex: 1, minHeight: 0, position: "relative",
        }}
      >
        {[0.5, 1].map((g) => (
          <span
            key={g}
            style={{
              position: "absolute", left: 0, right: 0, bottom: `${g * 100}%`,
              height: 1, background: "rgba(255,255,255,0.05)",
            }}
          />
        ))}
        {buckets.map((hd) => {
          const isFuture = hd.h > nowHour;
          return (
            <div
              key={hd.h}
              {...tip.bind(() => ({
                title: `${String(hd.h).padStart(2, "0")}:00`,
                rows: NEWS_CATEGORIES.filter((c) => hd.c[c.key]).map((c) => ({
                  dot: c.color, label: c.label, value: fmtChartValue(hd.c[c.key], "則"),
                })),
                note: `共 ${hd.total} 則`,
              }))}
              style={{
                flex: 1, display: "flex", flexDirection: "column-reverse",
                height: `${(hd.total / peak) * 100}%`,
                minHeight: hd.total ? 3 : 0,
                borderRadius: RADIUS.sm, overflow: "hidden",
                opacity: isFuture ? 0.25 : 1,
              }}
            >
              {NEWS_CATEGORIES.map((c) =>
                hd.c[c.key] ? (
                  <span
                    key={c.key}
                    style={{
                      height: `${(hd.c[c.key] / hd.total) * 100}%`,
                      background: c.color, opacity: 0.82,
                    }}
                  />
                ) : null,
              )}
            </div>
          );
        })}
      </div>
      <div
        style={{
          display: "flex", justifyContent: "space-between", marginTop: 4,
          fontFamily: FONT_DATA, fontSize: FONT_SIZE.xs, color: COLORS.textFaint,
          flexShrink: 0,
        }}
      >
        <span>00:00</span>
        <span>06:00</span>
        <span>12:00</span>
        <span>18:00</span>
        <span>23:59</span>
      </div>
      {tip.node}
    </Widget>
  );
}

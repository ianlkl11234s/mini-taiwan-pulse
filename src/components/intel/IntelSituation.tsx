import { useMemo, useState } from "react";
import { IntelIcon, ICON } from "./IntelIcon";
import { COLORS, FONT_CJK, FONT_DATA } from "./intelTokens";
import { RADIUS, FONT_SIZE } from "../../styles/designTokens";
import { NEWS_CATEGORIES, getNewsCategoryDef, type NewsCategory } from "../../data/newsEventTypes";
import type { ClusterEvent } from "../../data/newsEventsLoader";
import type { TrendingRow } from "../../data/intelLoaders";

interface Props {
  /** 視窗內已過濾的 flat events */
  events: ClusterEvent[];
  /** events 對應 county 對照（按 id 對照表，由父層算） */
  countyByEventId: Map<number, string>;
  /** 升溫 RPC 結果，給「🔥」顯示 */
  trending: TrendingRow[];
}

const CAT_KEYS = NEWS_CATEGORIES.map((c) => c.key);

interface HourlyBucket {
  h: number;
  c: Record<NewsCategory, number>;
  total: number;
}

function bucketEventsByHour(events: ClusterEvent[]): HourlyBucket[] {
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

interface Hotspot {
  county: string;
  n: number;
  topCat: NewsCategory;
  surge: boolean;
}

function rankHotspots(
  events: ClusterEvent[],
  countyByEventId: Map<number, string>,
  trendingKeys: Set<string>,
): Hotspot[] {
  const byCounty: Record<string, { n: number; cats: Record<string, number> }> = {};
  for (const e of events) {
    const county = countyByEventId.get(e.id) ?? "";
    if (!county || county === "全國") continue;
    const cat = (e.category as NewsCategory) ?? "other";
    if (!byCounty[county]) byCounty[county] = { n: 0, cats: {} };
    const slot = byCounty[county]!;
    slot.n += 1;
    slot.cats[cat] = (slot.cats[cat] ?? 0) + 1;
  }
  return Object.entries(byCounty)
    .map(([county, v]) => {
      const top = Object.entries(v.cats).sort((a, b) => b[1] - a[1])[0];
      const topCat = (top?.[0] ?? "other") as NewsCategory;
      return {
        county,
        n: v.n,
        topCat,
        surge: trendingKeys.has(`${county}|${topCat}`),
      };
    })
    .sort((a, b) => b.n - a.n);
}

export function IntelSituation({ events, countyByEventId, trending }: Props) {
  const [open, setOpen] = useState(true);

  const trendingKeys = useMemo(() => {
    const s = new Set<string>();
    for (const r of trending) {
      if (r.surge_ratio != null && r.surge_ratio >= 2) s.add(`${r.county}|${r.category}`);
    }
    return s;
  }, [trending]);

  const buckets = useMemo(() => bucketEventsByHour(events), [events]);
  const dayTotal = events.length;
  const peak = Math.max(1, ...buckets.map((b) => b.total));
  const nowHour = new Date().getHours();

  const hotspots = useMemo(
    () => rankHotspots(events, countyByEventId, trendingKeys),
    [events, countyByEventId, trendingKeys],
  );
  const maxHot = hotspots.length ? hotspots[0]!.n : 1;

  // 分級摘要
  const triage = useMemo(() => {
    let event = 0;
    let statement = 0;
    let majorGis = 0;
    let majorSev = 0;
    for (const e of events) {
      if (e.is_event === false) statement += 1;
      else event += 1;
      if (e.gis_relevance === 3) majorGis += 1;
      if (e.severity === 3) majorSev += 1;
    }
    return { event, statement, majorGis, majorSev };
  }, [events]);

  return (
    <div
      style={{
        flexShrink: 0,
        padding: "9px 14px 10px",
        borderBottom: `1px solid ${COLORS.borderSoft}`,
        background: "rgba(255,255,255,0.015)",
      }}
    >
      {/* header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: open ? 8 : 0 }}>
        <button
          onClick={() => setOpen((v) => !v)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: 0,
            border: "none",
            background: "transparent",
            cursor: "pointer",
            color: COLORS.textMuted,
          }}
        >
          <IntelIcon d={open ? ICON.chevDown : ICON.chevRight} size={11} color={COLORS.textDim} />
          <span
            style={{
              fontFamily: FONT_DATA,
              fontSize: 9.5,
              letterSpacing: "1.8px",
              color: COLORS.textMuted,
              whiteSpace: "nowrap",
            }}
          >
            現況 SITUATION
          </span>
        </button>
        <span style={{ fontFamily: FONT_DATA, fontSize: 9.5, color: COLORS.textFaint, whiteSpace: "nowrap" }}>
          {dayTotal} 則
        </span>
      </div>

      {open && (
        <>
          {/* mini 24h histogram */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <span
              style={{
                fontFamily: FONT_DATA,
                fontSize: 8.5,
                letterSpacing: "1px",
                color: COLORS.textFaint,
                whiteSpace: "nowrap",
              }}
            >
              24h 直方圖
            </span>
            <div style={{ flex: 1 }} />
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {NEWS_CATEGORIES.map((c) => (
                <span
                  key={c.key}
                  title={c.label}
                  style={{ width: 7, height: 7, borderRadius: RADIUS.sm, background: c.color, opacity: 0.85 }}
                />
              ))}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 1.5, height: 34, position: "relative" }}>
            <span
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: "50%",
                height: 1,
                background: "rgba(255,255,255,0.05)",
              }}
            />
            {buckets.map((b) => {
              const isFuture = b.h > nowHour;
              return (
                <div
                  key={b.h}
                  title={`${String(b.h).padStart(2, "0")}:00 · ${b.total} 則`}
                  style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column-reverse",
                    height: `${(b.total / peak) * 100}%`,
                    minHeight: b.total ? 2 : 0,
                    borderRadius: 1.5,
                    overflow: "hidden",
                    opacity: isFuture ? 0.22 : 1,
                  }}
                >
                  {NEWS_CATEGORIES.map((c) =>
                    b.c[c.key] ? (
                      <span
                        key={c.key}
                        style={{
                          height: `${(b.c[c.key] / b.total) * 100}%`,
                          background: c.color,
                          opacity: 0.82,
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
              display: "flex",
              justifyContent: "space-between",
              marginTop: 2,
              fontFamily: FONT_DATA,
              fontSize: FONT_SIZE.xs,
              color: COLORS.textGhost,
            }}
          >
            <span>00:00</span>
            <span>12:00</span>
            <span>23:59</span>
          </div>

          {/* divider */}
          <div style={{ height: 1, background: COLORS.borderSoft, margin: "9px 0 8px" }} />

          {/* 熱區 TOP 5 */}
          <div
            style={{
              fontFamily: FONT_DATA,
              fontSize: 8.5,
              letterSpacing: "1px",
              color: COLORS.textFaint,
              marginBottom: 6,
            }}
          >
            熱區 TOP 5 · HOTSPOTS
          </div>
          {hotspots.length === 0 ? (
            <div style={{ fontFamily: FONT_CJK, fontSize: FONT_SIZE.sm, color: COLORS.textFaint, padding: "2px 0" }}>
              ⚠ 尚無資料
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {hotspots.slice(0, 5).map((r, i) => {
                const cat = getNewsCategoryDef(r.topCat);
                return (
                  <div key={r.county} style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <span style={{ fontFamily: FONT_DATA, fontSize: FONT_SIZE.xs, color: COLORS.textDim, width: 9 }}>
                      {i + 1}
                    </span>
                    <span
                      style={{ width: 7, height: 7, borderRadius: RADIUS.full, background: cat.color, flexShrink: 0 }}
                    />
                    <span
                      style={{
                        fontFamily: FONT_CJK,
                        fontSize: 10.5,
                        color: COLORS.textDefault,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {r.county}
                    </span>
                    <div
                      style={{
                        flex: 1,
                        height: 4,
                        borderRadius: RADIUS.sm,
                        background: "rgba(255,255,255,0.05)",
                        overflow: "hidden",
                        minWidth: 14,
                      }}
                    >
                      <span
                        style={{
                          display: "block",
                          height: "100%",
                          width: `${(r.n / maxHot) * 100}%`,
                          background: cat.color,
                          opacity: 0.7,
                        }}
                      />
                    </div>
                    {r.surge && (
                      <span style={{ fontFamily: FONT_CJK, fontSize: 8.5, color: COLORS.statusWarn }}>🔥</span>
                    )}
                    <span
                      style={{
                        fontFamily: FONT_DATA,
                        fontSize: FONT_SIZE.base,
                        fontWeight: 700,
                        color: "#fff",
                        width: 16,
                        textAlign: "right",
                      }}
                    >
                      {r.n}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* triage one-liner */}
          <div
            style={{
              marginTop: 9,
              paddingTop: 8,
              borderTop: `1px solid ${COLORS.borderSoft}`,
              display: "flex",
              alignItems: "center",
              gap: 11,
              fontFamily: FONT_DATA,
              fontSize: 9.5,
              flexWrap: "wrap",
            }}
          >
            <span style={{ color: COLORS.textFaint, letterSpacing: "1px" }}>分級</span>
            <span style={{ color: COLORS.accent }}>事件 {triage.event}</span>
            <span style={{ color: COLORS.textDim }}>聲明 {triage.statement}</span>
            <span style={{ color: COLORS.statusWarn }}>地理重大 {triage.majorGis}</span>
            <span style={{ color: COLORS.statusErr }}>嚴重級 {triage.majorSev}</span>
          </div>
        </>
      )}
    </div>
  );
}

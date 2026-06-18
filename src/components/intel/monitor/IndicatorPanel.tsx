import { useMemo } from "react";
import { IntelIcon } from "../IntelIcon";
import {
  COLORS, FONT_CJK, FONT_DATA, MICON, GIS_LEVELS, SEV_LEVELS,
  type AlertGroupShort,
} from "../intelTokens";
import { AlertBoard } from "../alerts/AlertBoard";
import type { AlertTally } from "../../../data/alertsLoader";
import {
  NEWS_CATEGORIES, getNewsCategoryDef, type NewsCategory,
} from "../../../data/newsEventTypes";
import type { ClusterEvent } from "../../../data/newsEventsLoader";
import type {
  PressureIndexNow, MarketIndex, PlaActivity, PublicHealthWeek, SourceHealthSummary,
} from "../../../data/intelLoaders";
import { SectionLabel, Widget } from "./PressureRing";
import { SituationOverview } from "./SituationOverview";
import { SituationCards } from "./SituationCards";
import { LiveWall } from "./LiveWall";
import { HazardWatchStrip } from "./HazardWatchStrip";

interface Props {
  events: ClusterEvent[];
  countyByEventId: Map<number, string>;
  pressure: PressureIndexNow;
  smoothedScore: number;
  market: MarketIndex;
  pla: PlaActivity;
  health: PublicHealthWeek;
  sourceHealth: SourceHealthSummary;
  /** 全天總則數，給 hourly 直方圖 + KPI */
  totalToday: number;
  /** 點熱區 row → 切到該縣市 */
  onPickHotspot: (county: string) => void;
  alertTally: AlertTally;
  alertSeries: Record<AlertGroupShort, number[]>;
  nowTs: number;
}

interface Hotspot {
  county: string;
  n: number;
  topCat: NewsCategory;
  surge: number;
  cats: Record<string, number>;
}

function rankHotspots(events: ClusterEvent[], countyById: Map<number, string>): Hotspot[] {
  const byCounty: Record<string, { n: number; cats: Record<string, number> }> = {};
  for (const e of events) {
    const county = countyById.get(e.id);
    if (!county || county === "全國" || county === "全部") continue;
    if (!byCounty[county]) byCounty[county] = { n: 0, cats: {} };
    const slot = byCounty[county]!;
    slot.n += 1;
    const cat = (e.category ?? "other") as string;
    slot.cats[cat] = (slot.cats[cat] ?? 0) + 1;
  }
  const out: Hotspot[] = [];
  for (const [county, v] of Object.entries(byCounty)) {
    const top = Object.entries(v.cats).sort((a, b) => b[1] - a[1])[0];
    const topCat = (top?.[0] ?? "other") as NewsCategory;
    out.push({
      county, n: v.n, topCat,
      surge: +(1 + v.n * 0.28).toFixed(1),
      cats: v.cats,
    });
  }
  out.sort((a, b) => b.n - a.n);
  return out;
}

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

function DistBar({
  label, levels, counts,
}: {
  label: string;
  levels: { label: string; color: string }[];
  counts: number[];
}) {
  const total = counts.reduce((a, b) => a + b, 0) || 1;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span
        style={{
          fontFamily: FONT_DATA, fontSize: 9, letterSpacing: "0.5px",
          color: COLORS.textDim,
        }}
      >
        {label}
      </span>
      <div
        style={{
          display: "flex", height: 9, borderRadius: 3, overflow: "hidden",
          background: "rgba(255,255,255,0.04)",
        }}
      >
        {levels.map((lv, i) =>
          counts[i] ? (
            <span
              key={i}
              title={`${lv.label} · ${counts[i]}`}
              style={{
                width: `${((counts[i] ?? 0) / total) * 100}%`, background: lv.color,
              }}
            />
          ) : null,
        )}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "3px 9px" }}>
        {levels.map((lv, i) => (
          <span
            key={i}
            style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              fontFamily: FONT_CJK, fontSize: 9.5,
              color: counts[i] ? COLORS.textDefault : COLORS.textGhost,
              whiteSpace: "nowrap",
            }}
          >
            <span
              style={{
                width: 7, height: 7, borderRadius: 2, background: lv.color,
                opacity: counts[i] ? 1 : 0.4,
              }}
            />
            {lv.label}{" "}
            <b
              style={{
                fontFamily: FONT_DATA,
                color: counts[i] ? "#fff" : COLORS.textFaint,
              }}
            >
              {counts[i] ?? 0}
            </b>
          </span>
        ))}
      </div>
    </div>
  );
}

export function IndicatorPanel({
  events, countyByEventId, pressure, smoothedScore, market, pla, health,
  sourceHealth, totalToday, onPickHotspot,
  alertTally, alertSeries, nowTs,
}: Props) {
  const stats = useMemo(() => {
    const ranked = rankHotspots(events, countyByEventId);
    const severe = events.filter((e) => (e.severity ?? 0) >= 3).length;
    return { ranked, severe };
  }, [events, countyByEventId]);

  const buckets = useMemo(() => bucketByHour(events), [events]);
  const peak = Math.max(1, ...buckets.map((b) => b.total));
  const nowHour = new Date().getHours();

  const tri = useMemo(() => {
    const gis = [0, 0, 0, 0];
    const sev = [0, 0, 0, 0];
    let ev = 0, st = 0;
    for (const e of events) {
      const g = Math.max(0, Math.min(3, e.gis_relevance ?? 0));
      const s = Math.max(0, Math.min(3, e.severity ?? 0));
      gis[g] = (gis[g] ?? 0) + 1;
      sev[s] = (sev[s] ?? 0) + 1;
      if (e.is_event === false) st += 1;
      else ev += 1;
    }
    return { gis, sev, event: ev, statement: st };
  }, [events]);

  const maxHot = stats.ranked.length ? stats.ranked[0]!.n : 1;

  return (
    <div
      className="mtp-scroll"
      style={{
        flex: 1, minWidth: 0, overflowY: "auto",
        padding: "14px 16px 18px",
        display: "grid", gridTemplateColumns: "1fr 1.3fr",
        gap: 13, alignContent: "start",
      }}
    >
      <SituationOverview
        pressure={pressure}
        smoothedScore={smoothedScore}
        market={market}
        sourceHealth={sourceHealth}
        totalEvents={events.length}
        severeCount={stats.severe}
      />

      <SituationCards pla={pla} health={health} />

      <LiveWall />

      <HazardWatchStrip />

      <div style={{ gridColumn: "1 / -1" }}>
        <AlertBoard
          tally={alertTally}
          series={alertSeries}
          accent={COLORS.accent}
          nowTs={nowTs}
        />
      </div>

      {/* 熱區 Top 5 */}
      <Widget>
        <SectionLabel>熱區 Top 5 · HOTSPOTS</SectionLabel>
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {stats.ranked.slice(0, 5).map((r, i) => {
            const cat = getNewsCategoryDef(r.topCat);
            return (
              <button
                key={r.county}
                onClick={() => onPickHotspot(r.county)}
                style={{
                  display: "flex", alignItems: "center", gap: 9,
                  padding: "6px 8px", borderRadius: 6, cursor: "pointer",
                  background: "rgba(255,255,255,0.02)",
                  border: `1px solid ${COLORS.borderSoft}`,
                  textAlign: "left", transition: "background .12s",
                }}
                onMouseEnter={(ev) =>
                  (ev.currentTarget.style.background = "rgba(255,255,255,0.06)")
                }
                onMouseLeave={(ev) =>
                  (ev.currentTarget.style.background = "rgba(255,255,255,0.02)")
                }
              >
                <span
                  style={{
                    fontFamily: FONT_DATA, fontSize: 11, fontWeight: 700,
                    color: COLORS.textDim, width: 14,
                  }}
                >
                  {i + 1}
                </span>
                <span
                  style={{
                    width: 8, height: 8, borderRadius: "50%",
                    background: cat.color, flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    fontFamily: FONT_CJK, fontSize: 12,
                    color: COLORS.textStrong, whiteSpace: "nowrap",
                  }}
                >
                  {r.county}
                </span>
                <span
                  style={{
                    fontFamily: FONT_CJK, fontSize: 9.5, color: cat.color,
                    padding: "1px 6px", borderRadius: 3,
                    background: `${cat.color}1f`, whiteSpace: "nowrap",
                  }}
                >
                  {cat.label}
                </span>
                <div
                  style={{
                    flex: 1, height: 5, borderRadius: 3,
                    background: "rgba(255,255,255,0.05)",
                    overflow: "hidden", minWidth: 20,
                  }}
                >
                  <span
                    style={{
                      display: "block", height: "100%",
                      width: `${(r.n / maxHot) * 100}%`,
                      background: cat.color, opacity: 0.7,
                    }}
                  />
                </div>
                <span
                  style={{
                    fontFamily: FONT_DATA, fontSize: 13, fontWeight: 700,
                    color: "#fff", width: 18, textAlign: "right",
                  }}
                >
                  {r.n}
                </span>
                <span
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 2,
                    fontFamily: FONT_DATA, fontSize: 9.5,
                    color: r.surge >= 2 ? COLORS.statusWarn : COLORS.textDim,
                    width: 40,
                  }}
                >
                  {r.surge >= 2 && (
                    <IntelIcon d={MICON.flame!} size={10} color={COLORS.statusWarn} />
                  )}
                  ×{r.surge}
                </span>
              </button>
            );
          })}
          {stats.ranked.length === 0 && (
            <div
              style={{
                fontFamily: FONT_CJK, fontSize: 11, color: COLORS.textFaint,
                padding: "10px 2px",
              }}
            >
              ⚠ 尚無資料
            </div>
          )}
        </div>
      </Widget>

      {/* 24h stacked histogram */}
      <Widget>
        <div
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
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
                  fontFamily: FONT_CJK, fontSize: 9, color: COLORS.textDim,
                  whiteSpace: "nowrap",
                }}
              >
                <span
                  style={{
                    width: 7, height: 7, borderRadius: 2, background: c.color,
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
            height: 118, position: "relative",
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
                title={`${String(hd.h).padStart(2, "0")}:00 · ${hd.total} 則`}
                style={{
                  flex: 1, display: "flex", flexDirection: "column-reverse",
                  height: `${(hd.total / peak) * 100}%`,
                  minHeight: hd.total ? 3 : 0,
                  borderRadius: 2, overflow: "hidden",
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
            fontFamily: FONT_DATA, fontSize: 9, color: COLORS.textFaint,
          }}
        >
          <span>00:00</span>
          <span>06:00</span>
          <span>12:00</span>
          <span>18:00</span>
          <span>23:59</span>
        </div>
      </Widget>

      {/* TRIAGE */}
      <Widget style={{ gridColumn: "1 / -1" }}>
        <SectionLabel>信號分級 · TRIAGE</SectionLabel>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18 }}>
          <DistBar label="地理相關 GIS_RELEVANCE" levels={GIS_LEVELS} counts={tri.gis} />
          <DistBar label="嚴重程度 SEVERITY" levels={SEV_LEVELS} counts={tri.sev} />
          <DistBar
            label="事件性質 IS_EVENT"
            levels={[
              { label: "事件", color: COLORS.accent },
              { label: "聲明", color: COLORS.textDim },
            ]}
            counts={[tri.event, tri.statement]}
          />
        </div>
      </Widget>

      {/* small footer with today total */}
      <div
        style={{
          gridColumn: "1 / -1",
          fontFamily: FONT_DATA, fontSize: 9, color: COLORS.textFaint,
          textAlign: "right",
        }}
      >
        今日累計 {totalToday} 則
      </div>
    </div>
  );
}

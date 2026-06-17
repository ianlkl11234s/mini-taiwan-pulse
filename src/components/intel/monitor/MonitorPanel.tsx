import { useEffect, useMemo, useRef, useState } from "react";
import { IntelIcon, ICON } from "../IntelIcon";
import { COLORS, FONT_CJK, FONT_DATA, MICON, smoothPressure } from "../intelTokens";
import { IntelCard, type IntelCardEvent } from "../IntelCard";
import { IntelFilters, type TimeRange } from "../IntelFilters";
import {
  fetchSourceHealth, fetchNewsTrending, trendingKeys as buildTrendingKeys,
  fetchPressureIndex, fetchMarketIndex, fetchPlaActivity, fetchPublicHealthWeekly,
  type SourceHealthSummary, type TrendingRow,
  type PressureIndexNow, type MarketIndex, type PlaActivity, type PublicHealthWeek,
} from "../../../data/intelLoaders";
import {
  fetchNewsEventsDayClusters, type NewsFilter,
} from "../../../data/newsEventsLoader";
import type { NewsCategory } from "../../../data/newsEventTypes";
import { timeStore } from "../../../state/timeStore";
import { TimelineDock } from "./TimelineDock";
import { IndicatorPanel } from "./IndicatorPanel";

const EMPTY_HEALTH: SourceHealthSummary = {
  total: 0, ok: 0, lagging: 0, degraded: 0, unknown: 0, rows: [],
};
const EMPTY_PRESSURE: PressureIndexNow = {
  composite: 0, level: null, vs_baseline: 0, vs_1h_ago: 0, per_signal: [], asof: null,
};
const EMPTY_MARKET: MarketIndex = {
  index: 0, prev_close: 0, open: 0, high: 0, low: 0, change: 0, change_pct: 0,
  turnover: null, time: null, status: null,
};
const EMPTY_PLA: PlaActivity = {
  sorties: 0, crossed_median: 0, plan_vessels: 0, official_ships: 0,
  adiz: [
    { key: "north", label: "北", active: false },
    { key: "central", label: "中", active: false },
    { key: "southwest", label: "西南", active: false },
    { key: "east", label: "東", active: false },
  ],
  as_of: "今日 06:00",
  source: "中華民國國防部 @MoNDefense · 每日 06:00 (UTC+8) 截止",
  title: "中共解放軍臺海周邊海、空域動態",
};
const EMPTY_HEALTH_WEEK: PublicHealthWeek = { week: 0, diseases: [] };

const RANGE_SEC: Record<TimeRange, number> = { "1h": 3600, "6h": 21600, "24h": 86400 };

/** Taipei 00:00 of a YYYY-MM-DD string → unix seconds */
function dayKeyToStartTs(key: string): number {
  if (!key || key.length < 10) return Math.floor(Date.now() / 1000) - 8 * 3600;
  // "2026-06-13" → "2026-06-13T00:00:00+08:00"
  const ms = Date.parse(`${key}T00:00:00+08:00`);
  return Math.floor(ms / 1000);
}

interface Cluster {
  county: string | null;
  location_name: string | null;
  lon: number | null;
  lat: number | null;
  events: IntelCardEvent[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  filter: NewsFilter;
  onFilterChange: (next: NewsFilter) => void;
  onSelectLocation?: (lon: number, lat: number) => void;
  externalSelectedId?: number | null;
}

export function MonitorPanel({
  open, onClose, filter, onFilterChange, onSelectLocation, externalSelectedId,
}: Props) {
  // ── playback state（與 Phase 1 IntelPanel 各自獨立）──
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  const [isLive, setIsLive] = useState(true);
  const [playbackTs, setPlaybackTs] = useState(now);
  const [playing, setPlaying] = useState(false);
  const [timeRange, setTimeRange] = useState<TimeRange>("24h");
  const [cats, setCats] = useState<NewsCategory[]>([]);
  const [county, setCounty] = useState("全部");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const [dayKey, setDayKey] = useState(() => timeStore.getDateKey());

  // ── 面板尺寸 + wall mode ──
  const [height, setHeight] = useState(0.62);
  const [wall, setWall] = useState(false);

  // ── 全部資料 ──
  const [sourceHealth, setSourceHealth] = useState<SourceHealthSummary>(EMPTY_HEALTH);
  const [trending, setTrending] = useState<TrendingRow[]>([]);
  const [pressure, setPressure] = useState<PressureIndexNow>(EMPTY_PRESSURE);
  const [smoothed, setSmoothed] = useState<number>(0);
  const [market, setMarket] = useState<MarketIndex>(EMPTY_MARKET);
  const [pla, setPla] = useState<PlaActivity>(EMPTY_PLA);
  const [health, setHealth] = useState<PublicHealthWeek>(EMPTY_HEALTH_WEEK);
  const [clusters, setClusters] = useState<Cluster[]>([]);

  // tick now（顯示 + countdown）
  useEffect(() => {
    if (!open) return;
    const id = window.setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => window.clearInterval(id);
  }, [open]);

  // 30s pressure + market + source health + trending
  useEffect(() => {
    if (!open) return;
    let alive = true;
    const tick = () => {
      fetchPressureIndex().then((p) => {
        if (!alive) return;
        setPressure(p);
        setSmoothed((prev) => smoothPressure(prev || null, p.composite));
      });
      fetchMarketIndex().then((m) => alive && setMarket(m));
      fetchSourceHealth().then((s) => alive && setSourceHealth(s));
      fetchNewsTrending(1, 50).then((t) => alive && setTrending(t));
    };
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [open]);

  // 30min PLA + week-once Health
  useEffect(() => {
    if (!open) return;
    let alive = true;
    fetchPlaActivity().then((p) => alive && setPla(p));
    fetchPublicHealthWeekly().then((h) => alive && setHealth(h));
    const id = window.setInterval(() => {
      if (!alive) return;
      fetchPlaActivity().then((p) => alive && setPla(p));
    }, 30 * 60 * 1000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [open]);

  // ── 訂閱 timeStore 日期變化（rule 6）→ 重抓 clusters ──
  const fKey = `${filter.minRelevance}|${filter.eventsOnly ? 1 : 0}|${filter.minSeverity}`;
  useEffect(() => {
    if (!open) return;
    let alive = true;
    const handler = (key: string) => {
      if (!key) return;
      setDayKey(key);
      fetchNewsEventsDayClusters(key, filter).then((rows) => {
        if (!alive) return;
        const built: Cluster[] = rows.map((r) => {
          const events = (r.events ?? []).map<IntelCardEvent>((e, idx, arr) => ({
            ...e,
            county: r.county ?? undefined,
            location_name: r.location_name ?? undefined,
            related_count: Math.max(0, arr.length - 1 - idx),
          }));
          return {
            county: r.county,
            location_name: r.location_name,
            lon: r.lon,
            lat: r.lat,
            events,
          };
        });
        setClusters(built);
      });
    };
    handler(timeStore.getDateKey());
    const unsub = timeStore.subscribeDate(handler);
    return () => {
      alive = false;
      unsub();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, fKey]);

  // playback animation
  const spanRef = useRef(RANGE_SEC[timeRange]);
  spanRef.current = RANGE_SEC[timeRange];
  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      setPlaybackTs((p) => {
        const next = p + spanRef.current / 90;
        const nowNow = Math.floor(Date.now() / 1000);
        if (next >= nowNow) {
          setPlaying(false);
          setIsLive(true);
          return nowNow;
        }
        return next;
      });
    }, 70);
    return () => window.clearInterval(id);
  }, [playing]);

  // external selection
  useEffect(() => {
    if (externalSelectedId == null) return;
    setSelectedId(externalSelectedId);
    setExpandedId(externalSelectedId);
  }, [externalSelectedId]);

  const effectivePlayback = isLive ? now : playbackTs;
  const dayStartTs = useMemo(() => dayKeyToStartTs(dayKey), [dayKey]);

  // flat events (filtered)
  const flatEvents = useMemo<IntelCardEvent[]>(() => {
    const out: IntelCardEvent[] = [];
    const windowStart = isLive ? dayStartTs : now - RANGE_SEC[timeRange];
    for (const c of clusters) {
      for (const e of c.events) {
        if (e.published_ts < windowStart) continue;
        if (e.published_ts > effectivePlayback) continue;
        if (cats.length > 0 && !cats.includes((e.category ?? "other") as NewsCategory)) continue;
        if (county !== "全部" && (c.county ?? "") !== county) continue;
        out.push(e);
      }
    }
    out.sort((a, b) => b.published_ts - a.published_ts);
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clusters, cats, county, effectivePlayback, timeRange, isLive, dayStartTs]);

  // 全天版本（給 TimelineDock + IndicatorPanel histogram 用，不受 timeRange 窗影響）
  const allEventsToday = useMemo<IntelCardEvent[]>(() => {
    const out: IntelCardEvent[] = [];
    for (const c of clusters) {
      for (const e of c.events) {
        if (cats.length > 0 && !cats.includes((e.category ?? "other") as NewsCategory)) continue;
        if (county !== "全部" && (c.county ?? "") !== county) continue;
        out.push(e);
      }
    }
    out.sort((a, b) => b.published_ts - a.published_ts);
    return out;
  }, [clusters, cats, county]);

  const countyByEventId = useMemo(() => {
    const m = new Map<number, string>();
    for (const c of clusters) for (const e of c.events) m.set(e.id, c.county ?? "");
    return m;
  }, [clusters]);

  const locByEventId = useMemo(() => {
    const m = new Map<number, { lon: number; lat: number }>();
    for (const c of clusters) {
      if (c.lon == null || c.lat == null) continue;
      for (const e of c.events) m.set(e.id, { lon: c.lon, lat: c.lat });
    }
    return m;
  }, [clusters]);

  const trendingKeySet = useMemo(() => buildTrendingKeys(trending), [trending]);
  const isTrendingFor = (e: IntelCardEvent) => {
    const c = countyByEventId.get(e.id);
    if (!c) return false;
    return trendingKeySet.has(`${c}|${e.category ?? "other"}`);
  };

  // resize drag
  const draggingRef = useRef(false);
  useEffect(() => {
    if (!open || wall) return;
    const move = (e: MouseEvent) => {
      if (!draggingRef.current) return;
      const f = (window.innerHeight - e.clientY) / window.innerHeight;
      setHeight(Math.max(0.3, Math.min(0.92, f)));
    };
    const up = () => {
      draggingRef.current = false;
      document.body.style.cursor = "";
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
  }, [open, wall]);

  if (!open) return null;

  const onScrub = (ts: number) => {
    setPlaybackTs(ts);
    setIsLive(ts >= now);
    setPlaying(false);
  };
  const goLive = () => {
    setIsLive(true);
    setPlaying(false);
    setPlaybackTs(now);
  };
  const togglePlay = () => {
    if (playing) {
      setPlaying(false);
      return;
    }
    if (isLive || playbackTs >= now) setPlaybackTs(now - RANGE_SEC[timeRange]);
    setIsLive(false);
    setPlaying(true);
  };
  const onSelectCard = (id: number) => {
    setSelectedId(id);
    const loc = locByEventId.get(id);
    if (loc && onSelectLocation) onSelectLocation(loc.lon, loc.lat);
  };
  const onToggleExpand = (id: number) => setExpandedId((p) => (p === id ? null : id));
  const toggleCat = (k: NewsCategory) =>
    setCats((c) => (c.includes(k) ? c.filter((x) => x !== k) : [...c, k]));

  const onPickHotspot = (cty: string) => {
    setCounty(cty);
    const ev = allEventsToday.find(
      (e) => countyByEventId.get(e.id) === cty && e.published_ts <= effectivePlayback,
    );
    if (ev) {
      setSelectedId(ev.id);
      setExpandedId(ev.id);
      const loc = locByEventId.get(ev.id);
      if (loc && onSelectLocation) onSelectLocation(loc.lon, loc.lat);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        left: wall ? 0 : 64,
        right: 14,
        bottom: wall ? 0 : 14,
        top: wall ? 0 : "auto",
        height: wall ? "auto" : `${height * 100}vh`,
        background: wall ? "rgba(6,7,11,0.97)" : "rgba(8,9,13,0.86)",
        backdropFilter: "blur(18px)",
        WebkitBackdropFilter: "blur(18px)",
        borderTop: wall ? "none" : `1px solid ${COLORS.borderMid}`,
        border: wall ? "none" : `1px solid ${COLORS.panelBorder}`,
        borderRadius: wall ? 0 : 10,
        zIndex: 40,
        display: "flex", flexDirection: "column",
        overflow: "hidden",
        boxShadow: wall ? "none" : "0 -16px 50px rgba(0,0,0,0.5)",
        animation: "monitorRise .32s cubic-bezier(0.22,1,0.36,1)",
      }}
    >
      {/* drag handle + header */}
      <div
        style={{
          flexShrink: 0, position: "relative",
          display: "flex", alignItems: "center", gap: 10,
          padding: "8px 14px",
          borderBottom: `1px solid ${COLORS.panelBorder}`,
          cursor: wall ? "default" : "ns-resize",
        }}
        onMouseDown={(e) => {
          if (!wall) {
            draggingRef.current = true;
            document.body.style.cursor = "ns-resize";
            e.preventDefault();
          }
        }}
      >
        {!wall && (
          <span
            style={{
              position: "absolute", left: "50%", top: 5,
              transform: "translateX(-50%)",
              width: 44, height: 4, borderRadius: 3,
              background: COLORS.borderStrong,
            }}
          />
        )}
        <div
          style={{
            display: "flex", alignItems: "center", gap: 8,
            marginTop: wall ? 0 : 4,
          }}
        >
          <IntelIcon d={MICON.grid!} size={15} color={COLORS.accent} />
          <span style={{ fontFamily: FONT_CJK, fontSize: 13, fontWeight: 700, color: "#fff" }}>
            監看模式
          </span>
          <span
            style={{
              fontFamily: FONT_DATA, fontSize: 9, letterSpacing: "2.5px", color: COLORS.textDim,
            }}
          >
            MONITOR
          </span>
        </div>
        <span
          style={{
            fontFamily: FONT_DATA, fontSize: 10, color: COLORS.textFaint,
            marginTop: wall ? 0 : 4, whiteSpace: "nowrap",
          }}
        >
          今日 {allEventsToday.length} 則 · SITUATIONAL AWARENESS
        </span>
        <div style={{ flex: 1 }} />
        <button
          onClick={(e) => {
            e.stopPropagation();
            setWall((v) => !v);
          }}
          onMouseDown={(e) => e.stopPropagation()}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "5px 11px", borderRadius: 6, cursor: "pointer",
            marginTop: wall ? 0 : 4, fontFamily: FONT_CJK, fontSize: 11,
            whiteSpace: "nowrap",
            background: wall ? COLORS.accentFaint : "rgba(255,255,255,0.05)",
            border: wall ? `1px solid ${COLORS.accentSoft}` : `1px solid ${COLORS.borderMid}`,
            color: wall ? COLORS.accent : COLORS.textDefault,
          }}
        >
          <IntelIcon
            d={wall ? MICON.minimize! : MICON.maximize!}
            size={13}
            color={wall ? COLORS.accent : "currentColor"}
          />
          Wall mode
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          onMouseDown={(e) => e.stopPropagation()}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "5px 11px", borderRadius: 6, cursor: "pointer",
            marginTop: wall ? 0 : 4,
            fontFamily: FONT_CJK, fontSize: 11, whiteSpace: "nowrap",
            background: "rgba(255,255,255,0.05)",
            border: `1px solid ${COLORS.borderMid}`,
            color: COLORS.textDefault,
          }}
        >
          <IntelIcon d={ICON.x} size={12} /> 退出
        </button>
      </div>

      <TimelineDock
        events={allEventsToday}
        dayStartTs={dayStartTs}
        nowTs={now}
        playbackTs={effectivePlayback}
        isLive={isLive}
        playing={playing}
        onScrub={onScrub}
        onLive={goLive}
        onTogglePlay={togglePlay}
      />

      {/* body: feed (left) + indicators (right) */}
      <div style={{ flex: 1, minHeight: 0, display: "flex" }}>
        {/* News Feed column (reuses IntelCard + IntelFilters) */}
        <div
          style={{
            width: "40%", minWidth: 340, maxWidth: 520, flexShrink: 0,
            display: "flex", flexDirection: "column",
            borderRight: `1px solid ${COLORS.panelBorder}`, overflow: "hidden",
          }}
        >
          <div
            style={{
              flexShrink: 0,
              display: "flex", alignItems: "center", gap: 8,
              padding: "11px 14px 9px",
            }}
          >
            <IntelIcon d={ICON.radio} size={15} color={COLORS.accent} />
            <span
              style={{
                fontFamily: FONT_CJK, fontSize: 12.5, fontWeight: 700,
                color: COLORS.textStrong, whiteSpace: "nowrap",
              }}
            >
              新聞 Feed
            </span>
            <span
              style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                padding: "1px 7px", borderRadius: 4,
                background: COLORS.statusLiveSoft,
                border: `1px solid ${COLORS.statusLiveBorder}`,
              }}
            >
              <span
                style={{
                  width: 5, height: 5, borderRadius: "50%",
                  background: COLORS.statusLive,
                  boxShadow: `0 0 5px ${COLORS.statusLive}`,
                  animation: "intelRing 1.6s ease-in-out infinite",
                }}
              />
              <span
                style={{
                  fontFamily: FONT_DATA, fontSize: 9, fontWeight: 700,
                  color: COLORS.statusLive,
                }}
              >
                LIVE
              </span>
            </span>
            <div style={{ flex: 1 }} />
            <span style={{ fontFamily: FONT_DATA, fontSize: 10.5, color: COLORS.textMuted }}>
              {flatEvents.length} 則
            </span>
          </div>

          <IntelFilters
            cats={cats}
            onToggleCat={toggleCat}
            onResetCats={() => setCats([])}
            timeRange={timeRange}
            onTimeRange={(r) => {
              setTimeRange(r);
              goLive();
            }}
            county={county}
            onCounty={setCounty}
            minRelevance={filter.minRelevance}
            onMinRelevance={(v) => onFilterChange({ ...filter, minRelevance: v })}
            eventsOnly={filter.eventsOnly}
            onEventsOnly={(v) => onFilterChange({ ...filter, eventsOnly: v })}
            minSeverity={filter.minSeverity}
            onMinSeverity={(v) => onFilterChange({ ...filter, minSeverity: v })}
          />

          <div
            className="mtp-scroll"
            style={{ flex: 1, overflowY: "auto", padding: "12px 14px 16px" }}
          >
            {flatEvents.length === 0 ? (
              <div
                style={{
                  display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center",
                  height: "100%", gap: 8, textAlign: "center", padding: 24,
                }}
              >
                <IntelIcon d={ICON.radio} size={26} color={COLORS.textGhost} />
                <div style={{ fontFamily: FONT_CJK, fontSize: 12, color: COLORS.textMuted }}>
                  目前無符合條件的事件
                </div>
                <div style={{ fontFamily: FONT_CJK, fontSize: 10, color: COLORS.textFaint }}>
                  調整分類 / 縣市，或回到即時
                </div>
              </div>
            ) : (
              <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 10 }}>
                <span
                  style={{
                    position: "absolute", left: 12, top: 6, bottom: 6,
                    width: 1.5,
                    background: `linear-gradient(${COLORS.borderMid}, ${COLORS.borderSoft} 90%, transparent)`,
                  }}
                />
                {flatEvents.map((e) => (
                  <IntelCard
                    key={e.id}
                    e={e}
                    selected={e.id === selectedId}
                    expanded={e.id === expandedId}
                    trending={isTrendingFor(e)}
                    onSelect={onSelectCard}
                    onToggle={onToggleExpand}
                    nowTs={now}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Indicators column */}
        <IndicatorPanel
          events={allEventsToday}
          countyByEventId={countyByEventId}
          pressure={pressure}
          smoothedScore={smoothed}
          market={market}
          pla={pla}
          health={health}
          sourceHealth={sourceHealth}
          totalToday={allEventsToday.length}
          onPickHotspot={onPickHotspot}
        />
      </div>

      <style>{`
        @keyframes monitorRise {
          from { transform: translateY(18px); opacity: 0; }
          to   { transform: translateY(0); opacity: 1; }
        }
        @keyframes drawerOpen {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes presBreathe {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.62; }
        }
        @keyframes presPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.45; }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="presBreathe"], [style*="presPulse"] { animation: none !important; }
        }
      `}</style>
    </div>
  );
}

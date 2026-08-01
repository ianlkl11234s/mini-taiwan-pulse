import {
  useEffect, useLayoutEffect, useMemo, useRef, useState,
  type CSSProperties, type ReactNode,
} from "react";
import { useWallClock } from "../../../hooks/useWallClock";
import { IntelIcon, ICON } from "../IntelIcon";
import { COLORS, FONT_CJK, FONT_DATA, MICON, smoothPressure } from "../intelTokens";
import { ELEVATION, RADIUS, FONT_SIZE } from "../../../styles/designTokens";
import { type IntelCardEvent } from "../IntelCard";
import { type TimeRange } from "../IntelFilters";
import {
  fetchSourceHealth, fetchNewsTrending, trendingKeys as buildTrendingKeys,
  fetchPressureIndex, fetchMarketIndex, fetchPlaActivity, fetchPublicHealthWeekly,
  type SourceHealthSummary, type TrendingRow,
  type PressureIndexNow, type MarketIndex, type PlaActivity, type PublicHealthWeek,
} from "../../../data/intelLoaders";
import {
  fetchNewsEventsDayClusters, type NewsFilter,
} from "../../../data/newsEventsLoader";
import {
  fetchAlertSummary, fetchAlertSeries24h,
  tallySummary, indexSeries, EMPTY_TALLY, emptySeries,
  type AlertSummary, type AlertSeriesPoint,
} from "../../../data/alertsLoader";
import type { NewsCategory } from "../../../data/newsEventTypes";
import { timeStore } from "../../../state/timeStore";
import { TimelineDock } from "./TimelineDock";
import { NewsFeedPanel } from "./NewsFeedPanel";
import { AlertBoard } from "../alerts/AlertBoard";
import { SituationOverview } from "./SituationOverview";
import { SituationCards } from "./SituationCards";
import { LiveWall } from "./LiveWall";
import { HazardWatchStrip } from "./HazardWatchStrip";
import { PowerCard } from "./PowerCard";
import { HotspotsWidget } from "./HotspotsWidget";
import { HourlyHistogramWidget } from "./HourlyHistogramWidget";
import { TriageWidget } from "./TriageWidget";
import { PrisonCard, type PrisonDay } from "./PrisonCard";
import { AirportPaxCard } from "./AirportPaxCard";
import { ERCard } from "./ERCard";
import {
  MONITOR_VISIBLE_LAYOUT, MONITOR_GRID_COLS,
  MONITOR_GRID_ROW_HEIGHT, MONITOR_GRID_GAP,
  type MonitorWidgetId, type MonitorGridItem,
} from "./monitorLayout";
import { supabase } from "../../../lib/supabase";
import {
  fetchPowerDashboard, invalidatePowerDashboard,
  fetchPowerGeneration24h, invalidatePowerGeneration24h,
  type PowerDashboard, type PowerGenerationDay,
} from "../../../data/energyLoader";

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

// ── 窄螢幕堆疊模式 ──
/** grid 容器實寬 < 此值 → 切換單欄堆疊（量容器寬，非 window 寬） */
const STACK_BREAKPOINT_PX = 1100;
/** 堆疊模式 cell 高度 px：與 grid 模式視覺同高（h 個 row + (h-1) 個 gap），
 *  避免 height:auto 讓內部 flex:1 區塊（例如 TimelineDock 密度圖）塌陷 */
function stackCellHeightPx(h: number): number {
  return h * MONITOR_GRID_ROW_HEIGHT + (h - 1) * MONITOR_GRID_GAP;
}
/** 堆疊模式渲染順序：依 (y, x) 排序，視覺閱讀順序與 grid 版一致 */
const MONITOR_STACK_ORDER: MonitorGridItem[] = [...MONITOR_VISIBLE_LAYOUT].sort(
  (a, b) => a.y - b.y || a.x - b.x,
);

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
  // `now` 走 wallClock 5s tick：原本 1Hz setState 會讓整棵子樹（IntelCard / TimelineDock /
  // IndicatorPanel / LiveWall…）每秒 reconcile。5s 對 live cutoff、相對時間顯示無感差。
  // 真的需要每秒跳動的元素（TimelineDock 指針）在自己內部訂 1Hz wallClock。
  const now = Math.floor(useWallClock(5_000) / 1000);
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
  const [alertSummaryRows, setAlertSummaryRows] = useState<AlertSummary[]>([]);
  const [alertSeriesRows, setAlertSeriesRows] = useState<AlertSeriesPoint[]>([]);
  const [powerDashboard, setPowerDashboard] = useState<PowerDashboard | null>(null);
  const [powerDay, setPowerDay] = useState<PowerGenerationDay | null>(null);
  const [prisonLatest, setPrisonLatest] = useState<PrisonDay | null>(null);

  // 60s pressure + market + source health + trending（降載：TTL 已蓋住輪詢間隔）
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
      fetchAlertSummary().then((s) => alive && setAlertSummaryRows(s));
      fetchAlertSeries24h().then((s) => alive && setAlertSeriesRows(s));
    };
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [open]);

  // 5min Power dashboard + 10min Power generation 24h（與 App.tsx 共用 cachedOnce）
  useEffect(() => {
    if (!open) return;
    let alive = true;
    const tickFast = () => {
      fetchPowerDashboard().then((d) => alive && setPowerDashboard(d))
        .catch((e) => console.warn("[Monitor PowerDashboard]", e));
    };
    const tickSlow = () => {
      fetchPowerGeneration24h().then((d) => alive && setPowerDay(d))
        .catch((e) => console.warn("[Monitor PowerGen24h]", e));
    };
    tickFast();
    tickSlow();
    const idFast = window.setInterval(() => {
      invalidatePowerDashboard();
      tickFast();
    }, 5 * 60_000);
    const idSlow = window.setInterval(() => {
      invalidatePowerGeneration24h();
      tickSlow();
    }, 10 * 60_000);
    return () => {
      alive = false;
      window.clearInterval(idFast);
      window.clearInterval(idSlow);
    };
  }, [open]);

  // 30min Prison population (最新一筆，realtime.prison_population_daily PK=observed_date)
  useEffect(() => {
    if (!open) return;
    let alive = true;
    const tick = () => {
      supabase.rpc("get_prison_population_window", { p_days: 365 })
        .then(({ data, error }) => {
          if (!alive) return;
          if (error) { console.warn("[Monitor Prison]", error); return; }
          const rows = (data ?? []) as PrisonDay[];
          setPrisonLatest(rows[0] ?? null);
        });
    };
    tick();
    const id = window.setInterval(tick, 30 * 60_000);
    return () => { alive = false; window.clearInterval(id); };
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
  // 原本 setInterval(70ms) ≈14Hz setState 把整棵子樹拖著 reconcile。
  // 改 rAF + ref 累積 + 200ms commit throttle：演進是 frame-rate independent
  // 的，UI commit 降到 5Hz（人眼無感差，列表更穩）。
  const spanRef = useRef(RANGE_SEC[timeRange]);
  spanRef.current = RANGE_SEC[timeRange];
  const playbackRef = useRef(playbackTs);
  playbackRef.current = playbackTs;
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    let lastCommit = last;
    const PLAYBACK_SECONDS = 6.3; // 原本 70ms × 90 ticks ≈ 走完整 span
    const tick = (t: number) => {
      const dt = (t - last) / 1000;
      last = t;
      const advance = (spanRef.current / PLAYBACK_SECONDS) * dt;
      const nowNow = Math.floor(Date.now() / 1000);
      const next = playbackRef.current + advance;
      if (next >= nowNow) {
        playbackRef.current = nowNow;
        setPlaybackTs(nowNow);
        setPlaying(false);
        setIsLive(true);
        return;
      }
      playbackRef.current = next;
      if (t - lastCommit >= 200) {
        setPlaybackTs(Math.floor(next));
        lastCommit = t;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
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

  const alertTally = useMemo(
    () => (alertSummaryRows.length ? tallySummary(alertSummaryRows) : EMPTY_TALLY),
    [alertSummaryRows],
  );
  const alertSeries = useMemo(
    () => (alertSeriesRows.length ? indexSeries(alertSeriesRows) : emptySeries()),
    [alertSeriesRows],
  );

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

  // grid 容器實寬（非 window 寬——面板有 left 64/right 14 inset，wall mode 又不同）→
  // 窄於 STACK_BREAKPOINT_PX 時切堆疊模式。做法比照 TimeseriesSparkline 的
  // useLayoutEffect + ResizeObserver 模式。
  const gridRef = useRef<HTMLDivElement>(null);
  const [gridWidth, setGridWidth] = useState(0);
  useLayoutEffect(() => {
    // `open` 入 deps：MonitorPanel 在 App.tsx 是常駐掛載（!open 只是 return null），
    // 容器 DOM 節點要等 open 變 true 才存在，[] deps 會讓 observer 永遠接不到它。
    const el = gridRef.current;
    if (!el) return;
    const measure = (width: number) => {
      if (width === 0) return; // 元素隱藏時維持原值
      setGridWidth(Math.round(width));
    };
    measure(el.clientWidth);
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) measure(entry.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [open]);
  const isStacked = gridWidth > 0 && gridWidth < STACK_BREAKPOINT_PX;

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

  const severeCount = allEventsToday.filter((e) => (e.severity ?? 0) >= 3).length;

  // widget id → 節點。座標由 monitorLayout.ts（排版沙盒定稿）決定，這裡只負責接線。
  const widgets: Record<MonitorWidgetId, ReactNode> = {
    newsFeed: (
      <NewsFeedPanel
        events={flatEvents}
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
        filter={filter}
        onFilterChange={onFilterChange}
        selectedId={selectedId}
        expandedId={expandedId}
        onSelectCard={onSelectCard}
        onToggleExpand={onToggleExpand}
        isTrendingFor={isTrendingFor}
        nowTs={now}
      />
    ),
    alertBoard: (
      <AlertBoard
        tally={alertTally}
        series={alertSeries}
        accent={COLORS.accent}
        nowTs={now}
      />
    ),
    histogram: <HourlyHistogramWidget events={allEventsToday} />,
    timeline: (
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
        alertSeries={alertSeries}
      />
    ),
    triage: <TriageWidget events={allEventsToday} />,
    hotZones: (
      <HotspotsWidget
        events={allEventsToday}
        countyByEventId={countyByEventId}
        onPickHotspot={onPickHotspot}
      />
    ),
    situationOverview: (
      <SituationOverview
        pressure={pressure}
        smoothedScore={smoothed}
        market={market}
        sourceHealth={sourceHealth}
        totalEvents={allEventsToday.length}
        severeCount={severeCount}
        panelOpen={open}
      />
    ),
    liveWall: <LiveWall />,
    situationCards: <SituationCards pla={pla} health={health} />,
    hazardStrip: <HazardWatchStrip />,
    powerCard: <PowerCard dashboard={powerDashboard} day={powerDay} />,
    erCongestion: <ERCard open={open} />,
    prison: <PrisonCard latest={prisonLatest} />,
    airportPax: <AirportPaxCard open={open} />,
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
        borderRadius: wall ? 0 : RADIUS.xl,
        zIndex: 40,
        display: "flex", flexDirection: "column",
        overflow: "hidden",
        boxShadow: wall ? "none" : ELEVATION.dock,
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
              width: 44, height: 4, borderRadius: RADIUS.md,
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
          <span style={{ fontFamily: FONT_CJK, fontSize: FONT_SIZE.lg, fontWeight: 700, color: "#fff" }}>
            監看模式
          </span>
          <span
            style={{
              fontFamily: FONT_DATA, fontSize: FONT_SIZE.xs, letterSpacing: "2.5px", color: COLORS.textDim,
            }}
          >
            MONITOR
          </span>
          <span
            style={{
              padding: "1px 7px", borderRadius: RADIUS.md,
              background: "rgba(255,152,0,0.16)",
              border: "1px solid rgba(255,152,0,0.45)",
              fontFamily: FONT_DATA, fontSize: FONT_SIZE.xs, fontWeight: 700, letterSpacing: "1px",
              color: COLORS.statusWarn,
              animation: "presBreathe 3s ease-in-out infinite",
            }}
            title="本模式仍在打磨中，數據與互動可能還會調整"
          >
            BETA
          </span>
        </div>
        <span
          style={{
            fontFamily: FONT_DATA, fontSize: FONT_SIZE.sm, color: COLORS.textFaint,
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
            padding: "5px 11px", borderRadius: RADIUS.lg, cursor: "pointer",
            marginTop: wall ? 0 : 4, fontFamily: FONT_CJK, fontSize: FONT_SIZE.base,
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
            padding: "5px 11px", borderRadius: RADIUS.lg, cursor: "pointer",
            marginTop: wall ? 0 : 4,
            fontFamily: FONT_CJK, fontSize: FONT_SIZE.base, whiteSpace: "nowrap",
            background: "rgba(255,255,255,0.05)",
            border: `1px solid ${COLORS.borderMid}`,
            color: COLORS.textDefault,
          }}
        >
          <IntelIcon d={ICON.x} size={12} /> 退出
        </button>
      </div>

      {/* header 以下：單一可捲動容器。寬 >= STACK_BREAKPOINT_PX 用 12 欄靜態網格
         （座標見 monitorLayout.ts），窄於此改單欄堆疊（依 y,x 排序，見 MONITOR_STACK_ORDER） */}
      <div
        ref={gridRef}
        className="mtp-scroll"
        style={
          isStacked
            ? {
                flex: 1, minHeight: 0, overflowY: "auto",
                padding: "14px 16px 18px",
                display: "flex", flexDirection: "column", gap: MONITOR_GRID_GAP,
              }
            : {
                flex: 1, minHeight: 0, overflowY: "auto",
                padding: "14px 16px 18px",
                display: "grid",
                gridTemplateColumns: `repeat(${MONITOR_GRID_COLS}, minmax(0, 1fr))`,
                gridAutoRows: `${MONITOR_GRID_ROW_HEIGHT}px`,
                gap: MONITOR_GRID_GAP,
                alignContent: "start",
              }
        }
      >
        {(isStacked ? MONITOR_STACK_ORDER : MONITOR_VISIBLE_LAYOUT).map((item) => {
          const cellStyle: CSSProperties = isStacked
            ? {
                width: "100%",
                height: stackCellHeightPx(item.h),
                flexShrink: 0, // flex column 子元素不設會被壓縮塞進容器高度而非溢出捲動
                minWidth: 0, minHeight: 0,
                display: "flex", flexDirection: "column", overflow: "auto",
              }
            : {
                gridColumn: `${item.x + 1} / span ${item.w}`,
                gridRow: `${item.y + 1} / span ${item.h}`,
                minWidth: 0, minHeight: 0,
                display: "flex", flexDirection: "column", overflow: "auto",
              };
          return (
            <div key={item.i} className="mtp-scroll mtp-monitor-cell" style={cellStyle}>
              {widgets[item.i]}
            </div>
          );
        })}
      </div>

      <style>{`
        /* 每格只有一個 widget 根節點。grow 撐滿 cell（內容仍靠上、不變形）、
           不 shrink：內容比格子高時由 cell 自己捲動，不裁切也不壓到下一列。
           （LiveWall 是 2×2 16:9 磚，實高隨欄寬變動，固定 row span 無法通吃） */
        .mtp-monitor-cell > * { flex: 1 0 auto; min-height: 0; }
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
        @keyframes alertBreathe { 0%,100%{opacity:1} 50%{opacity:0.62} }
        @keyframes alertPulse   { 0%,100%{opacity:1} 50%{opacity:0.45} }
        @keyframes alertEdge {
          0%,100% { box-shadow: 0 0 0 0 rgba(239,68,68,0); }
          50%     { box-shadow: 0 0 16px 0 rgba(239,68,68,0.42); }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="presBreathe"], [style*="presPulse"],
          [style*="alertBreathe"], [style*="alertPulse"], [style*="alertEdge"] {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}

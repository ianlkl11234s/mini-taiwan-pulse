import {
  useEffect, useLayoutEffect, useMemo, useRef, useState,
  type ReactNode,
} from "react";
import { useWallClock } from "../../../hooks/useWallClock";
import { IntelIcon, ICON } from "../IntelIcon";
import { COLORS, FONT_CJK, FONT_DATA, MICON, smoothPressure } from "../intelTokens";
import { ELEVATION, RADIUS, FONT_SIZE } from "../../../styles/designTokens";
import { type IntelCardEvent } from "../IntelCard";
import { type TimeRange } from "../IntelFilters";
import {
  fetchSourceHealth, fetchNewsTrending, trendingKeys as buildTrendingKeys,
  fetchPressureIndex, fetchMarketIndex, fetchPublicHealthWeekly,
  type SourceHealthSummary, type TrendingRow,
  type PressureIndexNow, type MarketIndex, type PublicHealthWeek,
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
import { TwseTicker } from "./PressureRing";
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
import { PlaBoard } from "./PlaBoard";
import { VesselZoneCard } from "./VesselZoneCard";
import { FoodPriceBoard } from "./FoodPriceBoard";
import { TraDelayBoard } from "./TraDelayBoard";
import { TelecomStatusCard } from "./TelecomStatusCard";
import { IsrSatellitePassCard } from "./IsrSatellitePassCard";
import {
  TyphoonCard, EarthquakeCard, RadiationCard, LightningCard,
} from "./HazardCards";
import {
  MONITOR_VISIBLE_LAYOUT,
  MONITOR_GRID_ROW_HEIGHT, MONITOR_GRID_GAP, MONITOR_CONTENT_ZOOM,
  type MonitorWidgetId, type MonitorGridItem,
} from "./monitorLayout";
import { buildMonitorTree, nodeWidth, type MonitorNode } from "./monitorPacking";
import {
  MONITOR_SPLIT_DOCK, MONITOR_SPLIT_VISIBLE_LAYOUT, type MonitorMode,
} from "./monitorSplitLayout";
import { supabase } from "../../../lib/supabase";
import { isAccessDenied } from "../../../lib/layerGates";
import { useNewsFilter } from "../../../hooks/useNewsFilter";
import {
  fetchPowerDashboard, invalidatePowerDashboard,
  fetchPowerGeneration24h, invalidatePowerGeneration24h,
  fetchPowerDailyTrend,
  type PowerDashboard, type PowerGenerationDay, type PowerDailyTrendRow,
} from "../../../data/energyLoader";
import type { PowerDayStatus } from "./PowerCard";

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
const EMPTY_HEALTH_WEEK: PublicHealthWeek = { week: 0, diseases: [] };

const RANGE_SEC: Record<TimeRange, number> = { "1h": 3600, "6h": 21600, "24h": 86400 };

// ── 窄螢幕堆疊模式 ──
/** grid 容器實寬 < 此值 → 切換單欄堆疊（量容器寬，非 window 寬） */
const STACK_BREAKPOINT_PX = 1100;
/** 非 fit 的 cell 高度 px：h 個 row + (h-1) 個 gap（沿用原本固定列高的視覺尺寸），
 *  避免 height:auto 讓內部 flex:1 區塊（例如 TimelineDock 密度圖）塌陷 */
function stackCellHeightPx(h: number): number {
  return h * MONITOR_GRID_ROW_HEIGHT + (h - 1) * MONITOR_GRID_GAP;
}
/** 堆疊模式渲染順序：依 (y, x) 排序，視覺閱讀順序與 grid 版一致 */
const MONITOR_STACK_ORDER: MonitorGridItem[] = [...MONITOR_VISIBLE_LAYOUT].sort(
  (a, b) => a.y - b.y || a.x - b.x,
);
/** 座標 → 欄/列樹。佈局是模組常數，拆一次就好 */
const monitorTree: MonitorNode = buildMonitorTree(MONITOR_VISIBLE_LAYOUT);

// ── split 模式（右半邊 dock）的窄版佈局來源 ──
/** split 堆疊模式渲染順序：依 (y, x) 排序，與 MONITOR_STACK_ORDER 同邏輯 */
const MONITOR_STACK_ORDER_SPLIT: MonitorGridItem[] = [...MONITOR_SPLIT_VISIBLE_LAYOUT].sort(
  (a, b) => a.y - b.y || a.x - b.x,
);
/** split 座標 → 欄/列樹 */
const monitorTreeSplit: MonitorNode = buildMonitorTree(MONITOR_SPLIT_VISIBLE_LAYOUT);

/** header 的三段模式切換選項 */
const MODE_OPTIONS: { key: MonitorMode; label: string; icon: string[] }[] = [
  { key: "dock", label: "Dock", icon: MICON.minimize! },
  { key: "split", label: "Split", icon: MICON.grid! },
  { key: "wall", label: "Wall", icon: MICON.maximize! },
];

/**
 * 欄/列樹 → DOM。
 * - `cols` 用 grid：`repeat(w, 1fr)` + `span` 保住原本 12 欄的欄寬算式（x/w 不變），
 *   `alignItems:start` 讓各欄各自長高、不互相拉平。
 * - `rows` 用 flex 直向堆疊：上面的 widget 長高，下面的順勢下移。
 * - `fit: "content"` 的 widget 高度 auto（不留白、不格內捲）；其餘吃 h 當固定高。
 */
function renderMonitorNode(
  node: MonitorNode, widgets: Record<MonitorWidgetId, ReactNode>, key?: string,
  /**
   * 上層是「等高模式」的橫向 flex 容器（見 cols 分支的 allLeaf）。
   *
   * ⚠️ 2026-08-20 修：那層是 flex **row**（為了讓 height:auto 的卡片靠 align-self:stretch
   * 撐滿被拉平的格高）。橫向 flex 的主軸是寬度，本 cell 沒有 flex-grow 就會退化成
   * shrink-to-fit —— 實測 1920 寬的 split：格子 413px、卡片只長到內容寬
   * （在監 261 / 機場 296 / 公衛 267），右邊各留一大塊空白。
   * 加 `flex:1 1 0%` 才會撐滿欄寬（taiex 之所以「看起來正常」只是它內容本來就超過 413）。
   */
  fillWidth = false,
): ReactNode {
  if (node.t === "widget") {
    const fit = node.item.fit === "content";
    return (
      <div
        key={node.item.i}
        className="mtp-scroll mtp-monitor-cell"
        data-widget={node.item.i}
        style={{
          minWidth: 0, minHeight: 0,
          height: fit ? "auto" : stackCellHeightPx(node.item.h),
          display: "flex", flexDirection: "column",
          flex: fillWidth ? "1 1 0%" : undefined,
          overflow: fit ? "visible" : "auto",
        }}
      >
        {widgets[node.item.i]}
      </div>
    );
  }
  if (node.t === "cols") {
    // 子項**全是單一 widget** → 拉平等高：並排的資訊卡（災害四卡、TAIEX|公衛、
    // 在監|機場）底部對齊才好掃視，各自長高會參差 20~30px。
    // 只要有一個子項是 rows（= 巢狀的「欄」），就維持 start —— 那是左右兩大欄的
    // 情境，兩欄長度天差地遠（下半左欄 ~2000px、右欄 ~1500px），拉平會讓短的那欄
    // 底下拖一大片空白。
    const allLeaf = node.children.every((c) => c.t === "widget");
    return (
      <div
        key={key}
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${node.w}, minmax(0, 1fr))`,
          gap: MONITOR_GRID_GAP,
          alignItems: allLeaf ? "stretch" : "start",
          minWidth: 0,
        }}
      >
        {node.children.map((c, k) => (
          <div
            key={k}
            style={{
              gridColumn: `span ${nodeWidth(c)}`,
              minWidth: 0,
              // 等高模式下這層要是 flex，裡面的 widget cell（height:auto）才會
              // 靠 align-self:stretch 撐滿被拉高的格子，否則卡片背景仍只有內容高
              display: allLeaf ? "flex" : undefined,
            }}
          >
            {renderMonitorNode(c, widgets, `c${k}`, allLeaf)}
          </div>
        ))}
      </div>
    );
  }
  if (node.t === "rows") {
    return (
      <div
        key={key}
        style={{ display: "flex", flexDirection: "column", gap: MONITOR_GRID_GAP, minWidth: 0 }}
      >
        {node.children.map((c, k) => renderMonitorNode(c, widgets, `r${k}`))}
      </div>
    );
  }
  // 互卡區塊：照原本固定列高網格畫
  return (
    <div
      key={key}
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${node.w}, minmax(0, 1fr))`,
        gridAutoRows: `${MONITOR_GRID_ROW_HEIGHT}px`,
        gap: MONITOR_GRID_GAP, alignContent: "start", minWidth: 0,
      }}
    >
      {node.items.map((item) => (
        <div
          key={item.i}
          className="mtp-scroll mtp-monitor-cell"
          data-widget={item.i}
          style={{
            gridColumn: `${item.x - node.x0 + 1} / span ${item.w}`,
            gridRow: `${item.y - node.y0 + 1} / span ${item.h}`,
            minWidth: 0, minHeight: 0,
            display: "flex", flexDirection: "column", overflow: "auto",
          }}
        >
          {widgets[item.i]}
        </div>
      ))}
    </div>
  );
}

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
  /**
   * 與 layer 共享的 filter（同步雙向）。**主站不傳** —— AR-22 P4 起本元件自己
   * per-key 訂閱 `newsEvents` 的參數 slot（`useNewsFilter`），與圖層讀寫同一份值。
   * 保留 prop 是給測試 / 未來的受控情境；有 prop 就以 prop 為準。
   */
  filter?: NewsFilter;
  onFilterChange?: (next: NewsFilter) => void;
  onSelectLocation?: (lon: number, lat: number) => void;
  externalSelectedId?: number | null;
  /** 呈現模式。主站傳入受控；不傳則用內部 state（預設 "dock"，維持舊行為） */
  mode?: MonitorMode;
  onModeChange?: (next: MonitorMode) => void;
}

export function MonitorPanel({
  open, onClose, filter: filterProp, onFilterChange: onFilterChangeProp,
  onSelectLocation, externalSelectedId,
  mode: modeProp, onModeChange: onModeChangeProp,
}: Props) {
  // AR-22 P4：主站不傳 filter/onFilterChange，改自己 per-key 訂閱同一個 store slot
  const { filter: storeFilter, setFilter: storeSetFilter } = useNewsFilter();
  const filter = filterProp ?? storeFilter;
  const onFilterChange = onFilterChangeProp ?? storeSetFilter;

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

  // ── 面板尺寸 + 呈現模式 ──
  const [height, setHeight] = useState(0.62);
  const [modeState, setModeState] = useState<MonitorMode>("dock");
  const mode = modeProp ?? modeState;
  const setMode = onModeChangeProp ?? setModeState;

  // ── 全部資料 ──
  const [sourceHealth, setSourceHealth] = useState<SourceHealthSummary>(EMPTY_HEALTH);
  const [trending, setTrending] = useState<TrendingRow[]>([]);
  const [pressure, setPressure] = useState<PressureIndexNow>(EMPTY_PRESSURE);
  const [smoothed, setSmoothed] = useState<number>(0);
  const [market, setMarket] = useState<MarketIndex>(EMPTY_MARKET);
  const [health, setHealth] = useState<PublicHealthWeek>(EMPTY_HEALTH_WEEK);
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [alertSummaryRows, setAlertSummaryRows] = useState<AlertSummary[]>([]);
  const [alertSeriesRows, setAlertSeriesRows] = useState<AlertSeriesPoint[]>([]);
  const [powerDashboard, setPowerDashboard] = useState<PowerDashboard | null>(null);
  const [powerDay, setPowerDay] = useState<PowerGenerationDay | null>(null);
  const [powerDayStatus, setPowerDayStatus] = useState<PowerDayStatus>("loading");
  const [powerTrend, setPowerTrend] = useState<PowerDailyTrendRow[]>([]);
  const [prisonLatest, setPrisonLatest] = useState<PrisonDay | null>(null);
  /** 在監完整 365 天序列（趨勢圖用）。以前只留 rows[0]，其餘直接丟掉 */
  const [prisonSeries, setPrisonSeries] = useState<PrisonDay[]>([]);

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
      fetchPowerGeneration24h().then((d) => {
        if (!alive) return;
        setPowerDay(d);
        setPowerDayStatus("ready");
      }).catch((e) => {
        if (!alive) return;
        if (isAccessDenied(e)) {
          // owner-gated RPC（PR #60 刻意鎖）：匿名/非 owner 使用者的正常路徑，非故障
          console.info("[Monitor PowerGen24h] access denied (owner-gated)", e);
          setPowerDayStatus("denied");
        } else {
          console.warn("[Monitor PowerGen24h]", e);
          setPowerDayStatus("error");
        }
      });
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

  // 30min Power daily trend（每日才變一次；PowerCard 為 timeline-isolated 卡片，不吃 currentTime）
  useEffect(() => {
    if (!open) return;
    let alive = true;
    const tick = () => {
      fetchPowerDailyTrend().then((rows) => alive && setPowerTrend(rows))
        .catch((e) => console.warn("[Monitor PowerDailyTrend]", e));
    };
    tick();
    const id = window.setInterval(tick, 30 * 60_000);
    return () => { alive = false; window.clearInterval(id); };
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
          setPrisonSeries(rows);
        });
    };
    tick();
    const id = window.setInterval(tick, 30 * 60_000);
    return () => { alive = false; window.clearInterval(id); };
  }, [open]);

  // week-once Health（共機的輪詢 2026-08-03 起由 PlaBoard 自己負責）
  useEffect(() => {
    if (!open) return;
    let alive = true;
    fetchPublicHealthWeekly().then((h) => alive && setHealth(h));
    const id = window.setInterval(() => {
      if (!alive) return;
      fetchPublicHealthWeekly().then((h) => alive && setHealth(h));
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
    if (!open || mode !== "dock") return;
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
  }, [open, mode]);

  // grid 容器實寬（非 window 寬——面板 inset 依 mode 而異：wall/split 都不同於 dock）→
  // 窄於斷點時切堆疊模式（斷點本身也依 mode 選，見下方 stackBreakpointPx）。
  // 做法比照 TimeseriesSparkline 的 useLayoutEffect + ResizeObserver 模式。
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
  const stackBreakpointPx = mode === "split" ? MONITOR_SPLIT_DOCK.stackBreakpointPx : STACK_BREAKPOINT_PX;
  const isStacked = gridWidth > 0 && gridWidth < stackBreakpointPx;

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
    internetHealth: <TelecomStatusCard open={open} nowTs={now} />,
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
        sourceHealth={sourceHealth}
        totalEvents={allEventsToday.length}
        severeCount={severeCount}
      />
    ),
    taiex: <TwseTicker data={market} open={open} />,
    liveWall: <LiveWall />,
    situationCards: <SituationCards health={health} />,
    plaBoard: <PlaBoard open={open} />,
    vesselZone: <VesselZoneCard open={open} />,
    foodPriceBoard: <FoodPriceBoard open={open} />,
    traDelay: <TraDelayBoard open={open} />,
    isrSatellitePasses: <IsrSatellitePassCard open={open} />,
    hazardStrip: <HazardWatchStrip />,
    powerCard: <PowerCard dashboard={powerDashboard} day={powerDay} dayStatus={powerDayStatus} trend={powerTrend} />,
    erCongestion: <ERCard open={open} />,
    prison: <PrisonCard latest={prisonLatest} series={prisonSeries} />,
    airportPax: <AirportPaxCard open={open} />,
    // 災害監看四卡：各自向 src/data 的 summary loader 輪詢（30/15/5/5 min），
    // nowTs 吃 MonitorPanel 的 5s wallClock 讓相對時間跟著跳
    typhoon: <TyphoonCard open={open} nowTs={now} />,
    earthquake: <EarthquakeCard open={open} nowTs={now} />,
    radiation: <RadiationCard open={open} nowTs={now} />,
    lightning: <LightningCard open={open} nowTs={now} />,
  };

  const isWall = mode === "wall";
  const isSplit = mode === "split";

  return (
    <div
      style={{
        position: "fixed",
        left: isSplit ? `${(1 - MONITOR_SPLIT_DOCK.widthPct) * 100}%` : (isWall ? 0 : 64),
        right: isSplit ? MONITOR_SPLIT_DOCK.right : 14,
        bottom: isSplit ? MONITOR_SPLIT_DOCK.bottom : (isWall ? 0 : 14),
        top: isSplit ? MONITOR_SPLIT_DOCK.top : (isWall ? 0 : "auto"),
        height: isSplit ? "auto" : (isWall ? "auto" : `${height * 100}vh`),
        background: isWall ? "rgba(6,7,11,0.97)" : "rgba(8,9,13,0.86)",
        backdropFilter: "blur(18px)",
        WebkitBackdropFilter: "blur(18px)",
        borderTop: isWall ? "none" : `1px solid ${COLORS.borderMid}`,
        border: isWall ? "none" : `1px solid ${COLORS.panelBorder}`,
        borderRadius: isWall ? 0 : RADIUS.xl,
        zIndex: 40,
        display: "flex", flexDirection: "column",
        overflow: "hidden",
        boxShadow: isWall ? "none" : ELEVATION.dock,
        animation: isSplit
          ? "monitorSlideIn .32s cubic-bezier(0.22,1,0.36,1)"
          : "monitorRise .32s cubic-bezier(0.22,1,0.36,1)",
      }}
    >
      {/* drag handle + header */}
      <div
        style={{
          flexShrink: 0, position: "relative",
          display: "flex", alignItems: "center", gap: 10,
          padding: "8px 14px",
          borderBottom: `1px solid ${COLORS.panelBorder}`,
          cursor: mode === "dock" ? "ns-resize" : "default",
        }}
        onMouseDown={(e) => {
          if (mode === "dock") {
            draggingRef.current = true;
            document.body.style.cursor = "ns-resize";
            e.preventDefault();
          }
        }}
      >
        {mode === "dock" && (
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
            marginTop: isWall ? 0 : 4,
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
        {/* ⚠️ 這行必須是 header 裡唯一可壓縮的東西：flex row 沒有 wrap，其餘項目
            （標題群、三顆模式鈕、退出）都是 nowrap 且 min-width:auto，誰都縮不了。
            split 模式面板只有視窗的 46%，1440 螢幕下固定內容就超過面板寬，
            少了這裡的 minWidth:0 + ellipsis，最右邊的「退出」會被面板的
            overflow:hidden 裁掉且點不到（1440 實測超出 30px）。 */}
        <span
          style={{
            fontFamily: FONT_DATA, fontSize: FONT_SIZE.sm, color: COLORS.textFaint,
            marginTop: isWall ? 0 : 4, whiteSpace: "nowrap",
            minWidth: 0, overflow: "hidden", textOverflow: "ellipsis",
          }}
        >
          今日 {allEventsToday.length} 則 · SITUATIONAL AWARENESS
        </span>
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: isWall ? 0 : 4 }}>
          {MODE_OPTIONS.map(({ key, label, icon }) => {
            const active = mode === key;
            return (
              <button
                key={key}
                onClick={(e) => {
                  e.stopPropagation();
                  setMode(key);
                }}
                onMouseDown={(e) => e.stopPropagation()}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "5px 11px", borderRadius: RADIUS.lg, cursor: "pointer",
                  fontFamily: FONT_CJK, fontSize: FONT_SIZE.base,
                  whiteSpace: "nowrap",
                  background: active ? COLORS.accentFaint : "rgba(255,255,255,0.05)",
                  border: active ? `1px solid ${COLORS.accentSoft}` : `1px solid ${COLORS.borderMid}`,
                  color: active ? COLORS.accent : COLORS.textDefault,
                }}
              >
                <IntelIcon
                  d={icon}
                  size={13}
                  color={active ? COLORS.accent : "currentColor"}
                />
                {label}
              </button>
            );
          })}
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          onMouseDown={(e) => e.stopPropagation()}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "5px 11px", borderRadius: RADIUS.lg, cursor: "pointer",
            marginTop: isWall ? 0 : 4,
            fontFamily: FONT_CJK, fontSize: FONT_SIZE.base, whiteSpace: "nowrap",
            background: "rgba(255,255,255,0.05)",
            border: `1px solid ${COLORS.borderMid}`,
            color: COLORS.textDefault,
          }}
        >
          <IntelIcon d={ICON.x} size={12} /> 退出
        </button>
      </div>

      {/* header 以下：單一可捲動容器。寬 >= STACK_BREAKPOINT_PX 走 monitorPacking 拆出的
         欄/列樹（x/w 與前後順序照 monitorLayout.ts，高度視 fit 決定），
         窄於此改單欄堆疊（依 y,x 排序，見 MONITOR_STACK_ORDER） */}
      <div
        ref={gridRef}
        className="mtp-scroll"
        style={{
          flex: 1, minHeight: 0, overflowY: "auto",
          padding: "14px 16px 18px",
        }}
      >
      {/* 內容縮放層：字級／間距／圖表等比放大（見 MONITOR_CONTENT_ZOOM）。
          刻意包在 gridRef 內層 —— gridRef 要維持實體 px 才量得準 isStacked，
          而 zoom 會讓子層的邏輯座標系縮小（實寬 835 → 邏輯 726），
          欄寬算式與 gap 全部沿用原值，不必為了放大字另調一套座標。 */}
      <div
        style={{
          zoom: MONITOR_CONTENT_ZOOM,
          display: "flex", flexDirection: "column", gap: MONITOR_GRID_GAP,
        }}
      >
        {isStacked
          ? (isSplit ? MONITOR_STACK_ORDER_SPLIT : MONITOR_STACK_ORDER).map((item) => (
              <div
                key={item.i}
                className="mtp-scroll mtp-monitor-cell"
                data-widget={item.i}
                style={{
                  width: "100%",
                  // fit 的 widget 高度跟內容；其餘吃 h 當固定高
                  height: item.fit === "content" ? "auto" : stackCellHeightPx(item.h),
                  flexShrink: 0, // flex column 子元素不設會被壓縮塞進容器高度而非溢出捲動
                  minWidth: 0, minHeight: 0,
                  display: "flex", flexDirection: "column",
                  overflow: item.fit === "content" ? "visible" : "auto",
                }}
              >
                {widgets[item.i]}
              </div>
            ))
          : renderMonitorNode(isSplit ? monitorTreeSplit : monitorTree, widgets)}
      </div>
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
        @keyframes monitorSlideIn {
          from { transform: translateX(18px); opacity: 0; }
          to   { transform: none; opacity: 1; }
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

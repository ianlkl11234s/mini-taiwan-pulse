import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { COLORS, FONT_CJK, FONT_DATA, type AlertGroupShort } from "./intelTokens";
import { ELEVATION, RADIUS, FONT_SIZE } from "../../styles/designTokens";
import { IntelIcon, ICON } from "./IntelIcon";
import { IntelHeader } from "./IntelHeader";
import { IntelReplay } from "./IntelReplay";
import { IntelFilters, type TimeRange } from "./IntelFilters";
import { IntelSituation } from "./IntelSituation";
import { IntelCard, intelCardId, type IntelCardEvent } from "./IntelCard";
import { GlobalSituationFeed, selectGlobalFeedCards } from "./GlobalSituationFeed";
import { AlertSummaryBar } from "./alerts/AlertSummaryBar";
import { FeedTabs, type FeedTab } from "./alerts/FeedTabs";
import { AlertCard } from "./alerts/AlertCard";
import {
  fetchSourceHealth,
  fetchNewsTrending,
  trendingKeys as buildTrendingKeys,
  type SourceHealthSummary,
  type TrendingRow,
} from "../../data/intelLoaders";
import {
  fetchNewsEventsDayClusters,
  type NewsFilter,
} from "../../data/newsEventsLoader";
import {
  fetchAlertSummary,
  fetchActiveAlerts,
  dayAlertsToCards,
  tallySummary,
  EMPTY_TALLY,
  type ActiveAlert,
  type AlertSummary,
} from "../../data/alertsLoader";
import {
  partitionByPersistence,
  ALERT_PERSISTENCE_RULES,
} from "../../data/alertRules";
import { fetchDisasterAlertsDay } from "../../data/disasterAlertLoader";
import type { NewsCategory } from "../../data/newsEventTypes";
import { timeStore } from "../../state/timeStore";
import { useNewsFilter } from "../../hooks/useNewsFilter";
import { fetchGlobalSituationFeed } from "../../data/globalSituationFeedLoader";
import { globalSituationFeedStore } from "../../state/globalSituationFeedStore";

const EMPTY_HEALTH: SourceHealthSummary = {
  total: 0, ok: 0, lagging: 0, degraded: 0, unknown: 0, rows: [],
};

const RANGE_SEC: Record<TimeRange, number> = { "1h": 3600, "6h": 21600, "24h": 86400 };

/** 國際事件飛過去的 zoom（國內新聞用 12，全球尺度用 4） */
const GLOBAL_FLY_ZOOM = 4;
/** 面板開著時的背景重抓間隔（collector 每小時跑一次，重抓不清空舊資料） */
const GLOBAL_FEED_REFRESH_MS = 10 * 60_000;

/** YYYY-MM-DD（Asia/Taipei），與 timeStore.getDateKey 同一套算法 */
function toTaipeiDateKey(unixSec: number): string {
  return new Date(unixSec * 1000).toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" });
}

function secsToNextCron(nowSec: number): number {
  const minuteOfHour = Math.floor((nowSec / 60) % 60);
  const secondOfMinute = Math.floor(nowSec % 60);
  const slots = [1, 11, 21, 31, 41, 51];
  const found = slots.find((m) => m > minuteOfHour);
  const next = found ?? 61;
  return (next - minuteOfHour) * 60 - secondOfMinute;
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
  /** 選 cluster 後通知地圖飛去（lon, lat；國際事件會帶較小的 zoom） */
  onSelectLocation?: (lon: number, lat: number, zoom?: number) => void;
  /** 來自地圖 pin click 的選取（清單應 scroll + 展開） */
  externalSelectedId?: number | null;
}

export function IntelPanel({
  open,
  onClose,
  filter: filterProp,
  onFilterChange: onFilterChangeProp,
  onSelectLocation,
  externalSelectedId,
}: Props) {
  // AR-22 P4：主站不傳 filter/onFilterChange，改自己 per-key 訂閱同一個 store slot
  const { filter: storeFilter, setFilter: storeSetFilter } = useNewsFilter();
  const filter = filterProp ?? storeFilter;
  const onFilterChange = onFilterChangeProp ?? storeSetFilter;

  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  const [isLive, setIsLive] = useState(true);
  const [playbackTs, setPlaybackTs] = useState(now);
  const [playing, setPlaying] = useState(false);
  const [timeRange, setTimeRange] = useState<TimeRange>("24h");
  const [cats, setCats] = useState<NewsCategory[]>([]);
  const [county, setCounty] = useState("全部");
  const [selectedId, setSelectedId] = useState<number | string | null>(null);
  const [expandedId, setExpandedId] = useState<number | string | null>(null);
  /** 全球情勢：預設只看已研究 ＋ keep_core，開啟後加入 keep_watch */
  const [includeWatch, setIncludeWatch] = useState(false);

  // ── alerts state ──
  const [feedTab, setFeedTab] = useState<FeedTab>("all");
  const isGlobalEventsTab = feedTab === "globalEvents";
  const [alertsExpanded, setAlertsExpanded] = useState(false);
  const [pickedGroups, setPickedGroups] = useState<AlertGroupShort[]>([]);
  const [severityMin, setSeverityMin] = useState<1 | 2 | 3 | 4>(1);
  const [alertSummaryRows, setAlertSummaryRows] = useState<AlertSummary[]>([]);
  const [activeAlerts, setActiveAlerts] = useState<ActiveAlert[]>([]);
  const [alertSelectedId, setAlertSelectedId] = useState<string | null>(null);
  const [alertExpandedId, setAlertExpandedId] = useState<string | null>(null);
  const [staleOpen, setStaleOpen] = useState(false);
  /** 非 null = 時間軸停在過去某天，警報列表改看該日歷史 */
  const [historyDate, setHistoryDate] = useState<string | null>(null);
  const [historyAlerts, setHistoryAlerts] = useState<ActiveAlert[]>([]);

  const [sourceHealth, setSourceHealth] = useState<SourceHealthSummary>(EMPTY_HEALTH);
  const [trending, setTrending] = useState<TrendingRow[]>([]);
  const [clusters, setClusters] = useState<
    Array<{
      county: string | null;
      location_name: string | null;
      lon: number | null;
      lat: number | null;
      events: IntelCardEvent[];
    }>
  >([]);

  // tick now（顯示與倒數）
  useEffect(() => {
    if (!open) return;
    const id = window.setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => window.clearInterval(id);
  }, [open]);

  // 60s polling source health + trending（降載：cross-tab TTL 已蓋住中間的 re-render）
  useEffect(() => {
    if (!open) return;
    let alive = true;
    const tick = () => {
      fetchSourceHealth().then((s) => alive && setSourceHealth(s));
      fetchNewsTrending(1, 50).then((t) => alive && setTrending(t));
    };
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [open]);

  // 60s polling alert summary（降載）
  useEffect(() => {
    if (!open) return;
    let alive = true;
    const tick = () => {
      fetchAlertSummary().then((s) => alive && setAlertSummaryRows(s));
    };
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [open]);

  // ── 歷史檢索：時間軸切到過去某天 → 警報改看「該日 NCDR 示警」──
  // 重用地圖那支按日 RPC（已含 loadingRegistry + 10min 快取），不新開 RPC。
  // 訂閱走 timeStore.subscribeDate（日期級），不把 currentTime 放進 deps。
  useEffect(() => {
    if (!open) return;
    let alive = true;
    const handler = (dateStr: string) => {
      const today = toTaipeiDateKey(Date.now() / 1000);
      if (!dateStr || dateStr >= today) {
        if (alive) {
          setHistoryDate(null);
          setHistoryAlerts([]);
        }
        return;
      }
      if (alive) setHistoryDate(dateStr);
      fetchDisasterAlertsDay(dateStr).then((rows) => {
        if (!alive) return;
        setHistoryAlerts(dayAlertsToCards(rows));
      });
    };
    handler(timeStore.getDateKey());
    const unsub = timeStore.subscribeDate(handler);
    return () => {
      alive = false;
      unsub();
    };
  }, [open]);

  // active alerts list — re-fetch when tab / filter change
  const groupKey = pickedGroups.length === 1 ? pickedGroups[0]! : null;
  const needsAlertList = feedTab === "all" || feedTab === "alerts";
  useEffect(() => {
    if (!open || !needsAlertList) return;
    let alive = true;
    fetchActiveAlerts(groupKey, severityMin).then((rows) => {
      if (!alive) return;
      const filtered = pickedGroups.length > 1
        ? rows.filter((r) => pickedGroups.includes(r.group))
        : rows;
      setActiveAlerts(filtered);
    });
    return () => { alive = false; };
  }, [open, needsAlertList, groupKey, severityMin, pickedGroups]);

  // 跟著 timeStore 日期載資料 + filter 變動觸發重抓
  const fKey = `${filter.minRelevance}|${filter.eventsOnly ? 1 : 0}|${filter.minSeverity}`;
  useEffect(() => {
    if (!open) return;
    let alive = true;
    const handler = (dateStr: string) => {
      if (!dateStr) return;
      fetchNewsEventsDayClusters(dateStr, filter).then((rows) => {
        if (!alive) return;
        const built = rows.map((r) => {
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

  // ── 全球情勢 feed：與新聞同一套契約（面板自己載，不依賴地圖圖層）──
  // 訂閱 timeStore.subscribeDate（日期級，currentTime 不進 deps）；額外允許
  // 一個偏離：面板開著時每 10 分鐘背景重抓，重抓保留舊資料不清空。
  const feedSnapshot = useSyncExternalStore(
    globalSituationFeedStore.subscribe,
    globalSituationFeedStore.getSnapshot,
    globalSituationFeedStore.getSnapshot,
  );
  const feedRequestRef = useRef(0);
  useEffect(() => {
    if (!open) return;
    let alive = true;
    let dateKey = timeStore.getDateKey();
    const load = (key: string, isRefresh: boolean) => {
      if (!key) return;
      const request = ++feedRequestRef.current;
      const before = globalSituationFeedStore.getSnapshot();
      globalSituationFeedStore.set(
        isRefresh && before.dateKey === key
          ? { ...before, status: "loading" }
          : { entries: [], status: "loading", message: null, dateKey: key },
      );
      fetchGlobalSituationFeed(key)
        .then((entries) => {
          if (!alive || request !== feedRequestRef.current) return;
          globalSituationFeedStore.set({ entries, status: "ready", message: null, dateKey: key });
        })
        .catch((error: unknown) => {
          if (!alive || request !== feedRequestRef.current) return;
          // 保留舊資料，只標記錯誤 —— 一次失敗不該把整頁清空。
          globalSituationFeedStore.set({
            ...globalSituationFeedStore.getSnapshot(),
            status: "error",
            message: error instanceof Error ? error.message : "全球情勢載入失敗",
          });
        });
    };
    const handler = (next: string) => {
      dateKey = next;
      load(next, false);
    };
    handler(dateKey);
    const unsub = timeStore.subscribeDate(handler);
    const refresh = window.setInterval(() => load(dateKey, true), GLOBAL_FEED_REFRESH_MS);
    return () => {
      alive = false;
      unsub();
      window.clearInterval(refresh);
    };
  }, [open]);

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

  // 同步外部選取
  useEffect(() => {
    if (externalSelectedId == null) return;
    setSelectedId(externalSelectedId);
    setExpandedId(externalSelectedId);
  }, [externalSelectedId]);

  const effectivePlayback = isLive ? now : playbackTs;
  const windowStartTs = now - RANGE_SEC[timeRange];

  // Flatten events + filter
  const flatEvents = useMemo<IntelCardEvent[]>(() => {
    const out: IntelCardEvent[] = [];
    for (const c of clusters) {
      for (const e of c.events) {
        if (e.published_ts < windowStartTs) continue;
        if (e.published_ts > effectivePlayback) continue;
        if (cats.length > 0 && !cats.includes((e.category ?? "other") as NewsCategory)) continue;
        if (county !== "全部" && (c.county ?? "") !== county) continue;
        out.push(e);
      }
    }
    out.sort((a, b) => b.published_ts - a.published_ts);
    return out;
  }, [clusters, cats, county, windowStartTs, effectivePlayback]);

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

  // 全球情勢卡片：decision 過濾 → 卡片轉換 → 與新聞同一組 RANGE 前端過濾。
  // 「全部」分頁只併入已研究＋keep_core（不含觀察中），與分頁自身的 toggle 無關。
  const globalCards = useMemo(
    () => selectGlobalFeedCards(feedSnapshot.entries, { includeWatch, windowStartTs, endTs: effectivePlayback }),
    [feedSnapshot, includeWatch, windowStartTs, effectivePlayback],
  );
  const globalCardsInAll = useMemo(
    () => (includeWatch
      ? selectGlobalFeedCards(feedSnapshot.entries, { includeWatch: false, windowStartTs, endTs: effectivePlayback })
      : globalCards),
    [feedSnapshot, includeWatch, windowStartTs, effectivePlayback, globalCards],
  );
  const globalLocByEventId = useMemo(() => {
    const m = new Map<string, { lon: number; lat: number }>();
    for (const entry of feedSnapshot.entries) {
      if (entry.coordinates) m.set(entry.eventId, { lon: entry.coordinates[0], lat: entry.coordinates[1] });
    }
    return m;
  }, [feedSnapshot]);

  const trendingKeySet = useMemo(() => buildTrendingKeys(trending), [trending]);
  const isTrendingFor = (e: IntelCardEvent) => {
    const c = countyByEventId.get(e.id);
    if (!c) return false;
    return trendingKeySet.has(`${c}|${e.category ?? "other"}`);
  };

  const alertTally = useMemo(
    () => (alertSummaryRows.length ? tallySummary(alertSummaryRows) : EMPTY_TALLY),
    [alertSummaryRows],
  );

  // 「持續中」折疊：長效期告警（海洋污染／長期停水…）不佔主列表。
  // 規則表 = src/data/alertRules.ts（按群組分開設，null = 維持原樣）。
  // 每分鐘重算即可 —— 門檻是 48/72 小時，秒級精度無意義。
  const nowMin = Math.floor(now / 60);
  const { fresh: freshAlerts, stale: staleAlerts } = useMemo(
    () => partitionByPersistence(activeAlerts, nowMin * 60),
    [activeAlerts, nowMin],
  );
  // 歷史模式：同一組嚴重度／群組篩選也套用在該日記錄上（不套折疊 —— 整天的紀錄本來就是回顧）
  const historyMode = historyDate != null;
  const historyRows = useMemo(
    () =>
      historyAlerts.filter(
        (a) =>
          a.severity >= severityMin &&
          (pickedGroups.length === 0 || pickedGroups.includes(a.group)),
      ),
    [historyAlerts, severityMin, pickedGroups],
  );
  const alertRows = historyMode ? historyRows : freshAlerts;

  const staleLabels = useMemo(() => {
    const seen = new Set<string>();
    for (const a of staleAlerts) seen.add(ALERT_PERSISTENCE_RULES[a.group].staleLabel);
    return [...seen].join("・");
  }, [staleAlerts]);

  if (!open) return null;

  const countdownSec = secsToNextCron(now);

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
    if (isLive || playbackTs >= now) setPlaybackTs(windowStartTs);
    setIsLive(false);
    setPlaying(true);
  };

  const onSelectCard = (id: number | string) => {
    setSelectedId(id);
    // 未定位的國際事件只展開卡片，不飛（與新聞一致：不開 popup、不動圖層）
    const loc = typeof id === "string" ? globalLocByEventId.get(id) : locByEventId.get(id);
    if (!loc || !onSelectLocation) return;
    onSelectLocation(loc.lon, loc.lat, typeof id === "string" ? GLOBAL_FLY_ZOOM : undefined);
  };
  const onToggleExpand = (id: number | string) => setExpandedId((p) => (p === id ? null : id));
  const toggleCat = (k: NewsCategory) =>
    setCats((c) => (c.includes(k) ? c.filter((x) => x !== k) : [...c, k]));

  const onAlertSelect = (id: string) => setAlertSelectedId(id);
  const onAlertToggle = (id: string) =>
    setAlertExpandedId((p) => (p === id ? null : id));

  const onPickGroup = (g: AlertGroupShort) => {
    setFeedTab("alerts");
    setAlertsExpanded(true);
    setPickedGroups((cur) => (cur.includes(g) ? cur.filter((x) => x !== g) : [...cur, g]));
  };

  return (
    <div
      style={{
        position: "fixed",
        left: 64,
        top: 98,
        bottom: 130,
        width: 412,
        background: COLORS.panelBg,
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        border: `1px solid ${COLORS.panelBorder}`,
        borderRadius: RADIUS.xl,
        zIndex: 30,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        pointerEvents: "auto",
        boxShadow: ELEVATION.lg,
        animation: "intelPanelFadeIn .25s ease-out",
        color: COLORS.textDefault,
      }}
    >
      <IntelHeader
        showFeedStatus={!isGlobalEventsTab}
        totalCount={flatEvents.length}
        lastUpdateTs={now}
        countdownSec={countdownSec}
        sourceHealth={sourceHealth}
        onClose={onClose}
      />

      {!isGlobalEventsTab && <AlertSummaryBar
        tally={alertTally}
        expanded={alertsExpanded}
        onToggle={() => setAlertsExpanded((v) => !v)}
        activeGroups={pickedGroups}
        onPickGroup={onPickGroup}
      />}

      <FeedTabs
        tab={feedTab}
        onTab={(t) => setFeedTab(t)}
        newsCount={flatEvents.length}
        alertCount={historyMode ? historyRows.length : alertTally.total}
        alertCountInAll={alertRows.length}
        globalCount={globalCards.length}
        globalCountInAll={globalCardsInAll.length}
        alertSevere={
          historyMode
            ? historyRows.filter((a) => a.severity >= 3).length
            : alertTally.severe
        }
      />

      {feedTab === "news" ? (
        <IntelFilters
          cats={cats}
          onToggleCat={toggleCat}
          onResetCats={() => setCats([])}
          timeRange={timeRange}
          onTimeRange={setTimeRange}
          county={county}
          onCounty={setCounty}
          minRelevance={filter.minRelevance}
          onMinRelevance={(v) => onFilterChange({ ...filter, minRelevance: v })}
          eventsOnly={filter.eventsOnly}
          onEventsOnly={(v) => onFilterChange({ ...filter, eventsOnly: v })}
          minSeverity={filter.minSeverity}
          onMinSeverity={(v) => onFilterChange({ ...filter, minSeverity: v })}
        />
      ) : feedTab === "alerts" ? (
        <div
          style={{
            display: "flex", alignItems: "center", gap: 5,
            padding: "8px 14px 8px",
            borderBottom: `1px solid ${COLORS.borderSoft}`,
          }}
        >
          <span
            style={{
              fontFamily: FONT_DATA, fontSize: FONT_SIZE.xs, letterSpacing: "1.5px",
              color: COLORS.textFaint, marginRight: 4,
            }}
          >
            SEVERITY ≥
          </span>
          {([1, 2, 3, 4] as const).map((lv) => {
            const labels = ["留意", "警戒", "嚴重", "緊急"];
            const active = severityMin === lv;
            return (
              <button
                key={lv}
                onClick={() => setSeverityMin(lv)}
                style={{
                  padding: "3px 9px", borderRadius: RADIUS.md,
                  background: active ? COLORS.accentFaint : "rgba(255,255,255,0.04)",
                  border: `1px solid ${active ? COLORS.accentSoft : COLORS.borderMid}`,
                  color: active ? COLORS.accent : COLORS.textMuted,
                  fontFamily: FONT_CJK, fontSize: 10.5, cursor: "pointer",
                }}
              >
                {labels[lv - 1]}
              </button>
            );
          })}
          {pickedGroups.length > 0 && (
            <>
              <div style={{ flex: 1 }} />
              <button
                onClick={() => setPickedGroups([])}
                style={{
                  padding: "3px 8px", borderRadius: RADIUS.md,
                  background: "rgba(255,255,255,0.04)",
                  border: `1px solid ${COLORS.borderMid}`,
                  color: COLORS.textMuted, fontFamily: FONT_CJK, fontSize: 10.5,
                  cursor: "pointer",
                }}
              >
                清除群組 ({pickedGroups.length})
              </button>
            </>
          )}
        </div>
      ) : feedTab === "all" || isGlobalEventsTab ? (
        <div
          style={{
            display: "flex", alignItems: "center", gap: 5,
            padding: "8px 14px 8px",
            borderBottom: `1px solid ${COLORS.borderSoft}`,
          }}
        >
          <span
            style={{
              fontFamily: FONT_DATA, fontSize: FONT_SIZE.xs, letterSpacing: "1.5px",
              color: COLORS.textFaint, marginRight: 4,
            }}
          >
            RANGE
          </span>
          {(["1h", "6h", "24h"] as TimeRange[]).map((r) => {
            const active = timeRange === r;
            return (
              <button
                key={r}
                onClick={() => setTimeRange(r)}
                style={{
                  padding: "3px 10px", borderRadius: RADIUS.md,
                  background: active ? COLORS.accentFaint : "rgba(255,255,255,0.04)",
                  border: `1px solid ${active ? COLORS.accentSoft : COLORS.borderMid}`,
                  color: active ? COLORS.accent : COLORS.textMuted,
                  fontFamily: FONT_DATA, fontSize: 10.5, fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {r.toUpperCase()}
              </button>
            );
          })}
          {isGlobalEventsTab && (
            <>
              <div style={{ flex: 1 }} />
              <button
                onClick={() => setIncludeWatch((v) => !v)}
                title="加入 AI 判為「觀察中」(keep_watch) 的事件；低價值 (drop_noise) 一律不顯示"
                style={{
                  padding: "3px 9px", borderRadius: RADIUS.md,
                  background: includeWatch ? COLORS.accentFaint : "rgba(255,255,255,0.04)",
                  border: `1px solid ${includeWatch ? COLORS.accentSoft : COLORS.borderMid}`,
                  color: includeWatch ? COLORS.accent : COLORS.textMuted,
                  fontFamily: FONT_CJK, fontSize: 10.5, cursor: "pointer",
                }}
              >
                含觀察中
              </button>
            </>
          )}
        </div>
      ) : null}

      {feedTab === "news" && (
        <IntelSituation
          events={flatEvents}
          countyByEventId={countyByEventId}
          trending={trending}
        />
      )}

      <div className="mtp-scroll" style={{ flex: 1, overflowY: "auto", padding: "12px 14px 14px" }}>
        {isGlobalEventsTab ? (
          <GlobalSituationFeed
            cards={globalCards}
            snapshot={feedSnapshot}
            selectedId={selectedId}
            expandedId={expandedId}
            onSelect={onSelectCard}
            onToggle={onToggleExpand}
            nowTs={now}
          />
        ) : feedTab === "alerts" ? (
          <>
          {historyMode && (
            <div
              style={{
                marginBottom: 10, padding: "7px 10px",
                borderRadius: RADIUS.lg,
                background: "rgba(255,255,255,0.04)",
                border: `1px solid ${COLORS.borderMid}`,
                fontFamily: FONT_CJK, fontSize: FONT_SIZE.sm,
                color: COLORS.textMuted, lineHeight: 1.5,
              }}
            >
              歷史 · {historyDate} 的 NCDR 示警（{historyRows.length} 則）
              <span style={{ color: COLORS.textFaint }}>　不含地震；回到今天看即時警報</span>
            </div>
          )}
          {(historyMode ? historyRows : activeAlerts).length === 0 ? (
            <div
              style={{
                display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center",
                height: "100%", gap: 8, textAlign: "center", padding: 24,
              }}
            >
              <IntelIcon d={ICON.alert} size={28} color={COLORS.textGhost} />
              <div style={{ fontFamily: FONT_CJK, fontSize: FONT_SIZE.md, color: COLORS.textMuted }}>
                目前無符合條件的警報
              </div>
            </div>
          ) : (
            <>
              {alertRows.length > 0 ? (
                <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 10 }}>
                  <span
                    style={{
                      position: "absolute", left: 12, top: 6, bottom: 6,
                      width: 1.5,
                      background: `linear-gradient(${COLORS.borderMid}, ${COLORS.borderSoft} 90%, transparent)`,
                    }}
                  />
                  {alertRows.map((a) => (
                    <AlertCard
                      key={a.id}
                      a={a}
                      selected={a.id === alertSelectedId}
                      expanded={a.id === alertExpandedId}
                      onSelect={onAlertSelect}
                      onToggle={onAlertToggle}
                      nowTs={now}
                    />
                  ))}
                </div>
              ) : (
                <div
                  style={{
                    fontFamily: FONT_CJK, fontSize: FONT_SIZE.base,
                    color: COLORS.textMuted, textAlign: "center", padding: "18px 0",
                  }}
                >
                  {historyMode ? "該日無符合條件的示警" : "無新發布的警報，僅有下方長期持續事件"}
                </div>
              )}

              {/* 「持續中」折疊區 —— 規則見 src/data/alertRules.ts（歷史模式不套） */}
              {!historyMode && staleAlerts.length > 0 && (
                <div style={{ marginTop: alertRows.length > 0 ? 14 : 4 }}>
                  <button
                    onClick={() => setStaleOpen((v) => !v)}
                    title={[...new Set(staleAlerts.map((a) => ALERT_PERSISTENCE_RULES[a.group].rationale))].join("\n")}
                    style={{
                      width: "100%", display: "flex", alignItems: "center", gap: 7,
                      padding: "7px 10px", borderRadius: RADIUS.lg,
                      background: "rgba(255,255,255,0.03)",
                      border: `1px dashed ${COLORS.borderMid}`,
                      color: COLORS.textMuted, cursor: "pointer", textAlign: "left",
                    }}
                  >
                    <span style={{ fontFamily: FONT_DATA, fontSize: 10 }}>
                      {staleOpen ? "▾" : "▸"}
                    </span>
                    <span style={{ fontFamily: FONT_CJK, fontSize: FONT_SIZE.base }}>
                      持續中 {staleAlerts.length} 則
                    </span>
                    <div style={{ flex: 1 }} />
                    <span style={{ fontFamily: FONT_CJK, fontSize: FONT_SIZE.sm, color: COLORS.textFaint }}>
                      {staleLabels}
                    </span>
                  </button>
                  {staleOpen && (
                    <div
                      style={{
                        position: "relative", display: "flex", flexDirection: "column",
                        gap: 10, marginTop: 10, opacity: 0.72,
                      }}
                    >
                      {staleAlerts.map((a) => (
                        <AlertCard
                          key={a.id}
                          a={a}
                          selected={a.id === alertSelectedId}
                          expanded={a.id === alertExpandedId}
                          onSelect={onAlertSelect}
                          onToggle={onAlertToggle}
                          nowTs={now}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
          </>
        ) : feedTab === "all" ? (
          (() => {
            const merged: Array<
              { kind: "news"; ts: number; e: IntelCardEvent } |
              { kind: "alert"; ts: number; a: ActiveAlert }
            > = [
              ...flatEvents.map((e) => ({ kind: "news" as const, ts: e.published_ts, e })),
              // 國際卡片走同一條時間軸（只收已研究＋keep_core，卡片上有「國際」chip 可辨識）
              ...globalCardsInAll.map((e) => ({ kind: "news" as const, ts: e.published_ts, e })),
              // 長期持續事件不進「全部」時間軸（本來就沉底，只是噪音）；要看走「警報」tab 的折疊區
              ...alertRows.map((a) => ({ kind: "alert" as const, ts: a.sent_ts, a })),
            ];
            merged.sort((x, y) => y.ts - x.ts);
            if (merged.length === 0) {
              return (
                <div
                  style={{
                    display: "flex", flexDirection: "column",
                    alignItems: "center", justifyContent: "center",
                    height: "100%", gap: 8, textAlign: "center", padding: 24,
                  }}
                >
                  <IntelIcon d={ICON.radio} size={28} color={COLORS.textGhost} />
                  <div style={{ fontFamily: FONT_CJK, fontSize: FONT_SIZE.md, color: COLORS.textMuted }}>
                    目前無事件 / 警報
                  </div>
                </div>
              );
            }
            return (
              <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 10 }}>
                <span
                  style={{
                    position: "absolute", left: 12, top: 6, bottom: 6,
                    width: 1.5,
                    background: `linear-gradient(${COLORS.borderMid}, ${COLORS.borderSoft} 90%, transparent)`,
                  }}
                />
                {merged.map((row) =>
                  row.kind === "news" ? (
                    <IntelCard
                      key={`n${intelCardId(row.e)}`}
                      e={row.e}
                      selected={intelCardId(row.e) === selectedId}
                      expanded={intelCardId(row.e) === expandedId}
                      trending={isTrendingFor(row.e)}
                      onSelect={onSelectCard}
                      onToggle={onToggleExpand}
                      nowTs={now}
                    />
                  ) : (
                    <AlertCard
                      key={`a${row.a.id}`}
                      a={row.a}
                      selected={row.a.id === alertSelectedId}
                      expanded={row.a.id === alertExpandedId}
                      onSelect={onAlertSelect}
                      onToggle={onAlertToggle}
                      nowTs={now}
                    />
                  ),
                )}
              </div>
            );
          })()
        ) : flatEvents.length === 0 ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              gap: 8,
              textAlign: "center",
              padding: 24,
            }}
          >
            <IntelIcon d={ICON.radio} size={28} color={COLORS.textGhost} />
            <div style={{ fontFamily: FONT_CJK, fontSize: FONT_SIZE.md, color: COLORS.textMuted }}>
              目前無符合條件的事件
            </div>
            <div style={{ fontFamily: FONT_CJK, fontSize: FONT_SIZE.sm, color: COLORS.textFaint }}>
              調整分類 / 時間範圍 / 縣市，或回到即時
            </div>
          </div>
        ) : (
          <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 10 }}>
            <span
              style={{
                position: "absolute",
                left: 12,
                top: 6,
                bottom: 6,
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

      {!isGlobalEventsTab && <IntelReplay
        playbackTs={effectivePlayback}
        windowStartTs={windowStartTs}
        nowTs={now}
        isLive={isLive}
        playing={playing}
        onScrub={onScrub}
        onLive={goLive}
        onTogglePlay={togglePlay}
      />}

      <style>{`
        @keyframes intelPanelFadeIn {
          from { opacity: 0; transform: translateX(-12px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes intelRing {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.78); }
        }
        @keyframes alertBreathe { 0%,100%{opacity:1} 50%{opacity:0.62} }
        @keyframes alertPulse   { 0%,100%{opacity:1} 50%{opacity:0.45} }
        @keyframes alertEdge {
          0%,100% { box-shadow: 0 0 0 0 rgba(239,68,68,0); }
          50%     { box-shadow: 0 0 16px 0 rgba(239,68,68,0.42); }
        }
        @keyframes drawerOpen {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="alertBreathe"],[style*="alertPulse"],[style*="alertEdge"] { animation: none !important; }
        }
      `}</style>
    </div>
  );
}

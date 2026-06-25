import { useEffect, useMemo, useRef, useState } from "react";
import { COLORS, FONT_CJK, FONT_DATA, type AlertGroupShort } from "./intelTokens";
import { ELEVATION, RADIUS, FONT_SIZE } from "../../styles/designTokens";
import { IntelIcon, ICON } from "./IntelIcon";
import { IntelHeader } from "./IntelHeader";
import { IntelReplay } from "./IntelReplay";
import { IntelFilters, type TimeRange } from "./IntelFilters";
import { IntelSituation } from "./IntelSituation";
import { IntelCard, type IntelCardEvent } from "./IntelCard";
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
  tallySummary,
  EMPTY_TALLY,
  type ActiveAlert,
  type AlertSummary,
} from "../../data/alertsLoader";
import type { NewsCategory } from "../../data/newsEventTypes";
import { timeStore } from "../../state/timeStore";

const EMPTY_HEALTH: SourceHealthSummary = {
  total: 0, ok: 0, lagging: 0, degraded: 0, unknown: 0, rows: [],
};

const RANGE_SEC: Record<TimeRange, number> = { "1h": 3600, "6h": 21600, "24h": 86400 };

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
  /** 與 layer 共享的 filter（同步雙向） */
  filter: NewsFilter;
  onFilterChange: (next: NewsFilter) => void;
  /** 選 cluster 後通知地圖飛去（lon, lat） */
  onSelectLocation?: (lon: number, lat: number) => void;
  /** 來自地圖 pin click 的選取（清單應 scroll + 展開） */
  externalSelectedId?: number | null;
}

export function IntelPanel({
  open,
  onClose,
  filter,
  onFilterChange,
  onSelectLocation,
  externalSelectedId,
}: Props) {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  const [isLive, setIsLive] = useState(true);
  const [playbackTs, setPlaybackTs] = useState(now);
  const [playing, setPlaying] = useState(false);
  const [timeRange, setTimeRange] = useState<TimeRange>("24h");
  const [cats, setCats] = useState<NewsCategory[]>([]);
  const [county, setCounty] = useState("全部");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // ── alerts state ──
  const [feedTab, setFeedTab] = useState<FeedTab>("all");
  const [alertsExpanded, setAlertsExpanded] = useState(false);
  const [pickedGroups, setPickedGroups] = useState<AlertGroupShort[]>([]);
  const [severityMin, setSeverityMin] = useState<1 | 2 | 3 | 4>(1);
  const [alertSummaryRows, setAlertSummaryRows] = useState<AlertSummary[]>([]);
  const [activeAlerts, setActiveAlerts] = useState<ActiveAlert[]>([]);
  const [alertSelectedId, setAlertSelectedId] = useState<string | null>(null);
  const [alertExpandedId, setAlertExpandedId] = useState<string | null>(null);

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

  // active alerts list — re-fetch when tab / filter change
  const groupKey = pickedGroups.length === 1 ? pickedGroups[0]! : null;
  const needsAlertList = feedTab !== "news";
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

  const onSelectCard = (id: number) => {
    setSelectedId(id);
    const loc = locByEventId.get(id);
    if (loc && onSelectLocation) onSelectLocation(loc.lon, loc.lat);
  };
  const onToggleExpand = (id: number) => setExpandedId((p) => (p === id ? null : id));
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
        bottom: 14,
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
        totalCount={flatEvents.length}
        lastUpdateTs={now}
        countdownSec={countdownSec}
        sourceHealth={sourceHealth}
        onClose={onClose}
      />

      <AlertSummaryBar
        tally={alertTally}
        expanded={alertsExpanded}
        onToggle={() => setAlertsExpanded((v) => !v)}
        activeGroups={pickedGroups}
        onPickGroup={onPickGroup}
      />

      <FeedTabs
        tab={feedTab}
        onTab={(t) => setFeedTab(t)}
        newsCount={flatEvents.length}
        alertCount={alertTally.total}
        alertSevere={alertTally.severe}
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
      ) : (
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
        </div>
      )}

      {feedTab === "news" && (
        <IntelSituation
          events={flatEvents}
          countyByEventId={countyByEventId}
          trending={trending}
        />
      )}

      <div className="mtp-scroll" style={{ flex: 1, overflowY: "auto", padding: "12px 14px 14px" }}>
        {feedTab === "alerts" ? (
          activeAlerts.length === 0 ? (
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
            <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 10 }}>
              <span
                style={{
                  position: "absolute", left: 12, top: 6, bottom: 6,
                  width: 1.5,
                  background: `linear-gradient(${COLORS.borderMid}, ${COLORS.borderSoft} 90%, transparent)`,
                }}
              />
              {activeAlerts.map((a) => (
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
          )
        ) : feedTab === "all" ? (
          (() => {
            const merged: Array<
              { kind: "news"; ts: number; e: IntelCardEvent } |
              { kind: "alert"; ts: number; a: ActiveAlert }
            > = [
              ...flatEvents.map((e) => ({ kind: "news" as const, ts: e.published_ts, e })),
              ...activeAlerts.map((a) => ({ kind: "alert" as const, ts: a.sent_ts, a })),
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
                      key={`n${row.e.id}`}
                      e={row.e}
                      selected={row.e.id === selectedId}
                      expanded={row.e.id === expandedId}
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

      <IntelReplay
        playbackTs={effectivePlayback}
        windowStartTs={windowStartTs}
        nowTs={now}
        isLive={isLive}
        playing={playing}
        onScrub={onScrub}
        onLive={goLive}
        onTogglePlay={togglePlay}
      />

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

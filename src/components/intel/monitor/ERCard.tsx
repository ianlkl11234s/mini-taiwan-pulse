import { useCallback, useMemo } from "react";
import { COLORS, FONT_CJK, FONT_DATA } from "../intelTokens";
import { RADIUS, FONT_SIZE, WHITE_ALPHA } from "../../../styles/designTokens";
import { SectionLabel, Sparkline } from "./PressureRing";
import { TimeseriesSparkline, type SparklinePoint } from "../../TimeseriesSparkline";
import { useChartTooltip } from "../../ChartHoverTooltip";
import {
  fetchErHospitalLatest, fetchErHospital24hAll, fetchErWaitTotal14d,
  type ErHospitalLatest, type ErHospital24hAllRow, type ErWaitTotal14dRow,
} from "../../../data/erHospitalLoader";
import { erCongestionColor, ER_LEVEL_COLORS, ER_LEVEL_LABELS, classifyErCongestion } from "../../../data/erCongestionTypes";
import { buildErRegionGroups, buildErSummary, ER_SEVERITY_ORDER, type ErHospitalCell, type ErSummary } from "./erCardData";
import { useMonitorResource } from "../../../hooks/useMonitorResource";
import { MonitorDataStatus } from "./MonitorDataStatus";
import { useMonitorV2 } from "./monitorStyle";
import { fs, MF } from "./monitorFont";
import { judgeFreshness, useMonitorFreshness } from "./monitorFreshness";
import { MONITOR_CARD_META } from "./monitorCardMeta";
import { MonitorMetric, MonitorNote, MonitorSub } from "./MonitorMetric";

interface Props { open: boolean }
const EMPTY_ER_LATEST: ErHospitalLatest[] = [];
const EMPTY_ER_SERIES: ErHospital24hAllRow[] = [];
const EMPTY_ER_TREND: ErWaitTotal14dRow[] = [];
/** 14 天主圖：逐小時桶，缺 6 小時以上（09/25–28 收集中斷）就斷線＋斜線帶 */
const ER_TREND_GAP_SEC = 6 * 3600;
/** 小格迷你線：約每 17 分一點，缺 1 小時以上斷線 */
const ER_CELL_GAP_SEC = 3600;
const ER_WINDOW_SEC = 24 * 3600;

export function ERCard({ open }: Props) {
  const v2 = useMonitorV2();
  const loadLatest = useCallback(() => fetchErHospitalLatest(), []);
  const loadSeries = useCallback(() => fetchErHospital24hAll(), []);
  const loadTrend = useCallback(() => fetchErWaitTotal14d(), []);
  const latestQuery = useMonitorResource({ open, queryKey: "er-latest", intervalMs: 5 * 60_000, emptyData: EMPTY_ER_LATEST, load: loadLatest });
  const seriesQuery = useMonitorResource({ open, queryKey: "er-24h", intervalMs: 5 * 60_000, emptyData: EMPTY_ER_SERIES, load: loadSeries });
  const trendQuery = useMonitorResource({ open, queryKey: "er-14d", intervalMs: 5 * 60_000, emptyData: EMPTY_ER_TREND, load: loadTrend });
  const latest = latestQuery.data;
  const series = seriesQuery.data;
  const trend14d = trendQuery.data;
  const readableLatest = latestQuery.status === "ready" || latestQuery.lastSuccessAt !== null;

  // v2：最新一筆觀測時間（epoch 秒 → 毫秒）送標題列
  const latestObservedMs = useMemo(
    () => latest.reduce((m, r) => Math.max(m, r.observed_ts ?? 0), 0) * 1000,
    [latest],
  );
  const fresh = useMonitorFreshness("erCongestion", { time: latestObservedMs > 0 ? latestObservedMs : null });

  const groups = useMemo(() => buildErRegionGroups(latest, series), [latest, series]);
  const allHospitals = useMemo(() => groups.flatMap((g) => g.hospitals), [groups]);
  const nationalSummary = useMemo(() => buildErSummary(allHospitals), [allHospitals]);
  // 第一筆是 rolling window 邊界的部分小時（樣本少會偏低）→ 捨棄首桶再畫
  const trend14dSpark = useMemo<SparklinePoint[]>(
    () => trend14d.slice(1).map((r) => ({ t: r.bucket_ts, v: r.total_wait })),
    [trend14d],
  );
  // 逐院 sparkline hover 用的時間平行陣列 —— 索引對齊 erCardData.buildErRegionGroups 內
  // 同一份 p[3] != null 過濾邏輯（該檔不可改，這裡在 ERCard.tsx 內自算一份平行陣列）
  const sparkTimesByHosp = useMemo(() => {
    const map = new Map<string, number[]>();
    for (const row of series) {
      const times: number[] = [];
      for (const p of row.points ?? []) {
        if (p[3] != null) times.push(p[0]);
      }
      map.set(row.hosp_id, times);
    }
    return map;
  }, [series]);

  // v2 小格迷你線：保留時間位置（不剔除 null 壓縮缺口），各院共用同一個 24h 時間軸
  const cellSeries = useMemo(() => {
    const byId = new Map<string, SparklinePoint[]>();
    let tMax = 0;
    for (const row of series) {
      const pts: SparklinePoint[] = [];
      for (const p of row.points ?? []) {
        if (p[0] > tMax) tMax = p[0];
        if (p[3] != null) pts.push({ t: p[0], v: p[3] });
      }
      byId.set(row.hosp_id, pts);
    }
    const domain = tMax > 0 ? { from: tMax - ER_WINDOW_SEC, to: tMax } : undefined;
    return { byId, domain };
  }, [series]);

  if (v2) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
        <MonitorDataStatus label="急診最新快照" query={latestQuery} />
        <MonitorDataStatus label="急診 24h 序列" query={seriesQuery} />
        <MonitorDataStatus label="急診 14 天趨勢" query={trendQuery} />
        {allHospitals.length > 0 && (
          <>
            <MonitorMetric
              value={nationalSummary.total.toLocaleString("zh-TW")}
              unit="人等床"
              muted={fresh.muted}
            />
            <ErSeverityBar summary={nationalSummary} />
            {trend14dSpark.length > 0 && (
              <div data-testid="er-wait-trend-14d">
                <TimeseriesSparkline
                  data={trend14dSpark} unit="人" heightTier="std" fillArea lineColor={ER_LEVEL_COLORS.severe}
                  gapSec={ER_TREND_GAP_SEC} showTooltip staleUntil={fresh.staleUntil}
                />
              </div>
            )}
          </>
        )}
        {groups.length === 0 ? (
          <MonitorNote>{latestQuery.status === "unknown" ? "資料載入中…" : "尚無急診觀測資料"}</MonitorNote>
        ) : groups.map((g) => {
          const regionSummary = buildErSummary(g.hospitals);
          return (
            <div key={g.region} data-testid={`er-region-${g.region}`} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                <span style={{ fontFamily: FONT_CJK, fontSize: MF.body, fontWeight: 700, color: COLORS.textDefault, whiteSpace: "nowrap" }}>
                  {g.region}
                </span>
                <span
                  data-testid={`er-region-total-${g.region}`}
                  style={{ fontFamily: FONT_DATA, fontSize: MF.label, color: COLORS.textDim, whiteSpace: "nowrap" }}
                >
                  {g.hospitals.length} 院 · 共 {regionSummary.total.toLocaleString("zh-TW")} 人等床
                </span>
                <div style={{ flex: 1, height: 1, background: COLORS.borderSoft }} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 6 }}>
                {g.hospitals.map((h) => (
                  <HospitalCell
                    key={h.hospId} cell={h} sparkTimes={sparkTimesByHosp.get(h.hospId) ?? []}
                    timeSeries={cellSeries.byId.get(h.hospId)} timeDomain={cellSeries.domain}
                  />
                ))}
              </div>
            </div>
          );
        })}
        {fresh.reason && <MonitorNote tone={fresh.state === "stopped" ? "err" : "warn"}>{fresh.reason}</MonitorNote>}
        <MonitorSub items={["來源：衛福部 急診即時訂閱"]} />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {!v2 && <SectionLabel color={COLORS.accent}>急診壅塞 · ER CONGESTION 24H</SectionLabel>}
      <div
        style={v2 ? { display: "flex", flexDirection: "column", gap: 10, minWidth: 0 } : {
          borderRadius: RADIUS.xl,
          border: `1px solid ${COLORS.panelBorder}`,
          background: "linear-gradient(160deg, rgba(239,68,68,0.06), rgba(255,255,255,0.012))",
          padding: "12px 14px",
          display: "flex", flexDirection: "column", gap: 10,
        }}
      >
        {v2 ? (
          <SectionLabel>等床 · {readableLatest ? latest.length : "—"} 院 24h 等一般病床</SectionLabel>
        ) : (
          <span style={{ fontFamily: FONT_DATA, fontSize: fs(v2, FONT_SIZE.xs), letterSpacing: "1.2px", color: COLORS.textDim }}>
            ER WAIT · {readableLatest ? latest.length : "—"} 院 24h 等一般病床
          </span>
        )}
        <MonitorDataStatus label="急診最新快照" query={latestQuery} />
        <MonitorDataStatus label="急診 24h 序列" query={seriesQuery} />
        <MonitorDataStatus label="急診 14 天趨勢" query={trendQuery} />

        {allHospitals.length > 0 && <ErNationalSummaryRow summary={nationalSummary} />}

        {allHospitals.length > 0 && <ErWaitTrend14d spark={trend14dSpark} />}

        {groups.length === 0 ? (
          <div style={{ fontFamily: FONT_CJK, fontSize: fs(v2, FONT_SIZE.sm), color: COLORS.textFaint, padding: "8px 0" }}>
            {latestQuery.status === "unknown" ? "資料載入中…" : "尚無急診觀測資料"}
          </div>
        ) : groups.map((g) => {
          const regionSummary = buildErSummary(g.hospitals);
          return (
          <div key={g.region} data-testid={`er-region-${g.region}`} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontFamily: FONT_CJK, fontSize: fs(v2, 11), fontWeight: 700, color: COLORS.textDefault }}>
                {g.region}
              </span>
              <span style={{ fontFamily: FONT_DATA, fontSize: fs(v2, 9), color: COLORS.textFaint }}>
                {g.hospitals.length} 院
              </span>
              <span
                data-testid={`er-region-total-${g.region}`}
                style={{ fontFamily: FONT_DATA, fontSize: fs(v2, 9), color: COLORS.textFaint }}
              >
                Σ {regionSummary.total.toLocaleString()} 等床
              </span>
              <ErRegionMiniBar summary={regionSummary} />
              <div style={{ flex: 1, height: 1, background: COLORS.borderSoft }} />
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: v2 ? "repeat(auto-fill, minmax(170px, 1fr))" : "repeat(auto-fill, minmax(140px, 1fr))",
                gap: 6,
              }}
            >
              {g.hospitals.map((h) => (
                <HospitalCell key={h.hospId} cell={h} sparkTimes={sparkTimesByHosp.get(h.hospId) ?? []} />
              ))}
            </div>
          </div>
          );
        })}

        <div style={{ fontSize: fs(v2, FONT_SIZE.xs), color: COLORS.textDim }}>
          {v2 ? "來源：衛福部 急診即時訂閱" : "來源：衛福部 急診即時訂閱（get_er_hospital_latest / 24h_all）"}
        </div>
      </div>
    </div>
  );
}

/** epoch 秒 → "HH:mm"，24h sparkline hover 用（同日內足夠，不需要月/日） */
function fmtHm(ts: number | undefined): string {
  if (ts == null) return "";
  const d = new Date(ts * 1000);
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

function HospitalCell({
  cell, sparkTimes, timeSeries, timeDomain,
}: {
  cell: ErHospitalCell;
  sparkTimes: number[];
  /** v2：帶時間戳的 24h 序列（保留缺口）；舊版不傳 */
  timeSeries?: SparklinePoint[];
  timeDomain?: { from: number; to: number };
}) {
  const v2 = useMonitorV2();
  const color = erCongestionColor(cell.wait);
  const level = classifyErCongestion(cell.wait);
  const hasSpark = cell.spark.length >= 2;
  const hasTimeSpark = (timeSeries?.length ?? 0) >= 2;
  // v2：單院停更（該院自己的最新觀測落後）→ 數值降灰並標「過期／停更 N」
  const cellFresh = v2 && cell.observedTs != null
    ? judgeFreshness(MONITOR_CARD_META.erCongestion.fresh, cell.observedTs * 1000, Date.now())
    : null;
  const cellStaleLabel = cellFresh && cellFresh.muted ? (cellFresh.header?.label ?? null) : null;
  return (
    <div
      // v2：不畫框，但保留淡底小格，否則迷你走勢會貼著右邊下一家醫院、看不出屬於誰
      style={v2 ? {
        display: "flex", alignItems: "center", gap: 6, minWidth: 0,
        padding: "4px 6px", borderRadius: RADIUS.md, background: WHITE_ALPHA[4],
      } : {
        display: "flex", alignItems: "center", gap: 6,
        padding: "5px 7px", borderRadius: RADIUS.md,
        background: "rgba(255,255,255,0.025)",
        border: `1px solid ${COLORS.borderSoft}`,
        minWidth: 0,
      }}
    >
      <div
        title={`${cell.name} · ${cell.areaName} · ${ER_LEVEL_LABELS[level]}`}
        style={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1 }}
      >
        <span
          style={{
            fontFamily: FONT_CJK, fontSize: fs(v2, 10.5), color: COLORS.textDefault,
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}
        >
          {cell.name}
        </span>
        <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
          <span style={{ fontFamily: FONT_DATA, fontSize: fs(v2, 14), fontWeight: 700, color: cellStaleLabel ? COLORS.textMuted : color, lineHeight: 1.1 }}>
            {cell.wait == null ? "—" : cell.wait}
          </span>
          <span style={{ fontFamily: FONT_CJK, fontSize: fs(v2, 8.5), color: COLORS.textFaint }}>
            {cellStaleLabel ? `等床 · ${cellStaleLabel}` : "等床"}
          </span>
        </div>
      </div>
      {/* 逐點 hover 顯示時間 + 等床數，取代原本蓋住整格（含此圖）的 HTML title
          （院名/區/等級留在左側資訊區的 title，避免跟這裡的浮層在 sparkline 上重疊跳兩個提示） */}
      {v2 ? (
        <div style={{ flex: "0 1 72px", minWidth: 40 }}>
          {hasTimeSpark && (
            <TimeseriesSparkline
              data={timeSeries!} timeDomain={timeDomain} unit="人" lineColor={color}
              heightTier="mini" bare fillArea={false} gapSec={ER_CELL_GAP_SEC} showTooltip
            />
          )}
        </div>
      ) : (
        <Sparkline
          data={hasSpark ? cell.spark : [0, 0]}
          color={color}
          w={40}
          h={18}
          showTooltip={hasSpark}
          labelAt={(i) => fmtHm(sparkTimes[i])}
          unit="人"
        />
      )}
    </div>
  );
}

/** 全台總集列（卡片頂部、分區 section 之前）— 視覺密度比照能源卡標頭列 */
function ErNationalSummaryRow({ summary }: { summary: ErSummary }) {
  const withData = ER_SEVERITY_ORDER.reduce((sum, lv) => sum + summary.counts[lv], 0);
  const tip = useChartTooltip();
  const v2 = useMonitorV2();
  return (
    <div
      data-testid="er-national-summary"
      style={v2 ? { display: "flex", alignItems: "center", gap: 14, minWidth: 0 } : {
        display: "flex", alignItems: "center", gap: 14,
        padding: "6px 10px", borderRadius: RADIUS.lg,
        background: "rgba(255,255,255,0.03)",
        border: `1px solid ${COLORS.borderSoft}`,
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 5, flexShrink: 0 }}>
        <span style={{ fontFamily: FONT_CJK, fontSize: fs(v2, 10), color: COLORS.textMuted }}>全台等床</span>
        <span
          data-testid="er-national-total"
          style={{
            fontFamily: FONT_DATA, fontSize: fs(v2, 20), fontWeight: 700, color: "#fff",
            fontVariantNumeric: "tabular-nums", lineHeight: 1,
          }}
        >
          {summary.total.toLocaleString()}
        </span>
        <span style={{ fontFamily: FONT_CJK, fontSize: fs(v2, 9), color: COLORS.textFaint }}>人</span>
      </div>

      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
        <div
          style={{
            display: "flex", height: 6, borderRadius: RADIUS.sm, overflow: "hidden",
            background: "rgba(255,255,255,0.06)",
          }}
        >
          {ER_SEVERITY_ORDER.map((lv) => {
            const n = summary.counts[lv];
            if (n === 0) return null;
            const pct = withData > 0 ? n / withData : 0;
            return (
              <span
                key={lv}
                {...tip.bind({
                  title: ER_LEVEL_LABELS[lv],
                  rows: [{ dot: ER_LEVEL_COLORS[lv], value: `${n} 院` }],
                  note: `${(pct * 100).toFixed(0)}%`,
                })}
                style={{ width: `${pct * 100}%`, background: ER_LEVEL_COLORS[lv] }}
              />
            );
          })}
          {tip.node}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "2px 10px" }}>
          {ER_SEVERITY_ORDER.map((lv) => (
            <span
              key={lv}
              data-testid={`er-national-count-${lv}`}
              style={{ display: "inline-flex", alignItems: "center", gap: 3, fontFamily: FONT_DATA, fontSize: fs(v2, 9), color: COLORS.textMuted }}
            >
              <span style={{ width: 5, height: 5, borderRadius: RADIUS.full, background: ER_LEVEL_COLORS[lv] }} />
              {ER_LEVEL_LABELS[lv]} {summary.counts[lv]} 院
            </span>
          ))}
          {summary.noData > 0 && (
            <span style={{ fontFamily: FONT_DATA, fontSize: fs(v2, 9), color: COLORS.textFaint }}>
              無資料 {summary.noData}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/** v2 全台分級堆疊條＋一行色點圖例（家數） */
function ErSeverityBar({ summary }: { summary: ErSummary }) {
  const withData = ER_SEVERITY_ORDER.reduce((sum, lv) => sum + summary.counts[lv], 0);
  const tip = useChartTooltip();
  return (
    <div data-testid="er-national-summary" style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
      <div style={{ display: "flex", height: 8, borderRadius: RADIUS.sm, overflow: "hidden", background: WHITE_ALPHA[8] }}>
        {ER_SEVERITY_ORDER.map((lv) => {
          const n = summary.counts[lv];
          if (n === 0) return null;
          const pct = withData > 0 ? n / withData : 0;
          return (
            <span
              key={lv}
              {...tip.bind({ title: ER_LEVEL_LABELS[lv], rows: [{ dot: ER_LEVEL_COLORS[lv], value: `${n} 院` }], note: `${(pct * 100).toFixed(0)}%` })}
              style={{ width: `${pct * 100}%`, background: ER_LEVEL_COLORS[lv] }}
            />
          );
        })}
        {tip.node}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "2px 12px", fontFamily: FONT_DATA, fontSize: MF.label, color: COLORS.textMuted }}>
        {ER_SEVERITY_ORDER.map((lv) => (
          <span key={lv} data-testid={`er-national-count-${lv}`} style={{ display: "inline-flex", alignItems: "center", gap: 4, whiteSpace: "nowrap" }}>
            <span style={{ width: 6, height: 6, borderRadius: RADIUS.full, background: ER_LEVEL_COLORS[lv] }} />
            {ER_LEVEL_LABELS[lv]} {summary.counts[lv]} 院
          </span>
        ))}
        {summary.noData > 0 && (
          <span style={{ color: COLORS.textDim, whiteSpace: "nowrap" }}>無資料 {summary.noData} 院</span>
        )}
      </div>
    </div>
  );
}

/** 全台 14 天等床趨勢（總集列正下方）— TimeseriesSparkline 動態寬版，捨棄首桶（rolling window 邊界偏低） */
function ErWaitTrend14d({ spark }: { spark: SparklinePoint[] }) {
  const v2 = useMonitorV2();
  return (
    <div data-testid="er-wait-trend-14d" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {v2 ? (
        <SectionLabel>近 14 天 · 全台等床</SectionLabel>
      ) : (
        <span style={{ fontFamily: FONT_DATA, fontSize: fs(v2, 9), letterSpacing: "1px", color: COLORS.textFaint }}>
          14D TREND · 全台等床
        </span>
      )}
      {spark.length === 0 ? (
        <div style={{ fontFamily: FONT_CJK, fontSize: fs(v2, FONT_SIZE.xs), color: COLORS.textFaint, padding: "8px 0", textAlign: "center" }}>
          載入中…
        </div>
      ) : (
        <TimeseriesSparkline data={spark} unit="人" height={64} fillArea lineColor="#fb7185" showTooltip />
      )}
    </div>
  );
}

/** 區 header 小計迷你比例條（4px 高 × 80px 寬） */
function ErRegionMiniBar({ summary }: { summary: ErSummary }) {
  const withData = ER_SEVERITY_ORDER.reduce((sum, lv) => sum + summary.counts[lv], 0);
  const tip = useChartTooltip();
  if (withData === 0) return null;
  return (
    <div
      style={{
        width: 80, height: 4, borderRadius: RADIUS.sm, overflow: "hidden",
        display: "flex", background: "rgba(255,255,255,0.08)", flexShrink: 0,
      }}
    >
      {ER_SEVERITY_ORDER.map((lv) => {
        const n = summary.counts[lv];
        if (n === 0) return null;
        return (
          <span
            key={lv}
            {...tip.bind({ title: ER_LEVEL_LABELS[lv], rows: [{ dot: ER_LEVEL_COLORS[lv], value: `${n} 院` }] })}
            style={{ width: `${(n / withData) * 100}%`, height: "100%", background: ER_LEVEL_COLORS[lv] }}
          />
        );
      })}
      {tip.node}
    </div>
  );
}

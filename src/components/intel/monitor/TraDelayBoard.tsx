import { useCallback, useMemo, type MouseEvent as ReactMouseEvent } from "react";
import { COLORS, FONT_CJK, FONT_DATA } from "../intelTokens";
import { RADIUS, FONT_SIZE } from "../../../styles/designTokens";
import { SectionLabel } from "./PressureRing";
import {
  fetchTraDelaySummary, fetchTraDelayTrains,
  toStrictTraDay, type TraDelayDay, type TraDelayDayStrict, type TraDelayTrain,
} from "../../../data/intelLoaders";
import { useChartTooltip } from "../../ChartHoverTooltip";
import { useMonitorResource } from "../../../hooks/useMonitorResource";
import { MonitorDataStatus } from "./MonitorDataStatus";
import { useMonitorV2 } from "./monitorStyle";
import { fs, MF } from "./monitorFont";
import { useMonitorTheme, type MonitorTheme } from "./monitorTheme";
import { useMonitorFreshness } from "./monitorFreshness";
import { MonitorKpis, MonitorNote, MonitorSub } from "./MonitorMetric";
import { TimeseriesSparkline, type SparklinePoint } from "../../TimeseriesSparkline";

/**
 * 台鐵誤點監測（migration 369）
 *
 * 資料鏈：TDX TrainLiveBoard（每 2 分鐘全量快照，含 DelayTime）
 *   → live.train_positions（只留 7 天）
 *   → analytics.tra_train_delay_daily / tra_delay_summary_daily（每日 01:56 聚合，永久保留）
 *
 * ⚠️ 畫面上三件不可省的誠實標註：
 *  1. **覆蓋率必須露出**：live board 只回報約 85% 的班表班次，
 *     用「觀測到的班次」當分母算出的準點率會比用全量班表樂觀。不標等於謊報。
 *  2. **誤點口徑有兩種**：主數字用「曾經誤點 ≥5 分」（含短暫誤點），
 *     括號的 p90 是「多數時間誤點 ≥5 分」。上游偶有 6→95→7 分的假尖峰，
 *     兩個並陳才看得出哪天是真的壞、哪天只是尖刺。
 *  3. **不是官方準點率**：官方看的是到站誤點，而 live board 在列車抵達終點前
 *     1~3 站就停止回報，拿不到真正的到站時刻。這裡的數字只能自己比自己。
 */

const WINDOW = 60;
const TOP_N = 5;
const EMPTY_TRA_DAYS: TraDelayDay[] = [];
const EMPTY_TRA_TRAINS: TraDelayTrain[] = [];
/** 日資料：缺一天以上（nearDestTrains = 0 的日子不入序列）就斷線，不補值連過去 */
const TRA_GAP_SEC = 86400 * 1.5;

interface Props { open: boolean }

function delayColor(theme: MonitorTheme, min: number | null): string {
  if (min === null) return theme.p.textDim;
  if (min >= 30) return theme.p.statusErr;
  if (min >= 10) return theme.p.statusWarn;
  if (min >= 5) return theme.text("#eab308");
  return theme.p.statusLive;
}

export function TraDelayBoard({ open }: Props) {
  const theme = useMonitorTheme();
  const loadDays = useCallback(() => fetchTraDelaySummary(WINDOW), []);
  const loadTrains = useCallback(() => fetchTraDelayTrains("", 5, TOP_N), []);
  const daysQuery = useMonitorResource({ open, queryKey: "tra-delay-summary", intervalMs: 60 * 60_000, emptyData: EMPTY_TRA_DAYS, load: loadDays });
  const trainsQuery = useMonitorResource({ open, queryKey: "tra-delay-trains", intervalMs: 60 * 60_000, emptyData: EMPTY_TRA_TRAINS, load: loadTrains });
  const days = daysQuery.data;
  // 舊版畫面沿用原本「缺值補 0」的輸出；v2 用 days（保留 null）
  const daysS = useMemo(() => days.map(toStrictTraDay), [days]);
  const trains = trainsQuery.data;

  // 主數字用「最後一個算得出到站誤點的日子」——最新一天可能剛好缺班表（實測 175 天內有 9 天）
  const latest = useMemo(() => {
    for (let i = days.length - 1; i >= 0; i--) {
      if ((days[i]!.nearDestTrains ?? 0) > 0) return days[i]!;
    }
    return null;
  }, [days]);

  const v2 = useMonitorV2();
  // 資料期別＝主數字對應的營運日（YYYY-MM-DD → MM/DD）；資料日期＝該日台灣 00:00（日批次，>3 天過期）
  const latestMs = latest ? Date.parse(`${latest.serviceDate}T00:00:00+08:00`) : NaN;
  const fresh = useMonitorFreshness("traDelay", {
    timeText: latest ? latest.serviceDate.slice(5).replace("-", "/") : null,
    dataMs: Number.isNaN(latestMs) ? null : latestMs,
  });

  // v2 三線圖資料：nearDestTrains = 0 的日子不入序列（斷線，不代 0）；時間取營運日台北午夜
  const v2Lines = useMemo(() => {
    const rows = days.filter((d) => (d.observedTrains ?? 0) > 0 && (d.nearDestTrains ?? 0) > 0);
    // 該日計數缺值（null）→ 這個點略過（斷線），不當 0
    const toSeries = (pick: (d: TraDelayDay) => number | null): SparklinePoint[] =>
      rows.flatMap((d) => {
        const n = pick(d);
        return n === null ? [] : [{
          t: Date.parse(`${d.serviceDate}T00:00:00+08:00`) / 1000,
          v: (100 * n) / d.nearDestTrains!,
        }];
      });
    return {
      n: rows.length,
      gaps: days.filter((d) => (d.observedTrains ?? 0) > 0 && d.nearDestTrains === 0).length,
      over0: toSeries((d) => d.nearDestOver0),
      over5: toSeries((d) => d.nearDestOver5),
      over15: toSeries((d) => d.nearDestOver15),
    };
  }, [days]);
  const over5Extra = useMemo(
    () => ({ data: v2Lines.over5, color: TREND_LINES[1].color, label: TREND_LINES[1].label }),
    [v2Lines],
  );
  const over15More = useMemo(
    () => [{ data: v2Lines.over15, color: TREND_LINES[2].color, label: TREND_LINES[2].label }],
    [v2Lines],
  );

  if (!latest) {
    return (
      <div>
        {!v2 && <SectionLabel>TRA DELAY</SectionLabel>}
        <MonitorDataStatus label="台鐵誤點摘要" query={daysQuery} />
        <MonitorDataStatus label="台鐵誤點車次" query={trainsQuery} />
        <div style={{ fontFamily: FONT_CJK, fontSize: fs(v2, FONT_SIZE.sm), color: theme.p.textDim }}>
          {daysQuery.status === "unknown" ? "資料載入中…" : "尚無台鐵誤點資料"}
        </div>
      </div>
    );
  }

  // 全部走口徑 C（到站誤點）：與下方三線圖同一口徑，避免同一格裡兩種定義並存
  // v2：計數缺值（null）→ null → 顯示「—」；舊版用補 0 的 strict 版本
  const ratio = (n: number | null) => (n === null || latest.nearDestTrains === null ? null : (n / latest.nearDestTrains) * 100);
  const pctV2 = ratio(latest.nearDestOver5);
  const pct15V2 = ratio(latest.nearDestOver15);
  const latestS = toStrictTraDay(latest);
  const delayedPct = (latestS.nearDestOver5 / latestS.nearDestTrains) * 100;
  const delayedPct15 = (latestS.nearDestOver15 / latestS.nearDestTrains) * 100;

  if (v2) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
        <MonitorDataStatus label="台鐵誤點摘要" query={daysQuery} />
        <MonitorDataStatus label="台鐵誤點車次" query={trainsQuery} />
        <MonitorKpis
          muted={fresh.muted}
          items={[
            { label: "到站誤點", value: pctV2 === null ? "—" : pctV2.toFixed(0), unit: pctV2 === null ? undefined : "%" },
            { label: "平均誤點", value: latest.nearDestAvgDelay === null ? "—" : latest.nearDestAvgDelay.toFixed(1), unit: latest.nearDestAvgDelay === null ? undefined : "分" },
            // 這格刻意維持口徑 A：問的是「當日最糟到什麼程度」，本來就該看途中峰值
            { label: "途中最大", value: latest.maxDelayMin === null ? "—" : latest.maxDelayMin, unit: latest.maxDelayMin === null ? undefined : "分" },
          ]}
        />
        <MonitorSub
          items={[
            `逾 15 分 ${pct15V2 === null ? "—" : `${pct15V2.toFixed(0)}%`}`,
            `可判定 ${latest.nearDestTrains ?? "—"} 班`,
            `${latest.observedTrains ?? "—"} 班在跑`,
          ]}
        />
        {v2Lines.n >= 2 && (
          <div data-testid="tra-delay-trend" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ fontSize: MF.label, color: theme.p.textDim }}>
              到站誤點比例 近 {v2Lines.n} 天{v2Lines.gaps > 0 && ` · ${v2Lines.gaps} 天缺班表`}
            </div>
            <TimeseriesSparkline
              data={v2Lines.over0} unit="%" heightTier="lg" fillArea={false}
              lineColor={TREND_LINES[0].color} seriesLabel={TREND_LINES[0].label}
              extraSeries={over5Extra} moreSeries={over15More}
              gapSec={TRA_GAP_SEC} showTooltip tooltipDateFormat="date"
              staleUntil={fresh.staleUntil}
            />
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: MF.label, color: theme.p.textMuted }}>
              {TREND_LINES.map((l) => (
                <span key={l.label} style={{ display: "inline-flex", alignItems: "center", gap: 4, whiteSpace: "nowrap" }}>
                  <span style={{ width: 8, height: 2, background: theme.fill(l.color), display: "inline-block" }} />
                  {l.label}
                </span>
              ))}
            </div>
          </div>
        )}
        {trains.length > 0 && (
          <details data-testid="tra-worst-trains">
            <summary style={{ cursor: "pointer", fontSize: MF.label, color: theme.p.textMuted }}>
              最誤點車次 {trains.length} 班
            </summary>
            {trains.map((t) => (
              <div
                key={t.trainNo}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "3px 0", borderBottom: `1px solid ${theme.p.borderSoft}` }}
              >
                <span style={{ fontFamily: FONT_DATA, fontSize: MF.body, color: theme.p.textStrong, minWidth: 48 }}>{t.trainNo}</span>
                <span style={{ fontFamily: FONT_CJK, fontSize: MF.label, color: theme.p.textMuted, minWidth: 64, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {t.trainType}
                </span>
                <span style={{ fontFamily: FONT_CJK, fontSize: MF.label, color: theme.p.textDim, flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {t.originStation && t.destinationStation ? `${t.originStation}→${t.destinationStation}` : "班表外加班車"}
                </span>
                <span style={{ fontFamily: FONT_DATA, fontSize: MF.body, color: delayColor(theme, t.maxDelayMin), minWidth: 40, textAlign: "right", whiteSpace: "nowrap" }}>
                  {t.maxDelayMin ?? "—"}′
                </span>
                {/* max 與 p90 落差大 = 上游尖刺，不是真的誤點這麼久 */}
                {t.maxDelayMin !== null && t.p90DelayMin !== null && t.maxDelayMin - t.p90DelayMin >= 20 && (
                  <span title={`多數時間僅 ${t.p90DelayMin} 分，此峰值疑為上游資料尖刺`} style={{ fontFamily: FONT_DATA, fontSize: MF.label, color: theme.p.textFaint }}>
                    ⚠
                  </span>
                )}
              </div>
            ))}
          </details>
        )}
        {fresh.reason && (
          <MonitorNote tone={fresh.state === "stopped" ? "err" : "warn"}>{fresh.reason}</MonitorNote>
        )}
        <div style={{ fontFamily: FONT_CJK, fontSize: MF.label, color: theme.p.textFaint }}>
          {latest.serviceDate}
          {latest.coveragePct !== null && latest.scheduledTrains !== null && latest.observedTrains !== null && (
            <> · 覆蓋 {latest.coveragePct.toFixed(0)}%（{latest.observedTrains}/{latest.scheduledTrains} 班）</>
          )}
          <br />
          到站誤點口徑：取最後觀測（終點前 3 站內）的誤點，分母為可判定班次。
          非官方數字 —— TDX 在列車抵達終點前 1~3 站即停止回報，拿不到真正到站時刻。
        </div>
      </div>
    );
  }

  return (
    <div>
      {!v2 && <SectionLabel>TRA DELAY</SectionLabel>}
      <MonitorDataStatus label="台鐵誤點摘要" query={daysQuery} />
      <MonitorDataStatus label="台鐵誤點車次" query={trainsQuery} />

      {/* 三個主數字 */}
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <Stat
          label="到站誤點"
          value={`${delayedPct.toFixed(0)}%`}
          sub={`逾 15 分 ${delayedPct15.toFixed(0)}%`}
          color={delayedPct >= 15 ? theme.p.statusWarn : theme.p.textStrong}
        />
        <Stat
          label="平均誤點"
          value={latestS.nearDestAvgDelay === null ? "—" : `${latestS.nearDestAvgDelay.toFixed(1)}′`}
          sub={`可判定 ${latestS.nearDestTrains} 班`}
          color={delayColor(theme, latestS.nearDestAvgDelay)}
        />
        {/* 這格刻意維持口徑 A：問的是「當日最糟到什麼程度」，本來就該看途中峰值 */}
        <Stat
          label="途中最大"
          value={latestS.maxDelayMin === null ? "—" : `${latestS.maxDelayMin}′`}
          sub={`${latestS.observedTrains} 班在跑`}
          color={delayColor(theme, latestS.maxDelayMin)}
        />
      </div>

      {/* 近 60 天誤點比例走勢（三個閾值） */}
      <DelayTrendChart days={daysS} />

      {/* 最誤點車次 */}
      {trains.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <div style={{
            fontFamily: FONT_DATA, fontSize: fs(v2, FONT_SIZE.xs), color: theme.p.textDim, marginBottom: 4,
          }}>
            最誤點車次
          </div>
          {trains.map((t) => (
            <div
              key={t.trainNo}
              style={{
                display: "flex", alignItems: "center", gap: 6, padding: "3px 0",
                borderBottom: `1px solid ${theme.p.borderSoft}`,
              }}
            >
              <span style={{
                fontFamily: FONT_DATA, fontSize: fs(v2, FONT_SIZE.sm), color: theme.p.textStrong,
                minWidth: v2 ? 48 : 38,
              }}>
                {t.trainNo}
              </span>
              <span style={{
                fontFamily: FONT_CJK, fontSize: fs(v2, FONT_SIZE.xs), color: theme.p.textMuted,
                minWidth: v2 ? 64 : 52, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              }}>
                {t.trainType}
              </span>
              <span style={{
                fontFamily: FONT_CJK, fontSize: fs(v2, FONT_SIZE.xs), color: theme.p.textDim,
                flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              }}>
                {t.originStation && t.destinationStation
                  ? `${t.originStation}→${t.destinationStation}`
                  : "班表外加班車"}
              </span>
              <span style={{
                fontFamily: FONT_DATA, fontSize: fs(v2, FONT_SIZE.sm), color: delayColor(theme, t.maxDelayMin),
                minWidth: v2 ? 40 : 32, textAlign: "right",
              }}>
                {t.maxDelayMin ?? "—"}′
              </span>
              {/* max 與 p90 落差大 = 上游尖刺，不是真的誤點這麼久 */}
              {t.maxDelayMin !== null && t.p90DelayMin !== null
                && t.maxDelayMin - t.p90DelayMin >= 20 && (
                <span
                  title={`多數時間僅 ${t.p90DelayMin} 分，此峰值疑為上游資料尖刺`}
                  style={{ fontFamily: FONT_DATA, fontSize: fs(v2, FONT_SIZE.xs), color: theme.p.textFaint }}
                >
                  ⚠
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      <div style={{
        fontFamily: FONT_CJK, fontSize: fs(v2, FONT_SIZE.xs), color: theme.p.textFaint, lineHeight: 1.5,
      }}>
        {latestS.serviceDate}
        {latestS.coveragePct !== null && latestS.scheduledTrains !== null && (
          <> · 覆蓋 {latestS.coveragePct.toFixed(0)}%（{latestS.observedTrains}/{latestS.scheduledTrains} 班）</>
        )}
        <br />
        到站誤點口徑：取最後觀測（終點前 3 站內）的誤點，分母為可判定班次。
        非官方數字 —— TDX 在列車抵達終點前 1~3 站即停止回報，拿不到真正到站時刻。
      </div>
    </div>
  );
}

/**
 * 誤點比例三線圖：超過 0 / 5 / 15 分鐘，**口徑 C（到站誤點）**。
 *
 * ⚠️ 為什麼用 C 不用 A：口徑 A（當日曾誤點）的「超過 0 分」常年是 92% 的平線
 * —— 台鐵幾乎每班車一天當中都會誤個一兩分鐘，這條線沒有資訊量，卻因為數值最大
 * 而主導整張圖的 scale，把「超過 15 分」壓到貼底。改用 C（到站時晚了沒）後
 * 「超過 0 分」落在 37~47% 且有起伏，三條線分得開，也才對得上外部的官方統計。
 *
 * 分母是 nearDestTrains（最後觀測落在終點前 3 站內的班次），不是全部觀測班次。
 * nearDestTrains = 0 的日子（班表缺漏）折線**斷開**，不補值連過去。
 */
const TREND_LINES = [
  { label: "超過 0 分",  color: COLORS.accent,     pick: (d: TraDelayDayStrict) => d.nearDestOver0 },
  { label: "超過 5 分",  color: COLORS.statusWarn, pick: (d: TraDelayDayStrict) => d.nearDestOver5 },
  { label: "超過 15 分", color: COLORS.statusErr,  pick: (d: TraDelayDayStrict) => d.nearDestOver15 },
] as const;

const CHART_H = 46;

function DelayTrendChart({ days }: { days: TraDelayDayStrict[] }) {
  const theme = useMonitorTheme();
  const v2 = useMonitorV2();
  const tip = useChartTooltip();

  const geom = useMemo(() => {
    const pts = days.filter((d) => d.observedTrains > 0);
    if (pts.filter((d) => d.nearDestTrains > 0).length < 2) return null;
    // 分母為 0 的日子給 null，畫線時斷開（不可用 0 代入，會畫出假的谷底）
    const ratios = TREND_LINES.map((l) =>
      pts.map((d) => (d.nearDestTrains > 0 ? l.pick(d) / d.nearDestTrains : null)),
    );
    // scale 對齊最大的那條，三條共用同一 Y 軸才能互相比較
    const max = Math.max(...ratios.flat().filter((v): v is number => v !== null), 0.05);
    const x = (i: number) => (i / (pts.length - 1)) * 100;
    const y = (v: number) => CHART_H - (v / max) * (CHART_H - 2);
    const paths = ratios.map((r) => {
      let d = "";
      let pen = false;
      r.forEach((v, i) => {
        if (v === null) { pen = false; return; }
        d += `${pen ? "L" : "M"}${x(i).toFixed(2)},${y(v).toFixed(2)}`;
        pen = true;
      });
      return d;
    });
    const gaps = pts.filter((d) => d.nearDestTrains === 0).length;
    return { pts, paths, max, gaps };
  }, [days]);

  if (!geom) return null;

  function handleMove(e: ReactMouseEvent<SVGSVGElement>) {
    const { pts } = geom!;
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width === 0) return;
    const ratio = (e.clientX - rect.left) / rect.width;
    const i = Math.max(0, Math.min(Math.round(ratio * (pts.length - 1)), pts.length - 1));
    const d = pts[i]!;
    if (d.nearDestTrains === 0) {
      tip.show(e.clientX, e.clientY, {
        title: d.serviceDate,
        rows: [{ label: "到站誤點", value: "無資料" }],
        note: `當日缺班表，無法判斷是否抵達終點（觀測 ${d.observedTrains} 班）`,
      });
      return;
    }
    tip.show(e.clientX, e.clientY, {
      title: d.serviceDate,
      rows: TREND_LINES.map((l) => ({
        dot: theme.fill(l.color),
        label: l.label,
        value: `${((100 * l.pick(d)) / d.nearDestTrains).toFixed(1)}%（${l.pick(d)} 班）`,
      })),
      note: `到站誤點口徑・可判定 ${d.nearDestTrains} 班（全日觀測 ${d.observedTrains} 班）`,
    });
  }

  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: v2 ? "wrap" : undefined,
        fontFamily: FONT_DATA, fontSize: fs(v2, FONT_SIZE.xs), color: theme.p.textDim, marginBottom: 3,
      }}>
        <span>到站誤點比例 近 {geom.pts.length} 天</span>
        <span>{geom.gaps > 0 && `${geom.gaps} 天缺班表・`}上緣 {(geom.max * 100).toFixed(0)}%</span>
      </div>

      {/* ⚠️ 帶 viewBox 的 svg 有內建長寬比，直接放進 flex 會自己算高度把格子撐爆，
          所以固定高度的 wrapper + absolute svg（同 FoodPriceBoard 的處理） */}
      <div style={{ position: "relative", height: CHART_H }}>
        <svg
          viewBox={`0 0 100 ${CHART_H}`}
          preserveAspectRatio="none"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }}
          role="img"
          aria-label={`近 ${geom.pts.length} 天到站誤點比例走勢，含超過 0、5、15 分鐘三條線`}
          onMouseMove={handleMove}
          onMouseLeave={tip.hide}
        >
          {geom.paths.map((d, i) => (
            <path
              key={TREND_LINES[i]!.label}
              d={d}
              fill="none"
              stroke={theme.fill(TREND_LINES[i]!.color)}
              strokeWidth={1.2}
              vectorEffect="non-scaling-stroke"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}
        </svg>
      </div>

      {/* 圖例 */}
      <div style={{ display: "flex", gap: 10, marginTop: 4, flexWrap: v2 ? "wrap" : undefined }}>
        {TREND_LINES.map((l) => (
          <span key={l.label} style={{
            display: "flex", alignItems: "center", gap: 4,
            fontFamily: FONT_CJK, fontSize: fs(v2, FONT_SIZE.xs), color: theme.p.textDim,
          }}>
            <span style={{ width: 8, height: 2, background: theme.fill(l.color), display: "inline-block" }} />
            {l.label}
          </span>
        ))}
      </div>

      {tip.node}
    </div>
  );
}

function Stat({ label, value, sub, color }: {
  label: string; value: string; sub: string; color: string;
}) {
  const theme = useMonitorTheme();
  const v2 = useMonitorV2();
  return (
    <div style={{
      flex: 1, padding: "6px 8px", borderRadius: RADIUS.sm,
      border: `1px solid ${theme.p.borderSoft}`, background: theme.neutral(0.02),
      minWidth: 0,
    }}>
      <div style={{
        fontFamily: FONT_CJK, fontSize: fs(v2, FONT_SIZE.xs), color: theme.p.textDim, marginBottom: 2,
      }}>
        {label}
      </div>
      <div style={{ fontFamily: FONT_DATA, fontSize: fs(v2, FONT_SIZE.lg), color, lineHeight: 1.1 }}>
        {value}
      </div>
      {sub && (
        <div style={{
          fontFamily: FONT_DATA, fontSize: fs(v2, FONT_SIZE.xs), color: theme.p.textFaint, marginTop: 2,
          whiteSpace: v2 ? "normal" : "nowrap", overflow: "hidden", textOverflow: v2 ? "clip" : "ellipsis",
        }}>
          {sub}
        </div>
      )}
    </div>
  );
}

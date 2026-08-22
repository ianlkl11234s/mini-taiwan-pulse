import { useEffect, useMemo, useState, type MouseEvent as ReactMouseEvent } from "react";
import { COLORS, FONT_CJK, FONT_DATA } from "../intelTokens";
import { RADIUS, FONT_SIZE } from "../../../styles/designTokens";
import { SectionLabel } from "./PressureRing";
import {
  fetchTraDelaySummary, fetchTraDelayTrains,
  type TraDelayDay, type TraDelayTrain,
} from "../../../data/intelLoaders";
import { useChartTooltip } from "../../ChartHoverTooltip";

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

interface Props { open: boolean }

function delayColor(min: number | null): string {
  if (min === null) return COLORS.textDim;
  if (min >= 30) return COLORS.statusErr;
  if (min >= 10) return COLORS.statusWarn;
  if (min >= 5) return "#eab308";
  return COLORS.statusLive;
}

export function TraDelayBoard({ open }: Props) {
  const [days, setDays] = useState<TraDelayDay[]>([]);
  const [trains, setTrains] = useState<TraDelayTrain[]>([]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const tick = () => {
      fetchTraDelaySummary(WINDOW)
        .then((r) => { if (!cancelled) setDays(r); })
        .catch((e) => console.warn("[TraDelayBoard] summary", e));
      fetchTraDelayTrains("", 5, TOP_N)
        .then((r) => { if (!cancelled) setTrains(r); })
        .catch((e) => console.warn("[TraDelayBoard] trains", e));
    };
    tick();
    // 來源是 T+1 的每日聚合（pg_cron 01:56），一小時一次已遠快於需要
    const id = window.setInterval(tick, 60 * 60_000);
    return () => { cancelled = true; window.clearInterval(id); };
  }, [open]);

  // 主數字用「最後一個算得出到站誤點的日子」——最新一天可能剛好缺班表（實測 175 天內有 9 天）
  const latest = useMemo(() => {
    for (let i = days.length - 1; i >= 0; i--) {
      if (days[i]!.nearDestTrains > 0) return days[i]!;
    }
    return null;
  }, [days]);

  if (!latest) {
    return (
      <div>
        <SectionLabel>TRA DELAY</SectionLabel>
        <div style={{ fontFamily: FONT_CJK, fontSize: FONT_SIZE.sm, color: COLORS.textDim }}>
          尚無台鐵誤點資料
        </div>
      </div>
    );
  }

  // 全部走口徑 C（到站誤點）：與下方三線圖同一口徑，避免同一格裡兩種定義並存
  const delayedPct = (latest.nearDestOver5 / latest.nearDestTrains) * 100;
  const delayedPct15 = (latest.nearDestOver15 / latest.nearDestTrains) * 100;

  return (
    <div>
      <SectionLabel>TRA DELAY</SectionLabel>

      {/* 三個主數字 */}
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <Stat
          label="到站誤點"
          value={`${delayedPct.toFixed(0)}%`}
          sub={`逾 15 分 ${delayedPct15.toFixed(0)}%`}
          color={delayedPct >= 15 ? COLORS.statusWarn : COLORS.textStrong}
        />
        <Stat
          label="平均誤點"
          value={latest.nearDestAvgDelay === null ? "—" : `${latest.nearDestAvgDelay.toFixed(1)}′`}
          sub={`可判定 ${latest.nearDestTrains} 班`}
          color={delayColor(latest.nearDestAvgDelay)}
        />
        {/* 這格刻意維持口徑 A：問的是「當日最糟到什麼程度」，本來就該看途中峰值 */}
        <Stat
          label="途中最大"
          value={latest.maxDelayMin === null ? "—" : `${latest.maxDelayMin}′`}
          sub={`${latest.observedTrains} 班在跑`}
          color={delayColor(latest.maxDelayMin)}
        />
      </div>

      {/* 近 60 天誤點比例走勢（三個閾值） */}
      <DelayTrendChart days={days} />

      {/* 最誤點車次 */}
      {trains.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <div style={{
            fontFamily: FONT_DATA, fontSize: FONT_SIZE.xs, color: COLORS.textDim, marginBottom: 4,
          }}>
            最誤點車次
          </div>
          {trains.map((t) => (
            <div
              key={t.trainNo}
              style={{
                display: "flex", alignItems: "center", gap: 6, padding: "3px 0",
                borderBottom: `1px solid ${COLORS.borderSoft}`,
              }}
            >
              <span style={{
                fontFamily: FONT_DATA, fontSize: FONT_SIZE.sm, color: COLORS.textStrong,
                minWidth: 38,
              }}>
                {t.trainNo}
              </span>
              <span style={{
                fontFamily: FONT_CJK, fontSize: FONT_SIZE.xs, color: COLORS.textMuted,
                minWidth: 52, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              }}>
                {t.trainType}
              </span>
              <span style={{
                fontFamily: FONT_CJK, fontSize: FONT_SIZE.xs, color: COLORS.textDim,
                flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              }}>
                {t.originStation && t.destinationStation
                  ? `${t.originStation}→${t.destinationStation}`
                  : "班表外加班車"}
              </span>
              <span style={{
                fontFamily: FONT_DATA, fontSize: FONT_SIZE.sm, color: delayColor(t.maxDelayMin),
                minWidth: 32, textAlign: "right",
              }}>
                {t.maxDelayMin ?? "—"}′
              </span>
              {/* max 與 p90 落差大 = 上游尖刺，不是真的誤點這麼久 */}
              {t.maxDelayMin !== null && t.p90DelayMin !== null
                && t.maxDelayMin - t.p90DelayMin >= 20 && (
                <span
                  title={`多數時間僅 ${t.p90DelayMin} 分，此峰值疑為上游資料尖刺`}
                  style={{ fontFamily: FONT_DATA, fontSize: FONT_SIZE.xs, color: COLORS.textFaint }}
                >
                  ⚠
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      <div style={{
        fontFamily: FONT_CJK, fontSize: FONT_SIZE.xs, color: COLORS.textFaint, lineHeight: 1.5,
      }}>
        {latest.serviceDate}
        {latest.coveragePct !== null && latest.scheduledTrains !== null && (
          <> · 覆蓋 {latest.coveragePct.toFixed(0)}%（{latest.observedTrains}/{latest.scheduledTrains} 班）</>
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
  { label: "超過 0 分",  color: COLORS.accent,     pick: (d: TraDelayDay) => d.nearDestOver0 },
  { label: "超過 5 分",  color: COLORS.statusWarn, pick: (d: TraDelayDay) => d.nearDestOver5 },
  { label: "超過 15 分", color: COLORS.statusErr,  pick: (d: TraDelayDay) => d.nearDestOver15 },
] as const;

const CHART_H = 46;

function DelayTrendChart({ days }: { days: TraDelayDay[] }) {
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
        dot: l.color,
        label: l.label,
        value: `${((100 * l.pick(d)) / d.nearDestTrains).toFixed(1)}%（${l.pick(d)} 班）`,
      })),
      note: `到站誤點口徑・可判定 ${d.nearDestTrains} 班（全日觀測 ${d.observedTrains} 班）`,
    });
  }

  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "baseline",
        fontFamily: FONT_DATA, fontSize: FONT_SIZE.xs, color: COLORS.textDim, marginBottom: 3,
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
              stroke={TREND_LINES[i]!.color}
              strokeWidth={1.2}
              vectorEffect="non-scaling-stroke"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}
        </svg>
      </div>

      {/* 圖例 */}
      <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
        {TREND_LINES.map((l) => (
          <span key={l.label} style={{
            display: "flex", alignItems: "center", gap: 4,
            fontFamily: FONT_CJK, fontSize: FONT_SIZE.xs, color: COLORS.textDim,
          }}>
            <span style={{ width: 8, height: 2, background: l.color, display: "inline-block" }} />
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
  return (
    <div style={{
      flex: 1, padding: "6px 8px", borderRadius: RADIUS.sm,
      border: `1px solid ${COLORS.borderSoft}`, background: "rgba(255,255,255,0.02)",
      minWidth: 0,
    }}>
      <div style={{
        fontFamily: FONT_CJK, fontSize: FONT_SIZE.xs, color: COLORS.textDim, marginBottom: 2,
      }}>
        {label}
      </div>
      <div style={{ fontFamily: FONT_DATA, fontSize: FONT_SIZE.lg, color, lineHeight: 1.1 }}>
        {value}
      </div>
      {sub && (
        <div style={{
          fontFamily: FONT_DATA, fontSize: FONT_SIZE.xs, color: COLORS.textFaint, marginTop: 2,
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>
          {sub}
        </div>
      )}
    </div>
  );
}

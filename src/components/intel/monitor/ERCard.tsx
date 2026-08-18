import { useEffect, useMemo, useState } from "react";
import { COLORS, FONT_CJK, FONT_DATA } from "../intelTokens";
import { RADIUS, FONT_SIZE } from "../../../styles/designTokens";
import { SectionLabel, Sparkline } from "./PressureRing";
import { TimeseriesSparkline, type SparklinePoint } from "../../TimeseriesSparkline";
import {
  fetchErHospitalLatest, fetchErHospital24hAll, fetchErWaitTotal14d,
  type ErHospitalLatest, type ErHospital24hAllRow, type ErWaitTotal14dRow,
} from "../../../data/erHospitalLoader";
import { erCongestionColor, ER_LEVEL_COLORS, ER_LEVEL_LABELS, classifyErCongestion } from "../../../data/erCongestionTypes";
import { buildErRegionGroups, buildErSummary, ER_SEVERITY_ORDER, type ErHospitalCell, type ErSummary } from "./erCardData";

interface Props { open: boolean }

export function ERCard({ open }: Props) {
  const [latest, setLatest] = useState<ErHospitalLatest[]>([]);
  const [series, setSeries] = useState<ErHospital24hAllRow[]>([]);
  const [trend14d, setTrend14d] = useState<ErWaitTotal14dRow[]>([]);

  // ── latest 快照 + 全院 24h + 全台 14d 趨勢，open 時載入 + 5min poll（沿用舊 ERCard 節奏）──
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const tick = () => {
      fetchErHospitalLatest()
        .then((rows) => { if (!cancelled) setLatest(rows); })
        .catch((e) => console.warn("[ERCard] latest", e));
      fetchErHospital24hAll()
        .then((rows) => { if (!cancelled) setSeries(rows); })
        .catch((e) => console.warn("[ERCard] 24h all", e));
      fetchErWaitTotal14d()
        .then((rows) => { if (!cancelled) setTrend14d(rows); })
        .catch((e) => console.warn("[ERCard] wait total 14d", e));
    };
    tick();
    const id = window.setInterval(tick, 5 * 60_000);
    return () => { cancelled = true; window.clearInterval(id); };
  }, [open]);

  const groups = useMemo(() => buildErRegionGroups(latest, series), [latest, series]);
  const allHospitals = useMemo(() => groups.flatMap((g) => g.hospitals), [groups]);
  const nationalSummary = useMemo(() => buildErSummary(allHospitals), [allHospitals]);
  // 第一筆是 rolling window 邊界的部分小時（樣本少會偏低）→ 捨棄首桶再畫
  const trend14dSpark = useMemo<SparklinePoint[]>(
    () => trend14d.slice(1).map((r) => ({ t: r.bucket_ts, v: r.total_wait })),
    [trend14d],
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <SectionLabel color={COLORS.accent}>急診壅塞 · ER CONGESTION 24H</SectionLabel>
      <div
        style={{
          borderRadius: RADIUS.xl,
          border: `1px solid ${COLORS.panelBorder}`,
          background: "linear-gradient(160deg, rgba(239,68,68,0.06), rgba(255,255,255,0.012))",
          padding: "12px 14px",
          display: "flex", flexDirection: "column", gap: 10,
        }}
      >
        <span style={{ fontFamily: FONT_DATA, fontSize: FONT_SIZE.xs, letterSpacing: "1.2px", color: COLORS.textDim }}>
          ER WAIT · {latest.length} 院 24h 等一般病床
        </span>

        {allHospitals.length > 0 && <ErNationalSummaryRow summary={nationalSummary} />}

        {allHospitals.length > 0 && <ErWaitTrend14d spark={trend14dSpark} />}

        {groups.length === 0 ? (
          <div style={{ fontFamily: FONT_CJK, fontSize: FONT_SIZE.sm, color: COLORS.textFaint, padding: "8px 0" }}>
            資料載入中…
          </div>
        ) : groups.map((g) => {
          const regionSummary = buildErSummary(g.hospitals);
          return (
          <div key={g.region} data-testid={`er-region-${g.region}`} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontFamily: FONT_CJK, fontSize: 11, fontWeight: 700, color: COLORS.textDefault }}>
                {g.region}
              </span>
              <span style={{ fontFamily: FONT_DATA, fontSize: 9, color: COLORS.textFaint }}>
                {g.hospitals.length} 院
              </span>
              <span
                data-testid={`er-region-total-${g.region}`}
                style={{ fontFamily: FONT_DATA, fontSize: 9, color: COLORS.textFaint }}
              >
                Σ {regionSummary.total.toLocaleString()} 等床
              </span>
              <ErRegionMiniBar summary={regionSummary} />
              <div style={{ flex: 1, height: 1, background: COLORS.borderSoft }} />
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
                gap: 6,
              }}
            >
              {g.hospitals.map((h) => <HospitalCell key={h.hospId} cell={h} />)}
            </div>
          </div>
          );
        })}

        <div style={{ fontSize: FONT_SIZE.xs, color: COLORS.textDim }}>
          來源：衛福部 急診即時訂閱（get_er_hospital_latest / 24h_all）
        </div>
      </div>
    </div>
  );
}

function HospitalCell({ cell }: { cell: ErHospitalCell }) {
  const color = erCongestionColor(cell.wait);
  const level = classifyErCongestion(cell.wait);
  return (
    <div
      title={`${cell.name} · ${cell.areaName} · ${ER_LEVEL_LABELS[level]}`}
      style={{
        display: "flex", alignItems: "center", gap: 6,
        padding: "5px 7px", borderRadius: RADIUS.md,
        background: "rgba(255,255,255,0.025)",
        border: `1px solid ${COLORS.borderSoft}`,
        minWidth: 0,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1 }}>
        <span
          style={{
            fontFamily: FONT_CJK, fontSize: 10.5, color: COLORS.textDefault,
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}
        >
          {cell.name}
        </span>
        <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
          <span style={{ fontFamily: FONT_DATA, fontSize: 14, fontWeight: 700, color, lineHeight: 1.1 }}>
            {cell.wait == null ? "—" : cell.wait}
          </span>
          <span style={{ fontFamily: FONT_CJK, fontSize: 8.5, color: COLORS.textFaint }}>等床</span>
        </div>
      </div>
      <Sparkline data={cell.spark.length >= 2 ? cell.spark : [0, 0]} color={color} w={40} h={18} />
    </div>
  );
}

/** 全台總集列（卡片頂部、分區 section 之前）— 視覺密度比照能源卡標頭列 */
function ErNationalSummaryRow({ summary }: { summary: ErSummary }) {
  const withData = ER_SEVERITY_ORDER.reduce((sum, lv) => sum + summary.counts[lv], 0);
  return (
    <div
      data-testid="er-national-summary"
      style={{
        display: "flex", alignItems: "center", gap: 14,
        padding: "6px 10px", borderRadius: RADIUS.lg,
        background: "rgba(255,255,255,0.03)",
        border: `1px solid ${COLORS.borderSoft}`,
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 5, flexShrink: 0 }}>
        <span style={{ fontFamily: FONT_CJK, fontSize: 10, color: COLORS.textMuted }}>全台等床</span>
        <span
          data-testid="er-national-total"
          style={{
            fontFamily: FONT_DATA, fontSize: 20, fontWeight: 700, color: "#fff",
            fontVariantNumeric: "tabular-nums", lineHeight: 1,
          }}
        >
          {summary.total.toLocaleString()}
        </span>
        <span style={{ fontFamily: FONT_CJK, fontSize: 9, color: COLORS.textFaint }}>人</span>
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
                title={`${ER_LEVEL_LABELS[lv]} · ${n} 院 · ${(pct * 100).toFixed(0)}%`}
                style={{ width: `${pct * 100}%`, background: ER_LEVEL_COLORS[lv] }}
              />
            );
          })}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "2px 10px" }}>
          {ER_SEVERITY_ORDER.map((lv) => (
            <span
              key={lv}
              data-testid={`er-national-count-${lv}`}
              style={{ display: "inline-flex", alignItems: "center", gap: 3, fontFamily: FONT_DATA, fontSize: 9, color: COLORS.textMuted }}
            >
              <span style={{ width: 5, height: 5, borderRadius: RADIUS.full, background: ER_LEVEL_COLORS[lv] }} />
              {ER_LEVEL_LABELS[lv]} {summary.counts[lv]} 院
            </span>
          ))}
          {summary.noData > 0 && (
            <span style={{ fontFamily: FONT_DATA, fontSize: 9, color: COLORS.textFaint }}>
              無資料 {summary.noData}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/** 全台 14 天等床趨勢（總集列正下方）— TimeseriesSparkline 動態寬版，捨棄首桶（rolling window 邊界偏低） */
function ErWaitTrend14d({ spark }: { spark: SparklinePoint[] }) {
  return (
    <div data-testid="er-wait-trend-14d" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ fontFamily: FONT_DATA, fontSize: 9, letterSpacing: "1px", color: COLORS.textFaint }}>
        14D TREND · 全台等床
      </span>
      {spark.length === 0 ? (
        <div style={{ fontFamily: FONT_CJK, fontSize: FONT_SIZE.xs, color: COLORS.textFaint, padding: "8px 0", textAlign: "center" }}>
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
  if (withData === 0) return null;
  return (
    <div
      title={ER_SEVERITY_ORDER.map((lv) => `${ER_LEVEL_LABELS[lv]} ${summary.counts[lv]}`).join(" · ")}
      style={{
        width: 80, height: 4, borderRadius: RADIUS.sm, overflow: "hidden",
        display: "flex", background: "rgba(255,255,255,0.08)", flexShrink: 0,
      }}
    >
      {ER_SEVERITY_ORDER.map((lv) => {
        const n = summary.counts[lv];
        if (n === 0) return null;
        return (
          <span key={lv} style={{ width: `${(n / withData) * 100}%`, height: "100%", background: ER_LEVEL_COLORS[lv] }} />
        );
      })}
    </div>
  );
}

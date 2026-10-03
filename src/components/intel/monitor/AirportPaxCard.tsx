import { useCallback, useMemo, useState } from "react";
import { COLORS, FONT_CJK, FONT_DATA } from "../intelTokens";
import { RADIUS, FONT_SIZE } from "../../../styles/designTokens";
import { SectionLabel } from "./PressureRing";
import { TimeseriesSparkline, type SparklinePoint } from "../../TimeseriesSparkline";
import { fetchAirportHourlyPax, type AirportPaxBucket } from "../../../data/airportPaxLoader";
import { useMonitorResource } from "../../../hooks/useMonitorResource";
import { MonitorDataStatus } from "./MonitorDataStatus";
import { useMonitorV2 } from "./monitorStyle";
import { useMonitorTheme } from "./monitorTheme";
import { fs, MF } from "./monitorFont";
import { MonitorKpis, MonitorMetric, MonitorNote } from "./MonitorMetric";
import { useMonitorFreshness } from "./monitorFreshness";

const AIRPORTS: Array<{ code: string; label: string }> = [
  { code: "TPE", label: "桃園 TPE" },
  { code: "TSA", label: "松山 TSA" },
  { code: "KHH", label: "高雄 KHH" },
  { code: "RMQ", label: "台中 RMQ" },
];
const EMPTY_PAX: AirportPaxBucket[] = [];

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, whiteSpace: "nowrap" }}>
      <span style={{ width: 8, height: 2, background: color, display: "inline-block" }} />
      {label}
    </span>
  );
}

interface Props { open: boolean }

export function AirportPaxCard({ open }: Props) {
  const v2 = useMonitorV2();
  const theme = useMonitorTheme();
  const IN_COLOR = theme.p.accent;
  const OUT_COLOR = theme.p.statusWarn;
  const [activeCode, setActiveCode] = useState("TPE");
  const load = useCallback(() => fetchAirportHourlyPax(activeCode, 24), [activeCode]);
  const query = useMonitorResource({
    open, queryKey: `airport-pax:${activeCode}`, intervalMs: 5 * 60_000,
    emptyData: EMPTY_PAX, load,
  });
  const [inSeries, outSeries] = useMemo(() => {
    // v=0 視為缺格剔除：APIS 快照常見單方向細格，避免聚合假 0 被畫成低谷。
    const toSeries = (pick: (r: AirportPaxBucket) => number): SparklinePoint[] =>
      query.data
        .map((r) => ({ t: Date.parse(r.hour_bucket) / 1000, v: pick(r) || 0 }))
        .filter((p) => p.v > 0);
    return [toSeries((r) => Number(r.pax_in)), toSeries((r) => Number(r.pax_out))];
  }, [query.data]);

  // v2 專用：缺值（null／非數字）剔除成缺口，真 0 保留（舊版仍沿用上面「0＝缺格」的畫法）
  const [inSeriesV2, outSeriesV2] = useMemo(() => {
    const toSeries = (pick: (r: AirportPaxBucket) => number | null | undefined): SparklinePoint[] =>
      query.data.flatMap((r) => {
        const raw = pick(r);
        const t = Date.parse(r.hour_bucket) / 1000;
        if (raw == null || !Number.isFinite(Number(raw)) || !Number.isFinite(t)) return [];
        return [{ t, v: Number(raw) }];
      });
    return [toSeries((r) => r.pax_in), toSeries((r) => r.pax_out)];
  }, [query.data]);
  const sumOrNull = (pts: SparklinePoint[]) => (pts.length ? pts.reduce((s, p) => s + p.v, 0) : null);

  const sumIn = inSeries.reduce((s, p) => s + p.v, 0);
  const sumOut = outSeries.reduce((s, p) => s + p.v, 0);
  const hasReadableData = query.status === "ready" || query.lastSuccessAt !== null;
  // 標題列時間＝最新一筆快照小時；沒有最新小時桶就是「無資料」，不退回最後成功更新（那是瀏覽器時間）
  const latestBucket = query.data.reduce((m, r) => Math.max(m, Date.parse(r.hour_bucket) || 0), 0);
  const fresh = useMonitorFreshness("airportPax", {
    time: latestBucket > 0 ? latestBucket : null,
    reason: "機場資料收集已停止或 24 小時內無資料",
  });

  // 圖與主數字共用：入境主線＋出境疊線（同單位人）
  const outExtraV2 = useMemo(() => ({ data: outSeriesV2, color: OUT_COLOR, label: "出境" }), [outSeriesV2, OUT_COLOR]);

  if (v2) {
    const fmt = (n: number | null) => (hasReadableData && n != null ? n.toLocaleString("zh-TW") : "—");
    const sumInV2 = sumOrNull(inSeriesV2);
    const sumOutV2 = sumOrNull(outSeriesV2);
    const loaded = query.status !== "unknown";
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {AIRPORTS.map((a) => (
            <button
              key={a.code}
              onClick={() => setActiveCode(a.code)}
              style={{
                fontFamily: FONT_CJK, fontSize: MF.label,
                padding: "3px 8px", borderRadius: RADIUS.sm,
                border: `1px solid ${activeCode === a.code ? theme.p.accent : theme.p.panelBorder}`,
                background: activeCode === a.code ? theme.p.accentFaint : "transparent",
                color: activeCode === a.code ? theme.p.textStrong : theme.p.textMuted,
                cursor: "pointer",
              }}
            >
              {a.label}
            </button>
          ))}
        </div>
        <MonitorDataStatus label="機場旅客資料" query={query} />
        <MonitorMetric value={fmt(sumInV2)} unit="人" color={IN_COLOR} muted={fresh.muted} />
        <MonitorKpis items={[{ label: "24 小時出境", value: fmt(sumOutV2), unit: "人" }]} />
        {query.status === "unknown" ? (
          <MonitorNote>載入中…</MonitorNote>
        ) : inSeriesV2.length === 0 ? null : (
          <>
            {/* gapSec 2h：相鄰快照缺 2 小時以上 → 斷線呈現（缺格 ≠ 低谷） */}
            <TimeseriesSparkline
              data={inSeriesV2} unit="人" lineColor={IN_COLOR} heightTier="std"
              gapSec={2 * 3600} showTooltip seriesLabel="入境" extraSeries={outExtraV2}
              staleUntil={fresh.staleUntil}
            />
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: MF.label, color: theme.p.textMuted }}>
              <LegendDot color={IN_COLOR} label="入境" />
              <LegendDot color={OUT_COLOR} label="出境" />
            </div>
          </>
        )}
        {loaded && fresh.reason && (
          <MonitorNote tone={fresh.state === "stopped" ? "err" : "warn"}>{fresh.reason}</MonitorNote>
        )}
        <MonitorNote>來源：移民署 APIS（每小時）</MonitorNote>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {!v2 && <SectionLabel color={COLORS.accent}>機場入出境 · BORDER PAX 24H</SectionLabel>}
      <div
        style={v2 ? { display: "flex", flexDirection: "column", gap: 8, minWidth: 0 } : {
          borderRadius: RADIUS.xl,
          border: `1px solid ${COLORS.panelBorder}`,
          background: "linear-gradient(160deg, rgba(14,165,233,0.06), rgba(255,255,255,0.012))",
          padding: "12px 14px",
          display: "flex", flexDirection: "column", gap: 8,
        }}
      >
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {AIRPORTS.map((a) => (
            <button
              key={a.code}
              onClick={() => setActiveCode(a.code)}
              style={{
                fontFamily: FONT_CJK, fontSize: fs(v2, FONT_SIZE.sm),
                padding: "3px 8px", borderRadius: RADIUS.sm,
                border: `1px solid ${activeCode === a.code ? "#0ea5e9" : COLORS.panelBorder}`,
                background: activeCode === a.code ? "rgba(14,165,233,0.18)" : "transparent",
                color: activeCode === a.code ? "#fff" : COLORS.textMuted,
                cursor: "pointer",
              }}
            >
              {a.label}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: fs(v2, FONT_SIZE.sm) }}>
          <span style={{ color: "#10b981" }}>
            24h 入 <span style={{ fontFamily: FONT_DATA, fontWeight: 700 }}>{hasReadableData ? sumIn.toLocaleString("zh-TW") : "—"}</span>
          </span>
          <span style={{ color: "#fb7185" }}>
            24h 出 <span style={{ fontFamily: FONT_DATA, fontWeight: 700 }}>{hasReadableData ? sumOut.toLocaleString("zh-TW") : "—"}</span>
          </span>
        </div>
        <MonitorDataStatus label="機場旅客資料" query={query} />
        {query.status === "unknown" ? (
          <div style={{ fontSize: fs(v2, FONT_SIZE.sm), color: COLORS.textDim, textAlign: "center", padding: "8px 0" }}>
            載入中…
          </div>
        ) : inSeries.length === 0 ? (
          <div style={{ fontSize: fs(v2, FONT_SIZE.xs), color: COLORS.textDim }}>
            {v2 ? "無資料（此機場未涵蓋）" : "無資料（border_airport_snapshot 未涵蓋此機場）"}
          </div>
        ) : (
          <>
            {/* gapSec 2h：相鄰快照缺 2 小時以上 → 斷線呈現（缺格 ≠ 低谷） */}
            <TimeseriesSparkline data={inSeries} unit="人" lineColor="#10b981" height={70} gapSec={2 * 3600} showTooltip seriesLabel="入境" />
            <TimeseriesSparkline data={outSeries} unit="人" lineColor="#fb7185" height={70} gapSec={2 * 3600} showTooltip seriesLabel="出境" />
          </>
        )}
        <div style={{ fontSize: fs(v2, FONT_SIZE.xs), color: COLORS.textDim }}>
          {v2 ? "來源：移民署 APIS（每小時）" : "來源：移民署 APIS（每小時 / get_airport_hourly_pax）"}
        </div>
      </div>
    </div>
  );
}

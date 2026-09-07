import { useCallback, useMemo, useState } from "react";
import { COLORS, FONT_CJK, FONT_DATA } from "../intelTokens";
import { RADIUS, FONT_SIZE } from "../../../styles/designTokens";
import { SectionLabel } from "./PressureRing";
import { TimeseriesSparkline, type SparklinePoint } from "../../TimeseriesSparkline";
import { fetchAirportHourlyPax, type AirportPaxBucket } from "../../../data/airportPaxLoader";
import { useMonitorResource } from "../../../hooks/useMonitorResource";
import { MonitorDataStatus } from "./MonitorDataStatus";

const AIRPORTS: Array<{ code: string; label: string }> = [
  { code: "TPE", label: "桃園 TPE" },
  { code: "TSA", label: "松山 TSA" },
  { code: "KHH", label: "高雄 KHH" },
  { code: "RMQ", label: "台中 RMQ" },
];
const EMPTY_PAX: AirportPaxBucket[] = [];

interface Props { open: boolean }

export function AirportPaxCard({ open }: Props) {
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

  const sumIn = inSeries.reduce((s, p) => s + p.v, 0);
  const sumOut = outSeries.reduce((s, p) => s + p.v, 0);
  const hasReadableData = query.status === "ready" || query.lastSuccessAt !== null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <SectionLabel color={COLORS.accent}>機場入出境 · BORDER PAX 24H</SectionLabel>
      <div
        style={{
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
                fontFamily: FONT_CJK, fontSize: FONT_SIZE.sm,
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
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: FONT_SIZE.sm }}>
          <span style={{ color: "#10b981" }}>
            24h 入 <span style={{ fontFamily: FONT_DATA, fontWeight: 700 }}>{hasReadableData ? sumIn.toLocaleString("zh-TW") : "—"}</span>
          </span>
          <span style={{ color: "#fb7185" }}>
            24h 出 <span style={{ fontFamily: FONT_DATA, fontWeight: 700 }}>{hasReadableData ? sumOut.toLocaleString("zh-TW") : "—"}</span>
          </span>
        </div>
        <MonitorDataStatus label="機場旅客資料" query={query} />
        {query.status === "unknown" ? (
          <div style={{ fontSize: FONT_SIZE.sm, color: COLORS.textDim, textAlign: "center", padding: "8px 0" }}>
            載入中…
          </div>
        ) : inSeries.length === 0 ? (
          <div style={{ fontSize: FONT_SIZE.xs, color: COLORS.textDim }}>
            無資料（border_airport_snapshot 未涵蓋此機場）
          </div>
        ) : (
          <>
            {/* gapSec 2h：相鄰快照缺 2 小時以上 → 斷線呈現（缺格 ≠ 低谷） */}
            <TimeseriesSparkline data={inSeries} unit="人" lineColor="#10b981" height={70} gapSec={2 * 3600} showTooltip seriesLabel="入境" />
            <TimeseriesSparkline data={outSeries} unit="人" lineColor="#fb7185" height={70} gapSec={2 * 3600} showTooltip seriesLabel="出境" />
          </>
        )}
        <div style={{ fontSize: FONT_SIZE.xs, color: COLORS.textDim }}>
          來源：移民署 APIS（每小時 / get_airport_hourly_pax）
        </div>
      </div>
    </div>
  );
}

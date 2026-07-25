import { useEffect, useState } from "react";
import { COLORS, FONT_CJK, FONT_DATA } from "../intelTokens";
import { RADIUS, FONT_SIZE } from "../../../styles/designTokens";
import { SectionLabel } from "./PressureRing";
import { TimeseriesSparkline, type SparklinePoint } from "../../TimeseriesSparkline";
import { fetchAirportHourlyPax } from "../../../data/airportPaxLoader";

const AIRPORTS: Array<{ code: string; label: string }> = [
  { code: "TPE", label: "桃園 TPE" },
  { code: "TSA", label: "松山 TSA" },
  { code: "KHH", label: "高雄 KHH" },
  { code: "RMQ", label: "台中 RMQ" },
];

interface Props { open: boolean }

export function AirportPaxCard({ open }: Props) {
  const [activeCode, setActiveCode] = useState("TPE");
  const [inSeries, setInSeries] = useState<SparklinePoint[]>([]);
  const [outSeries, setOutSeries] = useState<SparklinePoint[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    const tick = () => {
      fetchAirportHourlyPax(activeCode, 24)
        .then((rows) => {
          if (cancelled) return;
          // v=0 視為缺格剔除：APIS 快照常見「該小時只收到單一方向細格」，
          // 另一方向被 RPC SUM(CASE…ELSE 0) 聚合成假 0（TPE 白天 in=0 即此類）。
          // 剔除後由 sparkline 的 gapSec 呈現斷線；24h 加總不受影響（0 貢獻 0）。
          const toSeries = (pick: (r: (typeof rows)[number]) => number) =>
            rows
              .map((r) => ({ t: Date.parse(r.hour_bucket) / 1000, v: pick(r) || 0 }))
              .filter((p) => p.v > 0);
          setInSeries(toSeries((r) => Number(r.pax_in)));
          setOutSeries(toSeries((r) => Number(r.pax_out)));
        })
        .catch((e) => console.warn("[AirportPaxCard]", e))
        .finally(() => { if (!cancelled) setLoading(false); });
    };
    tick();
    const id = window.setInterval(tick, 5 * 60_000);
    return () => { cancelled = true; window.clearInterval(id); };
  }, [open, activeCode]);

  const sumIn = inSeries.reduce((s, p) => s + p.v, 0);
  const sumOut = outSeries.reduce((s, p) => s + p.v, 0);

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
            24h 入 <span style={{ fontFamily: FONT_DATA, fontWeight: 700 }}>{sumIn.toLocaleString("zh-TW")}</span>
          </span>
          <span style={{ color: "#fb7185" }}>
            24h 出 <span style={{ fontFamily: FONT_DATA, fontWeight: 700 }}>{sumOut.toLocaleString("zh-TW")}</span>
          </span>
        </div>
        {loading ? (
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
            <TimeseriesSparkline data={inSeries} unit="人" lineColor="#10b981" height={70} gapSec={2 * 3600} />
            <TimeseriesSparkline data={outSeries} unit="人" lineColor="#fb7185" height={70} gapSec={2 * 3600} />
          </>
        )}
        <div style={{ fontSize: FONT_SIZE.xs, color: COLORS.textDim }}>
          來源：移民署 APIS（每小時 / get_airport_hourly_pax）
        </div>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { COLORS, FONT_CJK, FONT_DATA } from "../intelTokens";
import { RADIUS, FONT_SIZE } from "../../../styles/designTokens";
import { SectionLabel, Sparkline } from "./PressureRing";
import {
  fetchErHospitalLatest, fetchErHospital24hAll,
  type ErHospitalLatest, type ErHospital24hAllRow,
} from "../../../data/erHospitalLoader";
import { erCongestionColor, ER_LEVEL_LABELS, classifyErCongestion } from "../../../data/erCongestionTypes";
import { buildErRegionGroups, type ErHospitalCell } from "./erCardData";

interface Props { open: boolean }

export function ERCard({ open }: Props) {
  const [latest, setLatest] = useState<ErHospitalLatest[]>([]);
  const [series, setSeries] = useState<ErHospital24hAllRow[]>([]);

  // ── latest 快照 + 全院 24h，open 時載入 + 5min poll（沿用舊 ERCard 節奏）──
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
    };
    tick();
    const id = window.setInterval(tick, 5 * 60_000);
    return () => { cancelled = true; window.clearInterval(id); };
  }, [open]);

  const groups = useMemo(() => buildErRegionGroups(latest, series), [latest, series]);

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

        {groups.length === 0 ? (
          <div style={{ fontFamily: FONT_CJK, fontSize: FONT_SIZE.sm, color: COLORS.textFaint, padding: "8px 0" }}>
            資料載入中…
          </div>
        ) : groups.map((g) => (
          <div key={g.region} data-testid={`er-region-${g.region}`} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
              <span style={{ fontFamily: FONT_CJK, fontSize: 11, fontWeight: 700, color: COLORS.textDefault }}>
                {g.region}
              </span>
              <span style={{ fontFamily: FONT_DATA, fontSize: 9, color: COLORS.textFaint }}>
                {g.hospitals.length} 院
              </span>
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
        ))}

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

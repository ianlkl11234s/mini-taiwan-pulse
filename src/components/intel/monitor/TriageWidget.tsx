import { useMemo } from "react";
import { COLORS, FONT_CJK, FONT_DATA, GIS_LEVELS, SEV_LEVELS } from "../intelTokens";
import { RADIUS, FONT_SIZE } from "../../../styles/designTokens";
import type { ClusterEvent } from "../../../data/newsEventsLoader";
import { SectionLabel, Widget } from "./PressureRing";
import { useChartTooltip, fmtChartValue } from "../../ChartHoverTooltip";

function DistBar({
  label, levels, counts,
}: {
  label: string;
  levels: { label: string; color: string }[];
  counts: number[];
}) {
  const total = counts.reduce((a, b) => a + b, 0) || 1;
  const tip = useChartTooltip();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span
        style={{
          fontFamily: FONT_DATA, fontSize: FONT_SIZE.xs, letterSpacing: "0.5px",
          color: COLORS.textDim,
        }}
      >
        {label}
      </span>
      <div
        {...tip.bind(() => ({
          title: label,
          rows: levels.flatMap((lv, i) =>
            counts[i]
              ? [{ dot: lv.color, label: lv.label, value: fmtChartValue(counts[i] ?? 0) }]
              : [],
          ),
        }))}
        style={{
          display: "flex", height: 9, borderRadius: RADIUS.md, overflow: "hidden",
          background: "rgba(255,255,255,0.04)",
        }}
      >
        {levels.map((lv, i) =>
          counts[i] ? (
            <span
              key={i}
              style={{
                width: `${((counts[i] ?? 0) / total) * 100}%`, background: lv.color,
              }}
            />
          ) : null,
        )}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "3px 9px" }}>
        {levels.map((lv, i) => (
          <span
            key={i}
            style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              fontFamily: FONT_CJK, fontSize: 9.5,
              color: counts[i] ? COLORS.textDefault : COLORS.textGhost,
              whiteSpace: "nowrap",
            }}
          >
            <span
              style={{
                width: 7, height: 7, borderRadius: RADIUS.sm, background: lv.color,
                opacity: counts[i] ? 1 : 0.4,
              }}
            />
            {lv.label}{" "}
            <b
              style={{
                fontFamily: FONT_DATA,
                color: counts[i] ? "#fff" : COLORS.textFaint,
              }}
            >
              {counts[i] ?? 0}
            </b>
          </span>
        ))}
      </div>
      {tip.node}
    </div>
  );
}

interface Props {
  events: ClusterEvent[];
}

export function TriageWidget({ events }: Props) {
  const tri = useMemo(() => {
    const gis = [0, 0, 0, 0];
    const sev = [0, 0, 0, 0];
    let ev = 0, st = 0;
    for (const e of events) {
      const g = Math.max(0, Math.min(3, e.gis_relevance ?? 0));
      const s = Math.max(0, Math.min(3, e.severity ?? 0));
      gis[g] = (gis[g] ?? 0) + 1;
      sev[s] = (sev[s] ?? 0) + 1;
      if (e.is_event === false) st += 1;
      else ev += 1;
    }
    return { gis, sev, event: ev, statement: st };
  }, [events]);

  return (
    <Widget style={{ gridColumn: "1 / -1" }}>
      <SectionLabel>信號分級 · TRIAGE</SectionLabel>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18 }}>
        <DistBar label="地理相關 GIS_RELEVANCE" levels={GIS_LEVELS} counts={tri.gis} />
        <DistBar label="嚴重程度 SEVERITY" levels={SEV_LEVELS} counts={tri.sev} />
        <DistBar
          label="事件性質 IS_EVENT"
          levels={[
            { label: "事件", color: COLORS.accent },
            { label: "聲明", color: COLORS.textDim },
          ]}
          counts={[tri.event, tri.statement]}
        />
      </div>
    </Widget>
  );
}

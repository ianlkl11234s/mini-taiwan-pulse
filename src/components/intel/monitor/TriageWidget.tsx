import { useMemo } from "react";
import { COLORS, FONT_CJK, FONT_DATA, GIS_LEVELS, SEV_LEVELS } from "../intelTokens";
import { RADIUS, FONT_SIZE } from "../../../styles/designTokens";
import type { ClusterEvent } from "../../../data/newsEventsLoader";
import { SectionLabel, Widget } from "./PressureRing";
import { useMonitorV2 } from "./monitorStyle";
import { fs, MF } from "./monitorFont";
import { useChartTooltip, fmtChartValue } from "../../ChartHoverTooltip";

function DistBar({
  label, levels, counts,
}: {
  label: string;
  levels: { label: string; color: string }[];
  counts: number[];
}) {
  const v2 = useMonitorV2();
  const total = counts.reduce((a, b) => a + b, 0) || 1;
  const tip = useChartTooltip();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span
        style={{
          fontFamily: FONT_DATA, fontSize: fs(v2, FONT_SIZE.xs), letterSpacing: "0.5px",
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
              fontFamily: FONT_CJK, fontSize: fs(v2, 9.5),
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
                fontFamily: FONT_DATA, ...(v2 ? { fontSize: MF.body } : {}),
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
  const v2 = useMonitorV2();
  const tri = useMemo(() => {
    const gis = [0, 0, 0, 0];
    const sev = [0, 0, 0, 0];
    let ev = 0, st = 0;
    // v2：沒分級（null）不歸進第 0 級／事件，另計「未分級」；舊版維持原本 null→0 的歸法
    let gisNone = 0, sevNone = 0, evNone = 0;
    for (const e of events) {
      if (v2 && e.gis_relevance == null) gisNone += 1;
      else {
        const g = Math.max(0, Math.min(3, e.gis_relevance ?? 0));
        gis[g] = (gis[g] ?? 0) + 1;
      }
      if (v2 && e.severity == null) sevNone += 1;
      else {
        const s = Math.max(0, Math.min(3, e.severity ?? 0));
        sev[s] = (sev[s] ?? 0) + 1;
      }
      if (v2 && e.is_event == null) evNone += 1;
      else if (e.is_event === false) st += 1;
      else ev += 1;
    }
    return { gis, sev, event: ev, statement: st, gisNone, sevNone, evNone };
  }, [events, v2]);
  const withNone = (levels: { label: string; color: string }[], counts: number[], none: number) =>
    v2 && none > 0
      ? { levels: [...levels, { label: "未分級", color: COLORS.textGhost }], counts: [...counts, none] }
      : { levels, counts };
  const gisDist = withNone(GIS_LEVELS, tri.gis, tri.gisNone);
  const sevDist = withNone(SEV_LEVELS, tri.sev, tri.sevNone);
  const evDist = withNone(
    [{ label: "事件", color: COLORS.accent }, { label: "聲明", color: COLORS.textDim }],
    [tri.event, tri.statement],
    tri.evNone,
  );

  return (
    <Widget style={{ gridColumn: "1 / -1" }}>
      {!v2 && <SectionLabel>信號分級 · TRIAGE</SectionLabel>}
      <div style={{ display: "grid", gridTemplateColumns: v2 ? "repeat(auto-fit, minmax(170px, 1fr))" : "repeat(3, 1fr)", gap: 18 }}>
        <DistBar label={v2 ? "地理相關" : "地理相關 GIS_RELEVANCE"} levels={gisDist.levels} counts={gisDist.counts} />
        <DistBar label={v2 ? "嚴重程度" : "嚴重程度 SEVERITY"} levels={sevDist.levels} counts={sevDist.counts} />
        <DistBar
          label={v2 ? "事件性質" : "事件性質 IS_EVENT"}
          levels={evDist.levels}
          counts={evDist.counts}
        />
      </div>
    </Widget>
  );
}

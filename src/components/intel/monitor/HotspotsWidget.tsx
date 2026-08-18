import { useMemo } from "react";
import { IntelIcon } from "../IntelIcon";
import { COLORS, FONT_CJK, FONT_DATA, MICON } from "../intelTokens";
import { RADIUS, FONT_SIZE } from "../../../styles/designTokens";
import { getNewsCategoryDef, type NewsCategory } from "../../../data/newsEventTypes";
import type { ClusterEvent } from "../../../data/newsEventsLoader";
import { SectionLabel, Widget } from "./PressureRing";
import { useChartTooltip, fmtChartValue } from "../../ChartHoverTooltip";

interface Hotspot {
  county: string;
  n: number;
  topCat: NewsCategory;
  surge: number;
  cats: Record<string, number>;
}

function rankHotspots(events: ClusterEvent[], countyById: Map<number, string>): Hotspot[] {
  const byCounty: Record<string, { n: number; cats: Record<string, number> }> = {};
  for (const e of events) {
    const county = countyById.get(e.id);
    if (!county || county === "全國" || county === "全部") continue;
    if (!byCounty[county]) byCounty[county] = { n: 0, cats: {} };
    const slot = byCounty[county]!;
    slot.n += 1;
    const cat = (e.category ?? "other") as string;
    slot.cats[cat] = (slot.cats[cat] ?? 0) + 1;
  }
  const out: Hotspot[] = [];
  for (const [county, v] of Object.entries(byCounty)) {
    const top = Object.entries(v.cats).sort((a, b) => b[1] - a[1])[0];
    const topCat = (top?.[0] ?? "other") as NewsCategory;
    out.push({
      county, n: v.n, topCat,
      surge: +(1 + v.n * 0.28).toFixed(1),
      cats: v.cats,
    });
  }
  out.sort((a, b) => b.n - a.n);
  return out;
}

interface Props {
  events: ClusterEvent[];
  countyByEventId: Map<number, string>;
  onPickHotspot: (county: string) => void;
}

export function HotspotsWidget({ events, countyByEventId, onPickHotspot }: Props) {
  const ranked = useMemo(() => rankHotspots(events, countyByEventId), [events, countyByEventId]);
  const maxHot = ranked.length ? ranked[0]!.n : 1;
  const tip = useChartTooltip();

  return (
    <Widget>
      <SectionLabel>熱區 Top 5 · HOTSPOTS</SectionLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {ranked.slice(0, 5).map((r, i) => {
          const cat = getNewsCategoryDef(r.topCat);
          const tipHandlers = tip.bind(() => ({
            title: r.county,
            rows: [{ dot: cat.color, label: cat.label, value: fmtChartValue(r.n, "則") }],
            note: `熱度倍數 ×${r.surge}`,
          }));
          return (
            <button
              key={r.county}
              onClick={() => onPickHotspot(r.county)}
              onMouseMove={tipHandlers.onMouseMove}
              style={{
                display: "flex", alignItems: "center", gap: 9,
                padding: "6px 8px", borderRadius: RADIUS.lg, cursor: "pointer",
                background: "rgba(255,255,255,0.02)",
                border: `1px solid ${COLORS.borderSoft}`,
                textAlign: "left", transition: "background .12s",
              }}
              onMouseEnter={(ev) =>
                (ev.currentTarget.style.background = "rgba(255,255,255,0.06)")
              }
              onMouseLeave={(ev) => {
                ev.currentTarget.style.background = "rgba(255,255,255,0.02)";
                tipHandlers.onMouseLeave();
              }}
            >
              <span
                style={{
                  fontFamily: FONT_DATA, fontSize: FONT_SIZE.base, fontWeight: 700,
                  color: COLORS.textDim, width: 14,
                }}
              >
                {i + 1}
              </span>
              <span
                style={{
                  width: 8, height: 8, borderRadius: RADIUS.full,
                  background: cat.color, flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontFamily: FONT_CJK, fontSize: FONT_SIZE.md,
                  color: COLORS.textStrong, whiteSpace: "nowrap",
                }}
              >
                {r.county}
              </span>
              <span
                style={{
                  fontFamily: FONT_CJK, fontSize: 9.5, color: cat.color,
                  padding: "1px 6px", borderRadius: RADIUS.md,
                  background: `${cat.color}1f`, whiteSpace: "nowrap",
                }}
              >
                {cat.label}
              </span>
              <div
                style={{
                  flex: 1, height: 5, borderRadius: RADIUS.md,
                  background: "rgba(255,255,255,0.05)",
                  overflow: "hidden", minWidth: 20,
                }}
              >
                <span
                  style={{
                    display: "block", height: "100%",
                    width: `${(r.n / maxHot) * 100}%`,
                    background: cat.color, opacity: 0.7,
                  }}
                />
              </div>
              <span
                style={{
                  fontFamily: FONT_DATA, fontSize: FONT_SIZE.lg, fontWeight: 700,
                  color: "#fff", width: 18, textAlign: "right",
                }}
              >
                {r.n}
              </span>
              <span
                style={{
                  display: "inline-flex", alignItems: "center", gap: 2,
                  fontFamily: FONT_DATA, fontSize: 9.5,
                  color: r.surge >= 2 ? COLORS.statusWarn : COLORS.textDim,
                  width: 40,
                }}
              >
                {r.surge >= 2 && (
                  <IntelIcon d={MICON.flame!} size={10} color={COLORS.statusWarn} />
                )}
                ×{r.surge}
              </span>
            </button>
          );
        })}
        {ranked.length === 0 && (
          <div
            style={{
              fontFamily: FONT_CJK, fontSize: FONT_SIZE.base, color: COLORS.textFaint,
              padding: "10px 2px",
            }}
          >
            ⚠ 尚無資料
          </div>
        )}
      </div>
      {tip.node}
    </Widget>
  );
}

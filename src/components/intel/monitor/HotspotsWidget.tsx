import { useMemo } from "react";
import { IntelIcon } from "../IntelIcon";
import { COLORS, FONT_CJK, FONT_DATA, MICON } from "../intelTokens";
import { RADIUS, FONT_SIZE } from "../../../styles/designTokens";
import { getNewsCategoryDef, type NewsCategory } from "../../../data/newsEventTypes";
import type { ClusterEvent } from "../../../data/newsEventsLoader";
import type { TrendingRow } from "../../../data/intelLoaders";
import { SectionLabel, Widget } from "./PressureRing";
import { useMonitorV2 } from "./monitorStyle";
import { fs, MF } from "./monitorFont";
import { useChartTooltip, fmtChartValue } from "../../ChartHoverTooltip";

interface Hotspot {
  county: string;
  n: number;
  topCat: NewsCategory;
  /** 近 1 小時升溫倍數；基準為 0／缺值＝null（不除出 Infinity） */
  surge: number | null;
  /** 近 1 小時有則數、但過去 7 天同時段基準為 0（顯示「新」） */
  surgeIsNew: boolean;
  cats: Record<string, number>;
}

export interface CountySurge {
  /** Σcnt ÷ Σbaseline_avg；基準為 0／缺值或不是有限數時為 null */
  ratio: number | null;
  /** 近 1 小時有則數但基準為 0 → 「新」 */
  isNew: boolean;
}

/**
 * 近 1 小時升溫：把 `get_news_trending`（縣市×類別，近 1 小時 cnt 對過去 7 天每小時平均 baseline_avg）
 * 按縣市加總，倍數 ＝ Σcnt ÷ Σbaseline_avg。基準為 0 或 null 時倍數為 null，不除出 Infinity。
 */
export function aggregateCountySurge(rows: readonly TrendingRow[] | null | undefined): Map<string, CountySurge> {
  const sums = new Map<string, { cnt: number; base: number; baseMissing: boolean }>();
  for (const r of rows ?? []) {
    if (!r.county) continue;
    const cnt = Number(r.cnt);
    const slot = sums.get(r.county) ?? { cnt: 0, base: 0, baseMissing: false };
    if (Number.isFinite(cnt)) slot.cnt += cnt;
    const base = r.baseline_avg == null ? NaN : Number(r.baseline_avg);
    if (Number.isFinite(base)) slot.base += base;
    else slot.baseMissing = true;
    sums.set(r.county, slot);
  }
  const out = new Map<string, CountySurge>();
  for (const [county, v] of sums) {
    const ratio = !v.baseMissing && v.base > 0 && Number.isFinite(v.cnt / v.base) ? +(v.cnt / v.base).toFixed(1) : null;
    out.set(county, { ratio, isNew: ratio == null && !v.baseMissing && v.base === 0 && v.cnt > 0 });
  }
  return out;
}

const SURGE_TIP = "近 1 小時升溫：該縣市近 1 小時新聞則數 ÷ 過去 7 天每小時平均（依縣市加總各類別）；過去無基準時顯示「新」或「—」";

export function rankHotspots(
  events: ClusterEvent[],
  countyById: Map<number, string>,
  surgeByCounty: Map<string, CountySurge> = new Map(),
): Hotspot[] {
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
      surge: surgeByCounty.get(county)?.ratio ?? null,
      surgeIsNew: surgeByCounty.get(county)?.isNew ?? false,
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
  /** `get_news_trending` 的列（近 1 小時、縣市×類別）；來源 `dashboard.trending.data`。沒給時倍數顯示「—」 */
  trending?: readonly TrendingRow[];
}

export function HotspotsWidget({ events, countyByEventId, onPickHotspot, trending }: Props) {
  const surgeByCounty = useMemo(() => aggregateCountySurge(trending), [trending]);
  const ranked = useMemo(() => rankHotspots(events, countyByEventId, surgeByCounty), [events, countyByEventId, surgeByCounty]);
  const maxHot = ranked.length ? ranked[0]!.n : 1;
  const tip = useChartTooltip();
  const v2 = useMonitorV2();

  return (
    <Widget>
      {!v2 && <SectionLabel>熱區 Top 5 · HOTSPOTS</SectionLabel>}
      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {ranked.slice(0, 5).map((r, i) => {
          const cat = getNewsCategoryDef(r.topCat);
          const tipHandlers = tip.bind(() => ({
            title: r.county,
            rows: [{ dot: cat.color, label: cat.label, value: fmtChartValue(r.n, "則") }],
            note: r.surge != null ? `近 1h 升溫 ×${r.surge}` : r.surgeIsNew ? "近 1h 升溫：新（過去無基準）" : "近 1h 升溫：—（無基準）",
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
                  fontFamily: FONT_DATA, fontSize: fs(v2, FONT_SIZE.base), fontWeight: 700,
                  color: COLORS.textDim, ...(v2 ? { minWidth: 18 } : { width: 14 }),
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
                  fontFamily: FONT_CJK, fontSize: fs(v2, FONT_SIZE.md),
                  color: COLORS.textStrong, whiteSpace: "nowrap",
                }}
              >
                {r.county}
              </span>
              <span
                style={{
                  fontFamily: FONT_CJK, fontSize: fs(v2, 9.5), color: cat.color,
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
                  fontFamily: FONT_DATA, fontSize: v2 ? MF.body : FONT_SIZE.lg, fontWeight: 700,
                  color: "#fff", ...(v2 ? { minWidth: 26 } : { width: 18 }), textAlign: "right",
                }}
              >
                {r.n}
              </span>
              <span
                title={SURGE_TIP}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 2,
                  fontFamily: FONT_DATA, fontSize: v2 ? MF.body : 9.5,
                  color: r.surge != null && r.surge >= 2 ? COLORS.statusWarn : COLORS.textDim,
                  ...(v2 ? { minWidth: 42 } : { width: 40 }),
                }}
              >
                {r.surge != null && r.surge >= 2 && (
                  <IntelIcon d={MICON.flame!} size={10} color={COLORS.statusWarn} />
                )}
                {r.surge != null ? `×${r.surge}` : r.surgeIsNew ? "新" : "—"}
              </span>
            </button>
          );
        })}
        {ranked.length === 0 && (
          <div
            style={{
              fontFamily: FONT_CJK, fontSize: fs(v2, FONT_SIZE.base), color: COLORS.textFaint,
              padding: "10px 2px",
            }}
          >
            ⚠ 尚無資料
          </div>
        )}
        {v2 && ranked.length > 0 && (
          <div title={SURGE_TIP} style={{ fontFamily: FONT_CJK, fontSize: MF.label, color: COLORS.textDim }}>
            右欄為近 1h 升溫（近 1 小時則數 ÷ 過去 7 天每小時平均）
          </div>
        )}
      </div>
      {tip.node}
    </Widget>
  );
}

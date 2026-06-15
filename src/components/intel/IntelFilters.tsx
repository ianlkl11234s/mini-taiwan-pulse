import type { CSSProperties } from "react";
import { COLORS, FONT_CJK, FONT_DATA, COUNTY_OPTIONS } from "./intelTokens";
import { NEWS_CATEGORIES, type NewsCategory } from "../../data/newsEventTypes";

export type TimeRange = "1h" | "6h" | "24h";

interface Props {
  cats: NewsCategory[];
  onToggleCat: (k: NewsCategory) => void;
  onResetCats: () => void;
  timeRange: TimeRange;
  onTimeRange: (r: TimeRange) => void;
  county: string;
  onCounty: (c: string) => void;
  minRelevance: 0 | 2 | 3;
  onMinRelevance: (v: 0 | 2 | 3) => void;
  eventsOnly: boolean;
  onEventsOnly: (v: boolean) => void;
  minSeverity: 0 | 1 | 2;
  onMinSeverity: (v: 0 | 1 | 2) => void;
}

const TIME_OPTS: { k: TimeRange; label: string }[] = [
  { k: "1h", label: "1h" },
  { k: "6h", label: "6h" },
  { k: "24h", label: "24h" },
];

function chip(active: boolean): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    padding: "3px 9px",
    borderRadius: 4,
    cursor: "pointer",
    fontFamily: FONT_CJK,
    fontSize: 11,
    whiteSpace: "nowrap",
    background: active ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.03)",
    border: `1px solid ${active ? COLORS.borderStrong : COLORS.borderSoft}`,
    color: active ? "#fff" : COLORS.textMuted,
    transition: "all .12s",
  };
}

function segBtn(active: boolean): CSSProperties {
  return {
    padding: "3px 10px",
    borderRadius: 4,
    border: "none",
    cursor: "pointer",
    whiteSpace: "nowrap",
    fontFamily: FONT_CJK,
    fontSize: 10.5,
    background: active ? "rgba(255,255,255,0.12)" : "transparent",
    color: active ? "#fff" : COLORS.textDim,
    transition: "all .12s",
  };
}

export function IntelFilters({
  cats, onToggleCat, onResetCats,
  timeRange, onTimeRange,
  county, onCounty,
  minRelevance, onMinRelevance,
  eventsOnly, onEventsOnly,
}: Props) {
  return (
    <div
      style={{
        flexShrink: 0,
        padding: "10px 14px",
        borderBottom: `1px solid ${COLORS.borderSoft}`,
        display: "flex",
        flexDirection: "column",
        gap: 9,
      }}
    >
      {/* category chips */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
        <button onClick={onResetCats} style={chip(cats.length === 0)}>
          全部
        </button>
        {NEWS_CATEGORIES.map((c) => {
          const on = cats.includes(c.key);
          return (
            <button
              key={c.key}
              onClick={() => onToggleCat(c.key)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                padding: "3px 9px",
                borderRadius: 4,
                cursor: "pointer",
                fontFamily: FONT_CJK,
                fontSize: 11,
                whiteSpace: "nowrap",
                background: on ? `${c.color}26` : "rgba(255,255,255,0.03)",
                border: `1px solid ${on ? c.color : COLORS.borderSoft}`,
                color: on ? "#fff" : COLORS.textMuted,
                transition: "all .12s",
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: c.color,
                  opacity: on ? 1 : 0.5,
                }}
              />
              {c.label}
            </button>
          );
        })}
      </div>

      {/* time range + 相關度（同一橫排） */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        <span style={{ fontFamily: FONT_CJK, fontSize: 10, color: COLORS.textFaint }}>近</span>
        <div
          style={{
            display: "flex",
            background: "rgba(0,0,0,0.4)",
            border: `1px solid ${COLORS.borderSoft}`,
            borderRadius: 6,
            padding: 2,
            gap: 2,
          }}
        >
          {TIME_OPTS.map((o) => (
            <button key={o.k} onClick={() => onTimeRange(o.k)} style={segBtn(timeRange === o.k)}>
              {o.label}
            </button>
          ))}
        </div>
        <span style={{ fontFamily: FONT_CJK, fontSize: 10, color: COLORS.textFaint, marginLeft: 6 }}>
          相關度
        </span>
        <div
          style={{
            display: "flex",
            background: "rgba(0,0,0,0.4)",
            border: `1px solid ${COLORS.borderSoft}`,
            borderRadius: 6,
            padding: 2,
            gap: 2,
          }}
        >
          {(
            [
              [0, "全部"], [2, "地方+"], [3, "重大"],
            ] as const
          ).map(([v, label]) => (
            <button key={v} onClick={() => onMinRelevance(v)} style={segBtn(minRelevance === v)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* 縣市 + 只看事件（同一橫排，縣市左、只看事件右） */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <select
          value={county}
          onChange={(ev) => onCounty(ev.target.value)}
          style={{
            fontFamily: FONT_CJK,
            fontSize: 10.5,
            padding: "4px 10px",
            borderRadius: 6,
            background: "rgba(0,0,0,0.45)",
            color: county === "全部" ? COLORS.textMuted : "#fff",
            border: `1px solid ${COLORS.borderMid}`,
            cursor: "pointer",
            maxWidth: 140,
          }}
        >
          {COUNTY_OPTIONS.map((c) => (
            <option key={c} value={c} style={{ background: "#1a1c20" }}>
              {c === "全部" ? "全部縣市" : c}
            </option>
          ))}
        </select>
        <div style={{ flex: 1 }} />
        <button
          onClick={() => onEventsOnly(!eventsOnly)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            padding: "3px 9px",
            borderRadius: 5,
            cursor: "pointer",
            fontFamily: FONT_CJK,
            fontSize: 10.5,
            whiteSpace: "nowrap",
            background: eventsOnly ? COLORS.accentFaint : "rgba(255,255,255,0.03)",
            border: `1px solid ${eventsOnly ? COLORS.accentSoft : COLORS.borderSoft}`,
            color: eventsOnly ? COLORS.accent : COLORS.textMuted,
            transition: "all .12s",
          }}
        >
          <span
            style={{
              width: 12,
              height: 12,
              borderRadius: 3,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: eventsOnly ? "none" : `1px solid ${COLORS.borderStrong}`,
              background: eventsOnly ? COLORS.accent : "transparent",
              color: "#04121f",
              fontSize: 9,
              fontWeight: 700,
              fontFamily: FONT_DATA,
            }}
          >
            {eventsOnly ? "✓" : ""}
          </span>
          只看事件
        </button>
      </div>
      {/* 嚴重度 UI 暫收（Phase 1 預設 minSeverity=1，可由 sidebar 副 control 調） */}
    </div>
  );
}

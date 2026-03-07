import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, Navigation } from "lucide-react";
import type { DataRegistry } from "../hooks/useDataRegistry";

// ── Colors (reuse from sidebar) ──

const SOURCE_COLORS: Record<string, string> = {
  flights: "#64aaff",
  ships: "#1ad9e5",
  rail: "#ee6c00",
  freewayCongestion: "#ef5350",
  newsEvents: "#ff9800",
  temperatureWave: "#ff6b35",
  weatherStations: "#4dd0e1",
  bikeStations: "#ffca28",
  h3Population: "#ff6b6b",
};

const SOURCE_LABELS: Record<string, string> = {
  flights: "Flight",
  ships: "Ship",
  rail: "Rail",
  freewayCongestion: "VD",
  newsEvents: "News",
  temperatureWave: "Temp",
  weatherStations: "Weather",
  bikeStations: "Bike",
  h3Population: "Pop",
};

const DIM = "#6B7280";
const BORDER = "#2A2D32";
const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

// ── Types ──

type CalendarMode = "dots" | "heat";

interface Props {
  registry: DataRegistry;
  selectedDate: Date;
  onDateSelect: (d: Date) => void;
}

// ── Helpers ──

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function getMonthDays(year: number, month: number): Date[] {
  const days: Date[] = [];
  const d = new Date(year, month, 1);
  while (d.getMonth() === month) {
    days.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return days;
}

// ── Component ──

export function DataCalendarPanel({ registry, selectedDate, onDateSelect }: Props) {
  const [viewMonth, setViewMonth] = useState(() => new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
  const [mode, setMode] = useState<CalendarMode>("dots");
  const [filterSource, setFilterSource] = useState<string | null>(null);
  const [detailDate, setDetailDate] = useState<Date | null>(null);

  // Separate sources into cyclic vs date-ranged
  const { cyclicSources, rangedSources } = useMemo(() => {
    const cyclic: { id: string; label: string; color: string }[] = [];
    const ranged: { id: string; label: string; color: string }[] = [];
    for (const [id, meta] of registry.sources) {
      const label = SOURCE_LABELS[id] ?? id;
      const color = SOURCE_COLORS[id] ?? "#888";
      if (meta.timeType === "cyclic") {
        cyclic.push({ id, label, color });
      } else if (meta.timeType !== "static") {
        ranged.push({ id, label, color });
      }
    }
    return { cyclicSources: cyclic, rangedSources: ranged };
  }, [registry.sources]);

  // All non-static sources for legend
  const allSources = useMemo(() => [...cyclicSources, ...rangedSources], [cyclicSources, rangedSources]);

  // Month calendar data
  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const monthDays = useMemo(() => getMonthDays(year, month), [year, month]);
  const firstDayOfWeek = monthDays[0]!.getDay(); // 0=Sun

  // Precompute: for each day, which sources have data
  const daySourceMap = useMemo(() => {
    const map = new Map<number, string[]>();
    for (const day of monthDays) {
      const dateNum = day.getDate();
      const sources: string[] = [];
      for (const s of allSources) {
        if (registry.hasDataOnDate(s.id, day)) {
          sources.push(s.id);
        }
      }
      map.set(dateNum, sources);
    }
    return map;
  }, [monthDays, allSources, registry]);

  const totalSources = allSources.length;

  const shiftMonth = (delta: number) => {
    setViewMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
    setDetailDate(null);
  };

  const handleDayClick = (day: Date) => {
    setDetailDate((prev) => prev && sameDay(prev, day) ? null : day);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {/* ── DAILY section ── */}
      {cyclicSources.length > 0 && (
        <div style={{ padding: "8px 12px" }}>
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1.5, color: DIM, fontFamily: "monospace", marginBottom: 6 }}>
            DAILY
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {cyclicSources.map((s) => (
              <span
                key={s.id}
                style={{
                  fontSize: 10,
                  fontFamily: "monospace",
                  color: s.color,
                  background: "rgba(255,255,255,0.05)",
                  borderRadius: 3,
                  padding: "2px 6px",
                }}
              >
                {s.label}
              </span>
            ))}
            <span style={{ fontSize: 10, fontFamily: "monospace", color: DIM }}>always</span>
          </div>
        </div>
      )}

      {cyclicSources.length > 0 && (
        <div style={{ height: 1, background: BORDER, margin: "0 12px" }} />
      )}

      {/* ── Month header ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "8px 12px 4px" }}>
        <button onClick={() => shiftMonth(-1)} style={navBtnStyle}>
          <ChevronLeft size={14} />
        </button>
        <span style={{ flex: 1, textAlign: "center", fontSize: 12, fontWeight: 600, color: "#fff", fontFamily: "Inter, system-ui, sans-serif" }}>
          {year}年{month + 1}月
        </span>
        <button onClick={() => shiftMonth(1)} style={navBtnStyle}>
          <ChevronRight size={14} />
        </button>

        {/* Mode toggle */}
        <div style={{ display: "flex", gap: 2, marginLeft: 4 }}>
          {(["dots", "heat"] as CalendarMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              style={{
                fontSize: 9,
                fontFamily: "monospace",
                padding: "2px 6px",
                borderRadius: 3,
                border: mode === m ? "1px solid rgba(255,255,255,0.3)" : "1px solid transparent",
                background: mode === m ? "rgba(255,255,255,0.1)" : "transparent",
                color: mode === m ? "#fff" : DIM,
                cursor: "pointer",
              }}
            >
              {m === "dots" ? "Dots" : "Heat"}
            </button>
          ))}
        </div>
      </div>

      {/* ── Calendar grid ── */}
      <div style={{ padding: "0 12px 4px" }}>
        {/* Weekday header */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 1 }}>
          {WEEKDAYS.map((wd) => (
            <div
              key={wd}
              style={{
                textAlign: "center",
                fontSize: 9,
                color: DIM,
                fontFamily: "monospace",
                padding: "2px 0",
              }}
            >
              {wd}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 1 }}>
          {/* Empty cells for first week offset */}
          {Array.from({ length: firstDayOfWeek }).map((_, i) => (
            <div key={`empty-${i}`} />
          ))}

          {monthDays.map((day) => {
            const dateNum = day.getDate();
            const sourcesOnDay = daySourceMap.get(dateNum) ?? [];
            const filtered = filterSource
              ? sourcesOnDay.filter((s) => s === filterSource)
              : sourcesOnDay;
            const isSelected = sameDay(day, selectedDate);
            const isDetail = detailDate && sameDay(day, detailDate);
            const hasDimFilter = filterSource !== null && filtered.length === 0;
            const coverage = totalSources > 0 ? sourcesOnDay.length / totalSources : 0;

            return (
              <button
                key={dateNum}
                onClick={() => handleDayClick(day)}
                style={{
                  padding: "3px 1px 2px",
                  minHeight: mode === "dots" ? 36 : 30,
                  border: isDetail
                    ? "1px solid rgba(255,255,255,0.5)"
                    : isSelected
                      ? "1px solid rgba(255,255,255,0.3)"
                      : "1px solid transparent",
                  borderRadius: 4,
                  background: mode === "heat"
                    ? `rgba(100, 200, 255, ${coverage * 0.35})`
                    : (isSelected ? "rgba(255,255,255,0.08)" : "transparent"),
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 1,
                  opacity: hasDimFilter ? 0.2 : 1,
                  transition: "opacity 0.15s, background 0.15s",
                }}
              >
                {/* Day number */}
                <span style={{
                  fontSize: 10,
                  fontFamily: "monospace",
                  color: isSelected ? "#fff" : (sourcesOnDay.length > 0 ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.25)"),
                  fontWeight: isSelected ? 700 : 400,
                  lineHeight: 1,
                }}>
                  {dateNum}
                </span>

                {/* Dots mode */}
                {mode === "dots" && filtered.length > 0 && (
                  <div style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 1,
                    justifyContent: "center",
                    maxWidth: 26,
                  }}>
                    {filtered.map((srcId) => (
                      <div
                        key={srcId}
                        style={{
                          width: 4,
                          height: 4,
                          borderRadius: "50%",
                          background: SOURCE_COLORS[srcId] ?? "#888",
                          flexShrink: 0,
                        }}
                      />
                    ))}
                  </div>
                )}

                {/* Heat mode: coverage % */}
                {mode === "heat" && sourcesOnDay.length > 0 && (
                  <span style={{
                    fontSize: 7,
                    fontFamily: "monospace",
                    color: "rgba(255,255,255,0.5)",
                    lineHeight: 1,
                  }}>
                    {Math.round(coverage * 100)}%
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Day detail ── */}
      {detailDate && (
        <div style={{ padding: "4px 12px 8px" }}>
          <div style={{ height: 1, background: BORDER, marginBottom: 6 }} />
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: "#fff", fontFamily: "Inter, system-ui, sans-serif" }}>
              {detailDate.getMonth() + 1}/{detailDate.getDate()} ({WEEKDAYS[detailDate.getDay()]})
            </span>
            <span style={{ fontSize: 10, color: DIM, fontFamily: "monospace" }}>
              {(() => {
                const sources = daySourceMap.get(detailDate.getDate()) ?? [];
                return totalSources > 0
                  ? `${Math.round((sources.length / totalSources) * 100)}% coverage`
                  : "";
              })()}
            </span>
            <div style={{ flex: 1 }} />
            <button
              onClick={() => {
                onDateSelect(detailDate);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 3,
                fontSize: 10,
                fontFamily: "monospace",
                color: "#64aaff",
                background: "rgba(100,170,255,0.1)",
                border: "1px solid rgba(100,170,255,0.3)",
                borderRadius: 4,
                padding: "2px 8px",
                cursor: "pointer",
              }}
            >
              Go <Navigation size={10} />
            </button>
          </div>

          {/* Sources with data */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {allSources.map((s) => {
              const hasData = registry.hasDataOnDate(s.id, detailDate);
              return (
                <span
                  key={s.id}
                  style={{
                    fontSize: 10,
                    fontFamily: "monospace",
                    padding: "1px 6px",
                    borderRadius: 3,
                    background: hasData ? "rgba(255,255,255,0.06)" : "transparent",
                    color: hasData ? s.color : "rgba(255,255,255,0.2)",
                    border: hasData ? `1px solid ${s.color}33` : "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  {hasData ? "●" : "○"} {s.label}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Legend (click to filter) ── */}
      <div style={{ height: 1, background: BORDER, margin: "0 12px" }} />
      <div style={{ padding: "6px 12px 8px" }}>
        <div style={{ fontSize: 9, color: DIM, fontFamily: "monospace", marginBottom: 4, letterSpacing: 1 }}>
          FILTER (click to highlight)
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
          {rangedSources.map((s) => {
            const isActive = filterSource === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setFilterSource(isActive ? null : s.id)}
                style={{
                  fontSize: 10,
                  fontFamily: "monospace",
                  padding: "2px 6px",
                  borderRadius: 3,
                  border: isActive ? `1px solid ${s.color}` : "1px solid rgba(255,255,255,0.1)",
                  background: isActive ? `${s.color}22` : "transparent",
                  color: isActive ? s.color : "rgba(255,255,255,0.5)",
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                <span style={{
                  display: "inline-block",
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: s.color,
                  marginRight: 3,
                  verticalAlign: "middle",
                }} />
                {s.label}
              </button>
            );
          })}
          {filterSource && (
            <button
              onClick={() => setFilterSource(null)}
              style={{
                fontSize: 9,
                fontFamily: "monospace",
                padding: "2px 6px",
                borderRadius: 3,
                border: "1px solid rgba(255,255,255,0.15)",
                background: "rgba(255,255,255,0.05)",
                color: DIM,
                cursor: "pointer",
              }}
            >
              Clear
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Styles ──

const navBtnStyle: React.CSSProperties = {
  width: 24,
  height: 24,
  borderRadius: 4,
  border: "none",
  background: "transparent",
  color: "#9CA3AF",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  padding: 0,
};

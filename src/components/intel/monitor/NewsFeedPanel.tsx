import { IntelIcon, ICON } from "../IntelIcon";
import { COLORS, FONT_CJK, FONT_DATA } from "../intelTokens";
import { RADIUS, FONT_SIZE } from "../../../styles/designTokens";
import { IntelCard, type IntelCardEvent } from "../IntelCard";
import { IntelFilters, type TimeRange } from "../IntelFilters";
import type { NewsFilter } from "../../../data/newsEventsLoader";
import type { NewsCategory } from "../../../data/newsEventTypes";

interface Props {
  /** 已套完 timeRange / 分類 / 縣市 篩選的事件（原 MonitorPanel flatEvents） */
  events: IntelCardEvent[];
  cats: NewsCategory[];
  onToggleCat: (k: NewsCategory) => void;
  onResetCats: () => void;
  timeRange: TimeRange;
  onTimeRange: (r: TimeRange) => void;
  county: string;
  onCounty: (c: string) => void;
  filter: NewsFilter;
  onFilterChange: (next: NewsFilter) => void;
  selectedId: number | null;
  expandedId: number | null;
  onSelectCard: (id: number) => void;
  onToggleExpand: (id: number) => void;
  isTrendingFor: (e: IntelCardEvent) => boolean;
  nowTs: number;
}

export function NewsFeedPanel({
  events, cats, onToggleCat, onResetCats,
  timeRange, onTimeRange, county, onCounty,
  filter, onFilterChange,
  selectedId, expandedId, onSelectCard, onToggleExpand,
  isTrendingFor, nowTs,
}: Props) {
  return (
    <div
      style={{
        height: "100%", minHeight: 0,
        display: "flex", flexDirection: "column", overflow: "hidden",
        borderRadius: RADIUS.xl, border: `1px solid ${COLORS.panelBorder}`,
        background: "rgba(255,255,255,0.022)",
      }}
    >
      <div
        style={{
          flexShrink: 0,
          display: "flex", alignItems: "center", gap: 8,
          padding: "11px 14px 9px",
        }}
      >
        <IntelIcon d={ICON.radio} size={15} color={COLORS.accent} />
        <span
          style={{
            fontFamily: FONT_CJK, fontSize: 12.5, fontWeight: 700,
            color: COLORS.textStrong, whiteSpace: "nowrap",
          }}
        >
          新聞 Feed
        </span>
        <span
          style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            padding: "1px 7px", borderRadius: RADIUS.md,
            background: COLORS.statusLiveSoft,
            border: `1px solid ${COLORS.statusLiveBorder}`,
          }}
        >
          <span
            style={{
              width: 5, height: 5, borderRadius: RADIUS.full,
              background: COLORS.statusLive,
              boxShadow: `0 0 5px ${COLORS.statusLive}`,
              animation: "intelRing 1.6s ease-in-out infinite",
            }}
          />
          <span
            style={{
              fontFamily: FONT_DATA, fontSize: FONT_SIZE.xs, fontWeight: 700,
              color: COLORS.statusLive,
            }}
          >
            LIVE
          </span>
        </span>
        <div style={{ flex: 1 }} />
        <span style={{ fontFamily: FONT_DATA, fontSize: 10.5, color: COLORS.textMuted }}>
          {events.length} 則
        </span>
      </div>

      <IntelFilters
        cats={cats}
        onToggleCat={onToggleCat}
        onResetCats={onResetCats}
        timeRange={timeRange}
        onTimeRange={onTimeRange}
        county={county}
        onCounty={onCounty}
        minRelevance={filter.minRelevance}
        onMinRelevance={(v) => onFilterChange({ ...filter, minRelevance: v })}
        eventsOnly={filter.eventsOnly}
        onEventsOnly={(v) => onFilterChange({ ...filter, eventsOnly: v })}
        minSeverity={filter.minSeverity}
        onMinSeverity={(v) => onFilterChange({ ...filter, minSeverity: v })}
      />

      <div
        className="mtp-scroll"
        style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "12px 14px 16px" }}
      >
        {events.length === 0 ? (
          <div
            style={{
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              height: "100%", gap: 8, textAlign: "center", padding: 24,
            }}
          >
            <IntelIcon d={ICON.radio} size={26} color={COLORS.textGhost} />
            <div style={{ fontFamily: FONT_CJK, fontSize: FONT_SIZE.md, color: COLORS.textMuted }}>
              目前無符合條件的事件
            </div>
            <div style={{ fontFamily: FONT_CJK, fontSize: FONT_SIZE.sm, color: COLORS.textFaint }}>
              調整分類 / 縣市，或回到即時
            </div>
          </div>
        ) : (
          <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 10 }}>
            <span
              style={{
                position: "absolute", left: 12, top: 6, bottom: 6,
                width: 1.5,
                background: `linear-gradient(${COLORS.borderMid}, ${COLORS.borderSoft} 90%, transparent)`,
              }}
            />
            {events.map((e) => (
              <IntelCard
                key={e.id}
                e={e}
                selected={e.id === selectedId}
                expanded={e.id === expandedId}
                trending={isTrendingFor(e)}
                // 監看模式只有國內新聞（數字 id）；IntelCard 的 id 型別為了國際事件放寬成 number | string
                onSelect={(id) => { if (typeof id === "number") onSelectCard(id); }}
                onToggle={(id) => { if (typeof id === "number") onToggleExpand(id); }}
                nowTs={nowTs}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

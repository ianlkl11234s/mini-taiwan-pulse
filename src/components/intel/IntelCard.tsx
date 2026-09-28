import type { CSSProperties } from "react";
import { IntelIcon, ICON } from "./IntelIcon";
import {
  COLORS, FONT_CJK, FONT_DATA, GIS_LEVELS, SEV_LEVELS,
  relTime, clockTime, chipTint, chipOutline, splitRelTimeParts, withAlpha,
} from "./intelTokens";
import { chipText, levelColor, neutralFill, useIntelTheme, type IntelPalette } from "./intelTheme";
import { RADIUS, FONT_SIZE, SURFACE, LIGHT } from "../../styles/designTokens";
import { getNewsCategoryDef } from "../../data/newsEventTypes";
import type { ClusterEvent } from "../../data/newsEventsLoader";
import { useWallClock } from "../../hooks/useWallClock";

export interface IntelCardEvent extends ClusterEvent {
  /** 所屬 cluster 的 county / location_name，給卡片顯示 */
  county?: string;
  location_name?: string;
  /** 同 cluster 內其他更早的事件數量（給「N 則相關」） */
  related_count?: number;
  /** 同一篇被多家報的 source 列（暫不用，留欄位） */
  extra_sources?: string[];
  /**
   * 選取／展開用的識別碼。國內新聞的 `id` 是 RPC 的數字主鍵；國際事件的
   * event_id 是 UUID 字串，無法塞進 `id`，故另開此欄。有值就以它為準。
   */
  card_key?: string;
  /** 來源範圍。`"global"` 會多一顆「國際」chip，與國內新聞區分 */
  scope?: "global";
  /** 研判來源標籤 chip（國際事件用「AI 初判」／「已研究」） */
  origin_label?: string;
}

/** 卡片的選取鍵：國際事件用 card_key（UUID），國內新聞維持數字 id */
export function intelCardId(e: IntelCardEvent): number | string {
  return e.card_key ?? e.id;
}

interface Props {
  e: IntelCardEvent;
  selected: boolean;
  expanded: boolean;
  trending: boolean;
  onSelect: (id: number | string) => void;
  onToggle: (id: number | string) => void;
  /** 用於相對時間計算 */
  nowTs: number;
}

/** 中性 chip 版型（「聲明」／國際事件的研判來源標籤共用；色彩交給 chipOutline(palette.textDim)） */
const chipGhost: CSSProperties = {
  fontFamily: FONT_CJK,
  fontSize: 9.5,
  whiteSpace: "nowrap",
  padding: "1px 6px",
  borderRadius: RADIUS.md,
};

function btnGhost(palette: IntelPalette): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 5,
    padding: "5px 10px",
    borderRadius: RADIUS.md,
    whiteSpace: "nowrap",
    background: neutralFill(0.04, palette.isDark),
    border: `1px solid ${palette.borderMid}`,
    color: palette.textMuted,
    fontFamily: FONT_CJK,
    fontSize: 10.5,
    cursor: "pointer",
  };
}

export function IntelCard({ e, selected, expanded, trending, onSelect, onToggle, nowTs }: Props) {
  const palette = useIntelTheme();
  // 30s 內相對時間（「3 分鐘前」）視覺無差，元件內訂閱避開父層 1Hz cascade。
  // nowTs prop 退為「mount 時 fallback / SSR」之用。
  const liveNow = Math.floor(useWallClock(30_000, nowTs * 1000) / 1000);
  const cat = getNewsCategoryDef(e.category ?? "other");
  const gisLevel = GIS_LEVELS[e.gis_relevance ?? 0] ?? GIS_LEVELS[0];
  const sevLevel = SEV_LEVELS[e.severity ?? 0] ?? SEV_LEVELS[0];
  const conf = e.confidence == null ? null : Math.round(e.confidence * 100);
  const clusterColor = chipText(COLORS.cluster, palette);
  // spine dot 的「面板色外圈」：暗＝SURFACE.app（原字面值不變），淡＝LIGHT.surfaceSolid（不透明白）。
  const spineHalo = palette.isDark ? SURFACE.app : LIGHT.surfaceSolid;

  const handleClick = () => {
    const id = intelCardId(e);
    onSelect(id);
    onToggle(id);
  };
  const stop =
    (fn?: () => void): React.MouseEventHandler =>
    (ev) => {
      ev.stopPropagation();
      fn?.();
    };

  return (
    <div style={{ position: "relative", paddingLeft: 26 }}>
      {/* spine dot — 7px ＋ 2px 面板色外圈（與時間軸直線同語彙） */}
      <span
        style={{
          position: "absolute",
          left: 9,
          top: 16,
          width: 7,
          height: 7,
          borderRadius: RADIUS.full,
          background: cat.color,
          zIndex: 1,
          boxShadow: selected
            ? `0 0 0 2px ${spineHalo}, 0 0 0 5px ${cat.color}55`
            : `0 0 0 2px ${spineHalo}`,
        }}
      />
      <div
        onClick={handleClick}
        style={{
          cursor: "pointer",
          borderRadius: RADIUS.xl,
          padding: "11px 13px",
          background: selected ? withAlpha(palette.accent, 0.08) : neutralFill(0.022, palette.isDark),
          border: `1px solid ${selected ? palette.borderAccent : palette.borderSoft}`,
          transition: "background .15s, border-color .15s",
        }}
      >
        {/* chip row */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 5 }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "1px 7px",
              whiteSpace: "nowrap",
              borderRadius: RADIUS.md,
              ...chipTint(cat.color, chipText(cat.color, palette)),
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: RADIUS.full, background: cat.color }} />
            <span style={{ fontFamily: FONT_CJK, fontSize: FONT_SIZE.sm, fontWeight: 600 }}>
              {cat.label}
            </span>
          </span>
          {e.scope === "global" && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 3,
                fontFamily: FONT_CJK,
                fontSize: 9.5,
                whiteSpace: "nowrap",
                padding: "1px 6px",
                borderRadius: RADIUS.md,
                ...chipOutline(COLORS.cluster, clusterColor),
              }}
            >
              國際
            </span>
          )}
          {trending && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 3,
                fontFamily: FONT_CJK,
                fontSize: 9.5,
                whiteSpace: "nowrap",
                padding: "1px 6px",
                borderRadius: RADIUS.md,
                ...chipOutline(COLORS.surge, chipText(COLORS.surge, palette)),
              }}
            >
              🔥 升溫
            </span>
          )}
          {e.gis_relevance === 3 && (
            <span
              style={{
                fontFamily: FONT_CJK,
                fontSize: 9.5,
                whiteSpace: "nowrap",
                padding: "1px 6px",
                borderRadius: RADIUS.md,
                ...chipOutline(palette.statusWarn),
              }}
            >
              重大
            </span>
          )}
          {e.is_event === false && <span style={{ ...chipGhost, ...chipOutline(palette.textDim) }}>聲明</span>}
          {e.origin_label && <span style={{ ...chipGhost, ...chipOutline(palette.textDim) }}>{e.origin_label}</span>}
          <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
            <span
              style={{
                fontFamily: FONT_CJK,
                fontSize: 10.5,
                color: palette.textMuted,
                whiteSpace: "nowrap",
              }}
            >
              {splitRelTimeParts(relTime(e.published_ts, liveNow)).map((p, i) =>
                p.mono ? <span key={i} style={{ fontFamily: FONT_DATA }}>{p.text}</span> : <span key={i}>{p.text}</span>,
              )}
            </span>
          </span>
        </div>

        {/* title */}
        <div
          style={{
            fontFamily: FONT_CJK,
            fontSize: 12.5,
            fontWeight: 600,
            color: palette.textStrong,
            lineHeight: 1.45,
            marginBottom: 4,
            textWrap: "pretty" as const,
          }}
        >
          {e.title}
        </div>

        {/* location + clock — 地名 CJK，時鐘 mono */}
        {e.location_name && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginBottom: 5,
              whiteSpace: "nowrap",
              fontFamily: FONT_CJK,
              fontSize: FONT_SIZE.sm,
              color: palette.textDim,
            }}
          >
            <span
              style={{
                color: palette.textMuted,
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              ◎ {e.location_name}
            </span>
            <span>·</span>
            <span style={{ fontFamily: FONT_DATA }}>{clockTime(e.published_ts)}</span>
          </div>
        )}

        {/* summary clamped when collapsed */}
        {e.summary && (
          <div
            style={{
              fontFamily: FONT_CJK,
              fontSize: FONT_SIZE.base,
              color: palette.textDefault,
              lineHeight: 1.55,
              display: expanded ? "block" : "-webkit-box",
              WebkitLineClamp: expanded ? "unset" : 2,
              WebkitBoxOrient: "vertical" as const,
              overflow: "hidden",
              textWrap: "pretty" as const,
            }}
          >
            {e.summary}
          </div>
        )}

        {/* source / cluster / conf row */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6, flexWrap: "wrap" }}>
          {e.source && (
            <span
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                fontFamily: FONT_DATA,
                fontSize: 9.5,
                color: palette.textDim,
              }}
            >
              {e.source}
            </span>
          )}
          {(e.related_count ?? 0) > 0 && (
            <span
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                fontFamily: FONT_CJK,
                fontSize: 9.5,
                color: clusterColor,
              }}
            >
              <IntelIcon d={ICON.cluster} size={11} color={clusterColor} /> {e.related_count} 則相關
            </span>
          )}
          {conf != null && (
            <span
              style={{
                marginLeft: "auto",
                fontFamily: FONT_DATA,
                fontSize: FONT_SIZE.xs,
                color: palette.textFaint,
              }}
            >
              conf {conf}%
            </span>
          )}
        </div>

        {/* expanded detail */}
        {expanded && (
          <div
            style={{
              marginTop: 10,
              paddingTop: 10,
              borderTop: `1px solid ${palette.borderSoft}`,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            {/* meta grid — 標籤與敘述用 CJK，數字級距另包 FONT_DATA */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "auto 1fr",
                gap: "3px 10px",
                fontFamily: FONT_CJK,
                fontSize: FONT_SIZE.sm,
              }}
            >
              {e.county && (
                <>
                  <span style={{ color: palette.textFaint }}>地點</span>
                  <span style={{ color: palette.textDefault }}>
                    {e.county}
                    {e.location_name ? ` · ${e.location_name}` : ""}
                  </span>
                </>
              )}
              {e.confidence != null && (
                <>
                  <span style={{ color: palette.textFaint }}>信心度</span>
                  <span style={{ color: palette.textDefault, fontFamily: FONT_DATA }}>
                    {Math.round(e.confidence * 100)}%
                  </span>
                </>
              )}
              {e.gis_relevance != null && gisLevel && (
                <>
                  <span style={{ color: palette.textFaint }}>地理相關</span>
                  <span style={{ color: levelColor(gisLevel.color, palette) }}>
                    <span style={{ fontFamily: FONT_DATA }}>lv{e.gis_relevance}</span> · {gisLevel.label}
                  </span>
                </>
              )}
              {e.severity != null && sevLevel && (
                <>
                  <span style={{ color: palette.textFaint }}>嚴重程度</span>
                  <span style={{ color: levelColor(sevLevel.color, palette) }}>
                    <span style={{ fontFamily: FONT_DATA }}>lv{e.severity}</span> · {sevLevel.label}
                  </span>
                </>
              )}
              <span style={{ color: palette.textFaint }}>事件性質</span>
              <span style={{ color: palette.textDefault }}>
                {e.is_event === false ? "聲明 statement" : "事件 event"}
              </span>
            </div>

            {/* actions */}
            <div style={{ display: "flex", gap: 6, marginTop: 2 }}>
              {e.url && (
                <a
                  href={e.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(ev) => ev.stopPropagation()}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    padding: "5px 10px",
                    borderRadius: RADIUS.md,
                    whiteSpace: "nowrap",
                    ...chipTint(cat.color, chipText(cat.color, palette)),
                    fontFamily: FONT_CJK,
                    fontSize: 10.5,
                    fontWeight: 600,
                    textDecoration: "none",
                  }}
                >
                  <IntelIcon d={ICON.ext} size={12} color={cat.color} /> 原文連結
                </a>
              )}
              {e.url && (
                <button
                  onClick={stop(() => {
                    if (navigator.clipboard) {
                      navigator.clipboard.writeText(`${e.title}\n${e.url}`);
                    }
                  })}
                  style={btnGhost(palette)}
                >
                  <IntelIcon d={ICON.copy} size={12} /> 複製
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

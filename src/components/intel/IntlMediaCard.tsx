import type { CSSProperties } from "react";
import { IntelIcon, ICON } from "./IntelIcon";
import { COLORS, FONT_CJK, FONT_DATA, relTime } from "./intelTokens";
import { RADIUS, FONT_SIZE } from "../../styles/designTokens";
import { useWallClock } from "../../hooks/useWallClock";
import type { IntlMediaTaiwanItem } from "../../data/intlMediaTaiwanLoader";

const MEDIA_COLOR = "#67d4c1";

function sourceLocationText(item: IntlMediaTaiwanItem): string | null {
  const location = item.sourceLocation;
  if (!location) return item.sourceCountry;
  return location.label ?? location.city ?? location.country ?? item.sourceCountry;
}

function sourceLocationProvenance(item: IntlMediaTaiwanItem): string | null {
  const location = item.sourceLocation;
  if (!location) return null;
  if (location.method === "outlet_registry") {
    return location.confidence === "fallback" ? "媒體資料推定" : "媒體登錄資料";
  }
  if (location.method === "government_capital") return "中央政府首都推定";
  if (location.method === "country_registry") {
    return location.confidence === "fallback" ? "國家代表點推定" : "國家登錄資料";
  }
  return location.confidence === "fallback" ? "來源資料推定" : null;
}

function mentionedLocationLabels(item: IntlMediaTaiwanItem): string[] {
  const labels: string[] = [];
  const seen = new Set<string>();
  for (const location of item.mentionedLocations) {
    const label = location.name ?? location.countryCode ?? location.adm1Code;
    if (!label || seen.has(label)) continue;
    seen.add(label);
    labels.push(label);
    if (labels.length >= 8) break;
  }
  return labels;
}

const actionStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  padding: "5px 10px",
  borderRadius: RADIUS.md,
  background: `${MEDIA_COLOR}18`,
  border: `1px solid ${MEDIA_COLOR}55`,
  color: MEDIA_COLOR,
  fontFamily: FONT_CJK,
  fontSize: 10.5,
  fontWeight: 600,
  textDecoration: "none",
};

interface Props {
  item: IntlMediaTaiwanItem;
  expanded: boolean;
  onToggle: (id: string) => void;
  nowTs: number;
}

export function IntlMediaCard({ item, expanded, onToggle, nowTs }: Props) {
  const liveNow = Math.floor(useWallClock(30_000, nowTs * 1000) / 1000);
  const visibleTopics = expanded ? item.topics : item.topics.slice(0, 3);
  const sourceLocation = sourceLocationText(item);
  const sourceProvenance = sourceLocationProvenance(item);
  const mentionedLocations = mentionedLocationLabels(item);

  return (
    <div style={{ position: "relative", paddingLeft: 26 }}>
      <span
        aria-hidden="true"
        style={{
          position: "absolute", left: 7, top: 14,
          width: 11, height: 11, borderRadius: RADIUS.full,
          background: MEDIA_COLOR, border: "2px solid #0a0a14", zIndex: 1,
          boxShadow: expanded ? `0 0 0 3px ${MEDIA_COLOR}44` : "none",
        }}
      />
      <article
        onClick={() => onToggle(item.id)}
        style={{
          cursor: "pointer",
          borderRadius: RADIUS.xl,
          padding: "11px 13px",
          background: expanded ? `${MEDIA_COLOR}0d` : "rgba(255,255,255,0.022)",
          border: `1px solid ${expanded ? `${MEDIA_COLOR}77` : COLORS.borderSoft}`,
          transition: "background .15s, border-color .15s",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
          <span
            style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              padding: "1px 7px", borderRadius: RADIUS.md,
              background: `${MEDIA_COLOR}1f`, border: `1px solid ${MEDIA_COLOR}55`,
              color: MEDIA_COLOR, fontFamily: FONT_CJK, fontSize: FONT_SIZE.sm, fontWeight: 600,
            }}
          >
            國際媒體
          </span>
          {item.importance != null && (
            <span
              title="由 LLM 推估的內容重要度，不是官方警報等級"
              style={{
                padding: "1px 7px", borderRadius: RADIUS.md,
                background: "rgba(255,255,255,0.04)", border: `1px solid ${COLORS.borderMid}`,
                color: COLORS.textMuted, fontFamily: FONT_DATA, fontSize: 9.5,
              }}
            >
              AI 推估 · importance {item.importance}/3
            </span>
          )}
          <span
            style={{
              marginLeft: "auto", whiteSpace: "nowrap",
              color: COLORS.textMuted, fontFamily: FONT_DATA, fontSize: 10.5,
            }}
          >
            GDELT 收錄 · {relTime(item.gdeltRecordedTs, liveNow)}
          </span>
        </div>

        <h3
          style={{
            margin: 0,
            fontFamily: FONT_CJK, fontSize: 12.5, fontWeight: 600,
            color: COLORS.textStrong, lineHeight: 1.45,
            textWrap: "pretty",
          }}
        >
          {item.titleOriginal}
        </h3>

        <div
          style={{
            display: "flex", alignItems: "center", gap: 6, marginTop: 5,
            color: COLORS.textDim, fontFamily: FONT_DATA, fontSize: 9.5,
          }}
        >
          <span style={{ color: COLORS.textMuted }}>{item.sourceName}</span>
          {item.sourceDomain && item.sourceDomain !== item.sourceName && (
            <>
              <span>·</span>
              <span>{item.sourceDomain}</span>
            </>
          )}
          {item.sourceCountry && (
            <>
              <span>·</span>
              <span>{item.sourceCountry}</span>
            </>
          )}
          {item.taiwanRelevance != null && (
            <span style={{ marginLeft: "auto", color: COLORS.textFaint }}>
              涉台 {item.taiwanRelevance}/3
            </span>
          )}
        </div>

        {visibleTopics.length > 0 && (
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 7 }}>
            {visibleTopics.map((topic) => (
              <span
                key={topic}
                style={{
                  padding: "1px 6px", borderRadius: RADIUS.md,
                  background: "rgba(255,255,255,0.035)", border: `1px solid ${COLORS.borderSoft}`,
                  color: COLORS.textMuted, fontFamily: FONT_CJK, fontSize: 9.5,
                }}
              >
                #{topic}
              </span>
            ))}
            {!expanded && item.topics.length > visibleTopics.length && (
              <span style={{ color: COLORS.textFaint, fontFamily: FONT_DATA, fontSize: 9.5 }}>
                +{item.topics.length - visibleTopics.length}
              </span>
            )}
          </div>
        )}

        {expanded && (
          <div
            style={{
              marginTop: 10, paddingTop: 10,
              borderTop: `1px solid ${COLORS.borderSoft}`,
              display: "flex", flexDirection: "column", gap: 9,
              animation: "drawerOpen .25s ease-out",
            }}
          >
            {item.summaryZh && (
              <div>
                <div
                  style={{
                    marginBottom: 3, color: COLORS.textFaint,
                    fontFamily: FONT_DATA, fontSize: FONT_SIZE.xs, letterSpacing: "1px",
                  }}
                >
                  AI 中文摘要
                </div>
                <div
                  style={{
                    color: COLORS.textDefault, fontFamily: FONT_CJK,
                    fontSize: 11.5, lineHeight: 1.55,
                  }}
                >
                  {item.summaryZh}
                </div>
              </div>
            )}
            <div
              style={{
                display: "grid", gridTemplateColumns: "auto 1fr", gap: "3px 10px",
                color: COLORS.textMuted, fontFamily: FONT_DATA, fontSize: FONT_SIZE.sm,
              }}
            >
              <span style={{ color: COLORS.textFaint }}>時間語意</span>
              <span>GDELT GKG 收錄時間</span>
              {sourceLocation && (
                <>
                  <span style={{ color: COLORS.textFaint }}>
                    {item.sourceLocation?.level === "country" ? "媒體來源國家" : "媒體來源所在地"}
                  </span>
                  <span>
                    {sourceLocation}
                    {sourceProvenance ? `（${sourceProvenance}）` : ""}
                  </span>
                </>
              )}
              {mentionedLocations.length > 0 && (
                <>
                  <span style={{ color: COLORS.textFaint }}>報導提及地點</span>
                  <span>{mentionedLocations.join("、")}</span>
                </>
              )}
              {item.sourceStream && (
                <>
                  <span style={{ color: COLORS.textFaint }}>資料流</span>
                  <span>{item.sourceStream}</span>
                </>
              )}
              {item.llmModel && (
                <>
                  <span style={{ color: COLORS.textFaint }}>標註模型</span>
                  <span>{item.llmModel}</span>
                </>
              )}
            </div>
            {item.url && (
              <div>
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(event) => event.stopPropagation()}
                  style={actionStyle}
                >
                  <IntelIcon d={ICON.ext} size={12} color={MEDIA_COLOR} /> 原文連結
                </a>
              </div>
            )}
          </div>
        )}
      </article>
    </div>
  );
}

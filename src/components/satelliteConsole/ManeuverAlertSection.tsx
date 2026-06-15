/**
 * §A 變軌警報區
 *
 * 紅色 banner（近 24h CN/TW 變軌計數）+ 橫向卡片清單。
 * PLANE_CHANGE 強閃為敘事重點。
 *
 * 卡片資料全部來自 satellite_maneuvers MV（migration 169 RPC）。
 */
import { useMemo } from "react";
import { COLORS, FONT_CJK, FONT_DATA, MANEUVER_TOKEN, CN_GROUP_TO_CATEGORY } from "./satelliteConsoleTokens";
import { SATELLITE_COLORS } from "../../data/satelliteTypes";
import type { ManeuverRow } from "../../data/satelliteManeuversLoader";
import { formatManeuverDetail, formatRelTime } from "../../data/satelliteManeuversLoader";

interface Props {
  maneuvers: ManeuverRow[];
  onSelectNorad: (n: number) => void;
  onOpenCompare: (m: ManeuverRow) => void;
  onFlyTo?: (lon: number, lat: number) => void;
}

const TAIWAN_GROUP = new Set(["TAIWAN"]);

export function ManeuverAlertSection({ maneuvers, onSelectNorad, onOpenCompare }: Props) {
  const { cnCount, twCount, sorted } = useMemo(() => {
    let cn = 0, tw = 0;
    for (const m of maneuvers) {
      if (TAIWAN_GROUP.has(m.cn_group) || m.country_operator === "Taiwan") tw++;
      else cn++;
    }
    // 排序：PLANE_CHANGE 最前 → 再依時間遞減
    const order: Record<string, number> = { PLANE_CHANGE: 0, ALTITUDE_CHANGE: 1, SHAPE_CHANGE: 2 };
    const sorted = [...maneuvers].sort((a, b) => {
      const da = order[a.maneuver_type] ?? 9;
      const db = order[b.maneuver_type] ?? 9;
      if (da !== db) return da - db;
      return new Date(b.curr_fetched_at).getTime() - new Date(a.curr_fetched_at).getTime();
    });
    return { cnCount: cn, twCount: tw, sorted };
  }, [maneuvers]);

  if (maneuvers.length === 0) {
    return (
      <div style={{ padding: "12px 14px", borderBottom: `1px solid ${COLORS.borderSoft}` }}>
        <div style={{
          padding: "8px 10px",
          borderRadius: 6,
          background: COLORS.statusLiveSoft,
          border: `1px solid ${COLORS.statusLiveBorder}`,
          fontFamily: FONT_CJK,
          fontSize: 11.5,
          color: COLORS.textDefault,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: COLORS.statusLive }} />
          近 24h 無變軌偵測 · 監測中
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "12px 14px", borderBottom: `1px solid ${COLORS.borderSoft}` }}>
      {/* Banner */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 10px",
        marginBottom: 9,
        borderRadius: 6,
        background: "rgba(239,68,68,0.12)",
        border: "1px solid rgba(239,68,68,0.45)",
        fontFamily: FONT_CJK,
        fontSize: 11.5,
        color: COLORS.textStrong,
      }}>
        <span style={{
          width: 7, height: 7, borderRadius: "50%",
          background: COLORS.statusErr,
          boxShadow: `0 0 6px ${COLORS.statusErr}`,
          animation: "satManeuverPulse 1.1s ease-in-out infinite",
        }} />
        <span style={{ fontWeight: 600 }}>近 24h 變軌偵測</span>
        <span style={{ marginLeft: "auto", fontFamily: FONT_DATA, color: COLORS.textDefault, letterSpacing: "0.3px" }}>
          CN <span style={{ color: COLORS.statusErr, fontWeight: 700 }}>{cnCount}</span> 顆
          {" / "}
          TW <span style={{ color: twCount > 0 ? COLORS.statusErr : COLORS.textDim, fontWeight: 700 }}>{twCount}</span> 顆
        </span>
      </div>

      {/* 橫向 cards */}
      <div className="mtp-chips" style={{
        display: "flex",
        gap: 8,
        overflowX: "auto",
        paddingBottom: 4,
        scrollSnapType: "x mandatory",
      }}>
        {sorted.slice(0, 20).map((m) => {
          const token = MANEUVER_TOKEN[m.maneuver_type];
          if (!token) return null;
          const catKey = CN_GROUP_TO_CATEGORY[m.cn_group] || "china_shiyan";
          const groupColor = SATELLITE_COLORS[catKey as keyof typeof SATELLITE_COLORS] || COLORS.textDim;
          return (
            <div key={`${m.norad_id}-${m.curr_epoch}`} style={{
              flex: "0 0 auto",
              width: 232,
              padding: "10px 11px",
              borderRadius: 8,
              background: token.soft,
              border: `1px solid ${token.color}66`,
              scrollSnapAlign: "start",
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}>
              {/* 上行：群色點 + 名稱 + maneuver chip */}
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{
                  width: 8, height: 8, borderRadius: "50%",
                  background: groupColor, flexShrink: 0,
                }} />
                <span
                  title={`點看百科卡 NORAD ${m.norad_id}`}
                  onClick={() => onSelectNorad(m.norad_id)}
                  style={{
                    fontFamily: FONT_CJK,
                    fontSize: 12,
                    fontWeight: 600,
                    color: COLORS.textStrong,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    cursor: "pointer",
                    flex: 1,
                  }}
                >
                  {m.name}
                </span>
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 3,
                  padding: "1px 6px",
                  borderRadius: 3,
                  background: `${token.color}26`,
                  border: `1px solid ${token.color}66`,
                  fontFamily: FONT_DATA,
                  fontSize: 9,
                  fontWeight: 700,
                  color: token.color,
                  flexShrink: 0,
                  animation: token.pulse ? "satManeuverPulse 1.1s ease-in-out infinite" : "none",
                }}>
                  <span>{token.icon}</span>
                  {m.maneuver_type === "PLANE_CHANGE" ? "PLANE" : m.maneuver_type === "ALTITUDE_CHANGE" ? "ALT" : "SHAPE"}
                </span>
              </div>

              {/* 中行：detail + relTime */}
              <div style={{
                display: "flex", alignItems: "center", gap: 8,
                fontFamily: FONT_DATA, fontSize: 10, color: COLORS.textMuted,
              }}>
                <span>{formatManeuverDetail(m)}</span>
                <span style={{ marginLeft: "auto", color: COLORS.textDim }}>{formatRelTime(m.curr_fetched_at)}</span>
              </div>

              {/* 下行：2 顆按鈕 */}
              <div style={{ display: "flex", gap: 6, marginTop: 2 }}>
                <button
                  onClick={() => onSelectNorad(m.norad_id)}
                  style={btn(COLORS.borderMid, COLORS.textDefault, "transparent")}
                >
                  詳情
                </button>
                <button
                  onClick={() => onOpenCompare(m)}
                  style={btn("rgba(100,170,255,0.55)", "#cfe4ff", "rgba(100,170,255,0.16)")}
                >
                  覆蓋變化
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {sorted.length > 20 && (
        <div style={{
          marginTop: 6,
          fontFamily: FONT_DATA,
          fontSize: 9,
          color: COLORS.textFaint,
          textAlign: "center",
        }}>
          顯示前 20 筆 · 共 {sorted.length} 筆變軌
        </div>
      )}
    </div>
  );
}

function btn(border: string, color: string, bg: string) {
  return {
    flex: 1 as const,
    padding: "5px 0",
    borderRadius: 4,
    background: bg,
    border: `1px solid ${border}`,
    color,
    fontFamily: FONT_CJK,
    fontSize: 11,
    cursor: "pointer",
    transition: "all 0.15s ease",
  };
}

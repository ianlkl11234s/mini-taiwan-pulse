/**
 * §A 變軌警報區（v2 — 嚴重度分級 + 影響 TW chip + 例行折疊）
 *
 * 排序：red → orange → grey，副 key 時間 DESC
 * 卡片：依嚴重度上色（紅閃 / 橘 / 灰例行）
 * 例行（grey）折疊成「N 筆例行機動」按鈕展開
 * 影響 TW：async 計算前後 7 天過台次數差，差 != 0 標「影響 TW」綠 chip
 */
import { useMemo, useState } from "react";
import { COLORS, FONT_CJK, FONT_DATA, MANEUVER_TOKEN, CN_GROUP_TO_CATEGORY, GROUP_FLAG } from "./satelliteConsoleTokens";
import { SATELLITE_COLORS } from "../../data/satelliteTypes";
import type { ManeuverRow } from "../../data/satelliteManeuversLoader";
import {
  formatManeuverDetail,
  formatRelTime,
  getManeuverSeverity,
  type ManeuverSeverity,
} from "../../data/satelliteManeuversLoader";
import { useManeuverImpacts } from "../../hooks/useManeuverImpacts";

interface Props {
  maneuvers: ManeuverRow[];
  onSelectNorad: (n: number) => void;
  onOpenCompare: (m: ManeuverRow) => void;
  onFlyTo?: (lon: number, lat: number) => void;
}

const TAIWAN_GROUP = new Set(["TAIWAN"]);
const CN_GROUPS = new Set(["YAOGAN", "JILIN", "GAOFEN", "TJS", "BEIDOU", "SHIYAN"]);
const INTL_GROUPS = new Set(["USA", "JAPAN", "RUSSIA", "INDIA", "KOREA", "FRANCE", "GERMANY", "ITALY", "ISRAEL"]);

/** 嚴重度視覺 token */
const SEV_TOKEN: Record<ManeuverSeverity, { color: string; soft: string; border: string; label: string; pulse: boolean }> = {
  red:    { color: "#ef4444", soft: "rgba(239,68,68,0.12)",  border: "rgba(239,68,68,0.55)",  label: "重大", pulse: true },
  orange: { color: "#f97316", soft: "rgba(249,115,22,0.10)", border: "rgba(249,115,22,0.50)", label: "注意", pulse: false },
  grey:   { color: "#9ca3af", soft: "rgba(255,255,255,0.02)",border: "rgba(255,255,255,0.12)",label: "例行", pulse: false },
};

export function ManeuverAlertSection({ maneuvers, onSelectNorad, onOpenCompare }: Props) {
  const [expandedGrey, setExpandedGrey] = useState(false);

  const { cnCount, twCount, intlCount, sortedRed, sortedOrange, sortedGrey } = useMemo(() => {
    let cn = 0, tw = 0, intl = 0;
    const red: ManeuverRow[] = [];
    const orange: ManeuverRow[] = [];
    const grey: ManeuverRow[] = [];
    for (const m of maneuvers) {
      if (TAIWAN_GROUP.has(m.cn_group) || m.country_operator === "Taiwan") tw++;
      else if (INTL_GROUPS.has(m.cn_group)) intl++;
      else if (m.country_operator === "China" || CN_GROUPS.has(m.cn_group)) cn++;
      const sev = getManeuverSeverity(m);
      if (sev === "red") red.push(m);
      else if (sev === "orange") orange.push(m);
      else grey.push(m);
    }
    const byTime = (a: ManeuverRow, b: ManeuverRow) =>
      new Date(b.curr_fetched_at).getTime() - new Date(a.curr_fetched_at).getTime();
    red.sort(byTime);
    orange.sort(byTime);
    grey.sort(byTime);
    return { cnCount: cn, twCount: tw, intlCount: intl, sortedRed: red, sortedOrange: orange, sortedGrey: grey };
  }, [maneuvers]);

  // affects TW 計算（非阻塞）
  const impacts = useManeuverImpacts(maneuvers);

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

  const featured = [...sortedRed, ...sortedOrange];
  const hasGrey = sortedGrey.length > 0;
  const hasFeatured = featured.length > 0;

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
        background: hasFeatured ? "rgba(239,68,68,0.12)" : "rgba(156,163,175,0.10)",
        border: hasFeatured ? "1px solid rgba(239,68,68,0.45)" : `1px solid ${COLORS.borderMid}`,
        fontFamily: FONT_CJK,
        fontSize: 11.5,
        color: COLORS.textStrong,
      }}>
        <span style={{
          width: 7, height: 7, borderRadius: "50%",
          background: hasFeatured ? COLORS.statusErr : COLORS.textDim,
          boxShadow: hasFeatured ? `0 0 6px ${COLORS.statusErr}` : "none",
          animation: hasFeatured ? "satManeuverPulse 1.1s ease-in-out infinite" : "none",
        }} />
        <span style={{ fontWeight: 600 }}>近 24h 變軌偵測</span>
        <span style={{ marginLeft: "auto", fontFamily: FONT_DATA, color: COLORS.textDefault, letterSpacing: "0.3px" }}>
          CN <span style={{ color: hasFeatured ? COLORS.statusErr : COLORS.textDefault, fontWeight: 700 }}>{cnCount}</span>
          {" / "}
          INTL <span style={{ color: intlCount > 0 ? "#22c55e" : COLORS.textDim, fontWeight: 700 }}>{intlCount}</span>
          {" / "}
          TW <span style={{ color: twCount > 0 ? COLORS.statusErr : COLORS.textDim, fontWeight: 700 }}>{twCount}</span>
        </span>
      </div>

      {/* 嚴重度說明 inline */}
      {(sortedRed.length > 0 || sortedOrange.length > 0) && (
        <div style={{
          marginBottom: 8,
          fontFamily: FONT_DATA, fontSize: 9, color: COLORS.textFaint,
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <SevDot s="red" /> 重大 {sortedRed.length}
          <SevDot s="orange" /> 注意 {sortedOrange.length}
          {sortedGrey.length > 0 && <><SevDot s="grey" /> 例行 {sortedGrey.length}</>}
        </div>
      )}

      {/* Featured (red + orange) — 直立排列，每張卡完整資訊 */}
      {hasFeatured && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {featured.map((m) => (
            <ManeuverCard
              key={`${m.norad_id}-${m.curr_epoch}`}
              row={m}
              severity={getManeuverSeverity(m)}
              impact={impacts.get(m.norad_id)}
              onSelectNorad={onSelectNorad}
              onOpenCompare={onOpenCompare}
            />
          ))}
        </div>
      )}

      {/* Grey (例行) — 折疊 */}
      {hasGrey && (
        <div style={{ marginTop: hasFeatured ? 8 : 0 }}>
          <button
            onClick={() => setExpandedGrey((v) => !v)}
            style={{
              width: "100%",
              padding: "6px 10px",
              borderRadius: 5,
              background: "rgba(255,255,255,0.025)",
              border: `1px dashed ${COLORS.borderMid}`,
              color: COLORS.textMuted,
              fontFamily: FONT_CJK,
              fontSize: 11,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <SevDot s="grey" />
            <span>{sortedGrey.length} 筆例行機動 (drift/station-keeping)</span>
            <span style={{ marginLeft: "auto", color: COLORS.textDim }}>{expandedGrey ? "▾ 收合" : "▸ 展開"}</span>
          </button>
          {expandedGrey && (
            <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 6 }}>
              {sortedGrey.map((m) => (
                <ManeuverCard
                  key={`${m.norad_id}-${m.curr_epoch}`}
                  row={m}
                  severity="grey"
                  impact={impacts.get(m.norad_id)}
                  onSelectNorad={onSelectNorad}
                  onOpenCompare={onOpenCompare}
                  compact
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SevDot({ s }: { s: ManeuverSeverity }) {
  return (
    <span style={{
      width: 6, height: 6, borderRadius: "50%",
      background: SEV_TOKEN[s].color,
      animation: SEV_TOKEN[s].pulse ? "satManeuverPulse 1.1s ease-in-out infinite" : "none",
    }} />
  );
}

interface CardProps {
  row: ManeuverRow;
  severity: ManeuverSeverity;
  impact: ReturnType<ReturnType<typeof useManeuverImpacts>["get"]>;
  onSelectNorad: (n: number) => void;
  onOpenCompare: (m: ManeuverRow) => void;
  compact?: boolean;
}

function ManeuverCard({ row, severity, impact, onSelectNorad, onOpenCompare, compact }: CardProps) {
  const sev = SEV_TOKEN[severity];
  const typeToken = MANEUVER_TOKEN[row.maneuver_type];
  if (!typeToken) return null;
  const catKey = CN_GROUP_TO_CATEGORY[row.cn_group] || "china_shiyan";
  const groupColor = SATELLITE_COLORS[catKey as keyof typeof SATELLITE_COLORS] || COLORS.textDim;

  return (
    <div style={{
      padding: compact ? "5px 9px" : "9px 11px",
      borderRadius: 7,
      background: sev.soft,
      border: `1px solid ${sev.border}`,
      display: "flex",
      flexDirection: "column",
      gap: compact ? 3 : 5,
      animation: sev.pulse && !compact ? "satManeuverPulse 1.5s ease-in-out infinite" : "none",
    }}>
      {/* 上行 */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: groupColor, flexShrink: 0 }} />
        <span style={{ fontSize: 13, flexShrink: 0 }} title={row.country_operator || row.cn_group}>
          {GROUP_FLAG[row.cn_group] ?? "🌐"}
        </span>
        <span
          onClick={() => onSelectNorad(row.norad_id)}
          style={{
            fontFamily: FONT_CJK,
            fontSize: compact ? 11 : 12,
            fontWeight: 600,
            color: COLORS.textStrong,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            cursor: "pointer",
            flex: 1,
          }}
        >
          {row.name}
        </span>
        {/* 嚴重度 chip */}
        <span style={{
          padding: "1px 6px",
          borderRadius: 3,
          background: `${sev.color}22`,
          border: `1px solid ${sev.color}55`,
          fontFamily: FONT_DATA,
          fontSize: 9,
          fontWeight: 700,
          color: sev.color,
          flexShrink: 0,
        }}>
          {sev.label}
        </span>
        {/* 類型 chip */}
        <span style={{
          padding: "1px 6px",
          borderRadius: 3,
          background: `${typeToken.color}22`,
          border: `1px solid ${typeToken.color}55`,
          fontFamily: FONT_DATA,
          fontSize: 9,
          fontWeight: 700,
          color: typeToken.color,
          flexShrink: 0,
          display: "inline-flex",
          alignItems: "center",
          gap: 2,
        }}>
          <span>{typeToken.icon}</span>
          {row.maneuver_type === "PLANE_CHANGE" ? "PLANE" : row.maneuver_type === "ALTITUDE_CHANGE" ? "ALT" : "SHAPE"}
        </span>
      </div>

      {/* 中行：detail + relTime */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        fontFamily: FONT_DATA, fontSize: 10, color: COLORS.textMuted,
      }}>
        <span>{formatManeuverDetail(row)}</span>
        <span style={{ marginLeft: "auto", color: COLORS.textDim }}>{formatRelTime(row.curr_fetched_at)}</span>
      </div>

      {/* 下行：影響 TW chip + 按鈕（compact 模式只顯 chip + 飛到按鈕） */}
      {!compact ? (
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <ImpactChip impact={impact} />
          <button
            onClick={() => onSelectNorad(row.norad_id)}
            style={btnStyle(COLORS.borderMid, COLORS.textDefault, "transparent")}
          >
            詳情
          </button>
          <button
            onClick={() => onOpenCompare(row)}
            style={btnStyle("rgba(100,170,255,0.55)", "#cfe4ff", "rgba(100,170,255,0.16)")}
          >
            覆蓋變化
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <ImpactChip impact={impact} small />
          <button
            onClick={() => onOpenCompare(row)}
            style={{ ...btnStyle("rgba(100,170,255,0.35)", "#cfe4ff", "transparent"), fontSize: 10, padding: "3px 8px" }}
          >
            對比
          </button>
        </div>
      )}
    </div>
  );
}

function ImpactChip({ impact, small }: { impact: ReturnType<ReturnType<typeof useManeuverImpacts>["get"]>; small?: boolean }) {
  // 計算中
  if (!impact) {
    return (
      <span style={{
        padding: small ? "1px 6px" : "2px 7px",
        borderRadius: 3,
        background: "rgba(255,255,255,0.04)",
        border: `1px solid ${COLORS.borderMid}`,
        fontFamily: FONT_DATA, fontSize: 9, color: COLORS.textDim,
      }}>
        計算 TW 影響中…
      </span>
    );
  }
  // 影響
  if (impact.affectsTw) {
    return (
      <span style={{
        padding: small ? "1px 6px" : "2px 7px",
        borderRadius: 3,
        background: "rgba(34,197,94,0.16)",
        border: "1px solid rgba(34,197,94,0.55)",
        fontFamily: FONT_CJK, fontSize: 10, color: "#22c55e", fontWeight: 600,
        display: "inline-flex", alignItems: "center", gap: 3,
      }}>
        ✓ 影響 TW
        <span style={{ fontFamily: FONT_DATA, fontSize: 9, opacity: 0.8 }}>
          ({impact.passBefore}→{impact.passAfter})
        </span>
      </span>
    );
  }
  // 無影響
  return (
    <span style={{
      padding: small ? "1px 6px" : "2px 7px",
      borderRadius: 3,
      background: "rgba(255,255,255,0.03)",
      border: `1px solid ${COLORS.borderSoft}`,
      fontFamily: FONT_CJK, fontSize: 10, color: COLORS.textFaint,
    }}>
      過台不變 ({impact.passBefore}=)
    </span>
  );
}

function btnStyle(border: string, color: string, bg: string) {
  return {
    padding: "5px 10px",
    borderRadius: 4,
    background: bg,
    border: `1px solid ${border}`,
    color,
    fontFamily: FONT_CJK,
    fontSize: 11,
    cursor: "pointer",
    transition: "all 0.15s ease",
    flexShrink: 0,
  };
}

import { useEffect, useState } from "react";
import { IntelIcon } from "../IntelIcon";
import {
  FONT_CJK, FONT_DATA, MICON,
  ALERT_GROUPS_DEF, alertSeverity, fmtExpiry, relTime, clockTime,
  chipTint, chipOutline, splitRelTimeParts, withAlpha,
} from "../intelTokens";
import { chipText, neutralFill, useIntelTheme } from "../intelTheme";
import type { ActiveAlert } from "../../../data/alertsLoader";
import { RADIUS, FONT_SIZE, SURFACE, LIGHT } from "../../../styles/designTokens";

const TEN_YEARS_SEC = 10 * 365 * 86400;

/** M/D（Asia/Taipei） */
function dayLabel(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString("zh-TW", {
    timeZone: "Asia/Taipei",
    month: "numeric",
    day: "numeric",
  });
}

interface Props {
  a: ActiveAlert;
  selected: boolean;
  expanded: boolean;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
  nowTs: number;
}

export function AlertCard({ a, selected, expanded, onSelect, onToggle, nowTs }: Props) {
  const palette = useIntelTheme();
  const def = ALERT_GROUPS_DEF[a.group];
  const sev = alertSeverity(a.severity);
  const defTextColor = chipText(def.color, palette);
  const sevTextColor = chipText(sev.color, palette);
  // spine dot 的「面板色外圈」：暗＝SURFACE.app（原字面值不變），淡＝LIGHT.surfaceSolid（不透明白）。
  const spineHalo = palette.isDark ? SURFACE.app : LIGHT.surfaceSolid;

  // 倒數即時刷新（僅在 expanded 或 severity>=3 時 1s tick）
  const [tick, setTick] = useState(nowTs);
  useEffect(() => {
    if (!expanded && a.severity < 3) return;
    const id = window.setInterval(() => setTick(Math.floor(Date.now() / 1000)), 1000);
    return () => window.clearInterval(id);
  }, [expanded, a.severity]);

  const effNow = expanded || a.severity >= 3 ? tick : nowTs;
  const expiresInSec = a.expires_ts - effNow;
  const expired = expiresInSec <= 0;
  // 倒數只在「數得完」時才有意義：停水公告動輒 150 小時、無 expires 的示警
  // 會被 loader 塞 MAX_SAFE_INTEGER，直接吐 HH:MM:SS 會變天文數字
  const expiryText = expired
    ? "已過期"
    : expiresInSec > TEN_YEARS_SEC
      ? "長期"
      : expiresInSec > 99 * 3600
        ? `至 ${dayLabel(a.expires_ts)}`
        : fmtExpiry(a.expires_ts, effNow);

  const onCardClick = () => {
    onSelect(a.id);
    onToggle(a.id);
  };

  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <div style={{ position: "relative", paddingLeft: 26 }}>
      {/* spine dot — 7px ＋ 2px 面板色外圈（與時間軸直線同語彙） */}
      <span
        style={{
          position: "absolute",
          left: 9, top: 16,
          width: 7, height: 7,
          borderRadius: RADIUS.full,
          background: sev.color,
          zIndex: 1,
          boxShadow: selected
            ? `0 0 0 2px ${spineHalo}, 0 0 0 5px ${sev.color}55`
            : `0 0 0 2px ${spineHalo}`,
          animation: sev.anim ?? undefined,
        }}
      />
      <div
        onClick={onCardClick}
        style={{
          cursor: "pointer",
          padding: "10px 12px",
          borderRadius: RADIUS.lg,
          background: selected ? withAlpha(palette.accent, 0.06) : neutralFill(0.025, palette.isDark),
          border: `1px solid ${selected ? palette.borderAccent : palette.borderMid}`,
          animation: a.severity >= 3 ? "alertEdge 2s ease-in-out infinite" : undefined,
        }}
      >
        {/* chip row */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
          <span
            style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              padding: "1px 7px", borderRadius: RADIUS.md,
              ...chipTint(def.color, defTextColor),
              fontFamily: FONT_CJK, fontSize: 9.5, fontWeight: 700,
            }}
          >
            <IntelIcon d={MICON[def.iconKey]!} size={10} color={def.color} />
            {def.label}
          </span>
          <span
            style={{
              padding: "1px 7px", borderRadius: RADIUS.md,
              ...chipOutline(sev.color, sevTextColor),
              fontFamily: FONT_CJK, fontSize: 9.5, fontWeight: 700,
              animation: sev.anim ?? undefined,
            }}
          >
            {sev.label}
          </span>
          <span
            style={{
              fontFamily: FONT_CJK, fontSize: 9.5,
              color: palette.textFaint,
            }}
          >
            {a.term}
          </span>
          <div style={{ flex: 1 }} />
          <span
            style={{
              fontFamily: FONT_CJK, fontSize: 9.5,
              color: expired ? palette.textFaint : palette.textMuted,
            }}
          >
            {splitRelTimeParts(expiryText).map((p, i) =>
              p.mono ? <span key={i} style={{ fontFamily: FONT_DATA }}>{p.text}</span> : <span key={i}>{p.text}</span>,
            )}
          </span>
        </div>

        {/* headline */}
        <div
          style={{
            fontFamily: FONT_CJK, fontSize: FONT_SIZE.lg, fontWeight: 600,
            color: palette.textStrong, lineHeight: 1.45, marginBottom: 4,
          }}
        >
          {a.headline || a.term}
        </div>

        {/* location + time */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {/* county 與 headline 同字串時不重覆上牆（NCDR/CWA 原文常有這種列） */}
          {a.county && a.county !== (a.headline || a.term) && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
              <IntelIcon d={MICON.pin!} size={10} color={palette.textMuted} />
              <span style={{ fontFamily: FONT_CJK, fontSize: FONT_SIZE.base, color: palette.textMuted }}>
                {a.county}
                {a.area_count > 1 && (
                  <span style={{ color: palette.textFaint }}> · <span style={{ fontFamily: FONT_DATA }}>{a.area_count}</span> 區</span>
                )}
              </span>
            </span>
          )}
          <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
            <IntelIcon d={MICON.clock!} size={10} color={palette.textMuted} />
            <span style={{ fontFamily: FONT_CJK, fontSize: 10.5, color: palette.textMuted }}>
              {splitRelTimeParts(relTime(a.sent_ts, effNow)).map((p, i) =>
                p.mono ? <span key={i} style={{ fontFamily: FONT_DATA }}>{p.text}</span> : <span key={i}>{p.text}</span>,
              )}
            </span>
          </span>
        </div>

        {/* expanded */}
        {expanded && (
          <div
            onClick={stop}
            style={{
              marginTop: 9, paddingTop: 9,
              borderTop: `1px solid ${palette.borderSoft}`,
              animation: "drawerOpen .25s ease-out",
            }}
          >
            {a.description && (
              <div
                style={{
                  fontFamily: FONT_CJK, fontSize: 11.5,
                  color: palette.textDefault, lineHeight: 1.55,
                  marginBottom: 8,
                }}
              >
                {a.description}
              </div>
            )}
            {a.instruction && (
              <div
                style={{
                  padding: "7px 9px",
                  borderRadius: RADIUS.lg,
                  background: `${def.color}10`,
                  border: `1px solid ${def.color}33`,
                  marginBottom: 8,
                }}
              >
                <div
                  style={{
                    fontFamily: FONT_CJK, fontSize: FONT_SIZE.xs, fontWeight: 700,
                    color: defTextColor, marginBottom: 3,
                  }}
                >
                  處置指引
                </div>
                <div
                  style={{
                    fontFamily: FONT_CJK, fontSize: 11.5,
                    color: palette.textDefault, lineHeight: 1.55,
                  }}
                >
                  {a.instruction}
                </div>
              </div>
            )}

            {/* meta grid — 標籤與敘述用 CJK，時間／數字另包 FONT_DATA */}
            <div
              style={{
                display: "grid", gridTemplateColumns: "auto 1fr", gap: "4px 10px",
                fontFamily: FONT_CJK, fontSize: FONT_SIZE.sm,
              }}
            >
              <span style={{ color: palette.textFaint }}>發佈</span>
              <span style={{ color: palette.textMuted, fontFamily: FONT_DATA }}>{clockTime(a.sent_ts)}</span>
              <span style={{ color: palette.textFaint }}>失效</span>
              <span style={{ color: palette.textMuted }}>
                {expiresInSec > TEN_YEARS_SEC
                  ? "未標示（長期）"
                  : <span style={{ fontFamily: FONT_DATA }}>{clockTime(a.expires_ts)}</span>}
              </span>
              {a.magnitude != null && (
                <>
                  <span style={{ color: palette.textFaint }}>規模</span>
                  <span style={{ color: palette.textStrong, fontWeight: 700, fontFamily: FONT_DATA }}>M {a.magnitude}</span>
                </>
              )}
              {a.depth_km != null && (
                <>
                  <span style={{ color: palette.textFaint }}>深度</span>
                  <span style={{ color: palette.textMuted, fontFamily: FONT_DATA }}>{a.depth_km} km</span>
                </>
              )}
              {a.area_desc && a.area_desc !== a.county && (
                <>
                  <span style={{ color: palette.textFaint }}>範圍</span>
                  <span style={{ color: palette.textMuted, lineHeight: 1.5 }}>{a.area_desc}</span>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

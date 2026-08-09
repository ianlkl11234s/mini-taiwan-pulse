import { useEffect, useState } from "react";
import { COLORS, FONT_CJK, FONT_DATA, type PressureLevelDef } from "../intelTokens";
import { RADIUS, FONT_SIZE } from "../../../styles/designTokens";
import {
  fetchMarketIndexHistory,
  type MarketIndex,
  type MarketIndexDailyPoint,
} from "../../../data/intelLoaders";

/** 270° SVG gauge — 主環 + 動畫，中央留洞給數字（caller 負責疊上 score 文字） */
export function PressureRing({
  score,
  level,
  size = 132,
}: {
  score: number;
  level: PressureLevelDef;
  size?: number;
}) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const sweep = 0.75; // 270°
  const track = sweep * c;
  const val = sweep * c * (Math.max(0, Math.min(100, score)) / 100);
  const animName =
    level.anim === "pulse" ? "presPulse" : level.anim === "breathe" ? "presBreathe" : null;
  const animStyle = animName ? { animation: `${animName} ${level.period}s ease-in-out infinite` } : {};
  const hasGlow = level.glow !== "rgba(255,59,48,0)" && level.glow !== "rgba(255,152,0,0)" && level.glow !== "rgba(76,175,80,0)" && level.glow !== "rgba(234,179,8,0)";
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 132 132"
        style={{ transform: "rotate(135deg)", overflow: "visible", ...animStyle }}
      >
        <circle
          cx="66" cy="66" r={r} fill="none" stroke="rgba(255,255,255,0.07)"
          strokeWidth="9" strokeDasharray={`${track} ${c}`} strokeLinecap="round"
        />
        <circle
          cx="66" cy="66" r={r} fill="none" stroke={level.color}
          strokeWidth="9" strokeDasharray={`${val} ${c}`} strokeLinecap="round"
          style={{
            transition: "stroke-dasharray .6s cubic-bezier(.22,1,.36,1), stroke .4s",
            filter: hasGlow ? `drop-shadow(0 0 6px ${level.glow})` : "none",
          }}
        />
      </svg>
      <div
        style={{
          position: "absolute", inset: 0, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: 1,
        }}
      >
        <span
          style={{
            fontFamily: FONT_DATA, fontSize: 40, fontWeight: 700, lineHeight: 1,
            color: "#fff", letterSpacing: "-1px",
          }}
        >
          {Math.round(score)}
        </span>
        <span style={{ fontFamily: FONT_CJK, fontSize: FONT_SIZE.lg, fontWeight: 700, color: level.color }}>
          {level.label}
        </span>
        <span
          style={{ fontFamily: FONT_DATA, fontSize: 7.5, letterSpacing: "2px", color: COLORS.textFaint }}
        >
          {level.en}
        </span>
      </div>
    </div>
  );
}

export function CompareLine({ delta, label }: { delta: number; label: string }) {
  const up = delta >= 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span
        style={{
          fontFamily: FONT_DATA, fontSize: FONT_SIZE.md, fontWeight: 700, width: 40,
          color: up ? COLORS.statusWarn : COLORS.statusLive,
        }}
      >
        {up ? "↗" : "↘"}{up ? "+" : ""}{Math.round(delta)}
      </span>
      <span style={{ fontFamily: FONT_CJK, fontSize: 10.5, color: COLORS.textMuted, whiteSpace: "nowrap" }}>
        {label}
      </span>
    </div>
  );
}

export function TwseTicker({ data, open }: { data: MarketIndex; open: boolean }) {
  // 近 30 交易日日線（panel 開啟才抓；cachedOnce 10min TTL 蓋住 interval）
  const [history, setHistory] = useState<MarketIndexDailyPoint[]>([]);
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const load = () =>
      fetchMarketIndexHistory().then((rows) => {
        if (!cancelled) setHistory(rows);
      });
    load();
    const id = window.setInterval(load, 10 * 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [open]);

  const up = data.change >= 0;
  // 台股慣例：漲紅跌綠
  const mk = up ? "#ff4d4f" : "#16c784";
  const closed = (data.status ?? "") !== "盤中";
  const has = data.index > 0;
  const closes = history.map((p) => p.close);
  const histFirst = history[0];
  const histLast = history[history.length - 1];
  const histUp = (histLast?.close ?? 0) >= (histFirst?.close ?? 0);
  return (
    <div
      style={{
        borderRadius: RADIUS.xl,
        border: `1px solid ${COLORS.panelBorder}`,
        background: "linear-gradient(160deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))",
        padding: "10px 14px",
        display: "flex", flexDirection: "column", gap: 6, minWidth: 208,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
        <span
          style={{
            fontFamily: FONT_DATA, fontSize: FONT_SIZE.xs, letterSpacing: "1.2px",
            color: COLORS.textDim, whiteSpace: "nowrap",
          }}
        >
          TAIEX 加權指數
        </span>
        <div style={{ flex: 1 }} />
        <span
          style={{
            fontFamily: FONT_CJK, fontSize: 8.5, color: COLORS.textFaint,
            padding: "1px 6px", borderRadius: RADIUS.md, background: "rgba(255,255,255,0.05)", whiteSpace: "nowrap",
          }}
        >
          {data.status ?? "—"} {data.time ?? ""}
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 9, whiteSpace: "nowrap" }}>
        <span
          style={{
            fontFamily: FONT_DATA, fontSize: 24, fontWeight: 700, lineHeight: 1,
            color: closed ? "rgba(255,255,255,0.92)" : "#fff",
          }}
        >
          {has ? data.index.toLocaleString() : "—"}
        </span>
        {has && (
          <>
            <span style={{ fontFamily: FONT_DATA, fontSize: FONT_SIZE.lg, fontWeight: 700, color: mk }}>
              {up ? "▲" : "▼"} {up ? "+" : ""}{data.change.toLocaleString()}
            </span>
            <span style={{ fontFamily: FONT_DATA, fontSize: FONT_SIZE.md, fontWeight: 700, color: mk }}>
              {up ? "+" : ""}{data.change_pct}%
            </span>
          </>
        )}
      </div>
      <div
        style={{
          display: "flex", gap: 12, fontFamily: FONT_DATA, fontSize: FONT_SIZE.xs,
          color: COLORS.textDim, whiteSpace: "nowrap",
        }}
      >
        <span>H <b style={{ color: COLORS.textDefault }}>{data.high.toLocaleString()}</b></span>
        <span>L <b style={{ color: COLORS.textDefault }}>{data.low.toLocaleString()}</b></span>
        <span>量 <b style={{ color: COLORS.textDefault }}>{data.turnover ?? "—"}</b></span>
      </div>
      {closes.length >= 2 && histFirst && histLast && (
        <div
          style={{ display: "flex", alignItems: "center", gap: 7 }}
          title={`${histFirst.trade_date} ～ ${histLast.trade_date} 收盤（交易日序列）`}
        >
          <span
            style={{
              fontFamily: FONT_DATA, fontSize: 7.5, letterSpacing: "1.5px",
              color: COLORS.textFaint, whiteSpace: "nowrap",
            }}
          >
            30D
          </span>
          {/* 2026-08-10 起 TAIEX 是獨立 widget（不再擠在戰情概覽右側），日線給得起 360×48。
              上限抓 360 是因為 Sparkline 固定寬 + flexShrink:0：grid 模式最窄（容器 1100px）
              時 w5 格內可用寬約 380px，再大就會溢出讓格子橫向捲動。 */}
          <Sparkline data={closes} color={histUp ? "#ff4d4f" : "#16c784"} w={360} h={48} />
        </div>
      )}
    </div>
  );
}

/** 迷你折線。`null` = 該點無資料（非 0），會斷線分段畫，不會被當 0 拉到底。 */
export function Sparkline({
  data, color, w = 64, h = 20,
}: { data: (number | null)[]; color: string; w?: number; h?: number }) {
  const vals = data.filter((v): v is number => v !== null);
  if (vals.length < 2) return <svg width={w} height={h} />;
  const max = Math.max(...vals);
  const min = Math.min(...vals);
  const rng = max - min || 1;
  const xy = (v: number, i: number) =>
    `${(i / (data.length - 1)) * w},${h - ((v - min) / rng) * (h - 2) - 1}`;
  // 依 null 切段：每段各自一條 polyline，孤立點（前後皆 null）畫成小圓點
  const segments: string[][] = [];
  const dots: string[] = [];
  let cur: string[] = [];
  data.forEach((v, i) => {
    if (v === null) {
      if (cur.length) segments.push(cur);
      cur = [];
      return;
    }
    cur.push(xy(v, i));
  });
  if (cur.length) segments.push(cur);
  for (const seg of segments) if (seg.length === 1) dots.push(seg[0]!);
  return (
    <svg width={w} height={h} style={{ flexShrink: 0, overflow: "visible" }}>
      {segments
        .filter((s) => s.length >= 2)
        .map((s, i) => (
          <polyline
            key={i} points={s.join(" ")} fill="none" stroke={color}
            strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" opacity="0.85"
          />
        ))}
      {dots.map((d, i) => {
        const [cx, cy] = d.split(",");
        return <circle key={`d${i}`} cx={cx} cy={cy} r="1.2" fill={color} opacity="0.85" />;
      })}
    </svg>
  );
}

export function SectionLabel({ children, color }: { children: React.ReactNode; color?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 9 }}>
      <span
        style={{
          width: 3, height: 12, borderRadius: RADIUS.sm, background: color ?? COLORS.accent,
        }}
      />
      <span
        style={{
          fontFamily: FONT_DATA, fontSize: FONT_SIZE.sm, letterSpacing: "1.5px",
          color: COLORS.textDefault, textTransform: "uppercase",
        }}
      >
        {children}
      </span>
    </div>
  );
}

export function Widget({
  children, style,
}: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        borderRadius: RADIUS.xl, border: `1px solid ${COLORS.panelBorder}`,
        background: "rgba(255,255,255,0.022)", padding: 13,
        display: "flex", flexDirection: "column", ...style,
      }}
    >
      {children}
    </div>
  );
}


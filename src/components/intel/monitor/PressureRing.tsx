import { useMonitorResource } from "../../../hooks/useMonitorResource";
import { MonitorDataStatus } from "./MonitorDataStatus";
import { useMonitorV2 } from "./monitorStyle";
import { MonitorMetric, MonitorNote, MonitorSub } from "./MonitorMetric";
import { TimeseriesSparkline, type SparklinePoint } from "../../TimeseriesSparkline";
import { fs } from "./monitorFont";
import { useMonitorFreshness } from "./monitorFreshness";
import { useLayoutEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { COLORS, FONT_CJK, FONT_DATA, type PressureLevelDef } from "../intelTokens";
import { RADIUS, FONT_SIZE } from "../../../styles/designTokens";
import {
  fetchMarketIndexHistory,
  type MarketIndex,
  type MarketIndexDailyPoint,
} from "../../../data/intelLoaders";
import { useChartTooltip, fmtChartValue } from "../../ChartHoverTooltip";
import type { IntelQueryStatus } from "../../../hooks/useIntelPollingQuery";

/** 270° SVG gauge — 主環 + 動畫，中央留洞給數字（caller 負責疊上 score 文字） */
export function PressureRing({
  score,
  level,
  status = "ready",
  stale = false,
  size = 132,
}: {
  score: number;
  level: PressureLevelDef;
  status?: IntelQueryStatus;
  stale?: boolean;
  size?: number;
}) {
  const v2 = useMonitorV2();
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
    // v2：旋轉後的 SVG 外接框比環大 27px，會撐出卡片 body 的捲動高度 → 裁在環的方框內
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0, overflow: v2 ? "hidden" : undefined }}>
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
          cx="66" cy="66" r={r} fill="none" stroke={status === "ready" ? level.color : COLORS.textMuted}
          strokeWidth="9" strokeDasharray={`${val} ${c}`} strokeLinecap="round"
          style={{
            transition: "stroke-dasharray .6s cubic-bezier(.22,1,.36,1), stroke .4s",
            filter: status === "ready" && hasGlow ? `drop-shadow(0 0 6px ${level.glow})` : "none",
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
            fontFamily: FONT_DATA, fontSize: fs(v2, 40), fontWeight: 700, lineHeight: 1,
            color: "#fff", letterSpacing: "-1px",
          }}
        >
          {status === "ready" || stale ? Math.round(score) : "—"}
        </span>
        <span style={{ fontFamily: FONT_CJK, fontSize: fs(v2, FONT_SIZE.lg), fontWeight: 700, color: status === "ready" ? level.color : COLORS.textMuted }}>
          {status === "ready" ? level.label : status === "denied" ? "受限" : status === "error" ? "中斷" : "未知"}
        </span>
        {/* 英文等級字只在舊版（v2 字級放大後會和中文疊在一起；§6.1 標籤一律中文） */}
        {!v2 && (
          <span
            style={{ fontFamily: FONT_DATA, fontSize: fs(v2, 7.5), letterSpacing: "2px", color: COLORS.textFaint }}
          >
            {status === "ready" ? level.en : "DATA"}
          </span>
        )}
      </div>
    </div>
  );
}

export function CompareLine({ delta, label, muted = false }: { delta: number | null; label: string; muted?: boolean }) {
  const v2 = useMonitorV2();
  const up = delta !== null && delta >= 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span
        style={{
          fontFamily: FONT_DATA, fontSize: fs(v2, FONT_SIZE.md), fontWeight: 700, ...(v2 ? { minWidth: 40 } : { width: 40 }),
          color: muted || delta === null ? COLORS.textMuted : up ? COLORS.statusWarn : COLORS.statusLive,
        }}
      >
        {delta === null ? "—" : <>{up ? "↗" : "↘"}{up ? "+" : ""}{Math.round(delta)}</>}
      </span>
      <span style={{ fontFamily: FONT_CJK, fontSize: fs(v2, 10.5), color: COLORS.textMuted, whiteSpace: "nowrap" }}>
        {label}
      </span>
    </div>
  );
}

const EMPTY_MARKET_HISTORY: MarketIndexDailyPoint[] = [];

/** v2：走勢圖寬度隨容器縮放（ResizeObserver 量容器寬後傳給 Sparkline 的 w） */
export function FluidSparkline({
  fallbackW, ...rest
}: { fallbackW: number } & Omit<React.ComponentProps<typeof Sparkline>, "w">) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(fallbackW);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const cw = Math.floor(el.clientWidth);
      if (cw > 0) setW(cw);
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={ref} style={{ flex: 1, minWidth: 0, maxWidth: "100%" }}>
      <Sparkline {...rest} w={w} />
    </div>
  );
}

/**
 * 加權指數的資料時間：RPC 只回 "HH:MM"、沒有日期 → 日期取歷史序列最後一筆的 trade_date
 * （日線盤中最後一點為當日即時值，所以它就是這個 HH:MM 所屬的交易日）。
 * 歷史尚未載入或沒有日期、或 HH:MM 格式不符 → null（不拿今天日期硬套）。
 */
export function marketDataMs(tradeDate: string | null | undefined, hhmm: string | null | undefined): number | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm ?? "");
  if (!m || !tradeDate || !/^\d{4}-\d{2}-\d{2}$/.test(tradeDate)) return null;
  const t = Date.parse(`${tradeDate}T${m[1]!.padStart(2, "0")}:${m[2]}:00+08:00`);
  return Number.isNaN(t) ? null : t;
}

export function TwseTicker({
  data, status, lastSuccessAt, open,
}: { data: MarketIndex; status: IntelQueryStatus; lastSuccessAt: number | null; open: boolean }) {
  // 近 30 交易日日線（panel 開啟才抓；cachedOnce 10min TTL 蓋住 interval）
  const historyQuery = useMonitorResource({ open, queryKey: "market-history:30d", intervalMs: 10 * 60_000, emptyData: EMPTY_MARKET_HISTORY, load: fetchMarketIndexHistory });
  const history = historyQuery.data;

  const stale = status === "error" && lastSuccessAt !== null;
  const available = status === "ready" || stale;
  const up = data.change >= 0;
  // 台股慣例：漲紅跌綠
  const mk = stale ? COLORS.textMuted : up ? "#ff4d4f" : "#16c784";
  const closed = (data.status ?? "") !== "盤中";
  const has = available && data.index > 0;
  const closes = history.map((p) => p.close);
  const histFirst = history[0];
  const histLast = history[history.length - 1];
  const histUp = (histLast?.close ?? 0) >= (histFirst?.close ?? 0);

  // v2：資料時間＝歷史序列最後一筆日期＋RPC 的 HH:MM；收盤／休市只出中性 pill（paused，資料超過 4 天會改成過期）
  const v2 = useMonitorV2();
  const dataMs = available && data.time ? marketDataMs(histLast?.trade_date, data.time) : null;
  const fresh = useMonitorFreshness("taiex", {
    time: dataMs,
    paused: closed && !!data.status,
    pausedLabel: data.status ?? undefined,
    reason: status === "denied" ? "無權限讀取行情" : undefined,
  });
  if (v2) {
    // 新版：主數字＝指數＋漲跌；高低量走副資訊；30 日走勢用有時間軸的 TimeseriesSparkline（std）
    const tone = stale ? "neutral" : up ? "up" : "down"; // 台股慣例：漲紅跌綠
    const points: SparklinePoint[] = history
      .map((p) => ({ t: Date.parse(`${p.trade_date}T00:00:00+08:00`) / 1000, v: p.close }))
      .filter((p) => Number.isFinite(p.t));
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
        <MonitorDataStatus label="行情歷史" query={historyQuery} />
        <MonitorMetric
          value={has ? data.index.toLocaleString() : "—"}
          muted={stale || fresh.muted}
          delta={has ? `${up ? "▲ +" : "▼ "}${data.change.toLocaleString()}（${up ? "+" : ""}${data.change_pct}%）` : undefined}
          tone={tone}
        />
        <MonitorSub items={[
          `高 ${has && data.high !== null ? data.high.toLocaleString() : "—"}`,
          `低 ${has && data.low !== null ? data.low.toLocaleString() : "—"}`,
          `量 ${has ? data.turnover ?? "—" : "—"}`,
        ]} />
        {status !== "ready" && (
          <MonitorNote>
            {status === "error" && lastSuccessAt ? `最後成功 ${new Date(lastSuccessAt).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" })}` : "不以 0 或舊行情判斷漲跌"}
          </MonitorNote>
        )}
        {fresh.reason && (status === "ready" || status === "error") && (
          <MonitorNote tone={fresh.state === "stopped" ? "err" : "warn"}>{fresh.reason}</MonitorNote>
        )}
        {points.length >= 2 && (
          // 交易日序列有週末／連假空檔：gapSec 10 天只在超長假（春節）才斷線
          <TimeseriesSparkline
            data={points}
            unit="點"
            lineColor={histUp ? COLORS.statusErr : COLORS.statusLive}
            heightTier="std"
            gapSec={10 * 86400}
            showTooltip
            tooltipDateFormat="date"
            seriesLabel="加權指數"
            compactYAxis
          />
        )}
      </div>
    );
  }
  return (
    <div
      style={v2 ? { display: "flex", flexDirection: "column", gap: 6, minWidth: 0 } : {
        borderRadius: RADIUS.xl,
        border: `1px solid ${COLORS.panelBorder}`,
        background: "linear-gradient(160deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))",
        padding: "10px 14px",
        display: "flex", flexDirection: "column", gap: 6, minWidth: 208,
      }}
    >
      <MonitorDataStatus label="行情歷史" query={historyQuery} />
      {!v2 && <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
        <span
          style={{
            fontFamily: FONT_DATA, fontSize: fs(v2, FONT_SIZE.xs), letterSpacing: "1.2px",
            color: COLORS.textDim, whiteSpace: "nowrap",
          }}
        >
          TAIEX 加權指數
        </span>
        <div style={{ flex: 1 }} />
        <span
          style={{
            fontFamily: FONT_CJK, fontSize: fs(v2, 8.5), color: COLORS.textFaint,
            padding: "1px 6px", borderRadius: RADIUS.md, background: "rgba(255,255,255,0.05)", whiteSpace: "nowrap",
          }}
        >
          {status === "ready" ? `${data.status ?? "—"} ${data.time ?? ""}` : status === "denied" ? "受限" : status === "error" ? "更新中斷" : "讀取中"}
        </span>
      </div>}
      <div style={v2 ? { display: "flex", alignItems: "baseline", gap: "2px 9px", flexWrap: "wrap" } : { display: "flex", alignItems: "baseline", gap: 9, whiteSpace: "nowrap" }}>
        <span
          style={{
            fontFamily: FONT_DATA, fontSize: fs(v2, 24), fontWeight: 700, lineHeight: 1,
            color: closed ? "rgba(255,255,255,0.92)" : "#fff",
            whiteSpace: "nowrap",
          }}
        >
          {has ? data.index.toLocaleString() : "—"}
        </span>
        {has && (
          <>
            <span style={{ fontFamily: FONT_DATA, fontSize: fs(v2, FONT_SIZE.lg), fontWeight: 700, color: mk, whiteSpace: "nowrap" }}>
              {up ? "▲" : "▼"} {up ? "+" : ""}{data.change.toLocaleString()}
            </span>
            <span style={{ fontFamily: FONT_DATA, fontSize: fs(v2, FONT_SIZE.md), fontWeight: 700, color: mk, whiteSpace: "nowrap" }}>
              {up ? "+" : ""}{data.change_pct}%
            </span>
          </>
        )}
      </div>
      <div
        style={{
          display: "flex", gap: v2 ? "2px 12px" : 12, fontFamily: FONT_DATA, fontSize: fs(v2, FONT_SIZE.xs),
          color: COLORS.textDim, ...(v2 ? { flexWrap: "wrap" as const } : { whiteSpace: "nowrap" as const }),
        }}
      >
        <span style={{ whiteSpace: "nowrap" }}>{v2 ? "高" : "H"} <b style={{ color: COLORS.textDefault }}>{has ? (data.high ?? 0).toLocaleString() : "—"}</b></span>
        <span style={{ whiteSpace: "nowrap" }}>{v2 ? "低" : "L"} <b style={{ color: COLORS.textDefault }}>{has ? (data.low ?? 0).toLocaleString() : "—"}</b></span>
        <span style={{ whiteSpace: "nowrap" }}>量 <b style={{ color: COLORS.textDefault }}>{has ? data.turnover ?? "—" : "—"}</b></span>
      </div>
      {status !== "ready" && <span style={{ fontFamily: FONT_CJK, fontSize: fs(v2, FONT_SIZE.xs), color: COLORS.textMuted }}>
        {status === "error" && lastSuccessAt ? `最後成功 ${new Date(lastSuccessAt).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" })}` : "不以 0 或舊行情判斷漲跌"}
      </span>}
      {closes.length >= 2 && histFirst && histLast && (
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <span
            style={{
              ...(v2
                ? { fontFamily: FONT_CJK, fontSize: fs(v2, FONT_SIZE.xs) }
                : { fontFamily: FONT_DATA, fontSize: fs(v2, 7.5), letterSpacing: "1.5px" }),
              color: COLORS.textFaint, whiteSpace: "nowrap",
            }}
          >
            {v2 ? "近 30 日" : "30D"}
          </span>
          {/* 2026-08-10 起 TAIEX 是獨立 widget（不再擠在戰情概覽右側），日線給得起 360×48。
              上限抓 360 是因為 Sparkline 固定寬 + flexShrink:0：grid 模式最窄（容器 1100px）
              時 w5 格內可用寬約 380px，再大就會溢出讓格子橫向捲動。
              逐點 hover 取代原本整段區間的 HTML title。 */}
            <Sparkline
              data={closes}
              color={histUp ? "#ff4d4f" : "#16c784"}
              w={360}
              h={48}
              showTooltip
              labelAt={(i) => history[i]?.trade_date ?? ""}
              unit="點"
            />
        </div>
      )}
    </div>
  );
}

/**
 * 迷你折線。`null` = 該點無資料（非 0），會斷線分段畫，不會被當 0 拉到底。
 *
 * Hover tooltip 是 **opt-in**（`showTooltip`，比照 `TimeseriesSparkline` 的同名慣例）：
 * 不傳時完全維持原行為 —— 無事件、無 `useChartTooltip` 浮層。
 *
 * 這個元件本身沒有時間軸，只知道「第幾個點」。要顯示日期／時間／週次等標籤，
 * 呼叫端自己用 `labelAt(i)` 把 index 換成標題文字（`i` 對應 `data` 的原始索引，
 * 含 null 點，因為畫線時就是用原始索引定位 x 座標）。數值列預設走
 * `fmtChartValue(v, unit)` 格式化；需要固定小數位或非數字格式（例如 µSv/h 3 位小數）
 * 時改傳 `formatValue` 覆蓋，優先權高於 `unit`。
 *
 * ```tsx
 * <Sparkline
 *   data={closes}
 *   color={mk}
 *   w={360} h={48}
 *   showTooltip
 *   labelAt={(i) => history[i]?.trade_date ?? ""}
 *   unit="點"
 * />
 * ```
 */
export function Sparkline({
  data, color, w = 64, h = 20,
  showTooltip = false, labelAt, unit, formatValue,
}: {
  data: (number | null)[];
  color: string;
  w?: number;
  h?: number;
  /** opt-in：逐點 hover 顯示 tooltip。不傳（預設 false）= 完全維持現行行為。 */
  showTooltip?: boolean;
  /** index → tooltip 標題列文字（例：日期、"14:00"、"W33"）。不傳則不畫標題列，只顯示數值。 */
  labelAt?: (i: number) => string;
  /** 數值單位，交給 `fmtChartValue(v, unit)` 格式化 tooltip 數值列。 */
  unit?: string;
  /** 完整自訂數值列文字（優先權高於 `unit`），簽名 `(value, index) => string`。 */
  formatValue?: (v: number, i: number) => string;
}) {
  const tip = useChartTooltip();
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

  function handleMouseMove(e: ReactMouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width === 0) return;
    const xRatio = (e.clientX - rect.left) / rect.width;
    const raw = Math.max(0, Math.min(Math.round(xRatio * (data.length - 1)), data.length - 1));
    // 落點可能剛好在 null 點上（斷線處）：往兩側找最近的有值點
    let i: number | null = data[raw] !== null ? raw : null;
    for (let d = 1; i === null && d < data.length; d++) {
      if (raw - d >= 0 && data[raw - d] !== null) i = raw - d;
      else if (raw + d < data.length && data[raw + d] !== null) i = raw + d;
    }
    if (i === null) {
      tip.hide();
      return;
    }
    const v = data[i]!;
    tip.show(e.clientX, e.clientY, {
      title: labelAt?.(i),
      rows: [{ dot: color, value: formatValue ? formatValue(v, i) : fmtChartValue(v, unit) }],
    });
  }

  return (
    <>
      <svg
        width={w} height={h} style={{ flexShrink: 0, overflow: "visible" }}
        onMouseMove={showTooltip ? handleMouseMove : undefined}
        onMouseLeave={showTooltip ? tip.hide : undefined}
      >
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
      {tip.node}
    </>
  );
}

export function SectionLabel({ children, color }: { children: React.ReactNode; color?: string }) {
  const v2 = useMonitorV2();
  // v2：卡片標題由 MonitorCardFrame 畫；卡內的 SectionLabel 只當小節標（中文、不轉大寫、非等寬）
  if (v2) {
    return (
      <div style={{ fontFamily: FONT_CJK, fontSize: fs(v2, FONT_SIZE.sm), fontWeight: 600, color: COLORS.textMuted }}>
        {children}
      </div>
    );
  }
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 9 }}>
      <span
        style={{
          width: 3, height: 12, borderRadius: RADIUS.sm, background: color ?? COLORS.accent,
        }}
      />
      <span
        style={{
          fontFamily: FONT_DATA, fontSize: fs(v2, FONT_SIZE.sm), letterSpacing: "1.5px",
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
  const v2 = useMonitorV2();
  // v2：框由 MonitorCardFrame 畫，這層只排版
  if (v2) {
    return <div style={{ display: "flex", flexDirection: "column", minWidth: 0, ...style, border: undefined, background: undefined, padding: 0, borderRadius: undefined }}>{children}</div>;
  }
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

import { useEffect, useMemo, useState, type MouseEvent as ReactMouseEvent } from "react";
import { COLORS, FONT_CJK, FONT_DATA } from "../intelTokens";
import { RADIUS, FONT_SIZE } from "../../../styles/designTokens";
import { SectionLabel } from "./PressureRing";
import {
  fetchFoodPriceDaily, fetchFoodPriceSummary,
  FOOD_LABELS, FOOD_COLORS, FOOD_SCOPE, FOOD_ALERT_HIGH, FOOD_ALERT_LOW,
  type FoodPriceDay, type FoodPriceSummary, type FoodIndicator,
} from "../../../data/intelLoaders";
import { useChartTooltip } from "../../ChartHoverTooltip";

/**
 * 食品價格監測（migration 334/336）
 *
 * 四個指數 2×2：VPI 菜 / FPI 魚 / MPI 豬雞肉 / EPI 蛋，各看近 180 天。
 *
 * ⚠️ 畫面上四件不可省的誠實標註：
 *  1. **異常有方向**：偏高（紅）是民生壓力、偏低（青）是供給過剩／產地崩盤。
 *     兩者都是紅燈但意義相反，用同一顏色會誤導。
 *  2. **看的是偏離常態不是價位高低** —— 10 月青蔥貴是季節常態，5 月青蔥貴才是事件。
 *     所以卡片主指標給「偏離 %」而不是只給指數值。
 *  3. `low_coverage`（當日資料未齊）折線要**斷開**，不可補值連過去。
 *  4. **不含牛肉** —— 台灣國產牛量太小無拍賣機制，農業部無此 API（結構性缺口非漏抓）。
 */

const WINDOW = 180;
const ORDER: FoodIndicator[] = ["VPI", "FPI", "MPI", "EPI"];

interface Props { open: boolean }

export function FoodPriceBoard({ open }: Props) {
  const [days, setDays] = useState<FoodPriceDay[]>([]);
  const [summary, setSummary] = useState<FoodPriceSummary[]>([]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const tick = () => {
      fetchFoodPriceDaily(WINDOW)
        .then((r) => { if (!cancelled) setDays(r); })
        .catch((e) => console.warn("[FoodPriceBoard] daily", e));
      fetchFoodPriceSummary(WINDOW)
        .then((r) => { if (!cancelled) setSummary(r); })
        .catch((e) => console.warn("[FoodPriceBoard] summary", e));
    };
    tick();
    const id = window.setInterval(tick, 60 * 60_000);   // 來源 T+1，一小時一次已遠快於需要
    return () => { cancelled = true; window.clearInterval(id); };
  }, [open]);

  const byIndicator = useMemo(() => {
    const m = new Map<FoodIndicator, FoodPriceDay[]>();
    for (const d of days) {
      const arr = m.get(d.indicator);
      if (arr) arr.push(d); else m.set(d.indicator, [d]);
    }
    return m;
  }, [days]);

  const totalAlerts = summary.reduce((s, x) => s + x.highAlertDays + x.lowAlertDays, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <SectionLabel color="#5fbf6d">食品價格 · FOOD PRICE MONITOR</SectionLabel>
      <div
        style={{
          borderRadius: RADIUS.xl,
          border: `1px solid ${COLORS.panelBorder}`,
          background: "linear-gradient(160deg, rgba(95,191,109,0.06), rgba(255,255,255,0.012))",
          padding: "12px 14px",
          display: "flex", flexDirection: "column", gap: 11,
          // 格高有剩就讓四張卡的走勢圖吃掉（見下方 2×2 grid 的 flex:1），不要留死白
          flex: 1, minHeight: 0,
        }}
      >
        {!summary.length ? (
          <div style={{ fontFamily: FONT_CJK, fontSize: FONT_SIZE.sm, color: COLORS.textFaint, padding: "10px 0" }}>
            資料載入中…
          </div>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9, flex: 1, minHeight: 0 }}>
              {ORDER.map((key) => {
                const s = summary.find((x) => x.indicator === key);
                if (!s) return null;
                return <IndexCell key={key} s={s} series={byIndicator.get(key) ?? []} />;
              })}
            </div>
            <Legend />
            <div style={{ fontSize: FONT_SIZE.xs, color: COLORS.textDim, lineHeight: 1.5 }}>
              農業部批發拍賣成交價 · 每日 T+1 · 基期 2024-2025 = 100 ·
              近 {WINDOW} 天{totalAlerts > 0 ? ` · 期間 ${totalAlerts} 個異常日` : " · 期間無異常日"} ·
              ⚠️ 肉價不含牛（台灣無牛肉交易行情）
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ── 單一指數格 ─────────────────────────────────────────── */

function IndexCell({ s, series }: { s: FoodPriceSummary; series: FoodPriceDay[] }) {
  const color = FOOD_COLORS[s.indicator];
  const dev = s.latestDev;
  // 主指標是「偏離常態」而非價位 —— 價位高低本身不是訊號
  const devColor = dev === null ? COLORS.textFaint
    : dev >= 10 ? FOOD_ALERT_HIGH : dev <= -10 ? FOOD_ALERT_LOW : COLORS.textDefault;
  const stale = s.latestLight === "low_coverage";

  return (
    <div
      style={{
        borderRadius: RADIUS.lg,
        border: `1px solid ${color}33`,
        background: `${color}0d`,
        padding: "8px 9px 7px",
        display: "flex", flexDirection: "column", gap: 5, minWidth: 0, minHeight: 0,
      }}
    >
      {/* 標題列 */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 5, minWidth: 0 }}>
        <span style={{ fontFamily: FONT_CJK, fontSize: 12.5, fontWeight: 700, color: COLORS.textStrong }}>
          {FOOD_LABELS[s.indicator]}
        </span>
        <span style={{ fontFamily: FONT_DATA, fontSize: 8.5, letterSpacing: "0.8px", color, opacity: 0.85 }}>
          {s.indicator}
        </span>
        <StatusDot light={s.latestLight} dev={dev} />
      </div>

      {/* 涵蓋範圍 —— 只給代碼看不出這條線是誰算出來的 */}
      <div
        style={{
          fontFamily: FONT_CJK, fontSize: 8.5, color: COLORS.textFaint,
          marginTop: -3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}
        title={FOOD_SCOPE[s.indicator]}
      >
        {FOOD_SCOPE[s.indicator]}
      </div>

      {/* 主數值：指數 + 偏離 */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
        <span style={{ fontFamily: FONT_DATA, fontSize: 21, fontWeight: 600, color: COLORS.textStrong, lineHeight: 1 }}>
          {s.latestVal.toFixed(1)}
        </span>
        <span style={{ fontFamily: FONT_DATA, fontSize: 11, fontWeight: 600, color: devColor }}>
          {dev === null ? "—" : `${dev > 0 ? "+" : ""}${dev.toFixed(1)}%`}
        </span>
        <span style={{ fontFamily: FONT_CJK, fontSize: 8.5, color: COLORS.textFaint }}>vs 常態</span>
      </div>

      <Sparkline series={series} color={color} />

      {/* 底部：異常天數（方向分離）+ YoY */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 4 }}>
        <div style={{ display: "flex", gap: 5, fontFamily: FONT_DATA, fontSize: 8.5 }}>
          {s.highAlertDays > 0 && (
            <span style={{ color: FOOD_ALERT_HIGH }} title="價格異常偏高的天數（民生壓力）">
              ▲{s.highAlertDays}
            </span>
          )}
          {s.lowAlertDays > 0 && (
            <span style={{ color: FOOD_ALERT_LOW }} title="價格異常偏低的天數（供給過剩／產地崩盤）">
              ▼{s.lowAlertDays}
            </span>
          )}
          {s.highAlertDays === 0 && s.lowAlertDays === 0 && (
            <span style={{ color: COLORS.textFaint }}>無異常日</span>
          )}
          {s.warnDays > 0 && (
            <span style={{ color: COLORS.textDim }} title="黃燈（注意）天數">
              ·{s.warnDays} 注意
            </span>
          )}
        </div>
        <span
          style={{ fontFamily: FONT_DATA, fontSize: 8.5, color: COLORS.textDim }}
          title={`最新 ${s.latestDate}${stale ? "（當日資料未齊，已取前一交易日）" : ""}`}
        >
          {s.yoyPct === null ? "" : `年增 ${s.yoyPct > 0 ? "+" : ""}${s.yoyPct.toFixed(1)}%`}
        </span>
      </div>
    </div>
  );
}

/* ── 燈號圓點 ───────────────────────────────────────────── */

function StatusDot({ light, dev }: { light: FoodPriceSummary["latestLight"]; dev: number | null }) {
  // 紅燈要再看方向：偏高與偏低是相反的事
  const { c, t } =
    light === "red"
      ? (dev !== null && dev < 0
          ? { c: FOOD_ALERT_LOW, t: "異常偏低（供給過剩）" }
          : { c: FOOD_ALERT_HIGH, t: "異常偏高（民生壓力）" })
      : light === "amber" ? { c: "#e0a63c", t: "注意" }
      : light === "low_coverage" ? { c: COLORS.textFaint, t: "當日資料未齊" }
      : { c: "#63b26a", t: "常態" };
  return (
    <span
      title={t}
      style={{
        marginLeft: "auto", width: 7, height: 7, borderRadius: "50%",
        background: c, boxShadow: `0 0 5px ${c}88`, flex: "none",
      }}
    />
  );
}

/* ── 180 天迷你走勢 ─────────────────────────────────────── */

/** viewBox 高度基準（座標系用，非像素） */
const SPARK_H = 52;
/** 走勢圖實際高度。本板是 fit:"content"（父層無固定高）→ flex:1 分不到東西，靠這個值決定。
 *  140px 是實機量過的：180 天資料在這個高度才看得出形狀。 */
const SPARK_MIN_H = 140;

/** "YYYY-MM-DD" → "M/D"（純字串切割，不經 Date 物件，避免時區偏移） */
function fmtTradeDate(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${Number(m)}/${Number(d)}`;
}

/** 異常區段 hover 補充說明 —— 文案對齊 StatusDot／Legend 既有用詞 */
function anomalyNote(light: FoodPriceDay["light"], devPct: number | null): string | undefined {
  switch (light) {
    case "red":
      return (devPct ?? 0) < 0 ? "異常偏低（供給過剩）" : "異常偏高（民生壓力）";
    case "amber":
      return "注意（偏離常態）";
    case "low_coverage":
      return "當日資料未齊";
    default:
      return undefined;
  }
}

function Sparkline({ series, color }: { series: FoodPriceDay[]; color: string }) {
  const tip = useChartTooltip();
  const geom = useMemo(() => {
    const pts = series.filter((d) => Number.isFinite(d.indexVal));
    if (pts.length < 2) return null;
    const vals = pts.map((d) => d.indexVal);
    const mn = Math.min(...vals), mx = Math.max(...vals);
    const rg = mx - mn || 1;
    const x = (i: number) => (i / (pts.length - 1)) * 100;
    const y = (v: number) => SPARK_H - 2 - ((v - mn) / rg) * (SPARK_H - 4);

    // ⚠️ low_coverage 折線斷開，不補值連過去
    let d = "";
    let pen = false;
    pts.forEach((p, i) => {
      if (p.light === "low_coverage") { pen = false; return; }
      d += `${pen ? "L" : "M"}${x(i).toFixed(2)},${y(p.indexVal).toFixed(2)}`;
      pen = true;
    });

    // 異常區段（依方向分色）
    const bands: { x0: number; x1: number; up: boolean }[] = [];
    let run: { i0: number; up: boolean } | null = null;
    pts.forEach((p, i) => {
      const isAlert = p.light === "red";
      const up = (p.devPct ?? 0) >= 0;
      if (isAlert && (!run || run.up !== up)) {
        if (run) bands.push({ x0: x(run.i0), x1: x(i - 1), up: run.up });
        run = { i0: i, up };
      } else if (!isAlert && run) {
        bands.push({ x0: x(run.i0), x1: x(i - 1), up: run.up });
        run = null;
      }
    });
    if (run) bands.push({ x0: x((run as { i0: number }).i0), x1: 100, up: (run as { up: boolean }).up });

    const last = pts[pts.length - 1]!;
    return { d, bands, lastX: x(pts.length - 1), lastY: y(last.indexVal), mn, mx, pts };
  }, [series]);

  if (!geom) {
    return <div style={{ flex: 1, minHeight: SPARK_MIN_H, display: "flex", alignItems: "center", fontFamily: FONT_DATA, fontSize: 8.5, color: COLORS.textGhost }}>資料不足</div>;
  }

  function handleMove(e: ReactMouseEvent<SVGSVGElement>) {
    const pts = geom!.pts;
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width === 0 || pts.length === 0) return;
    const xRatio = (e.clientX - rect.left) / rect.width;
    const i = Math.max(0, Math.min(Math.round(xRatio * (pts.length - 1)), pts.length - 1));
    const p = pts[i]!;
    tip.show(e.clientX, e.clientY, {
      title: fmtTradeDate(p.tradeDate),
      rows: [
        { dot: color, label: "指數", value: p.indexVal.toFixed(1) },
        { label: "偏離常態", value: p.devPct === null ? "—" : `${p.devPct > 0 ? "+" : ""}${p.devPct.toFixed(1)}%` },
      ],
      note: anomalyNote(p.light, p.devPct),
    });
  }

  return (
    // ⚠️ svg 必須絕對定位：帶 viewBox 的 svg 有「內建長寬比」，在 flex 裡會用
    //    寬度×比例算出自己的高度（實測 253px）把整格撐爆。absolute 讓它退出高度計算，
    //    只吃 wrapper 由 flex 分到的高度。
    <div style={{ flex: 1, minHeight: SPARK_MIN_H, position: "relative" }}>
    <svg
      viewBox={`0 0 100 ${SPARK_H}`}
      preserveAspectRatio="none"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block", overflow: "visible" }}
      role="img"
      aria-label={`近 180 天走勢，區間 ${geom.mn.toFixed(0)} 至 ${geom.mx.toFixed(0)}`}
      onMouseMove={handleMove}
      onMouseLeave={tip.hide}
    >
      {/* 異常區段底色：紅=偏高、青=偏低 */}
      {geom.bands.map((b, i) => (
        <rect
          key={i}
          x={b.x0} y={0}
          width={Math.max(b.x1 - b.x0, 0.6)} height={SPARK_H}
          fill={b.up ? FOOD_ALERT_HIGH : FOOD_ALERT_LOW}
          opacity={0.22}
        />
      ))}
      {/* 基期 100 參考線 */}
      <line x1={0} x2={100} y1={SPARK_H - 2} y2={SPARK_H - 2} stroke="rgba(255,255,255,0.10)" strokeWidth={0.5} vectorEffect="non-scaling-stroke" />
      <path d={geom.d} fill="none" stroke={color} strokeWidth={1.4} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={geom.lastX} cy={geom.lastY} r={1.6} fill={color} vectorEffect="non-scaling-stroke" />
    </svg>
    {tip.node}
    </div>
  );
}

/* ── 圖例 ───────────────────────────────────────────────── */

function Legend() {
  const items = [
    { c: FOOD_ALERT_HIGH, label: "異常偏高（民生壓力）" },
    { c: FOOD_ALERT_LOW, label: "異常偏低（供給過剩）" },
    { c: "#e0a63c", label: "注意" },
    { c: "#63b26a", label: "常態" },
  ];
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "3px 11px", alignItems: "center" }}>
      {items.map((it) => (
        <span key={it.label} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <span style={{ width: 8, height: 5, borderRadius: 1.5, background: it.c, flex: "none" }} />
          <span style={{ fontFamily: FONT_CJK, fontSize: 8.5, color: COLORS.textDim }}>{it.label}</span>
        </span>
      ))}
      <span style={{ marginLeft: "auto", fontFamily: FONT_CJK, fontSize: 8.5, color: COLORS.textFaint }}>
        看的是偏離季節常態，不是價位高低
      </span>
    </div>
  );
}

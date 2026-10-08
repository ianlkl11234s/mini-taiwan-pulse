import { useCallback, useMemo, type MouseEvent as ReactMouseEvent } from "react";
import { FONT_CJK, FONT_DATA } from "../intelTokens";
import { RADIUS, FONT_SIZE } from "../../../styles/designTokens";
import { useMonitorV2 } from "./monitorStyle";
import { fs, MF } from "./monitorFont";
import { useMonitorTheme } from "./monitorTheme";
import { MonitorMetric, MonitorNote } from "./MonitorMetric";
import { MON_CHART_H } from "./monitorChart";
import { useMonitorFreshness } from "./monitorFreshness";
import { SectionLabel } from "./PressureRing";
import {
  fetchFoodPriceDaily, fetchFoodPriceSummary,
  FOOD_LABELS, FOOD_COLORS, FOOD_SCOPE, FOOD_ALERT_HIGH, FOOD_ALERT_LOW,
  type FoodPriceDay, type FoodPriceSummary, type FoodIndicator,
} from "../../../data/intelLoaders";
import { useChartTooltip } from "../../ChartHoverTooltip";
import { useMonitorResource } from "../../../hooks/useMonitorResource";
import { MonitorDataStatus } from "./MonitorDataStatus";

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
const EMPTY_FOOD_DAYS: FoodPriceDay[] = [];
const EMPTY_FOOD_SUMMARY: FoodPriceSummary[] = [];

interface Props { open: boolean }

export function FoodPriceBoard({ open }: Props) {
  const theme = useMonitorTheme();
  const v2 = useMonitorV2();
  const loadDays = useCallback(() => fetchFoodPriceDaily(WINDOW), []);
  const loadSummary = useCallback(() => fetchFoodPriceSummary(WINDOW), []);
  const daysQuery = useMonitorResource({ open, queryKey: "food-price-daily", intervalMs: 60 * 60_000, emptyData: EMPTY_FOOD_DAYS, load: loadDays });
  const summaryQuery = useMonitorResource({ open, queryKey: "food-price-summary", intervalMs: 60 * 60_000, emptyData: EMPTY_FOOD_SUMMARY, load: loadSummary });
  const days = daysQuery.data;
  const summary = summaryQuery.data;

  const byIndicator = useMemo(() => {
    const m = new Map<FoodIndicator, FoodPriceDay[]>();
    for (const d of days) {
      const arr = m.get(d.indicator);
      if (arr) arr.push(d); else m.set(d.indicator, [d]);
    }
    return m;
  }, [days]);

  // 異常日數缺值（null）時不加總成 0：v2 不宣稱「期間無異常日」；舊版維持原本 ?? 0
  const alertsKnown = summary.every((x) => x.highAlertDays != null && x.lowAlertDays != null);
  const totalAlerts = summary.reduce((s, x) => s + (x.highAlertDays ?? 0) + (x.lowAlertDays ?? 0), 0);

  /**
   * 資料截止日與落後天數。
   *
   * ⚠️ 為什麼非標不可（2026-08-20 用戶回報「好像沒在更新」的成因）：
   * 指數表 `analytics.food_price_index_daily` 的寫入者是 taipei-gis-analytics 的
   * **手動本機腳本**，沒有任何排程；而 RPC 的視窗錨在 `max(trade_date)` 而不是今天，
   * 所以資料凍住時圖上**仍然是完整 180 點**，看起來只是「平穩」而不是「停更」。
   * 原本 footer 又寫死「每日 T+1」，等於主動宣稱資料是新的 —— 必須改成標出實際截止日。
   * （原始價表 `live.food_price_daily` 是新鮮的，停的只有指數這一段。）
   */
  const latestDate = useMemo(
    () => summary.reduce<string | null>(
      (m, x) => (x.latestDate && (!m || x.latestDate > m) ? x.latestDate : m), null,
    ),
    [summary],
  );
  const staleDays = useMemo(() => {
    if (!latestDate) return null;
    const t = Date.parse(`${latestDate}T00:00:00+08:00`);
    return Number.isNaN(t) ? null : Math.floor((Date.now() - t) / 86_400_000);
  }, [latestDate]);
  // 資料日期（台灣 00:00）；只有日期沒有時間
  const dataMs = useMemo(() => {
    if (!latestDate) return null;
    const t = Date.parse(`${latestDate}T00:00:00+08:00`);
    return Number.isNaN(t) ? null : t;
  }, [latestDate]);

  // v2：資料截止日（MM/DD）與新鮮度送標題列（週期登記在 monitorCardMeta：日批次，>3 天＝過期；T+1 來源、連假可能連休數日）
  const fresh = useMonitorFreshness("foodPriceBoard", {
    timeText: latestDate ? latestDate.slice(5).replace("-", "/") : null,
    dataMs,
  });
  const isStale = fresh.state === "stale" || fresh.state === "stopped";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {!v2 && <SectionLabel color="#5fbf6d">食品價格 · FOOD PRICE MONITOR</SectionLabel>}
      <div
        style={v2 ? {
          display: "flex", flexDirection: "column", gap: 11, flex: 1, minHeight: 0, minWidth: 0,
        } : {
          borderRadius: RADIUS.xl,
          border: `1px solid ${theme.p.panelBorder}`,
          background: "linear-gradient(160deg, rgba(95,191,109,0.06), rgba(255,255,255,0.012))",
          padding: "12px 14px",
          display: "flex", flexDirection: "column", gap: 11,
          // 格高有剩就讓四張卡的走勢圖吃掉（見下方 2×2 grid 的 flex:1），不要留死白
          flex: 1, minHeight: 0,
        }}
      >
        <MonitorDataStatus label="食品價格日序列" query={daysQuery} />
        <MonitorDataStatus label="食品價格摘要" query={summaryQuery} />
        {!summary.length ? (
          <div style={{ fontFamily: FONT_CJK, fontSize: fs(v2, FONT_SIZE.sm), color: theme.p.textFaint, padding: "10px 0" }}>
            {summaryQuery.status === "unknown" ? "資料載入中…" : "尚無食品價格摘要"}
          </div>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9, flex: 1, minHeight: 0 }}>
              {ORDER.map((key) => {
                const s = summary.find((x) => x.indicator === key);
                if (!s) return null;
                return <IndexCell key={key} s={s} series={byIndicator.get(key) ?? []} muted={fresh.muted} />;
              })}
            </div>
            <Legend />
            {v2 && fresh.reason && (
              <MonitorNote tone={fresh.state === "stopped" ? "err" : "warn"}>{fresh.reason}</MonitorNote>
            )}
            <div style={{ fontSize: fs(v2, FONT_SIZE.xs), color: theme.p.textDim, lineHeight: 1.5 }}>
              {latestDate && !(v2 && isStale) && (
                <span style={{ color: isStale ? theme.text("#fbbf24") : theme.p.textMuted, fontWeight: isStale ? 700 : 400 }}>
                  {isStale ? `⚠ 資料截至 ${latestDate}（已 ${staleDays} 天未更新）` : `資料截至 ${latestDate}`}
                  {" · "}
                </span>
              )}
              農業部批發拍賣成交價 · 基期 2024-2025 = 100 ·
              近 {WINDOW} 天{totalAlerts > 0 ? ` · 期間 ${totalAlerts} 個異常日` : alertsKnown || !v2 ? " · 期間無異常日" : ""} ·
              ⚠️ 肉價不含牛（台灣無牛肉交易行情）
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ── 單一指數格 ─────────────────────────────────────────── */

function IndexCell({ s, series, muted }: { s: FoodPriceSummary; series: FoodPriceDay[]; muted: boolean }) {
  const theme = useMonitorTheme();
  const v2 = useMonitorV2();
  const color = FOOD_COLORS[s.indicator];
  const dev = s.latestDev;
  // 主指標是「偏離常態」而非價位 —— 價位高低本身不是訊號
  const devColor = dev === null ? theme.p.textFaint
    : dev >= 10 ? theme.text(FOOD_ALERT_HIGH) : dev <= -10 ? theme.text(FOOD_ALERT_LOW) : theme.p.textDefault;
  const stale = s.latestLight === "low_coverage";
  // 缺值（null）：v2 顯示「—」；舊版維持原本補 0 的畫面
  const latestVal = v2 ? s.latestVal : s.latestVal ?? 0;
  const latestText = latestVal === null ? "—" : latestVal.toFixed(1);
  const hiDays = v2 ? s.highAlertDays : s.highAlertDays ?? 0;
  const loDays = v2 ? s.lowAlertDays : s.lowAlertDays ?? 0;
  const warnDays = v2 ? s.warnDays : s.warnDays ?? 0;

  return (
    <div
      style={v2 ? {
        borderTop: `1px solid ${theme.p.borderSoft}`, paddingTop: 8,
        display: "flex", flexDirection: "column", gap: 5, minWidth: 0, minHeight: 0,
      } : {
        borderRadius: RADIUS.lg,
        border: `1px solid ${theme.fill(color)}33`,
        background: `${theme.fill(color)}0d`,
        padding: "8px 9px 7px",
        display: "flex", flexDirection: "column", gap: 5, minWidth: 0, minHeight: 0,
      }}
    >
      {/* 標題列 */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 5, minWidth: 0 }}>
        <span style={{ fontFamily: FONT_CJK, fontSize: fs(v2, 12.5), fontWeight: 700, color: theme.p.textStrong }}>
          {FOOD_LABELS[s.indicator]}
        </span>
        <span style={{ fontFamily: FONT_DATA, fontSize: fs(v2, 8.5), letterSpacing: "0.8px", color: theme.text(color), opacity: 0.85 }}>
          {s.indicator}
        </span>
        <StatusDot light={s.latestLight} dev={dev} />
      </div>

      {/* 涵蓋範圍 —— 只給代碼看不出這條線是誰算出來的 */}
      <div
        style={{
          fontFamily: FONT_CJK, fontSize: fs(v2, 8.5), color: theme.p.textFaint,
          marginTop: -3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}
        title={FOOD_SCOPE[s.indicator]}
      >
        {FOOD_SCOPE[s.indicator]}
      </div>

      {/* 主數值：指數 + 偏離 */}
      {v2 ? (
        <MonitorMetric
          value={latestText}
          muted={muted}
          delta={
            <>
              <span style={{ color: devColor, fontWeight: 600 }}>
                {dev === null ? "—" : `${dev > 0 ? "+" : ""}${dev.toFixed(1)}%`}
              </span>
              <span style={{ fontFamily: FONT_CJK, fontSize: MF.label, color: theme.p.textFaint, marginLeft: 5 }}>vs 常態</span>
            </>
          }
        />
      ) : (
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
        <span style={{ fontFamily: FONT_DATA, fontSize: fs(v2, 21), fontWeight: 600, color: theme.p.textStrong, lineHeight: 1 }}>
          {latestText}
        </span>
        <span style={{ fontFamily: FONT_DATA, fontSize: fs(v2, 11), fontWeight: 600, color: devColor }}>
          {dev === null ? "—" : `${dev > 0 ? "+" : ""}${dev.toFixed(1)}%`}
        </span>
        <span style={{ fontFamily: FONT_CJK, fontSize: fs(v2, 8.5), color: theme.p.textFaint }}>vs 常態</span>
      </div>
      )}

      <Sparkline series={series} color={color} />

      {/* 底部：異常天數（方向分離）+ YoY */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 4 }}>
        <div style={{ display: "flex", gap: 5, fontFamily: FONT_DATA, fontSize: fs(v2, 8.5) }}>
          {hiDays != null && hiDays > 0 && (
            <span style={{ color: theme.text(FOOD_ALERT_HIGH) }} title="價格異常偏高的天數（民生壓力）">
              ▲{hiDays}
            </span>
          )}
          {loDays != null && loDays > 0 && (
            <span style={{ color: theme.text(FOOD_ALERT_LOW) }} title="價格異常偏低的天數（供給過剩／產地崩盤）">
              ▼{loDays}
            </span>
          )}
          {hiDays === 0 && loDays === 0 && (
            <span style={{ color: theme.p.textFaint }}>無異常日</span>
          )}
          {hiDays == null && loDays == null && (
            <span style={{ color: theme.p.textFaint }}>異常日 —</span>
          )}
          {warnDays != null && warnDays > 0 && (
            <span style={{ color: theme.p.textDim }} title="黃燈（注意）天數">
              ·{warnDays} 注意
            </span>
          )}
        </div>
        <span
          style={{ fontFamily: FONT_DATA, fontSize: fs(v2, 8.5), color: theme.p.textDim }}
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
  const theme = useMonitorTheme();
  // 紅燈要再看方向：偏高與偏低是相反的事
  const { c: c0, t } =
    light === "red"
      ? (dev !== null && dev < 0
          ? { c: FOOD_ALERT_LOW, t: "異常偏低（供給過剩）" }
          : { c: FOOD_ALERT_HIGH, t: "異常偏高（民生壓力）" })
      : light === "amber" ? { c: "#e0a63c", t: "注意" }
      : light === "low_coverage" ? { c: theme.p.textFaint, t: "當日資料未齊" }
      : { c: "#63b26a", t: "常態" };
  const c = theme.fill(c0);
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
  const theme = useMonitorTheme();
  const v2 = useMonitorV2();
  const tip = useChartTooltip();
  const geom = useMemo(() => {
    // indexVal 缺值（null）的日子不畫點（Number(null)=0 會被畫成假低點），但保留日期位置與斷線：
    // slot 是原序列索引，X 軸依 slot 排，缺值日留空、折線不跨接。
    const slotOf = new Map<FoodPriceDay, number>();
    series.forEach((d, i) => slotOf.set(d, i));
    const pts = series.filter((d): d is FoodPriceDay & { indexVal: number } => d.indexVal != null && Number.isFinite(d.indexVal));
    if (pts.length < 2) return null;
    const vals = pts.map((d) => d.indexVal);
    const mn = Math.min(...vals), mx = Math.max(...vals);
    const rg = mx - mn || 1;
    const denom = Math.max(series.length - 1, 1);
    const slot = (i: number) => slotOf.get(pts[i]!)!;
    const x = (i: number) => (slot(i) / denom) * 100;
    const y = (v: number) => SPARK_H - 2 - ((v - mn) / rg) * (SPARK_H - 4);

    // ⚠️ low_coverage 折線斷開，不補值連過去
    let d = "";
    let pen = false;
    pts.forEach((p, i) => {
      if (i > 0 && slot(i) - slot(i - 1) > 1) pen = false; // 中間有缺值日
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
    return {
      d, bands, slots: series.length, slotOf: (q: FoodPriceDay) => slotOf.get(q)!, lastX: x(pts.length - 1), lastY: y(last.indexVal), mn, mx, pts,
      firstDate: pts[0]!.tradeDate, lastDate: last.tradeDate,
    };
  }, [series]);

  const lineC = theme.fill(color);
  if (!geom) {
    return <div style={{ flex: v2 ? "none" : 1, minHeight: v2 ? MON_CHART_H.lg : SPARK_MIN_H, display: "flex", alignItems: "center", fontFamily: FONT_DATA, fontSize: fs(v2, 8.5), color: theme.p.textGhost }}>資料不足</div>;
  }

  function handleMove(e: ReactMouseEvent<SVGSVGElement>) {
    const pts = geom!.pts;
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width === 0 || pts.length === 0) return;
    const xRatio = (e.clientX - rect.left) / rect.width;
    const target = xRatio * Math.max(geom!.slots - 1, 1);
    let p = pts[0]!;
    for (const q of pts) if (Math.abs(geom!.slotOf(q) - target) < Math.abs(geom!.slotOf(p) - target)) p = q;
    tip.show(e.clientX, e.clientY, {
      title: fmtTradeDate(p.tradeDate),
      rows: [
        { dot: lineC, label: "指數", value: p.indexVal.toFixed(1) },
        { label: "偏離常態", value: p.devPct === null ? "—" : `${p.devPct > 0 ? "+" : ""}${p.devPct.toFixed(1)}%` },
      ],
      note: anomalyNote(p.light, p.devPct),
    });
  }

  return (
    // ⚠️ svg 必須絕對定位：帶 viewBox 的 svg 有「內建長寬比」，在 flex 裡會用
    //    寬度×比例算出自己的高度（實測 253px）把整格撐爆。absolute 讓它退出高度計算，
    //    只吃 wrapper 由 flex 分到的高度。
    <>
    <div
      style={v2
        ? { flex: "none", height: MON_CHART_H.lg, position: "relative", marginRight: 4 } // 最新點半徑 3.5，右緣留白免得被卡片裁掉
        : { flex: 1, minHeight: SPARK_MIN_H, position: "relative" }}
    >
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
          fill={theme.fill(b.up ? FOOD_ALERT_HIGH : FOOD_ALERT_LOW)}
          opacity={0.22}
        />
      ))}
      {/* 基期 100 參考線 */}
      <line x1={0} x2={100} y1={SPARK_H - 2} y2={SPARK_H - 2} stroke={theme.neutral(0.1)} strokeWidth={0.5} vectorEffect="non-scaling-stroke" />
      <path d={geom.d} fill="none" stroke={lineC} strokeWidth={1.4} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
      {!v2 && <circle cx={geom.lastX} cy={geom.lastY} r={1.6} fill={lineC} vectorEffect="non-scaling-stroke" />}
    </svg>
    {/* v2 最新點：viewBox 為 none 拉伸，圓點改用 HTML 才不會變橢圓 */}
    {v2 && (
      <span
        style={{
          position: "absolute", width: 7, height: 7, borderRadius: "50%", background: lineC,
          left: `${geom.lastX}%`, top: `${(geom.lastY / SPARK_H) * 100}%`,
          transform: "translate(-50%, -50%)", pointerEvents: "none",
        }}
      />
    )}
    {tip.node}
    </div>
    {v2 && (
      <div
        style={{
          display: "flex", justifyContent: "space-between", fontFamily: FONT_DATA,
          fontSize: MF.cap, color: theme.p.textFaint,
        }}
      >
        <span>{fmtTradeDate(geom.firstDate)}</span>
        <span>{fmtTradeDate(geom.lastDate)}</span>
      </div>
    )}
    </>
  );
}

/* ── 圖例 ───────────────────────────────────────────────── */

function Legend() {
  const theme = useMonitorTheme();
  const v2 = useMonitorV2();
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
          <span style={{ width: 8, height: 5, borderRadius: 1.5, background: theme.fill(it.c), flex: "none" }} />
          <span style={{ fontFamily: FONT_CJK, fontSize: fs(v2, 8.5), color: theme.p.textDim }}>{it.label}</span>
        </span>
      ))}
      <span style={{ marginLeft: "auto", fontFamily: FONT_CJK, fontSize: fs(v2, 8.5), color: theme.p.textFaint }}>
        看的是偏離季節常態，不是價位高低
      </span>
    </div>
  );
}

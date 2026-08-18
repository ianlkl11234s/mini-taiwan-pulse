import { useEffect, useMemo, useState } from "react";
import { COLORS, FONT_CJK, FONT_DATA } from "../intelTokens";
import { RADIUS, FONT_SIZE } from "../../../styles/designTokens";
import { SectionLabel } from "./PressureRing";
import { useChartTooltip, fmtChartValue } from "../../ChartHoverTooltip";
import {
  fetchPlaSeverityDaily, fetchPlaSituationSummary, fetchPlaKindSummary,
  PLA_LEVEL_LABELS, PLA_LEVEL_COLORS, PLA_KIND_LABELS,
  type PlaSeverityDay, type PlaSituationSummary, type PlaKindStat, type PlaLevel,
} from "../../../data/intelLoaders";

/**
 * 共機擾台戰情板（migration 332/333）
 *
 * 取代原 SituationCards 裡的小 PlaCard。核心要回答的是「昨天到底嚴不嚴重」——
 * 用近 120 天滾動百分位而非平均（實測架次中位數只有 5、越線中位數 0，
 * 但長尾到 32/26；平均會系統性低估平靜日）。
 *
 * ⚠️ 畫面上三件不可省的誠實標註：
 *  1. 分級是**相對**的 → 一定要同時給絕對數字與該級距門檻
 *  2. `sorties === null` 是解析失敗，`0` 是真的零架次 → 趨勢圖畫斷點不補 0
 *  3. 機型的混合項次拆不開 → 主指標用「出現天數」，架次要標明是否精確
 */

const WINDOW = 120;

interface Props { open: boolean }

export function PlaBoard({ open }: Props) {
  const [days, setDays] = useState<PlaSeverityDay[]>([]);
  const [summary, setSummary] = useState<PlaSituationSummary | null>(null);
  const [kinds, setKinds] = useState<PlaKindStat[]>([]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const tick = () => {
      fetchPlaSeverityDaily(WINDOW)
        .then((r) => { if (!cancelled) setDays(r); })
        .catch((e) => console.warn("[PlaBoard] severity", e));
      fetchPlaSituationSummary(WINDOW)
        .then((r) => { if (!cancelled) setSummary(r); })
        .catch((e) => console.warn("[PlaBoard] summary", e));
      fetchPlaKindSummary(WINDOW)
        .then((r) => { if (!cancelled) setKinds(r); })
        .catch((e) => console.warn("[PlaBoard] kinds", e));
    };
    tick();
    const id = window.setInterval(tick, 30 * 60_000);
    return () => { cancelled = true; window.clearInterval(id); };
  }, [open]);

  const latest = days.length ? days[days.length - 1]! : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, minHeight: 0 }}>
      <SectionLabel color="#ff6b6b">共機擾台 · PLA SITUATION BOARD</SectionLabel>
      <div
        style={{
          borderRadius: RADIUS.xl,
          border: `1px solid ${COLORS.panelBorder}`,
          background: "linear-gradient(160deg, rgba(239,68,68,0.06), rgba(255,255,255,0.012))",
          padding: "12px 14px",
          display: "flex", flexDirection: "column", gap: 11,
          // 本板走 fit:"content"（見 monitorLayout）：高度由內容決定，不留死白也不格內捲
          flex: 1, minHeight: 0,
        }}
      >
        {!latest || !summary ? (
          <div style={{ fontFamily: FONT_CJK, fontSize: FONT_SIZE.sm, color: COLORS.textFaint, padding: "10px 0" }}>
            資料載入中…
          </div>
        ) : (
          <>
            <SeverityHead day={latest} summary={summary} />
            <TrendRow days={days} summary={summary} />
            <ZoneRow days={days} summary={summary} />
            <KindRow kinds={kinds} summary={summary} />
            <div style={{ fontSize: FONT_SIZE.xs, color: COLORS.textDim, lineHeight: 1.5 }}>
              中共解放軍臺海周邊海、空域動態 · @MoNDefense · 每日 0600 (UTC+8) 截止 ·
              分級為近 {summary.windowDays} 天滾動百分位（相對值，非絕對威脅評估）
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ── 嚴重度頭部 ─────────────────────────────────────────── */

function SeverityHead({ day, summary }: { day: PlaSeverityDay; summary: PlaSituationSummary }) {
  const lv = (day.level ?? 1) as PlaLevel;
  const color = day.level === null ? COLORS.textFaint : PLA_LEVEL_COLORS[lv];
  const label = day.level === null ? "資料未解析" : PLA_LEVEL_LABELS[lv];
  // 分級門檻對應的絕對值 —— 只給「偏高」不給數字等於沒說
  const band =
    lv >= 5 ? `≥ ${summary.sorties.p97} 架次 / ${summary.crossed.p97} 越線`
    : lv === 4 ? `≥ ${summary.sorties.p90} 架次 / ${summary.crossed.p90} 越線`
    : lv === 3 ? `≥ ${summary.sorties.p75} 架次 / ${summary.crossed.p75} 越線`
    : lv === 2 ? `≥ ${summary.sorties.p50} 架次` : `< ${summary.sorties.p50} 架次`;

  return (
    <div style={{ display: "flex", gap: 12, alignItems: "stretch" }}>
      <div
        style={{
          flex: "0 0 128px", borderRadius: RADIUS.lg,
          border: `1px solid ${color}66`, background: `${color}14`,
          padding: "8px 10px", display: "flex", flexDirection: "column", gap: 3,
        }}
      >
        <span style={{ fontFamily: FONT_DATA, fontSize: FONT_SIZE.xs, letterSpacing: "1.5px", color: COLORS.textDim }}>
          SEVERITY
        </span>
        <span style={{ fontFamily: FONT_CJK, fontSize: 22, fontWeight: 700, lineHeight: 1.1, color }}>
          {label}
        </span>
        <span style={{ fontFamily: FONT_DATA, fontSize: 9, color: COLORS.textFaint }}>{band}</span>
        {day.resonance && (
          <span
            style={{
              marginTop: 1, alignSelf: "flex-start", fontFamily: FONT_CJK, fontSize: 9,
              padding: "1px 5px", borderRadius: RADIUS.md,
              background: "rgba(239,68,68,0.2)", border: "1px solid rgba(239,68,68,0.55)", color: "#ff8080",
            }}
          >
            雙軸共振 ↑
          </span>
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontFamily: FONT_DATA, fontSize: 30, fontWeight: 700, lineHeight: 1, color: "#fff" }}>
            {day.sorties ?? "—"}
          </span>
          <span style={{ fontFamily: FONT_CJK, fontSize: FONT_SIZE.base, color: COLORS.textMuted }}>架次</span>
          <span style={{ fontFamily: FONT_DATA, fontSize: 9.5, color: COLORS.textFaint }}>
            {day.reportDate} 0600 ~ {day.periodEnd ?? "—"} 0600
          </span>
        </div>
        <AxisBar label="規模 架次" pct={day.pctSorties} value={day.sorties} unit="架次" />
        <AxisBar label="強度 越中線" pct={day.pctCrossed} value={day.crossedMedian} unit="架次" />
        <div style={{ display: "flex", gap: 14, fontFamily: FONT_DATA, fontSize: FONT_SIZE.sm, color: COLORS.textDim }}>
          <span>共艦 <b style={{ color: COLORS.textDefault }}>{day.planVessels ?? "—"}</b> 艘</span>
          <span>公務船 <b style={{ color: COLORS.textDefault }}>{day.officialShips ?? "—"}</b> 艘</span>
          <span>近 {summary.windowDays} 天 <b style={{ color: COLORS.textDefault }}>{summary.daysCrossed}</b> 天有越線</span>
        </div>
      </div>
    </div>
  );
}

/** 單軸百分位條：同時給百分位與絕對值，避免只看到相對標籤 */
function AxisBar({ label, pct, value, unit }: {
  label: string; pct: number | null; value: number | null; unit: string;
}) {
  const tip = useChartTooltip();
  const p = pct ?? 0;
  const color = p >= 97 ? "#ef4444" : p >= 90 ? "#fb923c" : p >= 75 ? "#fbbf24" : p >= 50 ? "#94a3b8" : "#34d399";
  return (
    <div
      {...tip.bind(() => ({
        title: label,
        rows: [{ dot: color, value: value == null ? "無資料" : fmtChartValue(value, unit) }],
        note: pct == null ? "百分位未知" : `近 ${WINDOW} 天分布第 p${pct}（刻度線：p75／p90）`,
      }))}
      style={{ display: "flex", alignItems: "center", gap: 7 }}
    >
      <span style={{ fontFamily: FONT_CJK, fontSize: 9.5, color: COLORS.textDim, width: 62, flex: "none" }}>
        {label}
      </span>
      <div style={{ flex: 1, height: 7, borderRadius: 3, background: "rgba(255,255,255,0.06)", position: "relative", minWidth: 0 }}>
        <div style={{ width: `${p}%`, height: "100%", borderRadius: 3, background: color }} />
        {/* p75 / p90 刻度 */}
        {[75, 90].map((t) => (
          <div key={t} style={{ position: "absolute", left: `${t}%`, top: -1, bottom: -1, width: 1, background: "rgba(255,255,255,0.25)" }} />
        ))}
      </div>
      <span style={{ fontFamily: FONT_DATA, fontSize: 9.5, color: COLORS.textDefault, width: 66, flex: "none", textAlign: "right" }}>
        {value ?? "—"} {unit} · p{pct ?? "—"}
      </span>
      {tip.node}
    </div>
  );
}

/* ── 120 天趨勢 ─────────────────────────────────────────── */

/** 趨勢圖可選區間。120 根柱子在 w5 欄裡每根只有 ~5px，看不出單日形狀 → 給短區間選項 */
const TREND_WINDOWS = [120, 90, 30, 7] as const;
type TrendWindow = (typeof TREND_WINDOWS)[number];

function TrendRow({ days, summary }: { days: PlaSeverityDay[]; summary: PlaSituationSummary }) {
  const tip = useChartTooltip();
  const [win, setWin] = useState<TrendWindow>(120);
  const shown = useMemo(() => (win >= days.length ? days : days.slice(-win)), [days, win]);

  // ⚠️ 柱高比例用「本區間最大值」而非 120 天最大值 —— 否則選 7D 還是照 32 架次縮放，
  //    平靜的一週全是幾像素高的殘渣，等於沒切。代價是換區間會換 y 軸尺度，
  //    所以下方一定要印出本區間的中位／最高，柱色則維持 120 天分級（跨區間可比）。
  const stats = useMemo(() => {
    const vals = shown
      .map((d) => d.sorties)
      .filter((v): v is number => v !== null)
      .sort((a, b) => a - b);
    return {
      max: vals.length ? vals[vals.length - 1]! : 0,
      p50: vals.length ? vals[Math.floor((vals.length - 1) / 2)]! : 0,
    };
  }, [shown]);
  const max = Math.max(stats.max, 1);

  return (
    // 柱狀圖是本板唯一「越高越好讀」的區塊。190px 是實機量過的值。
    // ⚠️ 必須是 **確定高度**（不能用 flex:1 + minHeight）：柱子高度是 `height: X%`，
    //    百分比只認父層的確定高度。本板是 fit:"content"（整條鏈都沒有固定高），
    //    寫成 flex 的話百分比解不出來 → 柱子全部塌成 0，圖區變全白。
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <RowLabel
        right={
          <div style={{ display: "flex", gap: 3, flex: "none" }}>
            {TREND_WINDOWS.map((w) => {
              const on = w === win;
              return (
                <button
                  key={w}
                  type="button"
                  onClick={() => setWin(w)}
                  aria-pressed={on}
                  title={`趨勢圖看近 ${w} 天（分級仍以近 ${summary.windowDays} 天為基準）`}
                  style={{
                    fontFamily: FONT_DATA, fontSize: 9, letterSpacing: "0.6px",
                    padding: "1px 6px", borderRadius: RADIUS.md, cursor: "pointer",
                    background: on ? "rgba(239,68,68,0.18)" : "transparent",
                    border: `1px solid ${on ? "rgba(239,68,68,0.55)" : COLORS.borderSoft}`,
                    color: on ? "#ff8080" : COLORS.textDim,
                  }}
                >
                  {w}D
                </button>
              );
            })}
          </div>
        }
      >
        {win}D TREND · 架次（柱）／越中線（疊色）· 灰=解析失敗
      </RowLabel>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 1, height: 190, flex: "none" }}>
        {shown.map((d) => {
          // ⚠️ null = 解析失敗，畫成灰色短樁；0 = 真的零架次，畫成 1px 底線
          if (d.sorties === null) {
            return (
              <div
                key={d.reportDate}
                {...tip.bind({ title: d.reportDate, rows: [{ value: "解析失敗" }] })}
                style={{ flex: 1, minWidth: 0, height: "100%", background: "rgba(255,255,255,0.07)", borderRadius: 1 }}
              />
            );
          }
          const h = (d.sorties / max) * 100;
          const ch = d.crossedMedian ? (d.crossedMedian / max) * 100 : 0;
          const lv = (d.level ?? 1) as PlaLevel;
          return (
            <div
              key={d.reportDate}
              {...tip.bind(() => ({
                title: d.reportDate,
                rows: [
                  { dot: PLA_LEVEL_COLORS[lv], label: "架次", value: `${fmtChartValue(d.sorties!, "架次")} (p${d.pctSorties ?? "—"})` },
                  { dot: "rgba(0,0,0,0.42)", label: "越中線", value: d.crossedMedian != null ? `${fmtChartValue(d.crossedMedian, "架次")} (p${d.pctCrossed ?? "—"})` : "—" },
                ],
                note: PLA_LEVEL_LABELS[lv],
              }))}
              style={{ flex: 1, minWidth: 0, height: "100%", display: "flex", flexDirection: "column", justifyContent: "flex-end" }}
            >
              <div style={{ height: `${Math.max(h, d.sorties === 0 ? 1.5 : 3)}%`, background: PLA_LEVEL_COLORS[lv], borderRadius: "1px 1px 0 0", position: "relative" }}>
                {ch > 0 && (
                  <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: `${(ch / Math.max(h, 0.01)) * 100}%`, background: "rgba(0,0,0,0.42)" }} />
                )}
              </div>
            </div>
          );
        })}
        {tip.node}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontFamily: FONT_DATA, fontSize: 8.5, color: COLORS.textFaint }}>
        <span>{shown[0]?.reportDate ?? summary.dateFrom}</span>
        <span style={{ textAlign: "center" }}>
          本區間 中位 {stats.p50} · 最高 {stats.max} 架次（柱高比例）
          {win !== summary.windowDays && (
            <>
              {" · "}分級基準 {summary.windowDays} 天 p90 {summary.sorties.p90} / 最高 {summary.sorties.max}
            </>
          )}
        </span>
        <span>{shown[shown.length - 1]?.reportDate ?? summary.dateTo}</span>
      </div>
    </div>
  );
}

/* ── 空域方位 ───────────────────────────────────────────── */

const ZONES = [
  { key: "southwest", label: "西南" },
  { key: "north", label: "北部" },
  { key: "east", label: "東部" },
  { key: "central", label: "中部" },
] as const;

function ZoneRow({ days, summary }: { days: PlaSeverityDay[]; summary: PlaSituationSummary }) {
  const tip = useChartTooltip();
  const latest = days.length ? days[days.length - 1]! : null;
  const maxDays = Math.max(...ZONES.map((z) => summary.zones[z.key]), 1);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <RowLabel>
        空域方位 · 近 {summary.windowDays} 天進入天數（● = 昨日進入）
      </RowLabel>
      {/* 單欄：條長度是這裡唯一的比較基準，兩欄會把條腰斬到看不出差距 */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "5px" }}>
        {ZONES.map((z) => {
          const n = summary.zones[z.key];
          const pct = Math.round((n / summary.daysTotal) * 100);
          const on = latest?.adiz[z.key] ?? false;
          // 少見 = 異常訊號（實測中部只有 19/120 天）
          const rare = pct <= 20;
          const color = rare ? "#a78bfa" : "#60a5fa";
          return (
            <div
              key={z.key}
              {...tip.bind(() => ({
                title: z.label,
                rows: [{ dot: color, value: `${fmtChartValue(n, "天")}（${pct}%）` }],
                note: `${on ? "昨日進入" : "昨日未進入"}${rare ? " · 少見（≤20%）" : ""}`,
              }))}
              style={{ display: "flex", alignItems: "center", gap: 6 }}
            >
              <span style={{ fontFamily: FONT_CJK, fontSize: 10, width: 30, flex: "none", color: on ? "#ff8080" : COLORS.textDim, fontWeight: on ? 700 : 400 }}>
                {on ? "●" : "○"}{z.label}
              </span>
              <div style={{ flex: 1, height: 6, borderRadius: 3, background: "rgba(255,255,255,0.06)", minWidth: 0 }}>
                <div style={{ width: `${(n / maxDays) * 100}%`, height: "100%", borderRadius: 3, background: color }} />
              </div>
              <span style={{ fontFamily: FONT_DATA, fontSize: 9, color: COLORS.textFaint, width: 54, flex: "none", textAlign: "right" }}>
                {n} 天 {pct}%
              </span>
            </div>
          );
        })}
      </div>
      {tip.node}
    </div>
  );
}

/* ── 侵擾方式（機型）────────────────────────────────────── */

function KindRow({ kinds, summary }: { kinds: PlaKindStat[]; summary: PlaSituationSummary }) {
  const tip = useChartTooltip();
  const shown = useMemo(() => kinds.filter((k) => k.days > 0).slice(0, 6), [kinds]);
  if (!shown.length) return null;
  const maxDays = Math.max(...shown.map((k) => k.days), 1);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <RowLabel>
        侵擾方式 · 近 {summary.windowDays} 天出動天數（機型僅存在於航跡圖表格）
      </RowLabel>
      {/* 單欄，理由同 ZoneRow */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "5px" }}>
        {shown.map((k) => {
          const rare = k.days / summary.daysTotal <= 0.15;
          // 混合項次拆不開 → 只有 sortiesExact 是精確的，標一個記號說明
          const mixed = k.itemsTotal > k.itemsSingle;
          const color = rare ? "#a78bfa" : "#34d399";
          const label = PLA_KIND_LABELS[k.kind] ?? k.kind;
          // 項次精確度說明。原本掛在右側「N 天 *」文字的原生 title 上，
          // 但那塊 <span> 落在整列的 tip.bind() 熱區內，hover 會跟自訂浮層疊加跳兩個提示。
          // 併進 note 一起走同一個浮層（原生 title 移除）。
          const itemsNote = mixed
            ? `${k.itemsSingle}/${k.itemsTotal} 個項次是單一機型（架次精確 ${k.sortiesExact}）；其餘為多機型合併計數，各自架次不可拆`
            : `全部 ${k.itemsTotal} 個項次皆單一機型，架次精確`;
          return (
            <div
              key={k.kind}
              {...tip.bind(() => ({
                title: label,
                rows: [{ dot: color, value: fmtChartValue(k.days, "天") }],
                note: `占 ${Math.round((k.days / summary.daysTotal) * 100)}% 天數${rare ? " · 少見" : ""} · ${itemsNote}`,
              }))}
              style={{ display: "flex", alignItems: "center", gap: 6 }}
            >
              <span style={{ fontFamily: FONT_CJK, fontSize: 10, width: 44, flex: "none", color: rare ? "#c4b5fd" : COLORS.textDim }}>
                {label}
              </span>
              <div style={{ flex: 1, height: 6, borderRadius: 3, background: "rgba(255,255,255,0.06)", minWidth: 0 }}>
                <div style={{ width: `${(k.days / maxDays) * 100}%`, height: "100%", borderRadius: 3, background: color }} />
              </div>
              <span
                style={{ fontFamily: FONT_DATA, fontSize: 9, color: COLORS.textFaint, width: 62, flex: "none", textAlign: "right" }}
              >
                {k.days} 天{mixed ? " *" : ""}
              </span>
            </div>
          );
        })}
      </div>
      <span style={{ fontSize: 8.5, color: COLORS.textFaint }}>
        * 該機型有部分項次與其他機型合併計數，架次不可拆；「出動天數」不受影響、為精確值
      </span>
      {tip.node}
    </div>
  );
}

function RowLabel({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
      <span style={{ fontFamily: FONT_DATA, fontSize: FONT_SIZE.xs, letterSpacing: "1.1px", color: COLORS.textDim, whiteSpace: "nowrap" }}>
        {children}
      </span>
      <div style={{ flex: 1, height: 1, background: COLORS.borderSoft }} />
      {right}
    </div>
  );
}

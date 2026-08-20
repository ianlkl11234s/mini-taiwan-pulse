import { useMemo, useState } from "react";
import { COLORS, FONT_CJK, FONT_DATA } from "../intelTokens";
import { RADIUS, FONT_SIZE } from "../../../styles/designTokens";
import { SectionLabel } from "./PressureRing";
import { TimeseriesSparkline, type SparklinePoint } from "../../TimeseriesSparkline";

export interface PrisonDay {
  observed_date: string;
  total_inmates: number | null;
  male_inmates: number | null;
  female_inmates: number | null;
  approved_capacity: number | null;
  over_capacity_pct: number | null;
  new_in_count: number | null;
  new_out_count: number | null;
}

/** 趨勢視窗（天）。RPC 一次撈 365 天，切窗純前端 */
const WINDOWS = [90, 365] as const;
type WindowDays = (typeof WINDOWS)[number];
const WINDOW_LABEL: Record<WindowDays, string> = { 90: "90D", 365: "1Y" };

/** 幾天沒更新開始標警示。上游是每日檔，連假也不該斷到一週 */
const STALE_WARN_DAYS = 7;

interface Props {
  /** 最新一筆（= rows[0]，RPC 已按日期新到舊排序） */
  latest: PrisonDay | null;
  /**
   * 完整視窗序列（新到舊）。給趨勢圖用。
   *
   * ⚠️ 2026-08-20 起：DB 現況只有 2026-05-15 一筆 —— 上游法務部矯正署
   * `prisonmuseum/today.xml` 自 2026-05-16 起就沒再被重寫過（HTTP Last-Modified 佐證），
   * collector 每天照跑、只是 upsert 同一天。所以這條序列可能只有 1 點，
   * 元件必須自己處理「畫不出趨勢」的情況，不能假設一定有序列。
   */
  series?: PrisonDay[];
}

function fmt(v: number | null | undefined): string {
  if (v == null) return "—";
  return v.toLocaleString("zh-TW");
}

export function PrisonCard({ latest, series = [] }: Props) {
  const [windowDays, setWindowDays] = useState<WindowDays>(365);
  const total = latest?.total_inmates ?? null;
  const cap = latest?.approved_capacity ?? null;
  const overPct = latest?.over_capacity_pct ?? null;
  const isOver = overPct != null && Number(overPct) > 0;

  /** 資料落後天數（以最新 observed_date 對今天算，不是 collected_at —— 見 series 註解） */
  const staleDays = useMemo(() => {
    if (!latest?.observed_date) return null;
    const t = Date.parse(`${latest.observed_date}T00:00:00+08:00`);
    if (Number.isNaN(t)) return null;
    return Math.floor((Date.now() - t) / 86_400_000);
  }, [latest?.observed_date]);
  const isStale = staleDays != null && staleDays > STALE_WARN_DAYS;

  // 停更時燈號一律轉灰：紅／綠是在講「今天超不超收」，資料三個月沒動還亮綠燈就是說謊
  const dotColor = isStale ? COLORS.textDim : isOver ? "#ef4444" : "#10b981";

  /** 在監總數趨勢（舊→新）。RPC 給的是新到舊，畫圖要反過來 */
  const trend: SparklinePoint[] = useMemo(() => {
    const cutoff = Date.now() - windowDays * 86_400_000;
    return series
      .filter((d) => d.total_inmates != null && Date.parse(`${d.observed_date}T00:00:00+08:00`) >= cutoff)
      .map((d) => ({ t: Date.parse(`${d.observed_date}T00:00:00+08:00`) / 1000, v: Number(d.total_inmates) }))
      .sort((a, b) => a.t - b.t);
  }, [series, windowDays]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <SectionLabel color={COLORS.accent}>司法矯正 · INMATES</SectionLabel>
      <div
        style={{
          borderRadius: RADIUS.xl,
          border: `1px solid ${COLORS.panelBorder}`,
          background: "linear-gradient(160deg, rgba(124,58,237,0.06), rgba(255,255,255,0.012))",
          padding: "12px 14px",
          display: "flex", flexDirection: "column", gap: 8,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{
            width: 11, height: 11, borderRadius: RADIUS.full, background: dotColor,
            boxShadow: `0 0 7px ${dotColor}`, flexShrink: 0,
          }} />
          <span style={{ fontFamily: FONT_CJK, fontSize: FONT_SIZE.md, fontWeight: 700, color: COLORS.textStrong }}>
            {latest ? `全國在監 (${latest.observed_date})` : "全國在監（資料載入中）"}
          </span>
        </div>
        {latest && (
          <>
            <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
              <div>
                <span style={{ fontFamily: FONT_DATA, fontSize: FONT_SIZE.xxl, fontWeight: 700, color: COLORS.textStrong }}>
                  {fmt(total)}
                </span>
                <span style={{ fontSize: FONT_SIZE.sm, color: COLORS.textMuted, marginLeft: 4 }}>人</span>
              </div>
              <div style={{ fontSize: FONT_SIZE.sm, color: COLORS.textMuted }}>
                男 {fmt(latest.male_inmates)} / 女 {fmt(latest.female_inmates)}
              </div>
            </div>
            <div style={{ fontSize: FONT_SIZE.xs, color: COLORS.textMuted, display: "flex", gap: 12, flexWrap: "wrap" }}>
              <span>核定容額 {fmt(cap)}</span>
              <span style={{ color: isOver ? "#fb7185" : COLORS.textMuted }}>
                超收率 {overPct == null ? "—" : `${Number(overPct).toFixed(2)}%`}
              </span>
              <span>當日入 {fmt(latest.new_in_count)} / 出 {fmt(latest.new_out_count)}</span>
            </div>
          </>
        )}
        {/* 趨勢：> 1 點才畫得出線。只有 1 點時直說原因，不要留一塊空圖區裝忙 */}
        {trend.length > 1 ? (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ fontSize: FONT_SIZE.xs, color: COLORS.textDim, marginRight: "auto" }}>
                在監總數趨勢
              </span>
              {WINDOWS.map((w) => (
                <button
                  key={w}
                  onClick={() => setWindowDays(w)}
                  style={{
                    fontFamily: FONT_DATA, fontSize: FONT_SIZE.xs,
                    padding: "2px 7px", borderRadius: RADIUS.sm, cursor: "pointer",
                    background: w === windowDays ? COLORS.accentFaint : "transparent",
                    color: w === windowDays ? COLORS.textStrong : COLORS.textDim,
                    border: `1px solid ${w === windowDays ? COLORS.borderStrong : COLORS.borderSoft}`,
                  }}
                >
                  {WINDOW_LABEL[w]}
                </button>
              ))}
            </div>
            {/* gapSec 3 天：上游本來就有整段缺日（2026-02~03 就斷過 53 天），
                跨過缺口硬連成一條直線會把「沒資料」畫成「數字很平穩」 */}
            <TimeseriesSparkline
              data={trend}
              unit="人"
              lineColor="#a78bfa"
              height={64}
              gapSec={3 * 86400}
              showTooltip
              tooltipDateFormat="date"
              seriesLabel="在監人數"
              compactYAxis
            />
          </>
        ) : (
          <div style={{ fontSize: FONT_SIZE.xs, color: COLORS.textDim }}>
            趨勢待回補：資料庫目前只有 {series.length || 1} 天
          </div>
        )}
        <div style={{ fontSize: FONT_SIZE.xs, color: isStale ? "#fbbf24" : COLORS.textDim }}>
          {isStale
            ? `⚠ 上游已 ${staleDays} 天未更新 · 法務部矯正署 prisonmuseum 每日 XML`
            : "來源：法務部矯正署 prisonmuseum 每日 XML"}
        </div>
      </div>
    </div>
  );
}

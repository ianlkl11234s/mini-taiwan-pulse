import { useCallback, useMemo, useState } from "react";
import { COLORS, FONT_CJK, FONT_DATA } from "../intelTokens";
import { RADIUS, FONT_SIZE } from "../../../styles/designTokens";
import { SectionLabel } from "./PressureRing";
import { MONITOR_DENSE_CARD_ZOOM } from "./monitorLayout";
import { useChartTooltip, fmtChartValue } from "../../ChartHoverTooltip";
import {
  fetchPlaSeverityDaily, fetchPlaSituationSummary, fetchPlaKindSummary,
  PLA_LEVEL_LABELS, PLA_LEVEL_COLORS, PLA_KIND_LABELS,
  toStrictPlaSummary, toStrictPlaKind,
  type PlaSeverityDay, type PlaSituationSummary, type PlaSituationSummaryStrict,
  type PlaKindStat, type PlaKindStatStrict, type PlaLevel,
} from "../../../data/intelLoaders";
import { useMonitorResource } from "../../../hooks/useMonitorResource";
import { MonitorDataStatus } from "./MonitorDataStatus";
import { useMonitorV2 } from "./monitorStyle";
import { fs } from "./monitorFont";
import { useMonitorTheme, type MonitorTheme } from "./monitorTheme";
import { useMonitorFreshness, type MonitorFreshness } from "./monitorFreshness";
import { HazardTrendBars, fillSlot, type HazardBar } from "./HazardTrendBars";
import { useLocale, type LocaleSnapshot } from "../../../state/localeStore";
import { enumLabel } from "../../../i18n/dataText";
import type { MessageKey } from "../../../i18n/keys";
import { MonitorMetric, MonitorSub, MonitorNote, MonitorRows } from "./MonitorMetric";
import { MF } from "./monitorFont";

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

/** 分級／機型的中文標籤（intelLoaders 的中文正本）→ 目前語系 */
const levelText = (lv: PlaLevel, i18n: LocaleSnapshot): string => enumLabel("monitorPlaLevel", lv, PLA_LEVEL_LABELS[lv], i18n);
const kindText = (kind: string, i18n: LocaleSnapshot): string => enumLabel("monitorPlaKind", kind, PLA_KIND_LABELS[kind] ?? kind, i18n);
const EMPTY_PLA_DAYS: PlaSeverityDay[] = [];
const EMPTY_PLA_KINDS: PlaKindStat[] = [];

interface Props { open: boolean }

export function PlaBoard({ open }: Props) {
  const loadDays = useCallback(() => fetchPlaSeverityDaily(WINDOW), []);
  const loadSummary = useCallback(() => fetchPlaSituationSummary(WINDOW), []);
  const loadKinds = useCallback(() => fetchPlaKindSummary(WINDOW), []);
  const i18n = useLocale();
  const { t } = i18n;
  const daysQuery = useMonitorResource({ open, queryKey: "pla-severity", intervalMs: 30 * 60_000, emptyData: EMPTY_PLA_DAYS, load: loadDays });
  const summaryQuery = useMonitorResource({ open, queryKey: "pla-summary", intervalMs: 30 * 60_000, emptyData: null as PlaSituationSummary | null, load: loadSummary });
  const kindsQuery = useMonitorResource({ open, queryKey: "pla-kinds", intervalMs: 30 * 60_000, emptyData: EMPTY_PLA_KINDS, load: loadKinds });
  const days = daysQuery.data;
  const summary = summaryQuery.data;
  const kinds = kindsQuery.data;

  const latest = days.length ? days[days.length - 1]! : null;
  const v2 = useMonitorV2();
  // 資料期別＝最新 report_date（YYYY-MM-DD → MM/DD）；資料日期＝該日台灣 00:00（日報，>2 天過期）
  const latestMs = latest ? Date.parse(`${latest.reportDate}T00:00:00+08:00`) : NaN;
  const fresh = useMonitorFreshness("plaBoard", {
    timeText: latest ? latest.reportDate.slice(5).replace("-", "/") : null,
    dataMs: Number.isNaN(latestMs) ? null : latestMs,
  });
  // 舊版畫面沿用原本「缺值補 0」的輸出；v2 用保留 null 的原值
  const summaryS = useMemo(() => (summary ? toStrictPlaSummary(summary) : null), [summary]);
  const kindsS = useMemo(() => kinds.map(toStrictPlaKind), [kinds]);

  return (
    // zoom：本板內文大量是 8.5~10px 字面值，比其他卡的 FONT_SIZE token 小一截，
    // 疊在 MonitorPanel 的全域縮放之上補齊（見 MONITOR_DENSE_CARD_ZOOM 註解）
    <div style={{ zoom: v2 ? undefined : MONITOR_DENSE_CARD_ZOOM, display: "flex", flexDirection: "column", gap: 10, minHeight: 0 }}>
      {!v2 && <SectionLabel color="#ff6b6b">{t("monitor.pla.legacyHeader")}</SectionLabel>}
      <div
        style={{
          ...(v2 ? {} : {
            borderRadius: RADIUS.xl,
            border: `1px solid ${COLORS.panelBorder}`,
            background: "linear-gradient(160deg, rgba(239,68,68,0.06), rgba(255,255,255,0.012))",
            padding: "12px 14px",
          }),
          display: "flex", flexDirection: "column", gap: 11,
          // 本板走 fit:"content"（見 monitorLayout）：高度由內容決定，不留死白也不格內捲
          flex: 1, minHeight: 0,
        }}
      >
        <MonitorDataStatus label={t("monitor.pla.dsDaily")} query={daysQuery} />
        <MonitorDataStatus label={t("monitor.pla.dsSummary")} query={summaryQuery} />
        <MonitorDataStatus label={t("monitor.pla.dsKinds")} query={kindsQuery} />
        {!latest || !summary ? (
          <div style={{ fontFamily: FONT_CJK, fontSize: fs(v2, FONT_SIZE.sm), color: COLORS.textFaint, padding: "10px 0" }}>
            {daysQuery.status === "unknown" || summaryQuery.status === "unknown" ? t("monitor.pla.loading") : t("monitor.pla.empty")}
          </div>
        ) : (
          v2 ? <PlaV2Body days={days} summary={summary} kinds={kinds} fresh={fresh} /> : <>
            <SeverityHead day={latest} summary={summaryS!} />
            <TrendRow days={days} summary={summaryS!} />
            <ZoneRow days={days} summary={summaryS!} />
            <KindRow kinds={kindsS} summary={summaryS!} />
            <div style={{ fontSize: fs(v2, FONT_SIZE.xs), color: COLORS.textDim, lineHeight: 1.5 }}>
              {t("monitor.pla.note", { days: summary.windowDays })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ── 嚴重度頭部 ─────────────────────────────────────────── */

function SeverityHead({ day, summary }: { day: PlaSeverityDay; summary: PlaSituationSummaryStrict }) {
  const v2 = useMonitorV2();
  const i18n = useLocale();
  const { t } = i18n;
  const lv = (day.level ?? 1) as PlaLevel;
  const color = day.level === null ? COLORS.textFaint : PLA_LEVEL_COLORS[lv];
  const label = day.level === null ? t("monitor.pla.unparsed") : levelText(lv, i18n);
  // 分級門檻對應的絕對值 —— 只給「偏高」不給數字等於沒說
  const band =
    lv >= 5 ? t("monitor.pla.bandFull", { sorties: summary.sorties.p97, crossed: summary.crossed.p97 })
    : lv === 4 ? t("monitor.pla.bandFull", { sorties: summary.sorties.p90, crossed: summary.crossed.p90 })
    : lv === 3 ? t("monitor.pla.bandFull", { sorties: summary.sorties.p75, crossed: summary.crossed.p75 })
    : lv === 2 ? t("monitor.pla.bandSorties", { sorties: summary.sorties.p50 }) : t("monitor.pla.bandLow", { sorties: summary.sorties.p50 });

  return (
    <div style={{ display: "flex", gap: 12, alignItems: "stretch" }}>
      <div
        style={{
          flex: v2 ? "0 1 168px" : "0 0 128px", minWidth: v2 ? 0 : undefined, borderRadius: RADIUS.lg,
          border: `1px solid ${color}66`, background: `${color}14`,
          padding: "8px 10px", display: "flex", flexDirection: "column", gap: 3,
        }}
      >
        <span style={{ fontFamily: FONT_DATA, fontSize: fs(v2, FONT_SIZE.xs), letterSpacing: "1.5px", color: COLORS.textDim }}>
          {v2 ? t("monitor.pla.severity") : "SEVERITY"}
        </span>
        <span style={{ fontFamily: FONT_CJK, fontSize: fs(v2, 22), fontWeight: 700, lineHeight: 1.1, color }}>
          {label}
        </span>
        <span style={{ fontFamily: FONT_DATA, fontSize: fs(v2, 9), color: COLORS.textFaint }}>{band}</span>
        {day.resonance && (
          <span
            style={{
              marginTop: 1, alignSelf: "flex-start", fontFamily: FONT_CJK, fontSize: fs(v2, 9),
              padding: "1px 5px", borderRadius: RADIUS.md,
              background: "rgba(239,68,68,0.2)", border: "1px solid rgba(239,68,68,0.55)", color: "#ff8080",
            }}
          >
            {t("monitor.pla.resonance")}
          </span>
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontFamily: FONT_DATA, fontSize: fs(v2, 30), fontWeight: 700, lineHeight: 1, color: "#fff" }}>
            {day.sorties ?? "—"}
          </span>
          <span style={{ fontFamily: FONT_CJK, fontSize: fs(v2, FONT_SIZE.base), color: COLORS.textMuted }}>{t("monitor.pla.unitSorties")}</span>
          <span style={{ fontFamily: FONT_DATA, fontSize: fs(v2, 9.5), color: COLORS.textFaint }}>
            {day.reportDate} 0600 ~ {day.periodEnd ?? "—"} 0600
          </span>
        </div>
        <AxisBar label={t("monitor.pla.axisScale")} pct={day.pctSorties} value={day.sorties} unit={t("monitor.pla.unitSorties")} />
        <AxisBar label={t("monitor.pla.axisIntensity")} pct={day.pctCrossed} value={day.crossedMedian} unit={t("monitor.pla.unitSorties")} />
        <div style={{ display: "flex", gap: v2 ? "2px 14px" : 14, flexWrap: v2 ? "wrap" : undefined, fontFamily: FONT_DATA, fontSize: fs(v2, FONT_SIZE.sm), color: COLORS.textDim }}>
          <span>{fillSlot(t("monitor.pla.vessels"), <b style={{ color: COLORS.textDefault }}>{day.planVessels ?? "—"}</b>)}</span>
          <span>{fillSlot(t("monitor.pla.officialShips"), <b style={{ color: COLORS.textDefault }}>{day.officialShips ?? "—"}</b>)}</span>
          <span>{fillSlot(t("monitor.pla.daysCrossed", { days: summary.windowDays }), <b style={{ color: COLORS.textDefault }}>{summary.daysCrossed}</b>)}</span>
        </div>
      </div>
    </div>
  );
}

/** 單軸百分位條：同時給百分位與絕對值，避免只看到相對標籤 */
function AxisBar({ label, pct, value, unit }: {
  label: string; pct: number | null; value: number | null; unit: string;
}) {
  const v2 = useMonitorV2();
  const tip = useChartTooltip();
  const { t } = useLocale();
  const p = pct ?? 0;
  const color = p >= 97 ? "#ef4444" : p >= 90 ? "#fb923c" : p >= 75 ? "#fbbf24" : p >= 50 ? "#94a3b8" : "#34d399";
  return (
    <div
      {...tip.bind(() => ({
        title: label,
        rows: [{ dot: color, value: value == null ? t("monitor.pla.noData") : fmtChartValue(value, unit) }],
        note: pct == null ? t("monitor.pla.pctUnknown") : t("monitor.pla.pctNote", { window: WINDOW, pct }),
      }))}
      style={{ display: "flex", alignItems: "center", gap: 7 }}
    >
      <span style={{ fontFamily: FONT_CJK, fontSize: fs(v2, 9.5), color: COLORS.textDim, width: v2 ? 84 : 62, flex: "none" }}>
        {label}
      </span>
      <div style={{ flex: 1, height: 7, borderRadius: 3, background: "rgba(255,255,255,0.06)", position: "relative", minWidth: 0 }}>
        <div style={{ width: `${p}%`, height: "100%", borderRadius: 3, background: color }} />
        {/* p75 / p90 刻度 */}
        {[75, 90].map((t) => (
          <div key={t} style={{ position: "absolute", left: `${t}%`, top: -1, bottom: -1, width: 1, background: "rgba(255,255,255,0.25)" }} />
        ))}
      </div>
      <span style={{ fontFamily: FONT_DATA, fontSize: fs(v2, 9.5), color: COLORS.textDefault, width: v2 ? 112 : 66, flex: "none", textAlign: "right", whiteSpace: v2 ? "nowrap" : undefined }}>
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

function TrendRow({ days, summary }: { days: PlaSeverityDay[]; summary: PlaSituationSummaryStrict }) {
  const tip = useChartTooltip();
  const v2 = useMonitorV2();
  const i18n = useLocale();
  const { t } = i18n;
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
                  title={t("monitor.pla.trendTitle", { w, days: summary.windowDays })}
                  style={{
                    fontFamily: FONT_DATA, fontSize: fs(v2, 9), letterSpacing: "0.6px",
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
        {v2 ? t("monitor.pla.trendRecent", { win }) : `${win}D TREND`} · {t("monitor.pla.trendCaption")}
      </RowLabel>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 1, height: 190, flex: "none" }}>
        {shown.map((d) => {
          // ⚠️ null = 解析失敗，畫成灰色短樁；0 = 真的零架次，畫成 1px 底線
          if (d.sorties === null) {
            return (
              <div
                key={d.reportDate}
                {...tip.bind({ title: d.reportDate, rows: [{ value: t("monitor.pla.parseFail") }] })}
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
                  { dot: PLA_LEVEL_COLORS[lv], label: t("monitor.pla.rowSorties"), value: `${fmtChartValue(d.sorties!, t("monitor.pla.unitSorties"))} (p${d.pctSorties ?? "—"})` },
                  { dot: "rgba(0,0,0,0.42)", label: t("monitor.pla.rowCrossed"), value: d.crossedMedian != null ? `${fmtChartValue(d.crossedMedian, t("monitor.pla.unitSorties"))} (p${d.pctCrossed ?? "—"})` : "—" },
                ],
                note: levelText(lv, i18n),
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
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: v2 ? "wrap" : undefined, fontFamily: FONT_DATA, fontSize: fs(v2, 8.5), color: COLORS.textFaint }}>
        <span>{shown[0]?.reportDate ?? summary.dateFrom}</span>
        <span style={{ textAlign: "center" }}>
          {t("monitor.pla.trendStats", { p50: stats.p50, max: stats.max })}
          {win !== summary.windowDays && (
            <>
              {" · "}{t("monitor.pla.trendBaseline", { days: summary.windowDays, p90: summary.sorties.p90, max: summary.sorties.max })}
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
  { key: "southwest", labelKey: "monitor.pla.zoneSouthwest" },
  { key: "north", labelKey: "monitor.pla.zoneNorth" },
  { key: "east", labelKey: "monitor.pla.zoneEast" },
  { key: "central", labelKey: "monitor.pla.zoneCentral" },
] as const satisfies readonly { key: string; labelKey: MessageKey }[];

function ZoneRow({ days, summary }: { days: PlaSeverityDay[]; summary: PlaSituationSummaryStrict }) {
  const v2 = useMonitorV2();
  const { t } = useLocale();
  const tip = useChartTooltip();
  const latest = days.length ? days[days.length - 1]! : null;
  const maxDays = Math.max(...ZONES.map((z) => summary.zones[z.key]), 1);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <RowLabel>
        {t("monitor.pla.zoneTitle", { days: summary.windowDays })}
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
                title: t(z.labelKey),
                rows: [{ dot: color, value: t("monitor.pla.valuePct", { value: fmtChartValue(n, t("monitor.pla.unitDays")), pct }) }],
                note: `${on ? t("monitor.pla.enteredYesterday") : t("monitor.pla.notEnteredYesterday")}${rare ? ` · ${t("monitor.pla.rareZone")}` : ""}`,
              }))}
              style={{ display: "flex", alignItems: "center", gap: 6 }}
            >
              <span style={{ fontFamily: FONT_CJK, fontSize: fs(v2, 10), width: v2 ? 52 : 30, flex: "none", whiteSpace: v2 ? "nowrap" : undefined, color: on ? "#ff8080" : COLORS.textDim, fontWeight: on ? 700 : 400 }}>
                {on ? "●" : "○"}{t(z.labelKey)}
              </span>
              <div style={{ flex: 1, height: 6, borderRadius: 3, background: "rgba(255,255,255,0.06)", minWidth: 0 }}>
                <div style={{ width: `${(n / maxDays) * 100}%`, height: "100%", borderRadius: 3, background: color }} />
              </div>
              <span style={{ fontFamily: FONT_DATA, fontSize: fs(v2, 9), color: COLORS.textFaint, width: v2 ? 84 : 54, flex: "none", textAlign: "right", whiteSpace: v2 ? "nowrap" : undefined }}>
                {t("monitor.pla.daysPct", { n, pct })}
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

function KindRow({ kinds, summary }: { kinds: PlaKindStatStrict[]; summary: PlaSituationSummaryStrict }) {
  const v2 = useMonitorV2();
  const i18n = useLocale();
  const { t } = i18n;
  const tip = useChartTooltip();
  const shown = useMemo(() => kinds.filter((k) => k.days > 0).slice(0, 6), [kinds]);
  if (!shown.length) return null;
  const maxDays = Math.max(...shown.map((k) => k.days), 1);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <RowLabel>
        {t("monitor.pla.kindTitle", { days: summary.windowDays })}
      </RowLabel>
      {/* 單欄，理由同 ZoneRow */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "5px" }}>
        {shown.map((k) => {
          const rare = k.days / summary.daysTotal <= 0.15;
          // 混合項次拆不開 → 只有 sortiesExact 是精確的，標一個記號說明
          const mixed = k.itemsTotal > k.itemsSingle;
          const color = rare ? "#a78bfa" : "#34d399";
          const label = kindText(k.kind, i18n);
          // 項次精確度說明。原本掛在右側「N 天 *」文字的原生 title 上，
          // 但那塊 <span> 落在整列的 tip.bind() 熱區內，hover 會跟自訂浮層疊加跳兩個提示。
          // 併進 note 一起走同一個浮層（原生 title 移除）。
          const itemsNote = mixed
            ? t("monitor.pla.itemsMixed", { single: k.itemsSingle, total: k.itemsTotal, exact: k.sortiesExact })
            : t("monitor.pla.itemsSingle", { total: k.itemsTotal });
          return (
            <div
              key={k.kind}
              {...tip.bind(() => ({
                title: label,
                rows: [{ dot: color, value: fmtChartValue(k.days, t("monitor.pla.unitDays")) }],
                note: `${t("monitor.pla.kindShare", { pct: Math.round((k.days / summary.daysTotal) * 100) })}${rare ? ` · ${t("monitor.pla.kindRare")}` : ""} · ${itemsNote}`,
              }))}
              style={{ display: "flex", alignItems: "center", gap: 6 }}
            >
              <span style={{ fontFamily: FONT_CJK, fontSize: fs(v2, 10), width: v2 ? 64 : 44, flex: "none", whiteSpace: v2 ? "nowrap" : undefined, color: rare ? "#c4b5fd" : COLORS.textDim }}>
                {label}
              </span>
              <div style={{ flex: 1, height: 6, borderRadius: 3, background: "rgba(255,255,255,0.06)", minWidth: 0 }}>
                <div style={{ width: `${(k.days / maxDays) * 100}%`, height: "100%", borderRadius: 3, background: color }} />
              </div>
              <span
                style={{ fontFamily: FONT_DATA, fontSize: fs(v2, 9), color: COLORS.textFaint, width: v2 ? 84 : 62, flex: "none", textAlign: "right", whiteSpace: v2 ? "nowrap" : undefined }}
              >
                {t("monitor.pla.days", { n: k.days })}{mixed ? " *" : ""}
              </span>
            </div>
          );
        })}
      </div>
      <span style={{ fontSize: fs(v2, 8.5), color: COLORS.textFaint }}>
        {t("monitor.pla.kindFootnote")}
      </span>
      {tip.node}
    </div>
  );
}

function RowLabel({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  const v2 = useMonitorV2();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
      <span style={{ fontFamily: FONT_DATA, fontSize: fs(v2, FONT_SIZE.xs), letterSpacing: "1.1px", color: COLORS.textDim, whiteSpace: v2 ? "normal" : "nowrap", minWidth: 0 }}>
        {children}
      </span>
      <div style={{ flex: 1, height: 1, background: COLORS.borderSoft }} />
      {right}
    </div>
  );
}


/* ── 監看新版（v2）排法：spec §5.35 多指標卡 P3 L-A ───────────── */

/** 柱色盤：index = level - 1（level 1~5 → 平靜…顯著） */
const PLA_BAR_COLORS = ([1, 2, 3, 4, 5] as const).map((l) => PLA_LEVEL_COLORS[l]);
/** v2 柱色盤多一格中性色：level 為 null（解析失敗）時用，不可退回第 1 級色 */
const plaBarTrack = (theme: MonitorTheme) => ({ height: 8, borderRadius: RADIUS.sm, background: theme.p.borderSoft, overflow: "hidden" }) as const;

function PlaV2Body({ days, summary, kinds, fresh }: { days: PlaSeverityDay[]; summary: PlaSituationSummary; kinds: PlaKindStat[]; fresh: MonitorFreshness }) {
  const theme = useMonitorTheme();
  const i18n = useLocale();
  const { t } = i18n;
  const day = days[days.length - 1]!;
  // level 為 null＝該日解析失敗：不上任何級距色、不印級距門檻（不可退回第 1 級「< p50 架次」）
  const lv = day.level;
  const color = lv === null ? theme.p.textFaint : PLA_LEVEL_COLORS[lv];
  const label = lv === null ? t("monitor.pla.unparsed") : levelText(lv, i18n);
  const q = (n: number | null) => n ?? "—";
  const sp = summary.sorties, cr = summary.crossed;
  const band =
    lv === null ? null
    : lv >= 5 ? t("monitor.pla.bandFull", { sorties: q(sp.p97), crossed: q(cr.p97) })
    : lv === 4 ? t("monitor.pla.bandFull", { sorties: q(sp.p90), crossed: q(cr.p90) })
    : lv === 3 ? t("monitor.pla.bandFull", { sorties: q(sp.p75), crossed: q(cr.p75) })
    : lv === 2 ? t("monitor.pla.bandSorties", { sorties: q(sp.p50) }) : t("monitor.pla.bandLow", { sorties: q(sp.p50) });
  const pillStyle = (c: string) => {
    const f = theme.fill(c);
    return {
      fontFamily: FONT_CJK, fontSize: MF.label, padding: "1px 8px", borderRadius: RADIUS.pill,
      background: `${f}22`, border: `1px solid ${f}66`, color: theme.text(c), whiteSpace: "nowrap" as const,
    };
  };
  return (
    <>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "4px 8px" }}>
        <span style={pillStyle(color)}>{label}</span>
        {band && <span style={{ fontFamily: FONT_DATA, fontSize: MF.label, color: theme.p.textDim }}>{band}</span>}
        {day.resonance && <span style={pillStyle(theme.p.statusErr)}>{t("monitor.pla.resonance")}</span>}
      </div>
      <MonitorMetric
        value={day.sorties ?? "—"}
        unit={t("monitor.pla.unitSorties")}
        color={day.sorties === null ? undefined : color}
        muted={fresh.muted}
        delta={day.pctSorties == null ? t("monitor.pla.pctUnknown") : t("monitor.pla.pctRank", { days: summary.windowDays, pct: day.pctSorties })}
      />
      <MonitorSub
        items={[
          t("monitor.pla.crossedLine", { n: day.crossedMedian ?? "—" }),
          t("monitor.pla.vessels", { n: day.planVessels ?? "—" }),
          t("monitor.pla.officialShips", { n: day.officialShips ?? "—" }),
          t("monitor.pla.daysCrossed", { days: summary.windowDays, n: q(summary.daysCrossed) }),
        ]}
      />
      <PlaV2Trend days={days} summary={summary} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "10px 16px", alignItems: "start" }}>
        <PlaV2Zones days={days} summary={summary} />
        <PlaV2Kinds kinds={kinds} summary={summary} />
      </div>
      {fresh.reason && (
        <MonitorNote tone={fresh.state === "stopped" ? "err" : "warn"}>{fresh.reason}</MonitorNote>
      )}
      <MonitorNote>
        {t("monitor.pla.note", { days: summary.windowDays })}
      </MonitorNote>
    </>
  );
}

function PlaV2Trend({ days, summary }: { days: PlaSeverityDay[]; summary: PlaSituationSummary }) {
  const theme = useMonitorTheme();
  const i18n = useLocale();
  const { t } = i18n;
  const [win, setWin] = useState<TrendWindow>(120);
  // 柱色盤：HazardTrendBars 內部已做 theme.fill，這裡傳原色；level 為 null 的灰樁用主題中性色
  const barColors = [...PLA_BAR_COLORS, theme.p.textMuted];
  const crossedColors = [theme.p.accent];
  const shown = useMemo(() => (win >= days.length ? days : days.slice(-win)), [days, win]);
  const bars: HazardBar[] = useMemo(
    () => shown.map((d) => ({
      label: d.reportDate.slice(5).replace("-", "/"),
      key: d.reportDate,
      // null = 解析失敗 → 灰樁；0 = 真的零架次
      value: d.sorties,
      level: d.level === null ? PLA_BAR_COLORS.length : d.level - 1,
      note: d.level === null ? undefined : t("monitor.pla.barNote", { level: levelText(d.level, i18n), ps: d.pctSorties ?? "—", pc: d.pctCrossed ?? "—" }),
    })),
    [shown, i18n],
  );
  // 越中線小柱列：與主圖同一組日期（同柱數＝同一時間軸）；null 灰樁、0 底線；單色
  const crossedBars: HazardBar[] = useMemo(
    () => shown.map((d) => ({
      label: d.reportDate.slice(5).replace("-", "/"),
      key: d.reportDate,
      value: d.crossedMedian,
      level: 0,
    })),
    [shown],
  );
  const crossedDays = useMemo(() => shown.filter((d) => (d.crossedMedian ?? 0) > 0).length, [shown]);
  const stats = useMemo(() => {
    const vals = shown.map((d) => d.sorties).filter((v): v is number => v !== null).sort((a, b) => a - b);
    return { max: vals.length ? vals[vals.length - 1]! : 0, p50: vals.length ? vals[Math.floor((vals.length - 1) / 2)]! : 0 };
  }, [shown]);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontFamily: FONT_CJK, fontSize: MF.label, color: theme.p.textMuted }}>{t("monitor.pla.v2TrendTitle", { win })}</span>
        <div style={{ display: "flex", gap: 3 }}>
          {TREND_WINDOWS.map((w) => {
            const on = w === win;
            return (
              <button
                key={w}
                type="button"
                onClick={() => setWin(w)}
                aria-pressed={on}
                title={t("monitor.pla.trendTitle", { w, days: summary.windowDays })}
                style={{
                  fontFamily: FONT_DATA, fontSize: MF.label, padding: "1px 7px", borderRadius: RADIUS.md, cursor: "pointer",
                  background: on ? theme.p.accentFaint : "transparent",
                  border: `1px solid ${on ? theme.p.borderStrong : theme.p.borderSoft}`,
                  color: on ? theme.p.textStrong : theme.p.textDim,
                }}
              >
                {w}D
              </button>
            );
          })}
        </div>
      </div>
      <HazardTrendBars
        bars={bars}
        levelColors={barColors}
        heightTier="lg"
        unit={t("monitor.pla.unitSorties")}
        footer={t("monitor.pla.v2Footer", { p50: stats.p50, max: stats.max })}
      />
      {/* 越中線：與主圖同容器寬、同柱數、同一把尺（maxValue＝主圖最高架次） */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontFamily: FONT_CJK, fontSize: MF.label, color: theme.p.textMuted }}>{t("monitor.pla.rowCrossed")}</span>
        <span style={{ fontFamily: FONT_CJK, fontSize: MF.label, color: theme.p.textDim, whiteSpace: "nowrap" }}>
          {t("monitor.pla.daysCrossed", { days: shown.length, n: crossedDays })}
        </span>
      </div>
      <HazardTrendBars
        bars={crossedBars}
        levelColors={crossedColors}
        heightTier="mini"
        bare
        unit={t("monitor.pla.unitSorties")}
        maxValue={stats.max}
      />
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "2px 10px", fontSize: MF.label, color: theme.p.textDim }}>
        <span>{t("monitor.pla.legendHeight")}</span>
        <span>{t("monitor.pla.legendColor", { days: summary.windowDays })}</span>
        <span>{t("monitor.pla.legendRow")}</span>
      </div>
    </div>
  );
}

function PlaV2Zones({ days, summary }: { days: PlaSeverityDay[]; summary: PlaSituationSummary }) {
  const theme = useMonitorTheme();
  const tip = useChartTooltip();
  const { t } = useLocale();
  const latest = days[days.length - 1] ?? null;
  const maxDays = Math.max(...ZONES.map((z) => summary.zones[z.key] ?? 0), 1);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
      <span style={{ fontFamily: FONT_CJK, fontSize: MF.label, color: theme.p.textMuted }}>
        {t("monitor.pla.zoneTitleV2", { days: summary.windowDays })}
      </span>
      <MonitorRows
        rows={ZONES.map((z) => {
          const n = summary.zones[z.key];
          const pct = n === null || summary.daysTotal === null || summary.daysTotal === 0 ? null : Math.round((n / summary.daysTotal) * 100);
          const on = latest?.adiz[z.key] ?? false;
          const rare = pct !== null && pct <= 20;
          const color = theme.fill(rare ? theme.p.statusWarn : theme.p.accent);
          return {
            label: <span style={{ whiteSpace: "nowrap", color: on ? theme.p.textStrong : undefined, fontWeight: on ? 700 : 400 }}>{on ? "●" : "○"}{t(z.labelKey)}</span>,
            chart: (
              <div
                {...tip.bind(() => ({
                  title: t(z.labelKey),
                  rows: [{ dot: color, value: n === null ? "—" : t("monitor.pla.valuePct", { value: fmtChartValue(n, t("monitor.pla.unitDays")), pct: pct ?? "—" }) }],
                  note: `${on ? t("monitor.pla.enteredYesterday") : t("monitor.pla.notEnteredYesterday")}${rare ? ` · ${t("monitor.pla.rareZone")}` : ""}`,
                }))}
                style={plaBarTrack(theme)}
              >
                <div style={{ width: `${((n ?? 0) / maxDays) * 100}%`, height: "100%", background: color }} />
              </div>
            ),
            value: n === null ? "—" : pct === null ? t("monitor.pla.days", { n }) : t("monitor.pla.daysPct", { n, pct }),
          };
        })}
      />
      {tip.node}
    </div>
  );
}

function PlaV2Kinds({ kinds, summary }: { kinds: PlaKindStat[]; summary: PlaSituationSummary }) {
  const theme = useMonitorTheme();
  const tip = useChartTooltip();
  const i18n = useLocale();
  const { t } = i18n;
  const shown = useMemo(() => kinds.filter((k) => (k.days ?? 0) > 0).slice(0, 6), [kinds]);
  if (!shown.length) return null;
  const maxDays = Math.max(...shown.map((k) => k.days ?? 0), 1);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
      <span style={{ fontFamily: FONT_CJK, fontSize: MF.label, color: theme.p.textMuted }}>
        {t("monitor.pla.kindTitleV2", { days: summary.windowDays })}
      </span>
      <MonitorRows
        rows={shown.map((k) => {
          const share = k.days === null || !summary.daysTotal ? null : k.days / summary.daysTotal;
          const rare = share !== null && share <= 0.15;
          const mixed = (k.itemsTotal ?? 0) > (k.itemsSingle ?? 0);
          const color = theme.fill(rare ? theme.p.statusWarn : theme.p.accent);
          const name = kindText(k.kind, i18n);
          const itemsNote = k.itemsTotal === null || k.itemsSingle === null
            ? t("monitor.pla.itemsMissing")
            : mixed
              ? t("monitor.pla.itemsMixed", { single: k.itemsSingle, total: k.itemsTotal, exact: k.sortiesExact ?? "—" })
              : t("monitor.pla.itemsSingle", { total: k.itemsTotal });
          return {
            label: <span style={{ whiteSpace: "nowrap" }}>{name}</span>,
            chart: (
              <div
                {...tip.bind(() => ({
                  title: name,
                  rows: [{ dot: color, value: k.days === null ? "—" : fmtChartValue(k.days, t("monitor.pla.unitDays")) }],
                  note: `${share === null ? "" : t("monitor.pla.kindShare", { pct: Math.round(share * 100) })}${rare ? ` · ${t("monitor.pla.kindRare")}` : ""} · ${itemsNote}`,
                }))}
                style={plaBarTrack(theme)}
              >
                <div style={{ width: `${((k.days ?? 0) / maxDays) * 100}%`, height: "100%", background: color }} />
              </div>
            ),
            value: `${t("monitor.pla.days", { n: k.days ?? "—" })}${mixed ? " ＊" : ""}`,
          };
        })}
      />
      {shown.some((k) => (k.itemsTotal ?? 0) > (k.itemsSingle ?? 0)) && (
        <span style={{ fontSize: MF.label, color: theme.p.textDim, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={t("monitor.pla.kindFootnoteTitle")}>
          {t("monitor.pla.kindFootnoteV2")}
        </span>
      )}
      {tip.node}
    </div>
  );
}

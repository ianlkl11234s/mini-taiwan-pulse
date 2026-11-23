// 長期時間條（STANDARD.md §1–§2）：依 manifest `longTerm.kind` 分派畫法，1b 只實作事件點（火災）。
// 狀態在 longTermBarStore（不進 App state）；地圖由各層的驅動 hook 訂閱同一個 store。
import { Pause, Play } from "lucide-react";
import { COLORS, CONTROL, FONT_CJK, FONT_DATA, FONT_SIZE, LIGHT, RADIUS, SPACING } from "../../styles/designTokens";
import { useLocale } from "../../state/localeStore";
import { LAYER_MANIFEST } from "../../data/layerManifest";
import { LONG_TERM_RANGE_SELECT, type LongTermSpec } from "../../data/layerLongTerm";
import { longTermSpecOf } from "../../data/longTermLayers";
import { sumSeries } from "../../data/fireEventSeries";
import { LONG_TERM_HEATMAP_MIN_MONTHS, LONG_TERM_PLAY_SPEEDS, longTermUsesHeatmap } from "../../lib/longTermTime";
import { longTermBarStore, periodsOf, useLongTermBarState, selectionOf } from "../../state/longTermBarStore";
import { LONG_TERM_ADAPTERS, type EventSeriesAdapter } from "./adapters";
import { EventCountChart } from "./EventCountChart";
import "./longTermBar.css";
import { granularityText, layerDisplayName, rangeLabel, yearAxisLabel } from "./longTermText";

/** 長條區高度（不含年份標籤）；整條時間條總高 ≤ 150（STANDARD.md §2 第 10 條） */
const BARS_H = 80;

export function LongTermBar({ layerKey, isDark }: { layerKey: string; isDark: boolean }) {
  const spec = longTermSpecOf(layerKey);
  const adapter = LONG_TERM_ADAPTERS[layerKey];
  if (!spec || !adapter) return null;
  // 依類別分派：其他類別（大量事件、每日數值、分期統計、分期快照）之後在這裡接
  switch (spec.kind) {
    case "event":
      return <EventBar layerKey={layerKey} spec={spec} adapter={adapter} isDark={isDark} />;
    default:
      return null;
  }
}

function EventBar({ layerKey, spec, adapter, isDark }: { layerKey: string; spec: LongTermSpec; adapter: EventSeriesAdapter; isDark: boolean }) {
  const i18n = useLocale();
  const { t, formatNumber } = i18n;
  const series = adapter.useSeries(true);
  const st = useLongTermBarState();
  const [a, b] = selectionOf(st, layerKey);
  const periods = periodsOf(layerKey);
  const g = spec.granularity;
  const allowRange = LONG_TERM_RANGE_SELECT[spec.kind];
  const color = (LAYER_MANIFEST as unknown as Record<string, { color: string }>)[layerKey]?.color ?? (isDark ? COLORS.accent : LIGHT.accent);
  const name = layerDisplayName(layerKey, i18n);

  const text = isDark ? COLORS.textDefault : LIGHT.textDefault;
  const strong = isDark ? COLORS.textStrong : LIGHT.textStrong;
  const muted = isDark ? COLORS.textMuted : LIGHT.textMuted;
  const accent = isDark ? COLORS.accent : LIGHT.accent;
  const danger = isDark ? COLORS.statusErr : LIGHT.statusErr;
  const ctrlBorder = isDark ? CONTROL.border : LIGHT.controlBorder;
  const btn = {
    font: "inherit", fontSize: FONT_SIZE.base, color: text, cursor: "pointer",
    background: isDark ? CONTROL.bg : LIGHT.controlBg,
    border: `1px solid ${ctrlBorder}`, borderRadius: RADIUS.md, padding: "1px 8px",
  } as const;
  const num = { fontFamily: FONT_DATA, fontVariantNumeric: "tabular-nums" } as const;

  const { n, missing, failed } = sumSeries(series, a, b);
  const span = b - a + 1;
  const heat = longTermUsesHeatmap(g, span);
  const cur = series.periodStatus[a];
  const curText = cur === "missing" ? t("longTerm.bar.noData") : cur === "error" ? t("longTerm.bar.loadFailed") : t("longTerm.bar.count", { count: series.counts[a] ?? 0, n: formatNumber(series.counts[a] ?? 0) });
  // 完整摘要（含期數）放 title：標頭寬度有限，可見文字放不下時以 … 收尾
  const summary = [
    t("longTerm.bar.selected", { range: rangeLabel(layerKey, periods, a, b, g, t, i18n.active) }) + (span > 1 ? t("longTerm.bar.span", { count: span }) : ""),
    t("longTerm.bar.count", { count: n, n: formatNumber(n) }),
    missing > 0 ? t("longTerm.bar.missingNote", { count: missing }) : "",
    failed > 0 ? t("longTerm.bar.failedNote", { count: failed }) : "",
  ].join(" ");
  const help = allowRange ? t("longTerm.bar.help") : t("longTerm.bar.helpNoRange");
  const failedYears = series.failedYears.map((y) => yearAxisLabel(layerKey, y, t));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: SPACING.xxs, fontFamily: FONT_CJK, ["--ltb-accent" as string]: accent }}>
      <div style={{ display: "flex", alignItems: "center", gap: SPACING.sm, minHeight: 22 }}>
        <button type="button" className="ltb-focus" aria-label={st.playing ? t("longTerm.bar.pause") : t("longTerm.bar.play")} title={st.playing ? t("longTerm.bar.pause") : t("longTerm.bar.play")}
          onClick={() => (st.playing ? longTermBarStore.pause() : longTermBarStore.play(layerKey))}
          style={{ ...btn, width: 24, height: 22, padding: 0, display: "inline-grid", placeItems: "center" }}>
          {st.playing ? <Pause size={12} fill="currentColor" strokeWidth={0} /> : <Play size={12} fill="currentColor" strokeWidth={0} />}
        </button>
        <span role="radiogroup" aria-label={t("longTerm.bar.speedGroup")} style={{ display: "inline-flex", border: `1px solid ${ctrlBorder}`, borderRadius: RADIUS.md, padding: 1, gap: 1, flexShrink: 0 }}>
          {LONG_TERM_PLAY_SPEEDS.map((s) => {
            const on = st.speed === s;
            return (
              <button key={s} type="button" className="ltb-focus" role="radio" aria-checked={on} title={t("longTerm.bar.speedTitle", { seconds: 1 / s })}
                onClick={() => longTermBarStore.setSpeed(s)}
                style={{ font: "inherit", ...num, fontSize: FONT_SIZE.sm, border: "none", borderRadius: RADIUS.sm, padding: "1px 5px", cursor: "pointer",
                  background: on ? (isDark ? COLORS.accentFaint : LIGHT.accentFaint) : "transparent", color: on ? accent : muted }}>
                {`${s}×`}
              </button>
            );
          })}
        </span>
        <span style={{ fontSize: FONT_SIZE.md, fontWeight: 600, color: strong, whiteSpace: "nowrap" }}>
          {t("longTerm.bar.countTitle", { layer: name, granularity: granularityText(g, t) })}
        </span>
        <span role="status" title={summary} style={{ fontSize: FONT_SIZE.base, color: muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>
          {series.status !== "ready" && series.counts.every((v) => v == null) ? t("longTerm.bar.loading") : st.playing ? (
            <>
              {t("longTerm.bar.playing", { period: rangeLabel(layerKey, periods, a, a, g, t, i18n.active) })}{"　"}
              <span style={{ ...num, color: cur === "error" ? danger : strong }}>{curText}</span>
            </>
          ) : (
            <>
              <span style={num}>{rangeLabel(layerKey, periods, a, b, g, t, i18n.active)}</span>
{"　"}
              <span style={{ ...num, color: strong }}>{t("longTerm.bar.count", { count: n, n: formatNumber(n) })}</span>
              {missing > 0 ? t("longTerm.bar.missingNote", { count: missing }) : ""}
              {failed > 0 ? <span style={{ color: danger }}>{t("longTerm.bar.failedNote", { count: failed })}</span> : null}
            </>
          )}
        </span>
        <span style={{ flex: 1 }} />
        {heat && (
          <span title={t("longTerm.bar.heatmapTitle", { months: LONG_TERM_HEATMAP_MIN_MONTHS })}
            style={{ fontSize: FONT_SIZE.sm, color: accent, border: `1px solid ${accent}`, borderRadius: RADIUS.pill, padding: "0 6px", whiteSpace: "nowrap" }}>
            {t("longTerm.bar.heatmap")}
          </span>
        )}
        <button type="button" className="ltb-focus" style={{ ...btn, whiteSpace: "nowrap" }} onClick={() => longTermBarStore.selectLatest(layerKey)}>{t("longTerm.bar.latest")}</button>
        <span title={help} aria-label={help} role="note" tabIndex={0} className="ltb-focus"
          style={{ ...btn, cursor: "help", width: 20, height: 20, padding: 0, display: "inline-grid", placeItems: "center", borderRadius: RADIUS.full, color: muted }}>?</span>
      </div>
      {series.failedYears.length > 0 && (
        <div role="alert" style={{ display: "flex", alignItems: "center", gap: SPACING.sm, fontSize: FONT_SIZE.sm, color: danger }}>
          <span style={{ flex: "1 1 auto", minWidth: 0 }}>{t("longTerm.bar.failedBanner", { years: failedYears.join(", ") })}</span>
          {/* 說明文字換行，按鈕不被擠窄（日文「再試行」曾被擠成兩行） */}
          <button type="button" className="ltb-focus" style={{ ...btn, fontSize: FONT_SIZE.sm, color: danger, flexShrink: 0, whiteSpace: "nowrap" }} onClick={adapter.retry}>{t("longTerm.bar.retry")}</button>
        </div>
      )}
      <EventCountChart
        layerKey={layerKey} periods={periods} granularity={g}
        counts={series.counts} periodStatus={series.periodStatus}
        selection={[a, b]} color={color} isDark={isDark} barsHeight={BARS_H}
        onSelect={(r) => longTermBarStore.select(layerKey, r)} allowRange={allowRange}
        ariaLabel={t("longTerm.bar.chartLabel", { layer: name })}
      />
    </div>
  );
}

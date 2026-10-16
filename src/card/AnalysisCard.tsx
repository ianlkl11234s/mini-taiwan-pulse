/**
 * 分析卡（DECISIONS §6 E1 = V2 直式 4:5）：上地圖（含圖例）、下結論＋重點數字＋前 3 名長條
 * ＋來源與時間＋ Pulse 標記。純呈現元件：地圖由呼叫端以 `mapSlot` 注入（卡片頁放 MapLibre，
 * 測試與無地圖情況放 fallback），所以本檔不 import maplibre，可在 node 測試。
 *
 * 卡片頁與 Agent 面板的草稿預覽共用本元件（面板用 `variant="preview"` 縮小）。
 */
import type { ReactNode } from "react";
import { FONT_DATA } from "../styles/designTokens";
import { RankBars, type RankBarItem } from "../research/charts/RankBars";
import { formatVizNumber } from "../research/vizFormat";
import { nullHatchCssGradient } from "../research/vizSpec";
import type { CardPayloadV1 } from "./cardPayload";
import { useLocale } from "../state/localeStore";
import { CARD_THEME, cardOtherColor, classColors, colorForClass, taipeiDate, taipeiDateTime, vizKindForCard } from "./cardStyle";

export type AnalysisCardProps = {
  payload: CardPayloadV1;
  mapSlot: ReactNode;
  /** 已發布卡片：RPC 的 expires_at；草稿預覽：null，改顯示 `expiryNote`。 */
  expiresAt: string | null;
  expiryNote?: string;
  variant?: "page" | "preview";
};

function legendEntries(payload: CardPayloadV1): { label: string; color: string }[] {
  if (payload.kind === "area" && payload.map) {
    const colors = classColors(payload.map.ramp, payload.map.breaks);
    return colors.map((color, index) => ({ color, label: payload.map!.class_labels[index] ?? "" }));
  }
  const points = payload.points;
  if (points?.ramp && points.breaks.length) {
    return classColors(points.ramp, points.breaks).map((color, index) => ({ color, label: index === 0 ? `< ${points.breaks[0]}` : index === points.breaks.length ? `≥ ${points.breaks[index - 1]}` : `${points.breaks[index - 1]}–${points.breaks[index]}` }));
  }
  return [];
}

function statValue(stat: CardPayloadV1["stats"][number]): { number: string; unit: string | null } {
  const kind = vizKindForCard(stat.value_kind);
  const number = formatVizNumber(stat.value, kind);
  return { number, unit: stat.value !== null && stat.unit && kind !== "percent" ? stat.unit : null };
}

/** 把含單一 {name} 佔位的譯文切成前後段，中間放節點（讓數字保留資料字型）。 */
function splitAround(text: (vars: Record<string, string>) => string, name: string, node: ReactNode): ReactNode {
  const MARK = "\u0001";
  const [before = "", after = ""] = text({ [name]: MARK }).split(MARK);
  return <>{before}{node}{after}</>;
}

export function AnalysisCard({ payload, mapSlot, expiresAt, expiryNote, variant = "page" }: AnalysisCardProps) {
  const { t } = useLocale();
  const legend = legendEntries(payload);
  const legendUnit = payload.legend.unit;
  const rampForBars = payload.kind === "area" && payload.map ? classColors(payload.map.ramp, payload.map.breaks) : payload.points ? classColors(payload.points.ramp, payload.points.breaks) : [];
  const valueKind = vizKindForCard(payload.legend.value_kind ?? payload.stats.find(stat => stat.unit === legendUnit)?.value_kind ?? (payload.legend.unit === "%" ? "percent" : "number"));
  const bars: RankBarItem[] = payload.top.slice(0, 3).map((item, index) => ({ id: `${index}:${item.name}`, label: item.name, value: item.value, color: colorForClass(rampForBars, item.class_index) ?? cardOtherColor() }));
  const expiry = taipeiDate(expiresAt);
  const generated = taipeiDateTime(payload.generated_at);
  return <article className={`analysis-card analysis-card--${variant}`} aria-label={t("analysisCard.ariaLabel", { title: payload.title })}>
    <div className="analysis-card__map">
      {mapSlot}
      {(legend.length > 0 || payload.legend.missing_count > 0) && <div className="analysis-card__legend" aria-label={t("analysisCard.legendAria")}>
        <div className="analysis-card__legend-title">{legendUnit ? t("analysisCard.legendWithUnit", { title: payload.legend.title, unit: legendUnit }) : payload.legend.title}</div>
        <ul>
          {legend.map((entry, index) => <li key={index}><span className="analysis-card__swatch" style={{ background: entry.color }} aria-hidden="true" />{entry.label}</li>)}
          {payload.legend.missing_count > 0 && <li><span className="analysis-card__swatch analysis-card__swatch--missing" style={{ background: nullHatchCssGradient(CARD_THEME) }} aria-hidden="true" />{splitAround(vars => t("analysisCard.legendMissing", vars), "count", <span style={{ fontFamily: FONT_DATA }}>{payload.legend.missing_count}</span>)}</li>}
        </ul>
        <div className="analysis-card__legend-method">{payload.legend.method === "quantile" ? t("analysisCard.methodQuantile") : payload.legend.method === "equal" ? t("analysisCard.methodEqual") : t("analysisCard.methodCategory")}</div>
      </div>}
    </div>
    <div className="analysis-card__body">
      <h1 className="analysis-card__title">{payload.title}</h1>
      {payload.data_period && <p className="analysis-card__period">{t("analysisCard.period", { label: payload.data_period.label })}</p>}
      {payload.stats.length > 0 && <dl className="analysis-card__stats">
        {payload.stats.slice(0, 3).map((stat, index) => {
          const value = statValue(stat);
          return <div key={index} className="analysis-card__stat">
            <dt>{stat.label}</dt>
            <dd><span style={{ fontFamily: FONT_DATA }}>{value.number}</span>{value.unit ? <small>{value.unit}</small> : null}</dd>
          </div>;
        })}
      </dl>}
      {bars.length > 0 && <div className="analysis-card__bars">
        <RankBars items={bars} theme={CARD_THEME} valueKind={valueKind} unit={legendUnit} title={t("analysisCard.top3")} maxItems={3} />
      </div>}
      {payload.caveats.length > 0 && <ul className="analysis-card__caveats" aria-label={t("analysisCard.caveatsAria")}>
        {payload.caveats.map((caveat, index) => <li key={index}>{caveat}</li>)}
      </ul>}
      <div className="analysis-card__sources">
        <span className="analysis-card__label">{t("analysisCard.sources")}</span>
        <ul>{payload.sources.map((source, index) => <li key={index}>
          {source.dataset_label}
          {source.publisher || source.data_time ? `（${[source.publisher, source.data_time].filter(Boolean).join("，")}）` : ""}
          {` · ${t("analysisCard.license", { license: source.license })}`}
          {source.attribution ? ` · ${source.attribution}` : ""}
        </li>)}</ul>
      </div>
      <footer className="analysis-card__footer">
        <span>{generated ? splitAround(vars => t("analysisCard.generated", vars), "time", <span style={{ fontFamily: FONT_DATA }}>{generated}</span>) : null}</span>
        <span>{expiry ? splitAround(vars => t("analysisCard.expiry", vars), "date", <span style={{ fontFamily: FONT_DATA }}>{expiry}</span>) : expiryNote ?? null}</span>
        <span className="analysis-card__brand">Mini Taiwan Pulse</span>
      </footer>
    </div>
  </article>;
}

/** 卡片頁沒有卡片可顯示時的單一畫面（無效連結／已失效／暫時無法載入）。 */
export function CardNotice({ title, detail }: { title: string; detail: string }) {
  return <article className="analysis-card analysis-card--notice" role="status">
    <div className="analysis-card__body">
      <h1 className="analysis-card__title">{title}</h1>
      <p className="analysis-card__period">{detail}</p>
      <footer className="analysis-card__footer"><span /><span /><span className="analysis-card__brand">Mini Taiwan Pulse</span></footer>
    </div>
  </article>;
}

export function CardMapFallback({ message }: { message: string }) {
  return <div className="analysis-card__map-fallback" role="status">{message}</div>;
}

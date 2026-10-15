// 日本氣象廳（JMA）即時 4 層圖例（legendKit；色票與地圖 paint、popup 同源，皆 import jmaTypes）。
import { useSyncExternalStore } from "react";
import { LegendNote, LegendNum, LegendRow, LegendTitle, SwatchDot, SwatchGradient, SwatchSquare, useLegendTheme } from "./legendKit";
import {
  JMA_IMAGERY_LAYERS, JMA_IMAGERY_UNCOVERED_COLOR, JMA_INTENSITY_CLASSES, JMA_MISSING_COLOR, jmaImageryProduct, jmaRgb, type JmaImageryLayerKey, type JmaImageryProductId, JMA_QUAKE_LOOKBACK_DAYS, JMA_VOLCANO_LEVELS, JMA_WARNING_LEVELS,
  JMA_ZERO_COLOR, formatJst, jmaAmedasMode, jmaCssGradient,
} from "../../data/jmaTypes";
import { getJmaImageryStatus, subscribeJmaImageryStatus } from "../../data/jmaImageryLoader";
import { getJmaLiveStatus, getLatestJmaWarnings, subscribeJmaLiveStatus, type JmaLiveKey } from "../../data/jmaLiveLoaders";
import { useKeyOverlayParams } from "../../layers/layerParamsAccess";
import { FONT_SIZE } from "../../styles/designTokens";
import type { MessageKey } from "../../i18n/keys";
import { useLocale } from "../../state/localeStore";
import { enumLabel } from "../../i18n/dataText";
import { localizeLayerName } from "../../i18n/layerText";
import { LAYER_MANIFEST } from "../../data/layerManifest";
import type { LayerName } from "../../data/layerManifest";

const ALERT = "#ef4444";

type I18n = ReturnType<typeof useLocale>;

/** 標題與圖層名相同時，借 manifest 名稱在目前語系的顯示名 */
function layerTitle(key: string, i18n: I18n): string {
  const name = (LAYER_MANIFEST as Record<string, { name?: LayerName }>)[key]?.name;
  return name ? localizeLayerName(key, name, i18n).primary : key;
}

function Hollow({ label }: { label: string }) {
  return <LegendRow swatch={<SwatchDot color="transparent" stroke={JMA_MISSING_COLOR} strokeWidth={2} />}>{label}</LegendRow>;
}

/** 載入狀態：成功顯示資料時間（JST）與筆數；0 筆明講「目前無資料」；失敗顯示原因。 */
function LiveStatus({ layerKey, timeLabel, drawnUnit = "legend.jma.unitPlace", noCoordLabel }: {
  layerKey: JmaLiveKey; timeLabel?: string; drawnUnit?: MessageKey; noCoordLabel?: string;
}) {
  const t = useLegendTheme();
  const i18n = useLocale();
  timeLabel ??= i18n.t("legend.jma.timeObserved");
  noCoordLabel ??= i18n.t("legend.jma.noCoord");
  const status = useSyncExternalStore(subscribeJmaLiveStatus, () => getJmaLiveStatus(layerKey));
  if (status.state === "error") {
    return <div role="alert" style={{ marginTop: 4, fontSize: FONT_SIZE.xs, color: ALERT }}>{i18n.t("legend.jma.errorShown", { message: status.message ?? "" })}</div>;
  }
  if (status.state === "idle" || (status.state === "loading" && status.loadedAt == null)) {
    return <div style={{ marginTop: 4, fontSize: FONT_SIZE.xs, color: t.textMuted }}>{i18n.t("legend.jma.loading")}</div>;
  }
  if ((status.rows ?? 0) === 0) {
    return <div style={{ marginTop: 4, fontSize: FONT_SIZE.xs, color: t.textMuted }}>{i18n.t("legend.jma.empty")}</div>;
  }
  return <div style={{ marginTop: 4, fontSize: FONT_SIZE.xs, color: t.textMuted }}>
    {timeLabel} <LegendNum>{formatJst(status.latestAt) || i18n.t("legend.jma.none")}</LegendNum>{i18n.t("legend.jma.drawn")} <LegendNum>{i18n.formatNumber(status.drawn ?? 0)}</LegendNum> {i18n.t(drawnUnit, { count: status.drawn ?? 0 })}
    {(status.noCoord ?? 0) > 0 && <>{i18n.t("legend.jma.noCoordSep")}{noCoordLabel} <LegendNum>{i18n.formatNumber(status.noCoord ?? 0)}</LegendNum> {i18n.t("legend.jma.unitRecord", { count: status.noCoord ?? 0 })}</>}
  </div>;
}

export function JmaAmedasLegend() {
  const i18n = useLocale();
  const p = useKeyOverlayParams("jmaAmedas");
  const mode = jmaAmedasMode(p.jmaAmedasModeIdx);
  const first = mode.stops[0]!;
  const last = mode.stops[mode.stops.length - 1]!;
  return <div>
    <LegendTitle zh={i18n.t("legend.jma.amedasTitle", { mode: enumLabel("jmaAmedasMode", mode.value, mode.label, i18n) })} en="アメダス" />
    <SwatchGradient gradient={jmaCssGradient(mode.stops)} labels={[
      <LegendNum key="lo">{`${first.value} ${mode.unit}`}</LegendNum>,
      <LegendNum key="hi">{`≥${last.value} ${mode.unit}`}</LegendNum>,
    ]} />
    {mode.zeroIsDistinct && <LegendRow swatch={<SwatchDot color={JMA_ZERO_COLOR} />}>{i18n.t(mode.value === "snow" ? "legend.jma.zeroSnow" : "legend.jma.zeroRain", { unit: mode.unit })}</LegendRow>}
    <Hollow label={i18n.t("legend.jma.noObservation")} />
    {mode.snowGaugeOnly && <LegendNote>{i18n.t("legend.jma.snowGaugeOnly")}</LegendNote>}
    <LiveStatus layerKey="jmaAmedas" />
    <LegendNote>{i18n.t("legend.jma.amedasNote")}{i18n.t("legend.jma.attribution")}</LegendNote>
  </div>;
}

export function JmaWarningsLegend() {
  const t = useLegendTheme();
  const i18n = useLocale();
  useSyncExternalStore(subscribeJmaLiveStatus, () => getJmaLiveStatus("jmaWarnings"));
  const unmatched = getLatestJmaWarnings()?.unmatched ?? [];
  const names = [...new Set(unmatched.map((r) => r.area_name ?? r.area_code))];
  return <div>
    <LegendTitle zh={layerTitle("jmaWarnings", i18n)} en="気象警報" />
    {JMA_WARNING_LEVELS.map((row) => <LegendRow key={row.value} swatch={<SwatchSquare color={row.color} />}>{enumLabel("jmaWarningLevel", row.value, row.label, i18n)}</LegendRow>)}
    <LiveStatus layerKey="jmaWarnings" timeLabel={i18n.t("legend.jma.timeIssuedAt")} drawnUnit="legend.jma.unitCityArea" noCoordLabel={i18n.t("legend.jma.noCoordNonCity")} />
    {names.length > 0 && <div style={{ marginTop: 2, fontSize: FONT_SIZE.xs, color: t.textMuted }}>
      {i18n.t("legend.jma.unmappedAreas", { names: names.slice(0, 12).join(i18n.t("legend.jma.listSep")) + (names.length > 12 ? i18n.t("legend.jma.andMore", { count: names.length }) : "") })}
    </div>}
    <LegendNote>{i18n.t("legend.jma.warningsNote")}{i18n.t("legend.jma.attribution")}</LegendNote>
  </div>;
}

export function JmaQuakesLegend() {
  const i18n = useLocale();
  return <div>
    <LegendTitle zh={i18n.t("legend.jma.quakesTitle", { days: JMA_QUAKE_LOOKBACK_DAYS })} en="地震情報" />
    {JMA_INTENSITY_CLASSES.map((row) => <LegendRow key={row.value} swatch={<SwatchDot color={row.color} />}>{enumLabel("jmaIntensity", row.value, row.label, i18n)}</LegendRow>)}
    <Hollow label={i18n.t("legend.jma.intensityMissing")} />
    <LiveStatus layerKey="jmaQuakes" timeLabel={i18n.t("legend.jma.timeLatestIssued")} drawnUnit="legend.jma.unitQuake" noCoordLabel={i18n.t("legend.jma.noCoordNoEpicenter")} />
    <LegendNote>{i18n.t("legend.jma.quakesNote")}{i18n.t("legend.jma.attribution")}</LegendNote>
  </div>;
}

export function JmaVolcanoesLegend() {
  const i18n = useLocale();
  return <div>
    <LegendTitle zh={i18n.t("legend.jma.volcanoTitle")} en="火山" />
    {JMA_VOLCANO_LEVELS.map((row) => <LegendRow key={row.value} swatch={<SwatchDot color={row.color} />}>{enumLabel("jmaVolcanoLevel", row.value, row.label, i18n)}</LegendRow>)}
    <LiveStatus layerKey="jmaVolcanoes" timeLabel={i18n.t("legend.jma.timeLatestIssued")} drawnUnit="legend.jma.unitVolcano" />
    <LegendNote>{i18n.t("legend.jma.attribution")}</LegendNote>
  </div>;
}

/** 發布幀影像的載入／涵蓋狀態：顯示中＝解析時刻（JST）；發布時段外＝夜間無資料／季外；沒有可用幀＝「未涵蓋」＋原因。 */
function ImageryStatus({ product }: { product: JmaImageryProductId }) {
  const t = useLegendTheme();
  const i18n = useLocale();
  const status = useSyncExternalStore(subscribeJmaImageryStatus, () => getJmaImageryStatus(product));
  const style = { marginTop: 4, fontSize: FONT_SIZE.xs, color: t.textMuted };
  if (status.state === "error") {
    return <div role="alert" style={{ ...style, color: ALERT }}>{i18n.t("legend.jma.errorShown", { message: status.message ?? "" })}</div>;
  }
  if (status.state === "idle" || status.state === "loading") return <div style={style}>{i18n.t("legend.jma.loading")}</div>;
  if (status.state === "uncovered") {
    // 上游本來就不發的時段：不是缺資料，不叫「未涵蓋」
    if (status.reason === "off_hours") return <div style={style}>{i18n.t("legend.jma.imageryOffHours")}</div>;
    if (status.reason === "off_season") return <div style={style}>{i18n.t("legend.jma.imageryOffSeason")}</div>;
    const reason = status.reason === "stale" ? i18n.t("legend.jma.imageryReason.stale")
      : status.reason === "missing" ? i18n.t("legend.jma.imageryReason.missing")
        : status.reason === "encoding" ? i18n.t("legend.jma.imageryReason.encoding")
          : i18n.t("legend.jma.imageryReason.no_frame");
    return <div style={style}>{i18n.t("legend.jma.imageryUncoveredNow", { reason })}</div>;
  }
  return <div style={style}>{i18n.t("legend.jma.imageryValidTime")} <LegendNum>{formatJst(status.validTimeIso) || i18n.t("legend.jma.none")}</LegendNum></div>;
}

const IMAGERY_NOTES: Record<JmaImageryLayerKey, MessageKey> = {
  jmaSnowDepth: "legend.jma.snowDepthNote",
  jmaRadar: "legend.jma.radarNote",
  jmaRasrf: "legend.jma.rasrfNote",
  jmaRiskLand: "legend.jma.riskNote",
  jmaRiskInund: "legend.jma.riskNote",
  jmaUvIndex: "legend.jma.uvNote",
  jmaSst: "legend.jma.sstNote",
  jmaSeaIce: "legend.jma.seaIceNote",
  jmaHimawari: "legend.jma.himawariNote",
};

/** 發布幀影像圖例（色票＝地圖 raster-color 同源 JMA_IMAGERY_PRODUCTS） */
export function JmaImageryLegend({ layerKey }: { layerKey: JmaImageryLayerKey }) {
  const i18n = useLocale();
  const productId = JMA_IMAGERY_LAYERS[layerKey];
  const spec = jmaImageryProduct(productId);
  const scalar = spec.scalar;
  const gray = spec.gray;
  return <div>
    <LegendTitle zh={layerTitle(layerKey, i18n)} />
    {gray
      ? <SwatchGradient gradient={`linear-gradient(90deg, ${gray.stops.map((s) => s.color).join(", ")})`}
        labels={[i18n.t("legend.jma.himawariWarm"), i18n.t("legend.jma.himawariCold")]} stroke={JMA_MISSING_COLOR} />
      : scalar
      ? <>
        <SwatchGradient gradient={jmaCssGradient(scalar.stops)} labels={[
          `≤${scalar.stops[0]!.value}`, `${(scalar.stops[0]!.value + scalar.stops[scalar.stops.length - 1]!.value) / 2}`,
          `≥${scalar.stops[scalar.stops.length - 1]!.value} ${scalar.unit}`,
        ]} />
        {scalar.zeroColor && <LegendRow swatch={<SwatchSquare color={scalar.zeroColor} stroke={JMA_MISSING_COLOR} />}>{i18n.t("legend.jma.sstIce")}</LegendRow>}
      </>
      : (spec.levels ?? []).map((lv) => <LegendRow key={lv.level} swatch={<SwatchSquare color={jmaRgb(lv.rgb)} />}><LegendNum>{lv.label}</LegendNum></LegendRow>)}
    {/* 灰階雲圖沒有缺測等級（0、255 都是有效灰階），地圖上不會出現未涵蓋灰 */}
    {!gray && <LegendRow swatch={<SwatchSquare color={JMA_IMAGERY_UNCOVERED_COLOR} />}>{i18n.t("legend.jma.imageryUncovered")}</LegendRow>}
    <ImageryStatus product={productId} />
    <LegendNote>{i18n.t(IMAGERY_NOTES[layerKey])}{i18n.t("legend.jma.imageryAttribution")}</LegendNote>
  </div>;
}

export function JmaSnowDepthLegend() {
  return <JmaImageryLegend layerKey="jmaSnowDepth" />;
}

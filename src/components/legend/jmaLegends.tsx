// 日本氣象廳（JMA）即時 4 層圖例（legendKit；色票與地圖 paint、popup 同源，皆 import jmaTypes）。
import { useSyncExternalStore } from "react";
import { LegendNote, LegendNum, LegendRow, LegendTitle, SwatchDot, SwatchGradient, SwatchSquare, useLegendTheme } from "./legendKit";
import {
  JMA_ATTRIBUTION, JMA_INTENSITY_CLASSES, JMA_MISSING_COLOR, JMA_QUAKE_LOOKBACK_DAYS, JMA_VOLCANO_LEVELS, JMA_WARNING_LEVELS,
  JMA_ZERO_COLOR, formatJst, jmaAmedasMode, jmaCssGradient,
} from "../../data/jmaTypes";
import { getJmaLiveStatus, getLatestJmaWarnings, subscribeJmaLiveStatus, type JmaLiveKey } from "../../data/jmaLiveLoaders";
import { useKeyOverlayParams } from "../../layers/layerParamsAccess";
import { FONT_SIZE } from "../../styles/designTokens";

const ALERT = "#ef4444";

function Hollow({ label }: { label: string }) {
  return <LegendRow swatch={<SwatchDot color="transparent" stroke={JMA_MISSING_COLOR} strokeWidth={2} />}>{label}</LegendRow>;
}

/** 載入狀態：成功顯示資料時間（JST）與筆數；0 筆明講「目前無資料」；失敗顯示原因。 */
function LiveStatus({ layerKey, timeLabel = "最新觀測", drawnUnit = "處", noCoordLabel = "無座標未畫" }: {
  layerKey: JmaLiveKey; timeLabel?: string; drawnUnit?: string; noCoordLabel?: string;
}) {
  const t = useLegendTheme();
  const status = useSyncExternalStore(subscribeJmaLiveStatus, () => getJmaLiveStatus(layerKey));
  if (status.state === "error") {
    return <div role="alert" style={{ marginTop: 4, fontSize: FONT_SIZE.xs, color: ALERT }}>地圖未顯示資料：{status.message}</div>;
  }
  if (status.state === "idle" || (status.state === "loading" && status.loadedAt == null)) {
    return <div style={{ marginTop: 4, fontSize: FONT_SIZE.xs, color: t.textMuted }}>載入中…</div>;
  }
  if ((status.rows ?? 0) === 0) {
    return <div style={{ marginTop: 4, fontSize: FONT_SIZE.xs, color: t.textMuted }}>目前沒有資料（上游尚未寫入或此刻無發表）</div>;
  }
  return <div style={{ marginTop: 4, fontSize: FONT_SIZE.xs, color: t.textMuted }}>
    {timeLabel} <LegendNum>{formatJst(status.latestAt) || "無"}</LegendNum>・已畫 <LegendNum>{(status.drawn ?? 0).toLocaleString("zh-TW")}</LegendNum> {drawnUnit}
    {(status.noCoord ?? 0) > 0 && <>；{noCoordLabel} <LegendNum>{(status.noCoord ?? 0).toLocaleString("zh-TW")}</LegendNum> 筆</>}
  </div>;
}

export function JmaAmedasLegend() {
  const p = useKeyOverlayParams("jmaAmedas");
  const mode = jmaAmedasMode(p.jmaAmedasModeIdx);
  const first = mode.stops[0]!;
  const last = mode.stops[mode.stops.length - 1]!;
  return <div>
    <LegendTitle zh={`AMeDAS · ${mode.label}`} en="アメダス" />
    <SwatchGradient gradient={jmaCssGradient(mode.stops)} labels={[
      <LegendNum key="lo">{`${first.value} ${mode.unit}`}</LegendNum>,
      <LegendNum key="hi">{`≥${last.value} ${mode.unit}`}</LegendNum>,
    ]} />
    {mode.zeroIsDistinct && <LegendRow swatch={<SwatchDot color={JMA_ZERO_COLOR} />}>0 {mode.unit}（{mode.value === "snow" ? "無積雪" : "無雨"}）</LegendRow>}
    <Hollow label="無觀測（缺值，不是 0）" />
    {mode.snowGaugeOnly && <LegendNote>積雪模式只畫有積雪計的站。</LegendNote>}
    <LiveStatus layerKey="jmaAmedas" />
    <LegendNote>每 10 分鐘更新；時間為日本時間。{JMA_ATTRIBUTION}</LegendNote>
  </div>;
}

export function JmaWarningsLegend() {
  const t = useLegendTheme();
  useSyncExternalStore(subscribeJmaLiveStatus, () => getJmaLiveStatus("jmaWarnings"));
  const unmatched = getLatestJmaWarnings()?.unmatched ?? [];
  const names = [...new Set(unmatched.map((r) => r.area_name ?? r.area_code))];
  return <div>
    <LegendTitle zh="警報・注意報" en="気象警報" />
    {JMA_WARNING_LEVELS.map((row) => <LegendRow key={row.value} swatch={<SwatchSquare color={row.color} />}>{row.label}</LegendRow>)}
    <LiveStatus layerKey="jmaWarnings" timeLabel="發表時刻" drawnUnit="個市町村區域" noCoordLabel="非市町村層級未上色" />
    {names.length > 0 && <div style={{ marginTop: 2, fontSize: FONT_SIZE.xs, color: t.textMuted }}>
      未上色區域：{names.slice(0, 12).join("、")}{names.length > 12 ? ` 等 ${names.length} 區` : ""}
    </div>}
    <LegendNote>只畫發表中的區域，同區取最高級別；政令市分區（如横浜市北部／南部）整市著色。界線：日本市区町村界。每 5 分鐘更新。{JMA_ATTRIBUTION}</LegendNote>
  </div>;
}

export function JmaQuakesLegend() {
  return <div>
    <LegendTitle zh={`地震（近 ${JMA_QUAKE_LOOKBACK_DAYS} 天）· 最大震度`} en="地震情報" />
    {JMA_INTENSITY_CLASSES.map((row) => <LegendRow key={row.value} swatch={<SwatchDot color={row.color} />}>{row.label}</LegendRow>)}
    <Hollow label="震度或規模未發表" />
    <LiveStatus layerKey="jmaQuakes" timeLabel="最新發表" drawnUnit="個地震" noCoordLabel="無震源座標未畫" />
    <LegendNote>圓越大規模越大；同一地震只顯示最新一報。每 2 分鐘更新。{JMA_ATTRIBUTION}</LegendNote>
  </div>;
}

export function JmaVolcanoesLegend() {
  return <div>
    <LegendTitle zh="火山警戒 · 噴火警戒レベル" en="火山" />
    {JMA_VOLCANO_LEVELS.map((row) => <LegendRow key={row.value} swatch={<SwatchDot color={row.color} />}>{row.label}</LegendRow>)}
    <LiveStatus layerKey="jmaVolcanoes" timeLabel="最新發表" drawnUnit="座火山" />
    <LegendNote>{JMA_ATTRIBUTION}</LegendNote>
  </div>;
}

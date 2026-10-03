// 環境第二波 9 層圖例（legendKit；色票與地圖 paint 同源，皆 import environmentLayerTypes）。
import { useSyncExternalStore } from "react";
import { LegendNote, LegendNum, LegendRow, LegendTitle, SwatchDot, SwatchGradient, SwatchLine, useLegendTheme } from "./legendKit";
import {
  CEMS_STATUSES, CWA_UV_LEVELS, DIOXIN_STATION_STOPS, ENV_ALERT_COLOR, ENV_STALE_COLOR, INCINERATOR_NOX_STOPS,
  NUSC_GAMMA_HIGH_USVH, NUSC_GAMMA_STOPS, OSM_ODBL_ATTRIBUTION, PM25_MANUAL_STOPS, RIVER_RPI_CLASSES, RIVER_RPI_NO_DATA_COLOR, RIVER_RPI_SEGMENT_MODES,
  SEA_WATER_CLASSES, WATER_EFFLUENT_STATUSES, envCssGradient, type EnvGradientStop,
} from "../../data/environmentLayerTypes";
import { getEnvLiveStatus, subscribeEnvLiveStatus, type EnvLiveKey } from "../../data/environmentLiveLoaders";
import { useKeyOverlayParams } from "../../layers/layerParamsAccess";
import { formatTaiwanTime } from "../featureInfo/shared";
import { FONT_SIZE } from "../../styles/designTokens";

function Hollow({ label }: { label: string }) {
  return <LegendRow swatch={<SwatchDot color="transparent" stroke={ENV_STALE_COLOR} strokeWidth={2} />}>{label}</LegendRow>;
}

function Gradient({ stops, unit, digits = 2 }: { stops: readonly EnvGradientStop[]; unit: string; digits?: number }) {
  const first = stops[0]!;
  const last = stops[stops.length - 1]!;
  return <SwatchGradient gradient={envCssGradient(stops)} labels={[
    <LegendNum key="lo">{first.value === 0 ? "0" : `≤${first.value.toLocaleString("zh-TW", { maximumFractionDigits: digits })}`}</LegendNum>,
    <LegendNum key="hi">{`≥${last.value.toLocaleString("zh-TW", { maximumFractionDigits: digits })} ${unit}`}</LegendNum>,
  ]} />;
}

/** 即時層的載入狀態：成功顯示資料時間與筆數；失敗顯示原因（地圖已清空，不畫舊資料）。 */
function LiveStatus({ layerKey, timeLabel = "最新觀測" }: { layerKey: EnvLiveKey; timeLabel?: string }) {
  const t = useLegendTheme();
  const status = useSyncExternalStore(subscribeEnvLiveStatus, () => getEnvLiveStatus(layerKey));
  if (status.state === "error") {
    return <div role="alert" style={{ marginTop: 4, fontSize: FONT_SIZE.xs, color: ENV_ALERT_COLOR }}>載入失敗，地圖未顯示資料：{status.message}</div>;
  }
  if (status.state === "idle" || (status.state === "loading" && status.loadedAt == null)) {
    return <div style={{ marginTop: 4, fontSize: FONT_SIZE.xs, color: t.textMuted }}>載入中…</div>;
  }
  const time = status.latestObservedAt ? (status.latestObservedAt.length <= 10 ? status.latestObservedAt : formatTaiwanTime(status.latestObservedAt)) : "無";
  return <div style={{ marginTop: 4, fontSize: FONT_SIZE.xs, color: t.textMuted }}>
    {timeLabel} <LegendNum>{time}</LegendNum>・已畫 <LegendNum>{(status.drawn ?? 0).toLocaleString("zh-TW")}</LegendNum> 處
    {(status.noCoord ?? 0) > 0 && <>；無座標未畫 <LegendNum>{(status.noCoord ?? 0).toLocaleString("zh-TW")}</LegendNum> 處</>}
  </div>;
}

export function SeaWaterQualityStationsLegend() {
  return <div>
    <LegendTitle zh="海域水質測站" en="Sea Water Quality" />
    {SEA_WATER_CLASSES.map((row) => <LegendRow key={row.value} swatch={<SwatchDot color={row.color} />}>{row.label}</LegendRow>)}
    <Hollow label="採樣過期或無採樣" />
    <LegendNote>顏色是海域環境分類（依用途劃定），不是單次採樣好壞；popup 為最新一次採樣全項目。約每季採樣。海洋委員會 · 政府資料開放授權條款第 1 版</LegendNote>
  </div>;
}

export function RiverRpiSegmentsLegend() {
  const p = useKeyOverlayParams("riverRpiSegments");
  const mode = RIVER_RPI_SEGMENT_MODES[p.riverRpiSegmentsModeIdx ?? 0] ?? RIVER_RPI_SEGMENT_MODES[0];
  return <div>
    <LegendTitle zh={`河川污染指數河段（推估）· ${mode.label}`} en="River RPI Segments" />
    {RIVER_RPI_CLASSES.map((row) => <LegendRow key={row.value} swatch={<SwatchLine color={row.color} width={3} />}>{row.label}</LegendRow>)}
    <LegendRow swatch={<SwatchLine color={RIVER_RPI_NO_DATA_COLOR} width={3} />}>無樣本（不代表乾淨）</LegendRow>
    <LegendRow swatch={<SwatchLine color={RIVER_RPI_CLASSES[0].color} width={3} dash={[2, 2]} />}>已確認感潮段（虛線，RPI 代表性較差）</LegendRow>
    <LegendNote>全台有測站的河川：以上游測站代表其下游至下一站，非連續監測；沒有測站的河川不著色，不代表乾淨。河名改派、流向推斷等待複核事項見 popup。與 RPI 測站同色。中心線 {OSM_ODBL_ATTRIBUTION}</LegendNote>
  </div>;
}

export function Pm25ManualStationsLegend() {
  return <div>
    <LegendTitle zh="PM2.5 手動採樣站 · 近 12 月平均" en="PM2.5 Manual" />
    <Gradient stops={PM25_MANUAL_STOPS} unit="μg/m3" digits={0} />
    <Hollow label="已停測或近 12 月無有效樣本" />
    <LegendNote>手動濾紙秤重，約每 3 天 1 筆日平均，非即時；色與微型感測 PM2.5 五級同源。座標為同名空品自動站，不是採樣器實際位置。環境部</LegendNote>
  </div>;
}

export function DioxinStationsLegend() {
  return <div>
    <LegendTitle zh="環境空氣戴奧辛 · 最新一次" en="Ambient Dioxin" />
    <Gradient stops={DIOXIN_STATION_STOPS} unit="pg I-TEQ/m3" digits={3} />
    <Hollow label="最新採樣已過期" />
    <LegendNote>定期採樣約每半年 1–2 次，非即時；顏色只表相對高低，未與標準比對。座標為同編號空品站。環境部</LegendNote>
  </div>;
}

export function IncineratorEmissionsLegend() {
  return <div>
    <LegendTitle zh="焚化廠空污 · 氮氧化物 NOx" en="Incinerators" />
    <Gradient stops={INCINERATOR_NOX_STOPS} unit="ppm" digits={0} />
    <LegendNote>每月申報（約延遲 1–2 個月）。顏色只表 NOx 相對高低，資料集未附排放標準，不判定超標；戴奧辛（ng-TEQ/Nm3）、粒狀物（mg/Nm3，多數未申報）、不透光率（%）見 popup。環境部</LegendNote>
  </div>;
}

export function NuscGammaRadiationLegend() {
  return <div>
    <LegendTitle zh="環境輻射（核安會）· 劑量率" en="Gamma Dose Rate" />
    <Gradient stops={NUSC_GAMMA_STOPS} unit="μSv/h" digits={2} />
    <LegendRow swatch={<SwatchDot color={NUSC_GAMMA_STOPS[NUSC_GAMMA_STOPS.length - 1]!.color} stroke={ENV_ALERT_COLOR} strokeWidth={2} />}>紅框：≥{NUSC_GAMMA_HIGH_USVH} μSv/h，高於一般背景</LegendRow>
    <Hollow label="超過 30 分鐘未更新" />
    <LiveStatus layerKey="nuscGammaRadiation" />
    <LegendNote>正常背景約 0.04–0.14 μSv/h；每 15 分鐘更新。與台電核電廠周界輻射（災害・核安）為不同測站網。核能安全委員會</LegendNote>
  </div>;
}

export function WaterEffluentLiveLegend() {
  return <div>
    <LegendTitle zh="放流水連線監測" en="Effluent" />
    {WATER_EFFLUENT_STATUSES.map((row) => <LegendRow key={row.value} swatch={<SwatchDot color={row.color} />}>{row.label}</LegendRow>)}
    <Hollow label="資料逾時（超過 3 小時未更新）" />
    <LiveStatus layerKey="waterEffluentLive" />
    <LegendNote>顏色優先序：逾時 → 超限 → 異常 → 正常。超標以上游狀態「超限值」為準；每小時更新。點開可看全部測項。環境部</LegendNote>
  </div>;
}

export function CemsStackLiveLegend() {
  return <div>
    <LegendTitle zh="煙道 CEMS 連線監測" en="CEMS" />
    {CEMS_STATUSES.map((row) => <LegendRow key={row.value} swatch={<SwatchDot color={row.color} />}>{row.label}</LegendRow>)}
    <Hollow label="資料逾時（超過 6 小時）或狀態未提供" />
    <LiveStatus layerKey="cemsStackLive" />
    <LegendNote>每小時值，上游約延遲 4–5 小時。設施有任一煙道正常運轉即算運轉中；逾限依上游狀態碼「數值逾限」。環境部</LegendNote>
  </div>;
}

export function CwaUvDailyLegend() {
  return <div>
    <LegendTitle zh="紫外線指數 · 前一天最大值" en="UV Index" />
    {CWA_UV_LEVELS.map((row) => <LegendRow key={row.value} swatch={<SwatchDot color={row.color} />}>{row.label}</LegendRow>)}
    <Hollow label="缺值或超過 2 天未更新" />
    <LiveStatus layerKey="cwaUvDaily" timeLabel="資料日期" />
    <LegendNote>前一天最大值，非即時；每日更新。中央氣象署</LegendNote>
  </div>;
}

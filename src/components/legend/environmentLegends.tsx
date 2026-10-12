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
import { useLocale } from "../../state/localeStore";
import { enumLabel } from "../../i18n/dataText";
import { localizeLayerName } from "../../i18n/layerText";
import { LAYER_MANIFEST } from "../../data/layerManifest";
import type { LayerName } from "../../data/layerManifest";

type I18n = ReturnType<typeof useLocale>;

/** 標題與圖層名相同時，借 manifest 名稱在目前語系的顯示名 */
function layerTitle(key: string, i18n: I18n): string {
  const name = (LAYER_MANIFEST as Record<string, { name?: LayerName }>)[key]?.name;
  return name ? localizeLayerName(key, name, i18n).primary : key;
}

function Hollow({ label }: { label: string }) {
  return <LegendRow swatch={<SwatchDot color="transparent" stroke={ENV_STALE_COLOR} strokeWidth={2} />}>{label}</LegendRow>;
}

function Gradient({ stops, unit, digits = 2 }: { stops: readonly EnvGradientStop[]; unit: string; digits?: number }) {
  const { formatNumber } = useLocale();
  const first = stops[0]!;
  const last = stops[stops.length - 1]!;
  return <SwatchGradient gradient={envCssGradient(stops)} labels={[
    <LegendNum key="lo">{first.value === 0 ? "0" : `≤${formatNumber(first.value, { maximumFractionDigits: digits })}`}</LegendNum>,
    <LegendNum key="hi">{`≥${formatNumber(last.value, { maximumFractionDigits: digits })} ${unit}`}</LegendNum>,
  ]} />;
}

/** 即時層的載入狀態：成功顯示資料時間與筆數；失敗顯示原因（地圖已清空，不畫舊資料）。 */
function LiveStatus({ layerKey, timeLabel }: { layerKey: EnvLiveKey; timeLabel?: string }) {
  const t = useLegendTheme();
  const i18n = useLocale();
  timeLabel ??= i18n.t("legend.environment.timeObserved");
  const status = useSyncExternalStore(subscribeEnvLiveStatus, () => getEnvLiveStatus(layerKey));
  if (status.state === "error") {
    return <div role="alert" style={{ marginTop: 4, fontSize: FONT_SIZE.xs, color: ENV_ALERT_COLOR }}>{i18n.t("legend.environment.loadFailed", { message: status.message ?? "" })}</div>;
  }
  if (status.state === "idle" || (status.state === "loading" && status.loadedAt == null)) {
    return <div style={{ marginTop: 4, fontSize: FONT_SIZE.xs, color: t.textMuted }}>{i18n.t("legend.environment.loading")}</div>;
  }
  const time = status.latestObservedAt ? (status.latestObservedAt.length <= 10 ? status.latestObservedAt : formatTaiwanTime(status.latestObservedAt)) : i18n.t("legend.environment.none");
  return <div style={{ marginTop: 4, fontSize: FONT_SIZE.xs, color: t.textMuted }}>
    {timeLabel} <LegendNum>{time}</LegendNum>{i18n.t("legend.environment.drawn")} <LegendNum>{i18n.formatNumber(status.drawn ?? 0)}</LegendNum> {i18n.t("legend.environment.unitSite", { count: status.drawn ?? 0 })}
    {(status.noCoord ?? 0) > 0 && <>{i18n.t("legend.environment.noCoordDrawn")} <LegendNum>{i18n.formatNumber(status.noCoord ?? 0)}</LegendNum> {i18n.t("legend.environment.unitSite", { count: status.noCoord ?? 0 })}</>}
  </div>;
}

export function SeaWaterQualityStationsLegend() {
  const i18n = useLocale();
  return <div>
    <LegendTitle zh={layerTitle("seaWaterQualityStations", i18n)} en="Sea Water Quality" />
    {SEA_WATER_CLASSES.map((row) => <LegendRow key={row.value} swatch={<SwatchDot color={row.color} />}>{enumLabel("envSeaClass", row.value, row.label, i18n)}</LegendRow>)}
    <Hollow label={i18n.t("legend.environment.hollowSea")} />
    <LegendNote>{i18n.t("legend.environment.seaNote")}</LegendNote>
  </div>;
}

export function RiverRpiSegmentsLegend() {
  const i18n = useLocale();
  const p = useKeyOverlayParams("riverRpiSegments");
  const mode = RIVER_RPI_SEGMENT_MODES[p.riverRpiSegmentsModeIdx ?? 0] ?? RIVER_RPI_SEGMENT_MODES[0];
  return <div>
    <LegendTitle zh={i18n.t("legend.environment.rpiSegTitle", { mode: enumLabel("envRpiSegmentMode", mode.value, mode.label, i18n) })} en="River RPI Segments" />
    {RIVER_RPI_CLASSES.map((row) => <LegendRow key={row.value} swatch={<SwatchLine color={row.color} width={3} />}>{enumLabel("envRpiClass", row.value, row.label, i18n)}</LegendRow>)}
    <LegendRow swatch={<SwatchLine color={RIVER_RPI_NO_DATA_COLOR} width={3} />}>{i18n.t("legend.environment.rpiSegNoSample")}</LegendRow>
    <LegendRow swatch={<SwatchLine color={RIVER_RPI_CLASSES[0].color} width={3} dash={[2, 2]} />}>{i18n.t("legend.environment.rpiSegTidal")}</LegendRow>
    <LegendNote>{i18n.t("legend.environment.rpiSegNote", { attribution: OSM_ODBL_ATTRIBUTION })}</LegendNote>
  </div>;
}

export function Pm25ManualStationsLegend() {
  const i18n = useLocale();
  return <div>
    <LegendTitle zh={i18n.t("legend.environment.pm25Title")} en="PM2.5 Manual" />
    <Gradient stops={PM25_MANUAL_STOPS} unit="μg/m3" digits={0} />
    <Hollow label={i18n.t("legend.environment.hollowManual")} />
    <LegendNote>{i18n.t("legend.environment.pm25Note")}</LegendNote>
  </div>;
}

export function DioxinStationsLegend() {
  const i18n = useLocale();
  return <div>
    <LegendTitle zh={i18n.t("legend.environment.dioxinTitle")} en="Ambient Dioxin" />
    <Gradient stops={DIOXIN_STATION_STOPS} unit="pg I-TEQ/m3" digits={3} />
    <Hollow label={i18n.t("legend.environment.hollowDioxin")} />
    <LegendNote>{i18n.t("legend.environment.dioxinNote")}</LegendNote>
  </div>;
}

export function IncineratorEmissionsLegend() {
  const i18n = useLocale();
  return <div>
    <LegendTitle zh={i18n.t("legend.environment.incinTitle")} en="Incinerators" />
    <Gradient stops={INCINERATOR_NOX_STOPS} unit="ppm" digits={0} />
    <LegendNote>{i18n.t("legend.environment.incinNote")}</LegendNote>
  </div>;
}

export function NuscGammaRadiationLegend() {
  const i18n = useLocale();
  return <div>
    <LegendTitle zh={i18n.t("legend.environment.gammaTitle")} en="Gamma Dose Rate" />
    <Gradient stops={NUSC_GAMMA_STOPS} unit="μSv/h" digits={2} />
    <LegendRow swatch={<SwatchDot color={NUSC_GAMMA_STOPS[NUSC_GAMMA_STOPS.length - 1]!.color} stroke={ENV_ALERT_COLOR} strokeWidth={2} />}>{i18n.t("legend.environment.gammaRedBox", { value: NUSC_GAMMA_HIGH_USVH })}</LegendRow>
    <Hollow label={i18n.t("legend.environment.hollowGamma")} />
    <LiveStatus layerKey="nuscGammaRadiation" />
    <LegendNote>{i18n.t("legend.environment.gammaNote")}</LegendNote>
  </div>;
}

export function WaterEffluentLiveLegend() {
  const i18n = useLocale();
  return <div>
    <LegendTitle zh={layerTitle("waterEffluentLive", i18n)} en="Effluent" />
    {WATER_EFFLUENT_STATUSES.map((row) => <LegendRow key={row.value} swatch={<SwatchDot color={row.color} />}>{enumLabel("envEffluentStatus", row.value, row.label, i18n)}</LegendRow>)}
    <Hollow label={i18n.t("legend.environment.hollowEffluent")} />
    <LiveStatus layerKey="waterEffluentLive" />
    <LegendNote>{i18n.t("legend.environment.effluentNote")}</LegendNote>
  </div>;
}

export function CemsStackLiveLegend() {
  const i18n = useLocale();
  return <div>
    <LegendTitle zh={layerTitle("cemsStackLive", i18n)} en="CEMS" />
    {CEMS_STATUSES.map((row) => <LegendRow key={row.value} swatch={<SwatchDot color={row.color} />}>{enumLabel("envCemsStatus", row.value, row.label, i18n)}</LegendRow>)}
    <Hollow label={i18n.t("legend.environment.hollowCems")} />
    <LiveStatus layerKey="cemsStackLive" />
    <LegendNote>{i18n.t("legend.environment.cemsNote")}</LegendNote>
  </div>;
}

export function CwaUvDailyLegend() {
  const i18n = useLocale();
  return <div>
    <LegendTitle zh={i18n.t("legend.environment.uvTitle")} en="UV Index" />
    {CWA_UV_LEVELS.map((row) => <LegendRow key={row.value} swatch={<SwatchDot color={row.color} />}>{enumLabel("envUvLevel", row.value, row.label, i18n)}</LegendRow>)}
    <Hollow label={i18n.t("legend.environment.hollowUv")} />
    <LiveStatus layerKey="cwaUvDaily" timeLabel={i18n.t("legend.environment.timeDataDate")} />
    <LegendNote>{i18n.t("legend.environment.uvNote")}</LegendNote>
  </div>;
}

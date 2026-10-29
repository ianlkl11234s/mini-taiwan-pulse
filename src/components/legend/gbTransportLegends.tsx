// 英國第 4 波交通圖例（2026-10-29）：樞紐、站客流、倫敦軌道線／站、單車站、JamCams、收費區。
// 色票與署名 SSOT 在 data/gbTransportTypes.ts；TfL 四層＋車站一律附三句署名與「倫敦限定」。
import { LegendNote, LegendRow, LegendSizeRow, LegendTitle, SwatchDot, SwatchLine, SwatchSquare, useLegendTheme } from "./legendKit";
import { LAYER_MANIFEST, type LayerName } from "../../data/layerManifest";
import {
  GB_BIKEPOINT_COLOR, GB_CHARGING_ZONES, GB_HUB_TYPES, GB_HUBS_ATTRIBUTION, GB_JAMCAM_COLOR, GB_JAMCAM_OFFLINE_COLOR, GB_LONDON_RAIL_MODES,
  GB_LONDON_STATION_COLOR, GB_STATION_USAGE_BUCKETS, GB_STATION_USAGE_NO_DATA_COLOR, GB_TFL_ATTRIBUTIONS,
  type GbChargingZone, type GbHubType, type GbLondonRailMode,
} from "../../data/gbTransportTypes";
import { LINE_WIDTH, POINT_RADIUS, TRANSFER_STATION, transferRingColor } from "../../map/mapStyleScale";
import { useLocale } from "../../state/localeStore";
import { localizeLayerName } from "../../i18n/layerText";
import type { MessageKey } from "../../i18n/keys";

type I18n = ReturnType<typeof useLocale>;
function layerTitle(key: string, i18n: I18n): string {
  const name = (LAYER_MANIFEST as Record<string, { name?: LayerName }>)[key]?.name;
  return name ? localizeLayerName(key, name, i18n).primary : key;
}

function TflNotes() {
  const i18n = useLocale();
  return <>
    <LegendNote>{i18n.t("legend.transport.gbTflNotCovered")}</LegendNote>
    {GB_TFL_ATTRIBUTIONS.map((a) => <LegendNote key={a}>{a}</LegendNote>)}
  </>;
}

const HUB_KEYS: Record<GbHubType, MessageKey> = {
  rail: "popup.transport.gbHubRail", airport: "popup.transport.gbHubAirport", ferry: "popup.transport.gbHubFerry",
  bus_station: "popup.transport.gbHubBusStation", interchange: "popup.transport.gbHubInterchange",
};

/** 英國交通樞紐：依類型分色；渡輪棧橋小點；北愛機場與渡輪未涵蓋。 */
export function GbTransportHubsLegend() {
  const i18n = useLocale();
  return <div>
    <LegendTitle zh={layerTitle("gbTransportHubs", i18n)} en="Transport Hubs" />
    {GB_HUB_TYPES.map((h) => <LegendRow key={h.value} swatch={<SwatchDot color={h.color} />}>{i18n.t(HUB_KEYS[h.value])}</LegendRow>)}
    <LegendSizeRow
      title={i18n.t("legend.transport.gbHubsFerryLanding")}
      fill={GB_HUB_TYPES.find((h) => h.value === "ferry")!.color}
      items={[{ r: POINT_RADIUS.S, label: i18n.t("popup.transport.gbFerryLanding") }, { r: POINT_RADIUS.M, label: i18n.t("popup.transport.gbFerryTerminal") }]}
    />
    <LegendNote>{i18n.t("legend.transport.gbHubsNiNotCovered")}</LegendNote>
    <LegendNote>{GB_HUBS_ATTRIBUTION}</LegendNote>
  </div>;
}

const USAGE_KEYS: readonly MessageKey[] = [
  "legend.transport.gbUsageLt100k", "legend.transport.gbUsage100k", "legend.transport.gbUsage1m",
  "legend.transport.gbUsage10m", "legend.transport.gbUsage50m",
];

/** 車站年進出人次：5 級（色＋大小）；null 空心「無 ORR 統計」；北愛未涵蓋。 */
export function GbStationUsageLegend() {
  const i18n = useLocale();
  return <div>
    <LegendTitle zh={layerTitle("gbStationUsage", i18n)} en="Station Usage" />
    <LegendNote>{i18n.t("legend.transport.gbUsageTitleNote")}</LegendNote>
    {GB_STATION_USAGE_BUCKETS.map((b, i) => <LegendRow key={b.min} swatch={<SwatchDot color={b.color} />}>{i18n.t(USAGE_KEYS[i]!)}</LegendRow>)}
    <LegendRow swatch={<SwatchDot color="transparent" stroke={GB_STATION_USAGE_NO_DATA_COLOR} strokeWidth={1.5} />}>{i18n.t("legend.transport.gbUsageNoData")}</LegendRow>
    <LegendNote>{i18n.t("legend.transport.gbUsageNi")}</LegendNote>
    <LegendNote>{i18n.t("legend.transport.gbUsageOverlap")}</LegendNote>
    <LegendNote>{GB_HUBS_ATTRIBUTION}</LegendNote>
  </div>;
}

const MODE_KEYS: Record<GbLondonRailMode, MessageKey> = {
  tube: "popup.transport.gbModeTube", overground: "popup.transport.gbModeOverground", "elizabeth-line": "popup.transport.gbModeElizabeth",
  dlr: "popup.transport.gbModeDlr", tram: "popup.transport.gbModeTram",
};

/** 倫敦軌道路線：依運具 5 色（非官方線色）。 */
export function GbLondonRailLinesLegend() {
  const i18n = useLocale();
  return <div>
    <LegendTitle zh={layerTitle("gbLondonRailLines", i18n)} en="London Rail Lines" />
    {GB_LONDON_RAIL_MODES.map((m) => <LegendRow key={m.value} swatch={<SwatchLine color={m.color} width={LINE_WIDTH.standard[1]} />}>{i18n.t(MODE_KEYS[m.value])}</LegendRow>)}
    <LegendNote>{i18n.t("legend.transport.gbRailModeNote")}</LegendNote>
    <TflNotes />
  </div>;
}

/** 倫敦軌道車站：車站＋轉乘站（白底環，同台灣捷運站）。 */
export function GbLondonStationsLegend() {
  const t = useLegendTheme();
  const i18n = useLocale();
  return <div>
    <LegendTitle zh={layerTitle("gbLondonStations", i18n)} en="London Rail Stations" />
    <LegendRow swatch={<SwatchDot color={GB_LONDON_STATION_COLOR} />}>{i18n.t("legend.transport.gbStation")}</LegendRow>
    <LegendRow swatch={<SwatchDot color={TRANSFER_STATION.fill} opacity={1} stroke={transferRingColor(t.isDark)} strokeWidth={TRANSFER_STATION.ringWidth} />}>{i18n.t("legend.transport.gbInterchange")}</LegendRow>
    <TflNotes />
  </div>;
}

/** 倫敦 Santander Cycles 站點（不含即時空位）。 */
export function GbLondonBikePointsLegend() {
  const i18n = useLocale();
  return <div>
    <LegendTitle zh={layerTitle("gbLondonBikePoints", i18n)} en="Santander Cycles" />
    <LegendRow swatch={<SwatchDot color={GB_BIKEPOINT_COLOR} />}>{i18n.t("legend.transport.gbBikePoint")}</LegendRow>
    <LegendNote>{i18n.t("legend.transport.gbBikeNoLive")}</LegendNote>
    <TflNotes />
  </div>;
}

/** 倫敦道路攝影機：取得時離線畫空心（非即時狀態）。 */
export function GbLondonJamCamsLegend() {
  const i18n = useLocale();
  return <div>
    <LegendTitle zh={layerTitle("gbLondonJamCams", i18n)} en="TfL JamCams" />
    <LegendRow swatch={<SwatchDot color={GB_JAMCAM_COLOR} />}>{i18n.t("legend.transport.gbJamCam")}</LegendRow>
    <LegendRow swatch={<SwatchDot color="transparent" stroke={GB_JAMCAM_OFFLINE_COLOR} strokeWidth={1.5} />}>{i18n.t("legend.transport.gbJamCamOffline")}</LegendRow>
    <LegendNote>{i18n.t("legend.transport.gbJamCamNote")}</LegendNote>
    <TflNotes />
  </div>;
}

const ZONE_KEYS: Record<GbChargingZone, MessageKey> = {
  congestion_charge: "legend.transport.gbZoneCongestion", ulez_lez: "legend.transport.gbZoneUlezLez",
};

/** 倫敦收費區：塞車費區（上）、ULEZ／LEZ 同一邊界（下）。 */
export function GbLondonChargingZonesLegend() {
  const i18n = useLocale();
  return <div>
    <LegendTitle zh={layerTitle("gbLondonChargingZones", i18n)} en="Charging Zones" />
    {GB_CHARGING_ZONES.map((z) => <LegendRow key={z.value} swatch={<SwatchSquare color={z.color} stroke={z.color} />}>{i18n.t(ZONE_KEYS[z.value])}</LegendRow>)}
    <LegendNote>{i18n.t("legend.transport.gbZoneNote")}</LegendNote>
    <TflNotes />
  </div>;
}

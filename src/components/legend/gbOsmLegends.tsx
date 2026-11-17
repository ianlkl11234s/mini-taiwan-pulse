// 英國第 13 波 OSM 圖例（2026-11-13 快照）：橋梁與隧道、道路設施、公共設施、宗教場所。
// 色票與筆數 SSOT 在 data/gbOsmTypes.ts（C-5 類別色盤依底圖）；每層標快照日、涵蓋範圍與署名。
import { LegendNote, LegendRow, LegendTitle, SwatchDot, SwatchLine, useLegendTheme } from "./legendKit";
import { DenseHeatmapLegendRow } from "./legendShared";
import { LAYER_MANIFEST, type LayerName } from "../../data/layerManifest";
import {
  GB_BRIDGES_TUNNELS_BY_NATION, GB_BRIDGES_TUNNELS_TILE_ZOOM, GB_NH_ATTRIBUTION, GB_NH_OGL_V3, GB_OSM13_ATTRIBUTION, GB_OSM13_ODBL,
  GB_OSM13_SNAPSHOT, GB_PLACES_OF_WORSHIP_BY_NATION, GB_PLACES_OF_WORSHIP_TILE_ZOOM, GB_PUBLIC_FACILITIES_BY_NATION,
  GB_PUBLIC_FACILITIES_TILE_ZOOM, GB_PUBLIC_FACILITY_KINDS, GB_ROAD_FACILITIES_BY_NATION, GB_ROAD_FACILITY_KINDS, GB_STRUCTURES,
  GB_WORSHIP_KINDS, gbOsmKindColor, type GbPublicFacilityKind, type GbRoadFacilityKind, type GbStructure, type GbWorshipKind,
} from "../../data/gbOsmTypes";
import { LINE_WIDTH } from "../../map/mapStyleScale";
import { useLocale } from "../../state/localeStore";
import { localizeLayerName } from "../../i18n/layerText";
import type { MessageKey } from "../../i18n/keys";

type I18n = ReturnType<typeof useLocale>;
function layerTitle(key: string, i18n: I18n): string {
  const name = (LAYER_MANIFEST as Record<string, { name?: LayerName }>)[key]?.name;
  return name ? localizeLayerName(key, name, i18n).primary : key;
}
type Nations = { England: number; Scotland: number; Wales: number; "Northern Ireland": number };
function nationArgs(i18n: I18n, by: Nations) {
  const n = (v: number) => i18n.formatNumber(v);
  return { e: n(by.England), s: n(by.Scotland), w: n(by.Wales), ni: n(by["Northern Ireland"]) };
}
const OSM_LINE = `${GB_OSM13_ATTRIBUTION} (${GB_OSM13_ODBL})`;

export const GB_STRUCTURE_KEYS: Record<GbStructure, MessageKey> = {
  bridge: "legend.transport.gbBtBridge", tunnel: "legend.transport.gbBtTunnel",
};
export const GB_ROAD_FACILITY_KEYS: Record<GbRoadFacilityKind, MessageKey> = {
  services: "legend.transport.gbRfServices", rest_area: "legend.transport.gbRfRestArea",
  toll_booth: "legend.transport.gbRfTollBooth", emergency_area: "legend.transport.gbRfEmergencyArea",
};
export const GB_PUBLIC_FACILITY_KEYS: Record<GbPublicFacilityKind, MessageKey> = {
  community_centre: "legend.civic.gbPfCommunityCentre", toilets: "legend.civic.gbPfToilets",
  post_office: "legend.civic.gbPfPostOffice", marketplace: "legend.civic.gbPfMarketplace",
};
export const GB_WORSHIP_KEYS: Record<GbWorshipKind, MessageKey> = {
  christian: "legend.civic.gbPowChristian", muslim: "legend.civic.gbPowMuslim", jewish: "legend.civic.gbPowJewish",
  sikh: "legend.civic.gbPowSikh", hindu: "legend.civic.gbPowHindu", buddhist: "legend.civic.gbPowBuddhist",
  other: "legend.civic.gbPowOther", unknown: "legend.civic.gbPowUnknown",
};

/** 橋梁與隧道：橋實線、隧道虛線（C-5 兩色），線寬依道路等級。 */
export function GbBridgesTunnelsLegend() {
  const i18n = useLocale();
  const { isDark } = useLegendTheme();
  return <div>
    <LegendTitle zh={layerTitle("gbBridgesTunnels", i18n)} en="Road Bridges & Tunnels (OSM)" />
    {GB_STRUCTURES.map((s) => (
      <LegendRow key={s.value} swatch={<SwatchLine color={gbOsmKindColor(s, isDark)} width={LINE_WIDTH.standard[1]} dash={s.value === "tunnel" ? [2, 1.5] : undefined} />}>
        {i18n.t(GB_STRUCTURE_KEYS[s.value], { n: i18n.formatNumber(s.count) })}
      </LegendRow>
    ))}
    <LegendNote>{i18n.t("legend.transport.gbBtWidthNote")}</LegendNote>
    <LegendNote>{i18n.t("legend.transport.gbBtSegmentNote")}</LegendNote>
    <LegendNote>{i18n.t("legend.transport.gbOsmNations", nationArgs(i18n, GB_BRIDGES_TUNNELS_BY_NATION))}</LegendNote>
    <LegendNote>{i18n.t("legend.civic.gbOsmTileZoom", { z: GB_BRIDGES_TUNNELS_TILE_ZOOM.minzoom })}</LegendNote>
    <LegendNote>{i18n.t("legend.transport.gbOsmSnapshot", { date: GB_OSM13_SNAPSHOT })}</LegendNote>
    <LegendNote>{OSM_LINE}</LegendNote>
  </div>;
}

/** 道路設施：4 類；緊急停車區只有英格蘭（其他三地未涵蓋，不是 0）。 */
export function GbRoadFacilitiesLegend() {
  const i18n = useLocale();
  const { isDark } = useLegendTheme();
  return <div>
    <LegendTitle zh={layerTitle("gbRoadFacilities", i18n)} en="Road Facilities" />
    {GB_ROAD_FACILITY_KINDS.map((k) => (
      <LegendRow key={k.value} swatch={<SwatchDot color={gbOsmKindColor(k, isDark)} />}>
        {i18n.t(GB_ROAD_FACILITY_KEYS[k.value], { n: i18n.formatNumber(k.count) })}
      </LegendRow>
    ))}
    <LegendNote>{i18n.t("legend.transport.gbRfEmergencyCoverage")}</LegendNote>
    <LegendNote>{i18n.t("legend.transport.gbRfEmergencyPoint")}</LegendNote>
    <LegendNote>{i18n.t("legend.transport.gbRfOsmNote", { date: GB_OSM13_SNAPSHOT })}</LegendNote>
    <LegendNote>{i18n.t("legend.transport.gbOsmNations", nationArgs(i18n, GB_ROAD_FACILITIES_BY_NATION))}</LegendNote>
    <LegendNote>{OSM_LINE}</LegendNote>
    <LegendNote>{`${GB_NH_ATTRIBUTION} (${GB_NH_OGL_V3})`}</LegendNote>
  </div>;
}

/** 公共設施：4 類，z<10 熱區、z10 起畫點。 */
export function GbPublicFacilitiesLegend() {
  const i18n = useLocale();
  const { isDark } = useLegendTheme();
  return <div>
    <LegendTitle zh={layerTitle("gbPublicFacilities", i18n)} en="Public Facilities (OSM)" />
    {GB_PUBLIC_FACILITY_KINDS.map((k) => (
      <LegendRow key={k.value} swatch={<SwatchDot color={gbOsmKindColor(k, isDark)} />}>
        {i18n.t(GB_PUBLIC_FACILITY_KEYS[k.value], { n: i18n.formatNumber(k.count) })}
      </LegendRow>
    ))}
    <DenseHeatmapLegendRow layers={["gbPublicFacilities"]} />
    <LegendNote>{i18n.t("legend.civic.gbOsmPointsZoom10")}</LegendNote>
    <LegendNote>{i18n.t("legend.civic.gbOsmTileZoom", { z: GB_PUBLIC_FACILITIES_TILE_ZOOM.minzoom })}</LegendNote>
    <LegendNote>{i18n.t("legend.civic.gbPfNote")}</LegendNote>
    <LegendNote>{i18n.t("legend.civic.gbOsmNations", nationArgs(i18n, GB_PUBLIC_FACILITIES_BY_NATION))}</LegendNote>
    <LegendNote>{i18n.t("legend.civic.gbOsmSnapshot", { date: GB_OSM13_SNAPSHOT })}</LegendNote>
    <LegendNote>{OSM_LINE}</LegendNote>
  </div>;
}

/** 宗教場所：依 OSM religion 分 8 類；未標示＝中性色，不推測。 */
export function GbPlacesOfWorshipLegend() {
  const i18n = useLocale();
  const { isDark } = useLegendTheme();
  return <div>
    <LegendTitle zh={layerTitle("gbPlacesOfWorship", i18n)} en="Places of Worship (OSM)" />
    {GB_WORSHIP_KINDS.map((k) => (
      <LegendRow key={k.value} swatch={<SwatchDot color={gbOsmKindColor(k, isDark)} />}>
        {i18n.t(GB_WORSHIP_KEYS[k.value], { n: i18n.formatNumber(k.count) })}
      </LegendRow>
    ))}
    <DenseHeatmapLegendRow layers={["gbPlacesOfWorship"]} />
    <LegendNote>{i18n.t("legend.civic.gbOsmPointsZoom10")}</LegendNote>
    <LegendNote>{i18n.t("legend.civic.gbOsmTileZoom", { z: GB_PLACES_OF_WORSHIP_TILE_ZOOM.minzoom })}</LegendNote>
    <LegendNote>{i18n.t("legend.civic.gbOsmNations", nationArgs(i18n, GB_PLACES_OF_WORSHIP_BY_NATION))}</LegendNote>
    <LegendNote>{i18n.t("legend.civic.gbOsmSnapshot", { date: GB_OSM13_SNAPSHOT })}</LegendNote>
    <LegendNote>{OSM_LINE}</LegendNote>
  </div>;
}

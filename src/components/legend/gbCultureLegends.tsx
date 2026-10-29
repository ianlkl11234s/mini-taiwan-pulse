// 英國第 8 波文化與觀光圖例（2026-10-29）：文化設施、藝文場館、觀光體驗。
// 色票與署名 SSOT 在 data/gbCultureTypes.ts；每層標涵蓋、OSM 非完整清冊與來源署名。
import { LegendNote, LegendRow, LegendTitle, SwatchDot } from "./legendKit";
import { LAYER_MANIFEST, type LayerName } from "../../data/layerManifest";
import {
  GB_ARTS_KINDS, GB_CULTURAL_KINDS, GB_CULTURAL_OSM_STROKE_WIDTH, GB_CULTURAL_SOURCE_COUNTS, GB_LIBRARIES_NI_ATTRIBUTION, GB_VISITOR_KINDS,
  type GbArtsKind, type GbCulturalKind, type GbVisitorKind,
} from "../../data/gbCultureTypes";
import { GB_OSM_ATTRIBUTION } from "../../data/gbCivicTypes";
import { useLocale } from "../../state/localeStore";
import { localizeLayerName } from "../../i18n/layerText";
import type { MessageKey } from "../../i18n/keys";

type I18n = ReturnType<typeof useLocale>;
function layerTitle(key: string, i18n: I18n): string {
  const name = (LAYER_MANIFEST as Record<string, { name?: LayerName }>)[key]?.name;
  return name ? localizeLayerName(key, name, i18n).primary : key;
}

export const GB_CULTURAL_KIND_KEYS: Record<GbCulturalKind, MessageKey> = {
  museum: "legend.culture.gbMuseum", gallery: "legend.culture.gbGallery", library: "legend.culture.gbLibrary",
};
export const GB_ARTS_KIND_KEYS: Record<GbArtsKind, MessageKey> = {
  theatre: "legend.culture.gbTheatre", cinema: "legend.culture.gbCinema", arts_centre: "legend.culture.gbArtsCentre",
  concert_hall: "legend.culture.gbConcertHall",
};
export const GB_VISITOR_KIND_KEYS: Record<GbVisitorKind, MessageKey> = {
  attraction: "legend.culture.gbAttraction", visitor_centre: "legend.culture.gbVisitorCentre", theme_park: "legend.culture.gbThemePark",
  zoo: "legend.culture.gbZoo", aquarium: "legend.culture.gbAquarium",
};

/** 英國文化設施：三類（沿用台灣文化設施色）＋來源兩項（官方實心、OSM 補缺空心）。 */
export function GbCulturalFacilitiesLegend() {
  const i18n = useLocale();
  const color = GB_CULTURAL_KINDS.find((k) => k.value === "library")!.color;
  return <div>
    <LegendTitle zh={layerTitle("gbCulturalFacilities", i18n)} en="Museums, Galleries & Libraries" />
    {GB_CULTURAL_KINDS.map((k) => <LegendRow key={k.value} swatch={<SwatchDot color={k.color} />}>{i18n.t(GB_CULTURAL_KIND_KEYS[k.value])}</LegendRow>)}
    <LegendRow swatch={<SwatchDot color={color} />}>{i18n.t("legend.culture.gbSourceOfficial", { n: i18n.formatNumber(GB_CULTURAL_SOURCE_COUNTS.official) })}</LegendRow>
    <LegendRow swatch={<SwatchDot color="transparent" opacity={1} stroke={color} strokeWidth={GB_CULTURAL_OSM_STROKE_WIDTH} />}>{i18n.t("legend.culture.gbSourceOsm", { n: i18n.formatNumber(GB_CULTURAL_SOURCE_COUNTS.osm) })}</LegendRow>
    <LegendNote>{i18n.t("legend.culture.gbCulturalNote")}</LegendNote>
    <LegendNote>{i18n.t("legend.culture.gbGalleryNote")}</LegendNote>
    <LegendNote>{i18n.t("legend.culture.gbZoom7")}</LegendNote>
    <LegendNote>{GB_LIBRARIES_NI_ATTRIBUTION}</LegendNote>
    <LegendNote>{GB_OSM_ATTRIBUTION}</LegendNote>
  </div>;
}

/** 英國藝文場館：四類（劇院、電影院沿用台灣色；藝術中心、音樂廳借台灣色），全為 OSM。 */
export function GbArtsVenuesLegend() {
  const i18n = useLocale();
  return <div>
    <LegendTitle zh={layerTitle("gbArtsVenues", i18n)} en="Arts Venues" />
    {GB_ARTS_KINDS.map((k) => <LegendRow key={k.value} swatch={<SwatchDot color={k.color} />}>{i18n.t(GB_ARTS_KIND_KEYS[k.value])}</LegendRow>)}
    <LegendNote>{i18n.t("legend.culture.gbArtsNote")}</LegendNote>
    <LegendNote>{i18n.t("legend.culture.gbOsmOnly")}</LegendNote>
    <LegendNote>{i18n.t("legend.culture.gbZoom7")}</LegendNote>
    <LegendNote>{GB_OSM_ATTRIBUTION}</LegendNote>
  </div>;
}

/** 英國觀光體驗：五類（動物園、水族館同色），全為 OSM；景點縮放 9 級起。 */
export function GbVisitorExperienceLegend() {
  const i18n = useLocale();
  return <div>
    <LegendTitle zh={layerTitle("gbVisitorExperience", i18n)} en="Visitor Attractions" />
    {GB_VISITOR_KINDS.map((k) => <LegendRow key={k.value} swatch={<SwatchDot color={k.color} />}>{i18n.t(GB_VISITOR_KIND_KEYS[k.value])}</LegendRow>)}
    <LegendNote>{i18n.t("legend.culture.gbVisitorNote")}</LegendNote>
    <LegendNote>{i18n.t("legend.culture.gbOsmOnly")}</LegendNote>
    <LegendNote>{i18n.t("legend.culture.gbAttractionZoom")}</LegendNote>
    <LegendNote>{GB_OSM_ATTRIBUTION}</LegendNote>
  </div>;
}

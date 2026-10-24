// atlas 批次 2026-10 的 26 層圖例（legendKit；色票與地圖 paint 同源，皆 import atlasLayerTypes）。
import type { ReactNode } from "react";
import { LegendNote, LegendRow, LegendTitle, SwatchDot, SwatchLine, SwatchSquare } from "./legendKit";
import {
  ANIMAL_STATUS_OPTIONS, ATLAS_FLAG_COLOR, ATLAS_LAYER_COLORS, ATLAS_NOTES, ATLAS_OTHER_COLOR, BEACH_LEVEL_OPTIONS, DREDGING_STATUS_OPTIONS,
  ECOLOGY_SPECIES_STEPS, ECO_SENSITIVE_LEVEL_OPTIONS, EMERGENCY_BAY_OPTIONS, FLOOD_INFO_SOURCE_OPTIONS, FREEWAY_SIGN_GROUP_OPTIONS,
  GATE_KIND_OPTIONS, INTERCHANGE_TYPE_OPTIONS, ISOLATION_CAUSE_OPTIONS, MICROPLASTIC_STEPS, MONITOR_SERIES_OPTIONS, PLACE_CATEGORY_OPTIONS,
  POLLUTION_LEVEL_OPTIONS, ROAD_SIGN_SERIES_OPTIONS, RURAL_COMMUNITY_OPTIONS, STRUCTURE_CATEGORY_OPTIONS, SWCB_PHOTO_CATEGORY_OPTIONS,
  TRIANGULATION_GRADE_OPTIONS, TRIBE_ETHNIC_OPTIONS, COASTAL_AREA_TYPE_OPTIONS, MARINE_PROTECTION_ORGS, TRIBE_NOT_APPROVED_COLOR, TURTLE_SPECIES_OPTIONS,
  CULTURE_COIN_CATEGORY_OPTIONS, CULTURE_COIN_ORGS, CULTURAL_HEALTH_KIND_OPTIONS,
  TWC_OFFICE_TYPE_OPTIONS, TWC_FACILITY_TYPE_OPTIONS, STATE_TENDER_KIND_OPTIONS, STATE_ASSET_ORGS,
  type AtlasLayerKey,
} from "../../data/atlasLayerTypes";
import { LAYER_MANIFEST, type LayerName } from "../../data/layerManifest";
import { CUMULATIVE_STEPS, RATE_STEPS, STATION_TYPE_OPTIONS } from "../../data/landSubsidenceTypes";
import { useLocale } from "../../state/localeStore";
import { enumLabel } from "../../i18n/dataText";
import { localizeLayerName } from "../../i18n/layerText";
import type { StaticMessageKey } from "../../i18n/keys";

type Swatch = "dot" | "square" | "line";
/** 色塊列：`label` 是中文正本（有 `domain` 時以 `value` 查 enums.atlas.json 翻譯）；`labelKey` 是不屬於類別表的專用字。 */
type Row = { color: string; label?: string; value?: string; labelKey?: StaticMessageKey; /** 空心圈（文化健康站：只到鄉鎮中心） */ ring?: boolean };

function swatchOf(kind: Swatch, color: string): ReactNode {
  if (kind === "square") return <SwatchSquare color={color} />;
  if (kind === "line") return <SwatchLine color={color} width={3} />;
  return <SwatchDot color={color} />;
}

/** 來源機關（中文正本；英日文在 enums.atlas.json 的 enum.atlasOrg.*） */
const ORGS = {
  cip: "原住民族委員會", swcb: "農業部農村發展及水土保持署", thb: "交通部公路局", freeway: "交通部高速公路局",
  ncdr: "國家災害防救科技中心", taipeiHydraulic: "臺北市政府工務局水利工程處", marn: "海洋委員會海洋保育署 MARN",
  oca: "海洋委員會海洋保育署", moenv: "環境部", oac: "海洋委員會", namr: "國家海洋研究院",
  landAdmin: "內政部地政司", nlsc: "內政部國土測繪中心", wra: "經濟部水利署",
  ...MARINE_PROTECTION_ORGS,
  ...CULTURE_COIN_ORGS,
  ...STATE_ASSET_ORGS,
} as const;
type Source = { org: keyof typeof ORGS; ids?: readonly string[]; etc?: boolean };
const src = (org: Source["org"], ids?: readonly string[], etc = false): Source => ({ org, ids, etc });

/** 一張 atlas 圖例：標題＋色塊列＋說明（ATLAS_NOTES）＋來源。標題預設借圖層名，標題與圖層名不同的才傳 `title`。 */
function AtlasLegend({ layer, en, rows, kind = "dot", source, domain, title, license }: {
  layer: AtlasLayerKey; en: string; rows: readonly Row[]; kind?: Swatch; source: Source; domain?: string; title?: StaticMessageKey;
  /** 非 OGDL 的授權說明（例：定置漁業權區＝漁業署網站著作權聲明）；未給時沿用 OGDL 模板。 */
  license?: StaticMessageKey;
}) {
  const i18n = useLocale();
  const name = (LAYER_MANIFEST as Record<string, { name?: LayerName }>)[layer]?.name;
  const heading = title ? i18n.t(title) : name ? localizeLayerName(layer, name, i18n).primary : layer;
  const org = enumLabel("atlasOrg", source.org, ORGS[source.org], i18n);
  const sourceText = source.ids
    ? i18n.t(source.etc ? "legend.atlas.sourceIdsEtc" : "legend.atlas.sourceIds", { org, ids: source.ids.join(i18n.t("legend.atlas.idSeparator")) })
    : org;
  const note = enumLabel("atlasNote", layer, ATLAS_NOTES[layer], i18n);
  const labelOf = (row: Row) => row.labelKey ? i18n.t(row.labelKey) : domain && row.value != null ? enumLabel(domain, row.value, row.label ?? "", i18n) : row.label;
  return <div>
    <LegendTitle zh={heading} en={en} />
    {rows.map((row, index) => <LegendRow key={`${index}-${row.value ?? row.label ?? row.labelKey}`} swatch={row.ring ? <SwatchDot color={row.color} opacity={0.15} stroke={row.color} strokeWidth={2} /> : swatchOf(kind, row.color)}>{labelOf(row)}</LegendRow>)}
    <LegendNote>{license
      ? i18n.t("legend.atlas.noteSourceLicense", { note, source: sourceText, license: i18n.t(license) })
      : i18n.t("legend.atlas.noteSource", { note, source: sourceText })}</LegendNote>
  </div>;
}

const single = (layer: AtlasLayerKey, labelKey: StaticMessageKey): Row[] => [{ labelKey, color: ATLAS_LAYER_COLORS[layer] }];
const flagRow: Row = { labelKey: "legend.atlas.flag", color: ATLAS_FLAG_COLOR };
const stepRows = (steps: readonly { min: number; label: string; color: string }[]): Row[] => steps.map((step) => ({ label: step.label, value: String(step.min), color: step.color }));

export const ATLAS_LEGENDS: Record<AtlasLayerKey, () => ReactNode> = {
  indigenousTribes: () => <AtlasLegend layer="indigenousTribes" en="Indigenous Tribes" source={src("cip", ["156632", "7093"])} domain="atlasEthnic"
    rows={[...TRIBE_ETHNIC_OPTIONS, { labelKey: "legend.atlas.otherMultiEthnic", color: ATLAS_OTHER_COLOR }, { labelKey: "legend.atlas.notApprovedList", color: TRIBE_NOT_APPROVED_COLOR }]} />,
  indigenousIsolationRisk: () => <AtlasLegend layer="indigenousIsolationRisk" en="Isolation-risk Areas" source={src("cip", ["170259"])} domain="atlasIsolation" rows={ISOLATION_CAUSE_OPTIONS} />,
  agriRuralCommunityVillages: () => <AtlasLegend layer="agriRuralCommunityVillages" title="legend.atlas.titleRuralCommunity" en="Rural Community Villages" kind="square" source={src("swcb")} domain="atlasRural" rows={RURAL_COMMUNITY_OPTIONS} />,
  provincialRoadSigns: () => <AtlasLegend layer="provincialRoadSigns" en="Provincial Road Signs" source={src("thb", ["146233"], true)} domain="atlasSignSeries" rows={ROAD_SIGN_SERIES_OPTIONS} />,
  provincialRoadMileposts: () => <AtlasLegend layer="provincialRoadMileposts" en="Provincial Road Mileposts" source={src("thb", ["7040"])} rows={single("provincialRoadMileposts", "legend.atlas.milepost")} />,
  freewayTrafficSigns: () => <AtlasLegend layer="freewayTrafficSigns" en="Freeway Traffic Signs" source={src("freeway", ["98447"])} domain="atlasFreewaySign" rows={FREEWAY_SIGN_GROUP_OPTIONS} />,
  freewayInterchanges: () => <AtlasLegend layer="freewayInterchanges" en="Freeway Interchanges" source={src("freeway", ["166496"])} domain="atlasInterchange" rows={INTERCHANGE_TYPE_OPTIONS} />,
  freewayEcoSensitive: () => <AtlasLegend layer="freewayEcoSensitive" en="Freeway Eco-sensitive Sections" kind="square" source={src("freeway", ["31290"])} domain="atlasEcoLevel" rows={ECO_SENSITIVE_LEVEL_OPTIONS} />,
  provincialRoadMonitored: () => <AtlasLegend layer="provincialRoadMonitored" en="Monitored Road Sections" kind="line" source={src("thb", ["16193"], true)} domain="atlasMonitor" rows={MONITOR_SERIES_OPTIONS} />,
  provincialRoadEmergencyBays: () => <AtlasLegend layer="provincialRoadEmergencyBays" en="Emergency Bays" source={src("thb", ["99940"])} domain="atlasBay" rows={EMERGENCY_BAY_OPTIONS} />,
  floodDisasterPointsNcdr: () => <AtlasLegend layer="floodDisasterPointsNcdr" title="legend.atlas.titleFloodPoints" en="Flood Disaster Points" source={src("ncdr", ["130016"], true)} domain="atlasFloodSource"
    rows={[...FLOOD_INFO_SOURCE_OPTIONS, { labelKey: "legend.atlas.otherSource", color: ATLAS_OTHER_COLOR }]} />,
  taipeiWaterloggingHistory: () => <AtlasLegend layer="taipeiWaterloggingHistory" en="Taipei Waterlogging History" kind="square" source={src("taipeiHydraulic", ["143898"])} rows={single("taipeiWaterloggingHistory", "legend.atlas.waterloggedArea")} />,
  swcbDisasterPhotoPoints: () => <AtlasLegend layer="swcbDisasterPhotoPoints" en="Sediment Disaster Photos" source={src("swcb", ["138000", "174226"])} domain="atlasPhotoCategory" rows={SWCB_PHOTO_CATEGORY_OPTIONS} />,
  cetaceanStrandings: () => <AtlasLegend layer="cetaceanStrandings" en="Cetacean Strandings" source={src("marn", ["157624"])} domain="atlasAnimalStatus" rows={[...ANIMAL_STATUS_OPTIONS, flagRow]} />,
  seaTurtleStrandings: () => <AtlasLegend layer="seaTurtleStrandings" en="Sea Turtle Strandings" source={src("marn")} domain="atlasTurtle"
    rows={[...TURTLE_SPECIES_OPTIONS, { labelKey: "legend.atlas.unidentified", color: ATLAS_OTHER_COLOR }, flagRow]} />,
  beachWaterQuality: () => <AtlasLegend layer="beachWaterQuality" en="Beach Water Quality" source={src("moenv")} domain="atlasBeach" rows={BEACH_LEVEL_OPTIONS} />,
  marineMicroplastics: () => <AtlasLegend layer="marineMicroplastics" title="legend.atlas.titleMicroplastics" en="Marine Microplastics" source={src("oac")} rows={stepRows(MICROPLASTIC_STEPS)} />,
  marinePollutionIncidents: () => <AtlasLegend layer="marinePollutionIncidents" en="Marine Pollution Incidents" source={src("oca")} domain="atlasPollution" rows={POLLUTION_LEVEL_OPTIONS} />,
  namrEdnaSurveySites: () => <AtlasLegend layer="namrEdnaSurveySites" en="eDNA Survey Sites" source={src("namr")} rows={single("namrEdnaSurveySites", "legend.atlas.surveySite")} />,
  placeNames: () => <AtlasLegend layer="placeNames" en="Taiwan Place Names" source={src("landAdmin", ["40281"], true)} domain="atlasPlaceLegend" rows={PLACE_CATEGORY_OPTIONS} />,
  triangulationPoints: () => <AtlasLegend layer="triangulationPoints" en="Triangulation Points" source={src("nlsc", ["26485"])} domain="atlasTriangulation" rows={TRIANGULATION_GRADE_OPTIONS} />,
  wraFloodgatesCentral: () => <AtlasLegend layer="wraFloodgatesCentral" en="Central Floodgates" source={src("wra", ["32722"])} domain="atlasGate" rows={GATE_KIND_OPTIONS} />,
  wraCentralDrainage: () => <AtlasLegend layer="wraCentralDrainage" en="Central Regional Drainage" kind="square" source={src("wra")} rows={single("wraCentralDrainage", "legend.atlas.drainageExtent")} />,
  iowStructureMonitoring: () => <AtlasLegend layer="iowStructureMonitoring" en="IoW Structure Monitoring" source={src("wra", ["142981"], true)} domain="atlasStructure" rows={STRUCTURE_CATEGORY_OPTIONS} />,
  wraDredgingPoints: () => <AtlasLegend layer="wraDredgingPoints" en="River Dredging" source={src("wra")} domain="atlasDredging" rows={DREDGING_STATUS_OPTIONS} />,
  wraEcologySurveySites: () => <AtlasLegend layer="wraEcologySurveySites" title="legend.atlas.titleEcology" en="River Ecology Survey Sites" source={src("wra")} domain="atlasSpecies" rows={stepRows(ECOLOGY_SPECIES_STEPS)} />,
  // 海域保護與漁業 G08（2026-10-17）
  natureReserves: () => <AtlasLegend layer="natureReserves" en="Nature Reserves" kind="square" source={src("forestry")} rows={single("natureReserves", "legend.atlas.protectedAreaWithLand")} />,
  wildlifeProtectedAreas: () => <AtlasLegend layer="wildlifeProtectedAreas" en="Wildlife Protected Areas" kind="square" source={src("forestry")} rows={single("wildlifeProtectedAreas", "legend.atlas.protectedAreaWithLand")} />,
  openFishingLocations: () => <AtlasLegend layer="openFishingLocations" en="Open Fishing Locations" source={src("oca")} rows={single("openFishingLocations", "legend.atlas.fishingPoint")} />,
  coastalAreaExtents: () => <AtlasLegend layer="coastalAreaExtents" en="Coastal Area Extents (2022 edition)" kind="square" source={src("nps", ["20821"])} domain="atlasCoastal" rows={COASTAL_AREA_TYPE_OPTIONS} />,
  artificialReefCenters: () => <AtlasLegend layer="artificialReefCenters" en="Artificial Reef Areas (centers)" source={src("fa")} rows={single("artificialReefCenters", "legend.atlas.reefCenter")} />,
  protectedReefCenters: () => <AtlasLegend layer="protectedReefCenters" en="Protected Reef Areas (centers)" source={src("fa")} rows={single("protectedReefCenters", "legend.atlas.reefCenter")} />,
  setNetFishingAreas: () => <AtlasLegend layer="setNetFishingAreas" en="Set-net Fishery Right Areas" kind="square" source={src("fa")} license="legend.atlas.licenseFaCopyright" rows={single("setNetFishingAreas", "legend.atlas.setNetArea")} />,
  // 地層下陷＋海堤 G19（2026-10-17）
  landSubsidenceStations: () => <AtlasLegend layer="landSubsidenceStations" en="Land Subsidence Monitoring Stations" source={src("wra", ["36693", "41571", "58335"])} domain="landSubsidenceStationType" rows={STATION_TYPE_OPTIONS} />,
  landSubsidenceCumulative: () => <AtlasLegend layer="landSubsidenceCumulative" en="Cumulative Subsidence (mm)" kind="line" source={src("wra", ["58361"])} rows={CUMULATIVE_STEPS.map((step) => ({ label: step.label, color: step.color }))} />,
  landSubsidenceRate: () => <AtlasLegend layer="landSubsidenceRate" en="Subsidence Rate (cm/yr)" kind="line" source={src("wra", ["58362"])} rows={RATE_STEPS.map((step) => ({ label: step.label, color: step.color }))} />,
  seawallZones: () => <AtlasLegend layer="seawallZones" en="Seawall Zones" kind="square" source={src("wra", ["129277"])} rows={single("seawallZones", "legend.atlas.seawallZone")} />,
  // 文化幣藝文消費點 G23（2026-10-24）
  // 原民會文化健康站 G20（2026-10-24）：實心＝站址、空心圈＝只到鄉鎮中心
  culturalHealthStations: () => <AtlasLegend layer="culturalHealthStations" en="Indigenous Cultural Health Stations" source={src("cip", ["157725"])} domain="atlasChsKind"
    rows={CULTURAL_HEALTH_KIND_OPTIONS.map((option) => ({ ...option, ring: option.value === "township_group" }))} />,
  cultureCoinVenues: () => <AtlasLegend layer="cultureCoinVenues" en="Culture Coin Venues" source={src("moc", ["177601"])} domain="atlasCultureCoin" rows={CULTURE_COIN_CATEGORY_OPTIONS} />,
  // 國營事業與國有資產 G16（2026-10-24）
  twcServiceOffices: () => <AtlasLegend layer="twcServiceOffices" en="TWC Offices" source={src("twc", ["86110"])} domain="atlasTwcOfficeType" rows={TWC_OFFICE_TYPE_OPTIONS} />,
  twcWaterFacilities: () => <AtlasLegend layer="twcWaterFacilities" en="TWC Water Facilities" source={src("twc", ["36602"])} domain="atlasTwcFacilityType" rows={TWC_FACILITY_TYPE_OPTIONS} />,
  taisugarSugarMills: () => <AtlasLegend layer="taisugarSugarMills" en="Taisugar Sugar Mills" source={src("taisugar", ["41592"])} rows={single("taisugarSugarMills", "legend.atlas.sugarMill")} />,
  statePropertyTenderListings: () => <AtlasLegend layer="statePropertyTenderListings" en="State Property for Tender" source={src("fnp", ["9659", "13152"])} domain="atlasTenderKind" rows={STATE_TENDER_KIND_OPTIONS} />,
};

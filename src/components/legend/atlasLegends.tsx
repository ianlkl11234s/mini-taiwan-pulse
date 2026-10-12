// atlas 批次 2026-10 的 26 層圖例（legendKit；色票與地圖 paint 同源，皆 import atlasLayerTypes）。
import type { ReactNode } from "react";
import { LegendNote, LegendRow, LegendTitle, SwatchDot, SwatchLine, SwatchSquare } from "./legendKit";
import {
  ANIMAL_STATUS_OPTIONS, ATLAS_FLAG_COLOR, ATLAS_LAYER_COLORS, ATLAS_NOTES, ATLAS_OTHER_COLOR, BEACH_LEVEL_OPTIONS, DREDGING_STATUS_OPTIONS,
  ECOLOGY_SPECIES_STEPS, ECO_SENSITIVE_LEVEL_OPTIONS, EMERGENCY_BAY_OPTIONS, FLOOD_INFO_SOURCE_OPTIONS, FREEWAY_SIGN_GROUP_OPTIONS,
  GATE_KIND_OPTIONS, INTERCHANGE_TYPE_OPTIONS, ISOLATION_CAUSE_OPTIONS, MICROPLASTIC_STEPS, MONITOR_SERIES_OPTIONS, PLACE_CATEGORY_OPTIONS,
  POLLUTION_LEVEL_OPTIONS, ROAD_SIGN_SERIES_OPTIONS, RURAL_COMMUNITY_OPTIONS, STRUCTURE_CATEGORY_OPTIONS, SWCB_PHOTO_CATEGORY_OPTIONS,
  TRIANGULATION_GRADE_OPTIONS, TRIBE_ETHNIC_OPTIONS, TRIBE_NOT_APPROVED_COLOR, TURTLE_SPECIES_OPTIONS,
  type AtlasLayerKey,
} from "../../data/atlasLayerTypes";

type Swatch = "dot" | "square" | "line";
type Row = { label: string; color: string };

function swatchOf(kind: Swatch, color: string): ReactNode {
  if (kind === "square") return <SwatchSquare color={color} />;
  if (kind === "line") return <SwatchLine color={color} width={3} />;
  return <SwatchDot color={color} />;
}

/** 一張 atlas 圖例：標題＋色塊列＋說明（ATLAS_NOTES）＋來源。 */
function AtlasLegend({ layer, zh, en, rows, kind = "dot", source }: { layer: AtlasLayerKey; zh: string; en: string; rows: readonly Row[]; kind?: Swatch; source: string }) {
  return <div>
    <LegendTitle zh={zh} en={en} />
    {rows.map((row) => <LegendRow key={row.label} swatch={swatchOf(kind, row.color)}>{row.label}</LegendRow>)}
    <LegendNote>{ATLAS_NOTES[layer]}{source} · 政府資料開放授權條款第1版。</LegendNote>
  </div>;
}

const single = (layer: AtlasLayerKey, label: string): Row[] => [{ label, color: ATLAS_LAYER_COLORS[layer] }];
const flagRow: Row = { label: "座標與通報縣市不一致（疑誤）", color: ATLAS_FLAG_COLOR };

export const ATLAS_LEGENDS: Record<AtlasLayerKey, () => ReactNode> = {
  indigenousTribes: () => <AtlasLegend layer="indigenousTribes" zh="原住民族部落" en="Indigenous Tribes" source="原住民族委員會（data.gov.tw 156632、7093）"
    rows={[...TRIBE_ETHNIC_OPTIONS, { label: "其他／多族並列", color: ATLAS_OTHER_COLOR }, { label: "不在現行核定名單", color: TRIBE_NOT_APPROVED_COLOR }]} />,
  indigenousIsolationRisk: () => <AtlasLegend layer="indigenousIsolationRisk" zh="原鄉易成孤島地區" en="Isolation-risk Areas" source="原住民族委員會（data.gov.tw 170259）" rows={ISOLATION_CAUSE_OPTIONS} />,
  agriRuralCommunityVillages: () => <AtlasLegend layer="agriRuralCommunityVillages" zh="農村社區分類" en="Rural Community Villages" kind="square" source="農業部農村發展及水土保持署" rows={RURAL_COMMUNITY_OPTIONS} />,
  provincialRoadSigns: () => <AtlasLegend layer="provincialRoadSigns" zh="省道交通標誌" en="Provincial Road Signs" source="交通部公路局（data.gov.tw 146233 等）" rows={ROAD_SIGN_SERIES_OPTIONS} />,
  provincialRoadMileposts: () => <AtlasLegend layer="provincialRoadMileposts" zh="省道里程牌" en="Provincial Road Mileposts" source="交通部公路局（data.gov.tw 7040）" rows={single("provincialRoadMileposts", "里程牌")} />,
  freewayTrafficSigns: () => <AtlasLegend layer="freewayTrafficSigns" zh="國道交通標誌" en="Freeway Traffic Signs" source="交通部高速公路局（data.gov.tw 98447）" rows={FREEWAY_SIGN_GROUP_OPTIONS} />,
  freewayInterchanges: () => <AtlasLegend layer="freewayInterchanges" zh="國道交流道" en="Freeway Interchanges" source="交通部高速公路局（data.gov.tw 166496）" rows={INTERCHANGE_TYPE_OPTIONS} />,
  freewayEcoSensitive: () => <AtlasLegend layer="freewayEcoSensitive" zh="國道生態敏感路段" en="Freeway Eco-sensitive Sections" kind="square" source="交通部高速公路局（data.gov.tw 31290）" rows={ECO_SENSITIVE_LEVEL_OPTIONS} />,
  provincialRoadMonitored: () => <AtlasLegend layer="provincialRoadMonitored" zh="省道防救災監控路段" en="Monitored Road Sections" kind="line" source="交通部公路局（data.gov.tw 16193 等）" rows={MONITOR_SERIES_OPTIONS} />,
  provincialRoadEmergencyBays: () => <AtlasLegend layer="provincialRoadEmergencyBays" zh="省道緊急避車彎" en="Emergency Bays" source="交通部公路局（data.gov.tw 99940）" rows={EMERGENCY_BAY_OPTIONS} />,
  floodDisasterPointsNcdr: () => <AtlasLegend layer="floodDisasterPointsNcdr" zh="淹水災點" en="Flood Disaster Points" source="國家災害防救科技中心（data.gov.tw 130016 等）"
    rows={[...FLOOD_INFO_SOURCE_OPTIONS, { label: "其他來源", color: ATLAS_OTHER_COLOR }]} />,
  taipeiWaterloggingHistory: () => <AtlasLegend layer="taipeiWaterloggingHistory" zh="臺北市歷年積水範圍" en="Taipei Waterlogging History" kind="square" source="臺北市政府工務局水利工程處（data.gov.tw 143898）" rows={single("taipeiWaterloggingHistory", "積水範圍")} />,
  swcbDisasterPhotoPoints: () => <AtlasLegend layer="swcbDisasterPhotoPoints" zh="土砂災害照片點位" en="Sediment Disaster Photos" source="農業部農村發展及水土保持署（data.gov.tw 138000、174226）" rows={SWCB_PHOTO_CATEGORY_OPTIONS} />,
  cetaceanStrandings: () => <AtlasLegend layer="cetaceanStrandings" zh="鯨豚擱淺" en="Cetacean Strandings" source="海洋委員會海洋保育署 MARN（data.gov.tw 157624）" rows={[...ANIMAL_STATUS_OPTIONS, flagRow]} />,
  seaTurtleStrandings: () => <AtlasLegend layer="seaTurtleStrandings" zh="海龜擱淺" en="Sea Turtle Strandings" source="海洋委員會海洋保育署 MARN"
    rows={[...TURTLE_SPECIES_OPTIONS, { label: "無法辨認", color: ATLAS_OTHER_COLOR }, flagRow]} />,
  beachWaterQuality: () => <AtlasLegend layer="beachWaterQuality" zh="海水浴場水質" en="Beach Water Quality" source="環境部" rows={BEACH_LEVEL_OPTIONS} />,
  marineMicroplastics: () => <AtlasLegend layer="marineMicroplastics" zh="海洋微塑膠（表層平均，個／m³）" en="Marine Microplastics" source="海洋委員會"
    rows={MICROPLASTIC_STEPS.map((step) => ({ label: step.label, color: step.color }))} />,
  marinePollutionIncidents: () => <AtlasLegend layer="marinePollutionIncidents" zh="海洋污染事件" en="Marine Pollution Incidents" source="海洋委員會海洋保育署" rows={POLLUTION_LEVEL_OPTIONS} />,
  namrEdnaSurveySites: () => <AtlasLegend layer="namrEdnaSurveySites" zh="環境 DNA 調查站位" en="eDNA Survey Sites" source="國家海洋研究院" rows={single("namrEdnaSurveySites", "調查站位")} />,
  placeNames: () => <AtlasLegend layer="placeNames" zh="臺灣地名" en="Taiwan Place Names" source="內政部地政司（data.gov.tw 40281 等）" rows={PLACE_CATEGORY_OPTIONS} />,
  triangulationPoints: () => <AtlasLegend layer="triangulationPoints" zh="三角點" en="Triangulation Points" source="內政部國土測繪中心（data.gov.tw 26485）" rows={TRIANGULATION_GRADE_OPTIONS} />,
  wraFloodgatesCentral: () => <AtlasLegend layer="wraFloodgatesCentral" zh="中央管水門" en="Central Floodgates" source="經濟部水利署（data.gov.tw 32722）" rows={GATE_KIND_OPTIONS} />,
  wraCentralDrainage: () => <AtlasLegend layer="wraCentralDrainage" zh="中央管區域排水" en="Central Regional Drainage" kind="square" source="經濟部水利署" rows={single("wraCentralDrainage", "排水設施範圍")} />,
  iowStructureMonitoring: () => <AtlasLegend layer="iowStructureMonitoring" zh="水利結構監測站" en="IoW Structure Monitoring" source="經濟部水利署（data.gov.tw 142981 等）" rows={STRUCTURE_CATEGORY_OPTIONS} />,
  wraDredgingPoints: () => <AtlasLegend layer="wraDredgingPoints" zh="河川疏濬工程" en="River Dredging" source="經濟部水利署" rows={DREDGING_STATUS_OPTIONS} />,
  wraEcologySurveySites: () => <AtlasLegend layer="wraEcologySurveySites" zh="河川生態調查站（物種數）" en="River Ecology Survey Sites" source="經濟部水利署"
    rows={ECOLOGY_SPECIES_STEPS.map((step) => ({ label: step.label, color: step.color }))} />,
};

import type { FC } from "react";
import { Row, Title } from "./shared";
import { useFeatureTheme } from "./featureTheme";
import { useLocale, type LocaleSnapshot } from "../../state/localeStore";
import {
  ANIMAL_STATUS_OPTIONS, ATLAS_FLAG_COLOR, ATLAS_LAYER_COLORS, BEACH_LEVEL_OPTIONS, DREDGING_STATUS_OPTIONS, FLOOD_INFO_SOURCE_OPTIONS,
  FREEWAY_SIGN_GROUP_OPTIONS, GATE_KIND_OPTIONS, INTERCHANGE_TYPE_OPTIONS, ISOLATION_CAUSE_OPTIONS, MONITOR_SERIES_OPTIONS,
  PLACE_CATEGORY_OPTIONS, POLLUTION_LEVEL_OPTIONS, ROAD_SIGN_SERIES_OPTIONS, RURAL_COMMUNITY_OPTIONS, STRUCTURE_CATEGORY_OPTIONS,
  SWCB_PHOTO_CATEGORY_OPTIONS, TRIANGULATION_GRADE_OPTIONS, TRIBE_ETHNIC_OPTIONS, TRIBE_NOT_APPROVED_COLOR, TURTLE_SPECIES_OPTIONS,
  optionColor, type AtlasLayerKey,
} from "../../data/atlasLayerTypes";

/**
 * atlas 批次 2026-10 的 26 層 popup。來源 footer 由 FeatureInfoPanel 統一掛（每筆都帶
 * source_org／source_url／license／fetched_at）；這裡顯示上游中文 `<欄>_label`、座標精度
 * （`precision_note`，旗標原值另列）與資料日期（vintage）。
 * 本檔是新面板（i18n 報告區），文字照中文正本寫，日後翻譯時搬進 popup.atlas.json。
 */
type Props = { props: Record<string, unknown> };

const str = (v: unknown): string => (v == null || v === "" ? "" : String(v));
const num = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" && v !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};
const fmt = (v: unknown, digits: number, unit: string, { formatNumber }: LocaleSnapshot): string => {
  const n = num(v);
  return n == null ? "" : `${formatNumber(n, { maximumFractionDigits: digits })}${unit ? ` ${unit}` : ""}`;
};
const yesNo = (v: unknown, yes: string, no: string): string => (v === true ? yes : v === false ? no : "");
const admin = (p: Record<string, unknown>) => [p.county, p.town, p.village].map(str).join("");
const time = (v: unknown) => str(v).replace("T", " ").slice(0, 16);

/** 座標精度列：疑誤旗標用警示色 */
function Precision({ props, flagged = false }: Props & { flagged?: boolean }) {
  const theme = useFeatureTheme();
  return <Row field="coordPrecision" value={str(props.precision_note)} color={flagged ? theme.warn : undefined} />;
}
const DataDate = ({ props }: Props) => <Row field="dataDate" value={str(props.vintage)} mono />;

function IndigenousTribePanel({ props }: Props) {
  const approved = props.in_current_approved_list;
  const color = approved === false ? TRIBE_NOT_APPROVED_COLOR : optionColor(TRIBE_ETHNIC_OPTIONS, props.ethnic_group);
  return <>
    <Title color={color}>{str(props.name) || "部落"}</Title>
    <Row label="族語名" value={str(props.tribe_name_roman)} />
    <Row label="族別" value={str(props.ethnic_group)} color={color} />
    <Row field="district" value={admin(props)} />
    <Row label="鄰" value={str(props.neighborhoods)} />
    <Row label="核定狀態" value={approved === false ? "不在現行核定部落名單" : [str(props.approved_name), num(props.approved_roc_year) != null ? `民國 ${props.approved_roc_year} 年核定` : ""].filter(Boolean).join("，")} />
    <Precision props={props} flagged={Boolean(str(props.quality_flags))} />
    <DataDate props={props} />
  </>;
}

function IndigenousIsolationPanel({ props }: Props) {
  const i18n = useLocale();
  const color = optionColor(ISOLATION_CAUSE_OPTIONS, props.cause_combo);
  const causes = [props.cause_debris_flow === true && "土石流", props.cause_flood === true && "淹水", props.cause_road_bridge_break === true && "道路橋梁中斷"].filter(Boolean).join("、");
  return <>
    <Title color={color}>{`${str(props.town)}${str(props.name)}`}</Title>
    <Row label="成因" value={causes || "未勾選"} color={color} />
    <Row label="曾發生孤島" value={yesNo(props.has_past_incident, "是", "否")} />
    <Row label="步行至鄉公所" value={fmt(props.walk_hours_to_office, 1, "小時", i18n)} />
    <Row label="戶數／人口" value={[fmt(props.households, 0, "戶", i18n), fmt(props.population, 0, "人", i18n)].filter(Boolean).join("／")} />
    <Row label="65 歲以上／嬰幼兒／重症" value={[props.elderly_65plus, props.infants, props.critical_patients].map((v) => (num(v) == null ? "—" : String(v))).join("／")} />
    <Row label="保全戶／保全人數" value={[fmt(props.protected_households, 0, "戶", i18n), fmt(props.protected_persons, 0, "人", i18n)].filter(Boolean).join("／")} />
    <Row field="county" value={str(props.county)} />
    <Precision props={props} flagged={Boolean(str(props.quality_flags))} />
    <DataDate props={props} />
  </>;
}

function RuralCommunityPanel({ props }: Props) {
  const i18n = useLocale();
  const color = optionColor(RURAL_COMMUNITY_OPTIONS, props.community_type);
  return <>
    <Title color={color}>{admin(props) || "村里"}</Title>
    <Row field="type" value={str(props.community_type)} color={color} />
    <Row field="area" value={fmt(props.area_ha, 1, "公頃", i18n)} />
    <Row label="村里代碼" value={`${str(props.id)}${props.villcode_in_current_boundary === false ? "（不在現行村里界）" : ""}`} mono />
    <DataDate props={props} />
  </>;
}

function RoadSignPanel({ props }: Props) {
  const color = props.sign_series ? optionColor(ROAD_SIGN_SERIES_OPTIONS, props.sign_series) : ATLAS_LAYER_COLORS.provincialRoadMileposts;
  const face = [str(props.face_value), str(props.face_value_unit) === "km" ? "" : str(props.face_value_unit)].filter(Boolean).join(" ");
  return <>
    <Title color={color}>{`${str(props.route_no)} ${str(props.stake)}`.trim() || "省道標誌"}</Title>
    <Row field="category" value={[str(props.sign_series_label), str(props.sign_code_label)].filter(Boolean).join("・")} color={color} />
    <Row label="牌面" value={face} />
    <Row field="direction" value={[str(props.facing), str(props.mount_position)].filter(Boolean).join("・")} />
    <Row label="狀況" value={str(props.condition)} />
    <Row field="district" value={admin(props)} />
    <Row field="managingAgency" value={str(props.maint_section)} />
    <Row field="surveyDate" value={str(props.survey_date)} mono />
    <Precision props={props} flagged={props.coord_flag === "tm2_conflict"} />
  </>;
}

function FreewaySignPanel({ props }: Props) {
  const i18n = useLocale();
  const color = optionColor(FREEWAY_SIGN_GROUP_OPTIONS, props.sign_group);
  return <>
    <Title color={color}>{`${str(props.route_name)} ${fmt(props.stake_km, 3, "K", i18n)}`.trim()}</Title>
    <Row field="category" value={str(props.sign_code_label) || "（來源未給代碼名稱）"} color={color} />
    <Row field="code" value={str(props.sign_code)} mono />
    <Row label="牌面" value={str(props.face_value)} />
    <Row field="direction" value={str(props.direction_note)} />
    <Row field="county" value={str(props.county)} />
    <Precision props={props} flagged={props.coord_flag === "tm2_conflict"} />
  </>;
}

function InterchangePanel({ props }: Props) {
  const i18n = useLocale();
  const color = optionColor(INTERCHANGE_TYPE_OPTIONS, props.facility_type);
  return <>
    <Title color={color}>{str(props.name)}</Title>
    <Row field="route" value={str(props.route_name)} />
    <Row field="type" value={str(props.facility_type_label)} color={color} />
    <Row label="里程" value={fmt(props.mileage_km, 1, "公里", i18n)} />
    <Precision props={props} />
  </>;
}

function EcoSensitivePanel({ props }: Props) {
  const i18n = useLocale();
  return <>
    <Title color={ATLAS_LAYER_COLORS.freewayEcoSensitive}>國道生態敏感路段</Title>
    <Row field="level" value={num(props.sensi_level) != null ? `來源分級 ${props.sensi_level}（方向未說明）` : ""} />
    <Row field="area" value={fmt(props.area_m2, 0, "m²", i18n)} />
  </>;
}

function MonitoredPanel({ props }: Props) {
  const color = optionColor(MONITOR_SERIES_OPTIONS, props.monitor_series);
  return <>
    <Title color={color}>{str(props.route_text) || "省道監控路段"}</Title>
    <Row field="category" value={str(props.monitor_series_label)} color={color} />
    <Row field="district" value={admin(props)} />
    <Row field="managingAgency" value={str(props.maint_unit)} />
    <Row label="雨量站" value={str(props.rainfall_station_id)} mono />
    <Row label="預警門檻" value={str(props.rule_earlywarning)} />
    <Row label="警戒門檻" value={str(props.rule_warning)} />
    <Row label="行動門檻" value={str(props.rule_action)} />
    <Precision props={props} flagged={props.geometry_source === "start_coordinate"} />
    <Row field="updated" value={time(props.source_updated_at)} mono />
  </>;
}

function EmergencyBayPanel({ props }: Props) {
  return <>
    <Title color={ATLAS_LAYER_COLORS.provincialRoadEmergencyBays}>{str(props.route_text) || "緊急避車彎"}</Title>
    <Row field="district" value={admin(props)} />
    <Row field="managingAgency" value={str(props.maint_unit)} />
    <Row label="清單年度" value={str(props.roc_years) ? `民國 ${str(props.roc_years)} 年` : ""} />
    <Row label="最新清單" value={yesNo(props.in_latest_list, "有列", "未列（只出現在舊年度）")} />
    <Precision props={props} />
  </>;
}

function FloodPointPanel({ props }: Props) {
  const color = optionColor(FLOOD_INFO_SOURCE_OPTIONS, props.info_source);
  return <>
    <Title color={color}>{`${str(props.event_year)} 年淹水災點`}</Title>
    <Row label="情資來源" value={str(props.info_source_label)} color={color} />
    <Row field="county" value={str(props.county)} />
    <Row label="同點列數" value={num(props.same_point_rows) != null && num(props.same_point_rows)! > 1 ? `${props.same_point_rows}（同年同點多筆通報）` : ""} />
    <Precision props={props} />
    <DataDate props={props} />
  </>;
}

function WaterloggingPanel({ props }: Props) {
  const i18n = useLocale();
  return <>
    <Title color={ATLAS_LAYER_COLORS.taipeiWaterloggingHistory}>{str(props.location_text) || "積水範圍"}</Title>
    <Row field="date" value={str(props.event_date) || (num(props.event_year) != null ? `${props.event_year} 年` : "未載日期")} mono />
    <Row field="district" value={str(props.town)} />
    <Row label="積水深度" value={fmt(props.depth_cm, 0, "公分（推定）", i18n)} />
    <Row field="area" value={fmt(props.area_m2, 0, "m²", i18n)} />
    <Row label="屬性完整度" value={str(props.attribute_status_label)} />
    <Precision props={props} />
  </>;
}

function SwcbPhotoPanel({ props }: Props) {
  const color = optionColor(SWCB_PHOTO_CATEGORY_OPTIONS, props.photo_category);
  return <>
    <Title color={color}>{str(props.disaster_name) || str(props.photo_category_label)}</Title>
    <Row field="category" value={str(props.photo_category_label)} color={color} />
    <Row field="description" value={str(props.description)} />
    <Row label="拍攝日" value={str(props.photo_date)} mono />
    <Row label="災害年" value={`${str(props.disaster_year)}${props.photo_year_mismatch === true ? "（與拍攝年不同）" : ""}`} />
    <Row field="district" value={admin(props)} />
    <Row field="place" value={str(props.landmark)} />
    <Row label="照片提供" value={str(props.photo_credit)} />
    <Row label="照片連結" value={str(props.photo_url)} mono />
    <Row label="新聞連結" value={str(props.news_url)} mono />
    <Precision props={props} />
  </>;
}

function strandingTitle(p: Record<string, unknown>) {
  return `${str(p.event_date)} ${str(p.species_zh)}`.trim();
}

function CetaceanPanel({ props }: Props) {
  const i18n = useLocale();
  const flagged = props.coord_status === "suspect_county_mismatch";
  const color = flagged ? ATLAS_FLAG_COLOR : optionColor(ANIMAL_STATUS_OPTIONS, props.animal_status);
  return <>
    <Title color={color}>{strandingTitle(props)}</Title>
    <Row label="學名" value={str(props.scientific_name)} />
    <Row field="status" value={str(props.animal_status)} color={optionColor(ANIMAL_STATUS_OPTIONS, props.animal_status)} />
    <Row label="群體擱淺" value={str(props.group_flag)} />
    <Row label="體長" value={fmt(props.body_length_m, 2, "公尺", i18n)} />
    <Row label="處置" value={str(props.handling)} />
    <Row label="通報者" value={str(props.reporter_category)} />
    <Row field="county" value={str(props.county)} />
    <Precision props={props} flagged={flagged || props.coord_status === "out_of_bbox"} />
    <DataDate props={props} />
  </>;
}

function TurtlePanel({ props }: Props) {
  const i18n = useLocale();
  const flagged = props.coord_status === "suspect_county_mismatch";
  const color = flagged ? ATLAS_FLAG_COLOR : optionColor(TURTLE_SPECIES_OPTIONS, props.species_zh);
  return <>
    <Title color={color}>{strandingTitle(props)}</Title>
    <Row label="學名" value={str(props.scientific_name)} />
    <Row field="status" value={str(props.animal_status)} color={optionColor(ANIMAL_STATUS_OPTIONS, props.animal_status)} />
    <Row label="擱淺原因" value={str(props.stranding_cause)} />
    <Row label="背甲長" value={fmt(props.carapace_length_cm, 1, "公分", i18n)} />
    <Row label="處置" value={str(props.handling)} />
    <Row field="county" value={str(props.county)} />
    <Precision props={props} flagged={flagged || props.coord_status === "out_of_bbox"} />
    <DataDate props={props} />
  </>;
}

function BeachPanel({ props }: Props) {
  const color = optionColor(BEACH_LEVEL_OPTIONS, props.latest_water_level_code);
  return <>
    <Title color={color}>{str(props.name)}</Title>
    <Row label="最近水質" value={`${str(props.latest_water_level)}（${str(props.last_sample_date)}）`} color={color} />
    <Row label="大腸桿菌" value={str(props.latest_e_coli) ? `${str(props.latest_e_coli)} CFU/100mL` : ""} />
    <Row label="腸球菌" value={str(props.latest_enterococcus) ? `${str(props.latest_enterococcus)} CFU/100mL` : ""} />
    <Row field="sampleCount" value={str(props.sample_count) ? `${props.sample_count} 次（其中不宜親水 ${str(props.unsuitable_count) || 0} 次）` : ""} />
    <Row label="採樣年份" value={str(props.years_sampled).replace(/,/g, "、")} />
    <Row field="limits" value="只在游泳季採樣" />
    <Precision props={props} />
  </>;
}

function MicroplasticsPanel({ props }: Props) {
  const i18n = useLocale();
  return <>
    <Title color={ATLAS_LAYER_COLORS.marineMicroplastics}>{`微塑膠調查站 ${str(props.name)}`}</Title>
    <Row field="region" value={str(props.sea_area_label)} />
    <Row label="表層平均" value={fmt(props.surface_mean_total_per_m3, 1, "個／m³", i18n)} />
    <Row label="表層最大" value={fmt(props.surface_max_total_per_m3, 1, "個／m³", i18n)} />
    <Row label="航次／樣本" value={`${str(props.cruise_count)} 航次／${str(props.sample_count)} 樣本`} />
    <Row label="調查期間" value={`${str(props.first_survey_month)}～${str(props.last_survey_month)}`} mono />
    <Precision props={props} flagged={props.coord_quality === "inconsistent_positions_review"} />
  </>;
}

function PollutionPanel({ props }: Props) {
  const color = optionColor(POLLUTION_LEVEL_OPTIONS, props.case_level);
  return <>
    <Title color={color}>{str(props.name)}</Title>
    <Row field="level" value={str(props.case_level_label)} color={color} />
    <Row field="occurredAt" value={time(props.occurred_at)} mono />
    <Row label="結案時間" value={time(props.ended_at)} mono />
    <Row field="location" value={str(props.site_description)} />
    <Row label="通報單位" value={str(props.reporting_agency)} />
    <Row label="責任海域" value={props.outside_tw_responsibility === true ? "我國責任海域外" : ""} />
    <Row field="number" value={str(props.id)} mono />
    <Precision props={props} flagged={props.coord_status === "out_of_bbox"} />
  </>;
}

function EdnaPanel({ props }: Props) {
  return <>
    <Title color={ATLAS_LAYER_COLORS.namrEdnaSurveySites}>{str(props.name)}</Title>
    <Row field="region" value={[str(props.region_major), str(props.region_minor)].filter(Boolean).join("・")} />
    <Row field="code" value={str(props.region_code)} mono />
    <Precision props={props} />
  </>;
}

function PlaceNamePanel({ props }: Props) {
  const color = optionColor(PLACE_CATEGORY_OPTIONS, props.category);
  return <>
    <Title color={color}>{str(props.name)}</Title>
    <Row field="category" value={str(props.category_label)} color={color} />
    <Row field="englishName" value={str(props.name_hanyu_pinyin)} />
    <Row label="別名" value={str(props.aliases)} />
    <Row field="district" value={admin(props)} />
    <Row label="地名由來" value={str(props.place_meaning)} />
    <Row label="點位意義" value={str(props.extent_type_label)} />
    <Row field="dataSource" value={str(props.data_source_labels)} />
    <Precision props={props} flagged={(num(props.coord_precision_m) ?? 0) >= 1000} />
  </>;
}

function TriangulationPanel({ props }: Props) {
  const i18n = useLocale();
  const color = optionColor(TRIANGULATION_GRADE_OPTIONS, String(props.grade ?? ""));
  return <>
    <Title color={color}>{str(props.name) || "（無名三角點）"}</Title>
    <Row field="level" value={str(props.grade_label)} color={color} />
    <Row field="elevation" value={fmt(props.elevation_m, 2, "公尺", i18n)} />
    <Row label="圖幅" value={str(props.map_sheet)} />
    <Row label="點號" value={str(props.mark_no)} mono />
    <Row label="標石" value={str(props.mark_material)} />
    <Precision props={props} />
  </>;
}

function FloodgatePanel({ props }: Props) {
  const color = optionColor(GATE_KIND_OPTIONS, props.gate_kind);
  return <>
    <Title color={color}>{str(props.name) || str(props.gate_kind_label)}</Title>
    <Row field="type" value={str(props.gate_kind_label)} color={color} />
    <Row field="river" value={[str(props.river_name), str(props.bank)].filter(Boolean).join("・")} />
    <Row label="操作方式" value={str(props.operation_type_label)} />
    <Row label="規格" value={str(props.gate_spec_raw)} />
    <Row label="材質" value={str(props.material_raw)} />
    <Row field="county" value={str(props.county)} />
    <Row field="managingAgency" value={str(props.river_branch_label)} />
    <Row field="surveyDate" value={str(props.survey_date)} mono />
    <Row field="caution" value="1999–2000 年測量成果，非現況，沒有啟閉狀態" />
    <Precision props={props} />
  </>;
}

function DrainagePanel({ props }: Props) {
  const i18n = useLocale();
  return <>
    <Title color={ATLAS_LAYER_COLORS.wraCentralDrainage}>{str(props.name)}</Title>
    <Row field="basin" value={str(props.basin_name)} />
    <Row label="出口" value={str(props.outlet)} />
    <Row field="length" value={fmt(props.main_length_km, 1, "公里", i18n)} />
    <Row label="流經縣市" value={str(props.passing_county_names)} />
    <Row label="起點" value={str(props.start_desc)} />
    <Row label="終點" value={str(props.end_desc)} />
    <Row field="authority" value={str(props.responsible_authority)} />
    <Row field="area" value={fmt(props.area_km2, 3, "km²", i18n)} />
  </>;
}

function IowPanel({ props }: Props) {
  const i18n = useLocale();
  const color = optionColor(STRUCTURE_CATEGORY_OPTIONS, props.structure_category);
  return <>
    <Title color={color}>{str(props.name)}</Title>
    <Row field="category" value={str(props.structure_category_label)} color={color} />
    <Row label="感測項目" value={`${str(props.sensor_kinds)}${num(props.sensor_count) != null ? `（${props.sensor_count} 個）` : ""}`} />
    <Row field="managingAgency" value={str(props.org_name)} />
    <Row field="district" value={admin(props)} />
    <Row label="最近水門" value={str(props.nearest_floodgate_name) ? `${str(props.nearest_floodgate_name)}（${fmt(props.nearest_floodgate_m, 0, "m", i18n)}）` : ""} />
    <Precision props={props} />
  </>;
}

function DredgingPanel({ props }: Props) {
  const i18n = useLocale();
  const color = optionColor(DREDGING_STATUS_OPTIONS, props.status);
  const unit = str(props.quantity_unit) === "unspecified" ? "（單位未註明）" : str(props.quantity_unit);
  return <>
    <Title color={color}>{str(props.name)}</Title>
    <Row field="status" value={str(props.status_label)} color={color} />
    <Row field="river" value={str(props.river_name)} />
    <Row label="執行單位" value={str(props.executing_unit)} />
    <Row label="工期" value={`${str(props.start_date)}～${str(props.end_date)}`} mono />
    <Row label="計畫／執行量" value={`${fmt(props.plan_quantity, 1, "", i18n)}／${fmt(props.execute_quantity, 1, "", i18n)} ${unit}`} />
    <Row field="county" value={str(props.county)} />
    <Precision props={props} flagged={props.coord_precision !== "deg_0.01"} />
    <DataDate props={props} />
  </>;
}

function EcologyPanel({ props }: Props) {
  return <>
    <Title color={ATLAS_LAYER_COLORS.wraEcologySurveySites}>{str(props.name) || "生態調查站"}</Title>
    <Row field="river" value={[str(props.river_name), str(props.basin_name)].filter(Boolean).join("・")} />
    <Row label="物種數" value={str(props.species_count)} />
    <Row label="紀錄筆數" value={str(props.record_count)} />
    <Row label="類群" value={str(props.taxon_groups_label)} />
    <Row label="調查期間" value={`${str(props.first_survey_date)}～${str(props.last_survey_date)}`} mono />
    <Row field="county" value={str(props.county)} />
    <Row field="caution" value="1995–2019 調查，2019 後停更" />
    <Precision props={props} />
  </>;
}

export const ATLAS_PANELS: Record<AtlasLayerKey, FC<Props>> = {
  indigenousTribes: IndigenousTribePanel,
  indigenousIsolationRisk: IndigenousIsolationPanel,
  agriRuralCommunityVillages: RuralCommunityPanel,
  provincialRoadSigns: RoadSignPanel,
  provincialRoadMileposts: RoadSignPanel,
  freewayTrafficSigns: FreewaySignPanel,
  freewayInterchanges: InterchangePanel,
  freewayEcoSensitive: EcoSensitivePanel,
  provincialRoadMonitored: MonitoredPanel,
  provincialRoadEmergencyBays: EmergencyBayPanel,
  floodDisasterPointsNcdr: FloodPointPanel,
  taipeiWaterloggingHistory: WaterloggingPanel,
  swcbDisasterPhotoPoints: SwcbPhotoPanel,
  cetaceanStrandings: CetaceanPanel,
  seaTurtleStrandings: TurtlePanel,
  beachWaterQuality: BeachPanel,
  marineMicroplastics: MicroplasticsPanel,
  marinePollutionIncidents: PollutionPanel,
  namrEdnaSurveySites: EdnaPanel,
  placeNames: PlaceNamePanel,
  triangulationPoints: TriangulationPanel,
  wraFloodgatesCentral: FloodgatePanel,
  wraCentralDrainage: DrainagePanel,
  iowStructureMonitoring: IowPanel,
  wraDredgingPoints: DredgingPanel,
  wraEcologySurveySites: EcologyPanel,
};

/** 說明框標題列 */
export const ATLAS_HEADER_LABELS: Record<AtlasLayerKey, string> = {
  indigenousTribes: "原住民族部落",
  indigenousIsolationRisk: "原鄉易成孤島地區",
  agriRuralCommunityVillages: "農村社區分類",
  provincialRoadSigns: "省道交通標誌",
  provincialRoadMileposts: "省道里程牌",
  freewayTrafficSigns: "國道交通標誌",
  freewayInterchanges: "國道交流道",
  freewayEcoSensitive: "國道生態敏感路段",
  provincialRoadMonitored: "省道防救災監控路段",
  provincialRoadEmergencyBays: "省道緊急避車彎",
  floodDisasterPointsNcdr: "淹水災點",
  taipeiWaterloggingHistory: "臺北市歷年積水",
  swcbDisasterPhotoPoints: "土砂災害照片",
  cetaceanStrandings: "鯨豚擱淺",
  seaTurtleStrandings: "海龜擱淺",
  beachWaterQuality: "海水浴場水質",
  marineMicroplastics: "海洋微塑膠調查",
  marinePollutionIncidents: "海洋污染事件",
  namrEdnaSurveySites: "環境 DNA 調查站位",
  placeNames: "臺灣地名",
  triangulationPoints: "三角點",
  wraFloodgatesCentral: "中央管水門",
  wraCentralDrainage: "中央管區域排水",
  iowStructureMonitoring: "水利結構監測站",
  wraDredgingPoints: "河川疏濬工程",
  wraEcologySurveySites: "河川生態調查站",
};

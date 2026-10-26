import { JP_POLICE_FACILITY_TYPES, JP_POLICE_LAYER_COLOR, JP_POLICE_ATTRIBUTION } from "../../data/jpPoliceFacilityTypes";
import { JP_EVACUATION_SITE_TYPES, JP_EVACUATION_HAZARDS, JP_EVACUATION_LAYER_COLOR, JP_EVACUATION_ATTRIBUTION, JP_EVACUATION_DATA_AS_OF, JP_EVACUATION_SOURCE_URL, JP_EVACUATION_LICENSE } from "../../data/jpEvacuationSiteTypes";
import { JP_PUBLIC_OFFICE_CLASSES, JP_PUBLIC_OFFICE_LAYER_COLOR, JP_PUBLIC_OFFICE_ATTRIBUTION, JP_PUBLIC_OFFICE_DATA_AS_OF, JP_PUBLIC_OFFICE_SOURCE_URL, JP_PUBLIC_OFFICE_LICENSE } from "../../data/jpPublicOfficeTypes";
import { JP_BUS_STOP_CLASSES, JP_BUS_STOP_LAYER_COLOR, JP_BUS_STOP_ATTRIBUTION, JP_BUS_STOP_DATA_AS_OF, JP_BUS_STOP_SOURCE_URL, JP_BUS_STOP_LICENSE, JP_PREFECTURE_NAMES } from "../../data/jpBusStopTypes";
import { Row, SourceFooter, Title } from "./shared";
import { useLocale } from "../../state/localeStore";
import { enumLabel } from "../../i18n/dataText";
import {
  JP_RAILWAY_LAYER_COLOR,
  JP_RAILWAY_TYPES,
  JP_RAILWAY_TYPE_OTHER,
} from "../../data/jpRailwayTypes";
import { JP_SCHOOL_TYPES, JP_SCHOOL_TYPE_OTHER } from "../../data/jpSchoolTypes";
import {
  JP_POPULATION_MESH_MODES, JP_POPULATION_MESH_LAYER_COLOR, JP_POPULATION_MESH_MASK,
} from "../../data/jpPopulationMeshModes";
import { JP_WATER_FACILITY_CATEGORIES } from "../../data/jpWaterTypes";
import {
  JP_LANDSLIDE_ZONES, JP_LANDSLIDE_PHENOMENA, JP_LANDSLIDE_DESIGNATIONS, JP_LANDSLIDE_LAYER_COLOR,
  JP_LANDSLIDE_ATTRIBUTION, JP_LANDSLIDE_SOURCE_URL, JP_LANDSLIDE_LICENSE, JP_LANDSLIDE_DATA_AS_OF,
} from "../../data/jpLandslideWarningTypes";
import { JP_ZONING_CLASSES, JP_ZONING_LAYER_COLOR, JP_ZONING_ATTRIBUTION, JP_ZONING_SOURCE_URL, JP_ZONING_LICENSE, JP_ZONING_DATA_AS_OF } from "../../data/jpZoningUseDistrictTypes";
import {
  JP_FOREST_FUNCTION_TYPES, JP_FOREST_BLANK_COLOR, JP_FOREST_PROTECTION, JP_FOREST_PROTECTED, JP_FOREST_PLANNED_SUFFIX,
  JP_FOREST_ATTRIBUTION, JP_FOREST_SOURCE_URL, JP_FOREST_LICENSE, JP_FOREST_DATA_AS_OF,
} from "../../data/jpNationalForestTypes";
import {
  JP_INLAND_FLOOD_DEPTH_CLASSES, JP_INLAND_FLOOD_LAYER_COLOR,
  JP_INLAND_FLOOD_ATTRIBUTION, JP_INLAND_FLOOD_SOURCE_URL, JP_INLAND_FLOOD_LICENSE, JP_INLAND_FLOOD_DATA_AS_OF,
} from "../../data/jpInlandFloodTypes";

const str = (v: unknown): string => (v == null || v === "" ? "" : String(v));

function list(raw: unknown): string {
  if (Array.isArray(raw)) return raw.map(String).join(" / ");
  if (typeof raw !== "string" || !raw) return "";
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map((item) => typeof item === "object" && item && "source" in item ? String((item as { source: unknown }).source) : String(item)).join(" / ");
  } catch { /* 原始字串直接顯示 */ }
  return raw;
}

function objectList(raw: unknown): Record<string, unknown>[] {
  if (Array.isArray(raw)) return raw.filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null);
  if (typeof raw !== "string" || !raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
      : [];
  } catch { return []; }
}

/** 日本旅宿／自然保護／世界遺產共用的 source-aware popup。 */
export function JpTourismPanel({ props }: { props: Record<string, unknown> }) {
  const { t } = useLocale();
  const provenance = objectList(props._provenance);
  const title = str(props.name) || str(props.site_name_ja) || str(props.park_name)
    || str(props.designation_name) || str(props.area_name) || str(props.area_name_en)
    || str(props.heritage_name_ja) || str(props.name_zh) || str(props.name_en)
    || str(props.entity_id) || str(props.feature_id) || t("popup.japan.tourismDefault");
  const sources = list(props.sources) || list(props._provenance) || str(props.source_name)
    || str(props.source_dataset) || str(props.source) || t("popup.japan.seeSourceUrl");
  const sourceYear = str(props.source_as_of) || str(props.source_year) || str(props.source_fiscal_year)
    || str(props.date_inscribed) || [...new Set(provenance.map((item) => str(item.source_as_of)).filter(Boolean))].join(" / ");
  const license = list(props.license_set) || str(props.license) || str(props.license_status)
    || str(props.license_note);
  const status = [
    props.dedup_version ? "PARTIAL_DEDUP_CONSERVATIVE" : null,
    props.usage_status, props.source_status, props.freshness_status, props.dedup_status,
    props.geom_status, props.boundary_status,
  ].map(str).filter(Boolean).join(" / ");
  const precision = str(props.geom_precision) || str(props.geometry_status) || str(props.geocode_quality)
    || str(props.precision_warning) || str(props.geometry_caveat);
  return (
    <>
      <Title color="#0ea5e9">{title}</Title>
      <Row field="source" value={sources} />
      <Row label={t("popup.japan.yearAsOf")} value={sourceYear || t("popup.common.notProvided")} />
      <Row field="license" value={license || t("popup.japan.unverified")} />
      <Row field="status" value={status || t("popup.common.notProvided")} />
      <Row label="geometry precision" value={precision || t("popup.japan.sourceUnlabeled")} />
      <Row label="coverage" value={str(props.coverage_scope)} />
      <Row label="filter_layer_id" value={str(props.filter_layer_id)} />
      <Row label={t("popup.japan.displayCategory")} value={str(props.facility_category)} />
      <Row field="type" value={str(props.facility_type) || str(props.registered_type) || str(props.park_class_name) || str(props.legal_class_label) || str(props.protection_class) || str(props.category)} />
      <Row label={t("popup.japan.addressLocation")} value={str(props.address) || str(props.location_ja) || str(props.prefecture)} />
      <Row label={t("popup.japan.relatedUrl")} value={str(props.source_url) ? "" : str(props.leaflet_url) || str(props.area_detail_url)} />
    </>
  );
}

export function JpAccommodationDensityPanel({ props }: { props: Record<string, unknown> }) {
  const { t, formatNumber } = useLocale();
  const count = Number(props.n_records);
  const gridSize = Number(props.grid_size_m);
  const density = Number(props.density_per_km2);
  return (
    <>
      <Title color="#ea580c">{t("popup.japan.densityTitle")}</Title>
      <Row field="gridScale" value={Number.isFinite(gridSize) ? `${formatNumber(gridSize)} m` : ""} />
      <Row label={t("popup.japan.lodgingInCell")} value={Number.isFinite(count) ? t("popup.japan.lodgingCount", { count: formatNumber(count) }) : ""} />
      <Row label={t("popup.japan.perKm2")} value={Number.isFinite(density) ? formatNumber(density, { maximumFractionDigits: 1 }) : ""} />
      <Row field="gridId" value={str(props.grid_id)} />
      <Row label={t("popup.japan.countContract")} value={t("popup.japan.countContractValue")} />
    </>
  );
}

/** Source-aware Japan water popup. Never derives a status, capacity, or observation from a missing value. */
export function JpWaterPanel({ props }: { props: Record<string, unknown> }) {
  const i18n = useLocale();
  const { t } = i18n;
  const title = str(props.name) || str(props.facility_name) || str(props.station_name) || str(props.lake_name) || str(props.entity_id) || t("popup.japan.waterDefault");
  const rawRole = str(props.role) || str(props.entity_role) || str(props.facility_category) || str(props.observation_kind);
  const roleZh = ({
    water_quality_station: "水質測站",
    water_level_station: "水位測站",
    lake_or_reservoir_water_surface: "湖泊或水庫水面",
    water_supply_related_facility: "供水相關設施",
    sewer_facility: "下水道設施",
  } as Record<string, string>)[rawRole] || rawRole;
  const role = enumLabel("jpWaterRole", rawRole, roleZh, i18n);
  const sourceYear = str(props.year) || str(props.source_year);
  const isQualityRegistry = /quality|水質/i.test(rawRole) || /quality|水質/i.test(str(props.source));
  const caveat = str(props.caveat);
  const source = str(props.source) || str(props.attribution);
  const isGroundwater = /groundwater|地下水|湧水|河川地点/i.test(`${rawRole} ${source}`);
  const isNilim = /nilim/i.test(`${rawRole} ${source} ${caveat}`);
  const isAgri = /maff|農業|ため池/i.test(`${rawRole} ${source} ${caveat}`);
  const category = JP_WATER_FACILITY_CATEGORIES.find((item) => item.value === str(props.facility_category));
  const classificationBasis = str(props.classification_basis);
  const classification = classificationBasis === "source_subtype"
    ? t("popup.japan.classBySubtype", { match: str(props.classification_match) })
    : classificationBasis === "name_pattern"
      ? t("popup.japan.classByName", { match: str(props.classification_match) })
      : classificationBasis === "unclassified" ? t("popup.japan.classUnclassified") : "";
  return <>
    <Title color="#0ea5e9">{title}</Title>
    <Row field="type" value={role} />
    <Row label={t("popup.japan.facilitySubtype")} value={str(props.facility_category_label) || (category ? enumLabel("jpWaterCategory", category.value, category.label, i18n) : "")} />
    <Row label={t("popup.japan.classBasis")} value={classification} />
    <Row label={t("popup.japan.businessSystem")} value={str(props.water_system)} />
    <Row field="sourceYear" value={!sourceYear || /^unknown\b/i.test(sourceYear) ? t("popup.japan.sourceYearNone") : sourceYear} />
    <Row field="source" value={source} />
    <Row field="license" value={str(props.license)} />
    <Row field="coverageScope" value={str(props.coverage)} />
    <Row label={t("popup.japan.sourceOperator")} value={str(props.operator) ? t("popup.japan.sourceOperatorValue", { value: str(props.operator) }) : ""} />
    <Row field="capacity" value={str(props.capacity)} />
    <Row label={t("popup.japan.sourceIdentity")} value={str(props.source_id) ? t("popup.japan.sourceIdentityValue", { value: str(props.source_id) }) : ""} />
    <Row label={t("popup.japan.selectionIdentity")} value={str(props.selection_identity)} />
    <Row field="dataLimits" value={caveat} />
    {isQualityRegistry && <Row field="dataLimits" value={t("popup.japan.qualityRegistryNote")} />}
    {isGroundwater && <Row label={t("popup.japan.coverageLimit")} value={t("popup.japan.groundwaterLimit")} />}
    {isNilim && <Row label={t("popup.japan.coverageLimit")} value={t("popup.japan.nilimLimit")} />}
    {isAgri && <Row label={t("popup.japan.positionLimit")} value={t("popup.japan.maffLimit")} />}
  </>;
}

/**
 * `lines` / `operators` / `railway_categories` 等陣列欄位：queryRenderedFeatures()
 * 拿到的 properties 是 vector tile 編碼後的結果，mapbox-gl-js 的 vt-pbf
 * writeProperties() 對陣列一律 JSON.stringify()（見 shared.tsx 同類註解）。
 * 兩種來源都要接得住：真陣列（測試環境／未來直讀）與 JSON 字串（實際瀏覽器）。
 */
function parseStringArray(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === "string" && raw) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
      // 非 JSON 字串（理論上不會發生，防禦性 fallback）
      return [raw];
    }
  }
  return [];
}

const ADMIN_COLOR = { prefecture: "#f59e0b", municipality: "#fbbf24" };
const STATION_COLOR = "#38bdf8";
const AIRPORT_COLOR = "#a78bfa";

/** 日本都道府県界（47 筆，單色） */
export function JpAdminPrefecturePanel({ props }: { props: Record<string, unknown> }) {
  const { t } = useLocale();
  return (
    <>
      <Title color={ADMIN_COLOR.prefecture}>{str(props.pref_name) || t("popup.japan.prefecture")}</Title>
      <Row label={t("popup.japan.prefectureCode")} value={str(props.pref_code)} />
    </>
  );
}

/** 日本市区町村界（1,905 筆，單色） */
export function JpAdminBoundariesPanel({ props }: { props: Record<string, unknown> }) {
  const { t } = useLocale();
  return (
    <>
      <Title color={ADMIN_COLOR.municipality}>{str(props.city_name) || str(props.ward_name) || t("popup.japan.municipality")}</Title>
      <Row label={t("popup.japan.prefecture")} value={str(props.pref_name)} />
      <Row label={t("popup.japan.gun")} value={str(props.county_name)} />
      <Row label={t("popup.japan.municipality")} value={str(props.city_name)} />
      <Row label={t("popup.japan.wardLabel")} value={str(props.ward_name)} />
      <Row label={t("popup.japan.adminCode")} value={str(props.admin_code)} />
    </>
  );
}

/** 日本車站（9,046 點，單色；運量取 2022-2024 最新一筆） */
export function JpStationsPanel({ props }: { props: Record<string, unknown> }) {
  const { t, formatNumber } = useLocale();
  const lines = parseStringArray(props.lines);
  const operators = parseStringArray(props.operators);
  const railwayCategories = parseStringArray(props.railway_categories);
  // 運量：passengers_latest 可能為 null（該 latest_year 當年無資料，例：稚内
  // latest_year=2024 無值但 2023=114）→ 逐年 fallback 2024→2023→2022 取最新有值者。
  // ⚠️ 兩個坑：(1) null 經 vt-pbf writeProperties() 會變字串 "null"（非
  // string/boolean/number 一律 JSON.stringify）；(2) Number(null)===0（finite）。
  // 兩者都要先擋 null/""/"null" 再 Number，否則顯示「0 人/日」或「NaN」。
  const passengerCount = (v: unknown): number | null => {
    if (v == null || v === "" || v === "null") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const explicitCount = passengerCount(props.passengers_latest);
  const explicitYear = str(props.passengers_latest_year);
  let passenger: { count: number; year: string } | null =
    explicitCount != null && explicitYear && explicitYear !== "null"
      ? { count: explicitCount, year: explicitYear }
      : null;
  if (!passenger) {
    for (const y of ["2024", "2023", "2022"]) {
      const c = passengerCount(props[`passengers_${y}`]);
      if (c != null) { passenger = { count: c, year: y }; break; }
    }
  }
  const passengerLabel = passenger
    ? t("popup.japan.passengersPerDay", { count: formatNumber(passenger.count), year: passenger.year })
    : t("popup.common.noData");

  return (
    <>
      <Title color={STATION_COLOR}>{str(props.name) || t("popup.japan.unnamedStation")}</Title>
      <Row field="route" value={lines.join(" / ")} />
      <Row field="operator" value={operators.join(" / ")} />
      <Row label={t("popup.japan.category")} value={railwayCategories.join(" / ")} />
      <Row label={t("popup.japan.ridership")} value={passengerLabel} />
    </>
  );
}

/** 日本機場（108 面，單色） */
export function JpAirportsPanel({ props }: { props: Record<string, unknown> }) {
  const { t } = useLocale();
  const runwayLength = props.runway_length_m;
  const runwayWidth = props.runway_width_m;
  const runwayLabel = runwayLength != null && runwayWidth != null
    ? `${runwayLength} × ${runwayWidth} m`
    : "";

  return (
    <>
      <Title color={AIRPORT_COLOR}>{str(props.name) || t("popup.japan.airport")}</Title>
      <Row label={t("popup.japan.category")} value={str(props.category)} />
      <Row label={t("popup.japan.serviceStatus")} value={str(props.status)} />
      <Row label={t("popup.japan.scheduledFlights")} value={str(props.regular_flight)} />
      <Row label={t("popup.japan.runway")} value={runwayLabel} />
    </>
  );
}

/**
 * 日本鐵道路線（21,933 段，事業者種別 5 色）。
 * PMTiles 屬性全為 String 純量（非車站那種陣列），直接 str() 即可。
 */
export function JpRailwaysPanel({ props }: { props: Record<string, unknown> }) {
  const { t } = useLocale();
  const operatorType = str(props.operator_type);
  const color =
    JP_RAILWAY_TYPES.find((t) => t.value === operatorType)?.color ?? JP_RAILWAY_TYPE_OTHER.color;
  return (
    <>
      {/* 標題已是路線名，故不再重複一列「路線名」（比照 JpSchoolsPanel 以校名為標題）。 */}
      <Title color={color || JP_RAILWAY_LAYER_COLOR}>{str(props.line_name) || t("popup.japan.railLine")}</Title>
      <Row label={t("popup.japan.operatingCompany")} value={str(props.operator)} />
      <Row label={t("popup.japan.operatorType")} value={operatorType} />
      <Row label={t("popup.japan.railCategory")} value={str(props.railway_category)} />
    </>
  );
}

/**
 * 日本學校（56,807 點，学校分類 13 色）。
 * PMTiles 只保留 6 個 String 屬性（*_code 冗餘欄已在轉檔剔除），直接 str() 即可。
 * 標題色跟著該校的分類走，與地圖上的點同色。
 */
export function JpSchoolsPanel({ props }: { props: Record<string, unknown> }) {
  const { t } = useLocale();
  const schoolClass = str(props.school_class);
  const color =
    JP_SCHOOL_TYPES.find((t) => t.value === schoolClass)?.color ?? JP_SCHOOL_TYPE_OTHER.color;
  return (
    <>
      <Title color={color}>{str(props.name) || t("popup.japan.school")}</Title>
      <Row label={t("popup.japan.schoolClass")} value={schoolClass} />
      <Row label={t("popup.japan.administrator")} value={str(props.administrator)} />
      <Row label={t("popup.japan.closedStatus")} value={str(props.closed_status)} />
      <Row label={t("popup.japan.location")} value={str(props.address)} />
    </>
  );
}

// ⚠️ 兩個坑（同 JpStationsPanel 的 passengerCount）：(1) null 經 vt-pbf
// writeProperties() 會變字串 "null"；(2) Number(null)===0（finite）。
// 兩者都要先擋 null/""/"null" 再 Number，否則顯示「0 人」或「NaN」。
const meshNum = (v: unknown): number | null => {
  if (v == null || v === "" || v === "null") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const meshPopText = (v: unknown, t: ReturnType<typeof useLocale>["t"], formatNumber: (n: number) => string): string => {
  const n = meshNum(v);
  return n == null ? "" : t("popup.japan.peopleCount", { count: formatNumber(n) });
};
// ratio65 是 0~1 比例 → ×100 顯示成 %；**0 是官方對極小人口 mesh 的隱私遮罩，
// 不是真的 0%**（見 jpPopulationMeshModes.ts），故顯示「未公開」而非 0.0%。
const meshRatioText = (v: unknown, i18n: ReturnType<typeof useLocale>): string => {
  const n = meshNum(v);
  if (n == null) return "";
  if (n === 0) return enumLabel("jpMeshMask", "masked", JP_POPULATION_MESH_MASK.label, i18n);
  return `${(n * 100).toFixed(1)}%`;
};

/**
 * 日本 1km 人口網格（176,896 格，JIS X0410 3次メッシュ）。
 * 一次列出 5 個年份的總人口與 4 個年份的高齡比 —— popup 本身就是一條時間序列，
 * 不必反覆切 select 才看得到同一格的世代變化。
 */
export function JpPopulationMeshPanel({ props }: { props: Record<string, unknown> }) {
  const i18n = useLocale();
  const { t, formatNumber } = i18n;
  // 模式標籤「人口 2020」「高齡比 2030」的年份取自欄位名（pop_2020／ratio65_2030）
  const yearOf = (field: string) => field.split("_")[1] ?? "";
  return (
    <>
      <Title color={JP_POPULATION_MESH_LAYER_COLOR}>{t("popup.japan.meshTitle", { id: str(props.id) || "—" })}</Title>
      {JP_POPULATION_MESH_MODES.filter((m) => m.metric === "pop").map((m) => (
        <Row key={m.field} label={t("popup.japan.meshPopulation", { year: yearOf(m.field) })} value={meshPopText(props[m.field], t, formatNumber)} />
      ))}
      {JP_POPULATION_MESH_MODES.filter((m) => m.metric === "ratio65").map((m) => (
        <Row key={m.field} label={t("popup.japan.meshAgedRatio", { year: yearOf(m.field) })} value={meshRatioText(props[m.field], i18n)} />
      ))}
    </>
  );
}

/** MVT null may be serialized as the string "null". */
const policeText = (v: unknown): string => v == null || v === "null" || v === "undefined" ? "" : String(v).trim();
export function JpPoliceFacilitiesPanel({ props }: { props: Record<string, unknown> }) {
  const i18n = useLocale();
  const { t } = i18n;
  const facilityType = JP_POLICE_FACILITY_TYPES.find(ft => ft.value === props.facility_type);
  const precision: Record<string, string> = { mapped_poi: "地圖設施點", mapped_label: "地圖注記", address: "地址", block: "街區", chome: "丁目", town: "町域" };
  const na = t("popup.common.notProvided");
  const precisionKey = policeText(props.geom_precision);
  const sourceKey = props.geometry_source === "gsi_address" ? "gsi_address" : props.geometry_source === "gsi_optimal_bvmap" ? "gsi_optimal_bvmap" : "";
  return <>
    <Title color={facilityType?.color ?? JP_POLICE_LAYER_COLOR}>{policeText(props.name) || t("popup.japan.policeDefault")}</Title>
    <Row field="facilityType" value={facilityType ? enumLabel("jpPoliceFacility", facilityType.value, facilityType.label, i18n) : na} />
    <Row label={t("popup.japan.prefectureZh")} value={policeText(props.prefecture) || na} />
    <Row field="address" value={policeText(props.address) || na} />
    <Row field="phone" value={policeText(props.phone) || na} />
    <Row label={t("popup.japan.dataAsOf")} value={policeText(props.source_as_of) || na} />
    {props.geom_status === "degraded" && <Row label={t("popup.japan.approxPosition")} value={t("popup.japan.approxPositionValue")} />}
    <Row field="coordPrecision" value={precision[precisionKey] ? enumLabel("jpGeomPrecision", precisionKey, precision[precisionKey], i18n) : na} />
    <Row label={t("popup.japan.positionSource")} value={sourceKey ? enumLabel("jpGeometrySource", sourceKey, sourceKey === "gsi_address" ? "国土地理院 AddressSearch" : "国土地理院最適化ベクトルタイル", i18n) : na} />
    <Row field="attribution" value={JP_POLICE_ATTRIBUTION} />
  </>;
}

/** MVT boolean 可能以 true／"true"／1 出現；null 欄位在 tile 內不存在。 */
const mvtTrue = (v: unknown): boolean => v === true || v === "true" || v === 1 || v === "1";

/** 日本避難場所：兩種場所法定意義不同（不可相加）；災害種別僅指定緊急避難場所有值。 */
export function JpEvacuationSitesPanel({ props }: { props: Record<string, unknown> }) {
  const i18n = useLocale();
  const { t } = i18n;
  const siteType = JP_EVACUATION_SITE_TYPES.find(st => st.value === props.site_type);
  const isEmergency = props.site_type === "emergency_site";
  const hazards = isEmergency ? JP_EVACUATION_HAZARDS.filter(h => mvtTrue(props[h.field])) : [];
  const na = t("popup.common.notProvided");
  return <>
    <Title color={siteType?.color ?? JP_EVACUATION_LAYER_COLOR}>{policeText(props.name) || t("popup.japan.evacDefault")}</Title>
    <Row label={t("popup.japan.evacSiteType")} value={siteType ? enumLabel("jpEvacSite", siteType.value, siteType.label, i18n) : na} />
    {isEmergency && <Row label={t("popup.japan.evacHazards")} value={hazards.length ? hazards.map(h => enumLabel("jpEvacHazard", h.value, h.label, i18n)).join("、") : t("popup.japan.evacHazardsNone")} />}
    {props.site_type === "shelter" && mvtTrue(props.is_welfare_shelter) && <Row label={t("popup.japan.evacWelfare")} value={t("popup.japan.evacWelfareValue")} />}
    {mvtTrue(props.same_address_as_other_type) && <Row label={t("popup.japan.evacSameAddress")} value={t("popup.japan.evacSameAddressValue")} />}
    <Row label={t("popup.japan.prefectureZh")} value={policeText(props.prefecture) || na} />
    <Row label={t("popup.japan.evacMunicipality")} value={policeText(props.municipality) || na} />
    <Row field="address" value={policeText(props.address) || na} />
    <Row label={t("popup.japan.dataAsOf")} value={JP_EVACUATION_DATA_AS_OF} />
    <Row label={t("popup.japan.notes")} value={t("popup.japan.evacLegalNote")} />
    <Row label={t("popup.japan.notes")} value={t("popup.japan.evacStaleNote")} />
    <SourceFooter props={{ source_org: JP_EVACUATION_ATTRIBUTION, source_url: JP_EVACUATION_SOURCE_URL, license: JP_EVACUATION_LICENSE, fetched_at: JP_EVACUATION_DATA_AS_OF }} />
  </>;
}

/** 日本役所與公民館（P05）：2022-04 基準，不能當現況營運名冊。 */
export function JpPublicOfficesPanel({ props }: { props: Record<string, unknown> }) {
  const i18n = useLocale();
  const { t } = i18n;
  const cls = JP_PUBLIC_OFFICE_CLASSES.find(c => c.value === props.facility_class);
  const na = t("popup.common.notProvided");
  return <>
    <Title color={cls?.color ?? JP_PUBLIC_OFFICE_LAYER_COLOR}>{policeText(props.name) || t("popup.japan.officeDefault")}</Title>
    <Row label={t("popup.japan.officeClass")} value={cls ? enumLabel("jpPublicOfficeClass", cls.value, cls.label, i18n) : na} />
    <Row label={t("popup.japan.prefectureZh")} value={policeText(props.prefecture) || na} />
    <Row field="address" value={policeText(props.address) || na} />
    <Row label={t("popup.japan.dataAsOf")} value={JP_PUBLIC_OFFICE_DATA_AS_OF} />
    <Row label={t("popup.japan.notes")} value={t("popup.japan.officeBasisNote")} />
    <SourceFooter props={{ source_org: JP_PUBLIC_OFFICE_ATTRIBUTION, source_url: JP_PUBLIC_OFFICE_SOURCE_URL, license: JP_PUBLIC_OFFICE_LICENSE, fetched_at: JP_PUBLIC_OFFICE_DATA_AS_OF }} />
  </>;
}

/**
 * 日本土砂災害警戒區域（A33）：概略位置、非法定圖書；紅區在黃區之內。
 * 京都府等有 license_note 的 tile 才顯示授權限制列，沒有值就不顯示。
 */
export function JpLandslideWarningAreasPanel({ props }: { props: Record<string, unknown> }) {
  const i18n = useLocale();
  const { t } = i18n;
  const zone = JP_LANDSLIDE_ZONES.find(z => z.value === props.zone_class);
  const phenomenon = JP_LANDSLIDE_PHENOMENA.find(p => p.value === props.phenomenon_en);
  const designation = JP_LANDSLIDE_DESIGNATIONS.find(d => d.value === props.designation_status);
  const na = t("popup.common.notProvided");
  const pref = JP_PREFECTURE_NAMES[policeText(props.prefecture_code)];
  const licenseNote = policeText(props.license_note);
  return <>
    <Title color={zone?.color ?? JP_LANDSLIDE_LAYER_COLOR}>{policeText(props.area_name) || t("popup.japan.landslideDefault")}</Title>
    <Row label={t("popup.japan.landslideZone")} value={zone ? enumLabel("jpLandslideZone", zone.value, zone.label, i18n) : na} />
    <Row label={t("popup.japan.landslidePhenomenon")} value={phenomenon ? enumLabel("jpLandslidePhenomenon", phenomenon.value, phenomenon.label, i18n) : na} />
    <Row label={t("popup.japan.landslideDesignation")} value={designation ? enumLabel("jpLandslideDesignation", designation.value, designation.label, i18n) : na} />
    <Row label={t("popup.japan.prefectureZh")} value={pref || na} />
    <Row field="address" value={policeText(props.address) || na} />
    {licenseNote ? <Row label={t("popup.japan.landslideLicense")} value={enumLabel("jpLandslideLicenseNote", licenseNote, licenseNote, i18n)} /> : null}
    <Row label={t("popup.japan.dataAsOf")} value={JP_LANDSLIDE_DATA_AS_OF} />
    <Row label={t("popup.japan.notes")} value={t("popup.japan.landslideAccuracyNote")} />
    <Row label={t("popup.japan.notes")} value={t("popup.japan.landslideNestedNote")} />
    <SourceFooter props={{ source_org: JP_LANDSLIDE_ATTRIBUTION, source_url: JP_LANDSLIDE_SOURCE_URL, license: JP_LANDSLIDE_LICENSE, fetched_at: JP_LANDSLIDE_DATA_AS_OF }} />
  </>;
}

/** 日本內水浸水想定區域（A51）：想定最大規模降雨、只涵蓋 28 市町村；無資料≠無風險。 */
export function JpInlandFloodAreasPanel({ props }: { props: Record<string, unknown> }) {
  const i18n = useLocale();
  const { t } = i18n;
  const depth = JP_INLAND_FLOOD_DEPTH_CLASSES.find(c => c.value === props.depth_class);
  const na = t("popup.common.notProvided");
  return <>
    <Title color={JP_INLAND_FLOOD_LAYER_COLOR}>{policeText(props.municipality) || t("popup.japan.inlandFloodDefault")}</Title>
    <Row label={t("popup.japan.inlandFloodDepth")} value={depth ? enumLabel("jpInlandFloodDepth", depth.value, depth.label, i18n) : na} />
    <Row label={t("popup.japan.prefectureZh")} value={policeText(props.prefecture) || na} />
    <Row label={t("popup.japan.inlandFloodScenario")} value={t("popup.japan.inlandFloodScenarioValue")} />
    <Row label={t("popup.japan.dataAsOf")} value={JP_INLAND_FLOOD_DATA_AS_OF} />
    <Row label={t("popup.japan.notes")} value={t("popup.japan.inlandFloodNote")} />
    <SourceFooter props={{ source_org: JP_INLAND_FLOOD_ATTRIBUTION, source_url: JP_INLAND_FLOOD_SOURCE_URL, license: JP_INLAND_FLOOD_LICENSE, fetched_at: JP_INLAND_FLOOD_DATA_AS_OF }} />
  </>;
}

/** 日本用途地域（A55）：容積率、建蔽率空值寫「未記載」，不可當 0。 */
export function JpZoningUseDistrictsPanel({ props }: { props: Record<string, unknown> }) {
  const i18n = useLocale();
  const { t } = i18n;
  const cls = JP_ZONING_CLASSES.find(c => c.code === Number(props.youto_code));
  const na = t("popup.common.notProvided");
  const unrecorded = t("popup.japan.zoningUnrecorded");
  const pct = (v: unknown) => { const s = policeText(v); return s === "" || Number.isNaN(Number(s)) ? unrecorded : `${Number(s)}%`; };
  const pref = JP_PREFECTURE_NAMES[policeText(props.prefecture_code)];
  const ja = policeText(props.youto_ja) || cls?.ja || "";
  const label = cls ? enumLabel("jpZoningClass", cls.code, cls.label, i18n) : "";
  return <>
    <Title color={cls?.color ?? JP_ZONING_LAYER_COLOR}>{ja || t("popup.japan.zoningDefault")}</Title>
    <Row label={t("popup.japan.zoningClass")} value={label && label !== ja ? `${label}（${ja}）` : ja || na} />
    <Row label={t("popup.japan.zoningFar")} value={pct(props.far_pct)} />
    <Row label={t("popup.japan.zoningBcr")} value={pct(props.bcr_pct)} />
    <Row label={t("popup.japan.zoningMunicipality")} value={policeText(props.municipality) || na} />
    <Row label={t("popup.japan.prefectureZh")} value={pref || na} />
    <Row label={t("popup.japan.dataAsOf")} value={JP_ZONING_DATA_AS_OF} />
    <Row label={t("popup.japan.notes")} value={t("popup.japan.zoningNote")} />
    <SourceFooter props={{ source_org: JP_ZONING_ATTRIBUTION, source_url: JP_ZONING_SOURCE_URL, license: JP_ZONING_LICENSE, fetched_at: JP_ZONING_DATA_AS_OF }} />
  </>;
}

/** 保安林／保護林清單（逗號分隔的 en 碼）→ 日文名；`_planned` 後綴＝見込み地。 */
function forestList(raw: unknown, dict: Readonly<Record<string, string>>, plannedLabel: string): string {
  return policeText(raw).split(",").map(code => code.trim()).filter(Boolean).map(code => {
    const planned = code.endsWith(JP_FOREST_PLANNED_SUFFIX);
    const base = planned ? code.slice(0, -JP_FOREST_PLANNED_SUFFIX.length) : code;
    return `${dict[base] ?? base}${planned ? `（${plannedLabel}）` : ""}`;
  }).join(" / ");
}

/** 日本国有林：只有國有林；面是合併分類面不是小班；保護林非公表者屬性空白。 */
export function JpNationalForestsPanel({ props }: { props: Record<string, unknown> }) {
  const i18n = useLocale();
  const { t } = i18n;
  const fn = JP_FOREST_FUNCTION_TYPES.find(f => f.value === props.function_type_en);
  const na = t("popup.common.notProvided");
  const planted = policeText(props.planted_ratio);
  const area = policeText(props.area_ha);
  const plannedLabel = t("popup.japan.forestPlanned");
  const protection = forestList(props.protection_forest_en, JP_FOREST_PROTECTION, plannedLabel);
  const protectedForest = forestList(props.protected_forest_en, JP_FOREST_PROTECTED, plannedLabel);
  const office = [policeText(props.bureau), policeText(props.office)].filter(Boolean).join(" ");
  return <>
    <Title color={fn?.color ?? JP_FOREST_BLANK_COLOR}>{policeText(props.forest_name) || t("popup.japan.forestDefault")}</Title>
    <Row label={t("popup.japan.forestOffice")} value={office || na} />
    <Row label={t("popup.japan.forestFunction")} value={fn ? enumLabel("jpForestFunction", fn.value, fn.label, i18n) : t("popup.japan.forestFunctionBlank")} />
    <Row label={t("popup.japan.forestProtection")} value={protection || na} />
    <Row label={t("popup.japan.forestProtected")} value={protectedForest || t("popup.japan.forestProtectedBlank")} />
    <Row label={t("popup.japan.forestCorridor")} value={policeText(props.green_corridor) || na} />
    <Row label={t("popup.japan.forestSpecies")} value={policeText(props.main_species) || na} />
    <Row label={t("popup.japan.forestPlanted")} value={planted !== "" && !Number.isNaN(Number(planted)) ? `${Math.round(Number(planted) * 100)}%` : na} />
    <Row label={t("popup.japan.forestArea")} value={area !== "" && !Number.isNaN(Number(area)) ? `${Number(area).toFixed(1)} ha` : na} />
    <Row label={t("popup.japan.dataAsOf")} value={JP_FOREST_DATA_AS_OF} />
    <Row label={t("popup.japan.notes")} value={t("popup.japan.forestScopeNote")} />
    <Row label={t("popup.japan.notes")} value={t("popup.japan.forestMergedNote")} />
    <SourceFooter props={{ source_org: JP_FOREST_ATTRIBUTION, source_url: JP_FOREST_SOURCE_URL, license: JP_FOREST_LICENSE, fetched_at: JP_FOREST_DATA_AS_OF }} />
  </>;
}

/** 日本公車站（P11 2022 年度版）：PMTiles 只帶 route_count，不含系統名；縣名由 pref_code 對照。 */
export function JpBusStopsPanel({ props }: { props: Record<string, unknown> }) {
  const i18n = useLocale();
  const { t } = i18n;
  const cls = JP_BUS_STOP_CLASSES.find(c => c.value === props.bus_class);
  const na = t("popup.common.notProvided");
  const pref = JP_PREFECTURE_NAMES[policeText(props.pref_code)];
  const routeCount = policeText(props.route_count);
  return <>
    <Title color={cls?.color ?? JP_BUS_STOP_LAYER_COLOR}>{policeText(props.stop_name) || t("popup.japan.busDefault")}</Title>
    <Row label={t("popup.japan.busOperator")} value={policeText(props.operator) || na} />
    <Row label={t("popup.japan.busClass")} value={cls ? enumLabel("jpBusClass", cls.value, cls.label, i18n) : na} />
    <Row label={t("popup.japan.busRouteCount")} value={routeCount || na} />
    <Row label={t("popup.japan.prefectureZh")} value={pref || na} />
    <Row label={t("popup.japan.dataAsOf")} value={JP_BUS_STOP_DATA_AS_OF} />
    <Row label={t("popup.japan.notes")} value={t("popup.japan.busScopeNote")} />
    <SourceFooter props={{ source_org: JP_BUS_STOP_ATTRIBUTION, source_url: JP_BUS_STOP_SOURCE_URL, license: JP_BUS_STOP_LICENSE, fetched_at: JP_BUS_STOP_DATA_AS_OF }} />
  </>;
}

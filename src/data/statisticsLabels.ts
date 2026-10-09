/**
 * 統計的人讀標籤（圖層面板統一 C 段從 `StatisticsDetails.tsx` 搬出）：地理層級、期別、維度名與維度值、
 * 篩選摘要，以及**參考邊界代碼 → 中文來源描述**（spec §6.3 不印內部識別碼）。
 * 連動選單 provider（`state/statisticsLinkedSelect.ts`）、說明・來源、圖例共用同一份。
 */
import type { StatisticsLevel, StatisticsRelease } from './regionalStatisticsLoader';
import { environmentDimensionLabel, environmentDimensionValueLabel } from './environmentStatisticsRecipes';

export const LEVEL_LABELS: Record<StatisticsLevel, string> = {county:'縣市',township:'鄉鎮市區',village:'村里',statistical_min:'最小統計區',statistical_l1:'第一級統計區',statistical_l2:'第二級統計區',prosecutor_district:'地檢署轄區'};

export function statisticsPeriodLabel(release: Pick<StatisticsRelease, 'period_start' | 'period_end'>): string {
  const start = release.period_start, end = release.period_end;
  if (start.endsWith('-01-01') && end === `${start.slice(0,4)}-12-31`) return `${start.slice(0,4)} 年`;
  // 時點快照（例：戶籍人口月底統計標準日）只顯示一個日期，不寫成「X — X」。
  if (start === end) return `${start}（時點）`;
  return `${start} — ${end}`;
}

/**
 * health.availability 的顯示文字。STALE 是上游 health_policy「歷史或舊快照，仍可顯示但須標示」：
 * 已有更新期別，不代表數值錯誤；原代碼保留在括號前方便對照。
 */
const AVAILABILITY_LABELS: Record<string, string> = {
  CURRENT: 'CURRENT（最新期別）',
  STALE: 'STALE（歷史期別：已有較新期別，數值本身不受影響）',
  PARTIAL: 'PARTIAL（部分覆蓋：缺值或未分配項目不補 0，詳見來源說明）',
};
export function statisticsAvailabilityLabel(value: string): string {
  return AVAILABILITY_LABELS[value] ?? value;
}

const DIMENSION_LABELS: Record<string, string> = {
  crop: '作物', season: '期作', year: '年度', animal: '畜種', animal_kind: '畜種', survey_years_roc: '調查年度', area_unit: '面積單位',
  agency_fund: '基金',
  sector: '用電別',
  quarter: '季度',
  budget: '預算',
  budget_type: '預算類型',
  value_basis: '數值基準',
  law_article: '法條',
  geographic_coverage: '地理涵蓋',
  control_zone_class: '管制區類別',
  bus_metric: '統計項目',
  system_id: '系統',
  source_field: '來源欄位',
  accident_class: '事故類別',
  airport_iata: '機場 IATA',
  airport_icao: '機場 ICAO',
  health: '資料新鮮度',
  coverage: '覆蓋狀態',
  refresh: '更新方式',
  geographic_semantics: '地理語意',
  education_stage: '學段',
  source_schema: '來源 schema',
  academic_year_roc: '學年度',
  previous_academic_year_roc: '前一學年度',
  sex: '性別',
  institution_type: '機構類型',
  institution_classification: '機構分類',
  bed_measure: '床位口徑',
  capacity_field: '原始床位欄位',
  registration_scope: '登錄範圍',
  denominator: '分母',
  denominator_roc_year: '分母年度',
  employee_scope: '受僱範圍',
  income_measure: '所得指標',
  industry: '行業',
  period: '期別',
  survey: '調查',
};
const DIMENSION_VALUE_LABELS: Record<string, Record<string, string>> = {
  sector: { residential: '住宅' },
  budget_type: { civil_aviation_fund: '民航基金', public_budget: '公務預算', special_budget: '特別預算' },
  value_basis: { year_to_date_cumulative: '年度累計快照' },
  geographic_coverage: { taipei_only: '僅臺北市', taichung_only: '僅臺中市', taipei_township_only: '僅臺北市 12 區', national_county: '全國縣市', county_location: '縣市所在地' },
  bus_metric: { operating_route_length_km: '期末營業里程', approved_route_count: '核定路線數', urban_bus_operator_count: '市區客運業家數', operating_vehicle_count: '期末營業車輛', accessible_vehicle_count: '期末無障礙車輛', electric_vehicle_count: '期末電動車輛', operating_trip_count: '營業行車次數', operating_vehicle_km: '營業行車里程' },
  system_id: { tmrt: '臺中捷運' },
  geographic_semantics: { station_location: '車站所在地', facility_location_activity: '設施所在地活動' },
  health: { CURRENT: 'CURRENT', STALE: 'STALE' }, coverage: { PARTIAL: 'PARTIAL' }, refresh: { manual: '人工更新' },
  education_stage: { preschool: '幼兒園', elementary: '國民小學', junior_high: '國民中學', senior_high: '高級中等學校' },
  source_schema: { legacy_104_110: '104–110 legacy', current_111_114: '111–114 current', v1_104_114: '104–114 v1' },
  sex: { total: '總計', male: '男', female: '女' },
  institution_type: { general_nursing_home: '一般護理之家' },
  institution_classification: { general_nursing_home: '一般護理之家', postpartum_nursing_home: '產後護理之家' },
  bed_measure: { installed_capacity: '設置／開放容量' },
  registration_scope: { long_term_care_2_0_excludes_c_sites: '長照 2.0（不含 C 據點）' },
  denominator: { year_end_population: '年底人口', filing_household: '申報戶' },
  employee_scope: { national_full_time: '本國籍全時受僱員工' },
  income_measure: { comprehensive_income_median: '綜合所得中位數' },
  industry: { agriculture: '農林漁牧業', industry: '工業', manufacturing: '製造業（工業子集）', services: '服務業' },
  period: { H1: '上半年' },
  survey: { manpower: '人力資源調查' },
};

export function statisticsDimensionLabel(key: string): string {
  if (key === 'roc_year') return '年度';
  if (key === 'month') return '月份';
  return DIMENSION_LABELS[key] ?? environmentDimensionLabel(key) ?? key;
}

const BICYCLE_SOURCE_FIELD_LABELS: Record<string, string> = { COLUMN1: '市區租借站數', COLUMN3: '市區年租借次數', COLUMN5: '河濱租借站數', COLUMN6: '河濱自行車數', COLUMN7: '河濱年租借次數' };
const BUS_SOURCE_FIELD_LABELS: Record<string, string> = { COLUMN1: '期末營業里程', COLUMN2: '核定路線數', COLUMN3: '市區客運業家數', COLUMN4: '期末營業車輛', COLUMN5: '期末無障礙車輛', COLUMN6: '期末電動車輛', COLUMN7: '營業行車次數', COLUMN8: '營業行車里程' };

export function statisticsDimensionValueLabel(key: string, value: string, datasetId?: string): string {
  if (key === 'roc_year') return `民國 ${value} 年`;
  if (key === 'academic_year_roc' || key === 'previous_academic_year_roc' || key === 'denominator_roc_year') return `民國 ${value} 年`;
  if (key === 'month') return `${value} 月`;
  if (key === 'source_field') {
    const labels = datasetId === 'segis_bus_operation_county_315fh_1d3' ? BUS_SOURCE_FIELD_LABELS
      : datasetId === 'segis_taipei_bicycle_usage_township_110' ? BICYCLE_SOURCE_FIELD_LABELS
      : BICYCLE_SOURCE_FIELD_LABELS;
    return labels[value] ?? value;
  }
  return DIMENSION_VALUE_LABELS[key]?.[value] ?? environmentDimensionValueLabel(key, value) ?? value;
}

/** Compact, human-readable selection text for the collapsed filter disclosure. */
export function statisticsDimensionSummary(dimensions: Record<string, unknown> | undefined, release?: Pick<StatisticsRelease, 'period_start' | 'period_end'> | null, datasetId?: string): string {
  if (!dimensions && !release) return '';
  const parts: string[] = [];
  const year = typeof dimensions?.roc_year === 'string' ? dimensions.roc_year : '';
  const month = typeof dimensions?.month === 'string' ? dimensions.month : '';
  const quarter = typeof dimensions?.quarter === 'string' ? dimensions.quarter : '';
  if (year) parts.push(`期間：民國 ${year} 年${quarter ? `・${quarter}` : month ? `・${month} 月` : ''}`);
  else if (month) parts.push(`期間：${month} 月`);
  else if (release) parts.push(`期間：${statisticsPeriodLabel(release)}`);
  for (const [key, value] of Object.entries(dimensions ?? {})) {
    if (typeof value !== 'string' || !value || key === 'roc_year' || key === 'month' || key === 'quarter' || key === 'agency_fund') continue;
    parts.push(`${statisticsDimensionLabel(key)}：${statisticsDimensionValueLabel(key, value, datasetId)}`);
  }
  if (typeof dimensions?.agency_fund === 'string' && dimensions.agency_fund) parts.push(`基金：${dimensions.agency_fund}`);
  return parts.join('；');
}

// ── 參考邊界代碼 → 中文 ─────────────────────────────────────────────

/**
 * 資料集欄位（`boundary_version`、說明文字）保留原代碼；只有顯示時換成中文。
 * 代碼格式：`<層級>_<機關>_<民國年月日>`（例 `COUNTY_MOI_1140318` ＝ 內政部 114 年 3 月 18 日版縣市界）。
 */
const BOUNDARY_VERSION_LABELS: Record<string, string> = {
  COUNTY_MOI_1140318: '內政部縣市界（114 年 3 月 18 日版）',
  TOWN_MOI_1140318: '內政部鄉鎮市區界（114 年 3 月 18 日版）',
  VILLAGE_NLSC_1150119: '國土測繪中心村里界（115 年 1 月 19 日版）',
  VILLAGE_NLSC_1150817: '內政部村里界（115 年 8 月 17 日版）',
  VILLAGE_SEGIS_112: 'SEGIS 112 年村里界（綜所稅原生界線）',
  TOWNSHIP_REFERENCE_MOI_11501: '內政部鄉鎮市區統計參考界（115 年 1 月版）',
  township_reference_20260626_v1: '鄉鎮市區參考界（2026-06-26 第 1 版）',
  township_boundary_20260626_identity_only: '鄉鎮市區代碼對照（2026-06-26，只核對代碼）',
  county_identity_only: '縣市代碼對照（只核對代碼）',
  PROSECUTOR_DISTRICT_TOWN_MOI_1140318_v1: '地檢署轄區界（以內政部 114 年 3 月 18 日版鄉鎮市區界依 115 年司法轄區合併；非縣市）',
};
const BOUNDARY_CODE = /\b(?:COUNTY_MOI_1140318|TOWN_MOI_1140318|VILLAGE_NLSC_1150119|VILLAGE_NLSC_1150817|VILLAGE_SEGIS_112|TOWNSHIP_REFERENCE_MOI_11501|township_reference_20260626_v1|township_boundary_20260626_identity_only|county_identity_only|PROSECUTOR_DISTRICT_TOWN_MOI_1140318_v1)\b/g;

/** 單一邊界版本代碼的中文描述；查無對照時不印代碼。 */
export function boundaryVersionLabel(code: unknown): string {
  if (typeof code !== 'string' || !code) return '未提供';
  return BOUNDARY_VERSION_LABELS[code] ?? '未命名的參考邊界版本';
}

/** 說明文字裡夾帶的邊界代碼換成中文描述（其餘文字不動）。 */
export function humanizeStatisticsText(text: string): string;
export function humanizeStatisticsText(text: string | undefined): string | undefined;
export function humanizeStatisticsText(text: string | undefined): string | undefined {
  return text?.replace(BOUNDARY_CODE, (code) => BOUNDARY_VERSION_LABELS[code] ?? code);
}

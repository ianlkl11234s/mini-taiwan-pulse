/** Presentation configuration only; values, periods and sources come from the public catalog. */
export interface StatisticsReleaseOption {
  releaseId: string;
  dimensions: Record<string, string>;
}

export interface StatisticsReleaseSelector {
  /** Only derives choices from public releases, never invents a dimensions tuple. */
  resolve(release: { release_id: string; period_start: string; period_end?: string }): StatisticsReleaseOption | null;
}

const MARITIME_FUND_BY_RELEASE_PREFIX: Record<string, string> = {
  '1450d8e18741': '航港建設基金',
  'd6c9ce1998ef': '交通部航港局',
  '5f44af09d338': '交通部航港局-前瞻基礎建設計畫第3期特別預算',
  '469152708767': '交通部航港局-前瞻基礎建設計畫第4期特別預算',
  'f6a788d31216': '交通部航港局-前瞻基礎建設計畫第5期特別預算',
};

export const maritimeSubsidyReleaseSelector: StatisticsReleaseSelector = {
  resolve(release) {
    const matched = /^(\d{4})-(\d{2})-01-([0-9a-f]{12})-/.exec(release.release_id);
    if (!matched) return null;
    const year = matched[1]!;
    const month = matched[2]!;
    const prefix = matched[3]!;
    const fund = MARITIME_FUND_BY_RELEASE_PREFIX[prefix];
    if (!fund || release.period_start !== `${year}-${month}-01`) return null;
    return {
      releaseId: release.release_id,
      dimensions: { roc_year: String(Number(year) - 1911), month, agency_fund: fund },
    };
  },
};

const CIVIL_AERONAUTICS_SUBSIDY_DIMENSIONS: Record<string, Record<string, string>> = {
  '2023-Q4-civil_aviation_fund-f5ca6a3e44fb': { roc_year: '112', quarter: 'Q4', budget_type: 'civil_aviation_fund', value_basis: 'year_to_date_cumulative' },
  '2023-Q4-public_budget-095e5ac41d6f': { roc_year: '112', quarter: 'Q4', budget_type: 'public_budget', value_basis: 'year_to_date_cumulative' },
  '2023-Q4-special_budget-83258b75651f': { roc_year: '112', quarter: 'Q4', budget_type: 'special_budget', value_basis: 'year_to_date_cumulative' },
};

/** Only exposes the three immutable 112Q4 bundles verified by analytics. */
export const civilAeronauticsSubsidyReleaseSelector: StatisticsReleaseSelector = {
  resolve(release) {
    const dimensions = CIVIL_AERONAUTICS_SUBSIDY_DIMENSIONS[release.release_id];
    if (!dimensions || release.period_start !== '2023-01-01') return null;
    return { releaseId: release.release_id, dimensions };
  },
};

/** Release years are derived from public period fields, never synthesized from an opaque id. */
export const countyTransportSupplyReleaseSelector: StatisticsReleaseSelector = {
  resolve(release) {
    const matched = /^(2023|2024)-01-01$/.exec(release.period_start);
    if (!matched || release.period_end !== `${matched[1]}-12-31`) return null;
    return { releaseId: release.release_id, dimensions: { roc_year: String(Number(matched[1]) - 1911) } };
  },
};

export const STATISTICS_RECIPES = {
  statsWasteCounty: {
    dataset_id: 'waste_vehicles_county', indicator_id: 'total_vehicles', level: 'county',
    label: '垃圾清運車輛總數', unit: '輛', frequency: '年度', dimensions: {},
    breaks: [100, 300, 600, 1200], colors: ['#d1fae5', '#6ee7b7', '#34d399', '#059669', '#065f46'],
  },
  statsRecyclingCounty: {
    dataset_id: 'waste_vehicles_county', indicator_id: 'recycling_vehicles', level: 'county',
    label: '資源（含廚餘）回收車輛數', unit: '輛', frequency: '年度', dimensions: {},
    breaks: [50, 150, 300, 600], colors: ['#fef3c7', '#fde68a', '#fbbf24', '#d97706', '#92400e'],
  },
  statsWasteRecyclingRate: {
    dataset_id: 'waste_recycling_rate_county', indicator_id: 'municipal_waste_recycling_rate_pct', level: 'county',
    label: '一般廢棄物回收率', unit: '%', frequency: '年度', dimensions: {},
    breaks: [40, 50, 60, 70], colors: ['#eff6ff', '#bfdbfe', '#60a5fa', '#2563eb', '#1e3a8a'],
  },
  statsResidentialElectricity: {
    dataset_id: 'residential_electricity_sales_county_monthly', indicator_id: 'residential_electricity_sales_kwh', level: 'county',
    label: '住宅每月售電量', unit: '度', frequency: '每月', dimensions: { sector: 'residential' },
    breaks: [10000000, 50000000, 100000000, 300000000], colors: ['#eff6ff', '#bfdbfe', '#60a5fa', '#2563eb', '#1e3a8a'],
  },
  statsRiceHarvest: {
    dataset_id: 'rice_harvested_area_township', indicator_id: 'rice_harvested_area_hectare', level: 'township',
    label: '全年稻作收穫面積（複種計次）', unit: '公頃', frequency: '年度', dimensions: {},
    breaks: [100, 500, 1000, 3000], colors: ['#eff6ff', '#bfdbfe', '#60a5fa', '#2563eb', '#1e3a8a'],
  },
  statsBirthsTownship: {
    dataset_id: 'village_births_township_monthly', indicator_id: 'birth_count', level: 'township',
    label: '每月出生數（歷史快照）', unit: '人', frequency: '歷史月份快照', dimensions: {},
    breaks: [10, 30, 100, 300], colors: ['#eff6ff', '#bfdbfe', '#60a5fa', '#2563eb', '#1e3a8a'],
  },
  statsPigWaterCounty: {
    dataset_id: 'livestock_pig_water_county', indicator_id: 'pig_water_thousand_m3', level: 'county',
    label: '養豬用水量（歷史統計）', unit: '千立方公尺', frequency: '歷史年度統計', dimensions: { animal_kind: 'pig' },
    breaks: [100, 500, 2000, 5000], colors: ['#eff6ff', '#bfdbfe', '#60a5fa', '#2563eb', '#1e3a8a'],
  },
  statsWaterSupplyHistorical: {
    dataset_id: 'water_supply_county_historical', indicator_id: 'supplied_population_rate_pct', level: 'county',
    label: '供水普及率（2015年／7縣市）', unit: '%', frequency: '歷史年度統計', dimensions: {},
    breaks: [80, 90, 95, 99], colors: ['#eff6ff', '#bfdbfe', '#60a5fa', '#2563eb', '#1e3a8a'],
  },
  statsMaritimeSubsidyCounty: {
    dataset_id: 'maritime_bureau_subsidy_county', indicator_id: 'maritime_bureau_recipient_county_subsidy_twd', level: 'county',
    label: '航港局獎補助金額（受補助對象所在地）', unit: 'TWD', frequency: '每月',
    releaseId: '2026-07-01-d6c9ce1998ef-37b0932fc00e',
    dimensions: { roc_year: '115', month: '07', agency_fund: '交通部航港局' },
    includeHealth: true,
    releaseSelector: maritimeSubsidyReleaseSelector,
    interpretationNote: '依受補助對象所在地彙總；不是工程地、港口投資地或最終受益地。PARTIAL coverage 與未分配金額會另外揭露，缺值不等於 0。',
    breaks: [1_000_000, 5_000_000, 20_000_000, 50_000_000], colors: ['#eff6ff', '#bfdbfe', '#60a5fa', '#2563eb', '#1e3a8a'],
  },
  statsCivilAeronauticsSubsidyCounty: {
    dataset_id: 'civil_aeronautics_subsidy_county', indicator_id: 'civil_aeronautics_recipient_county_subsidy_twd_ytd', level: 'county',
    label: '民航局獎補助費（受補助對象所在地）', unit: 'TWD', frequency: '每季（目前僅 112Q4 歷史快照）',
    freshness: 'STALE',
    releaseId: '2023-Q4-civil_aviation_fund-f5ca6a3e44fb',
    dimensions: { roc_year: '112', quarter: 'Q4', budget_type: 'civil_aviation_fund', value_basis: 'year_to_date_cumulative' },
    includeHealth: true,
    releaseSelector: civilAeronauticsSubsidyReleaseSelector,
    interpretationNote: '112Q4 的年度累計歷史快照，依受補助對象所在地縣市彙總；不是機場、工程或實際受益地。特別預算與公務預算總額相同但核准日期不同，來源疑義已保留；不得跨預算類型或期別合計。STALE／PARTIAL、未分配與缺值會另外揭露。',
    breaks: [100_000, 500_000, 2_000_000, 10_000_000], colors: ['#fef3c7', '#fde68a', '#f59e0b', '#d97706', '#92400e'],
  },
  statsOffstreetSmallCarParkingSpacesCount: {
    dataset_id: 'dgbas_county_transport_supply_10935', indicator_id: 'offstreet_small_car_parking_spaces_count', level: 'county',
    label: '小型汽車路外停車位', unit: '個', frequency: '年度（112／113 年）', dimensions: { roc_year: '113' },
    includeHealth: true,
    releaseSelector: countyTransportSupplyReleaseSelector,
    breaks: [5_000, 20_000, 50_000, 100_000], colors: ['#ecfeff', '#a5f3fc', '#22d3ee', '#0891b2', '#164e63'],
  },
  statsOnstreetSmallCarParkingSpacesCount: {
    dataset_id: 'dgbas_county_transport_supply_10935', indicator_id: 'onstreet_small_car_parking_spaces_count', level: 'county',
    label: '小型汽車路邊停車位', unit: '個', frequency: '年度（112／113 年）', dimensions: { roc_year: '113' },
    includeHealth: true,
    releaseSelector: countyTransportSupplyReleaseSelector,
    breaks: [1_000, 5_000, 10_000, 20_000], colors: ['#f0fdf4', '#bbf7d0', '#4ade80', '#16a34a', '#14532d'],
  },
  statsMotorcycleRegisteredCount: {
    dataset_id: 'dgbas_county_transport_supply_10935', indicator_id: 'motorcycle_registered_count', level: 'county',
    label: '機車登記數', unit: '輛', frequency: '年度（112／113 年）', dimensions: { roc_year: '113' },
    includeHealth: true,
    releaseSelector: countyTransportSupplyReleaseSelector,
    breaks: [100_000, 300_000, 600_000, 1_000_000], colors: ['#fdf4ff', '#f5d0fe', '#e879f9', '#c026d3', '#701a75'],
  },
  statsAutomobileRegisteredCount: {
    dataset_id: 'dgbas_county_transport_supply_10935', indicator_id: 'automobile_registered_count', level: 'county',
    label: '汽車登記數', unit: '輛', frequency: '年度（112／113 年）', dimensions: { roc_year: '113' },
    includeHealth: true,
    releaseSelector: countyTransportSupplyReleaseSelector,
    breaks: [50_000, 150_000, 300_000, 600_000], colors: ['#eff6ff', '#bfdbfe', '#60a5fa', '#2563eb', '#1e3a8a'],
  },
  statsAutomobileLicenseHoldersCount: {
    dataset_id: 'dgbas_county_transport_supply_10935', indicator_id: 'automobile_license_holders_count', level: 'county',
    label: '汽車駕照持有人數', unit: '人', frequency: '年度（112／113 年）', dimensions: { roc_year: '113' },
    includeHealth: true,
    releaseSelector: countyTransportSupplyReleaseSelector,
    breaks: [100_000, 300_000, 600_000, 1_000_000], colors: ['#fff7ed', '#fed7aa', '#fb923c', '#ea580c', '#7c2d12'],
  },
  statsMotorcycleLicenseHoldersCount: {
    dataset_id: 'dgbas_county_transport_supply_10935', indicator_id: 'motorcycle_license_holders_count', level: 'county',
    label: '機車駕照持有人數', unit: '人', frequency: '年度（112／113 年）', dimensions: { roc_year: '113' },
    includeHealth: true,
    releaseSelector: countyTransportSupplyReleaseSelector,
    breaks: [100_000, 300_000, 600_000, 1_000_000], colors: ['#fefce8', '#fef08a', '#facc15', '#ca8a04', '#713f12'],
  },
} as const;
export type StatisticsLayerKey = keyof typeof STATISTICS_RECIPES;
export const STATISTICS_KEYS = Object.keys(STATISTICS_RECIPES) as StatisticsLayerKey[];

/** Optional fallback is safe only when its release identity gives exact dimensions. */
export function statisticsReleaseFallback(key: StatisticsLayerKey) {
  const recipe = STATISTICS_RECIPES[key];
  if (!('releaseSelector' in recipe) || !recipe.releaseSelector) return undefined;
  return (release: { release_id: string; period_start: string }) => recipe.releaseSelector.resolve(release)?.dimensions ?? null;
}
export function isStatisticsLayer(key: string): key is StatisticsLayerKey {
  return Object.prototype.hasOwnProperty.call(STATISTICS_RECIPES, key);
}

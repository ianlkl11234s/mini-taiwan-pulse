/** Presentation configuration only; values, periods and sources come from the public catalog. */
export interface StatisticsReleaseOption {
  releaseId: string;
  dimensions: Record<string, string>;
}

export interface StatisticsReleaseSelector {
  /** Only derives choices from public releases, never invents a dimensions tuple. */
  resolve(release: { release_id: string; period_start: string }): StatisticsReleaseOption | null;
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

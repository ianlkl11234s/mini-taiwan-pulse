/** Presentation configuration only; values, periods and sources come from the public catalog. */
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
} as const;
export type StatisticsLayerKey = keyof typeof STATISTICS_RECIPES;
export const STATISTICS_KEYS = Object.keys(STATISTICS_RECIPES) as StatisticsLayerKey[];
export function isStatisticsLayer(key: string): key is StatisticsLayerKey {
  return Object.prototype.hasOwnProperty.call(STATISTICS_RECIPES, key);
}

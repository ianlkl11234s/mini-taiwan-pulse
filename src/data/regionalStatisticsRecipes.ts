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
  '2023-Q4-civil_aviation_fund-9634953cca17': { roc_year: '112', quarter: 'Q4', budget_type: 'civil_aviation_fund', value_basis: 'year_to_date_cumulative' },
  '2023-Q4-public_budget-86427919b003': { roc_year: '112', quarter: 'Q4', budget_type: 'public_budget', value_basis: 'year_to_date_cumulative' },
  '2023-Q4-special_budget-188f815b00fc': { roc_year: '112', quarter: 'Q4', budget_type: 'special_budget', value_basis: 'year_to_date_cumulative' },
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

/** Immutable 114-year Taipei citation bundles; opaque release IDs are explicitly whitelisted. */
const TAIPEI_TRAFFIC_VIOLATION_ARTICLE_BY_RELEASE: Record<string, string> = {
  '2025-63000-3ae38195a39a-22c825ca2e23': '第12條', '2025-63000-68bd6716dca1-406e8e216c55': '第13條',
  '2025-63000-07cf1b154f00-20d0311721b2': '第14條', '2025-63000-e90c015e42fb-0ff29a800803': '第15條',
  '2025-63000-946a1dd67a73-43fc566b977e': '第16條', '2025-63000-621465b5e788-f23f7570ee02': '第17條',
  '2025-63000-30981441db70-3c1ea9dc1486': '第18條', '2025-63000-7ccd6f3f1181-acbe0fd6f47b': '第19條',
  '2025-63000-788748d489f2-3cd3c2cf0aed': '第20條', '2025-63000-4f7a85f8d196-743c3819ea10': '第21條',
  '2025-63000-74fb31d00fae-41fb931772ba': '第22條', '2025-63000-13a85444c324-d4fcf7c950de': '第23條',
  '2025-63000-12d3e1e2c99b-22929e43c5e0': '第25條', '2025-63000-f16ccfa0a009-bd812cd35fb8': '第26條',
  '2025-63000-c2add188b263-3ab995d45e01': '第29條', '2025-63000-81b3d99232a9-ad1306b9e81f': '第30條',
  '2025-63000-d12490fc814e-0abfcbb9cc31': '第31條', '2025-63000-de3e7745f092-58b03581db06': '第32條',
  '2025-63000-9dc64c47f5f4-9829c4bde06c': '第34條', '2025-63000-b8255eea7bd8-fff24d68bd8f': '第35條',
  '2025-63000-38ce63b544cf-97a83c2c7b87': '第36條', '2025-63000-e5f10b9bac63-f52db6ba2345': '第37條',
  '2025-63000-c07a8cdde84b-8e19f9721b30': '第38條', '2025-63000-74b6b40267e0-ac395836c7ee': '第39條',
  '2025-63000-b3041a41e63b-f7b001cabae0': '第40條', '2025-63000-06fa7fcbec94-5a524da15578': '第41條',
  '2025-63000-3cb8325670cd-80eb526a6611': '第42條', '2025-63000-bc314066c2b0-ea7d16756f88': '第43條',
  '2025-63000-116e3653fc8e-994ce9af83a1': '第44條', '2025-63000-3243777dd3c3-8eb6d6e28253': '第45條',
  '2025-63000-5fbc9c13e78f-8475757946f1': '第46條', '2025-63000-c881aaba872c-f34f8b677378': '第47條',
  '2025-63000-12741d3ea165-4f08e4ad3702': '第48條', '2025-63000-27c5b3eb4922-dc586e9edb6e': '第49條',
  '2025-63000-9663029359ce-6f973eb6cfa0': '第50條', '2025-63000-4b606f7de33d-b8d363b103e8': '第53條',
  '2025-63000-6f4a6ba19244-e8d4231f4190': '第55條', '2025-63000-1d9fa9c9d9d9-a4555b1caba7': '第56條',
  '2025-63000-763a0cd68a1d-3606484af0c3': '第57條', '2025-63000-b5e94381aa78-3ae047473e22': '第58條',
  '2025-63000-c5e7dba93877-3b1858f71aeb': '第59條', '2025-63000-5b50ae912fc2-57e3990fa715': '第60條',
  '2025-63000-5635577d719a-75dad072b5d9': '第61條', '2025-63000-11bccc330163-5b5b9c5a1cda': '第62條',
  '2025-63000-6be46db25aba-e2f15a47dcd2': '第69條', '2025-63000-405d0f6b83f6-0d7990ee365d': '第71條',
  '2025-63000-fe58a5a5d00c-95ff83bc0813': '第72條', '2025-63000-4bd1ddf2406d-d2c7c0aead10': '第73條',
  '2025-63000-c87e0166e4fb-d859d843da26': '第74條', '2025-63000-e1cb234bff76-0c2e44691e37': '第76條',
  '2025-63000-c36be5742291-9b553ac80646': '第78條', '2025-63000-7154d44cf6bc-7be79165d90a': '第81條',
  '2025-63000-68a34ba35547-25759a09695b': '第82條', '2025-63000-9d1fed594bba-fbc2a4660d66': '第83條',
  '2025-63000-f7edfae63ae4-1d2c82638b04': '第84條', '2025-63000-99b5821aee56-8bd89bcf81a0': '第85條',
  '2025-63000-c16bc5a4f13c-8619937cb6fc': '第92條',
};

export const taipeiTrafficViolationCitationReleaseSelector: StatisticsReleaseSelector = {
  resolve(release) {
    const lawArticle = TAIPEI_TRAFFIC_VIOLATION_ARTICLE_BY_RELEASE[release.release_id];
    if (!lawArticle || release.period_start !== '2025-01-01' || release.period_end !== '2025-12-31') return null;
    return { releaseId: release.release_id, dimensions: { roc_year: '114', law_article: lawArticle, geographic_coverage: 'taipei_only' } };
  },
};

const TAICHUNG_ROAD_NOISE_ZONE_BY_RELEASE: Record<string, string> = {
  '2024-Q3-66000-5d2656bf680f': '第一類管制區',
  '2024-Q3-66000-ad3c4abfd5d6': '第二類管制區',
  '2024-Q3-66000-10cd7f07523f': '第三類管制區',
  '2024-Q3-66000-40789289a250': '第四類管制區',
};

/** Only the four immutable 2024-Q3 source classes are selectable. */
export const taichungRoadNoiseMonitoringReleaseSelector: StatisticsReleaseSelector = {
  resolve(release) {
    const controlZoneClass = TAICHUNG_ROAD_NOISE_ZONE_BY_RELEASE[release.release_id];
    if (!controlZoneClass || release.period_start !== '2024-07-01' || release.period_end !== '2024-09-30') return null;
    return { releaseId: release.release_id, dimensions: { roc_year: '113', quarter: 'Q3', control_zone_class: controlZoneClass, geographic_coverage: 'taichung_only' } };
  },
};

const BUS_OPERATION_SOURCE_FIELD_BY_RELEASE: Record<string, string> = {
  '2025-114-column1-fcb90c6e6b05': 'COLUMN1',
  '2025-114-column2-2cfcc51bbaeb': 'COLUMN2',
  '2025-114-column3-d29188c54350': 'COLUMN3',
  '2025-114-column4-9e012e606e3a': 'COLUMN4',
  '2025-114-column5-f4969fae6a17': 'COLUMN5',
  '2025-114-column6-5a90492f645a': 'COLUMN6',
  '2025-114-column7-27ac5f545458': 'COLUMN7',
  '2025-114-column8-be577682e7b9': 'COLUMN8',
};

/** Only the eight manifest-listed 114Y SEGIS fields are selectable. */
export const busOperationReleaseSelector: StatisticsReleaseSelector = {
  resolve(release) {
    const sourceField = BUS_OPERATION_SOURCE_FIELD_BY_RELEASE[release.release_id];
    if (!sourceField || release.period_start !== '2025-01-01' || release.period_end !== '2025-12-31') return null;
    return { releaseId: release.release_id, dimensions: { roc_year: '114', source_field: sourceField, geographic_coverage: 'national_county' } };
  },
};

/** Only the manifest-listed 2025-12 facility-crosswalk release is selectable. */
export const tmrtStationOutboundReleaseSelector: StatisticsReleaseSelector = {
  resolve(release) {
    if (release.release_id !== '2025-12-tmrt-station-outbound-2412a544-4ace434cfa54' || release.period_start !== '2025-12-01' || release.period_end !== '2025-12-31') return null;
    return { releaseId: release.release_id, dimensions: { roc_year: '114', month: '12', system_id: 'tmrt', geographic_semantics: 'station_location' } };
  },
};

const TAIPEI_BICYCLE_DIMENSIONS: Record<string, Record<string, string>> = {
  '2021-110-column1-12f2c393ddcb': { roc_year: '110', source_field: 'COLUMN1', geographic_coverage: 'taipei_township_only' },
  '2021-110-column3-b54da2184638': { roc_year: '110', source_field: 'COLUMN3', geographic_coverage: 'taipei_township_only' },
  '2021-110-column5-18fb44cef15d': { roc_year: '110', source_field: 'COLUMN5', geographic_coverage: 'taipei_township_only' },
  '2021-110-column6-e086f1f0d13b': { roc_year: '110', source_field: 'COLUMN6', geographic_coverage: 'taipei_township_only' },
  '2021-110-column7-789178e51f5b': { roc_year: '110', source_field: 'COLUMN7', geographic_coverage: 'taipei_township_only' },
};
export const taipeiBicycleReleaseSelector: StatisticsReleaseSelector = { resolve(release) {
  const dimensions = TAIPEI_BICYCLE_DIMENSIONS[release.release_id];
  return dimensions && release.period_start === '2021-01-01' && release.period_end === '2021-12-31' ? { releaseId: release.release_id, dimensions } : null;
} };

const A1_DIMENSIONS = { year: '2025', accident_class: 'A1', geographic_coverage: 'county_location' };
const A1_RELEASES = new Set(['2025-a1_accident_count-a4edcb32fca1', '2025-a1_death_count-6c2ddae0632c', '2025-a1_injury_count-bef1310f8549']);
export const a1AccidentReleaseSelector: StatisticsReleaseSelector = { resolve(release) {
  return A1_RELEASES.has(release.release_id) && release.period_start === '2025-01-01' && release.period_end === '2025-12-31' ? { releaseId: release.release_id, dimensions: A1_DIMENSIONS } : null;
} };

const CAA_AIRPORT_DIMENSIONS = { roc_year: '115', month: '07', geographic_semantics: 'facility_location_activity', health: 'CURRENT', coverage: 'PARTIAL' };
const CAA_AIRPORT_RELEASES = new Set(['2026-07-caa-airport-takeoffs_landings_count-21a7e7f4-152b35d71cab', '2026-07-caa-airport-airport_passenger_movements-21a7e7f4-f3d8707e7740', '2026-07-caa-airport-airport_cargo_tonnes-21a7e7f4-b53d2f849a96']);
export const caaAirportActivityReleaseSelector: StatisticsReleaseSelector = { resolve(release) {
  return CAA_AIRPORT_RELEASES.has(release.release_id) && release.period_start === '2026-07-01' && release.period_end === '2026-07-31' ? { releaseId: release.release_id, dimensions: CAA_AIRPORT_DIMENSIONS } : null;
} };

const TAOYUAN_AIRPORT_DIMENSIONS = { year: '2022', airport_iata: 'TPE', airport_icao: 'RCTP', geographic_semantics: 'facility_location_activity', health: 'STALE', refresh: 'manual' };
const TAOYUAN_AIRPORT_RELEASES = new Set(['2022-taoyuan-airport-airport_arrivals_count-d6d399a1-98c10b4dc1a8', '2022-taoyuan-airport-airport_departures_count-d6d399a1-e978ed456827', '2022-taoyuan-airport-airport_transit_count-d6d399a1-93ef361ca2f6', '2022-taoyuan-airport-airport_passenger_movements-d6d399a1-3fea2b07f916']);
export const taoyuanAirportReleaseSelector: StatisticsReleaseSelector = { resolve(release) {
  return TAOYUAN_AIRPORT_RELEASES.has(release.release_id) && release.period_start === '2022-01-01' && release.period_end === '2022-12-31' ? { releaseId: release.release_id, dimensions: TAOYUAN_AIRPORT_DIMENSIONS } : null;
} };

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
    // 不保留會被撤回的 opaque release id；loader 由白名單 selector 取最新公開期別與基金。
    dimensions: {},
    includeHealth: true,
    releaseSelector: maritimeSubsidyReleaseSelector,
    interpretationNote: '依受補助對象所在地彙總；不是工程地、港口投資地或最終受益地。PARTIAL coverage 與未分配金額會另外揭露，缺值不等於 0。',
    breaks: [1_000_000, 5_000_000, 20_000_000, 50_000_000], colors: ['#eff6ff', '#bfdbfe', '#60a5fa', '#2563eb', '#1e3a8a'],
  },
  statsCivilAeronauticsSubsidyCounty: {
    dataset_id: 'civil_aeronautics_subsidy_county', indicator_id: 'civil_aeronautics_recipient_county_subsidy_twd_ytd', level: 'county',
    label: '民航局獎補助費（受補助對象所在地）', unit: 'TWD', frequency: '每季（目前僅 112Q4 歷史快照）',
    freshness: 'STALE',
    releaseId: '2023-Q4-civil_aviation_fund-9634953cca17',
    dimensions: { roc_year: '112', quarter: 'Q4', budget_type: 'civil_aviation_fund', value_basis: 'year_to_date_cumulative' },
    includeHealth: true,
    releaseSelector: civilAeronauticsSubsidyReleaseSelector,
    interpretationNote: '112Q4 的年度累計歷史快照，依受補助對象所在地縣市彙總；不是機場、工程或實際受益地。特別預算與公務預算總額相同但核准日期不同，來源疑義已保留；不得跨預算類型或期別合計。STALE／PARTIAL、未分配與缺值會另外揭露。',
    breaks: [100_000, 500_000, 2_000_000, 10_000_000], colors: ['#fef3c7', '#fde68a', '#f59e0b', '#d97706', '#92400e'],
  },
  statsTaipeiTrafficViolationCitations: {
    dataset_id: 'taipei_traffic_violation_citations_135096', indicator_id: 'traffic_violation_citation_count', level: 'county',
    label: '臺北市交通違規舉發筆數（法條）', unit: '筆', frequency: '年度（114 年）',
    releaseId: '2025-63000-3ae38195a39a-22c825ca2e23', dimensions: { roc_year: '114', law_article: '第12條', geographic_coverage: 'taipei_only' },
    includeHealth: true, releaseSelector: taipeiTrafficViolationCitationReleaseSelector,
    interpretationNote: '僅臺北市原生統計，其他 21 縣市為缺資料；按法條分類的舉發筆數不可跨法條合計為唯一事件或人數。',
    breaks: [1_000, 10_000, 50_000, 200_000], colors: ['#f5f3ff', '#ddd6fe', '#a78bfa', '#7c3aed', '#4c1d95'],
  },
  statsTaichungRoadNoiseMonitoringStations: {
    dataset_id: 'taichung_road_noise_monitoring_stations_89477', indicator_id: 'road_traffic_noise_monitoring_station_count', level: 'county',
    label: '臺中市道路交通噪音監測站數', unit: '站', frequency: '2024 Q3 歷史快照',
    releaseId: '2024-Q3-66000-5d2656bf680f', dimensions: { roc_year: '113', quarter: 'Q3', control_zone_class: '第一類管制區', geographic_coverage: 'taichung_only' },
    includeHealth: true, releaseSelector: taichungRoadNoiseMonitoringReleaseSelector,
    interpretationNote: '僅臺中市原生監測站數，其他 21 縣市為缺資料；按管制區類別不可合計。來源表名的「不合格情形」不表示這些監測站數為不合格站數，12 筆不合格時段未納入。',
    breaks: [1, 2, 3, 4], colors: ['#ecfeff', '#a5f3fc', '#22d3ee', '#0891b2', '#164e63'],
  },
  statsBusOperatingRouteLengthKm: { dataset_id: 'segis_bus_operation_county_315fh_1d3', indicator_id: 'bus_operating_route_length_km', level: 'county', label: '期末營業里程', unit: '公里', frequency: '年度（114 年）', releaseId: '2025-114-column1-fcb90c6e6b05', dimensions: { roc_year: '114', source_field: 'COLUMN1', geographic_coverage: 'national_county' }, includeHealth: true, releaseSelector: busOperationReleaseSelector, interpretationNote: '官方縣市市區客運供給統計；不可跨指標或路線加總，也不代表唯一乘客或路線。', breaks: [500, 1_500, 3_000, 6_000], colors: ['#eff6ff', '#bfdbfe', '#60a5fa', '#2563eb', '#1e3a8a'] },
  statsBusApprovedRouteCount: { dataset_id: 'segis_bus_operation_county_315fh_1d3', indicator_id: 'bus_approved_route_count', level: 'county', label: '核定路線數', unit: '條', frequency: '年度（114 年）', releaseId: '2025-114-column2-2cfcc51bbaeb', dimensions: { roc_year: '114', source_field: 'COLUMN2', geographic_coverage: 'national_county' }, includeHealth: true, releaseSelector: busOperationReleaseSelector, interpretationNote: '官方縣市市區客運供給統計；不可跨指標或路線加總，也不代表唯一乘客或路線。', breaks: [50, 150, 300, 600], colors: ['#f0fdf4', '#bbf7d0', '#4ade80', '#16a34a', '#14532d'] },
  statsUrbanBusOperatorCount: { dataset_id: 'segis_bus_operation_county_315fh_1d3', indicator_id: 'urban_bus_operator_count', level: 'county', label: '市區客運業家數', unit: '家', frequency: '年度（114 年）', releaseId: '2025-114-column3-d29188c54350', dimensions: { roc_year: '114', source_field: 'COLUMN3', geographic_coverage: 'national_county' }, includeHealth: true, releaseSelector: busOperationReleaseSelector, interpretationNote: '官方縣市市區客運供給統計；不可跨指標或路線加總，也不代表唯一乘客或路線。', breaks: [5, 15, 30, 60], colors: ['#fdf4ff', '#f5d0fe', '#e879f9', '#c026d3', '#701a75'] },
  statsBusOperatingVehicleCount: { dataset_id: 'segis_bus_operation_county_315fh_1d3', indicator_id: 'bus_operating_vehicle_count', level: 'county', label: '期末營業車輛', unit: '輛', frequency: '年度（114 年）', releaseId: '2025-114-column4-9e012e606e3a', dimensions: { roc_year: '114', source_field: 'COLUMN4', geographic_coverage: 'national_county' }, includeHealth: true, releaseSelector: busOperationReleaseSelector, interpretationNote: '官方縣市市區客運供給統計；不可跨指標或路線加總，也不代表唯一乘客或路線。', breaks: [100, 300, 800, 1_500], colors: ['#fff7ed', '#fed7aa', '#fb923c', '#ea580c', '#7c2d12'] },
  statsBusAccessibleVehicleCount: { dataset_id: 'segis_bus_operation_county_315fh_1d3', indicator_id: 'bus_accessible_vehicle_count', level: 'county', label: '期末無障礙車輛', unit: '輛', frequency: '年度（114 年）', releaseId: '2025-114-column5-f4969fae6a17', dimensions: { roc_year: '114', source_field: 'COLUMN5', geographic_coverage: 'national_county' }, includeHealth: true, releaseSelector: busOperationReleaseSelector, interpretationNote: '官方縣市市區客運供給統計；不可跨指標或路線加總，也不代表唯一乘客或路線。', breaks: [30, 100, 300, 600], colors: ['#ecfeff', '#a5f3fc', '#22d3ee', '#0891b2', '#164e63'] },
  statsBusElectricVehicleCount: { dataset_id: 'segis_bus_operation_county_315fh_1d3', indicator_id: 'bus_electric_vehicle_count', level: 'county', label: '期末電動車輛', unit: '輛', frequency: '年度（114 年）', releaseId: '2025-114-column6-5a90492f645a', dimensions: { roc_year: '114', source_field: 'COLUMN6', geographic_coverage: 'national_county' }, includeHealth: true, releaseSelector: busOperationReleaseSelector, interpretationNote: '官方縣市市區客運供給統計；7 個縣市來源為 null，保留為缺資料；不可跨指標或路線加總。', breaks: [20, 80, 200, 500], colors: ['#fefce8', '#fef08a', '#facc15', '#ca8a04', '#713f12'] },
  statsBusOperatingTripCount: { dataset_id: 'segis_bus_operation_county_315fh_1d3', indicator_id: 'bus_operating_trip_count', level: 'county', label: '營業行車次數', unit: '班次', frequency: '年度（114 年）', releaseId: '2025-114-column7-27ac5f545458', dimensions: { roc_year: '114', source_field: 'COLUMN7', geographic_coverage: 'national_county' }, includeHealth: true, releaseSelector: busOperationReleaseSelector, interpretationNote: '官方縣市市區客運供給統計；不可跨指標或路線加總，也不代表唯一乘客或路線。', breaks: [100_000, 500_000, 1_500_000, 4_000_000], colors: ['#f5f3ff', '#ddd6fe', '#a78bfa', '#7c3aed', '#4c1d95'] },
  statsBusOperatingVehicleKm: { dataset_id: 'segis_bus_operation_county_315fh_1d3', indicator_id: 'bus_operating_vehicle_km', level: 'county', label: '營業行車里程', unit: '車公里', frequency: '年度（114 年）', releaseId: '2025-114-column8-be577682e7b9', dimensions: { roc_year: '114', source_field: 'COLUMN8', geographic_coverage: 'national_county' }, includeHealth: true, releaseSelector: busOperationReleaseSelector, interpretationNote: '官方縣市市區客運供給統計；不可跨指標或路線加總，也不代表唯一乘客或路線。', breaks: [1_000_000, 10_000_000, 30_000_000, 80_000_000], colors: ['#fef2f2', '#fecaca', '#f87171', '#dc2626', '#7f1d1d'] },
  statsTmrtStationOutboundCounty: { dataset_id: 'tmrt_station_outbound_county', indicator_id: 'station_outbound_count', level: 'county', label: '中捷車站所在地出站人次', unit: '人次', frequency: '2025 年 12 月歷史快照', freshness: 'STALE', releaseId: '2025-12-tmrt-station-outbound-2412a544-4ace434cfa54', dimensions: { roc_year: '114', month: '12', system_id: 'tmrt', geographic_semantics: 'station_location' }, includeHealth: true, releaseSelector: tmrtStationOutboundReleaseSelector, interpretationNote: '18 個中捷車站所在地的出站人次；不是不重複旅客、居民旅運或全市旅次。僅臺中市可由站點 crosswalk 分派，256 人次其他出站不可分派。', breaks: [100_000, 500_000, 1_000_000, 1_500_000], colors: ['#ecfeff', '#a5f3fc', '#22d3ee', '#0891b2', '#164e63'] },
  statsTaipeiUrbanRentalStations: { dataset_id: 'segis_taipei_bicycle_usage_township_110', indicator_id: 'taipei_urban_rental_stations', level: 'township', label: '市區自行車租借站數', unit: '站', frequency: '110 年歷史快照', freshness: 'STALE', releaseId: '2021-110-column1-12f2c393ddcb', dimensions: TAIPEI_BICYCLE_DIMENSIONS['2021-110-column1-12f2c393ddcb'], includeHealth: true, releaseSelector: taipeiBicycleReleaseSelector, interpretationNote: '僅臺北市 12 區的 110 年來源定義站數；不是即時站點或車輛可用量。COLUMN2、4、8 的全零或比率欄位未發布。', breaks: [20, 50, 100, 150], colors: ['#eff6ff', '#bfdbfe', '#60a5fa', '#2563eb', '#1e3a8a'] },
  statsTaipeiUrbanRentalTrips: { dataset_id: 'segis_taipei_bicycle_usage_township_110', indicator_id: 'taipei_urban_annual_rental_person_trips', level: 'township', label: '市區自行車年租借次數', unit: '人次', frequency: '110 年歷史快照', freshness: 'STALE', releaseId: '2021-110-column3-b54da2184638', dimensions: TAIPEI_BICYCLE_DIMENSIONS['2021-110-column3-b54da2184638'], includeHealth: true, releaseSelector: taipeiBicycleReleaseSelector, interpretationNote: '僅臺北市 12 區的 110 年來源定義租借人次；不是不重複騎士或即時旅次，政策變動不宜跨期比較。', breaks: [500_000, 1_500_000, 3_000_000, 5_000_000], colors: ['#f0fdf4', '#bbf7d0', '#4ade80', '#16a34a', '#14532d'] },
  statsTaipeiRiversideRentalStations: { dataset_id: 'segis_taipei_bicycle_usage_township_110', indicator_id: 'taipei_riverside_rental_stations', level: 'township', label: '河濱公園租借站數', unit: '站', frequency: '110 年歷史快照', freshness: 'STALE', releaseId: '2021-110-column5-18fb44cef15d', dimensions: TAIPEI_BICYCLE_DIMENSIONS['2021-110-column5-18fb44cef15d'], includeHealth: true, releaseSelector: taipeiBicycleReleaseSelector, interpretationNote: '僅臺北市 12 區的 110 年來源定義河濱站數；不是市區站數或即時服務狀態。', breaks: [1, 2, 3, 4], colors: ['#ecfeff', '#a5f3fc', '#22d3ee', '#0891b2', '#164e63'] },
  statsTaipeiRiversideBicycles: { dataset_id: 'segis_taipei_bicycle_usage_township_110', indicator_id: 'taipei_riverside_bicycles', level: 'township', label: '河濱公園自行車數', unit: '輛', frequency: '110 年歷史快照', freshness: 'STALE', releaseId: '2021-110-column6-e086f1f0d13b', dimensions: TAIPEI_BICYCLE_DIMENSIONS['2021-110-column6-e086f1f0d13b'], includeHealth: true, releaseSelector: taipeiBicycleReleaseSelector, interpretationNote: '僅臺北市 12 區的 110 年來源定義河濱自行車數；不是可租車輛即時庫存。', breaks: [100, 250, 400, 600], colors: ['#fff7ed', '#fed7aa', '#fb923c', '#ea580c', '#7c2d12'] },
  statsTaipeiRiversideRentalTrips: { dataset_id: 'segis_taipei_bicycle_usage_township_110', indicator_id: 'taipei_riverside_annual_rental_person_trips', level: 'township', label: '河濱公園年租借次數', unit: '人次', frequency: '110 年歷史快照', freshness: 'STALE', releaseId: '2021-110-column7-789178e51f5b', dimensions: TAIPEI_BICYCLE_DIMENSIONS['2021-110-column7-789178e51f5b'], includeHealth: true, releaseSelector: taipeiBicycleReleaseSelector, interpretationNote: '僅臺北市 12 區的 110 年來源定義河濱租借人次；不是不重複騎士或即時旅次。', breaks: [10_000, 30_000, 60_000, 100_000], colors: ['#f5f3ff', '#ddd6fe', '#a78bfa', '#7c3aed', '#4c1d95'] },
  statsA1AccidentCount: { dataset_id: 'npa_a1_accident_county_177136', indicator_id: 'a1_accident_count', level: 'county', label: 'A1 交通事故件數', unit: '件', frequency: '年度（114 年）', releaseId: '2025-a1_accident_count-a4edcb32fca1', dimensions: A1_DIMENSIONS, includeHealth: true, releaseSelector: a1AccidentReleaseSelector, interpretationNote: 'A1 是當場或 24 小時內死亡事故類別，不是全部交通事故。21 縣市有觀測值，連江缺資料；8 件無法唯一落縣仍未分配。', breaks: [20, 50, 100, 200], colors: ['#fef2f2', '#fecaca', '#f87171', '#dc2626', '#7f1d1d'] },
  statsA1DeathCount: { dataset_id: 'npa_a1_accident_county_177136', indicator_id: 'a1_death_count', level: 'county', label: 'A1 交通事故死亡人數', unit: '人', frequency: '年度（114 年）', releaseId: '2025-a1_death_count-6c2ddae0632c', dimensions: A1_DIMENSIONS, includeHealth: true, releaseSelector: a1AccidentReleaseSelector, interpretationNote: 'A1 是當場或 24 小時內死亡事故類別，不是全事故死亡人數。21 縣市有觀測值，連江缺資料；9 人未分配。', breaks: [20, 50, 100, 200], colors: ['#fef2f2', '#fecaca', '#f87171', '#dc2626', '#7f1d1d'] },
  statsA1InjuryCount: { dataset_id: 'npa_a1_accident_county_177136', indicator_id: 'a1_injury_count', level: 'county', label: 'A1 交通事故受傷人數', unit: '人', frequency: '年度（114 年）', releaseId: '2025-a1_injury_count-bef1310f8549', dimensions: A1_DIMENSIONS, includeHealth: true, releaseSelector: a1AccidentReleaseSelector, interpretationNote: 'A1 是當場或 24 小時內死亡事故類別，不是全部交通事故傷者。21 縣市有觀測值，連江缺資料；3 人未分配。', breaks: [10, 25, 50, 100], colors: ['#fffbeb', '#fde68a', '#fbbf24', '#d97706', '#78350f'] },
  statsAirportTakeoffsLandings: { dataset_id: 'caa_airport_activity_county_33238', indicator_id: 'takeoffs_landings_count', level: 'county', label: '機場所在地起降架次', unit: '次', frequency: '每月（115 年 7 月）', releaseId: '2026-07-caa-airport-takeoffs_landings_count-21a7e7f4-152b35d71cab', dimensions: CAA_AIRPORT_DIMENSIONS, includeHealth: true, releaseSelector: caaAirportActivityReleaseSelector, interpretationNote: '依機場所在地彙總，非居民或航空公司所在地；計數來源為官方 CAA，落界點位採已保存 mixed-source reference snapshot（逐筆上游未保存），不聲稱點位為純官方。16 個數值機場中 15 個落界，望安 16 架次未分配，恆春連字號保留缺值。', breaks: [100, 500, 2_000, 10_000], colors: ['#eff6ff', '#bfdbfe', '#60a5fa', '#2563eb', '#1e3a8a'] },
  statsAirportPassengerMovements: { dataset_id: 'caa_airport_activity_county_33238', indicator_id: 'airport_passenger_movements', level: 'county', label: '機場所在地旅客人次', unit: '人次', frequency: '每月（115 年 7 月）', releaseId: '2026-07-caa-airport-airport_passenger_movements-21a7e7f4-f3d8707e7740', dimensions: CAA_AIRPORT_DIMENSIONS, includeHealth: true, releaseSelector: caaAirportActivityReleaseSelector, interpretationNote: '依機場所在地彙總，含入境、出境與過境，不是居民或不重複旅客；計數來源為官方 CAA，落界點位採已保存 mixed-source reference snapshot（逐筆上游未保存），不聲稱點位為純官方。望安 196 人次未分配，恆春連字號保留缺值。', breaks: [10_000, 100_000, 500_000, 2_000_000], colors: ['#f0fdf4', '#bbf7d0', '#4ade80', '#16a34a', '#14532d'] },
  statsAirportCargoTonnes: { dataset_id: 'caa_airport_activity_county_33238', indicator_id: 'airport_cargo_tonnes', level: 'county', label: '機場所在地貨運量', unit: '公噸', frequency: '每月（115 年 7 月）', releaseId: '2026-07-caa-airport-airport_cargo_tonnes-21a7e7f4-b53d2f849a96', dimensions: CAA_AIRPORT_DIMENSIONS, includeHealth: true, releaseSelector: caaAirportActivityReleaseSelector, interpretationNote: '依機場所在地彙總，不是居民或航空公司所在地；計數來源為官方 CAA，落界點位採已保存 mixed-source reference snapshot（逐筆上游未保存），不聲稱點位為純官方。望安 0.017 公噸未分配，恆春連字號保留缺值。', breaks: [100, 1_000, 10_000, 100_000], colors: ['#f5f3ff', '#ddd6fe', '#a78bfa', '#7c3aed', '#4c1d95'] },
  statsTaoyuanAirportArrivals: { dataset_id: 'taoyuan_airport_passengers_county_32997', indicator_id: 'airport_arrivals_count', level: 'county', label: '桃園機場所在地入境旅客人次', unit: '人次', frequency: '2022 年歷史快照', freshness: 'STALE', releaseId: '2022-taoyuan-airport-airport_arrivals_count-d6d399a1-98c10b4dc1a8', dimensions: TAOYUAN_AIRPORT_DIMENSIONS, includeHealth: true, releaseSelector: taoyuanAirportReleaseSelector, interpretationNote: '僅桃園市 TPE/RCTP 設施所在地有觀測值，其他 21 縣市為缺資料；計數來源為官方 TPE，落界點位採已保存 mixed-source reference snapshot（逐筆上游未保存），不聲稱點位為純官方。不是 0、居民或不重複旅客。', breaks: [100_000, 500_000, 1_000_000, 2_000_000], colors: ['#ecfeff', '#a5f3fc', '#22d3ee', '#0891b2', '#164e63'] },
  statsTaoyuanAirportDepartures: { dataset_id: 'taoyuan_airport_passengers_county_32997', indicator_id: 'airport_departures_count', level: 'county', label: '桃園機場所在地出境旅客人次', unit: '人次', frequency: '2022 年歷史快照', freshness: 'STALE', releaseId: '2022-taoyuan-airport-airport_departures_count-d6d399a1-e978ed456827', dimensions: TAOYUAN_AIRPORT_DIMENSIONS, includeHealth: true, releaseSelector: taoyuanAirportReleaseSelector, interpretationNote: '僅桃園市 TPE/RCTP 設施所在地有觀測值，其他 21 縣市為缺資料；計數來源為官方 TPE，落界點位採已保存 mixed-source reference snapshot（逐筆上游未保存），不聲稱點位為純官方。不是 0、居民或不重複旅客。', breaks: [100_000, 500_000, 1_000_000, 2_000_000], colors: ['#eff6ff', '#bfdbfe', '#60a5fa', '#2563eb', '#1e3a8a'] },
  statsTaoyuanAirportTransit: { dataset_id: 'taoyuan_airport_passengers_county_32997', indicator_id: 'airport_transit_count', level: 'county', label: '桃園機場所在地過境旅客人次', unit: '人次', frequency: '2022 年歷史快照', freshness: 'STALE', releaseId: '2022-taoyuan-airport-airport_transit_count-d6d399a1-93ef361ca2f6', dimensions: TAOYUAN_AIRPORT_DIMENSIONS, includeHealth: true, releaseSelector: taoyuanAirportReleaseSelector, interpretationNote: '僅桃園市 TPE/RCTP 設施所在地有觀測值，其他 21 縣市為缺資料；計數來源為官方 TPE，落界點位採已保存 mixed-source reference snapshot（逐筆上游未保存），不聲稱點位為純官方。不是 0、居民或不重複旅客。', breaks: [1_000, 5_000, 10_000, 20_000], colors: ['#fff7ed', '#fed7aa', '#fb923c', '#ea580c', '#7c2d12'] },
  statsTaoyuanAirportPassengerMovements: { dataset_id: 'taoyuan_airport_passengers_county_32997', indicator_id: 'airport_passenger_movements', level: 'county', label: '桃園機場所在地旅客人次總計', unit: '人次', frequency: '2022 年歷史快照', freshness: 'STALE', releaseId: '2022-taoyuan-airport-airport_passenger_movements-d6d399a1-3fea2b07f916', dimensions: TAOYUAN_AIRPORT_DIMENSIONS, includeHealth: true, releaseSelector: taoyuanAirportReleaseSelector, interpretationNote: '僅桃園市 TPE/RCTP 設施所在地有觀測值，其他 21 縣市為缺資料；計數來源為官方 TPE，落界點位採已保存 mixed-source reference snapshot（逐筆上游未保存），不聲稱點位為純官方。這是總計，禁止再與入境、出境、過境指標相加。', breaks: [100_000, 1_000_000, 3_000_000, 5_000_000], colors: ['#f5f3ff', '#ddd6fe', '#a78bfa', '#7c3aed', '#4c1d95'] },
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

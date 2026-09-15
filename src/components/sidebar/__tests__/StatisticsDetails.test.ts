import { describe, expect, it } from 'vitest';
import { statisticsCoverageAreaLabel, statisticsCoverageStatusLabel, statisticsDimensionSummary, statisticsLegendRows, statisticsSelectedTupleAreaLabel, statisticsValueLabel, unparseableStatisticsReleaseCount } from '../StatisticsDetails';
import { STATISTICS_RECIPES } from '../../../data/regionalStatisticsRecipes';
import { getSocialRecipe } from '../../../data/socialStatisticsRecipes';

describe('statisticsDimensionSummary', () => {
  it('renders the selected period and fund as a compact disclosure label', () => {
    expect(statisticsDimensionSummary({
      roc_year: '114', month: '07', agency_fund: '交通部航港局-前瞻基礎建設計畫第5期特別預算',
    })).toBe('期間：民國 114 年・07 月；基金：交通部航港局-前瞻基礎建設計畫第5期特別預算');
  });

  it('does not render empty dimensions as empty fields', () => {
    expect(statisticsDimensionSummary({ roc_year: '114', month: '', agency_fund: '' })).toBe('期間：民國 114 年');
    expect(statisticsDimensionSummary({})).toBe('');
  });

  it('falls back to the selected release period and humanizes fixed dimensions', () => {
    expect(statisticsDimensionSummary(
      { sector: 'residential' },
      { period_start: '2025-01-01', period_end: '2025-12-31' },
    )).toBe('期間：2025 年；用電別：住宅');
    expect(statisticsDimensionSummary(
      { roc_year: '112', quarter: 'Q4' },
      { period_start: '2023-10-01', period_end: '2023-12-31' },
    )).toBe('期間：民國 112 年・Q4');
  });

  it('keeps missing reconciliation amounts distinct from a real zero', () => {
    expect(statisticsValueLabel(null, 'TWD')).toBe('未提供');
    expect(statisticsValueLabel(0, 'TWD')).toBe('0 TWD');
  });

  it('humanizes the Taipei-only article selection summary', () => {
    expect(statisticsDimensionSummary({ roc_year: '114', law_article: '第12條', geographic_coverage: 'taipei_only' })).toBe('期間：民國 114 年；法條：第12條；地理涵蓋：僅臺北市');
  });

  it('humanizes the Taichung-only control-zone selection summary', () => {
    expect(statisticsDimensionSummary({ roc_year: '113', quarter: 'Q3', control_zone_class: '第一類管制區', geographic_coverage: 'taichung_only' })).toBe('期間：民國 113 年・Q3；管制區類別：第一類管制區；地理涵蓋：僅臺中市');
  });

  it('uses the dataset context for source-field labels and humanizes national county coverage', () => {
    expect(statisticsDimensionSummary({ roc_year: '114', source_field: 'COLUMN6', geographic_coverage: 'national_county' }, undefined, 'segis_bus_operation_county_315fh_1d3')).toBe('期間：民國 114 年；來源欄位：期末電動車輛；地理涵蓋：全國縣市');
    expect(statisticsDimensionSummary({ roc_year: '110', source_field: 'COLUMN6', geographic_coverage: 'taipei_township_only' }, undefined, 'segis_taipei_bicycle_usage_township_110')).toBe('期間：民國 110 年；來源欄位：河濱自行車數；地理涵蓋：僅臺北市 12 區');
  });

  it('shows the selected TMRT station-location semantics', () => {
    expect(statisticsDimensionSummary({ roc_year: '114', month: '12', system_id: 'tmrt', geographic_semantics: 'station_location' })).toBe('期間：民國 114 年・12 月；系統：臺中捷運；地理語意：車站所在地');
  });

  it('humanizes new source-field and facility-location disclosures', () => {
    expect(statisticsDimensionSummary({ roc_year: '110', source_field: 'COLUMN7', geographic_coverage: 'taipei_township_only' })).toBe('期間：民國 110 年；來源欄位：河濱年租借次數；地理涵蓋：僅臺北市 12 區');
    expect(statisticsDimensionSummary({ roc_year: '115', month: '07', geographic_semantics: 'facility_location_activity', health: 'CURRENT', coverage: 'PARTIAL' })).toBe('期間：民國 115 年・07 月；地理語意：設施所在地活動；資料新鮮度：CURRENT；覆蓋狀態：PARTIAL');
  });
  it('uses each recipe level for health coverage, including township statistics', () => {
    expect(statisticsCoverageAreaLabel(STATISTICS_RECIPES.statsTaipeiUrbanRentalStations)).toBe('鄉鎮市區');
    expect(statisticsCoverageAreaLabel(STATISTICS_RECIPES.statsBusElectricVehicleCount)).toBe('縣市');
  });

  it('labels livestock reconciliation as whole-dataset township-by-animal observations, distinct from its selected tuple', () => {
    expect(statisticsCoverageStatusLabel(true)).toBe('整份資料覆蓋狀態');
    expect(statisticsCoverageAreaLabel(STATISTICS_RECIPES.statsLivestockHeadCountTownship)).toBe('鄉鎮×畜種資料筆');
    expect(statisticsSelectedTupleAreaLabel(STATISTICS_RECIPES.statsLivestockHeadCountTownship)).toBe('鄉鎮統計值');
    expect(statisticsCoverageStatusLabel(false)).toBe('覆蓋狀態');
    expect(statisticsCoverageAreaLabel(STATISTICS_RECIPES.statsBusElectricVehicleCount)).toBe('縣市');
  });

  it('renders exactly breaks plus one numeric legend intervals, matching the map step expression', () => {
    const rows = statisticsLegendRows(STATISTICS_RECIPES.statsEducationCountyInstitutionCount);
    expect(rows).toEqual([
      { color: '#eff6ff', label: '低於 10' },
      { color: '#bfdbfe', label: '10 至未滿 50' },
      { color: '#60a5fa', label: '50 至未滿 150' },
      { color: '#2563eb', label: '150 至未滿 500' },
      { color: '#1e3a8a', label: '500 以上' },
    ]);
    expect(rows).toHaveLength(STATISTICS_RECIPES.statsEducationCountyInstitutionCount.breaks.length + 1);
  });

  it('removes duplicate-threshold legend intervals with the same final reachable colours as the map', () => {
    expect(statisticsLegendRows(STATISTICS_RECIPES.statsHealthHospiceBedTotal)).toEqual([
      { color: '#eff6ff', label: '低於 0' },
      { color: '#60a5fa', label: '0 至未滿 2' },
      { color: '#2563eb', label: '2 至未滿 12' },
      { color: '#1e3a8a', label: '12 以上' },
    ]);
    expect(statisticsLegendRows(STATISTICS_RECIPES.statsHealthNursingStaffListedAgeSexSum)).toEqual([
      { color: '#eff6ff', label: '低於 378' },
      { color: '#1e3a8a', label: '378 以上' },
    ]);
  });

  it('does not alert a county housing recipe about the same indicator’s township release, but retains same-level mismatches', () => {
    const key = 'statsHousingTotalCounty';
    const recipe = getSocialRecipe(key)!;
    const option = recipe.release_options[0]!;
    const release = {
      release_id: option.release_id,
      dataset_id: recipe.dataset_id,
      indicator_id: recipe.indicator_id,
      boundary_version: recipe.boundary_version,
      period_start: option.period_start,
      period_end: option.period_end,
      levels: ['county'] as Array<'county'>,
    };
    const townshipSibling = { ...release, release_id: 'township-sibling', levels: ['township'] as Array<'township'> };
    const unknownCounty = { ...release, release_id: 'unknown-county' };
    expect(unparseableStatisticsReleaseCount(key, [release, townshipSibling])).toBe(0);
    expect(unparseableStatisticsReleaseCount(key, [release, townshipSibling, unknownCounty])).toBe(1);
  });

  it('formats social legend labels from recipe format while marking rounded boundaries approximate', () => {
    const social = getSocialRecipe('statsHousingUnusedPctCounty')!;
    expect(statisticsLegendRows(STATISTICS_RECIPES.statsHousingUnusedPctCounty, social.format).map(row => row.label)).toEqual([
      '低於 ≈12.4', '≈12.4 至未滿 ≈13.26', '≈13.26 至未滿 ≈13.93', '≈13.93 至未滿 ≈16.64', '≈16.64 以上',
    ]);
  });

});

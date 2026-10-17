import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { getStatisticsPeriodNotice, prepareMedicalStatisticsVariant, selectMedicalStatisticsVariant } from '../medicalStatisticsSelection';
import { regionalStatisticsStore } from '../regionalStatisticsStore';
import { layerVisibilityStore, buildDefaultVisibility } from '../layerVisibilityStore';
import { statisticsDisplayModeStore } from '../statisticsDisplayModeStore';
import { layerParamsStore } from '../layerParamsStore';
import { getSocialRecipeDetails } from '../../data/socialStatisticsRecipes';
import { getAgriRecipeDetails } from '../../data/agriStatisticsRecipes';
import { ensureStatisticsRecipeDetails } from '../../data/statisticsRecipeDetails';
import { getComparisonRecipe } from '../../data/comparisonStatisticsRecipes';
import { getDemographicsRecipe } from '../../data/demographicsStatisticsRecipes';
const beds = ['statsHealthHospitalBedTotal', 'statsHealthAcuteBedTotal', 'statsHealthIcuBedTotal', 'statsHealthHospiceBedTotal'] as const;
beforeAll(() => ensureStatisticsRecipeDetails());
beforeEach(() => {
  statisticsDisplayModeStore.reset();
  vi.restoreAllMocks();
  layerVisibilityStore.setAll(buildDefaultVisibility());
  regionalStatisticsStore.setSelection(beds[0], null);
});
describe('medical family switching', () => {
  it('maps the 2024 release to the matching target ID, retaining opacity and other overlap layers', () => {
    const recipe = getSocialRecipeDetails(beds[0])!;
    const old = recipe.release_options.find(option => option.dimensions.roc_year === '113')!;
    regionalStatisticsStore.setSelection(beds[0], { layerKey: beds[0], datasetId: recipe.dataset_id, indicatorId: recipe.indicator_id, level: recipe.level, releaseId: old.release_id, dimensions: old.dimensions });
    statisticsDisplayModeStore.setMode('overlap', layerVisibilityStore.getAll());
    layerVisibilityStore.setAll({ ...buildDefaultVisibility(), [beds[0]]: true, [beds[2]]: true, statsHealthHospitalCount: true });
    layerParamsStore.setParam(beds[0], `${beds[0]}Opacity`, 0.3);
    expect(selectMedicalStatisticsVariant(beds[0], beds[1], beds)).toBe(true);
    const state = regionalStatisticsStore.getSnapshot(beds[1]);
    expect(state.selection?.dimensions?.roc_year).toBe('113');
    expect(state.selection?.releaseId).not.toBe(old.release_id);
    expect(state.selection?.allowReleaseFallback).toBe(false);
    expect(layerParamsStore.getParam(beds[1], `${beds[1]}Opacity`)).toBe(0.3);
    expect(beds.filter(key => layerVisibilityStore.getAll()[key])).toEqual([beds[1]]);
    expect(layerVisibilityStore.getAll().statsHealthHospitalCount).toBe(true);
    expect(layerVisibilityStore.getAll().jpAccommodationCanonical).toBe(false);
  });
  it('respects single mode and rejects keys outside the family without mutation', () => {
    layerVisibilityStore.setAll({ ...buildDefaultVisibility(), statsHealthHospitalCount: true });
    expect(selectMedicalStatisticsVariant(beds[0], beds[3], beds)).toBe(true);
    expect(layerVisibilityStore.getAll().statsHealthHospitalCount).toBe(false);
    const before = layerVisibilityStore.getAll();
    expect(selectMedicalStatisticsVariant(beds[0], 'statsHealthHospitalCount', beds)).toBe(false);
    expect(layerVisibilityStore.getAll()).toBe(before);
  });
  it('allows a listed count-to-ratio switch when source_field differs but period matches', () => {
    const from = 'statsHealthAcuteBedTotal' as const;
    const to = 'statsComparisonAcuteBedTotalPer10000PopulationTownship' as const;
    const source = getSocialRecipeDetails(from)!;
    const selected = source.release_options.find(option => option.dimensions.roc_year === '113')!;
    regionalStatisticsStore.setSelection(from, { layerKey: from, datasetId: source.dataset_id, indicatorId: source.indicator_id, level: source.level, releaseId: selected.release_id, dimensions: selected.dimensions });
    expect(selectMedicalStatisticsVariant(from, to, [from, to])).toBe(true);
    expect(regionalStatisticsStore.getSnapshot(to).selection?.releaseId).toBe(getComparisonRecipe(to)!.release_options.find(option => option.dimensions.roc_year === '113')!.release_id);
  });
  it('retains animal and quarter when switching livestock variants', () => {
    const from = 'statsLivestockFarmCountTownship' as const;
    const to = 'statsLivestockHeadCountTownship' as const;
    const source = getAgriRecipeDetails(from)!;
    const selected = source.release_options[0]!;
    regionalStatisticsStore.setSelection(from, { layerKey: from, datasetId: source.dataset_id, indicatorId: source.indicator_id, level: source.level, releaseId: selected.release_id, dimensions: selected.dimensions });
    expect(selectMedicalStatisticsVariant(from, to, [from, to])).toBe(true);
    expect(regionalStatisticsStore.getSnapshot(to).selection?.dimensions).toMatchObject(selected.dimensions);
  });
  it('rejects an identity mismatch instead of selecting another livestock tuple', () => {
    const from = 'statsLivestockFarmCountTownship' as const;
    const to = 'statsLivestockHeadCountTownship' as const;
    const source = getAgriRecipeDetails(from)!;
    const selected = source.release_options[0]!;
    regionalStatisticsStore.setSelection(from, { layerKey: from, datasetId: source.dataset_id, indicatorId: source.indicator_id, level: source.level, releaseId: selected.release_id, dimensions: { ...selected.dimensions, animal: '不存在的畜種', quarter: '2099-Q4' } });
    expect(selectMedicalStatisticsVariant(from, to, [from, to])).toBe(false);
  });
  it('preloads an ordinary target and resolves its exact release before switching back from a ratio', async () => {
    const from = 'statsComparisonBusOperatingRouteLengthKmPer10000Residents' as const;
    const to = 'statsBusOperatingRouteLengthKm' as const;
    const source = getComparisonRecipe(from)!;
    const selected = source.release_options[0]!;
    regionalStatisticsStore.setSelection(from, { layerKey: from, datasetId: source.dataset_id, indicatorId: source.indicator_id, level: source.level, releaseId: selected.release_id, dimensions: selected.dimensions });
    Object.assign(regionalStatisticsStore.getSnapshot(to), { selection: null, releases: [], release: null, error: null });
    vi.spyOn(regionalStatisticsStore, 'load').mockImplementation(async key => {
      if (key === to) Object.assign(regionalStatisticsStore.getSnapshot(to), { releases: [{ release_id: '2025-114-column1-fcb90c6e6b05', dataset_id: 'segis_bus_operation_county_315fh_1d3', indicator_id: 'bus_operating_route_length_km', boundary_version: 'COUNTY_MOI_1140318', period_start: '2025-01-01', period_end: '2025-12-31', levels: ['county'] }] });
    });
    expect(await prepareMedicalStatisticsVariant(from, to, [from, to])).toBe(true);
    expect(regionalStatisticsStore.getSnapshot(to).selection?.releaseId).toBe('2025-114-column1-fcb90c6e6b05');
  });
  it('rejects an unrecognised ordinary release instead of applying fallback dimensions', async () => {
    const from = 'statsComparisonBusOperatingRouteLengthKmPer10000Residents' as const;
    const to = 'statsBusOperatingRouteLengthKm' as const;
    Object.assign(regionalStatisticsStore.getSnapshot(to), { selection: null, releases: [], release: null, error: null });
    vi.spyOn(regionalStatisticsStore, 'load').mockImplementation(async key => {
      if (key === to) Object.assign(regionalStatisticsStore.getSnapshot(to), { releases: [{ release_id: '2025-unknown', dataset_id: 'segis_bus_operation_county_315fh_1d3', indicator_id: 'bus_operating_route_length_km', boundary_version: 'COUNTY_MOI_1140318', period_start: '2025-01-01', period_end: '2025-12-31', levels: ['county'] }] });
    });
    expect(await prepareMedicalStatisticsVariant(from, to, [from, to])).toBe(false);
  });
  it('does not change visibility when a target preload is cancelled', async () => {
    const from = 'statsComparisonBusOperatingRouteLengthKmPer10000Residents' as const;
    const to = 'statsBusOperatingRouteLengthKm' as const;
    Object.assign(regionalStatisticsStore.getSnapshot(to), { selection: null, releases: [], release: null, error: null });
    layerVisibilityStore.setAll({ ...buildDefaultVisibility(), [from]: true });
    vi.spyOn(regionalStatisticsStore, 'load').mockImplementation(async key => {
      if (key === to) Object.assign(regionalStatisticsStore.getSnapshot(to), { releases: [{ release_id: '2025-114-column1-fcb90c6e6b05', dataset_id: 'segis_bus_operation_county_315fh_1d3', indicator_id: 'bus_operating_route_length_km', boundary_version: 'COUNTY_MOI_1140318', period_start: '2025-01-01', period_end: '2025-12-31', levels: ['county'] }] });
    });
    expect(await prepareMedicalStatisticsVariant(from, to, [from, to], () => false)).toBe(false);
    expect(layerVisibilityStore.getAll()[from]).toBe(true);
    expect(layerVisibilityStore.getAll()[to]).toBe(false);
  });
});
describe('demographics level switching (村里只有 11508 一期)', () => {
  const county = 'statsDemographicsCountyShareAge65Plus' as const;
  const township = 'statsDemographicsTownshipShareAge65Plus' as const;
  const village = 'statsDemographicsVillageShareAge65Plus' as const;
  const members = [county, township, village] as const;
  const select = (key: typeof members[number], suffix: string) => {
    const recipe = getDemographicsRecipe(key)!;
    const option = recipe.release_options.find(item => item.release_id.endsWith(`-${suffix}`))!;
    regionalStatisticsStore.setSelection(key, { layerKey: key, datasetId: recipe.dataset_id, indicatorId: recipe.indicator_id, level: recipe.level, releaseId: option.release_id, dimensions: option.dimensions });
  };
  it('falls back to the only village period (11508) when the county period has no village release', () => {
    select(county, '11412');
    layerVisibilityStore.setAll({ ...buildDefaultVisibility(), [county]: true });
    expect(selectMedicalStatisticsVariant(county, village, members)).toBe(true);
    expect(regionalStatisticsStore.getSnapshot(village).selection).toMatchObject({ releaseId: 'pas-share-age-65-plus-village-11508', dimensions: { month: '08', roc_year: '115' }, allowReleaseFallback: false });
    expect(members.filter(key => layerVisibilityStore.getAll()[key])).toEqual([village]);
    // 期別被改動要明示（guidelines §3：不可靜默跳年份）
    expect(getStatisticsPeriodNotice(village)).toBe('村里層僅有 115 年 8 月一期，已切換期別。');
  });
  it('shows no period notice when the county period already matches the village period, and clears it on switching away', () => {
    select(county, '11412');
    layerVisibilityStore.setAll({ ...buildDefaultVisibility(), [county]: true });
    expect(selectMedicalStatisticsVariant(county, village, members)).toBe(true);
    expect(getStatisticsPeriodNotice(village)).toBeTruthy();
    expect(selectMedicalStatisticsVariant(village, county, members)).toBe(true);
    expect(getStatisticsPeriodNotice(village)).toBeUndefined();
    expect(getStatisticsPeriodNotice(county)).toBeUndefined();
    select(county, '11508');
    expect(selectMedicalStatisticsVariant(county, village, members)).toBe(true);
    expect(getStatisticsPeriodNotice(village)).toBeUndefined();
  });
  it('keeps 11508 when switching back from village to county, and still refuses cross-period county→township', () => {
    select(village, '11508');
    layerVisibilityStore.setAll({ ...buildDefaultVisibility(), [village]: true });
    expect(selectMedicalStatisticsVariant(village, county, members)).toBe(true);
    expect(regionalStatisticsStore.getSnapshot(county).selection?.releaseId).toBe('pas-share-age-65-plus-county-11508');
    // 縣市↔鄉鎮仍是同期別切換：11412 對到鄉鎮 11412，不會被村里 fallback 影響。
    select(county, '11412');
    expect(selectMedicalStatisticsVariant(county, township, members)).toBe(true);
    expect(regionalStatisticsStore.getSnapshot(township).selection?.releaseId).toBe('pas-share-age-65-plus-township-11412');
  });
});

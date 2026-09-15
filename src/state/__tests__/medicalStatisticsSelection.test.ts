import { beforeEach, describe, expect, it } from 'vitest';
import { selectMedicalStatisticsVariant } from '../medicalStatisticsSelection';
import { regionalStatisticsStore } from '../regionalStatisticsStore';
import { layerVisibilityStore, buildDefaultVisibility } from '../layerVisibilityStore';
import { statisticsDisplayModeStore } from '../statisticsDisplayModeStore';
import { layerParamsStore } from '../layerParamsStore';
import { getSocialRecipe } from '../../data/socialStatisticsRecipes';
const beds = ['statsHealthHospitalBedTotal', 'statsHealthAcuteBedTotal', 'statsHealthIcuBedTotal', 'statsHealthHospiceBedTotal'] as const;
beforeEach(() => {
  statisticsDisplayModeStore.reset();
  layerVisibilityStore.setAll(buildDefaultVisibility());
  regionalStatisticsStore.setSelection(beds[0], null);
});
describe('medical family switching', () => {
  it('maps the 2024 release to the matching target ID, retaining opacity and other overlap layers', () => {
    const recipe = getSocialRecipe(beds[0])!;
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
    expect(layerVisibilityStore.getAll().jpAccommodationCanonical).toBe(true);
  });
  it('respects single mode and rejects keys outside the family without mutation', () => {
    layerVisibilityStore.setAll({ ...buildDefaultVisibility(), statsHealthHospitalCount: true });
    expect(selectMedicalStatisticsVariant(beds[0], beds[3], beds)).toBe(true);
    expect(layerVisibilityStore.getAll().statsHealthHospitalCount).toBe(false);
    const before = layerVisibilityStore.getAll();
    expect(selectMedicalStatisticsVariant(beds[0], 'statsHealthHospitalCount', beds)).toBe(false);
    expect(layerVisibilityStore.getAll()).toBe(before);
  });
});

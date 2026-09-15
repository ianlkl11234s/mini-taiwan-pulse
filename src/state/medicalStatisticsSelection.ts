import type { LayerVisibility } from '../types';
import { getSocialRecipe } from '../data/socialStatisticsRecipes';
import { regionalStatisticsStore } from './regionalStatisticsStore';
import { layerParamsStore } from './layerParamsStore';
import { layerVisibilityStore } from './layerVisibilityStore';
import { statisticsDisplayModeStore } from './statisticsDisplayModeStore';
import { isStatisticsChoropleth } from '../data/statisticsLayerRegistry';

/** Switch the presentation within one family, retaining an exact same-period tuple. */
export function selectMedicalStatisticsVariant(from: keyof LayerVisibility, to: keyof LayerVisibility, members: readonly (keyof LayerVisibility)[]) {
  if (!members.includes(from) || !members.includes(to) || !isStatisticsChoropleth(to)) return false;
  const source = getSocialRecipe(from);
  const target = getSocialRecipe(to);
  if (!source || !target) return false;
  const snapshot = regionalStatisticsStore.getSnapshot(from);
  const sourceOption = source.release_options.find(option => option.release_id === snapshot.selection?.releaseId)
    ?? source.release_options.find(option => option.release_id === snapshot.release?.release_id)
    ?? source.release_options[0];
  const option = target.release_options.find(option => option.period_start === sourceOption?.period_start
    && option.period_end === sourceOption.period_end
    && Object.entries(sourceOption.dimensions).every(([key, value]) => option.dimensions[key] === value));
  // Do not silently change year to make the choice work.
  if (!option) return false;
  regionalStatisticsStore.setSelection(to, {
    layerKey: to, datasetId: target.dataset_id, indicatorId: target.indicator_id,
    level: target.level, label: target.label, releaseId: option.release_id,
    dimensions: option.dimensions, allowReleaseFallback: false, includeHealth: true,
  });
  const opacity = layerParamsStore.getParam(from, `${from}Opacity`);
  if (typeof opacity === 'number') layerParamsStore.setParam(to, `${to}Opacity`, opacity);
  let next = layerVisibilityStore.getAll();
  for (const key of members) {
    if (isStatisticsChoropleth(key)) next = statisticsDisplayModeStore.setVisible(key, false, next);
  }
  layerVisibilityStore.setAll(statisticsDisplayModeStore.enable(to, next));
  return true;
}

import { describe, expect, it } from 'vitest';
import { EDUCATION_PRESENTATION_VIEWS } from '../statisticsPresentationViews';
import { getSocialRecipe } from '../socialStatisticsRecipes';
import { STATISTICS_KEYS, STATISTICS_RENDER_KEYS, statisticsBaseKey, statisticsRenderRecipe } from '../regionalStatisticsRecipes';
import { statisticsReleaseOptions, unparseableStatisticsReleaseCount } from '../../components/sidebar/StatisticsDetails';
import type { StatisticsRelease } from '../regionalStatisticsLoader';

describe('education presentation views', () => {
  it('keeps 12 independent fixed-stage views outside canonical source recipes', () => {
    expect(EDUCATION_PRESENTATION_VIEWS).toHaveLength(12);
    expect(new Set(EDUCATION_PRESENTATION_VIEWS.map(view => view.key)).size).toBe(12);
    expect(EDUCATION_PRESENTATION_VIEWS.every(view => !STATISTICS_KEYS.includes(view.key as never))).toBe(true);
    expect(EDUCATION_PRESENTATION_VIEWS.every(view => STATISTICS_RENDER_KEYS.includes(view.key))).toBe(true);
  });

  it('pins a view to its education stage and canonical metric', () => {
    for (const view of EDUCATION_PRESENTATION_VIEWS) {
      const recipe = statisticsRenderRecipe(view.key);
      expect((recipe.dimensions as Record<string, string> | undefined)?.education_stage).toBe(view.stage);
      expect(statisticsBaseKey(view.key)).toBe(view.metrics[0]!.layerKey);
    }
  });

  it('keeps preschool student metrics without class-only comparisons', () => {
    const preschool = EDUCATION_PRESENTATION_VIEWS.find(view => view.key === 'statsEducationPreschoolStudent')!;
    expect(preschool.metrics.map(metric => metric.layerKey)).toEqual([
      'statsEducationCountyStudentCount',
      'statsComparisonEducationStudentCountPer10000Residents',
      'statsComparisonEducationStudentCountPerKm2',
      'statsEducationCountyStudentYearChange',
      'statsEducationCountyStudentYearChangePct',
    ]);
  });

  it('filters a presentation selector to the fixed education stage', () => {
    const key = 'statsEducationElementarySchool' as const;
    const source = getSocialRecipe('statsEducationCountyInstitutionCount')!;
    const releases: StatisticsRelease[] = source.release_options.map(option => ({
      release_id: option.release_id,
      period_start: option.period_start,
      period_end: option.period_end,
      levels: ['county'],
      dataset_id: source.dataset_id,
      indicator_id: source.indicator_id,
      boundary_version: source.boundary_version,
    }));
    const options = statisticsReleaseOptions(key, releases, 'institution_count');
    expect(options.length).toBeGreaterThan(0);
    expect(options.every(option => option.dimensions.education_stage === 'elementary')).toBe(true);
  });

  it('does not warn about the other three stages for a fixed preschool view', () => {
    const source = getSocialRecipe('statsEducationCountyInstitutionCount')!;
    const releases: StatisticsRelease[] = source.release_options.map(option => ({
      release_id: option.release_id,
      period_start: option.period_start,
      period_end: option.period_end,
      levels: ['county'],
      dataset_id: source.dataset_id,
      indicator_id: source.indicator_id,
      boundary_version: source.boundary_version,
    }));
    expect(unparseableStatisticsReleaseCount('statsEducationPreschoolSchool', releases, 'institution_count')).toBe(0);
  });
});

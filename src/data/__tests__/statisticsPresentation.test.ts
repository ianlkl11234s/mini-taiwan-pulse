/**
 * 統計「呈現方式」推導規則（設計提案 Q-C，2026-11-11 使用者拍板照表）：
 * 比率／密度／中位數／有正負號的只有面量圖；比例圓只給不會有負值的總量；據點數不給點密度。
 */
import { describe, expect, it } from 'vitest';
import { STATISTICS_RENDER_KEYS, statisticsRenderRecipe } from '../regionalStatisticsRecipes';
import {
  derivePresentationModes, derivedPresentationModes, statisticsPresentationDefault, statisticsPresentationOptions, statisticsPresentationSpec,
} from '../statisticsPresentation';
import { PRESENTATION_OVERRIDES } from '../presentationOverrides';
import { paramControlCategory } from '../layerParamsSpec';

const label = (key: string) => statisticsRenderRecipe(key as never).label;
const unit = (key: string) => statisticsRenderRecipe(key as never).unit;

/** 第一批（提案 Q-C 表，鄉鎮層）：一定要能切比例圓 */
const FIRST_BATCH = [
  'statsDemographicsTownshipPopulationTotal', // 戶籍人口數
  'statsDemographicsTownshipPopAge65Plus', // 65 歲以上人口數
  'statsDemographicsTownshipPopAge0To14', // 0-14 歲人口數
  'statsDemographicsTownshipIndigenousPopulation', // 原住民人口數
  'statsDemographicsTownshipForeignOriginPopulation', // 已設戶籍外來人口數
  'statsDemographicsTownshipBirths', // 出生數
  'statsCrimeResidentialBurglaryCasesTownship', // 住宅竊盜發生件數
  'statsTelecomFraudCasesTownship', // 電信詐欺發生件數
  'statsCropPlantedAreaTownship', // 作物種植面積
] as const;

describe('statistics presentation derivation', () => {
  it('first batch township totals offer circles (choropleth stays the default); person／case counts also offer dots', () => {
    for (const key of FIRST_BATCH) {
      expect(STATISTICS_RENDER_KEYS, key).toContain(key);
      // 作物種植面積（公頃）不是一個一個數得出來的 → 沒有點密度
      const expected = key === 'statsCropPlantedAreaTownship' ? ['choropleth', 'circle'] : ['choropleth', 'circle', 'dots'];
      expect(statisticsPresentationOptions(key), `${key} ${label(key)}`).toEqual(expected);
      expect(statisticsPresentationDefault(key)).toBe('choropleth');
    }
  });

  it('ratio, rate, density, median, average and signed layers never get circles', () => {
    const ratioUnit = /[%‰／/]|每|倍|歲|百分點|km²|類別碼/u;
    const ratioLabel = /率|占比|比例|密度|中位|平均|指數|每十萬|每萬|增加|淨|變動/u;
    const offenders = STATISTICS_RENDER_KEYS.filter((key) => (ratioUnit.test(unit(key)) || ratioLabel.test(label(key)))
      && derivedPresentationModes(key).includes('circle'));
    expect(offenders).toEqual([]);
    // 正向抽樣：不是空集合也成立
    for (const key of ['statsDemographicsTownshipShareAge65Plus', 'statsDemographicsTownshipCrudeBirthRate', 'statsDemographicsTownshipPopulationDensity',
      'statsDemographicsTownshipMedianAge', 'statsDemographicsTownshipNaturalIncrease', 'statsDemographicsTownshipNetMigration',
      'statsCrimeResidentialBurglaryPer100kTownship', 'statsDemographicsTownshipIndigenousShare']) {
      expect(STATISTICS_RENDER_KEYS, key).toContain(key);
      expect(statisticsPresentationOptions(key), key).toEqual(['choropleth']);
      expect(statisticsPresentationSpec(key), key).toBeNull();
    }
  });

  it('service-point counts never get dot density; dots only on township and village counts', () => {
    const dots = STATISTICS_RENDER_KEYS.filter((key) => derivedPresentationModes(key).includes('dots'));
    expect(dots.length).toBeGreaterThan(0);
    for (const key of dots) {
      const recipe = statisticsRenderRecipe(key);
      expect(recipe.label, key).not.toMatch(/據點/u);
      expect(['township', 'village'], key).toContain(recipe.level);
      expect(['人', '件', '戶'], key).toContain(recipe.unit);
    }
    const servicePoints = STATISTICS_RENDER_KEYS.filter((key) => /據點/u.test(label(key)));
    expect(servicePoints.length).toBeGreaterThan(0);
    for (const key of servicePoints) expect(derivedPresentationModes(key), key).not.toContain('dots');
    // 點密度已露出：推導可用的層（沒被覆寫隱藏）都可選，其他層都不行
    for (const key of STATISTICS_RENDER_KEYS) expect(statisticsPresentationOptions(key).includes('dots'), key).toBe(dots.includes(key));
  });

  it('every layer defaults to a listed option, choropleth first, at most 3 options (segmented control)', () => {
    for (const key of STATISTICS_RENDER_KEYS) {
      const options = statisticsPresentationOptions(key);
      expect(options[0], key).toBe('choropleth');
      expect(options).toContain(statisticsPresentationDefault(key));
      const spec = statisticsPresentationSpec(key);
      if (!spec) continue;
      expect(spec.options.length, key).toBeLessThanOrEqual(3);
      expect(spec.out).toBeNull();
      // 排在資料篩選之後、透明度之前（spec §5.11）
      expect(paramControlCategory(spec)).toBe('color');
    }
  });

  it('overrides: hide removes the option; unknown keys are not allowed', () => {
    for (const [key, override] of Object.entries(PRESENTATION_OVERRIDES)) {
      expect(STATISTICS_RENDER_KEYS, key).toContain(key);
      for (const mode of override.hide ?? []) expect(statisticsPresentationOptions(key), key).not.toContain(mode);
    }
    expect(statisticsPresentationOptions('statsTaisugarAnnouncedListings')).toEqual(['choropleth']);
  });

  it('derivePresentationModes unit rules', () => {
    const base = { unit: '人', label: '戶籍人口數', level: 'township', breaks: [1000, 10000] };
    expect(derivePresentationModes(base)).toEqual(['choropleth', 'circle', 'dots']);
    expect(derivePresentationModes({ ...base, level: 'county' })).toEqual(['choropleth', 'circle']);
    expect(derivePresentationModes({ ...base, aggregation: 'ratio' })).toEqual(['choropleth']);
    expect(derivePresentationModes({ ...base, unit: '人/km²' })).toEqual(['choropleth']);
    expect(derivePresentationModes({ ...base, label: '自然增加數' })).toEqual(['choropleth']);
    expect(derivePresentationModes({ ...base, breaks: [-10, 0, 10] })).toEqual(['choropleth']);
    expect(derivePresentationModes({ ...base, categorical: true })).toEqual(['choropleth']);
    expect(derivePresentationModes({ ...base, unit: '處', label: '清潔針具衛教站據點數' })).toEqual(['choropleth', 'circle']);
    expect(derivePresentationModes({ ...base, unit: '公頃', label: '作物種植面積' })).toEqual(['choropleth', 'circle']);
    expect(derivePresentationModes({ ...base, level: 'gb_lad' })).toEqual(['choropleth']);
  });
});

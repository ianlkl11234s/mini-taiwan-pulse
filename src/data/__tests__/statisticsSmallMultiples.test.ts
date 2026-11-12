import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  SERIES_DIMENSION_KEYS, TIME_DIMENSION_KEYS, compareArrangement, defaultComparison, periodNote, periodPhrase, pickYearlyPeriods,
  smallMultipleFill, smallMultiplesPlan, stepColor, toggleComparison,
  type SmallMultipleCandidate,
} from '../statisticsSmallMultiples';
import { statisticsRenderRecipe } from '../regionalStatisticsRecipes';
import { statisticsRecipe } from '../statisticsSelection';
import type { StatisticsRelease } from '../regionalStatisticsLoader';

const c = (releaseId: string, start: string, end: string, dimensions: Record<string, unknown> = {}): SmallMultipleCandidate => ({
  releaseId, dimensions, release: { release_id: releaseId, period_start: start, period_end: end, boundary_version: 'B' },
});

describe('pickYearlyPeriods（年份挑選）', () => {
  it('每年一期、由舊到新，目前那年用目前期別', () => {
    const list = [c('2023', '2023-01-01', '2023-12-31'), c('2024', '2024-01-01', '2024-12-31'), c('2025', '2025-01-01', '2025-12-31')];
    const picked = pickYearlyPeriods(list, list[1]!);
    expect(picked.map(p => p.candidate.releaseId)).toEqual(['2023', '2024', '2025']);
    expect(picked.map(p => p.current)).toEqual([false, true, false]);
    expect(picked.every(p => p.sameSpan)).toBe(true);
  });

  it('月資料：每年取與目前期別同月份（不是各年最後一期），沒有同月才退回最後一期並標期別不同', () => {
    const list = [
      c('2024-09', '2024-09-30', '2024-09-30'), c('2024-12', '2024-12-31', '2024-12-31'),
      c('2025-09', '2025-09-30', '2025-09-30'), c('2025-12', '2025-12-31', '2025-12-31'),
      c('2023-12', '2023-12-31', '2023-12-31'),
      c('2026-09', '2026-09-30', '2026-09-30'),
    ];
    const picked = pickYearlyPeriods(list, list[5]!);
    expect(picked.map(p => p.candidate.releaseId)).toEqual(['2023-12', '2024-09', '2025-09', '2026-09']);
    expect(picked.map(p => p.sameSpan)).toEqual([false, true, true, true]);
  });

  it('年初累計：同跨度優先，不把今年 1–8 月和往年全年並排', () => {
    const list = [
      c('2024-full', '2024-01-01', '2024-12-31'), c('2024-ytd', '2024-01-01', '2024-08-31'),
      c('2025-ytd', '2025-01-01', '2025-08-31'),
    ];
    const picked = pickYearlyPeriods(list, list[2]!);
    expect(picked.map(p => p.candidate.releaseId)).toEqual(['2024-ytd', '2025-ytd']);
  });

  it('非時間維度（性別、作物）必須與目前相同；時間維度（roc_year、source_schema）忽略', () => {
    const list = [
      c('a', '2023-01-01', '2023-12-31', { sex: 'female', roc_year: '112', source_schema: 'legacy' }),
      c('b', '2023-01-01', '2023-12-31', { sex: 'male', roc_year: '112' }),
      c('cur', '2024-01-01', '2024-12-31', { sex: 'female', roc_year: '113', source_schema: 'current' }),
    ];
    expect(pickYearlyPeriods(list, list[2]!).map(p => p.candidate.releaseId)).toEqual(['a', 'cur']);
  });

});

describe('勾選（最多 4 期）', () => {
  it('預設：最早、最新加中間平均兩年；不足 4 年全選', () => {
    expect(defaultComparison(9)).toEqual([0, 3, 5, 8]);
    expect(defaultComparison(21)).toEqual([0, 7, 13, 20]);
    expect(defaultComparison(45)).toEqual([0, 15, 29, 44]);
    expect(defaultComparison(4)).toEqual([0, 1, 2, 3]);
    expect(defaultComparison(2)).toEqual([0, 1]);
  });

  it('滿 4 期時再勾會被拒絕（不加入）；取消後可再勾；結果依年份排序', () => {
    const full = toggleComparison([0, 3, 5, 8], 2);
    expect(full).toEqual({ selected: [0, 3, 5, 8], rejected: true });
    const removed = toggleComparison([0, 3, 5, 8], 5);
    expect(removed).toEqual({ selected: [0, 3, 8], rejected: false });
    expect(toggleComparison(removed.selected, 2)).toEqual({ selected: [0, 2, 3, 8], rejected: false });
  });
});

describe('上方說明句（期別描述）', () => {
  const p = (year: string, start: string, end: string) => ({ year, candidate: { release: { period_start: start, period_end: end } } });

  it('各期一致（都是年底時點、都是全年）→ 不顯示', () => {
    expect(periodNote([p('2024', '2024-12-31', '2024-12-31'), p('2025', '2025-12-31', '2025-12-31')])).toBeNull();
    expect(periodNote([p('2024', '2024-01-01', '2024-12-31'), p('2025', '2025-01-01', '2025-12-31')])).toBeNull();
  });

  it('人口月資料：最新一期 8 月底、其餘年底', () => {
    const note = periodNote([p('2024', '2024-12-31', '2024-12-31'), p('2025', '2025-12-31', '2025-12-31'), p('2026', '2026-08-31', '2026-08-31')]);
    expect(note).toEqual({ major: { kind: 'yearEnd' }, exceptions: [{ year: '2026', latest: true, phrase: { kind: 'monthEnd', month: 8 } }] });
  });

  it('期別描述：全年、年底、月底、某日、累計區間', () => {
    expect(periodPhrase({ period_start: '2024-01-01', period_end: '2024-12-31' })).toEqual({ kind: 'fullYear' });
    expect(periodPhrase({ period_start: '2024-02-29', period_end: '2024-02-29' })).toEqual({ kind: 'monthEnd', month: 2 });
    expect(periodPhrase({ period_start: '2024-03-15', period_end: '2024-03-15' })).toEqual({ kind: 'date', month: 3, day: 15 });
    expect(periodPhrase({ period_start: '2025-01-01', period_end: '2025-08-31' })).toEqual({ kind: 'range', from: { month: 1, day: 1 }, to: { kind: 'monthEnd', month: 8 } });
  });
});

describe('大圖排法', () => {
  it('寬視窗 4 張取一列四欄；較方的區域取 2×2；取地圖較大者', () => {
    expect(compareArrangement(4, 1350, 660, 1.3, 72, 12).cols).toBe(4);
    expect(compareArrangement(4, 900, 1200, 1.3, 72, 12).cols).toBe(2);
    const wide = compareArrangement(4, 1350, 660, 1.3, 72, 12);
    expect(wide.mapWidth).toBe(Math.floor((1350 - 36) / 4));
  });

  it('地圖受高度限制時依高度縮', () => {
    expect(compareArrangement(1, 1350, 600, 1.3, 72, 12)).toEqual({ cols: 1, mapWidth: Math.floor((600 - 72) / 1.3) });
  });
});

describe('維度鍵分類守門', () => {
  it('recipe 出現的每個維度鍵都歸在時間或系列其中一組（新鍵出現要分類）', () => {
    const dir = join(__dirname, '..');
    const keys = new Set<string>();
    const walk = (value: unknown) => {
      if (Array.isArray(value)) { value.forEach(walk); return; }
      if (!value || typeof value !== 'object') return;
      for (const [key, child] of Object.entries(value)) {
        if (key === 'dimensions' && child && typeof child === 'object') {
          if (Array.isArray(child)) child.forEach(item => { if (item && typeof item === 'object' && typeof (item as { key?: unknown }).key === 'string') keys.add((item as { key: string }).key); });
          else Object.keys(child).forEach(dim => keys.add(dim));
        }
        walk(child);
      }
    };
    for (const file of readdirSync(dir).filter(name => /StatisticsRecipes.*\.json$/.test(name))) walk(JSON.parse(readFileSync(join(dir, file), 'utf8')));
    expect(keys.size).toBeGreaterThan(20);
    const unclassified = [...keys].filter(key => !TIME_DIMENSION_KEYS.has(key) && !SERIES_DIMENSION_KEYS.has(key));
    expect(unclassified).toEqual([]);
    expect([...TIME_DIMENSION_KEYS].filter(key => SERIES_DIMENSION_KEYS.has(key))).toEqual([]);
  });
});

describe('共用色階與缺值語意', () => {
  const recipe = { breaks: [10, 20, 20, 30], colors: ['c0', 'c1', 'c2', 'c3', 'c4'] };

  it('與 Mapbox step 相同：≥ 門檻換下一色，重複門檻取最後一色', () => {
    expect(stepColor(5, recipe.breaks, recipe.colors)).toBe('c0');
    expect(stepColor(10, recipe.breaks, recipe.colors)).toBe('c1');
    expect(stepColor(20, recipe.breaks, recipe.colors)).toBe('c3');
    expect(stepColor(99, recipe.breaks, recipe.colors)).toBe('c4');
  });

  it('observed 0 是真零（用色階）；缺值、null 不畫成 0 或最低級色', () => {
    expect(smallMultipleFill({ status: 'observed', value: 0 }, recipe)).toEqual({ kind: 'value', color: 'c0' });
    expect(smallMultipleFill({ status: 'observed', value: null }, recipe)).toEqual({ kind: 'missing' });
    expect(smallMultipleFill({ status: 'missing', value: null }, recipe)).toEqual({ kind: 'missing' });
    expect(smallMultipleFill({ status: 'not_reported', value: null }, recipe)).toEqual({ kind: 'missing' });
    expect(smallMultipleFill(undefined, recipe)).toEqual({ kind: 'missing' });
    expect(smallMultipleFill({ status: 'suppressed', value: null }, recipe)).toEqual({ kind: 'suppressed' });
    // 非類別型的 not_applicable 與主地圖一樣畫斜線
    expect(smallMultipleFill({ status: 'not_applicable', value: null }, recipe)).toEqual({ kind: 'missing' });
  });

  it('類別型：類別色；not_applicable 實心淺灰（同主地圖）', () => {
    const categorical = { ...recipe, categories: [{ value: 1, color: 'green' }, { value: 2, color: 'blue' }] };
    expect(smallMultipleFill({ status: 'observed', value: 2 }, categorical)).toEqual({ kind: 'value', color: 'blue' });
    expect(smallMultipleFill({ status: 'not_applicable', value: null }, categorical).kind).toBe('notApplicable');
  });

  it('同一層各年共用同一套分級門檻（色階不依期別變）', () => {
    const key = 'statsDemographicsTownshipShareAge65Plus' as const;
    const a = statisticsRenderRecipe(key, undefined, { roc_year: '107', month: '12' }, { isDark: true });
    const b = statisticsRenderRecipe(key, undefined, { roc_year: '114', month: '09' }, { isDark: true });
    expect(a.breaks).toEqual(b.breaks);
    expect(a.colors).toEqual(b.colors);
  });
});

describe('smallMultiplesPlan', () => {
  const release = (id: string, year: number): StatisticsRelease => ({ release_id: id, dataset_id: 'd', indicator_id: 'i', boundary_version: 'B', period_start: `${year}-01-01`, period_end: `${year}-12-31` });

  it('少於 2 年不顯示（null）；村里層不開', () => {
    const key = 'statsHealthTbNewCases' as const;
    const selection = statisticsRecipe(key);
    const releases = [release('2025-tb_new_cases-county-v1-7342e0996a9f', 2025)];
    expect(smallMultiplesPlan(key, { selection, releases, release: releases[0]! })).toBeNull();
    const village = 'statsDemographicsVillageShareAge65Plus' as const;
    expect(smallMultiplesPlan(village, { selection: statisticsRecipe(village), releases, release: releases[0]! })).toBeNull();
  });
});

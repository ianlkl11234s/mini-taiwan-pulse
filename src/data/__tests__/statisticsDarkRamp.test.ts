/**
 * 統計色階暗底版（design-system map-layers §3.6 K-4 統計例外、§3.9 C-2；statistics-layer-guidelines §4）。
 *
 * 每個統計 render key 的實際輸出（含重新取樣的級數、descending 反轉、雙向）以暗底填色透明度
 * 疊在暗陸 `#292828` 上：
 *   - 序列：對比單調（依方向遞增或遞減）、最暗一級 ≥ 1.8、最亮一級 ≥ 6、相鄰級 ΔE ≥ 4。
 *   - 雙向：兩端 ≥ 6、每一級 ≥ 1.8。
 *   - 政黨色（partisan／partyColor）與類別型不分底圖，只確認暗底與淡底輸出相同。
 * 淡底輸出必須與改版前相同（不傳 basemap＝淡底）。
 */
import { describe, expect, it } from 'vitest';
import { STATISTICS_RENDER_KEYS, statisticsRenderRecipe } from '../regionalStatisticsRecipes';
import { STATISTICS_FILL_OPACITY, statisticsFillOpacity, statisticsVisualColors } from '../statisticsVisuals';
import { BASEMAP_LAND } from '../../map/mapStyleScale';
import { compositeOver, contrastRatio, deltaE, parseColor, toHex, type Rgb } from '../../map/colorContrast';

const LAND = parseColor(BASEMAP_LAND.dark)!.rgb;
const onDark = (hex: string): Rgb => compositeOver(parseColor(hex)!.rgb, LAND, STATISTICS_FILL_OPACITY.dark);
const contrasts = (colors: readonly string[]) => colors.map((c) => contrastRatio(onDark(c), LAND));

describe('statistics dark-basemap ramps', () => {
  it('composites like Mapbox (audit pixel check: #3182bd@0.55 on #292828 → #2d5a7a)', () => {
    expect(toHex(compositeOver(parseColor('#3182bd')!.rgb, LAND, 0.55))).toBe('#2d5a7a');
  });

  it('scales the slider for the dark basemap and keeps the light value', () => {
    expect(statisticsFillOpacity(undefined, false)).toBe(0.55);
    expect(statisticsFillOpacity(undefined, true)).toBeCloseTo(0.75);
    expect(statisticsFillOpacity(0.3, false)).toBe(0.3);
    expect(statisticsFillOpacity(1, true)).toBe(1);
  });

  it('leaves light-basemap output unchanged (default = light)', () => {
    for (const key of STATISTICS_RENDER_KEYS) {
      expect(statisticsRenderRecipe(key, undefined, undefined, { isDark: false }).colors).toEqual(statisticsRenderRecipe(key).colors);
    }
  });

  it('every render key meets the dark thresholds', () => {
    const failures: string[] = [];
    let sequential = 0;
    let diverging = 0;
    let basemapIndependent = 0;
    for (const key of STATISTICS_RENDER_KEYS) {
      const dark = statisticsRenderRecipe(key, undefined, undefined, { isDark: true });
      const light = statisticsRenderRecipe(key);
      if ('categories' in dark && dark.categories) { basemapIndependent += 1; continue; }
      if (dark.colors.join() === light.colors.join()) { basemapIndependent += 1; continue; }
      const cr = contrasts(dark.colors);
      if (cr.length < 2) continue;
      const ascending = cr.every((value, i) => i === 0 || value > cr[i - 1]!);
      const descending = cr.every((value, i) => i === 0 || value < cr[i - 1]!);
      const fmt = cr.map((v) => v.toFixed(2)).join('/');
      if (ascending || descending) {
        sequential += 1;
        const minDe = Math.min(...dark.colors.slice(1).map((c, i) => deltaE(onDark(c), onDark(dark.colors[i]!))));
        if (Math.min(...cr) < 1.8 || Math.max(...cr) < 6 || minDe < 4) failures.push(`${key} ${fmt} ΔE ${minDe.toFixed(1)}`);
      } else {
        diverging += 1;
        if (cr[0]! < 6 || cr[cr.length - 1]! < 6 || Math.min(...cr) < 1.8) failures.push(`${key} diverging ${fmt}`);
      }
    }
    expect(failures).toEqual([]);
    expect(sequential).toBeGreaterThan(700);
    expect(diverging).toBeGreaterThan(0);
    expect(basemapIndependent).toBeGreaterThan(0);
  });

  it('keeps party palettes identical on both basemaps', () => {
    expect(statisticsVisualColors('x', 'x', [-10, -5, 0, 5, 10, 15], undefined, { palette: 'partisan', isDark: true }))
      .toEqual(statisticsVisualColors('x', 'x', [-10, -5, 0, 5, 10, 15], undefined, { palette: 'partisan' }));
    expect(statisticsVisualColors('x', 'x', [10, 20, 30], undefined, { partyColor: '#1f9d55', isDark: true }))
      .toEqual(statisticsVisualColors('x', 'x', [10, 20, 30], undefined, { partyColor: '#1f9d55' }));
  });
});

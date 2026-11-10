/**
 * 統計色階暗底版（design-system map-layers §3.6 K-4 統計例外、§3.9 C-2；statistics-layer-guidelines §4）。
 *
 * 2026-11-10 使用者決定：暗底與淡底同方向（低 → 高＝淺 → 深，越深越多），暗底版只調透明度、明度下限與彩度。
 * 每個統計 render key 的實際輸出（含重新取樣的級數、descending 反轉、雙向）以暗底填色透明度疊在暗陸 `#292828` 上：
 *   - 序列：對比單調、方向與淡底相同；最淺一級對比 6–9；最深一級對比 ≥ 2.2 且 OKLCH 彩度 ≥ 0.10；相鄰級 ΔE ≥ 4（目標 8）。
 *   - 雙向：兩端最深（對比 ≥ 2.2、彩度 ≥ 0.10），中間最淺。
 *   - 政黨色（partisan／partyColor）與類別型不分底圖，只確認暗底與淡底輸出相同。
 * 淡底輸出必須與改版前相同（不傳 basemap＝淡底）。
 */
import { describe, expect, it } from 'vitest';
import { STATISTICS_RENDER_KEYS, statisticsRenderRecipe } from '../regionalStatisticsRecipes';
import { STATISTICS_FILL_OPACITY, statisticsDefaultOpacity, statisticsFillOpacity, statisticsVisualColors } from '../statisticsVisuals';
import { BASEMAP_LAND } from '../../map/mapStyleScale';
import { compositeOver, contrastRatio, deltaE, oklab, parseColor, relativeLuminance, toHex, type Rgb } from '../../map/colorContrast';

const LAND = parseColor(BASEMAP_LAND.dark)!.rgb;
const onDark = (hex: string): Rgb => compositeOver(parseColor(hex)!.rgb, LAND, STATISTICS_FILL_OPACITY.dark);
const contrasts = (colors: readonly string[]) => colors.map((c) => contrastRatio(onDark(c), LAND));
const chroma = (hex: string) => { const [, a, b] = oklab(onDark(hex)); return Math.hypot(a, b); };
const luminance = (hex: string) => relativeLuminance(parseColor(hex)!.rgb);

describe('statistics dark-basemap ramps', () => {
  it('composites like Mapbox (audit pixel check: #3182bd@0.55 on #292828 → #2d5a7a)', () => {
    expect(toHex(compositeOver(parseColor('#3182bd')!.rgb, LAND, 0.55))).toBe('#2d5a7a');
  });

  it('slider value is the actual opacity; default follows the basemap', () => {
    expect(statisticsDefaultOpacity(false)).toBe(0.55);
    expect(statisticsDefaultOpacity(true)).toBe(0.75);
    expect(statisticsFillOpacity(undefined, true)).toBe(0.75);
    expect(statisticsFillOpacity(0.3, true)).toBe(0.3);
    expect(statisticsFillOpacity(0.3, false)).toBe(0.3);
  });

  it('leaves light-basemap output unchanged (default = light)', () => {
    for (const key of STATISTICS_RENDER_KEYS) {
      expect(statisticsRenderRecipe(key, undefined, undefined, { isDark: false }).colors).toEqual(statisticsRenderRecipe(key).colors);
    }
  });

  it('every render key meets the dark thresholds (same direction as light)', () => {
    const failures: string[] = [];
    let sequential = 0;
    let diverging = 0;
    let basemapIndependent = 0;
    let minAdjacent = Infinity;
    for (const key of STATISTICS_RENDER_KEYS) {
      const dark = statisticsRenderRecipe(key, undefined, undefined, { isDark: true });
      const light = statisticsRenderRecipe(key);
      if ('categories' in dark && dark.categories) { basemapIndependent += 1; continue; }
      if (dark.colors.join() === light.colors.join()) { basemapIndependent += 1; continue; }
      const cr = contrasts(dark.colors);
      if (cr.length < 2) continue;
      const fmt = cr.map((v) => v.toFixed(2)).join('/');
      const lightLum = light.colors.map(luminance);
      const ascending = cr.every((value, i) => i === 0 || value > cr[i - 1]!);
      const descending = cr.every((value, i) => i === 0 || value < cr[i - 1]!);
      if (ascending || descending) {
        sequential += 1;
        // 同方向：淡底亮度與暗底對比同升同降（越深越多）
        const lightDescending = lightLum[0]! > lightLum[lightLum.length - 1]!;
        if (lightDescending !== descending) failures.push(`${key} direction differs from light ${fmt}`);
        const lightest = Math.max(...cr);
        const deepest = descending ? dark.colors[dark.colors.length - 1]! : dark.colors[0]!;
        const minDe = Math.min(...dark.colors.slice(1).map((c, i) => deltaE(onDark(c), onDark(dark.colors[i]!))));
        minAdjacent = Math.min(minAdjacent, minDe);
        if (lightest < 6 || lightest > 9.05 || Math.min(...cr) < 2.2 || chroma(deepest) < 0.1 || minDe < 4) {
          failures.push(`${key} ${fmt} C ${chroma(deepest).toFixed(3)} ΔE ${minDe.toFixed(1)}`);
        }
      } else {
        diverging += 1;
        const ends = [dark.colors[0]!, dark.colors[dark.colors.length - 1]!];
        if (Math.min(...cr) < 2.2 || Math.min(cr[0]!, cr[cr.length - 1]!) > Math.min(...cr.slice(1, -1)) || ends.some((c) => chroma(c) < 0.1)) {
          failures.push(`${key} diverging ${fmt}`);
        }
      }
    }
    expect(failures).toEqual([]);
    expect(sequential).toBeGreaterThan(700);
    expect(diverging).toBeGreaterThan(0);
    expect(basemapIndependent).toBeGreaterThan(0);
    expect(minAdjacent).toBeGreaterThanOrEqual(4);
  });

  it('keeps party palettes identical on both basemaps', () => {
    expect(statisticsVisualColors('x', 'x', [-10, -5, 0, 5, 10, 15], undefined, { palette: 'partisan', isDark: true }))
      .toEqual(statisticsVisualColors('x', 'x', [-10, -5, 0, 5, 10, 15], undefined, { palette: 'partisan' }));
    expect(statisticsVisualColors('x', 'x', [10, 20, 30], undefined, { partyColor: '#1f9d55', isDark: true }))
      .toEqual(statisticsVisualColors('x', 'x', [10, 20, 30], undefined, { partyColor: '#1f9d55' }));
  });
});

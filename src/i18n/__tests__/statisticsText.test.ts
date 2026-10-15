import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { STATISTICS_RENDER_KEYS, statisticsRenderRecipe } from '../../data/regionalStatisticsRecipes';
import { statisticsFrequency, statisticsTitle, statisticsUnit } from '../statisticsText';

const LOCALES = join(__dirname, '..', 'locales');
const read = (locale: string, file: string): Record<string, string> => JSON.parse(readFileSync(join(LOCALES, locale, file), 'utf8'));
const CJK = /[㐀-鿿]/u;

const units = new Set<string>();
const frequencies = new Set<string>();
for (const key of STATISTICS_RENDER_KEYS) {
  const recipe = statisticsRenderRecipe(key) as { unit?: string; frequency?: string } | undefined;
  if (recipe?.unit) units.add(recipe.unit);
  if (recipe?.frequency) frequencies.add(recipe.frequency);
}

describe('統計單位與頻率譯文', () => {
  for (const [domain, source] of [['statUnit', units], ['statFrequency', frequencies]] as const) {
    for (const locale of ['en', 'ja']) {
      const file = `enums.${domain}.json`;
      const keys = Object.keys(read(locale, file));
      it(`${locale}/${file} 沒有目前配方不存在的孤兒 key`, () => {
        const orphans = keys.filter((key) => !source.has(key.slice(`enum.${domain}.`.length)));
        expect(orphans).toEqual([]);
      });
      it(`${locale}/${file} 涵蓋所有含中文的原文`, () => {
        const missing = [...source].filter((zh) => CJK.test(zh) && !(`enum.${domain}.${zh}` in read(locale, file)));
        expect(missing).toEqual([]);
      });
    }
  }
});

describe('statisticsText 輔助函式', () => {
  const zh = { active: 'zh-TW' as const, lookup: () => null };
  const en = { active: 'en' as const, lookup: (key: string) => ({ 'enum.statUnit.人': 'people', 'layer.x': 'Title' } as Record<string, string>)[key] ?? null };
  it('zh-TW 原樣回傳；外文查不到回中文，不含中文的單位原樣', () => {
    expect(statisticsTitle('x', '標題', zh as never)).toBe('標題');
    expect(statisticsUnit('人', zh as never)).toBe('人');
    expect(statisticsTitle('x', '標題', en as never)).toBe('Title');
    expect(statisticsUnit('人', en as never)).toBe('people');
    expect(statisticsUnit('%', en as never)).toBe('%');
    expect(statisticsUnit('沒翻', en as never)).toBe('沒翻');
    expect(statisticsFrequency('年度', zh as never)).toBe('年度');
    expect(statisticsFrequency('年度', en as never)).toBe('年度');
  });
});

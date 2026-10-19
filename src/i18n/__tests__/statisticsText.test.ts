import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { STATISTICS_RENDER_KEYS, statisticsRenderRecipe } from '../../data/regionalStatisticsRecipes';
import { statisticsFrequency, statisticsTitle, statisticsUnit } from '../statisticsText';
import { CRIME_STATISTICS_DOCUMENT } from '../../data/crimeStatisticsRecipes';
import { statisticsLocationBasis } from '../../data/statisticsLabels';
import { statisticsLicense, statisticsPublisher } from '../agencyText';

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

describe('治安統計（G17）外文介面不混中文', () => {
  for (const locale of ['en', 'ja'] as const) {
    const messages: Record<string, string> = {};
    for (const file of ['layers.json', 'enums.statLocationBasis.json', 'enums.statLicense.json', 'enums.statPublisher.json', 'enums.agency.json']) {
      try { Object.assign(messages, read(locale, file)); } catch { /* 檔案不存在就略過 */ }
    }
    const ctx = { active: locale, lookup: (key: string) => messages[key] ?? null } as never;
    it(`${locale}：${CRIME_STATISTICS_DOCUMENT.recipes.length} 層的圖層名、位置口徑、發布機關、授權都有譯文`, () => {
      // 日文譯文本來就有漢字，所以判準是「不等於中文原文」；英文另外要求完全不含中日韓字
      const leaks = CRIME_STATISTICS_DOCUMENT.recipes.flatMap((r) => [
        [r.label, statisticsTitle(r.layer_key, r.label, ctx)],
        [r.location_semantics, statisticsLocationBasis(r.location_semantics, ctx)],
        [r.publisher, statisticsPublisher(r.publisher, ctx)],
        [r.license, statisticsLicense(r.license, ctx)],
      ].filter(([zh, text]) => text === zh || (locale === 'en' && CJK.test(text!))).map(([, text]) => `${r.layer_key}: ${text}`));
      expect(leaks).toEqual([]);
    });
  }
  it('位置口徑查不到譯文時退回中文原文', () => {
    const ctx = { active: 'en' as const, lookup: () => null } as never;
    expect(statisticsLocationBasis('未登記的口徑', ctx)).toBe('未登記的口徑');
  });
});

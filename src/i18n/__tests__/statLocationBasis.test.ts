import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LABOR_ENABLED_STATISTICS_RECIPES, laborLocationSemantics } from '../../data/laborStatisticsRecipes';

/**
 * 統計「位置口徑」（配方 location_semantics）的英日文檢查（I18N-4）。
 * 中文原句是 key：`enum.statLocationBasis.<原句>`；新增或改動句子沒補譯文就紅。
 * 勞動統計畫面上顯示的是 laborLocationSemantics 組好的字串，一併檢查。
 */
const DATA = join(__dirname, '..', '..', 'data');
const LOCALES = join(__dirname, '..', 'locales');
const read = (locale: string): Record<string, string> => JSON.parse(readFileSync(join(LOCALES, locale, 'enums.statLocationBasis.json'), 'utf8'));
const CJK = /[㐀-鿿]/u;
const KEY = 'enum.statLocationBasis.';

function collect(node: unknown, out: Set<string>): void {
  if (Array.isArray(node)) node.forEach((n) => collect(n, out));
  else if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) {
      if (k === 'location_semantics' && typeof v === 'string') out.add(v);
      else collect(v, out);
    }
  }
}

const sentences = new Set<string>();
for (const file of readdirSync(DATA).filter((f) => /StatisticsRecipes(\.catalog)?\.json$/.test(f))) {
  collect(JSON.parse(readFileSync(join(DATA, file), 'utf8')), sentences);
}
for (const recipe of LABOR_ENABLED_STATISTICS_RECIPES) sentences.add(laborLocationSemantics(recipe));

describe('統計位置口徑英日文', () => {
  it('找得到句子（掃描沒壞）', () => {
    expect(sentences.size).toBeGreaterThan(50);
  });
  for (const locale of ['en', 'ja']) {
    it(`${locale}：每句位置口徑都有譯文且不含中文`, () => {
      const dict = read(locale);
      const missing = [...sentences].filter((s) => !dict[KEY + s]);
      expect(missing).toEqual([]);
      const cjk = [...sentences].filter((s) => locale === 'en' && CJK.test(dict[KEY + s] ?? ''));
      expect(cjk).toEqual([]);
    });
  }
});

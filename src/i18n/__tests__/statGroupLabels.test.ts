import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { STATISTICS_TOGGLE_GROUPS } from '../../data/medicalStatisticsGroups';

/**
 * 統計群組列名稱（人口、成癮、交通…的「一個概念一列」）的英日文檢查（VPB-31a）。
 * 中文原句是 key：`enum.statGroup.<label>`；新增群組沒補譯文，英日文介面會直接顯示中文，這裡擋下。
 */
const LOCALES = join(__dirname, '..', 'locales');
const read = (locale: string): Record<string, string> => JSON.parse(readFileSync(join(LOCALES, locale, 'enums.statGroup.json'), 'utf8'));

describe('統計群組列名稱英日文', () => {
  for (const locale of ['en', 'ja']) {
    it(`${locale}：每個群組名稱都有譯文`, () => {
      const dict = read(locale);
      const missing = STATISTICS_TOGGLE_GROUPS.map((group) => group.label).filter((label) => !dict[`enum.statGroup.${label}`]);
      expect(missing).toEqual([]);
    });
  }
});

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { statisticsDisclosure } from '../../data/statisticsLabels';

/**
 * 統計「資料限制／口徑說明」（配方 disclosure）的英日文檢查。
 * 中文原句是 key：`enum.statDisclosure.<原句>`（src/i18n/README）。
 * 家族逐批翻譯完就加進 DONE_FAMILIES，之後新增或改動句子沒補譯文就會紅（避免倒退）。
 */
const DONE_FAMILIES: string[] = [
  'ca', 'ie', 'kr', 'gb', 'election', 'twExtB1', // 先前已翻完（外國與選舉）
  'culture', 'mortality', 'hazard', 'indigenousRural', 'sports', 'marine', 'labor', 'taipeiAgency', 'landslide', 'openData', 'twExtB2', 'agri', 'fiscal', // I18N-1 第 1 批
  'financeAccess', 'financeAccessExt', 'health', 'social', 'comparison', // I18N-1 第 2 批
  'crime', 'stateAssets', // I18N-1 第 3 批
  'environment', 'addiction', // I18N-1 第 4 批
];

const DATA = join(__dirname, '..', '..', 'data');
const LOCALES = join(__dirname, '..', 'locales');
const read = (locale: string): Record<string, string> => JSON.parse(readFileSync(join(LOCALES, locale, 'enums.statDisclosure.json'), 'utf8'));
const CJK = /[㐀-鿿]/u;
const KEY = 'enum.statDisclosure.';

function collect(node: unknown, out: Set<string>): void {
  if (Array.isArray(node)) node.forEach((n) => collect(n, out));
  else if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) {
      if (k === 'disclosure' && typeof v === 'string') out.add(v);
      else collect(v, out);
    }
  }
}

function sentences(family: string): string[] {
  const out = new Set<string>();
  for (const suffix of ['.json', '.catalog.json']) {
    const file = join(DATA, `${family}StatisticsRecipes${suffix}`);
    if (existsSync(file)) collect(JSON.parse(readFileSync(file, 'utf8')), out);
  }
  return [...out];
}

describe('統計資料限制（disclosure）英日文', () => {
  const en = read('en');
  const ja = read('ja');
  for (const family of DONE_FAMILIES) {
    const list = sentences(family);
    it(`${family}：${list.length} 句都有英文與日文，英文不含中文`, () => {
      expect(list.length).toBeGreaterThan(0);
      const missing = list.filter((zh) => !en[KEY + zh]?.trim() || !ja[KEY + zh]?.trim());
      expect(missing.map((zh) => zh.slice(0, 40))).toEqual([]);
      const leaks = list.filter((zh) => CJK.test(en[KEY + zh] ?? ''));
      expect(leaks.map((zh) => zh.slice(0, 40))).toEqual([]);
      const untranslatedJa = list.filter((zh) => ja[KEY + zh] === zh);
      expect(untranslatedJa.map((zh) => zh.slice(0, 40))).toEqual([]);
    });
  }

  it('外文缺譯文時退回中文並在開發模式警告一次', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const ctx = { active: 'en' as const, lookup: () => null } as never;
    expect(statisticsDisclosure('一句沒登記的限制。', ctx)).toBe('一句沒登記的限制。');
    statisticsDisclosure('一句沒登記的限制。', ctx);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('中文介面不警告，粗體標記去掉', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const ctx = { active: 'zh-TW' as const, lookup: () => null } as never;
    expect(statisticsDisclosure('這**不是**移工。', ctx)).toBe('這不是移工。');
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});

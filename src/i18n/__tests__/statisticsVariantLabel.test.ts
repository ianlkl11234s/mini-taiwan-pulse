import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { STATISTICS_TOGGLE_GROUPS } from '../../data/medicalStatisticsGroups';
import { demographicsPeriodLabel, demographicsYtdLabel } from '../../data/demographicsStatisticsRecipes';
import { buildParamControls, type SelectConfig } from '../../state/layerParamsControls';
import type { MessageKey } from '../keys';
import type { Locale } from '../locales';
import { statisticsVariantLabel } from '../statisticsText';

const LOCALES = join(__dirname, '..', 'locales');
const load = (locale: string) => {
  const messages: Record<string, string> = {};
  for (const file of ['enums.statVariant.json', 'statisticsSelect.json', 'params.json', 'layers.json']) {
    Object.assign(messages, JSON.parse(readFileSync(join(LOCALES, locale, file), 'utf8')));
  }
  return messages;
};
const context = (active: Locale) => {
  const messages = active === 'zh-TW' ? {} : load(active);
  const lookup = (key: MessageKey) => messages[key] ?? null;
  return { active, lookup, t: (key: MessageKey) => lookup(key) ?? key };
};
const HAN = /[㐀-鿿]/u;

/** 日文與中文同形的詞（漢字詞本身就是日文） */
const SAME_IN_JA = new Set(['死亡']);

const labels = [...new Set(STATISTICS_TOGGLE_GROUPS.flatMap((group) => group.options.map((option) => option.label)))];

describe('statisticsVariantLabel：群組「指標／口徑」選項', () => {
  it('涵蓋所有群組選項（192 個去重 label 以上）', () => {
    expect(labels.length).toBeGreaterThanOrEqual(190);
  });
  it('中文介面原樣回傳', () => {
    for (const zh of labels) expect(statisticsVariantLabel(zh, context('zh-TW'))).toBe(zh);
  });
  it('英文：每個 label 都翻得出來，且不含中文字', () => {
    const en = context('en');
    const bad = labels.filter((zh) => { const out = statisticsVariantLabel(zh, en); return out == null || HAN.test(out); });
    expect(bad).toEqual([]);
  });
  it('日文：每個 label 都查得到對照、不等於中文原文，且沒有中文專用字（縣鄉臺數歲實）', () => {
    const ja = context('ja');
    const outputs = labels.map((zh) => [zh, statisticsVariantLabel(zh, ja)] as const);
    expect(outputs.filter(([zh, out]) => out == null || (out === zh && !SAME_IN_JA.has(zh))).map(([zh]) => zh)).toEqual([]);
    expect(outputs.filter(([, out]) => /[縣鄉臺數歲實]/.test(out ?? '')).map(([zh]) => zh)).toEqual([]);
  });
  it('組句範例', () => {
    expect(statisticsVariantLabel('縣市：出生數（115 年 1–8 月累計）', context('en'))).toBe('County/City: Births (2026, months 1–8 cumulative)');
    expect(statisticsVariantLabel('鄉鎮市區：淨遷徙人數（社會增加數）', context('ja'))).toBe('郷鎮市区：純移動数（社会増加数）');
    expect(statisticsVariantLabel('沒翻的字', context('en'))).toBeNull();
  });
});

describe('Agent 路徑與面板的選項', () => {
  const group = STATISTICS_TOGGLE_GROUPS.find((candidate) => candidate.key.startsWith('demographics:') && candidate.options.length > 3)!;
  const variantOptions = (i18n?: ReturnType<typeof context>) => {
    const controls = buildParamControls(group.options[0]!.key, {}, i18n) ?? [];
    const select = controls.find((control) => (control as SelectConfig).options?.some((option) => option.value === group.options[1]!.key)) as SelectConfig | undefined;
    return select?.options.map((option) => option.label);
  };
  it('不帶 i18n（Agent）維持原中文', () => {
    expect(variantOptions()).toEqual(group.options.map((option) => option.label));
  });
  it('中文介面一字不差；英文介面無中文', () => {
    expect(variantOptions(context('zh-TW'))).toEqual(group.options.map((option) => option.label));
    expect((variantOptions(context('en')) ?? []).filter((label) => HAN.test(label))).toEqual([]);
  });
});

describe('人口統計期別句', () => {
  const release_options = [{ release_id: 'r1', period_start: '2026-01-01', period_end: '2026-08-31', dimensions: { roc_year: '115', month_range: '01-08' }, coverage: {}, health: 'CURRENT' }] as never;
  it('不帶 i18n 與中文介面為原中文；外文民國年轉西元', () => {
    expect(demographicsYtdLabel({ release_options })).toBe('115 年 1–8 月累計');
    expect(demographicsYtdLabel({ release_options }, context('zh-TW'))).toBe('115 年 1–8 月累計');
    expect(demographicsYtdLabel({ release_options }, context('en'))).toBe('2026, months 1–8 cumulative');
    expect(demographicsYtdLabel({ release_options }, context('ja'))).toBe('2026年1～8月累計');
    expect(demographicsPeriodLabel).toBeTypeOf('function');
  });
});

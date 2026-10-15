import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  boundaryVersionLabel, statisticsAvailabilityLabel, statisticsDimensionLabel, statisticsDimensionSummary,
  statisticsDimensionValueLabel, statisticsLevelLabel, statisticsPeriodLabel,
} from '../statisticsLabels';

const LOCALES = join(__dirname, '..', '..', 'i18n', 'locales');
function i18nFor(active: 'zh-TW' | 'en' | 'ja') {
  const messages: Record<string, string> = {};
  if (active !== 'zh-TW') {
    for (const file of ['statisticsSelect.json', 'enums.statistics.json']) {
      Object.assign(messages, JSON.parse(readFileSync(join(LOCALES, active, file), 'utf8')));
    }
  }
  if (active === 'zh-TW') Object.assign(messages, JSON.parse(readFileSync(join(LOCALES, 'zh-TW', 'statisticsSelect.json'), 'utf8')));
  const lookup = (key: string) => messages[key] ?? null;
  return { active, lookup, t: (key: string) => lookup(key) ?? key } as never;
}
const en = i18nFor('en');
const ja = i18nFor('ja');
const zhCtx = i18nFor('zh-TW');
const year = { period_start: '2025-01-01', period_end: '2025-12-31' };

describe('統計人讀標籤：不傳 i18n＝原中文', () => {
  it('期別、維度、可用狀態、邊界', () => {
    expect(statisticsPeriodLabel(year)).toBe('2025 年');
    expect(statisticsPeriodLabel({ period_start: '2025-03-31', period_end: '2025-03-31' })).toBe('2025-03-31（時點）');
    expect(statisticsDimensionLabel('sex')).toBe('性別');
    expect(statisticsDimensionValueLabel('roc_year', '114')).toBe('民國 114 年');
    expect(statisticsDimensionSummary({ roc_year: '114', month: '3', sex: 'male' })).toBe('期間：民國 114 年・3 月；性別：男');
    expect(statisticsLevelLabel('township')).toBe('鄉鎮市區');
    expect(boundaryVersionLabel('COUNTY_MOI_1140318')).toBe('內政部縣市界（114 年 3 月 18 日版）');
    expect(boundaryVersionLabel(undefined)).toBe('未提供');
    expect(statisticsAvailabilityLabel('CURRENT')).toBe('CURRENT（最新期別）');
  });

  it('中文介面傳 i18n 也與原中文一致', () => {
    expect(statisticsDimensionSummary({ roc_year: '114', month: '3', sex: 'male' }, null, undefined, zhCtx)).toBe('期間：民國 114 年・3 月；性別：男');
    expect(statisticsPeriodLabel(year, zhCtx)).toBe('2025 年');
  });
});

describe('統計人讀標籤：外文語系', () => {
  it('期別與民國年換西元', () => {
    expect(statisticsPeriodLabel(year, en)).toBe('2025');
    expect(statisticsPeriodLabel({ period_start: '2025-03-31', period_end: '2025-03-31' }, en)).toBe('2025-03-31 (point in time)');
    expect(statisticsDimensionValueLabel('roc_year', '114', undefined, en)).toBe('2025');
    expect(statisticsDimensionValueLabel('roc_year', '114', undefined, ja)).toBe('2025年');
  });

  it('維度名、維度值、層級、邊界、可用狀態', () => {
    expect(statisticsDimensionLabel('sex', en)).toBe('Sex');
    expect(statisticsDimensionValueLabel('sex', 'male', undefined, en)).toBe('Male');
    expect(statisticsDimensionValueLabel('complaint_type', 'noise', undefined, ja)).toBe('騒音');
    expect(statisticsDimensionValueLabel('source_field', 'COLUMN1', 'segis_taipei_bicycle_usage_township_110', en)).toBe('Urban rental stations');
    expect(statisticsLevelLabel('county', en)).toBe('County/City');
    expect(boundaryVersionLabel('COUNTY_MOI_1140318', en)).toBe('MOI county/city boundaries (version of March 18, 2025)');
    expect(boundaryVersionLabel('nope', en)).toBe('Unnamed reference boundary version');
    expect(statisticsAvailabilityLabel('PARTIAL', ja)).toMatch(/^PARTIAL（部分カバー/);
  });

  it('篩選摘要用外文標點與分隔', () => {
    expect(statisticsDimensionSummary({ roc_year: '114', month: '3', sex: 'male' }, null, undefined, en)).toBe('Period: 2025, Month 3; Sex: Male');
  });

  it('查不到的值回退中文／原值，不吐 key', () => {
    expect(statisticsDimensionValueLabel('sex', 'unknown_code', undefined, en)).toBe('unknown_code');
    expect(statisticsDimensionLabel('no_such_dim', en)).toBe('no_such_dim');
  });
});

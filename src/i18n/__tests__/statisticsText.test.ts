import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { STATISTICS_RENDER_KEYS, statisticsRenderRecipe } from '../../data/regionalStatisticsRecipes';
import { statisticsFrequency, statisticsTitle, statisticsUnit, statisticsVariantLabel } from '../statisticsText';
import { CRIME_STATISTICS_DOCUMENT } from '../../data/crimeStatisticsRecipes';
import { TAIPEI_AGENCY_STATISTICS_DOCUMENT } from '../../data/taipeiAgencyStatisticsRecipes';
import { MORTALITY_STATISTICS_DOCUMENT } from '../../data/mortalityStatisticsRecipes';
import { CULTURE_STATISTICS_DOCUMENT } from '../../data/cultureStatisticsRecipes';
import { STATE_ASSETS_STATISTICS_DOCUMENT } from '../../data/stateAssetsStatisticsRecipes';
import { FINANCE_ACCESS_STATISTICS_DOCUMENT } from '../../data/financeAccessStatisticsRecipes';
import { FINANCE_ACCESS_EXT_STATISTICS_DOCUMENT } from '../../data/financeAccessExtStatisticsRecipes';
import { KR_STATISTICS_DOCUMENT } from '../../data/krStatisticsRecipes';
import { statisticsDimensionLabel, statisticsDimensionValueLabel, statisticsLocationBasis } from '../../data/statisticsLabels';
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

describe('臺北市局處統計外文介面不混中文', () => {
  for (const locale of ['en', 'ja'] as const) {
    const messages: Record<string, string> = {};
    for (const file of ['layers.json', 'enums.statLocationBasis.json', 'enums.statLicense.json', 'enums.statPublisher.json', 'enums.agency.json', 'enums.agencySuffix.json', 'enums.license.json', 'enums.place.json', 'enums.statGroup.json', 'enums.statistics.json', 'enums.statLegendNote.json', 'themes.json']) {
      try { Object.assign(messages, read(locale, file)); } catch { /* 檔案不存在就略過 */ }
    }
    const ctx = { active: locale, lookup: (key: string) => messages[key] ?? null } as never;
    const recipes = TAIPEI_AGENCY_STATISTICS_DOCUMENT.recipes;
    it(`${locale}：${recipes.length} 層的圖層名、群組名、位置口徑、發布機關、授權、缺值圖例都有譯文`, () => {
      // 判準同治安：日文不等於中文原文即可，英文另外要求完全不含中日韓字
      const pairs = recipes.flatMap((r) => [
        [r.label, statisticsTitle(r.layer_key, r.label, ctx)],
        [r.group_label, messages[`enum.statGroup.${r.group_label}`] ?? r.group_label],
        [r.subgroup, messages[`theme.${r.subgroup}`] ?? r.subgroup],
        [r.location_semantics, statisticsLocationBasis(r.location_semantics, ctx)],
        [r.publisher, statisticsPublisher(r.publisher, ctx)],
        [r.license, statisticsLicense(r.license, ctx)],
        ...Object.values(r.status_labels).map((label) => [label, messages[`enum.statLegendNote.${label}`] ?? label]),
      ].map(([zh, text]) => [r.layer_key, zh!, text!] as const));
      const leaks = pairs.filter(([, zh, text]) => text === zh || (locale === 'en' && CJK.test(text))).map(([key, , text]) => `${key}: ${text}`);
      expect([...new Set(leaks)]).toEqual([]);
    });
    it(`${locale}：維度與選項都有對照（日文與中文同形的「飲料製造業」等也要登記，不能靠退回中文）`, () => {
      const missing = recipes.flatMap((r) => r.dimensions.flatMap((d) => [`enum.statDim.${d.key}`, ...d.options.map((o) => `enum.statDimValue.${d.key}.${o.value}`)]))
        .filter((key) => !(key in messages) || (locale === 'en' && CJK.test(messages[key]!)));
      expect(missing).toEqual([]);
      // 經顯示函式取到的就是登記的譯文
      const factory = recipes.find((r) => r.layer_key === 'statsTaipeiFactoryCountByIndustryTownship')!;
      expect(statisticsDimensionLabel('industry_code', ctx)).toBe(messages['enum.statDim.industry_code']);
      expect(statisticsDimensionValueLabel('industry_code', '26', factory.dataset_id, ctx)).toBe(messages['enum.statDimValue.industry_code.26']);
    });
  }
});

describe('死因統計（G20）外文介面不混中文', () => {
  for (const locale of ['en', 'ja'] as const) {
    const messages: Record<string, string> = {};
    for (const file of ['layers.json', 'enums.statLocationBasis.json', 'enums.statLicense.json', 'enums.statPublisher.json', 'enums.agency.json', 'enums.agencySuffix.json', 'enums.license.json', 'enums.statGroup.json', 'enums.statistics.json', 'enums.statLegendNote.json', 'themes.json']) {
      try { Object.assign(messages, read(locale, file)); } catch { /* 檔案不存在就略過 */ }
    }
    const ctx = { active: locale, lookup: (key: string) => messages[key] ?? null } as never;
    const recipes = MORTALITY_STATISTICS_DOCUMENT.recipes;
    it(`${locale}：${recipes.length} 層的圖層名、群組、位置口徑、機關、授權、圖例說明與狀態列都有譯文`, () => {
      const pairs = recipes.flatMap((r) => [
        [r.label, statisticsTitle(r.layer_key, r.label, ctx)],
        [r.group_label, messages[`enum.statGroup.${r.group_label}`] ?? r.group_label],
        [r.subgroup, messages[`theme.${r.subgroup}`] ?? r.subgroup],
        [r.location_semantics, statisticsLocationBasis(r.location_semantics, ctx)],
        [r.publisher, statisticsPublisher(r.publisher, ctx)],
        [r.license, statisticsLicense(r.license, ctx)],
        ...[...(r.legend.notes ?? []), r.legend.zero_note, ...Object.values(r.status_labels)].filter(Boolean)
          .map((label) => [label, messages[`enum.statLegendNote.${label}`] ?? label]),
      ].map(([zh, text]) => [r.layer_key, zh!, text!] as const));
      const leaks = pairs.filter(([, zh, text]) => (locale === 'en' ? CJK.test(text) : text === zh && zh !== '死因統計')).map(([key, , text]) => `${key}: ${text}`);
      expect([...new Set(leaks)]).toEqual([]);
    });
    it(`${locale}：死因 43 類與性別都有對照`, () => {
      const missing = recipes.flatMap((r) => r.dimensions.flatMap((d) => [`enum.statDim.${d.key}`, ...d.options.map((o) => `enum.statDimValue.${d.key}.${o.value}`)]))
        .filter((key) => !(key in messages) || (locale === 'en' && CJK.test(messages[key]!)));
      expect([...new Set(missing)]).toEqual([]);
    });
  }
});

// Roadmap 第二批（2026-10-24）：街頭藝人（G23）；國有資產（G16）、金融可及性（G10）同一套檢查。
const JA_SAME_AS_ZH = new Set(['人', '文化部', '面積', '法務部行政執行署', '台']);
const BATCH2_DOCUMENTS = [["街頭藝人（G23）", CULTURE_STATISTICS_DOCUMENT], ["國有資產（G16）", STATE_ASSETS_STATISTICS_DOCUMENT], ["金融服務可及性（G10）", FINANCE_ACCESS_STATISTICS_DOCUMENT], ["金融服務可及性延伸（G10 延伸）", FINANCE_ACCESS_EXT_STATISTICS_DOCUMENT]] as const;
describe.each(BATCH2_DOCUMENTS)('%s 外文介面不混中文', (_name, document) => {
  for (const locale of ['en', 'ja'] as const) {
    const messages: Record<string, string> = {};
    for (const file of ['layers.json', 'enums.statLocationBasis.json', 'enums.statLicense.json', 'enums.statPublisher.json', 'enums.agency.json', 'enums.agencySuffix.json', 'enums.license.json', 'enums.statGroup.json', 'enums.statistics.json', 'enums.statLegendNote.json', 'enums.statVariant.json', 'enums.statUnit.json', 'themes.json', 'statisticsSelect.json']) {
      try { Object.assign(messages, read(locale, file)); } catch { /* 檔案不存在就略過 */ }
    }
    const ctx = { active: locale, lookup: (key: string) => messages[key] ?? null } as never;
    const recipes = document.recipes;
    it(`${locale}：${recipes.length} 層的圖層名、群組、口徑選項、單位、位置口徑、機關、授權、圖例說明與狀態列都有譯文`, () => {
      const pairs = recipes.flatMap((r) => [
        [r.label, statisticsTitle(r.layer_key, r.label, ctx)],
        [r.group_label, messages[`enum.statGroup.${r.group_label}`] ?? r.group_label],
        [r.option_label, statisticsVariantLabel(r.option_label, ctx) ?? r.option_label],
        [r.subgroup, messages[`theme.${r.subgroup}`] ?? r.subgroup],
        [r.unit, statisticsUnit(r.unit, ctx)],
        [r.location_semantics, statisticsLocationBasis(r.location_semantics, ctx)],
        [r.publisher, statisticsPublisher(r.publisher, ctx)],
        [r.license, statisticsLicense(r.license, ctx)],
        ...[...(r.legend.notes ?? []), r.legend.zero_note, ...(r.legend.binary_labels ?? []), ...Object.values(r.status_labels)].filter(Boolean)
          .map((label) => [label, messages[`enum.statLegendNote.${label}`] ?? label]),
      ].filter(([zh]) => CJK.test(zh!)).map(([zh, text]) => [r.layer_key, zh!, text!] as const));
      // 日文與中文同形的少數詞（人、文化部、面積、法務部行政執行署、台）照登記值，不算外漏
      const leaks = pairs.filter(([, zh, text]) => (text === zh && !(locale === 'ja' && JA_SAME_AS_ZH.has(zh))) || (locale === 'en' && CJK.test(text))).map(([key, zh]) => `${key}: ${zh}`);
      expect([...new Set(leaks)]).toEqual([]);
    });
    it(`${locale}：維度與選項都有對照`, () => {
      const missing = recipes.flatMap((r) => r.dimensions.flatMap((d) => [`enum.statDim.${d.key}`, ...d.options.map((o) => `enum.statDimValue.${d.key}.${o.value}`)]))
        .filter((key) => !(key in messages) || (locale === 'en' && CJK.test(messages[key]!)));
      expect([...new Set(missing)]).toEqual([]);
    });
  }
});

describe('南韓統計外文介面不混中文', () => {
  for (const locale of ['en', 'ja'] as const) {
    const messages: Record<string, string> = {};
    for (const file of ['layers.json', 'enums.statLocationBasis.json', 'enums.statLicense.json', 'enums.statPublisher.json', 'enums.statGroup.json', 'enums.statVariant.json', 'enums.statLegendNote.json', 'themes.json']) {
      Object.assign(messages, read(locale, file));
    }
    const ctx = { active: locale, lookup: (key: string) => messages[key] ?? null } as never;
    const recipes = KR_STATISTICS_DOCUMENT.recipes;
    it(`${locale}：${recipes.length} 層的圖層名、群組、選項、位置口徑、發布機關、授權、圖例說明與缺值圖例都有譯文`, () => {
      // 判準同治安：日文不等於中文原文即可，英文另外要求完全不含中日漢字（韓文原文署名可留）
      const pairs = recipes.flatMap((r) => [
        [r.label, statisticsTitle(r.layer_key, r.label, ctx)],
        [r.group_label, messages[`enum.statGroup.${r.group_label}`] ?? r.group_label],
        [r.option_label, messages[`enum.statVariant.${r.option_label}`] ?? r.option_label],
        [r.subgroup, messages[`theme.${r.subgroup}`] ?? r.subgroup],
        [r.location_semantics, statisticsLocationBasis(r.location_semantics, ctx)],
        [r.publisher, statisticsPublisher(r.publisher, ctx)],
        [r.license, statisticsLicense(r.license, ctx)],
        ...(r.legend.notes ?? []).map((note) => [note, messages[`enum.statLegendNote.${note}`] ?? note]),
        ...Object.values(r.status_labels).map((label) => [label, messages[`enum.statLegendNote.${label}`] ?? label]),
      ].map(([zh, text]) => [r.layer_key, zh!, text!] as const));
      // 不含中文的原文（韓文機關名）原樣顯示不算漏翻；日文與中文同形的詞（男性人口等）本來就相同
      const sameInJa = new Set(['男性人口', '女性人口', '人口密度', '夜間生活人口']);
      const leaks = pairs.filter(([, zh, text]) => (text === zh && CJK.test(zh) && !(locale === 'ja' && sameInJa.has(zh))) || (locale === 'en' && CJK.test(text))).map(([key, , text]) => `${key}: ${text}`);
      expect([...new Set(leaks)]).toEqual([]);
    });
  }
});

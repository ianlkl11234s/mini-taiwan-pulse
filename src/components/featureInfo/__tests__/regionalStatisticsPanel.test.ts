import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, describe, expect, it } from 'vitest';
import { localeStore } from '../../../state/localeStore';
import { RegionalStatisticsPanel } from '../regionalStatisticsPanel';
import { CRIME_STATISTICS_DOCUMENT } from '../../../data/crimeStatisticsRecipes';

/** 治安統計（G17）彈窗：feature props 照 loader 組法，publisher／license／source_url 取自配方（＝R2 來源紀錄同值） */
function crimeProps() {
  const recipe = CRIME_STATISTICS_DOCUMENT.recipes.find((r) => r.layer_key === 'statsCrimeResidentialBurglaryCasesTownship')!;
  return {
    area_name: '臺北市中山區', area_code: '63000040', layer_key: recipe.layer_key, indicator_name: recipe.label, value: 24, status: 'observed', unit: recipe.unit,
    period_start: '2025-01-01', period_end: '2025-12-31', boundary_version: recipe.boundary_version,
    location_semantics: recipe.location_semantics, publisher: recipe.publisher, license: recipe.license, source_url: recipe.source_landing_url,
  };
}

describe('RegionalStatisticsPanel labor semantics', () => {
  it('shows location, boundary role, coverage, and source-not-covered separately from zero', () => {
    const html = renderToStaticMarkup(createElement(RegionalStatisticsPanel, { props: {
      area_name: '金門縣', area_code: '09007', indicator_name: '全年總薪資中位數',
      value: null, status: 'missing', missing_reason: 'source_not_covered', unit: '萬元／人年',
      period_label: '2024-01-01 — 2024-12-31', boundary_version: 'COUNTY_MOI_1140318',
      boundary_semantics: 'reference boundary；不宣稱歷史原生界線。',
      location_semantics: '本國籍全時受僱員工的實際工作所在地；非居住地。',
      coverage_status: 'PARTIAL', coverage_numerator: 20, coverage_denominator: 22,
      publisher: '行政院主計總處',
    }}));
    expect(html).toContain('缺資料（missing），不等於 0');
    expect(html).toContain('source_not_covered');
    expect(html).toContain('實際工作所在地');
    // 參考邊界顯示中文來源描述，不印內部代碼（spec §6.3）
    expect(html).toContain('內政部縣市界（114 年 3 月 18 日版）');
    expect(html).not.toContain('COUNTY_MOI_1140318');
    expect(html).toContain('20／22');
  });

  it('shows the source participation rate used by the derived non-labor-force rate', () => {
    const html = renderToStaticMarkup(createElement(RegionalStatisticsPanel, { props: {
      area_name: '新竹市', area_code: '10018', indicator_name: '非勞動力率',
      value: 40.4, status: 'observed', unit: '%', value_transform: 'complement_100',
      period_label: '2026-01-01 — 2026-06-30', boundary_version: 'COUNTY_MOI_1140318',
      comparison_formula: '100% − 勞動力參與率',
      inputs: { source_participation_rate_pct: 59.6 },
      publisher: '行政院主計總處',
    }}));
    expect(html).toContain('來源勞動力參與率（%）');
    expect(html).toContain('59.6');
    expect(html).toContain('40.4 %');
  });

  it('labels prosecutor districts as 地檢署轄區, not as an administrative area', () => {
    const html = renderToStaticMarkup(createElement(RegionalStatisticsPanel, { props: {
      area_name: '臺灣士林地方檢察署', area_code: 'PD_SLK', counties: '新北市、臺北市', township_count: 10,
      indicator_name: '地檢署毒品新收人數（轄區）', value: 812, status: 'observed', unit: '人',
      boundary_version: 'PROSECUTOR_DISTRICT_TOWN_MOI_1140318_v1', publisher: '法務部',
    }}));
    expect(html).toContain('地檢署轄區');
    expect(html).toContain('臺灣士林地方檢察署');
    expect(html).toContain('新北市、臺北市（10 個鄉鎮市區）');
    expect(html).toContain('地檢署轄區≠縣市');
    expect(html).toContain('轄區代碼');
    expect(html).not.toContain('行政區代碼');
    expect(html).not.toContain('PROSECUTOR_DISTRICT_TOWN_MOI_1140318_v1');
  });
  it('translates the loader hard-coded complement-rate notes in English', async () => {
    await localeStore.ready('en');
    localeStore.set('en');
    const html = renderToStaticMarkup(createElement(RegionalStatisticsPanel, { props: {
      area_name: 'Hsinchu City', area_code: '10018', indicator_name: 'Non-labor-force rate',
      value: 40.4, status: 'observed', unit: '%', value_transform: 'complement_100',
      comparison_formula: '100% − 勞動力參與率',
      interpretation: '非勞動力率占同一期人力資源調查 15 歲以上民間人口的比例。',
    }}));
    expect(html).toContain('100% − labor force participation rate');
    expect(html).toContain('Manpower Survey');
    expect(html).not.toContain('勞動力參與率');
  });

  it('crime statistics: source card shows agency, license and link instead of "source pending" (zh-TW)', () => {
    localeStore.set('zh-TW');
    const html = renderToStaticMarkup(createElement(RegionalStatisticsPanel, { props: crimeProps() }));
    expect(html).toContain('內政部警政署');
    expect(html).toContain('政府資料開放授權條款第 1 版');
    expect(html).toContain('href="https://data.gov.tw/dataset/14200"');
    expect(html).not.toContain('來源資訊待補');
  });

  for (const locale of ['en', 'ja'] as const) {
    it(`crime statistics: ${locale} source card and location basis have no Chinese fallback`, async () => {
      await localeStore.ready(locale);
      localeStore.set(locale);
      const html = renderToStaticMarkup(createElement(RegionalStatisticsPanel, { props: crimeProps() }));
      const pending = locale === 'en' ? 'Source information pending' : '出典情報は追加予定';
      expect(html).not.toContain(pending);
      expect(html).toContain('href="https://data.gov.tw/dataset/14200"');
      for (const zh of ['內政部警政署', '政府資料開放授權條款', '案件發生地', '鄉鎮市區精度', '住宅竊盜發生件數']) expect(html).not.toContain(zh);
      if (locale === 'en') expect(html).toContain('24 cases');
      expect(html).toContain(locale === 'en' ? 'Residential Burglary Cases' : '住宅侵入窃盗発生件数');
      expect(html).toContain(locale === 'en' ? 'National Police Agency' : '警政署');
      expect(html).toContain(locale === 'en' ? 'Open Government Data License' : '政府データオープンライセンス');
      expect(html).toContain(locale === 'en' ? 'Place of occurrence' : '事件の発生地');
    });
  }
});

afterAll(() => localeStore.set('zh-TW'));

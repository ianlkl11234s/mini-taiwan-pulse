import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { RegionalStatisticsPanel } from '../regionalStatisticsPanel';

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
      value: 40.4, status: 'observed', unit: '%',
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
});

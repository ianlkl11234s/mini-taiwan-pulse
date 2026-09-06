import { describe, expect, it } from 'vitest';
import { statisticsDimensionSummary, statisticsValueLabel } from '../StatisticsDetails';

describe('statisticsDimensionSummary', () => {
  it('renders the selected period and fund as a compact disclosure label', () => {
    expect(statisticsDimensionSummary({
      roc_year: '114', month: '07', agency_fund: '交通部航港局-前瞻基礎建設計畫第5期特別預算',
    })).toBe('期間：民國 114 年・07 月；基金：交通部航港局-前瞻基礎建設計畫第5期特別預算');
  });

  it('does not render empty dimensions as empty fields', () => {
    expect(statisticsDimensionSummary({ roc_year: '114', month: '', agency_fund: '' })).toBe('期間：民國 114 年');
    expect(statisticsDimensionSummary({})).toBe('');
  });

  it('falls back to the selected release period and humanizes fixed dimensions', () => {
    expect(statisticsDimensionSummary(
      { sector: 'residential' },
      { period_start: '2025-01-01', period_end: '2025-12-31' },
    )).toBe('期間：2025 年；用電別：住宅');
    expect(statisticsDimensionSummary(
      { roc_year: '112', quarter: 'Q4' },
      { period_start: '2023-10-01', period_end: '2023-12-31' },
    )).toBe('期間：民國 112 年・Q4');
  });

  it('keeps missing reconciliation amounts distinct from a real zero', () => {
    expect(statisticsValueLabel(null, 'TWD')).toBe('未提供');
    expect(statisticsValueLabel(0, 'TWD')).toBe('0 TWD');
  });

  it('humanizes the Taipei-only article selection summary', () => {
    expect(statisticsDimensionSummary({ roc_year: '114', law_article: '第12條', geographic_coverage: 'taipei_only' })).toBe('期間：民國 114 年；法條：第12條；地理涵蓋：僅臺北市');
  });

  it('humanizes the Taichung-only control-zone selection summary', () => {
    expect(statisticsDimensionSummary({ roc_year: '113', quarter: 'Q3', control_zone_class: '第一類管制區', geographic_coverage: 'taichung_only' })).toBe('期間：民國 113 年・Q3；管制區類別：第一類管制區；地理涵蓋：僅臺中市');
  });
});

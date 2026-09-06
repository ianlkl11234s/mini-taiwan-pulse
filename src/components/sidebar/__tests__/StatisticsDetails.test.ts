import { describe, expect, it } from 'vitest';
import { statisticsDimensionSummary } from '../StatisticsDetails';

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
});

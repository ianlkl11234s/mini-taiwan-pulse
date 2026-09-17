import { Row } from './shared';

const INPUT_LABELS: Record<string, string> = {
  official_complete_county_sum: '22縣市同類合計', numerator: '分子', denominator: '分母', numerator_hectares: '同類面積（公頃）',
  denominator_hectares: '行政面積（公頃）', admin_area_km2: '行政面積（平方公里）',
  local_category_ha: '當地同類面積（公頃）', local_admin_ha: '當地行政面積（公頃）',
  national_category_ha: '全臺同類面積（公頃）', national_admin_ha: '全臺行政面積（公頃）',
  denominator_population: '分母人口', population: '分母人口', heads: '在養頭／隻數', farms: '飼養場數',
};
function inputValue(value: unknown): string {
  if (typeof value === 'number') return value.toLocaleString('zh-TW', {maximumFractionDigits: 4});
  if (value && typeof value === 'object') {
    const row = value as Record<string, unknown>;
    if (row.status === 'observed' && typeof row.value === 'number') return inputValue(row.value);
    if (row.status) return `無可計算數值（${row.source_token || row.status}）`;
  }
  return String(value ?? '無資料');
}


export function RegionalStatisticsPanel({ props }: { props: Record<string, unknown> }) {
  let format = props.format;
  if (typeof format === 'string') { try { format = JSON.parse(format); } catch { format = undefined; } }
  let inputs = props.inputs;
  if (typeof inputs === 'string') { try { inputs = JSON.parse(inputs); } catch { inputs = undefined; } }
  const numericFormat = format as { locale?: string; maximumFractionDigits?: number } | undefined;
  const observed = props.status === 'observed' && typeof props.value === 'number';
  const missingLabel = props.status === 'suppressed' ? '遮蔽 suppressed（*）'
    : props.source_status === 'not_reported' ? '未報告 not_reported（-）'
      : `缺資料（${props.status ?? 'missing'}）`;
  return <>
    <Row label="區域" value={String(props.area_name ?? props.area_code ?? '—')} />
    <Row label="統計指標" value={String(props.indicator_name ?? '—')} />
    <Row label="數值" value={observed ? `${Number(props.value).toLocaleString(numericFormat?.locale, { maximumFractionDigits: numericFormat?.maximumFractionDigits ?? 3 })} ${props.unit ?? ''}` : `${missingLabel}，不等於 0`} />
    {props.source_status != null && <Row label="來源狀態" value={String(props.source_status)} />}
    {props.source_token != null && <Row label="來源原值" value={String(props.source_token)} />}
    <Row label="資料期別" value={String(props.period_label ?? props.release_id ?? '—')} />
    {props.comparison_formula != null && <Row label="計算方式" value={String(props.comparison_formula)} />}
    {inputs != null && typeof inputs === 'object' && Object.entries(inputs).filter(([key]) => key in INPUT_LABELS).map(([key, value]) => <Row key={key} label={INPUT_LABELS[key]!} value={inputValue(value)} />)}
    {props.interpretation != null && <Row label="如何理解" value={String(props.interpretation)} />}
    {props.time_caveat != null && <Row label="時間口徑" value={String(props.time_caveat)} />}
    <Row label="行政區代碼" value={String(props.area_code ?? '—')} />
    <Row label="參考邊界" value={String(props.boundary_version ?? '—')} />
    {props.source_statistical_boundary_version != null && <Row label="統計參考版" value={String(props.source_statistical_boundary_version)} />}
    {props.availability != null && <Row label="資料可用狀態" value={String(props.availability)} />}
    {props.coverage_status != null && <Row label="覆蓋狀態" value={String(props.coverage_status)} />}
    {props.method_version != null && <Row label="處理版本" value={String(props.method_version)} />}
    {props.raw_sha256 != null && <Row label="原始 SHA-256" value={String(props.raw_sha256)} />}
    <Row label="來源" value={String(props.publisher ?? '—')} />
  </>;
}

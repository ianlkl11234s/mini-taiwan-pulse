import { Row } from './shared';

export function RegionalStatisticsPanel({ props }: { props: Record<string, unknown> }) {
  let format = props.format;
  if (typeof format === 'string') { try { format = JSON.parse(format); } catch { format = undefined; } }
  const numericFormat = format as { locale?: string; maximumFractionDigits?: number } | undefined;
  const observed = props.status === 'observed' && typeof props.value === 'number';
  const missingLabel = props.status === 'suppressed' ? '遮蔽 suppressed（*）' : props.source_status === 'not_reported' ? '未報告 not_reported（-）' : `缺資料（${props.status ?? 'missing'}）`;
  return <>
    <Row label="區域" value={String(props.area_name ?? props.area_code ?? '—')} />
    <Row label="統計指標" value={String(props.indicator_name ?? '—')} />
    <Row label="數值" value={observed ? `${Number(props.value).toLocaleString(numericFormat?.locale, { maximumFractionDigits: numericFormat?.maximumFractionDigits ?? 3 })} ${props.unit ?? ''}` : `${missingLabel}，不等於 0`} />
    {props.source_status != null && <Row label="來源狀態" value={String(props.source_status)} />}
    {props.source_token != null && <Row label="來源原值" value={String(props.source_token)} />}
    <Row label="資料期別" value={String(props.period_label ?? props.release_id ?? '—')} />
    <Row label="行政區代碼" value={String(props.area_code ?? '—')} />
    <Row label="參考邊界" value={String(props.boundary_version ?? '—')} />
    {props.source_statistical_boundary_version != null && <Row label="統計參考版" value={String(props.source_statistical_boundary_version)} />}
    {props.availability != null && <Row label="健康狀態" value={String(props.availability)} />}
    {props.coverage_status != null && <Row label="覆蓋狀態" value={String(props.coverage_status)} />}
    {props.method_version != null && <Row label="處理版本" value={String(props.method_version)} />}
    {props.raw_sha256 != null && <Row label="原始 SHA-256" value={String(props.raw_sha256)} />}
    <Row label="來源" value={String(props.publisher ?? '—')} />
  </>;
}

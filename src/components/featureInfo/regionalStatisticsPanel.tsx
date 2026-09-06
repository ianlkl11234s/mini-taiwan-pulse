import { Row } from './shared';

export function RegionalStatisticsPanel({ props }: { props: Record<string, unknown> }) {
  const observed = props.status === 'observed' && typeof props.value === 'number';
  return <>
    <Row label="區域" value={String(props.area_name ?? props.area_code ?? '—')} />
    <Row label="統計指標" value={String(props.indicator_name ?? '—')} />
    <Row label="數值" value={observed ? `${Number(props.value).toLocaleString()} ${props.unit ?? ''}` : `無可用數值（${props.status ?? 'missing'}）`} />
    <Row label="資料期別" value={String(props.period_label ?? props.release_id ?? '—')} />
    <Row label="行政區代碼" value={String(props.area_code ?? '—')} />
    <Row label="參考邊界" value={String(props.boundary_version ?? '—')} />
    <Row label="來源" value={String(props.publisher ?? '—')} />
  </>;
}

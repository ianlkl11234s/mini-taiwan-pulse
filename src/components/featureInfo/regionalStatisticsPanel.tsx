import { Row } from './shared';
import { useLocale } from '../../state/localeStore';
import { enumLabel } from '../../i18n/dataText';
import { placeName, placeNameList } from '../../i18n/placeText';
import { statisticsPublisher } from '../../i18n/agencyText';
import type { LocaleSnapshot } from "../../state/localeStore";
import { boundaryVersionLabel, humanizeStatisticsText, statisticsAvailabilityLabel } from '../../data/statisticsLabels';

const INPUT_LABELS: Record<string, string> = {
  official_complete_county_sum: '22縣市同類合計', numerator: '分子', denominator: '分母', numerator_hectares: '同類面積（公頃）',
  denominator_hectares: '行政面積（公頃）', admin_area_km2: '行政面積（平方公里）',
  local_category_ha: '當地同類面積（公頃）', local_admin_ha: '當地行政面積（公頃）',
  national_category_ha: '全臺同類面積（公頃）', national_admin_ha: '全臺行政面積（公頃）',
  denominator_population: '分母人口', population: '分母人口', heads: '在養頭／隻數', farms: '飼養場數',
  source_participation_rate_pct: '來源勞動力參與率（%）',
};
function inputValue(value: unknown, i18n: LocaleSnapshot): string {
  const { t, formatNumber } = i18n;
  if (typeof value === 'number') return formatNumber(value, {maximumFractionDigits: 4});
  if (value && typeof value === 'object') {
    const row = value as Record<string, unknown>;
    if (row.status === 'observed' && typeof row.value === 'number') return inputValue(row.value, i18n);
    if (row.status) return t('popup.regionalStatistics.notComputable', { value: String(row.source_token || row.status) });
  }
  return String(value ?? t('popup.common.noData'));
}


export function RegionalStatisticsPanel({ props }: { props: Record<string, unknown> }) {
  const i18n = useLocale();
  const { t } = i18n;
  // 非勞動力率（loader 以 complement_100 換算）：公式與說明在 loader 寫中文，外文由這裡翻
  const complement = props.value_transform === 'complement_100';
  let format = props.format;
  if (typeof format === 'string') { try { format = JSON.parse(format); } catch { format = undefined; } }
  let inputs = props.inputs;
  if (typeof inputs === 'string') { try { inputs = JSON.parse(inputs); } catch { inputs = undefined; } }
  const numericFormat = format as { locale?: string; maximumFractionDigits?: number } | undefined;
  const observed = props.status === 'observed' && typeof props.value === 'number';
  // 地檢署轄區（area_code PD_xxx）不是行政區：名稱用地檢署全銜，另列涵蓋縣市，避免被讀成縣市。
  const prosecutorDistrict = typeof props.area_code === 'string' && props.area_code.startsWith('PD_');
  const missingLabel = props.status === 'suppressed' ? t('popup.regionalStatistics.suppressed')
    : props.source_status === 'not_reported' ? t('popup.regionalStatistics.notReported')
      : t('popup.regionalStatistics.missingData', { status: String(props.status ?? 'missing') });
  return <>
    <Row label={prosecutorDistrict ? t('popup.regionalStatistics.prosecutorDistrict') : t('popup.field.region')} value={prosecutorDistrict || props.area_name == null ? String(props.area_name ?? props.area_code ?? '—') : placeName(String(props.area_name), i18n, props.area_code as string | number | null | undefined)} />
    {prosecutorDistrict && <Row label={t('popup.regionalStatistics.coveredCounties')} value={`${props.counties == null ? '—' : placeNameList(String(props.counties), i18n)}${typeof props.township_count === 'number' ? t('popup.regionalStatistics.townshipCount', { count: props.township_count }) : ''}`} />}
    {prosecutorDistrict && <Row field="caution" value={t('popup.regionalStatistics.prosecutorCaution')} />}
    <Row label={t('popup.regionalStatistics.indicator')} value={String(props.indicator_name ?? '—')} />
    <Row label={t('popup.regionalStatistics.value')} value={observed ? `${Number(props.value).toLocaleString(numericFormat?.locale, { maximumFractionDigits: numericFormat?.maximumFractionDigits ?? 3 })} ${props.unit ?? ''}` : t('popup.regionalStatistics.notZero', { label: missingLabel })} />
    {props.source_status != null && <Row label={t('popup.regionalStatistics.sourceStatus')} value={String(props.source_status)} />}
    {props.source_token != null && <Row label={t('popup.regionalStatistics.sourceToken')} value={String(props.source_token)} />}
    {props.missing_reason != null && <Row label={t('popup.regionalStatistics.missingReason')} value={String(props.missing_reason)} />}
    <Row label={t('popup.regionalStatistics.period')} value={String(props.period_label ?? props.release_id ?? '—')} />
    {props.location_semantics != null && <Row label={t('popup.regionalStatistics.locationBasis')} value={humanizeStatisticsText(String(props.location_semantics))} />}
    {props.disclosure != null && <Row field="dataLimits" value={humanizeStatisticsText(String(props.disclosure))} />}
    {props.comparison_formula != null && <Row label={t('popup.regionalStatistics.formula')} value={complement ? t('popup.regionalStatistics.complementFormula') : String(props.comparison_formula)} />}
    {inputs != null && typeof inputs === 'object' && Object.entries(inputs).filter(([key]) => key in INPUT_LABELS).map(([key, value]) => <Row key={key} label={enumLabel('regionalStatisticsInput', key, INPUT_LABELS[key]!, i18n)} value={inputValue(value, i18n)} />)}
    {props.interpretation != null && <Row label={t('popup.regionalStatistics.interpretation')} value={complement ? t('popup.regionalStatistics.complementInterpretation') : String(props.interpretation)} />}
    {props.time_caveat != null && <Row label={t('popup.regionalStatistics.timeBasis')} value={String(props.time_caveat)} />}
    <Row label={prosecutorDistrict ? t('popup.regionalStatistics.prosecutorCode') : t('popup.regionalStatistics.districtCode')} value={String(props.area_code ?? '—')} />
    <Row label={t('popup.regionalStatistics.refBoundary')} value={props.boundary_version == null ? '—' : boundaryVersionLabel(props.boundary_version, i18n)} />
    {props.boundary_semantics != null && <Row label={t('popup.regionalStatistics.boundaryRole')} value={humanizeStatisticsText(String(props.boundary_semantics))} />}
    {props.source_statistical_boundary_version != null && <Row label={t('popup.regionalStatistics.statRefVersion')} value={boundaryVersionLabel(props.source_statistical_boundary_version, i18n)} />}
    {props.availability != null && <Row label={t('popup.regionalStatistics.availability')} value={statisticsAvailabilityLabel(String(props.availability), i18n)} />}
    {props.coverage_status != null && <Row label={t('popup.regionalStatistics.coverageStatus')} value={String(props.coverage_status)} />}
    {props.coverage_numerator != null && props.coverage_denominator != null && <Row label={t('popup.regionalStatistics.coverageCount')} value={`${String(props.coverage_numerator)}／${String(props.coverage_denominator)}`} />}
    {props.method_version != null && <Row label={t('popup.regionalStatistics.methodVersion')} value={String(props.method_version)} />}
    {props.raw_sha256 != null && <Row label={t('popup.regionalStatistics.rawSha')} value={String(props.raw_sha256)} />}
    <Row field="source" value={props.publisher == null ? '—' : statisticsPublisher(String(props.publisher), i18n)} />
  </>;
}

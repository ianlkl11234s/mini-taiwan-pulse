import type { NearbyResult, NearbyRow } from "./nearbyData";
import { Slider } from "../components/controls/Slider";
import { useLocale } from "../state/localeStore";

type Props = { result: NearbyResult; opacity: number; onOpacity: (value: number) => void; onSelect: (row: NearbyRow) => void; onClear: () => void };
export function NearbyResults({ result, opacity, onOpacity, onSelect, onClear }: Props) {
  const { t, formatNumber } = useLocale();
  const exclusions = result.exclusions;
  const excluded = exclusions ? exclusions.missingGeometry + exclusions.nonPoint + exclusions.invalidCoordinates : null;
  return <section className="nearby-results" aria-label={t("researchResult.nearby.aria")}>
    <div className="nearby-results-title"><h3>{t("researchResult.nearby.title")}</h3><button onClick={onClear}>{t("researchResult.nearby.clear")}</button></div>
    <p><strong>{t("researchResult.nearby.matched", { count: result.totalMatched })}</strong> · {t("researchResult.nearby.radius", { radius: formatNumber(result.radiusM) })}</p>
    <small>{t("researchResult.nearby.straightNote")}</small>
    <p>{t("researchResult.nearby.ringNote")}</p>
    <label>{t("researchResult.nearby.opacity")}<Slider ariaLabel={t("researchResult.nearby.opacityAria")} min={0} max={1} step={0.05} value={opacity} onChange={onOpacity} /></label>
    {result.truncated && <p>{t("researchResult.nearby.truncated", { total: result.totalMatched, returned: result.returned })}</p>}
    {result.totalMatched === 0 && <p>{t("researchResult.nearby.empty")}</p>}
    <ol>{result.rows.map(row => <li key={row.id}><button onClick={() => onSelect(row)}><span>{row.name || t("researchResult.nearby.noName")}</span><span>{t("researchResult.nearby.distance", { meters: row.distanceM.toFixed(0) })}</span></button></li>)}</ol>
    <details><summary>{t("researchResult.nearby.limits")}</summary><p>{t("researchResult.nearby.file", { reference: result.source?.reference ?? t("researchResult.evidence.unknown") })}</p><p>{t("researchResult.nearby.timeNote", { time: result.source?.observedAt ?? t("researchResult.evidence.unknown") })}</p><p>{excluded === null ? t("researchResult.nearby.methodUnknown") : t("researchResult.nearby.methodExcluded", { count: excluded })}</p><small>{t("researchResult.nearby.schoolCodeNote")}</small></details>
  </section>;
}

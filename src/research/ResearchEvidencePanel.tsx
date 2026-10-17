import type { MessageKey } from "../i18n/keys";
import { useLocale } from "../state/localeStore";
import type { ResearchEvidence } from "./researchEvidence";
import { STATUS_LABEL_KEYS } from "./researchResultPopup";
const OPERATION_KEYS: Record<string, MessageKey> = {
  compare_regions: "researchResult.evidence.op.compare_regions", query_records: "researchResult.evidence.op.query_records", spatial_query: "researchResult.evidence.op.spatial_query",
  aggregate_by_area: "researchResult.evidence.op.aggregate_by_area", create_analysis_scope: "researchResult.evidence.op.create_analysis_scope",
  import_warehouse_result: "researchResult.evidence.op.import_warehouse_result", walking_isochrone: "researchResult.evidence.op.walking_isochrone", route_distance: "researchResult.evidence.op.route_distance",
};
export function ResearchEvidencePanel({ evidence }: { evidence: readonly ResearchEvidence[] }) {
  const { t, formatNumber } = useLocale();
  if (!evidence.length) return null;
  const valueText = (value: unknown): string => value === null || value === undefined ? "—" : typeof value === "number" ? formatNumber(value, { maximumFractionDigits: 4 }) : String(value);
  const statusText = (status: unknown): string => { const key = STATUS_LABEL_KEYS[String(status)]; return key ? t(key) : status as string; };
  return <section className="agent-analysis-results" aria-label={t("researchResult.evidence.title")}>
    <h3>{t("researchResult.evidence.title")}</h3>
    {evidence.map((item, index) => <details key={`${item.resultId}:${index}`} open={index === 0}>
      <summary>{OPERATION_KEYS[item.operation] ? t(OPERATION_KEYS[item.operation]!) : item.operation}{item.operation === "compare_regions" ? ` · ${item.rows.map(row => row.area_name ?? row.area_code).join(t("researchResult.sep.slash"))}` : ""}</summary>
      <ul>{(item.display?.scope ?? item.scope).map(scope => <li key={scope}>{scope}</li>)}</ul>
      {item.operation === "compare_regions" && <div style={{ overflowX: "auto" }}><table><thead><tr>{[t("researchResult.evidence.colArea"), t("researchResult.evidence.colRaw", { unit: String(item.units.value ?? t("researchResult.evidence.unitUnknown")) }), t("researchResult.evidence.colDifference"), t("researchResult.evidence.colRatio"), t("researchResult.evidence.colNormalized"), t("researchResult.evidence.colStatus")].map(label => <th key={label}>{label}</th>)}</tr></thead><tbody>{item.rows.map((row, rowIndex) => <tr key={rowIndex}>{[row.area_name ?? row.area_code, row.value, row.absoluteDifference, row.ratio, row.normalizedValue, [row.comparison_status, ...(row.normalization_status === "not_requested" ? [] : [row.normalization_status])].map(statusText).join(t("researchResult.sep.list"))].map((value, column) => <td key={column}>{valueText(value)}</td>)}</tr>)}</tbody></table><p>{t("researchResult.evidence.formulaNote")}{item.units.normalizedValue ? t("researchResult.evidence.normalizedUnit", { unit: String(item.units.normalizedValue) }) : t("researchResult.evidence.noNormalization")}</p></div>}
      {item.sources.length > 0 && <details><summary>{t("researchResult.evidence.sources")}</summary><p>{(item.display?.sources ?? item.sources).join(t("researchResult.sep.list"))}</p><small>{t("researchResult.evidence.resultId", { id: item.resultId ?? "" })}</small></details>}
    </details>)}
  </section>;
}

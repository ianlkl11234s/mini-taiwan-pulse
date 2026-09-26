import type { ResearchEvidence } from "./researchEvidence";
const number = new Intl.NumberFormat("zh-TW", { maximumFractionDigits: 4 });
const labels: Record<string, string> = { observed: "有觀測值", valid: "可比較", missing: "缺資料", suppressed: "數值受抑制", not_reported: "未報告", baseline_missing: "基準缺資料", baseline_suppressed: "基準受抑制", baseline_not_reported: "基準未報告", baseline_zero: "基準為零，無法計算比值", not_requested: "未要求標準化", denominator_missing: "分母缺資料", denominator_suppressed: "分母受抑制", denominator_not_reported: "分母未報告", zero_denominator: "分母為零" };
const operations: Record<string, string> = { compare_regions: "區域比較", query_records: "來源資料", spatial_query: "空間篩選", aggregate_by_area: "依區域計數", create_analysis_scope: "直線分析範圍", import_warehouse_result: "分析倉庫結果", walking_isochrone: "步行可達範圍", route_distance: "步行距離" };
const valueText = (value: unknown): string => value === null || value === undefined ? "—" : typeof value === "number" ? number.format(value) : String(value);
export function ResearchEvidencePanel({ evidence }: { evidence: readonly ResearchEvidence[] }) {
  if (!evidence.length) return null;
  return <section className="agent-analysis-results" aria-label="分析範圍與證據">
    <h3>分析範圍與證據</h3>
    {evidence.map((item, index) => <details key={`${item.resultId}:${index}`} open={index === 0}>
      <summary>{operations[item.operation] ?? item.operation}{item.operation === "compare_regions" ? ` · ${item.rows.map(row => row.area_name ?? row.area_code).join("／")}` : ""}</summary>
      <ul>{item.scope.map(scope => <li key={scope}>{scope}</li>)}</ul>
      {item.operation === "compare_regions" && <div style={{ overflowX: "auto" }}><table><thead><tr>{["區域", `原值（${item.units.value ?? "單位未知"}）`, "差值", "相對基準", "標準化值", "狀態"].map(label => <th key={label}>{label}</th>)}</tr></thead><tbody>{item.rows.map((row, rowIndex) => <tr key={rowIndex}>{[row.area_name ?? row.area_code, row.value, row.absoluteDifference, row.ratio, row.normalizedValue, [row.comparison_status, ...(row.normalization_status === "not_requested" ? [] : [row.normalization_status])].map(status => labels[String(status)] ?? status).join("；")].map((value, column) => <td key={column}>{valueText(value)}</td>)}</tr>)}</tbody></table><p>差值＝本區－基準；相對基準＝本區÷基準。{item.units.normalizedValue ? `標準化單位：${item.units.normalizedValue}` : "未另外計算人口標準化。"}</p></div>}
      {item.sources.length > 0 && <details><summary>來源與版本</summary><p>{item.sources.join("；")}</p><small>結果識別：{item.resultId}</small></details>}
    </details>)}
  </section>;
}

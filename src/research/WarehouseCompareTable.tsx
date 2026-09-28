import { classifyVizNumberKind, formatVizNumber } from "./vizFormat";
import type { WarehouseCompareColumn, WarehouseResultStyle } from "./warehouseResultStyle";

/** Same conservative unit/shape heuristic as warehouseStyleFact/researchResultPopup (spec U1). */
const fmt = (value: number, unit: string | null) => formatVizNumber(value, classifyVizNumberKind(value, unit));

/**
 * Field x point comparison table for a compare-styled warehouse result. Rows are metrics, columns are
 * the compared points (server-numbered 1..N); the highest value in a row is bold, a not-covered cell
 * (regional dataset with no data at that point) reads "未涵蓋" in muted grey rather than 0 or a blank.
 */
export function WarehouseCompareTableView({ table, onSelectColumn }: { table: Extract<WarehouseResultStyle, { kind: "compare" }>; onSelectColumn?: (column: WarehouseCompareColumn) => void }) {
  return <div className="agent-analysis-count-legend agent-compare-table" data-style-kind="compare">
    <span>多點比較</span>
    <table className="agent-compare-table__grid">
      <thead>
        <tr>
          <th scope="col" />
          {table.columns.map(column => <th scope="col" key={column.index}>
            {onSelectColumn ? <button type="button" className="agent-compare-table__column" onClick={() => onSelectColumn(column)}>{column.label}</button> : column.label}
          </th>)}
        </tr>
      </thead>
      <tbody>
        {table.rows.map(row => <tr key={row.field}>
          <th scope="row">{row.label}{row.unit ? `（${row.unit}）` : ""}</th>
          {row.cells.map((cell, index) => <td key={table.columns[index]!.index} className={cell.rank === 1 ? "agent-compare-table__best" : undefined}>
            {cell.notCovered ? <span className="agent-compare-table__muted">未涵蓋</span> : cell.value === null ? <span className="agent-compare-table__muted">–</span> : fmt(cell.value, row.unit)}
          </td>)}
        </tr>)}
      </tbody>
    </table>
  </div>;
}

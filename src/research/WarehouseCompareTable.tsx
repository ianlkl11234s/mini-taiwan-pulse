import { CompareTable, type CompareTableColumn } from "./charts/CompareTable";
import type { WarehouseCompareColumn, WarehouseResultStyle } from "./warehouseResultStyle";
import type { Theme } from "./vizSpec";

/**
 * Field x point comparison table for a compare-styled warehouse result (spec P2 = C1,
 * docs/features/viz-library/DECISIONS.md §6). Thin adapter over the shared `CompareTable` chart:
 * maps the MCP warehouse's server-numbered columns/ranked cells onto its generic props, and keeps the
 * click-through in `WarehouseCompareColumn` shape (callers fly the map to a clicked point's own
 * coordinates). The highest value in a row is bold (server `rank === 1`); a not-covered cell (regional
 * dataset with no data at that point) reads "未涵蓋", a covered-but-missing one reads "無資料" — never
 * 0 or a blank.
 */
export function WarehouseCompareTableView({ table, theme = "dark", onSelectColumn }: { table: Extract<WarehouseResultStyle, { kind: "compare" }>; theme?: Theme; onSelectColumn?: (column: WarehouseCompareColumn) => void }) {
  const columns: CompareTableColumn[] = table.columns.map(column => ({ id: String(column.index), label: column.label }));
  return <div className="agent-analysis-count-legend agent-compare-table" data-style-kind="compare">
    <span>多點比較</span>
    <CompareTable
      theme={theme}
      columns={columns}
      rows={table.rows.map(row => ({ id: row.field, label: row.label, unit: row.unit, cells: row.cells.map(cell => ({ value: cell.value, notCovered: cell.notCovered, rank: cell.rank })) }))}
      onSelectColumn={onSelectColumn ? columnId => {
        const column = table.columns.find(candidate => String(candidate.index) === columnId);
        if (column) onSelectColumn(column);
      } : undefined}
    />
  </div>;
}

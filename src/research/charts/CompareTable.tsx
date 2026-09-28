import { FONT_DATA } from "../../styles/designTokens";
import { classifyVizNumberKind, formatVizNumber } from "../vizFormat";
import { rampFor, type Theme } from "../vizSpec";

/**
 * Shared table chart (spec P2 = C1, docs/features/viz-library/DECISIONS.md §6): a field x point
 * comparison table with a proportional mini-bar under each numeric cell. Keeps the existing
 * `.agent-compare-table__*` class names (styled in mainMapConnection.css) so this stays a drop-in
 * replacement for the plain table it grew out of (WarehouseCompareTable.tsx) — only the mini-bar is
 * new markup.
 *
 * `rank` (1 = best) drives the bold "best" cell and is caller-supplied, never inferred here — a
 * metric's own "better" direction (e.g. lower rent is better) can differ from "largest raw value",
 * and only the caller's domain knows which. The mini-bar's length/colour is a plain magnitude visual
 * instead (spec: "該列最大者用最高級色") and deliberately does not try to encode that direction.
 */
export type CompareTableCell = { value: number | null; notCovered: boolean; rank: number | null };
export type CompareTableRow = { id: string; label: string; unit: string | null; cells: readonly CompareTableCell[] };
export type CompareTableColumn = { id: string; label: string };

export interface CompareTableProps {
  columns: readonly CompareTableColumn[];
  rows: readonly CompareTableRow[];
  theme: Theme;
  onSelectColumn?: (columnId: string) => void;
}

const MINIBAR_RAMP = "blue";

/** Row-relative ramp colour per cell: the row's own largest usable value gets the ramp's highest
 *  (last) stop, others scale down proportionally; a not-covered/missing cell gets no colour. */
function minibarColors(cells: readonly CompareTableCell[], colors: readonly string[]): (string | null)[] {
  const usable = cells.map(cell => cell.notCovered || cell.value === null ? null : cell.value);
  const finite = usable.filter((value): value is number => value !== null);
  if (!finite.length) return usable.map(() => null);
  const max = Math.max(...finite);
  const min = Math.min(0, ...finite);
  const span = max - min || 1;
  return usable.map(value => value === null ? null : colors[Math.round(((value - min) / span) * (colors.length - 1))] ?? colors[colors.length - 1]!);
}

function minibarFraction(value: number | null, rowMax: number): number {
  return value === null || rowMax <= 0 ? 0 : Math.max(0, Math.min(1, value / rowMax));
}

export function CompareTable({ columns, rows, theme, onSelectColumn }: CompareTableProps) {
  const colors = rampFor(MINIBAR_RAMP, theme);
  return (
    <table className="agent-compare-table__grid" aria-label={`多點比較表格，${columns.length} 欄，${rows.length} 列`}>
      <thead>
        <tr>
          <th scope="col" />
          {columns.map(column => (
            <th scope="col" key={column.id}>
              {onSelectColumn
                ? <button type="button" className="agent-compare-table__column" onClick={() => onSelectColumn(column.id)}>{column.label}</button>
                : column.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map(row => {
          const levels = minibarColors(row.cells, colors);
          const rowMax = Math.max(0, ...row.cells.map(cell => cell.notCovered || cell.value === null ? 0 : cell.value));
          return (
            <tr key={row.id}>
              <th scope="row">{row.label}{row.unit ? `（${row.unit}）` : ""}</th>
              {row.cells.map((cell, index) => (
                <td key={columns[index]?.id ?? index} className={cell.rank === 1 ? "agent-compare-table__best" : undefined}>
                  {cell.notCovered
                    ? <span className="agent-compare-table__muted">未涵蓋</span>
                    : cell.value === null
                      ? <span className="agent-compare-table__muted">無資料</span>
                      : <>
                        <span style={{ fontFamily: FONT_DATA, fontVariantNumeric: "tabular-nums" }}>{formatVizNumber(cell.value, classifyVizNumberKind(cell.value, row.unit))}</span>
                        <span className="agent-compare-table__minibar" aria-hidden="true">
                          <i style={{ width: `${Math.round(minibarFraction(cell.value, rowMax) * 100)}%`, background: levels[index] ?? undefined }} />
                        </span>
                      </>}
                </td>
              ))}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

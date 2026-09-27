import { FONT_DATA } from "../styles/designTokens";
import { formatVizNumber } from "./vizFormat";
import type { WarehouseLegendNullEntry, WarehouseStyleLegend } from "./warehouseResultStyle";

/** Numeric ticks (breaks, not labels/units) use the data font with tabular figures (spec §5). */
const DATA_NUM_STYLE = { fontFamily: FONT_DATA, fontVariantNumeric: "tabular-nums" as const };

/** A hatch null entry (choropleth `nullStyle: "hatch"`) shows its CSS gradient sample instead of a
 *  flat colour swatch, matching the transparent-background diagonal pattern drawn on the map. */
function NullSwatch({ entry }: { entry: WarehouseLegendNullEntry }) {
  return <i style={entry.hatch ? { backgroundImage: entry.gradient, backgroundColor: "transparent" } : { backgroundColor: entry.color }} aria-hidden="true" />;
}

/** Legend for server-styled warehouse results: colour bar + breaks, 3x3 grid + axes, or density ramp. */
export function WarehouseStyleLegendView({ legend }: { legend: WarehouseStyleLegend }) {
  const empty = legend.nullEntry && <span className="agent-style-legend__null"><NullSwatch entry={legend.nullEntry} />{legend.nullEntry.label}</span>;
  if (legend.kind === "choropleth") {
    return <div className="agent-analysis-count-legend agent-style-legend" data-style-kind="choropleth">
      <span>{legend.title} · {legend.method}</span>
      <div className="agent-style-legend__bar" aria-hidden="true">{legend.entries.map(entry => <b key={entry.label} style={{ backgroundColor: entry.color }} />)}</div>
      <div className="agent-style-legend__breaks">{legend.breaks.map(value => <small key={value} style={DATA_NUM_STYLE}>{formatVizNumber(value, "ratio")}</small>)}</div>
      <div>{legend.entries.map(entry => <span key={entry.label}><i style={{ backgroundColor: entry.color }} aria-hidden="true" />{entry.label}</span>)}{empty}</div>
    </div>;
  }
  if (legend.kind === "bivariate") {
    // Row 0 is the high y tier so "high y" sits at the top of the grid.
    const rows = [3, 2, 1].map(y => [1, 2, 3].map(x => legend.cells.find(cell => cell.x === x && cell.y === y)!));
    return <div className="agent-analysis-count-legend agent-style-legend" data-style-kind="bivariate">
      <span>{legend.xLabel} × {legend.yLabel} · 各三分位</span>
      <div className="agent-style-legend__bivariate">
        <small className="agent-style-legend__y">↑ {legend.yLabel}</small>
        <div className="agent-style-legend__grid" role="img" aria-label={`雙變量圖例：橫軸 ${legend.xLabel}、縱軸 ${legend.yLabel}，各分低中高三級`}>
          {rows.flat().map(cell => <b key={cell.cls} title={cell.cls} style={{ backgroundColor: cell.color }} />)}
        </div>
        <small className="agent-style-legend__x">{legend.xLabel} →</small>
      </div>
      <div>{empty}</div>
    </div>;
  }
  return <div className="agent-analysis-count-legend agent-style-legend" data-style-kind="heatmap">
    <span>{legend.title}</span>
    <div className="agent-style-legend__bar" style={{ backgroundImage: legend.gradient }} aria-hidden="true" />
    <div className="agent-style-legend__breaks"><small>稀疏</small><small>密集</small></div>
    <small>{legend.note}</small>
    {empty && <div>{empty}</div>}
  </div>;
}

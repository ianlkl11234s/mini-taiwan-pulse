import type { WarehouseStyleLegend } from "./warehouseResultStyle";

const fmt = (value: number) => new Intl.NumberFormat("zh-TW", { maximumFractionDigits: 2 }).format(value);

/** Legend for server-styled warehouse results: colour bar + breaks, 3x3 grid + axes, or density ramp. */
export function WarehouseStyleLegendView({ legend }: { legend: WarehouseStyleLegend }) {
  const empty = legend.nullEntry && <span className="agent-style-legend__null"><i style={{ backgroundColor: legend.nullEntry.color }} aria-hidden="true" />{legend.nullEntry.label}</span>;
  if (legend.kind === "choropleth") {
    return <div className="agent-analysis-count-legend agent-style-legend" data-style-kind="choropleth">
      <span>{legend.title} · {legend.method}</span>
      <div className="agent-style-legend__bar" aria-hidden="true">{legend.entries.map(entry => <b key={entry.label} style={{ backgroundColor: entry.color }} />)}</div>
      <div className="agent-style-legend__breaks">{legend.breaks.map(value => <small key={value}>{fmt(value)}</small>)}</div>
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

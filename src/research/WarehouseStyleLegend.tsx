import { FONT_DATA } from "../styles/designTokens";
import { formatVizNumber } from "./vizFormat";
import type { WarehouseLegendNullEntry, WarehouseSizeLegendEntry, WarehouseStyleLegend } from "./warehouseResultStyle";

/** Numeric ticks (breaks, not labels/units) use the data font with tabular figures (spec §5). */
const DATA_NUM_STYLE = { fontFamily: FONT_DATA, fontVariantNumeric: "tabular-nums" as const };

/** A hatch null entry (choropleth/bivariate `nullStyle: "hatch"`) shows its CSS gradient sample
 *  instead of a flat colour swatch, matching the transparent-background diagonal pattern drawn on
 *  the map. */
function NullSwatch({ entry }: { entry: WarehouseLegendNullEntry }) {
  return <i style={entry.hatch ? { backgroundImage: entry.gradient, backgroundColor: "transparent" } : { backgroundColor: entry.color }} aria-hidden="true" />;
}

/** Three reference circles (proportional's server-computed `sizeLegend`, or bivariate's picks from
 *  its own actually-drawn rows) nested bottom-aligned, largest at the back. */
function SizeLegendCircles({ entries }: { entries: WarehouseSizeLegendEntry[] }) {
  if (!entries.length) return null;
  const maxRadius = Math.max(...entries.map(entry => entry.radiusPx));
  const size = maxRadius * 2 + 4;
  const sorted = [...entries].sort((a, b) => b.radiusPx - a.radiusPx);
  return <div className="agent-style-legend__size">
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="大小圖例">
      {sorted.map(entry => <circle key={entry.value} cx={size / 2} cy={size - 2 - entry.radiusPx} r={entry.radiusPx} fill="none" stroke="currentColor" strokeWidth={1} />)}
    </svg>
    <div className="agent-style-legend__size-labels">{sorted.map(entry => <small key={entry.value} style={DATA_NUM_STYLE}>{entry.label}</small>)}</div>
  </div>;
}

/** G2 精簡版: only the title and the colour bar (no breaks, classes, null entry or size circles). */
function CompactStyleLegend({ legend }: { legend: WarehouseStyleLegend }) {
  const title = legend.kind === "bivariate" ? `填色：${legend.xLabel} · 大小：${legend.yLabel}` : legend.kind === "proportional" ? legend.colorLegend?.title ?? legend.sizeLabel : legend.title;
  const entries = legend.kind === "bivariate" ? legend.fillEntries : legend.kind === "proportional" ? legend.colorLegend?.entries ?? [] : legend.kind === "heatmap" ? [] : legend.entries;
  return <div className="agent-analysis-count-legend agent-style-legend agent-style-legend--compact" data-style-kind={legend.kind}>
    <span>{title}</span>
    {legend.kind === "heatmap"
      ? <div className="agent-style-legend__bar" style={{ backgroundImage: legend.gradient }} aria-hidden="true" />
      : entries.length > 0 && <div className="agent-style-legend__bar" aria-hidden="true">{entries.map(entry => <b key={entry.label} style={{ backgroundColor: entry.color }} />)}</div>}
  </div>;
}

/** Legend for server-styled warehouse results: colour bar + breaks, fill + size bubbles (bivariate
 *  V3), density ramp, or size circles + optional colour scale (proportional). */
export function WarehouseStyleLegendView({ legend, compact = false }: { legend: WarehouseStyleLegend; compact?: boolean }) {
  if (compact) return <CompactStyleLegend legend={legend} />;
  if (legend.kind === "choropleth") {
    const empty = <span className="agent-style-legend__null"><NullSwatch entry={legend.nullEntry} />{legend.nullEntry.label}</span>;
    return <div className="agent-analysis-count-legend agent-style-legend" data-style-kind="choropleth">
      <span>{legend.title} · {legend.method}</span>
      <div className="agent-style-legend__bar" aria-hidden="true">{legend.entries.map(entry => <b key={entry.label} style={{ backgroundColor: entry.color }} />)}</div>
      <div className="agent-style-legend__breaks">{legend.breaks.map(value => <small key={value} style={DATA_NUM_STYLE}>{formatVizNumber(value, "ratio")}</small>)}</div>
      <div>{legend.entries.map(entry => <span key={entry.label}><i style={{ backgroundColor: entry.color }} aria-hidden="true" />{entry.label}</span>)}{empty}</div>
    </div>;
  }
  if (legend.kind === "extrusion" || legend.kind === "grid") {
    const empty = <span className="agent-style-legend__null"><NullSwatch entry={legend.nullEntry} />{legend.nullEntry.label}</span>;
    return <div className="agent-analysis-count-legend agent-style-legend" data-style-kind={legend.kind}>
      <span>{legend.title} · {legend.method}</span>
      <div className="agent-style-legend__bar" aria-hidden="true">{legend.entries.map(entry => <b key={entry.label} style={{ backgroundColor: entry.color }} />)}</div>
      <div className="agent-style-legend__breaks">{legend.breaks.map(value => <small key={value} style={DATA_NUM_STYLE}>{formatVizNumber(value, "ratio")}</small>)}</div>
      <div>{legend.entries.map(entry => <span key={entry.label}><i style={{ backgroundColor: entry.color }} aria-hidden="true" />{entry.label}</span>)}{empty}</div>
    </div>;
  }
  if (legend.kind === "flow") {
    const empty = <span className="agent-style-legend__null"><NullSwatch entry={legend.nullEntry} />{legend.nullEntry.label}</span>;
    return <div className="agent-analysis-count-legend agent-style-legend" data-style-kind="flow">
      <span>{legend.title}{legend.animate ? "" : "（流量較多，暫不啟用流動效果）"}</span>
      <div className="agent-style-legend__bar" aria-hidden="true">{legend.entries.map(entry => <b key={entry.label} style={{ backgroundColor: entry.color }} />)}</div>
      <div className="agent-style-legend__breaks">{legend.breaks.map(value => <small key={value} style={DATA_NUM_STYLE}>{formatVizNumber(value, "ratio")}</small>)}</div>
      <div>{legend.entries.map(entry => <span key={entry.label}><i style={{ backgroundColor: entry.color }} aria-hidden="true" />{entry.label}</span>)}{empty}</div>
    </div>;
  }
  if (legend.kind === "isochrone") {
    return <div className="agent-analysis-count-legend agent-style-legend" data-style-kind="isochrone">
      <span>{legend.title}</span>
      <div>{legend.entries.map(entry => <span key={entry.label}><i style={{ backgroundColor: entry.color }} aria-hidden="true" />{entry.label}</span>)}</div>
    </div>;
  }
  if (legend.kind === "bivariate") {
    const empty = <span className="agent-style-legend__null"><NullSwatch entry={legend.nullEntry} />{legend.nullEntry.label}</span>;
    return <div className="agent-analysis-count-legend agent-style-legend" data-style-kind="bivariate">
      <span>填色：{legend.xLabel} · 大小：{legend.yLabel}</span>
      <div className="agent-style-legend__bar" aria-hidden="true">{legend.fillEntries.map(entry => <b key={entry.label} style={{ backgroundColor: entry.color }} />)}</div>
      <div className="agent-style-legend__breaks">{legend.fillBreaks.map(value => <small key={value} style={DATA_NUM_STYLE}>{formatVizNumber(value, "ratio")}</small>)}</div>
      <div>{legend.fillEntries.map(entry => <span key={entry.label}><i style={{ backgroundColor: entry.color }} aria-hidden="true" />{entry.label}</span>)}{empty}</div>
      <SizeLegendCircles entries={legend.sizeLegend} />
    </div>;
  }
  if (legend.kind === "proportional") {
    return <div className="agent-analysis-count-legend agent-style-legend" data-style-kind="proportional">
      <span>{legend.sizeLabel}</span>
      <SizeLegendCircles entries={legend.sizeLegend} />
      {legend.colorLegend && <>
        <span>{legend.colorLegend.title}</span>
        <div className="agent-style-legend__bar" aria-hidden="true">{legend.colorLegend.entries.map(entry => <b key={entry.label} style={{ backgroundColor: entry.color }} />)}</div>
        <div>{legend.colorLegend.entries.map(entry => <span key={entry.label}><i style={{ backgroundColor: entry.color }} aria-hidden="true" />{entry.label}</span>)}
          <span><NullSwatch entry={legend.colorLegend.nullEntry} />{legend.colorLegend.nullEntry.label}</span>
        </div>
      </>}
      {legend.excludedNote && <small>{legend.excludedNote}</small>}
    </div>;
  }
  const empty = legend.nullEntry && <span className="agent-style-legend__null"><NullSwatch entry={legend.nullEntry} />{legend.nullEntry.label}</span>;
  return <div className="agent-analysis-count-legend agent-style-legend" data-style-kind="heatmap">
    <span>{legend.title}</span>
    <div className="agent-style-legend__bar" style={{ backgroundImage: legend.gradient }} aria-hidden="true" />
    <div className="agent-style-legend__breaks"><small>稀疏</small><small>密集</small></div>
    <small>{legend.note}</small>
    {empty && <div>{empty}</div>}
  </div>;
}

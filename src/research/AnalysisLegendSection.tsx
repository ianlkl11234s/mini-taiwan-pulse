// G1：「圖例」面板最上方的「分析結果」一組。G2：compact（停靠 popup 開著）時每筆只留標題＋色階條。
import { Slider } from "../components/controls/Slider";
import { WarehouseStyleLegendView } from "./WarehouseStyleLegend";
import type { AnalysisLegendEntry, AnalysisLegendPlayback } from "./analysisLegendStore";
import "./analysisLegend.css";

function Swatches({ entries }: { entries: readonly { label: string; color: string }[] }) {
  return <div>{entries.map(entry => <span key={entry.label}><i style={{ backgroundColor: entry.color }} aria-hidden="true" />{entry.label}</span>)}</div>;
}

function Bar({ colors }: { colors: readonly string[] }) {
  return <div className="agent-style-legend__bar" aria-hidden="true">{colors.map((color, index) => <b key={`${index}:${color}`} style={{ backgroundColor: color }} />)}</div>;
}

/** T2 A2: 分析結果自帶播放列（圖例上方），只控制該結果、不動全站時間軸（spec
 *  docs/features/viz-library/DECISIONS.md §6）。播放／暫停鈕＋目前期別文字＋可拖曳軌道；
 *  單期（periods.length <= 1）時停用播放鈕（沒有可播的東西）。 */
function PlaybackBar({ playback }: { playback: AnalysisLegendPlayback }) {
  const { periods, index, playing, onToggle, onScrub } = playback;
  const maxIndex = Math.max(0, periods.length - 1);
  const clampedIndex = Math.min(Math.max(0, index), maxIndex);
  const period = periods[clampedIndex] ?? "";
  return <div className="analysis-legend-group__playback">
    <button type="button" className="analysis-legend-group__playback-toggle" onClick={onToggle} aria-pressed={playing} disabled={periods.length <= 1}>
      {playing ? "暫停" : "播放"}
    </button>
    <Slider ariaLabel="播放期別" min={0} max={maxIndex} step={1} value={clampedIndex} onChange={onScrub} ariaValueText={period} disabled={periods.length <= 1} className="analysis-legend-group__playback-slider" />
    <span className="analysis-legend-group__playback-period">{period}</span>
  </div>;
}

function EntryLegend({ entry, compact }: { entry: AnalysisLegendEntry; compact: boolean }) {
  const numeric = entry.numericLegend;
  const count = entry.countLegend;
  return <>
    {entry.playback && <PlaybackBar playback={entry.playback} />}
    {entry.styleLegend && <WarehouseStyleLegendView legend={entry.styleLegend} compact={compact} />}
    {numeric && <div className="agent-analysis-count-legend">
      <span>{numeric.label}{compact ? "" : ` · ${numeric.method === "single_value" ? "單一數值" : "本次結果等距分級"}`}</span>
      {compact ? <Bar colors={numeric.entries.filter(item => !item.status).map(item => item.color)} /> : <Swatches entries={numeric.entries} />}
    </div>}
    {count && <div className="agent-analysis-count-legend">
      <span>{count.label} · {count.radiusM.toLocaleString("zh-TW")} 公尺內</span>
      {compact ? <Bar colors={count.entries.map(item => item.color)} /> : <Swatches entries={count.entries} />}
    </div>}
    {entry.scopeRing && !compact && <p className="agent-analysis-scope-legend"><i aria-hidden="true" />分析範圍（虛線）{entry.scopeRing.radiusM != null ? ` · 半徑 ${entry.scopeRing.radiusM.toLocaleString("zh-TW")} 公尺` : ""}</p>}
  </>;
}

export function AnalysisLegendSection({ entries, compact, isDark }: { entries: readonly AnalysisLegendEntry[]; compact: boolean; isDark: boolean }) {
  if (!entries.length) return null;
  return <section className={`analysis-legend-group${isDark ? "" : " analysis-legend-group--light"}`} aria-label="分析結果圖例" data-compact={compact || undefined}>
    <h4 className="analysis-legend-group__heading">分析結果</h4>
    {entries.map(entry => <div key={entry.resultId} className="analysis-legend-group__entry">
      <strong className="analysis-legend-group__title">{entry.title}</strong>
      <EntryLegend entry={entry} compact={compact} />
      {!compact && <small className="analysis-legend-group__source">來源 · {entry.source ?? "來源資訊待補"}</small>}
    </div>)}
  </section>;
}

import { useEffect, useState } from "react";
import { fetchHistoricalFlightManifest } from "../../data/historicalFlightTrailsLoader";
import { HISTORICAL_FLIGHT_ALL_AIRPORTS, type HistoricalFlightCountry, type HistoricalFlightManifest } from "../../data/historicalFlightTrailsTypes";
import {
  requestHistoricalFlightFocus, retryHistoricalFlightSelection,
  setHistoricalFlightSelection, useHistoricalFlightRetryRevision,
  useHistoricalFlightSelection, useHistoricalFlightStatus,
} from "../../state/historicalFlightTrailsStore";

function numberText(value: number | undefined): string {
  return value == null ? "未提供" : new Intl.NumberFormat("zh-TW").format(value);
}

export function HistoricalFlightTrailControls({ country, isDarkTheme }: { country: HistoricalFlightCountry; isDarkTheme: boolean }) {
  const [manifest, setManifest] = useState<HistoricalFlightManifest | null>(null);
  const [error, setError] = useState("");
  const selection = useHistoricalFlightSelection(country);
  const status = useHistoricalFlightStatus(country);
  const retryRevision = useHistoricalFlightRetryRevision(country);

  useEffect(() => {
    let cancelled = false;
    fetchHistoricalFlightManifest()
      .then((result) => { if (!cancelled) { setManifest(result); setError(""); } })
      .catch((reason: unknown) => { if (!cancelled) setError(reason instanceof Error ? reason.message : "無法讀取樣本目錄"); });
    return () => { cancelled = true; };
  }, [retryRevision]);

  const airports = manifest?.airports.filter((airport) => airport.country === country) ?? [];
  const countrySamples = manifest?.samples.filter((sample) => sample.country === country) ?? [];
  const samples = selection.airport === HISTORICAL_FLIGHT_ALL_AIRPORTS
    ? Array.from(new Map(countrySamples.map((sample) => [sample.date, sample])).values())
    : countrySamples.filter((sample) => sample.airport === selection.airport);
  const selected = samples.find((sample) => sample.date === selection.date);
  const selectedCountrySamples = selection.airport === HISTORICAL_FLIGHT_ALL_AIRPORTS
    ? countrySamples.filter((sample) => sample.date === selection.date)
    : [];
  const aggregateForDate = (date: string) => {
    const dateSamples = countrySamples.filter((sample) => sample.date === date);
    return {
      availableAirportCount: new Set(dateSamples.filter((sample) => sample.asset).map((sample) => sample.airport)).size,
      unavailableAirportCount: new Set(dateSamples.filter((sample) => !sample.asset).map((sample) => sample.airport)).size,
      combinedPointCount: dateSamples.reduce((total, sample) => total + (sample.asset ? sample.point_count : 0), 0),
    };
  };
  const selectedAggregate = aggregateForDate(selection.date);
  const color = isDarkTheme ? "rgba(255,255,255,0.72)" : "rgba(0,0,0,0.65)";
  const inputStyle = { width: "100%", marginTop: 3, fontSize: 11, borderRadius: 4, padding: "3px 5px", color, background: isDarkTheme ? "rgba(0,0,0,0.25)" : "rgba(255,255,255,0.7)", border: `1px solid ${isDarkTheme ? "rgba(255,255,255,0.16)" : "rgba(0,0,0,0.14)"}` };

  return (
    <div style={{ margin: "6px 12px 2px", fontSize: 11, color }}>
      <div style={{ marginBottom: 6 }}>3D 航跡 · 觀測點依序連線，資料空白區間以直線連接。</div>
      <label>機場
        <select aria-label="歷史航班機場" value={selection.airport} onChange={(event) => setHistoricalFlightSelection(country, { airport: event.target.value, date: selection.date })} style={inputStyle}>
          <option value={HISTORICAL_FLIGHT_ALL_AIRPORTS}>全部機場</option>
          {airports.map((airport) => <option key={airport.icao} value={airport.icao}>{airport.name}（{airport.iata || airport.icao}／{airport.icao}）</option>)}
        </select>
      </label>
      <label style={{ display: "block", marginTop: 6 }}>樣本日期
        <select aria-label="歷史航班樣本日期" value={selection.date} onChange={(event) => setHistoricalFlightSelection(country, { airport: selection.airport, date: event.target.value })} style={inputStyle}>
          <option value={selection.date}>{selection.date}{selected ? "" : `（${selection.airport === HISTORICAL_FLIGHT_ALL_AIRPORTS ? "全部機場" : "此機場"}無此樣本／unavailable）`}</option>
          {samples.filter((sample) => sample.date !== selection.date).map((sample) => <option key={sample.date} value={sample.date}>{sample.date} · {selection.airport === HISTORICAL_FLIGHT_ALL_AIRPORTS ? `可用機場 ${aggregateForDate(sample.date).availableAirportCount} 座` : sample.label}</option>)}
        </select>
      </label>
      {error && <div style={{ marginTop: 5, color: "#ef5350" }}>{error}</div>}
      {selection.airport === HISTORICAL_FLIGHT_ALL_AIRPORTS && selectedCountrySamples.length > 0 && <div style={{ marginTop: 6, lineHeight: 1.45 }}>
        <div>全部機場 · {selection.date}</div>
        <div>可用機場 {selectedAggregate.availableAirportCount} 座 · 各機場點位合計 {numberText(selectedAggregate.combinedPointCount)}</div>
        {selectedAggregate.unavailableAirportCount > 0 && <div>{selectedAggregate.unavailableAirportCount} 座機場此日沒有可用樣本，未計入合計。</div>}
      </div>}
      {selection.airport !== HISTORICAL_FLIGHT_ALL_AIRPORTS && selected && <div style={{ marginTop: 6, lineHeight: 1.45 }}>
        <div>{selected.label} · {selected.date}</div>
        <div>{selected.coverage === "partial" ? "部分涵蓋（partial）" : "樣本不可用（unavailable）"} · 已收錄航班 {numberText(selected.flight_count)} · 點位 {numberText(selected.point_count)}</div>
        {selected.note && <div>{selected.note}</div>}
      </div>}
      {selection.airport !== HISTORICAL_FLIGHT_ALL_AIRPORTS && !selected && <div style={{ marginTop: 6, lineHeight: 1.45 }}>此機場沒有 {selection.date} 的樣本（unavailable）。</div>}
      {status.state !== "idle" && <div style={{ marginTop: 5, color: status.state === "error" ? "#ef5350" : color }}>{status.message || (status.state === "loading" ? "載入航跡中" : "")}{status.count != null ? ` · ${numberText(status.count)} 航班` : ""}</div>}
      <div style={{ display: "flex", gap: 5, marginTop: 6 }}>
        <button type="button" onClick={() => requestHistoricalFlightFocus(country)} style={{ fontSize: 11, cursor: "pointer" }}>{selection.airport === HISTORICAL_FLIGHT_ALL_AIRPORTS ? "查看全部機場" : "定位機場"}</button>
        {status.state === "error" && <button type="button" onClick={() => retryHistoricalFlightSelection(country)} style={{ fontSize: 11, cursor: "pointer" }}>重試</button>}
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { fetchHistoricalFlightManifest } from "../../data/historicalFlightTrailsLoader";
import { HISTORICAL_FLIGHT_ALL_AIRPORTS, type HistoricalFlightCountry, type HistoricalFlightManifest } from "../../data/historicalFlightTrailsTypes";
import {
  requestHistoricalFlightFocus, retryHistoricalFlightSelection,
  setHistoricalFlightSelection, useHistoricalFlightRetryRevision,
  useHistoricalFlightSelection, useHistoricalFlightStatus,
} from "../../state/historicalFlightTrailsStore";
import { useLocale } from "../../state/localeStore";


export function HistoricalFlightTrailControls({ country, isDarkTheme }: { country: HistoricalFlightCountry; isDarkTheme: boolean }) {
  const { t, formatNumber } = useLocale();
  const numberText = (value: number | undefined): string => (value == null ? t("paramsPanel.hf.notProvided") : formatNumber(value));
  const [manifest, setManifest] = useState<HistoricalFlightManifest | null>(null);
  // null = 無錯誤；{ message: undefined } = 非 Error 的失敗（render 時才翻譯預設訊息，切語系會跟著變）
  const [error, setError] = useState<{ message?: string } | null>(null);
  const selection = useHistoricalFlightSelection(country);
  const status = useHistoricalFlightStatus(country);
  const retryRevision = useHistoricalFlightRetryRevision(country);

  useEffect(() => {
    let cancelled = false;
    fetchHistoricalFlightManifest()
      .then((result) => { if (!cancelled) { setManifest(result); setError(null); } })
      .catch((reason: unknown) => { if (!cancelled) setError({ message: reason instanceof Error ? reason.message : undefined }); });
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
  // select／按鈕外觀交給共用 .lpc-*（layerParamControls.css；主題 class 在展開區容器上）
  const inputStyle = { marginTop: 3 };

  return (
    <div style={{ fontSize: 11, color }}>
      <div style={{ marginBottom: 6 }}>{t("paramsPanel.hf.intro")}</div>
      <label className="lpc-k" style={{ display: "block" }}>{t("paramsPanel.hf.airport")}
        <select className="lpc-select" aria-label={t("paramsPanel.hf.airportAria")} value={selection.airport} onChange={(event) => setHistoricalFlightSelection(country, { airport: event.target.value, date: selection.date })} style={inputStyle}>
          <option value={HISTORICAL_FLIGHT_ALL_AIRPORTS}>{t("paramsPanel.hf.allAirports")}</option>
          {airports.map((airport) => <option key={airport.icao} value={airport.icao}>{airport.name}（{airport.iata || airport.icao}／{airport.icao}）</option>)}
        </select>
      </label>
      <label className="lpc-k" style={{ display: "block", marginTop: 6 }}>{t("paramsPanel.hf.sampleDate")}
        <select className="lpc-select" aria-label={t("paramsPanel.hf.sampleDateAria")} value={selection.date} onChange={(event) => setHistoricalFlightSelection(country, { airport: selection.airport, date: event.target.value })} style={inputStyle}>
          <option value={selection.date}>{selection.date}{selected ? "" : t(selection.airport === HISTORICAL_FLIGHT_ALL_AIRPORTS ? "paramsPanel.hf.noSampleAll" : "paramsPanel.hf.noSampleThis")}</option>
          {samples.filter((sample) => sample.date !== selection.date).map((sample) => <option key={sample.date} value={sample.date}>{sample.date} · {selection.airport === HISTORICAL_FLIGHT_ALL_AIRPORTS ? t("paramsPanel.hf.availableAirports", { count: aggregateForDate(sample.date).availableAirportCount }) : sample.label}</option>)}
        </select>
      </label>
      {error && <div style={{ marginTop: 5, color: "#ef5350" }}>{error.message ?? t("paramsPanel.hf.manifestError")}</div>}
      {selection.airport === HISTORICAL_FLIGHT_ALL_AIRPORTS && selectedCountrySamples.length > 0 && <div style={{ marginTop: 6, lineHeight: 1.45 }}>
        <div>{t("paramsPanel.hf.allAirportsDate", { date: selection.date })}</div>
        <div>{t("paramsPanel.hf.summary", { available: selectedAggregate.availableAirportCount, points: numberText(selectedAggregate.combinedPointCount) })}</div>
        {selectedAggregate.unavailableAirportCount > 0 && <div>{t("paramsPanel.hf.unavailableAirports", { count: selectedAggregate.unavailableAirportCount })}</div>}
      </div>}
      {selection.airport !== HISTORICAL_FLIGHT_ALL_AIRPORTS && selected && <div style={{ marginTop: 6, lineHeight: 1.45 }}>
        <div>{selected.label} · {selected.date}</div>
        <div>{t("paramsPanel.hf.detail", { coverage: t(selected.coverage === "partial" ? "paramsPanel.hf.partial" : "paramsPanel.hf.sampleUnavailable"), flights: numberText(selected.flight_count), points: numberText(selected.point_count) })}</div>
        {selected.note && <div>{selected.note}</div>}
      </div>}
      {selection.airport !== HISTORICAL_FLIGHT_ALL_AIRPORTS && !selected && <div style={{ marginTop: 6, lineHeight: 1.45 }}>{t("paramsPanel.hf.noSample", { date: selection.date })}</div>}
      {status.state !== "idle" && <div style={{ marginTop: 5, color: status.state === "error" ? "#ef5350" : color }}>{status.message || (status.state === "loading" ? t("paramsPanel.hf.loadingTrails") : "")}{status.count != null ? t("paramsPanel.hf.statusFlights", { flights: numberText(status.count) }) : ""}</div>}
      <div style={{ display: "flex", gap: 5, marginTop: 6 }}>
        <button type="button" className="lpc-btn" onClick={() => requestHistoricalFlightFocus(country)}>{selection.airport === HISTORICAL_FLIGHT_ALL_AIRPORTS ? t("paramsPanel.hf.viewAll") : t("paramsPanel.hf.locate")}</button>
        {status.state === "error" && <button type="button" className="lpc-btn" onClick={() => retryHistoricalFlightSelection(country)}>{t("paramsPanel.retry")}</button>}
      </div>
    </div>
  );
}

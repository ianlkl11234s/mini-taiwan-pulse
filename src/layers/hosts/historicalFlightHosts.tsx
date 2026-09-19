import { useEffect } from "react";
import { fetchHistoricalFlightManifest } from "../../data/historicalFlightTrailsLoader";
import { HISTORICAL_FLIGHT_ALL_AIRPORTS } from "../../data/historicalFlightTrailsTypes";
import { useHistoricalFlightTrailsLayer } from "../../hooks/useHistoricalFlightTrailsLayer";
import { setHistoricalFlightStatus, useHistoricalFlightFocusRequest, useHistoricalFlightSelection } from "../../state/historicalFlightTrailsStore";
import { bumpHostRender, type LayerHostComponent } from "../layerHostDeps";
import { useKeyOverlayParams } from "../layerParamsAccess";

const directions = ["all", "departure", "arrival"] as const;
const routeScopes = ["all", "domestic", "cross_border", "unknown"] as const;
const countryOverviews = {
  TW: { center: [120.9, 23.7] as [number, number], zoom: 5.5 },
  JP: { center: [138, 37] as [number, number], zoom: 4.2 },
};

/** 台灣與日本樣本共用 loader / hook，source ID 由 country 固定派生。 */
export const HistoricalFlightTrailsHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useHistoricalFlightTrailsLayer");
  const tw = useKeyOverlayParams("historicalFlightTrails");
  const jp = useKeyOverlayParams("jpHistoricalFlightTrails");
  const twSelection = useHistoricalFlightSelection("TW");
  const jpSelection = useHistoricalFlightSelection("JP");
  const twFocusRequest = useHistoricalFlightFocusRequest("TW");
  const jpFocusRequest = useHistoricalFlightFocusRequest("JP");
  useHistoricalFlightTrailsLayer(deps.mapRef, deps.layerVisibility.historicalFlightTrails, "TW", {
    ...twSelection,
    opacity: tw.historicalFlightTrailsOpacity ?? 0.28,
    width: tw.historicalFlightTrailsWidth ?? 0.75,
    altitudeScale: tw.historicalFlightTrailsAltitudeScale ?? 3,
    direction: directions[tw.historicalFlightTrailsDirectionIdx ?? 0] ?? "all",
    routeScope: routeScopes[tw.historicalFlightTrailsRouteScopeIdx ?? 0] ?? "all",
  });
  useHistoricalFlightTrailsLayer(deps.mapRef, deps.layerVisibility.jpHistoricalFlightTrails, "JP", {
    ...jpSelection,
    opacity: jp.jpHistoricalFlightTrailsOpacity ?? 0.28,
    width: jp.jpHistoricalFlightTrailsWidth ?? 0.75,
    altitudeScale: jp.jpHistoricalFlightTrailsAltitudeScale ?? 3,
    direction: directions[jp.jpHistoricalFlightTrailsDirectionIdx ?? 0] ?? "all",
    routeScope: routeScopes[jp.jpHistoricalFlightTrailsRouteScopeIdx ?? 0] ?? "all",
  });
  useEffect(() => {
    if (twFocusRequest === 0) return;
    if (twSelection.airport === HISTORICAL_FLIGHT_ALL_AIRPORTS && deps.mapRef.current) {
      deps.mapRef.current.flyTo({ ...countryOverviews.TW, pitch: 45, duration: 700 });
      return;
    }
    let cancelled = false;
    void fetchHistoricalFlightManifest().then((manifest) => {
      const airport = manifest.airports.find((item) => item.country === "TW" && item.icao === twSelection.airport);
      if (!cancelled && airport && deps.mapRef.current) deps.mapRef.current.flyTo({ center: airport.center, zoom: 8, pitch: 60, duration: 700 });
    }).catch(() => { if (!cancelled) setHistoricalFlightStatus("TW", { state: "error", message: "無法讀取機場目錄，請重試。" }); });
    return () => { cancelled = true; };
  }, [deps.mapRef, twFocusRequest, twSelection.airport]);
  useEffect(() => {
    if (jpFocusRequest === 0) return;
    if (jpSelection.airport === HISTORICAL_FLIGHT_ALL_AIRPORTS && deps.mapRef.current) {
      deps.mapRef.current.flyTo({ ...countryOverviews.JP, pitch: 45, duration: 700 });
      return;
    }
    let cancelled = false;
    void fetchHistoricalFlightManifest().then((manifest) => {
      const airport = manifest.airports.find((item) => item.country === "JP" && item.icao === jpSelection.airport);
      if (!cancelled && airport && deps.mapRef.current) deps.mapRef.current.flyTo({ center: airport.center, zoom: 8, pitch: 60, duration: 700 });
    }).catch(() => { if (!cancelled) setHistoricalFlightStatus("JP", { state: "error", message: "無法讀取機場目錄，請重試。" }); });
    return () => { cancelled = true; };
  }, [deps.mapRef, jpFocusRequest, jpSelection.airport]);
  return null;
};

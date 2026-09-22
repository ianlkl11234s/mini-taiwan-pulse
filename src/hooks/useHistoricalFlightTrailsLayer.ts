import { useEffect, useState } from 'react';
import type { Map as MapboxMap } from 'mapbox-gl';
import { fetchHistoricalFlightAllAirports, fetchHistoricalFlightAsset, fetchHistoricalFlightManifest } from '../data/historicalFlightTrailsLoader';
import { HISTORICAL_FLIGHT_ALL_AIRPORTS, type HistoricalFlightCollection, type HistoricalFlightCountry, type HistoricalFlightParams } from '../data/historicalFlightTrailsTypes';
import { hideHistoricalFlightTrails, renderHistoricalFlightTrails, removeHistoricalFlightTrails } from '../map/historicalFlightTrails';
import { setHistoricalFlightStatus, useHistoricalFlightRetryRevision } from '../state/historicalFlightTrailsStore';
import { useMapReadyTick } from './useMapReadyTick';

/** Static airport/event-day data. Never subscribes to the realtime clock or database. */
export function useHistoricalFlightTrailsLayer(mapRef: React.RefObject<MapboxMap | null>, visible: boolean,
  country: HistoricalFlightCountry, params: HistoricalFlightParams) {
  const { airport, date, opacity, width, direction, routeScope, altitudeScale = 3 } = params;
  const selector = `${country}:${airport}:${date}`;
  const mapTick = useMapReadyTick(mapRef, visible);
  const retryRevision = useHistoricalFlightRetryRevision(country);
  const [loaded, setLoaded] = useState<{ selector: string; data: HistoricalFlightCollection } | null>(null);
  useEffect(() => {
    if (!visible) { setHistoricalFlightStatus(country, { state: 'idle', message: '' }); return; }
    let cancelled = false;
    setHistoricalFlightStatus(country, { state: 'loading', message: '正在載入完整解析度軌跡…' });
    void (async () => {
      const manifest = await fetchHistoricalFlightManifest();
      if (cancelled) return;
      if (airport === HISTORICAL_FLIGHT_ALL_AIRPORTS) {
        const result = await fetchHistoricalFlightAllAirports(manifest, country, date);
        if (cancelled) return;
        if (!result) {
          setLoaded(null);
          setHistoricalFlightStatus(country, { state: 'unavailable', message: `此日期全部 ${country === 'TW' ? '台灣' : '日本'}機場皆無可用軌跡。` });
          return;
        }
        setLoaded({ selector, data: result.data });
        setHistoricalFlightStatus(country, {
          state: 'ready',
          message: `${result.availableAirportCount}/${result.totalAirportCount} 機場可用 · 部分資料 · 原始解析度`,
          count: result.data.features.length,
        });
        return;
      }
      const sample = manifest.samples.find(item => item.country === country && item.airport === airport && item.date === date);
      if (!sample?.asset) {
        setLoaded(null);
        setHistoricalFlightStatus(country, { state: 'unavailable', message: sample?.note || '此機場日期尚無軌跡，請選其他代表日。' });
        return;
      }
      const data = await fetchHistoricalFlightAsset(sample.asset);
      if (cancelled) return;
      if (data.meta.country !== country || data.meta.airport !== airport || data.meta.date !== date
        || data.features.length !== sample.flight_count) throw new Error('歷史軌跡樣本與目錄不一致');
      setLoaded({ selector, data });
      setHistoricalFlightStatus(country, { state: 'ready', message: '部分資料 · 原始解析度', count: sample.flight_count });
    })().catch((error: unknown) => {
      if (cancelled) return;
      setLoaded(null);
      setHistoricalFlightStatus(country, { state: 'error', message: error instanceof Error ? error.message : '歷史軌跡載入失敗' });
    });
    // Shared cache promises are allowed to finish; stale selections can never overwrite the map.
    return () => { cancelled = true; };
  }, [visible, country, airport, date, selector, retryRevision]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    let drawing = false;
    const draw = () => {
      if (drawing) return;
      if (!visible) {
        // All Off must hide the existing custom layer immediately, even while
        // a basemap style transition prevents safe removal/disposal.
        hideHistoricalFlightTrails(map, country);
        if (map.isStyleLoaded()) removeHistoricalFlightTrails(map, country);
        return;
      }
      if (!map.isStyleLoaded()) return;
      drawing = true;
      try {
        if (!loaded || loaded.selector !== selector) { removeHistoricalFlightTrails(map, country); return; }
        renderHistoricalFlightTrails(map, country, loaded.data, { airport, date, opacity, width, direction, routeScope, altitudeScale });
      } finally { drawing = false; }
    };
    const layerId = `historical-flight-trails-${country.toLowerCase()}-3d`;
    const restore = () => {
      if (!drawing && visible && loaded
        && (!map.getLayer(layerId) || map.getLayoutProperty(layerId, 'visibility') === 'none')) draw();
    };
    draw();
    // setStyle's diff path can remove custom sources without a style.load event.
    map.on('styledata', restore);
    map.on('idle', restore);
    map.on('style.load', draw);
    return () => { map.off('styledata', restore); map.off('style.load', draw); map.off('idle', restore); };
  }, [mapRef, mapTick, visible, loaded, selector, country, airport, date, opacity, width, direction, routeScope, altitudeScale]);

  useEffect(() => {
    const map = mapRef.current;
    return () => { if (map) removeHistoricalFlightTrails(map, country); };
  }, [mapRef, mapTick, country]);
}

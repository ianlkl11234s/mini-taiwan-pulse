import type { Map as MapboxMap } from 'mapbox-gl';
import type { HistoricalFlightCollection, HistoricalFlightCountry, HistoricalFlightParams } from '../data/historicalFlightTrailsTypes';
import { createHistoricalFlightTrailsLayer } from './historicalFlightTrailsCustomLayer';

export function historicalFlightSourceId(country: HistoricalFlightCountry) { return `historical-flight-trails-${country.toLowerCase()}`; }
const active = new WeakMap<MapboxMap, Map<HistoricalFlightCountry, ReturnType<typeof createHistoricalFlightTrailsLayer>>>();
export function removeHistoricalFlightTrails(map: MapboxMap, country: HistoricalFlightCountry) {
  const id = `${historicalFlightSourceId(country)}-3d`;
  if (map.getStyle() && map.getLayer(id)) map.removeLayer(id);
  active.get(map)?.delete(country);
}
export function renderHistoricalFlightTrails(map: MapboxMap, country: HistoricalFlightCountry,
  data: HistoricalFlightCollection, params: HistoricalFlightParams) {
  const id = `${historicalFlightSourceId(country)}-3d`;
  let layers = active.get(map);
  if (!layers) { layers = new Map(); active.set(map, layers); }
  let layer = layers.get(country);
  if (!layer || !map.getLayer(id)) {
    layer = createHistoricalFlightTrailsLayer(country, data, params);
    layers.set(country, layer);
    map.addLayer(layer);
  } else {
    layer.setData(data);
    layer.setParams(params);
  }
  map.triggerRepaint();
}
export function pickHistoricalFlightTrail(map: MapboxMap, country: HistoricalFlightCountry,
  x: number, y: number, width: number, height: number) {
  if (!map.getLayer(`${historicalFlightSourceId(country)}-3d`)) return null;
  return active.get(map)?.get(country)?.pick(x, y, width, height) ?? null;
}

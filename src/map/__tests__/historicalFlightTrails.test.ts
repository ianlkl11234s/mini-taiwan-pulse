import { describe, expect, it, vi } from 'vitest';
import type { Map as MapboxMap } from 'mapbox-gl';
import type { HistoricalFlightCollection, HistoricalFlightParams } from '../../data/historicalFlightTrailsTypes';
vi.mock('../historicalFlightTrailsCustomLayer', () => ({ createHistoricalFlightTrailsLayer: (country: string) => ({
  id: `historical-flight-trails-${country.toLowerCase()}-3d`, type: 'custom', renderingMode: '3d',
  setData: vi.fn(), setParams: vi.fn(), pick: vi.fn(),
}) }));
import { renderHistoricalFlightTrails, removeHistoricalFlightTrails } from '../historicalFlightTrails';
describe('historical 3D lifecycle', () => {
  it('updates existing custom layer and recreates after style removal', () => {
    const layers = new Map();
    const map = { getStyle: () => ({}), getLayer: (id: string) => layers.get(id),
      addLayer: vi.fn((layer) => layers.set(layer.id, layer)), removeLayer: vi.fn((id) => layers.delete(id)),
      setLayoutProperty: vi.fn(), triggerRepaint: vi.fn() };
    const data = {} as HistoricalFlightCollection;
    const params = { altitudeScale: 3, opacity: .8 } as HistoricalFlightParams;
    renderHistoricalFlightTrails(map as unknown as MapboxMap, 'TW', data, params);
    const layer = layers.get('historical-flight-trails-tw-3d');
    expect(layer.renderingMode).toBe('3d');
    renderHistoricalFlightTrails(map as unknown as MapboxMap, 'TW', data, { ...params, altitudeScale: 5 });
    expect(map.addLayer).toHaveBeenCalledTimes(1);
    expect(map.setLayoutProperty).toHaveBeenCalledWith('historical-flight-trails-tw-3d', 'visibility', 'visible');
    expect(layer.setParams).toHaveBeenCalledWith({ ...params, altitudeScale: 5 });
    layers.clear();
    renderHistoricalFlightTrails(map as unknown as MapboxMap, 'TW', data, params);
    expect(map.addLayer).toHaveBeenCalledTimes(2);
    removeHistoricalFlightTrails(map as unknown as MapboxMap, 'TW');
    expect(layers.size).toBe(0);
  });
});

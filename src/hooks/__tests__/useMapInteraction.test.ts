import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RefObject } from "react";
import type { Map as MapboxMap } from "mapbox-gl";

const harness = vi.hoisted(() => {
  let stateIndex = 0;
  let click: ((event: {
    point: { x: number; y: number };
    lngLat: { lng: number; lat: number };
  }) => void) | null = null;
  const setFeatureInfo = vi.fn();
  const hydrateGrid = vi.fn();
  return {
    reset: () => { stateIndex = 0; click = null; setFeatureInfo.mockReset(); hydrateGrid.mockReset(); },
    useState: <T,>(initial: T) => {
      const setter = stateIndex++ === 6 ? setFeatureInfo : vi.fn();
      return [initial, setter] as const;
    },
    useRef: <T,>(initial: T) => ({ current: initial }),
    setClick: (handler: typeof click) => { click = handler; },
    click: () => click,
    setFeatureInfo,
    hydrateGrid,
  };
});

vi.mock("react", () => ({
  useState: harness.useState,
  useRef: harness.useRef,
  useEffect: () => undefined,
}));
vi.mock("../../map/realEstatePointsCustomLayer", () => ({ getRealEstatePointsScene: () => null }));
vi.mock("../../data/climateFieldSampler", () => ({ sampleClimateFields: vi.fn() }));
vi.mock("../../data/rasterProbeSampler", () => ({ sampleRasterProbes: vi.fn() }));
vi.mock("../../lib/sessionTracker", () => ({ sessionTracker: { log: vi.fn() } }));
vi.mock("../../data/gfwHourlyDetailLoader", async (importOriginal) => ({
  ...await importOriginal<typeof import("../../data/gfwHourlyDetailLoader")>(),
  hydrateGfwGridDetail: harness.hydrateGrid,
}));

import { GIS_LAYERS } from "../../map/gisClickRegistry";
import { GFW_HOURLY_GRID_PMTILES_HIT_FILL_LAYER_ID } from "../useGfwHourlyGridLayer";
import { useMapInteraction } from "../useMapInteraction";

describe("useMapInteraction GFW grid click", () => {
  beforeEach(() => harness.reset());

  it("PMTiles hit fill 以 registry 的 gfwHourlyGrid type 將 v3 grid_id popup 依序 hydrate", async () => {
    expect(GIS_LAYERS).toContainEqual({
      layers: expect.arrayContaining([GFW_HOURLY_GRID_PMTILES_HIT_FILL_LAYER_ID]),
      type: "gfwHourlyGrid",
    });
    harness.hydrateGrid.mockResolvedValue({
      cell_id: "38a1",
      grid_id: "38a1",
      observed_at: "2026-08-20T16:00:00Z",
      vessel_count: 1,
      vessels_json: JSON.stringify([{ vessel_id: "v-1", mmsi: null, ship_name: "ONE", vessel_type: null, flag: null }]),
      detail_status: "loaded",
    });
    const map = {
      getContainer: () => ({ clientWidth: 100, clientHeight: 100 }),
      getLayer: (id: string) => id === GFW_HOURLY_GRID_PMTILES_HIT_FILL_LAYER_ID ? {} : undefined,
      queryRenderedFeatures: vi.fn((_bbox: unknown, options: { layers: string[] }) =>
        options.layers.includes(GFW_HOURLY_GRID_PMTILES_HIT_FILL_LAYER_ID)
          ? [{
            id: "feature-id-ignored-after-grid-id",
            properties: {
              grid_id: "38a1",
              observed_at: "2026-08-20T16:00:00Z",
              vessel_count: 1,
              // A v3 rendering preview may look valid, but sidecar remains authoritative.
              vessels_json: JSON.stringify([{ vessel_id: "preview", mmsi: null, ship_name: "PREVIEW", vessel_type: null, flag: null }]),
              geometry_semantics: "inferred_0_01_degree_footprint",
            },
            geometry: { type: "Polygon", coordinates: [] },
          }]
          : [],
      ),
      on: vi.fn((event: string, ...args: unknown[]) => {
        if (event === "click" && typeof args[0] === "function") harness.setClick(args[0] as never);
      }),
      getCanvas: () => ({ style: {} }),
    };
    const ref = { current: map } as unknown as RefObject<MapboxMap | null>;
    const interaction = useMapInteraction(ref, { current: null }, { current: [] }, { current: 0 });
    interaction.bindEvents(map as never);

    harness.click()?.({ point: { x: 5, y: 6 }, lngLat: { lng: 121, lat: 25 } });
    expect(harness.hydrateGrid).toHaveBeenCalledWith(expect.objectContaining({ cell_id: "38a1", grid_id: "38a1" }));
    expect(harness.setFeatureInfo).toHaveBeenNthCalledWith(1, expect.objectContaining({
      layerType: "gfwHourlyGrid",
      properties: expect.objectContaining({ cell_id: "38a1", detail_status: "loading" }),
    }));

    await Promise.resolve();
    expect(harness.setFeatureInfo).toHaveBeenLastCalledWith(expect.objectContaining({
      layerType: "gfwHourlyGrid",
      properties: expect.objectContaining({ cell_id: "38a1", detail_status: "loaded", vessels_json: expect.stringContaining("v-1") }),
    }));
  });
});

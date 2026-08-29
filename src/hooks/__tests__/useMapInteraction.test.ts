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
  const hydrateTrack = vi.fn();
  const trackPick = vi.fn();
  // 由測試決定「哪個 hit layer 是 dominant」，模擬 grid hook 發佈的查詢期選擇器。
  const dominantHit = { current: null as string | null, v4: false };
  return {
    reset: () => {
      stateIndex = 0; click = null; setFeatureInfo.mockReset(); hydrateGrid.mockReset(); hydrateTrack.mockReset(); trackPick.mockReset();
      dominantHit.current = null; dominantHit.v4 = false;
    },
    dominantHit,
    useState: <T,>(initial: T) => {
      const setter = stateIndex++ === 6 ? setFeatureInfo : vi.fn();
      return [initial, setter] as const;
    },
    useRef: <T,>(initial: T) => ({ current: initial }),
    setClick: (handler: typeof click) => { click = handler; },
    click: () => click,
    setFeatureInfo,
    hydrateGrid, hydrateTrack, trackPick,
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
  hydrateGfwTrackDetail: harness.hydrateTrack,
}));
vi.mock("../../data/gfwV4TrackPicking", () => ({ beginGfwV4TrackPick: harness.trackPick }));
vi.mock("../useGfwHourlyGridLayer", async (importOriginal) => ({
  ...await importOriginal<typeof import("../useGfwHourlyGridLayer")>(),
  isGfwHourlyGridDominantHitLayer: (layerId: string | undefined) =>
    !harness.dominantHit.v4 ? true : layerId === harness.dominantHit.current,
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

function gridFeature(layerId: string, cellId: string, vesselCount: number) {
  return {
    id: cellId,
    layer: { id: layerId },
    properties: {
      cell_id: cellId,
      vessel_count: vesselCount,
      detail_shard: "part-0000.json.gz",
      geometry_semantics: "globally_aligned_0_1_degree_cell",
    },
    geometry: { type: "Polygon", coordinates: [] },
  };
}

function createGridMap(features: unknown[]) {
  const hitIds = [
    "gfw-hourly-grid-pmtiles-hit-fill",
    "gfw-hourly-grid-pmtiles-next-hit-fill",
    "gfw-hourly-grid-pmtiles-preload-hit-fill",
  ];
  return {
    getContainer: () => ({ clientWidth: 100, clientHeight: 100 }),
    getLayer: (id: string) => hitIds.includes(id) ? {} : undefined,
    queryRenderedFeatures: vi.fn((_bbox: unknown, options: { layers: string[] }) =>
      options.layers.some((id) => hitIds.includes(id)) ? features : []),
    on: vi.fn((event: string, ...args: unknown[]) => {
      if (event === "click" && typeof args[0] === "function") harness.setClick(args[0] as never);
    }),
    getCanvas: () => ({ style: {} }),
  };
}

describe("useMapInteraction GFW v4 grid dominant-hour click filter", () => {
  beforeEach(() => harness.reset());

  it("非 dominant 小時的 feature 必須在取 [0] 之前被濾掉", () => {
    harness.dominantHit.v4 = true;
    harness.dominantHit.current = "gfw-hourly-grid-pmtiles-next-hit-fill";
    harness.hydrateGrid.mockResolvedValue({});
    // 查詢先回非 dominant 的那筆：沒有前置過濾就會被 features[0] 取走並以錯誤小時 hydrate。
    const map = createGridMap([
      gridFeature("gfw-hourly-grid-pmtiles-hit-fill", "wrong-hour-cell", 7),
      gridFeature("gfw-hourly-grid-pmtiles-next-hit-fill", "dominant-cell", 3),
    ]);
    const ref = { current: map } as unknown as RefObject<MapboxMap | null>;
    useMapInteraction(ref, { current: null }, { current: [] }, { current: 0 }).bindEvents(map as never);

    harness.click()?.({ point: { x: 5, y: 6 }, lngLat: { lng: 121, lat: 25 } });
    expect(harness.hydrateGrid).toHaveBeenCalledWith(expect.objectContaining({ cell_id: "dominant-cell" }));
    expect(harness.hydrateGrid).not.toHaveBeenCalledWith(expect.objectContaining({ cell_id: "wrong-hour-cell" }));
  });

  it("點到只存在於非 dominant 小時的格子 → 完全無命中，不開錯誤面板", () => {
    harness.dominantHit.v4 = true;
    harness.dominantHit.current = "gfw-hourly-grid-pmtiles-next-hit-fill";
    const map = createGridMap([gridFeature("gfw-hourly-grid-pmtiles-preload-hit-fill", "other-hour-only", 2)]);
    const ref = { current: map } as unknown as RefObject<MapboxMap | null>;
    useMapInteraction(ref, { current: null }, { current: [] }, { current: 0 }).bindEvents(map as never);

    harness.click()?.({ point: { x: 5, y: 6 }, lngLat: { lng: 121, lat: 25 } });
    expect(harness.hydrateGrid).not.toHaveBeenCalled();
    expect(harness.setFeatureInfo).not.toHaveBeenCalledWith(
      expect.objectContaining({ layerType: "gfwHourlyGrid" }),
    );
  });

  it("dominant 為 null（資料窗外完全淡出）時視為無命中", () => {
    harness.dominantHit.v4 = true;
    harness.dominantHit.current = null;
    const map = createGridMap([gridFeature("gfw-hourly-grid-pmtiles-hit-fill", "faded-cell", 4)]);
    const ref = { current: map } as unknown as RefObject<MapboxMap | null>;
    useMapInteraction(ref, { current: null }, { current: [] }, { current: 0 }).bindEvents(map as never);

    harness.click()?.({ point: { x: 5, y: 6 }, lngLat: { lng: 121, lat: 25 } });
    expect(harness.hydrateGrid).not.toHaveBeenCalled();
    expect(harness.setFeatureInfo).not.toHaveBeenCalledWith(
      expect.objectContaining({ layerType: "gfwHourlyGrid" }),
    );
  });
});

describe("useMapInteraction GFW v4 current-frame track picking", () => {
  beforeEach(() => harness.reset());

  const map = {
    getContainer: () => ({ clientWidth: 100, clientHeight: 100 }),
    getLayer: () => undefined,
    queryRenderedFeatures: vi.fn(() => []),
    on: vi.fn((event: string, ...args: unknown[]) => {
      if (event === "click" && typeof args[0] === "function") harness.setClick(args[0] as never);
    }),
    getCanvas: () => ({ style: {} }),
  };

  const picked = (epoch: number) => ({
    feature: {
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [121, 25] },
      properties: { track_id: "track-1", selected_time: new Date(epoch * 1000).toISOString() },
    },
    generation: 3,
    frameEpoch: epoch,
    isCurrent: () => true,
  });

  it("opens and hydrates popup from the exact applied-frame pick", async () => {
    const epoch = Date.parse("2026-08-21T12:30:00Z") / 1000;
    harness.trackPick.mockReturnValue({ generation: 3, frameEpoch: epoch, pointIndex: 0, coords: [121, 25], result: Promise.resolve(picked(epoch)) });
    harness.hydrateTrack.mockResolvedValue({ track_id: "track-1", selected_time: "2026-08-21T12:30:00.000Z", detail_status: "loaded" });
    const ref = { current: map } as unknown as RefObject<MapboxMap | null>;
    useMapInteraction(ref, { current: null }, { current: [] }, { current: 0 }, undefined, undefined, undefined, { current: { gfwHourlyTracks: true } } as never).bindEvents(map as never);

    harness.click()?.({ point: { x: 5, y: 6 }, lngLat: { lng: 121, lat: 25 } });
    await Promise.resolve();
    expect(harness.hydrateTrack).toHaveBeenCalledWith(expect.objectContaining({ selected_time: "2026-08-21T12:30:00.000Z" }));
    await Promise.resolve();
    expect(harness.setFeatureInfo).toHaveBeenLastCalledWith(expect.objectContaining({
      layerType: "gfwHourlyTrack",
      properties: expect.objectContaining({ selected_time: "2026-08-21T12:30:00.000Z", detail_status: "loaded" }),
    }));
  });

  it("drops an older async pick after a newer click", async () => {
    let resolveFirst!: (value: ReturnType<typeof picked>) => void;
    const first = new Promise<ReturnType<typeof picked>>((resolve) => { resolveFirst = resolve; });
    const epoch = Date.parse("2026-08-21T12:30:00Z") / 1000;
    harness.trackPick.mockReturnValueOnce({ generation: 3, frameEpoch: epoch, pointIndex: 0, coords: [121, 25], result: first }).mockReturnValueOnce(null);
    const ref = { current: map } as unknown as RefObject<MapboxMap | null>;
    useMapInteraction(ref, { current: null }, { current: [] }, { current: 0 }, undefined, undefined, undefined, { current: { gfwHourlyTracks: true } } as never).bindEvents(map as never);

    harness.click()?.({ point: { x: 5, y: 6 }, lngLat: { lng: 121, lat: 25 } });
    harness.click()?.({ point: { x: 20, y: 20 }, lngLat: { lng: 120, lat: 24 } });
    resolveFirst(picked(epoch));
    await Promise.resolve();
    expect(harness.hydrateTrack).not.toHaveBeenCalled();
    expect(harness.setFeatureInfo).not.toHaveBeenCalledWith(expect.objectContaining({ layerType: "gfwHourlyTrack" }));
  });

  it("drops a pick when playback advances the applied frame before its reply", async () => {
    const epoch = Date.parse("2026-08-21T12:30:00Z") / 1000;
    harness.trackPick.mockReturnValue({
      generation: 3, frameEpoch: epoch, pointIndex: 0, coords: [121, 25],
      result: Promise.resolve({ ...picked(epoch), isCurrent: () => false }),
    });
    const ref = { current: map } as unknown as RefObject<MapboxMap | null>;
    useMapInteraction(ref, { current: null }, { current: [] }, { current: 0 }, undefined, undefined, undefined, { current: { gfwHourlyTracks: true } } as never).bindEvents(map as never);

    harness.click()?.({ point: { x: 5, y: 6 }, lngLat: { lng: 121, lat: 25 } });
    await Promise.resolve();
    expect(harness.hydrateTrack).not.toHaveBeenCalled();
    expect(harness.setFeatureInfo).not.toHaveBeenCalledWith(expect.objectContaining({ layerType: "gfwHourlyTrack" }));
  });
});

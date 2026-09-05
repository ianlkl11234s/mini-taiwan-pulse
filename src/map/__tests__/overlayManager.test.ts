import { describe, it, expect, vi } from "vitest";
import type { Map as MapboxMap } from "mapbox-gl";
import {
  diffPaint,
  snapshotPaint,
  paintSnapshotEquals,
  serializePaintValue,
} from "../overlayPaintDiff";
import {
  addOverlay,
  hydrateOverlayIfNeeded,
  resetOverlayHydration,
  polygonFeaturesToCentroids,
  setOverlayVisible,
  updateOverlayTheme,
  geojsonSourceOptions,
  applyLayerOpacity,
} from "../overlayManager";
import type { OverlayConfig } from "../../types";
import { OVERLAY_REGISTRY } from "../overlayRegistry";
import { loadingRegistry } from "../../lib/loadingRegistry";

// ── 純函式 ──

describe("serializePaintValue", () => {
  it("serializes primitives and expressions deterministically", () => {
    expect(serializePaintValue(0.5)).toBe("0.5");
    expect(serializePaintValue("#fff")).toBe('"#fff"');
    expect(serializePaintValue(["case", ["==", ["get", "s"], "x"], 1, 2])).toBe(
      serializePaintValue(["case", ["==", ["get", "s"], "x"], 1, 2]),
    );
  });
  it("handles undefined without collapsing to missing key", () => {
    expect(serializePaintValue(undefined)).toBe("__undefined__");
  });
});

describe("diffPaint", () => {
  it("returns all keys as changed when no previous snapshot", () => {
    const { changed, serialized } = diffPaint(undefined, { "line-width": 1, "line-opacity": 0.5 });
    expect(changed).toHaveLength(2);
    expect(serialized["line-width"]).toBe("1");
  });

  it("returns empty changed list when nothing changed", () => {
    const paint = { "line-width": 2, "line-color": "#abc" };
    const first = diffPaint(undefined, paint);
    const second = diffPaint(first.serialized, paint);
    expect(second.changed).toHaveLength(0);
  });

  it("returns only the changed keys", () => {
    const first = diffPaint(undefined, { "line-width": 2, "line-opacity": 0.5 });
    const second = diffPaint(first.serialized, { "line-width": 2, "line-opacity": 0.8 });
    expect(second.changed).toEqual([["line-opacity", 0.8]]);
  });

  it("detects changes inside expression arrays", () => {
    const exprA = ["case", ["==", ["get", "status"], "待建"], 0.1, 0.5];
    const exprB = ["case", ["==", ["get", "status"], "待建"], 0.1, 0.9];
    const first = diffPaint(undefined, { "line-opacity": exprA });
    const second = diffPaint(first.serialized, { "line-opacity": exprB });
    expect(second.changed).toHaveLength(1);
  });
});

describe("applyLayerOpacity", () => {
  const config = { id: "bikeStations", opacityParam: "bikeStationsOpacity" } as OverlayConfig;

  it("preserves existing paint until the layer-level opacity parameter exists", () => {
    const paint = { "circle-opacity": 0.6, "circle-radius": 4 };
    expect(applyLayerOpacity(config, paint, {})).toBe(paint);
  });

  it("multiplies numeric and expression opacity without changing non-opacity paint", () => {
    const paint = { "circle-opacity": 0.6, "circle-stroke-opacity": ["get", "confidence"], "circle-radius": 4 };
    expect(applyLayerOpacity(config, paint, { bikeStationsOpacity: 0.5 })).toEqual({
      "circle-opacity": 0.3,
      "circle-stroke-opacity": ["*", ["get", "confidence"], 0.5],
      "circle-radius": 4,
    });
  });

  it("covers all opacity paint keys, including symbol text", () => {
    const config = { id: "newsEvents", opacityParam: "newsEventsOpacity" } as OverlayConfig;
    expect(applyLayerOpacity(config, {
      "circle-opacity": 0.8,
      "text-opacity": 1,
      "text-color": "#fff",
    }, { newsEventsOpacity: 0.25 })).toEqual({
      "circle-opacity": 0.2,
      "text-opacity": 0.25,
      "text-color": "#fff",
    });
  });
});

describe("paintSnapshotEquals", () => {
  it("compares snapshots by content", () => {
    const a = snapshotPaint({ "circle-radius": 4, "circle-color": "#fff" });
    const b = snapshotPaint({ "circle-radius": 4, "circle-color": "#fff" });
    const c = snapshotPaint({ "circle-radius": 5, "circle-color": "#fff" });
    expect(paintSnapshotEquals(a, b)).toBe(true);
    expect(paintSnapshotEquals(a, c)).toBe(false);
    expect(paintSnapshotEquals(undefined, b)).toBe(false);
  });
  it("detects key count mismatch", () => {
    const a = snapshotPaint({ "circle-radius": 4 });
    const b = snapshotPaint({ "circle-radius": 4, "circle-color": "#fff" });
    expect(paintSnapshotEquals(a, b)).toBe(false);
  });
});

describe("geojsonSourceOptions", () => {
  const lineConfig = {
    id: "waterRivers",
    sourceUrl: "x",
    sourceId: "s",
    layers: [
      { suffix: "glow", type: "line", paint: () => ({}) },
      { suffix: "fill", type: "fill", paint: () => ({}) },
    ],
  } as unknown as OverlayConfig;
  const pointConfig = {
    ...lineConfig,
    layers: [{ suffix: "core", type: "circle", paint: () => ({}) }],
  } as unknown as OverlayConfig;

  it("uses smaller buffer for pure line/fill sources", () => {
    expect(geojsonSourceOptions(lineConfig)).toEqual({ tolerance: 1.2, buffer: 64 });
  });
  it("keeps default buffer for circle/symbol sources", () => {
    expect(geojsonSourceOptions(pointConfig).buffer).toBe(128);
  });
});

describe("polygonFeaturesToCentroids", () => {
  it("把 polygon 轉成保留 properties 的代表點，非面幾何不假造", () => {
    const data: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          id: "hub-1",
          properties: { name: "A" },
          geometry: { type: "Polygon", coordinates: [[[0, 0], [4, 0], [4, 2], [0, 2], [0, 0]]] },
        },
        {
          type: "Feature",
          properties: { name: "skip" },
          geometry: { type: "Point", coordinates: [9, 9] },
        },
      ],
    };

    expect(polygonFeaturesToCentroids(data)).toEqual({
      type: "FeatureCollection",
      features: [{
        type: "Feature",
        id: "hub-1",
        properties: { name: "A" },
        geometry: { type: "Point", coordinates: [2, 1] },
      }],
    });
  });

  it("MultiPolygon 取最大部件，不把代表點放在兩塊面之間", () => {
    const data: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: [{
        type: "Feature",
        properties: {},
        geometry: {
          type: "MultiPolygon",
          coordinates: [
            [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]],
            [[[10, 10], [14, 10], [14, 14], [10, 14], [10, 10]]],
          ],
        },
      }],
    };
    expect(polygonFeaturesToCentroids(data).features[0]?.geometry.coordinates).toEqual([12, 12]);
  });
});

// ── mock map 整合測試：diff 式更新 ──

interface Call { method: string; args: unknown[] }

function createMockMap() {
  const sources = new Map<string, Record<string, unknown>>();
  const layers = new Map<string, { visibility: string }>();
  const calls: Call[] = [];
  const map = {
    getSource: (id: string) => sources.get(id),
    addSource: (id: string, _spec: unknown) => {
      calls.push({ method: "addSource", args: [id, _spec] });
      sources.set(id, {});
    },
    getLayer: (id: string) => (layers.has(id) ? {} : undefined),
    addLayer: (spec: { id: string }) => {
      calls.push({ method: "addLayer", args: [spec.id] });
      layers.set(spec.id, { visibility: "visible" });
    },
    removeLayer: (id: string) => {
      calls.push({ method: "removeLayer", args: [id] });
      layers.delete(id);
    },
    setPaintProperty: (id: string, key: string, value: unknown) => {
      calls.push({ method: "setPaintProperty", args: [id, key, value] });
    },
    setLayoutProperty: (id: string, key: string, value: unknown) => {
      calls.push({ method: "setLayoutProperty", args: [id, key, value] });
    },
    getLayoutProperty: (id: string) => layers.get(id)?.visibility,
  };
  return { map: map as unknown as MapboxMap, calls, sources };
}

const config: OverlayConfig = {
  id: "waterRivers",
  sourceUrl: "./geo/water_rivers.geojson",
  sourceId: "water-rivers",
  layers: [
    {
      suffix: "core",
      type: "line",
      paint: (isDark: boolean, p?: Record<string, number>) => ({
        "line-color": isDark ? "#7dd3fc" : "#0369a1",
        "line-width": 1.2 * (p?.waterRiverWidth ?? 1),
        "line-opacity": 0.85 * (p?.waterRiverOpacity ?? 1),
      }),
    },
  ],
} as unknown as OverlayConfig;

describe("updateOverlayTheme (diff-based)", () => {
  it("skips setPaintProperty entirely when params unchanged", () => {
    const { map, calls } = createMockMap();
    addOverlay(map, config, true, { waterRiverOpacity: 1, waterRiverWidth: 1 });
    calls.length = 0;

    updateOverlayTheme(map, config, true, { waterRiverOpacity: 1, waterRiverWidth: 1 });
    expect(calls.filter((c) => c.method === "setPaintProperty")).toHaveLength(0);
  });

  it("only updates the paint keys affected by the changed param", () => {
    const { map, calls } = createMockMap();
    addOverlay(map, config, true, { waterRiverOpacity: 1, waterRiverWidth: 1 });
    calls.length = 0;

    updateOverlayTheme(map, config, true, { waterRiverOpacity: 0.5, waterRiverWidth: 1 });
    const paints = calls.filter((c) => c.method === "setPaintProperty");
    expect(paints).toHaveLength(1);
    expect(paints[0]?.args).toEqual(["water-rivers-core", "line-opacity", 0.85 * 0.5]);
  });

  it("updates all theme-dependent keys when isDark flips", () => {
    const { map, calls } = createMockMap();
    addOverlay(map, config, true, { waterRiverOpacity: 1, waterRiverWidth: 1 });
    calls.length = 0;

    updateOverlayTheme(map, config, false, { waterRiverOpacity: 1, waterRiverWidth: 1 });
    const keys = calls
      .filter((c) => c.method === "setPaintProperty")
      .map((c) => c.args[1]);
    expect(keys).toContain("line-color");
  });
});

describe("setOverlayVisible", () => {
  it("圖層重開時仍尊重模式 layout，不會同時露出 polygon 與 point", () => {
    const modeConfig: OverlayConfig = {
      ...config,
      layers: [{
        suffix: "core",
        type: "line",
        layout: (_isDark, p) => ({ visibility: (p?.modeIdx ?? 0) === 1 ? "visible" : "none" }),
        paint: () => ({}),
      }],
    } as OverlayConfig;
    const { map, calls } = createMockMap();
    addOverlay(map, modeConfig, true, { modeIdx: 0 });
    calls.length = 0;

    setOverlayVisible(map, modeConfig, true, true, { modeIdx: 0 });
    setOverlayVisible(map, modeConfig, true, true, { modeIdx: 1 });

    expect(calls.filter((call) => call.method === "setLayoutProperty").map((call) => call.args))
      .toEqual([
        ["water-rivers-core", "visibility", "none"],
        ["water-rivers-core", "visibility", "visible"],
      ]);
  });

  it("母圖層關閉時，params 更新不會讓 mode layout 穿透開關", () => {
    const modeConfig: OverlayConfig = {
      ...config,
      layers: [{
        suffix: "core",
        type: "line",
        layout: (_isDark, p) => ({ visibility: (p?.modeIdx ?? 0) === 1 ? "visible" : "none" }),
        paint: () => ({}),
      }],
    } as OverlayConfig;
    const { map, calls } = createMockMap();
    addOverlay(map, modeConfig, true, { modeIdx: 0 });
    calls.length = 0;

    updateOverlayTheme(map, modeConfig, true, { modeIdx: 1 }, false);

    expect(calls.filter((call) => call.method === "setLayoutProperty").map((call) => call.args))
      .toEqual([["water-rivers-core", "visibility", "none"]]);
  });
});

describe("交通場站派生點位接線", () => {
  const expected = [
    ["stationsTHSR", "station-polygon-centroids"],
    ["stationsTRA", "station-polygon-centroids"],
    ["ports", "port-centroids"],
    ["airports", "airport-centroids"],
  ] as const;

  it.each(expected)("%s 的點位模式只由原 Polygon 心點派生", (id, sourceId) => {
    const entry = OVERLAY_REGISTRY.find((config) => config.id === id && config.sourceId === sourceId);
    expect(entry).toBeDefined();
    expect(entry?.geojsonTransform).toBe("centroid");
    expect(entry?.sourceUrl).toMatch(/\.geojson$/);
    expect(entry?.layers.every((layer) => layer.type === "circle")).toBe(true);
  });

  it("捷運保留原 detail layers，並在 z10 以下提供全台 overview 點", () => {
    const metro = OVERLAY_REGISTRY.filter((config) => config.id === "stationsMetro");
    const overview = metro.find((config) => config.layers.some((layer) => layer.suffix === "metro-overview-point-core"));
    const detail = metro.find((config) => config.layers.some((layer) => layer.suffix === "metro-pt-fill"));
    expect(overview?.sourceId).toBe("station-points");
    expect(overview?.layers
      .filter((layer) => layer.suffix.startsWith("metro-overview-"))
      .every((layer) => layer.maxzoom === 10 && layer.minzoom == null)).toBe(true);
    expect(detail?.layers.some((layer) => layer.minzoom === 10)).toBe(true);
  });

  it("台鐵小站在 z10 以下有 overview，z10 以上保留原 detail layers", () => {
    const tra = OVERLAY_REGISTRY.find(
      (config) => config.id === "stationsTRA" && config.sourceId === "station-points",
    );
    const overview = tra?.layers.filter((layer) => layer.suffix.startsWith("tra-overview-"));
    expect(overview).toHaveLength(2);
    expect(overview?.every((layer) => layer.maxzoom === 10 && layer.minzoom == null)).toBe(true);
    expect(tra?.layers.some((layer) => layer.suffix === "tra-pt-fill" && layer.minzoom === 10)).toBe(true);
  });
});

describe("addOverlay (pmtiles)", () => {
  const pmtilesConfig: OverlayConfig = {
    ...config,
    sourceUrl: "./geo/water_rivers.pmtiles",
    sourceId: "water-rivers",
    pmtiles: { sourceLayer: "rivers", minzoom: 4, maxzoom: 13 },
    layers: config.layers.map((layer) => ({ ...layer, minzoom: 4, maxzoom: 12 })),
  } as unknown as OverlayConfig;

  it("adds a pmtile-source with min/max zoom instead of geojson", () => {
    const { map, calls } = createMockMap();
    addOverlay(map, pmtilesConfig, true, {});
    const src = calls.find((c) => c.method === "addSource");
    expect(src?.args[0]).toBe("water-rivers");
    expect(src?.args[1]).toMatchObject({
      type: "pmtile-source",
      url: "./geo/water_rivers.pmtiles",
      minzoom: 4,
      maxzoom: 13,
    });
  });

  it("attaches source-layer to every style layer", () => {
    const layerSpecs: Array<Record<string, unknown>> = [];
    const { map } = createMockMap();
    const original = (map as unknown as { addLayer: (s: Record<string, unknown>) => void }).addLayer;
    (map as unknown as { addLayer: (s: Record<string, unknown>) => void }).addLayer = (s) => {
      layerSpecs.push(s);
      original(s as { id: string });
    };
    addOverlay(map, pmtilesConfig, true, {});
    expect(layerSpecs).toHaveLength(1);
    expect(layerSpecs[0]?.["source-layer"]).toBe("rivers");
    expect(layerSpecs[0]?.minzoom).toBe(4);
    expect(layerSpecs[0]?.maxzoom).toBe(12);
  });

  it("shared sourceId 只 addSource 一次，但各自 layer 都會建立", () => {
    const { map, calls } = createMockMap();
    const sibling: OverlayConfig = {
      ...pmtilesConfig,
      id: "waterLevees",
      layers: [{ suffix: "sibling", type: "line", paint: () => ({ "line-width": 1 }) }],
    } as unknown as OverlayConfig;
    addOverlay(map, pmtilesConfig, true, {});
    addOverlay(map, sibling, true, {});
    expect(calls.filter((c) => c.method === "addSource")).toHaveLength(1);
    expect(calls.filter((c) => c.method === "addLayer")).toHaveLength(2);
  });

  it("keeps plain geojson sources untouched (no source-layer)", () => {
    const layerSpecs: Array<Record<string, unknown>> = [];
    const { map, calls } = createMockMap();
    const original = (map as unknown as { addLayer: (s: Record<string, unknown>) => void }).addLayer;
    (map as unknown as { addLayer: (s: Record<string, unknown>) => void }).addLayer = (s) => {
      layerSpecs.push(s);
      original(s as { id: string });
    };
    addOverlay(map, config, true, {});
    const src = calls.find((c) => c.method === "addSource");
    expect((src?.args[1] as Record<string, unknown>).type).toBe("geojson");
    expect(layerSpecs[0]?.["source-layer"]).toBeUndefined();
  });
});

describe("Ookla static overlay 的 attribution / loading 契約", () => {
  const ookla = (id: OverlayConfig["id"], sourceId: string) => {
    const config = OVERLAY_REGISTRY.find((entry) => entry.id === id && entry.sourceId === sourceId);
    if (!config) throw new Error(`missing Ookla config ${String(id)}:${sourceId}`);
    return config;
  };

  it("global GeoJSON 與台灣 PMTiles 都把 attribution 交給 Mapbox source", () => {
    const global = ookla("ooklaMobilePerformance", "ookla-mobile-global");
    const taiwan = ookla("ooklaMobileTaiwan", "ookla-tw-z14-mobile");
    expect(global.attribution).toContain("Ookla");
    expect(taiwan.attribution).toBe(global.attribution);

    const globalMock = createMockMap();
    addOverlay(globalMock.map, global, true, {});
    expect(globalMock.calls.find((call) => call.method === "addSource")?.args[1]).toMatchObject({
      attribution: global.attribution,
    });

    const pmtilesMock = createMockMap();
    addOverlay(pmtilesMock.map, taiwan, true, {});
    expect(pmtilesMock.sources.get(taiwan.sourceId)?.attribution).toBe(taiwan.attribution);
  });

  it("global GeoJSON lazy fetch 期間會註冊 loadingRegistry，完成後才結束", async () => {
    const config = ookla("ooklaMobilePerformance", "ookla-mobile-global");
    const setData = vi.fn();
    const map = { getSource: () => ({ setData }) } as unknown as MapboxMap;
    let resolveFetch: ((value: { ok: boolean; json: () => Promise<GeoJSON.FeatureCollection> }) => void) | undefined;
    vi.stubGlobal("fetch", vi.fn(() => new Promise((resolve) => { resolveFetch = resolve; })));
    resetOverlayHydration();

    try {
      const pending = hydrateOverlayIfNeeded(map, config);
      const taskId = `overlay-hydrate:${config.sourceId}`;
      expect(loadingRegistry.snapshot()).toContainEqual(expect.objectContaining({ id: taskId }));
      resolveFetch?.({ ok: true, json: async () => ({ type: "FeatureCollection", features: [] }) });
      await pending;
      expect(setData).toHaveBeenCalledWith({ type: "FeatureCollection", features: [] });
      expect(loadingRegistry.snapshot()).not.toContainEqual(expect.objectContaining({ id: taskId }));
    } finally {
      vi.unstubAllGlobals();
      resetOverlayHydration();
    }
  });
});

describe("updateOverlayTheme (rebuildOnParamChange)", () => {
  const rebuildConfig: OverlayConfig = {
    ...config,
    sourceId: "stations-x",
    rebuildOnParamChange: ["core"],
    layers: [
      {
        suffix: "core",
        type: "circle",
        paint: (_isDark: boolean, p?: Record<string, number>) => ({
          "circle-radius": 4 * (p?.scale ?? 1),
        }),
      },
    ],
  } as unknown as OverlayConfig;

  it("does not rebuild when paint unchanged", () => {
    const { map, calls } = createMockMap();
    addOverlay(map, rebuildConfig, true, { scale: 1 });
    calls.length = 0;

    updateOverlayTheme(map, rebuildConfig, true, { scale: 1 });
    expect(calls.filter((c) => c.method === "removeLayer")).toHaveLength(0);
    expect(calls.filter((c) => c.method === "addLayer")).toHaveLength(0);
  });

  it("rebuilds when the rebuild-layer paint actually changed", () => {
    const { map, calls } = createMockMap();
    addOverlay(map, rebuildConfig, true, { scale: 1 });
    calls.length = 0;

    updateOverlayTheme(map, rebuildConfig, true, { scale: 2 });
    expect(calls.filter((c) => c.method === "removeLayer")).toHaveLength(1);
    expect(calls.filter((c) => c.method === "addLayer")).toHaveLength(1);
  });
});

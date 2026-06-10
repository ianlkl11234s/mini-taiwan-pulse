import { describe, it, expect } from "vitest";
import type { Map as MapboxMap } from "mapbox-gl";
import {
  diffPaint,
  snapshotPaint,
  paintSnapshotEquals,
  serializePaintValue,
} from "../overlayPaintDiff";
import {
  addOverlay,
  updateOverlayTheme,
  geojsonSourceOptions,
} from "../overlayManager";
import type { OverlayConfig } from "../../types";

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

// ── mock map 整合測試：diff 式更新 ──

interface Call { method: string; args: unknown[] }

function createMockMap() {
  const sources = new Set<string>();
  const layers = new Map<string, { visibility: string }>();
  const calls: Call[] = [];
  const map = {
    getSource: (id: string) => (sources.has(id) ? {} : undefined),
    addSource: (id: string, _spec: unknown) => {
      calls.push({ method: "addSource", args: [id, _spec] });
      sources.add(id);
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
  return { map: map as unknown as MapboxMap, calls };
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

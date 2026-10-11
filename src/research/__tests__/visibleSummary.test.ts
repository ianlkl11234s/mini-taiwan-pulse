import { describe, expect, it } from "vitest";
import type { LayerSource } from "../../data/layerManifest";
import { firstGetField, summarizeVisibleLayers, viewportBounds, VISIBLE_SUMMARY_MAX_FEATURES, type VisibleSummaryFeature, type VisibleSummaryMap, type VisibleSummaryStyleLayer } from "../visibleSummary";
import { validQueryResultData } from "../QueryResponder";
import { OVERLAY_REGISTRY } from "../../map/overlayRegistry";

const SOURCES: Record<string, LayerSource[]> = {
  rain: [{ kind: "geojson", sourceId: "rain-src", url: "./rain.geojson" }],
  three: [{ kind: "custom", note: "Three.js" }],
  sat: [{ kind: "pmtiles", sourceId: "sat-src", url: "./sat.pmtiles", minzoom: 0, maxzoom: 10 }],
  ghost: [{ kind: "geojson", sourceId: "ghost-src", url: "./ghost.geojson" }],
  mixed: [{ kind: "custom", note: "x" }, { kind: "supabase", sourceId: "mixed-src", fallbackUrl: "./mixed.geojson" }],
};
const point = (id: number | undefined, props: Record<string, unknown>, coords: [number, number] = [121.5, 25.05], source = "rain-src"): VisibleSummaryFeature => ({ id, source, geometry: { type: "Point", coordinates: coords }, properties: props });

function fakeMap(styleLayers: VisibleSummaryStyleLayer[], features: Record<string, VisibleSummaryFeature[]>): VisibleSummaryMap & { queried: string[][] } {
  const queried: string[][] = [];
  return {
    queried,
    getBounds: () => ({ getWest: () => 121.480123456, getSouth: () => 25.010249, getEast: () => 121.56031, getNorth: () => 25.07111 }),
    getStyle: () => ({ layers: styleLayers }),
    getLayer: id => styleLayers.find(layer => layer.id === id),
    queryRenderedFeatures: ({ layers }) => { queried.push(layers); return layers.flatMap(id => features[id] ?? []); },
  };
}
const options = (extra: Partial<Parameters<typeof summarizeVisibleLayers>[2]> = {}) => ({ sourcesFor: (key: string) => SOURCES[key] ?? null, labelFor: (key: string) => `L-${key}`, ...extra });

describe("visibleSummary (AG-1)", () => {
  it("scopes each sibling layer key to its own style layers when siblings share a source", () => {
    const sources: Record<string, LayerSource[]> = { a: [{ kind: "geojson", sourceId: "shared", url: "./s.geojson" }], b: [{ kind: "geojson", sourceId: "shared", url: "./s.geojson" }] };
    const map = fakeMap(
      [{ id: "shared-a", type: "circle", source: "shared" }, { id: "shared-b", type: "circle", source: "shared" }],
      { "shared-a": [point(1, {}, [121.5, 25.0], "shared")], "shared-b": [point(2, {}, [121.6, 25.1], "shared"), point(3, {}, [121.7, 25.2], "shared")] },
    );
    const summary = summarizeVisibleLayers(map, ["a", "b"], { sourcesFor: key => sources[key] ?? null, styleLayerIdsFor: key => new Set([`shared-${key}`]) });
    expect(summary.layers.map(layer => layer.status === "ok" ? layer.featureCount : null)).toEqual([1, 2]);
    expect(map.queried).toEqual([["shared-a"], ["shared-b"]]);
  });

  it("resolves real sibling layers (sportsSchool vs sportsPublicOther) to disjoint style layers via the overlay registry", () => {
    const idsOf = (key: string) => OVERLAY_REGISTRY.filter(config => config.id === key).flatMap(config => config.layers.map(spec => `${config.sourceId}-${spec.suffix}`));
    const school = idsOf("sportsSchool"); const other = idsOf("sportsPublicOther");
    expect(school.length).toBeGreaterThan(0);
    expect(school.filter(id => other.includes(id))).toEqual([]);
    const map = fakeMap([...school, ...other].map(id => ({ id, type: "circle", source: "sports-venues" })), {});
    summarizeVisibleLayers(map, ["sportsSchool", "sportsPublicOther"]);
    expect(map.queried[0]!.every(id => school.includes(id))).toBe(true);
    expect(map.queried[1]!.every(id => other.includes(id))).toBe(true);
  });

  it("rounds bounds to five decimals as [west,south,east,north]", () => {
    expect(viewportBounds(fakeMap([], {}))).toEqual([121.48012, 25.01025, 121.56031, 25.07111]);
  });

  it("marks custom renderers, raster-only and missing style layers as not applicable", () => {
    const map = fakeMap([{ id: "sat-raster", type: "raster", source: "sat-src" }], {});
    const summary = summarizeVisibleLayers(map, ["three", "sat", "ghost", "unknown"], options());
    expect(summary.layers).toEqual([
      { layerKey: "three", status: "not_applicable", reason: "custom_renderer" },
      { layerKey: "sat", status: "not_applicable", reason: "raster" },
      { layerKey: "ghost", status: "not_applicable", reason: "no_style_layer" },
      { layerKey: "unknown", status: "not_applicable", reason: "custom_renderer" },
    ]);
    expect(map.queried).toEqual([]);
  });

  it("ignores hidden or unregistered style layers and uses the summarizable sourceId of mixed sources", () => {
    const styleLayers: VisibleSummaryStyleLayer[] = [
      { id: "mixed-hidden", type: "circle", source: "mixed-src", layout: { visibility: "none" } },
      { id: "mixed-dots", type: "circle", source: "mixed-src" },
    ];
    const map = fakeMap(styleLayers, { "mixed-dots": [point(1, {}, [121, 25], "mixed-src")] });
    const summary = summarizeVisibleLayers(map, ["mixed"], options());
    expect(map.queried).toEqual([["mixed-dots"]]);
    expect(summary.layers[0]).toMatchObject({ status: "ok", featureCount: 1, topAreas: null, max: null });
  });

  it("deduplicates tile-duplicated features by id and by coordinate + properties", () => {
    const features = [point(7, { a: 1 }), point(7, { a: 1 }), point(undefined, { a: 2 }), point(undefined, { a: 2 }), point(undefined, { a: 3 })];
    const map = fakeMap([{ id: "rain-dots", type: "circle", source: "rain-src" }], { "rain-dots": features });
    expect(summarizeVisibleLayers(map, ["rain"], options()).layers[0]).toMatchObject({ status: "ok", featureCount: 3, capped: false });
  });

  it("caps raw features at the limit and reports no_rendered_features for an empty viewport", () => {
    const many = Array.from({ length: VISIBLE_SUMMARY_MAX_FEATURES + 10 }, (_, i) => point(i, {}));
    const map = fakeMap([{ id: "rain-dots", type: "circle", source: "rain-src" }], { "rain-dots": many });
    expect(summarizeVisibleLayers(map, ["rain"], options()).layers[0]).toMatchObject({ featureCount: VISIBLE_SUMMARY_MAX_FEATURES, capped: true });
    const empty = fakeMap([{ id: "rain-dots", type: "circle", source: "rain-src" }], {});
    expect(summarizeVisibleLayers(empty, ["rain"], options()).layers[0]).toEqual({ layerKey: "rain", label: "L-rain", status: "no_rendered_features" });
  });

  it("prefers a town field present on at least half the features, then county, else null", () => {
    const style = [{ id: "rain-dots", type: "circle", source: "rain-src" }];
    const towns = [point(1, { TOWNNAME: "信義區", COUNTYNAME: "臺北市" }), point(2, { TOWNNAME: "信義區" }), point(3, { TOWNNAME: "大安區" }), point(4, {})];
    expect(summarizeVisibleLayers(fakeMap(style, { "rain-dots": towns }), ["rain"], options()).layers[0]).toMatchObject({
      topAreas: { level: "town", field: "TOWNNAME", items: [{ name: "信義區", count: 2 }, { name: "大安區", count: 1 }] },
    });
    const counties = [point(1, { town: "A", county: "臺北市" }), point(2, { county: "臺北市" }), point(3, { county: "新北市" })];
    expect(summarizeVisibleLayers(fakeMap(style, { "rain-dots": counties }), ["rain"], options()).layers[0]).toMatchObject({
      topAreas: { level: "county", field: "county", items: [{ name: "臺北市", count: 2 }, { name: "新北市", count: 1 }] },
    });
    const none = [point(1, { foo: "x" }), point(2, {})];
    expect(summarizeVisibleLayers(fakeMap(style, { "rain-dots": none }), ["rain"], options()).layers[0]).toMatchObject({ topAreas: null });
  });

  it("finds the first data-driven get field in paint order (nested) and reports its max with name/position", () => {
    expect(firstGetField(["interpolate", ["linear"], ["get", "rain_1h"], 0, 2, 50, 12])).toBe("rain_1h");
    expect(firstGetField(["match", ["get", "kind"], "a", "#f00", "#00f"])).toBe("kind");
    expect(firstGetField("#ff0000")).toBeNull();
    const style: VisibleSummaryStyleLayer[] = [{ id: "rain-dots", type: "circle", source: "rain-src", paint: { "circle-color": ["step", ["get", "other"], "#000", 1, "#fff"], "circle-radius": ["interpolate", ["linear"], ["get", "rain_1h"], 0, 2, 50, 12] } }];
    const features = [point(1, { rain_1h: 12, name: "A站" }), point(2, { rain_1h: 42.5, name: "象山站" }, [121.576123, 25.027049]), point(3, { rain_1h: "99" })];
    expect(summarizeVisibleLayers(fakeMap(style, { "rain-dots": features }), ["rain"], options()).layers[0]).toMatchObject({
      max: { field: "rain_1h", value: 42.5, name: "象山站", lngLat: [121.57612, 25.02705] },
    });
  });

  it("returns max:null when no paint property is data-driven or values are not finite numbers", () => {
    const constant = [{ id: "rain-dots", type: "circle", source: "rain-src", paint: { "circle-color": "#f00" } }];
    expect(summarizeVisibleLayers(fakeMap(constant, { "rain-dots": [point(1, { rain_1h: 5 })] }), ["rain"], options()).layers[0]).toMatchObject({ max: null });
    const driven = [{ id: "rain-dots", type: "circle", source: "rain-src", paint: { "circle-radius": ["get", "rain_1h"] } }];
    expect(summarizeVisibleLayers(fakeMap(driven, { "rain-dots": [point(1, { rain_1h: "n/a" })] }), ["rain"], options()).layers[0]).toMatchObject({ max: null });
  });

  it("truncates to ten layers and skips layers once the 150 ms budget is spent", () => {
    const keys = Array.from({ length: 12 }, (_, i) => `k${i}`);
    expect(summarizeVisibleLayers(fakeMap([], {}), keys, options()).truncated).toBe(true);
    expect(summarizeVisibleLayers(fakeMap([], {}), keys, options()).layers).toHaveLength(10);
    let clock = 0;
    const style = [{ id: "rain-dots", type: "circle", source: "rain-src" }];
    const map = fakeMap(style, { "rain-dots": [point(1, {})] });
    const slow = { ...map, queryRenderedFeatures: (o: { layers: string[] }) => { clock += 200; return map.queryRenderedFeatures(o); } };
    const summary = summarizeVisibleLayers(slow, ["rain", "rain"], options({ now: () => clock }));
    expect(summary.layers.map(layer => layer.status)).toEqual(["ok", "skipped_budget"]);
  });

  it("stays within the gateway query-result guard for a worst-case ten-layer summary", () => {
    const style: VisibleSummaryStyleLayer[] = [{ id: "rain-dots", type: "circle", source: "rain-src", paint: { "circle-radius": ["get", "v"] } }];
    const features = Array.from({ length: 5000 }, (_, i) => point(i, { v: i, TOWNNAME: `區${i % 300}`.repeat(30), name: "長".repeat(500) }, [121 + i / 1e4, 25]));
    const summary = summarizeVisibleLayers(fakeMap(style, { "rain-dots": features }), Array(10).fill("rain"), options({ now: () => 0 }));
    expect(summary.layers.every(layer => layer.status === "ok")).toBe(true);
    const wire = JSON.parse(JSON.stringify({ bounds: [121, 25, 122, 26], visibleSummary: summary }));
    expect(validQueryResultData(wire)).toBe(true);
    expect(new TextEncoder().encode(JSON.stringify(wire)).byteLength).toBeLessThan(256 * 1024);
  });
});

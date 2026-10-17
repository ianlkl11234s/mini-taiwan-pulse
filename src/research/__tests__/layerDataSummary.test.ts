import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { AqiStation } from "../../types";
import type { EarthquakeGlobalEvent } from "../../data/earthquakesGlobalLoader";
import type { TyphoonPoint } from "../../data/typhoonTracksLoader";
import {
  inBounds, layerDataProviderFor, registerLayerDataProvider, summarizeAqiStations, summarizeEarthquakes, summarizeTyphoons, summarizeYoubikeCells,
  type DataBounds, type LayerDataSummary,
} from "../layerDataSummary";
import { summarizeVisibleLayers, type VisibleSummaryMap } from "../visibleSummary";
import { validQueryResultData } from "../QueryResponder";

const TAIWAN: DataBounds = [119.5, 21.8, 122.2, 25.4];
const TAIPEI: DataBounds = [121.4, 24.95, 121.65, 25.15];
const ok = (summary: LayerDataSummary) => { if (summary.status !== "ok") throw new Error(`expected ok, got ${summary.status}`); return summary; };
const wireSafe = (value: unknown) => validQueryResultData(JSON.parse(JSON.stringify(value)));

const station = (id: string, lon: number, lat: number, aqi: number | null, county = "臺北市", observedAt = "2026-10-03T13:00:00+08:00"): AqiStation => ({
  stationId: id, stationName: `站${id}`, county, lon, lat, observedAt, aqi, pollutant: aqi && aqi > 100 ? "細懸浮微粒" : null, status: null,
  pm25: null, pm10: null, o3: null, no2: null, so2: null, co: null, windSpeed: null, windDirection: null,
});
const quake = (id: string, lng: number, lat: number, mag: number, ts: number): EarthquakeGlobalEvent => ({ event_id: id, mag, place: `地點${id}`, depth_km: 10, lng, lat, observed_ts: ts });
const typhoonPoint = (storm: string, ts: number, lon: number, lat: number, wind: number | null, extra: Partial<TyphoonPoint> = {}): TyphoonPoint => ({
  storm_id: storm, source: "jma", point_type: "observed", advisory_number: null, valid_ts: ts, name_en: storm, name_local: `颱風${storm}`,
  center_lat: lat, center_lon: lon, center_pressure: 960, max_wind_kt: wind, ...extra,
});

describe("layerDataSummary helpers", () => {
  it("inBounds handles wrapped longitudes and whole-world views", () => {
    expect(inBounds(TAIPEI, 121.5, 25.05)).toBe(true);
    expect(inBounds(TAIPEI, 120.3, 22.6)).toBe(false);
    expect(inBounds([170, -10, 190, 10], -175, 0)).toBe(true); // crosses the antimeridian
    expect(inBounds([-200, -60, 200, 60], 10, 0)).toBe(true); // ≥360° wide
    expect(inBounds([-200, -60, 200, 60], 10, 70)).toBe(false);
  });

  it("registry unregisters only its own provider and serves the static aqiImagery pointer", () => {
    const a = () => ({ status: "data_not_loaded" } as const);
    const b = () => ({ status: "data_not_loaded" } as const);
    const offA = registerLayerDataProvider("x-test", a);
    const offB = registerLayerDataProvider("x-test", b);
    offA(); expect(layerDataProviderFor("x-test")).toBe(b);
    offB(); expect(layerDataProviderFor("x-test")).toBeNull();
    expect(layerDataProviderFor("aqiImagery")!(TAIWAN)).toMatchObject({ status: "not_applicable", reason: "raster", seeLayerKey: "aqiStations" });
  });
});

describe("aqiStations provider", () => {
  it("filters to the view and ranks the worst stations with their county", () => {
    const rows = [station("1", 121.5, 25.05, 60), station("2", 121.55, 25.1, 120), station("3", 120.3, 23.7, 160, "雲林縣"), station("4", 121.6, 25.0, null)];
    const local = ok(summarizeAqiStations(rows, TAIPEI));
    expect(local).toMatchObject({ featureCount: 3, max: { field: "aqi", value: 120, name: "站2" }, topAreas: { level: "county", items: [{ name: "臺北市", count: 3 }] } });
    expect(local.ranked!.items.map(item => item.value)).toEqual([120, 60]);
    const island = ok(summarizeAqiStations(rows, TAIWAN));
    expect(island.ranked!.items[0]).toMatchObject({ name: "站3", value: 160, area: "雲林縣", detail: "主要污染物 細懸浮微粒" });
  });

  it("reports not loaded for no data and stays within the wire limits for many stations", () => {
    expect(summarizeAqiStations([], TAIWAN)).toEqual({ status: "data_not_loaded" });
    const many = Array.from({ length: 400 }, (_, i) => station(String(i), 120 + (i % 20) * 0.1, 22 + Math.floor(i / 20) * 0.15, i, `縣市${i % 30}`));
    const summary = ok(summarizeAqiStations(many, TAIWAN));
    expect(summary.ranked!.items).toHaveLength(5);
    expect(summary.topAreas!.items).toHaveLength(5);
    expect(wireSafe(summary)).toBe(true);
  });
});

describe("youbikeFullness provider", () => {
  const centers: Record<string, [number, number]> = { a: [25.05, 121.5], b: [25.06, 121.52], c: [25.04, 121.55], far: [22.6, 120.3] };
  const center = (h: string) => { const value = centers[h]; if (!value) throw new Error("bad cell"); return value; };
  it("keeps cells whose center is in view; lowest 有車率 first, ties broken by more docks", () => {
    const cells = [{ h: "a", fr: 0.1, sc: 10 }, { h: "b", fr: 0.1, sc: 40 }, { h: "c", fr: 0.9, sc: 20 }, { h: "far", fr: 0, sc: 30 }, { h: "bogus", fr: 0.5, sc: 5 }];
    const summary = ok(summarizeYoubikeCells(cells, TAIPEI, center));
    expect(summary.featureCount).toBe(3);
    expect(summary.topAreas).toBeNull();
    expect(summary.max).toMatchObject({ field: "fr", value: 0.9, lngLat: [121.55, 25.04] });
    expect(summary.ranked!.items.map(item => item.lngLat)).toEqual([[121.52, 25.06], [121.5, 25.05], [121.55, 25.04]]);
  });

  it("handles empty data and caps the ranked list", () => {
    expect(summarizeYoubikeCells([], TAIPEI, center)).toEqual({ status: "data_not_loaded" });
    const many = Array.from({ length: 500 }, (_, i) => ({ h: `c${i}`, fr: (i % 97) / 97, sc: i % 13 }));
    const summary = ok(summarizeYoubikeCells(many, TAIPEI, () => [25.05, 121.5]));
    expect(summary.featureCount).toBe(500);
    expect(summary.ranked!.items).toHaveLength(5);
    expect(wireSafe(summary)).toBe(true);
  });
});

describe("earthquakesGlobal provider", () => {
  const now = 1_790_000_000;
  const window = { from: now - 86_400, to: now, label: "時間軸游標往前 1 天" };
  it("counts only the drawn time window inside the view; max carries place and time", () => {
    const events = [quake("in", 121.6, 24.0, 4.2, now - 3600), quake("big", 121.7, 23.5, 5.6, now - 7200), quake("old", 121.6, 24.1, 6.5, now - 3 * 86_400), quake("future", 121.6, 24.1, 7, now + 60), quake("japan", 140, 35, 6, now - 60)];
    const summary = ok(summarizeEarthquakes(events, TAIWAN, window));
    expect(summary.featureCount).toBe(2);
    expect(summary.max).toMatchObject({ field: "mag", value: 5.6, name: "地點big", at: new Date((now - 7200) * 1000).toISOString() });
    expect(summary.asOf).toBe(new Date((now - 3600) * 1000).toISOString());
    expect(summary.note).toContain("往前 1 天");
  });

  it("returns ok/zero in an empty view, not-loaded with no data, and caps the list", () => {
    expect(ok(summarizeEarthquakes([quake("j", 140, 35, 5, now - 60)], TAIWAN, window))).toMatchObject({ featureCount: 0, max: null });
    expect(summarizeEarthquakes([], TAIWAN, window)).toEqual({ status: "data_not_loaded" });
    const many = Array.from({ length: 3000 }, (_, i) => quake(String(i), -180 + (i % 360), -60 + (i % 120), 2 + (i % 50) / 10, now - i));
    const summary = ok(summarizeEarthquakes(many, [-200, -85, 200, 85], window));
    expect(summary.featureCount).toBe(3000);
    expect(summary.ranked!.items).toHaveLength(5);
    expect(wireSafe(summary)).toBe(true);
  });
});

describe("typhoonTracks provider", () => {
  const t0 = 1_790_000_000;
  const track = [typhoonPoint("A", t0, 123, 20, 80), typhoonPoint("A", t0 + 6 * 3600, 122.5, 21, 95)];
  it("names the active storm in view with its latest position and intensity", () => {
    const summary = ok(summarizeTyphoons(track, [118, 18, 126, 27], t0 + 7 * 3600));
    expect(summary.featureCount).toBe(1);
    expect(summary.max).toMatchObject({ field: "max_wind_kt", value: 95, name: "颱風A", lngLat: [122.5, 21] });
    expect(summary.ranked!.items[0]).toMatchObject({ detail: "中心氣壓 960 hPa" });
    expect(summary.note).toBeUndefined();
  });

  it("distinguishes no active storm, active-but-outside, and respects the source filter", () => {
    expect(ok(summarizeTyphoons(track, TAIWAN, t0 - 3600))).toMatchObject({ featureCount: 0, max: null, note: "此時間點沒有活動中的颱風" });
    expect(ok(summarizeTyphoons(track, TAIPEI, t0 + 7 * 3600))).toMatchObject({ featureCount: 0, note: "畫面內沒有活動颱風；畫面外有：颱風A" });
    expect(ok(summarizeTyphoons(track, [118, 18, 126, 27], t0 + 7 * 3600, "jtwc"))).toMatchObject({ featureCount: 0, note: "此時間點沒有活動中的颱風" });
    expect(summarizeTyphoons([], TAIWAN, t0)).toEqual({ status: "data_not_loaded" });
    expect(ok(summarizeTyphoons([], TAIWAN, t0, "all", true))).toMatchObject({ featureCount: 0, note: "此時間點沒有活動中的颱風" });
  });

  it("counts storms whose tracks are still drawn after the 48h current-position window", () => {
    const summary = ok(summarizeTyphoons(track, [118, 18, 126, 27], t0 + 10 * 86_400));
    expect(summary.featureCount).toBe(1);
    expect(summary.note).toContain("歷史軌跡");
    expect(summary.ranked!.items).toHaveLength(0);
  });

  it("caps many simultaneous storms", () => {
    const storms = Array.from({ length: 12 }, (_, i) => typhoonPoint(`S${i}`, t0, 101 + i * 5, 20, 40 + i));
    const summary = ok(summarizeTyphoons(storms, [100, 0, 160, 40], t0 + 60));
    expect(summary.featureCount).toBe(12);
    expect(summary.ranked!.items).toHaveLength(5);
    expect(summary.ranked!.items[0]!.value).toBe(51);
    expect(wireSafe(summary)).toBe(true);
  });
});

describe("summarizeAqiStations loaded flag", () => {
  it("returns ok with zero features for a completed empty fetch, data_not_loaded only while pending", () => {
    expect(summarizeAqiStations([], TAIWAN)).toEqual({ status: "data_not_loaded" });
    expect(ok(summarizeAqiStations([], TAIWAN, true))).toMatchObject({ featureCount: 0 });
  });
});

describe("visibleSummary × layer data providers", () => {
  const map: VisibleSummaryMap = {
    getBounds: () => ({ getWest: () => 121.4, getSouth: () => 24.95, getEast: () => 121.65, getNorth: () => 25.15 }),
    getStyle: () => ({ layers: [{ id: "rain-gauge-circle", type: "circle", source: "rain-gauge", paint: { "circle-radius": ["interpolate", ["linear"], ["coalesce", ["get", "precipitation_10min"], 0], 0, 2] } }] }),
    getLayer: id => (id === "rain-gauge-circle" ? {} : undefined),
    queryRenderedFeatures: () => [{ id: 1, source: "rain-gauge", geometry: { type: "Point", coordinates: [121.5, 25.05] }, properties: { precipitation_10min: 3, station_name: "x", town: "信義區" } }],
  };
  const custom = { sourcesFor: (key: string) => (key === "rainGauge" ? [{ kind: "custom" as const, note: "self-built" }] : [{ kind: "custom" as const, note: "three" }]) };

  it("uses the provider for custom renderers, tagged layer_data, with the viewport bounds", () => {
    let seen: DataBounds | null = null;
    const summary = summarizeVisibleLayers(map, ["aqiStations", "aqiImagery", "unregistered"], {
      ...custom, labelFor: key => `L-${key}`,
      dataProviderFor: key => (key === "aqiStations" ? bounds => { seen = bounds; return summarizeAqiStations([station("1", 121.5, 25.05, 88)], bounds); } : layerDataProviderFor(key)),
    });
    expect(seen).toEqual([121.4, 24.95, 121.65, 25.15]);
    expect(summary.layers[0]).toMatchObject({ layerKey: "aqiStations", label: "L-aqiStations", basis: "layer_data", status: "ok", featureCount: 1, max: { value: 88 } });
    expect(summary.layers[1]).toMatchObject({ layerKey: "aqiImagery", basis: "layer_data", status: "not_applicable", seeLayerKey: "aqiStations" });
    expect(summary.layers[2]).toEqual({ layerKey: "unregistered", status: "not_applicable", reason: "custom_renderer" });
    expect(wireSafe({ visibleSummary: summary })).toBe(true);
  });

  it("tells the agent to re-read when the layer data is not loaded yet", () => {
    const summary = summarizeVisibleLayers(map, ["aqiStations"], { ...custom, dataProviderFor: () => bounds => summarizeAqiStations([], bounds) });
    expect(summary.layers[0]).toMatchObject({ basis: "layer_data", status: "data_not_loaded", note: expect.stringContaining("再讀一次") });
  });

  it("falls back to custom_renderer when a provider throws", () => {
    const summary = summarizeVisibleLayers(map, ["boom"], { ...custom, dataProviderFor: () => () => { throw new Error("x"); } });
    expect(summary.layers[0]).toEqual({ layerKey: "boom", status: "not_applicable", reason: "custom_renderer" });
  });

  it("reads rainGauge through its self-built Mapbox source (rendered path)", () => {
    const summary = summarizeVisibleLayers(map, ["rainGauge"], custom);
    expect(summary.layers[0]).toMatchObject({ layerKey: "rainGauge", status: "ok", featureCount: 1, topAreas: { level: "town", items: [{ name: "信義區", count: 1 }] }, max: { field: "precipitation_10min", value: 3 } });
  });
});

describe("AG-6 timeline-slice custom layers read through their self-built sources", () => {
  const cases = [
    { key: "riverLevel", source: "river-level", layer: "river-level-circle", field: "delta_m", nameField: "station_name", name: "A站" },
    { key: "groundwater", source: "groundwater", layer: "groundwater-circle", field: "delta_m", nameField: "well_name", name: "B井" },
    { key: "iotWraRiver", source: "iot-wra-river", layer: "iot-wra-river-circle", field: "delta_m", nameField: "name", name: "C站" },
  ];
  for (const c of cases) {
    it(`${c.key} is summarized from rendered features, not custom_renderer`, () => {
      const map: VisibleSummaryMap = {
        getBounds: () => ({ getWest: () => 120, getSouth: () => 22, getEast: () => 122, getNorth: () => 25 }),
        getStyle: () => ({ layers: [{ id: c.layer, type: "circle", source: c.source, paint: { "circle-radius": ["interpolate", ["linear"], ["abs", ["coalesce", ["get", c.field], 0]], 0, 3, 5, 9] } }] }),
        getLayer: id => (id === c.layer ? {} : undefined),
        queryRenderedFeatures: () => [{ id: 1, source: c.source, geometry: { type: "Point", coordinates: [121, 24] }, properties: { [c.field]: 1.5, [c.nameField]: c.name } }],
      };
      const summary = summarizeVisibleLayers(map, [c.key], { sourcesFor: () => [{ kind: "custom" as const, note: "self-built" }] });
      expect(summary.layers[0]).toMatchObject({ layerKey: c.key, status: "ok", featureCount: 1, max: { field: c.field, value: 1.5, name: c.name } });
      expect(summary.layers[0]).not.toMatchObject({ reason: "custom_renderer" });
    });
  }

  it("source ids stay in sync with the hooks", () => {
    for (const [file, id] of [["useRiverLevelLayer", "river-level"], ["useGroundwaterLayer", "groundwater"], ["useIotWraRiverLayer", "iot-wra-river"]]) {
      expect(readFileSync(`src/hooks/${file}.ts`, "utf8")).toContain(`const SOURCE_ID = "${id}"`);
    }
  });
});

describe("typhoonTracks cross-agency merge", () => {
  it("folds JMA and JTWC readings of one storm into a single named row", () => {
    const t0 = 1_790_000_000;
    const jtwc = typhoonPoint("wp26", t0, 145.9, 19.4, 80, { source: "jtwc", name_local: "", name_en: "", center_pressure: null });
    const jma = typhoonPoint("2519", t0 + 3 * 3600, 146.1, 20.0, null, { name_local: "チョーイワン", name_en: "", center_pressure: 955 });
    const summary = ok(summarizeTyphoons([jtwc, jma], [140, 15, 150, 25], t0 + 4 * 3600));
    expect(summary.featureCount).toBe(1);
    expect(summary.ranked!.items[0]).toMatchObject({ name: "チョーイワン", value: 80, lngLat: [145.9, 19.4], detail: "中心氣壓 955 hPa" });
  });
});

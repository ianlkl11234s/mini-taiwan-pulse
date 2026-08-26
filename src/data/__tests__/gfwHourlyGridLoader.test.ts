import { afterEach, describe, expect, it, vi } from "vitest";
import {
  findGfwHourlyGridHour,
  floorUtcHourIso,
  loadGfwHourlyGridHour,
  parseGfwHourlyGridFeatureCollection,
  parseGfwHourlyGridManifest,
  resolveGfwHourlyGridManifestUrl,
} from "../gfwHourlyGridLoader";
import { parseGfwHourlyGridVessels } from "../gfwHourlyGridTypes";

const vessels = [
  { vessel_id: "v-1", mmsi: "123456789", ship_name: "ONE", vessel_type: "fishing", flag: "TW" },
  { vessel_id: "v-2", mmsi: null, ship_name: null, vessel_type: null, flag: null },
];

const manifestRaw = {
  schema_version: 1,
  generated_at: "2026-08-25T00:00:00Z",
  bbox: [122.434, 23.22953, 132.85274, 34.35812],
  date_start: "2026-08-15",
  date_end_inclusive: "2026-08-21",
  source_dataset: "public-global-presence:v4.0",
  temporal_resolution: "HOURLY",
  spatial_resolution: "HIGH",
  coordinate_semantics: "GFW_HIGH_grid_cell_center",
  hours: [
    { observed_at: "2026-08-15T00:00:00Z", path: "hours/20260815T00Z.geojson", cell_count: 1, vessel_count: 2 },
    { observed_at: "2026-08-15T01:00:00Z", path: "hours/20260815T01Z.geojson", cell_count: 2, vessel_count: 3 },
  ],
};

function unifiedOneDay() {
  const release = "2026-08-15";
  const hours = Array.from({ length: 24 }, (_, index) => {
    const observedAt = new Date(Date.parse(`${release}T00:00:00Z`) + index * 3_600_000)
      .toISOString().replace(".000Z", "Z");
    const compact = observedAt.replace(/[-:]/g, "").slice(0, 11);
    return {
      observed_at: observedAt,
      path: `releases/${release}/grid/hours/${compact}Z.geojson`,
      sha256: "b".repeat(64), bytes: 10, features: 2, vessel_count: 3,
    };
  });
  const darkHours = hours.map((hour) => ({
    observed_at: hour.observed_at,
    path: hour.path.replace("/grid/", "/dark_vessels/"),
    sha256: "c".repeat(64), bytes: 8, features: 0, detections: 0,
  }));
  return {
    schema_version: 2, release_id: release, latest_complete_date: release,
    date_start: release, date_end: release, generated_at: "2026-08-16T00:00:00Z",
    bbox: [122, 23, 133, 35],
    source: { dataset_alias: "public-global-presence:latest", resolved_dataset_versions: ["public-global-presence:v4.0"] },
    tracks: { days: [{
      display_date: release,
      path: `releases/${release}/tracks/days/${release}.geojson`,
      sha256: "a".repeat(64), bytes: 10, features: 1, points: 2,
      overlap: { lookback_hours: 3, lookahead_hours: 1 },
    }] },
    grid: { hours },
    dark_vessels: { latest_complete_date: release, date_start: release, date_end: release, hours: darkHours },
    retention: { published_releases_kept: 2 },
    cache_contract: {
      root_manifest: "public,max-age=60,s-maxage=60,stale-while-revalidate=300",
      immutable_release: "public,max-age=604800,s-maxage=604800,immutable",
    },
    attribution: { label: "Global Fishing Watch", href: "https://globalfishingwatch.org/" },
  };
}

function applyV3Contract(raw: ReturnType<typeof unifiedOneDay>) {
  const buckets = () => "0123456789abcdef".split("").map((bucket) => ({
    bucket, path: `releases/${raw.release_id}/details/${bucket}.json.gz`, sha256: bucket.repeat(64), bytes: 0, features: 0,
  }));
  Object.assign(raw, { full_fidelity: true });
  Object.assign(raw.source, { coordinate_semantics: "GFW_HIGH_grid_cell_center" });
  Object.assign(raw.grid, {
    geometry_semantics: "inferred_0_01_degree_footprint", source_layer: "gfw_grid",
    detail_contract: { bucket_count: 16, hash: "sha256_hex_prefix", prefix_length: 1, key: "cell_id", format: "json", content_encoding: "gzip" },
  });
  for (const hour of raw.grid.hours) Object.assign(hour, {
    format: "pmtiles", path: hour.path.replace(".geojson", ".pmtiles"), detail_buckets: buckets(),
  });
  Object.assign(raw.tracks, {
    source_layers: { edges: "gfw_track_edges", singletons: "gfw_track_singletons" },
    detail_contract: { bucket_count: 16, hash: "sha256_hex_prefix", prefix_length: 1, key: "track_id", format: "json", content_encoding: "gzip" },
    frames: raw.grid.hours.map((hour) => ({ observed_at: hour.observed_at, path: hour.path.replace("/grid/hours/", "/tracks/frames/").replace(".pmtiles", ".geojson.gz"), sha256: "f".repeat(64), bytes: 0, features: 0, format: "geojson", content_encoding: "gzip" })),
  });
  for (const day of raw.tracks.days) Object.assign(day, { format: "pmtiles", path: day.path.replace(".geojson", ".pmtiles"), detail_buckets: buckets() });
}

describe("GFW hourly grid contract", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("production 共用同域 unified root 並可 override，dev 優先 local grid manifest", () => {
    expect(resolveGfwHourlyGridManifestUrl("https://cdn.example/", false))
      .toBe("https://cdn.example/global-maritime/gfw-hourly/manifest.json");
    expect(resolveGfwHourlyGridManifestUrl("", true)).toBe("/gfw_hourly_grid_poc/manifest.json");
    expect(resolveGfwHourlyGridManifestUrl("https://cdn.example/", true)).toBe("/gfw_hourly_grid_poc/manifest.json");
    expect(resolveGfwHourlyGridManifestUrl("", false)).toBe("/global-maritime/gfw-hourly/manifest.json");
    expect(resolveGfwHourlyGridManifestUrl("https://cdn.example/", false, true))
      .toBe("https://cdn.example/global-maritime/gfw-hourly/v3-shadow/manifest.json");
    expect(resolveGfwHourlyGridManifestUrl("", true, true)).toBe("/gfw_hourly_grid_poc/manifest.json");
  });
  it("將 timeline 秒數向下取 UTC 整點，跨時才換 key", () => {
    expect(floorUtcHourIso(Date.parse("2026-08-15T00:00:00Z") / 1000)).toBe("2026-08-15T00:00:00Z");
    expect(floorUtcHourIso(Date.parse("2026-08-15T00:59:59Z") / 1000)).toBe("2026-08-15T00:00:00Z");
    expect(floorUtcHourIso(Date.parse("2026-08-15T01:00:00Z") / 1000)).toBe("2026-08-15T01:00:00Z");
  });

  it("只接受有序且符合 HOURLY/HIGH 契約的 manifest", () => {
    const manifest = parseGfwHourlyGridManifest(manifestRaw);
    expect(manifest?.hours).toHaveLength(2);
    expect(findGfwHourlyGridHour(manifest!, "2026-08-15T01:00:00Z")?.path).toBe("hours/20260815T01Z.geojson");
    expect(findGfwHourlyGridHour(manifest!, "2026-08-15T02:00:00Z")).toBeNull();
    expect(parseGfwHourlyGridManifest({ ...manifestRaw, spatial_resolution: "LOW" })).toBeNull();
    expect(parseGfwHourlyGridManifest({ ...manifestRaw, hours: [...manifestRaw.hours].reverse() })).toBeNull();
  });

  it("production unified root v2 只取 grid.hours，拒絕舊 v1 CDN manifest", () => {
    const url = "https://cdn.example/global-maritime/gfw-hourly/manifest.json";
    const parsed = parseGfwHourlyGridManifest(unifiedOneDay(), url);
    expect(parsed?.hours).toHaveLength(24);
    expect(parsed?.hours[0]?.path)
      .toBe("releases/2026-08-15/grid/hours/20260815T00Z.geojson");
    expect(parseGfwHourlyGridManifest(manifestRaw, url)).toBeNull();
  });

  it("v3 必須明確宣告 full_fidelity、Polygon footprint 與 GeoJSON/PMTiles format 邊界", async () => {
    const raw = unifiedOneDay();
    raw.schema_version = 3;
    applyV3Contract(raw);
    const counts = {
      candidate_features: 1, displayed_features: 1, published_features: 1,
      candidate_points: 2, displayed_points: 2, published_points: 2,
      omitted_features: 0, omitted_points: 0,
      cap_applied: false,
    };
    Object.assign(raw.tracks, { counts });
    const manifest = parseGfwHourlyGridManifest(raw, "https://cdn.example/global-maritime/gfw-hourly/manifest.json");
    expect(manifest).toMatchObject({ schemaVersion: 3, fullFidelity: true, geometrySemantics: "inferred_0_01_degree_footprint" });
    raw.grid.hours[0]!.path = "releases/2026-08-15/grid/hours/../escape.pmtiles";
    expect(parseGfwHourlyGridManifest(raw)).toBeNull();
    raw.grid.hours[0]!.path = "releases/2026-08-15/grid/hours/20260815T00Z.pmtiles";
    Object.assign(raw.grid, { source_layer: "unknown" });
    expect(parseGfwHourlyGridManifest(raw)).toBeNull();
    Object.assign(raw.grid, { source_layer: "gfw_grid" });
    counts.omitted_features = 1;
    expect(parseGfwHourlyGridManifest(raw)).toBeNull();
    counts.omitted_features = 0;
    counts.cap_applied = true;
    expect(parseGfwHourlyGridManifest(raw)).toBeNull();

    const polygon = {
      type: "FeatureCollection",
      features: [{
        type: "Feature",
        geometry: { type: "Polygon", coordinates: [[[123.49, 25.49], [123.51, 25.49], [123.51, 25.51], [123.49, 25.49]]] },
        properties: {
          cell_id: "high:123.50:25.50", center_lon: 123.5, center_lat: 25.5,
          observed_at: "2026-08-15T00:00:00Z", vessel_count: 2, vessels_json: JSON.stringify(vessels),
          source_dataset: "public-global-presence:v4.0",
        },
      }],
    };
    expect(parseGfwHourlyGridFeatureCollection(polygon, "2026-08-15T00:00:00Z", {
      fullFidelity: true, geometrySemantics: "inferred_0_01_degree_footprint",
    })?.features[0]?.properties).toMatchObject({
      full_fidelity: 1,
      coordinate_semantics: "GFW_HIGH_grid_cell_center",
      geometry_semantics: "inferred_0_01_degree_footprint",
    });

    const pmtiles = structuredClone(manifest!);
    pmtiles.hours[0]!.format = "pmtiles";
    expect(await loadGfwHourlyGridHour(pmtiles, "2026-08-15T00:00:00Z")).toBeNull();
  });

  it("驗證格網中心、船數及完整 vessels_json", () => {
    const raw = {
      type: "FeatureCollection",
      features: [{
        type: "Feature",
        geometry: { type: "Point", coordinates: [123.5, 25.5] },
        properties: {
          observed_at: "2026-08-15T00:00:00Z",
          grid_lon: 123.5,
          grid_lat: 25.5,
          vessel_count: 2,
          vessels_json: JSON.stringify(vessels),
          source_dataset: "public-global-presence:v4.0",
          coordinate_semantics: "GFW_HIGH_grid_cell_center",
        },
      }],
    };
    expect(parseGfwHourlyGridFeatureCollection(raw)?.features).toHaveLength(1);
    const badCount = structuredClone(raw);
    badCount.features[0]!.properties.vessel_count = 3;
    expect(parseGfwHourlyGridFeatureCollection(badCount)).toBeNull();
  });

  it("hour 暫時失敗不負向 cache，path 依 manifest origin resolve 且 immutable cache", async () => {
    const manifest = parseGfwHourlyGridManifest(manifestRaw)!;
    const raw = {
      type: "FeatureCollection",
      features: [{
        type: "Feature",
        geometry: { type: "Point", coordinates: [123.5, 25.5] },
        properties: {
          observed_at: "2026-08-15T00:00:00Z", grid_lon: 123.5, grid_lat: 25.5,
          vessel_count: 2, vessels_json: JSON.stringify(vessels),
          source_dataset: "public-global-presence:v4.0",
          coordinate_semantics: "GFW_HIGH_grid_cell_center",
        },
      }],
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({ ok: true, json: async () => raw });
    vi.stubGlobal("fetch", fetchMock);
    await expect(loadGfwHourlyGridHour(manifest, "2026-08-15T00:00:00Z")).resolves.toBeNull();
    await expect(loadGfwHourlyGridHour(manifest, "2026-08-15T00:00:00Z")).resolves.toMatchObject({ type: "FeatureCollection" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenLastCalledWith(
      "http://localhost/gfw_hourly_grid_poc/hours/20260815T00Z.geojson",
      { cache: "force-cache" },
    );
  });

  it("popup vessel parser 保留格內所有船，壞 JSON fail closed", () => {
    expect(parseGfwHourlyGridVessels(JSON.stringify(vessels))).toEqual([
      { vesselId: "v-1", mmsi: "123456789", shipName: "ONE", vesselType: "fishing", flag: "TW" },
      { vesselId: "v-2", mmsi: null, shipName: null, vesselType: null, flag: null },
    ]);
    expect(parseGfwHourlyGridVessels("not-json")).toBeNull();
  });
});

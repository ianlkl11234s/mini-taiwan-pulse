import { afterEach, describe, expect, it, vi } from "vitest";
import {
  gfwHourlyTracksFrame,
  gfwHourlyTracksUtcDate,
  loadGfwHourlyTrackManifest,
  loadGfwHourlyTracksDay,
  parseGfwHourlyTrackCollection,
  parseGfwHourlyTrackManifest,
  resolveGfwHourlyTracksManifestUrl,
} from "../gfwHourlyTracksLoader";

const times = [
  "2026-08-15T00:00:00+00:00",
  "2026-08-15T01:00:00+00:00",
  "2026-08-15T02:00:00+00:00",
  "2026-08-15T03:00:00+00:00",
];

function rawCollection() {
  return {
    type: "FeatureCollection",
    metadata: {
      schema_version: 1,
      display_date: "2026-08-15",
      display_timezone: "UTC",
      overlap: {
        lookback_hours: 3,
        lookahead_hours: 1,
        window_start: "2026-08-14T21:00:00+00:00",
        window_end: "2026-08-16T01:00:00+00:00",
      },
      supported_trail_hours: [0.5, 1, 2, 3],
      interpolation: "linear_between_adjacent_hourly_grid_centers",
      feature_count: 1,
      point_count: 4,
    },
    features: [{
      type: "Feature",
      geometry: { type: "LineString", coordinates: [[123, 24], [123.1, 24.1], [123.2, 24.2], [123.3, 24.3]] },
      properties: {
        vessel_id: "vessel-1",
        mmsi: "123456789",
        ship_name: "TEST SHIP",
        vessel_type: "CARGO",
        flag: "TW",
        segment_index: 0,
        approximate: true,
        source_dataset: "public-global-presence:v4.0",
        point_count: 4,
        observed_times: times,
        start_at: times[0],
        end_at: times[3],
      },
    }],
  };
}

function rawManifest() {
  return {
    schema_version: 1,
    release_id: "2026-08-21",
    latest_complete_date: "2026-08-21",
    date_start: "2026-08-15",
    date_end: "2026-08-21",
    generated_at: "2026-08-25T00:00:00+00:00",
    days: Array.from({ length: 7 }, (_, index) => {
      const displayDate = `2026-08-${String(15 + index).padStart(2, "0")}`;
      return {
        display_date: displayDate,
        path: `releases/2026-08-21/days/${displayDate}.geojson`,
        sha256: "a".repeat(64),
        bytes: 100,
        features: 2,
        points: 8,
        overlap: {},
      };
    }),
    track_contract: {
      frontend_load: "one_UTC_display_day_partition",
      supported_trail_hours: [0.5, 1, 2, 3],
      maximum_lookback_hours: 3,
      lookahead_hours_for_linear_interpolation: 1,
      interpolation: "linear_between_adjacent_hourly_grid_centers",
    },
  };
}

function rawUnifiedManifest() {
  const base = rawManifest();
  const hours = Array.from({ length: 7 * 24 }, (_, index) => {
    const observedAt = new Date(Date.parse("2026-08-15T00:00:00Z") + index * 3_600_000)
      .toISOString().replace(".000Z", "Z");
    const compact = observedAt.replace(/[-:]/g, "").slice(0, 11);
    return {
      observed_at: observedAt,
      path: `releases/2026-08-21/grid/hours/${compact}Z.geojson`,
      sha256: "b".repeat(64), bytes: 100, features: 2, vessel_count: 3,
    };
  });
  const darkHours = hours.map((hour) => ({
    observed_at: hour.observed_at,
    path: hour.path.replace("/grid/", "/dark_vessels/"),
    sha256: "c".repeat(64), bytes: 80, features: 0, detections: 0,
  }));
  return {
    schema_version: 2,
    release_id: "2026-08-21",
    latest_complete_date: "2026-08-21",
    date_start: "2026-08-15",
    date_end: "2026-08-21",
    generated_at: "2026-08-25T00:00:00Z",
    bbox: [122, 23, 133, 35],
    source: { dataset_alias: "public-global-presence:latest", resolved_dataset_versions: ["public-global-presence:v4.0"] },
    tracks: {
      days: base.days.map((day) => ({
        ...day,
        path: `releases/2026-08-21/tracks/days/${day.display_date}.geojson`,
        overlap: { lookback_hours: 3, lookahead_hours: 1 },
      })),
    },
    grid: { hours },
    dark_vessels: {
      latest_complete_date: "2026-08-21", date_start: "2026-08-15", date_end: "2026-08-21", hours: darkHours,
    },
    retention: { published_releases_kept: 2 },
    cache_contract: {
      root_manifest: "public,max-age=60,s-maxage=60,stale-while-revalidate=300",
      immutable_release: "public,max-age=604800,s-maxage=604800,immutable",
    },
    attribution: { label: "Global Fishing Watch", href: "https://globalfishingwatch.org/" },
  };
}

function applyV3Contract(raw: ReturnType<typeof rawUnifiedManifest>) {
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

describe("GFW hourly sampled-track contract", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("production 預設同域 CDN path 並可 override，dev 優先 local POC", () => {
    expect(resolveGfwHourlyTracksManifestUrl("https://cdn.example/", false, false))
      .toBe("https://cdn.example/global-maritime/gfw-hourly/manifest.json");
    expect(resolveGfwHourlyTracksManifestUrl("", true, false))
      .toBe("/gfw_hourly_tracks_poc/manifest.json");
    expect(resolveGfwHourlyTracksManifestUrl("https://cdn.example/", true, false))
      .toBe("/gfw_hourly_tracks_poc/manifest.json");
    expect(resolveGfwHourlyTracksManifestUrl("", false, false))
      .toBe("/global-maritime/gfw-hourly/manifest.json");
    expect(resolveGfwHourlyTracksManifestUrl("", false, true))
      .toBe("/global-maritime/gfw-hourly/v3-shadow/manifest.json");
  });

  it("root manifest 每次都以 no-cache 讀取當前環境 URL", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => rawUnifiedManifest() });
    vi.stubGlobal("fetch", fetchMock);
    await expect(loadGfwHourlyTrackManifest()).resolves.toMatchObject({ releaseId: "2026-08-21" });
    expect(fetchMock).toHaveBeenCalledWith(
      "/gfw_hourly_tracks_poc/manifest.json",
      { cache: "no-cache" },
    );
  });
  it("接受 daily schema v1 且 observed_times 與座標一對一、UTC、嚴格遞增", () => {
    const parsed = parseGfwHourlyTrackCollection(rawCollection(), "2026-08-15");
    expect(parsed?.tracks).toHaveLength(1);
    expect(parsed?.tracks[0]?.observedTimes).toEqual(times);
    expect(parsed?.displayDate).toBe("2026-08-15");
  });

  it("manifest 嚴格驗證 release、latest date、daily path 與單日載入契約", () => {
    const parsed = parseGfwHourlyTrackManifest(rawManifest());
    expect(parsed).toMatchObject({
      releaseId: "2026-08-21",
      dateStart: "2026-08-15",
      dateEnd: "2026-08-21",
      latestCompleteDate: "2026-08-21",
    });
    expect(parsed?.days.get("2026-08-18")?.path)
      .toBe("releases/2026-08-21/days/2026-08-18.geojson");

    for (const value of [undefined, "2026-08-32", "2026/08/21", "2026-08-21T00:00:00Z"]) {
      const raw = rawManifest();
      raw.latest_complete_date = value as string;
      expect(parseGfwHourlyTrackManifest(raw)).toBeNull();
    }
    const unsafe = rawManifest();
    unsafe.days[0]!.path = "../2026-08-15.geojson";
    expect(parseGfwHourlyTrackManifest(unsafe)).toBeNull();
    const wrongContract = rawManifest();
    wrongContract.track_contract.frontend_load = "seven_day_bundle";
    expect(parseGfwHourlyTrackManifest(wrongContract)).toBeNull();

    const missingMiddle = rawManifest();
    missingMiddle.days.splice(3, 1);
    expect(parseGfwHourlyTrackManifest(missingMiddle)).toBeNull();
  });

  it("production unified root v2 只取 tracks.days，拒絕舊 v1 CDN manifest", () => {
    const url = "https://cdn.example/global-maritime/gfw-hourly/manifest.json";
    const parsed = parseGfwHourlyTrackManifest(rawUnifiedManifest(), url);
    expect(parsed?.days.size).toBe(7);
    expect(parsed?.days.get("2026-08-15")?.path)
      .toBe("releases/2026-08-21/tracks/days/2026-08-15.geojson");
    expect(parseGfwHourlyTrackManifest(rawManifest(), url)).toBeNull();
  });

  it("v3 只有 counts 完整相等且 cap_applied=false 才驗證 full fidelity", () => {
    const raw = rawUnifiedManifest();
    raw.schema_version = 3;
    applyV3Contract(raw);
    const counts = {
      candidate_features: 14, displayed_features: 14, published_features: 14,
      candidate_points: 56, displayed_points: 56, published_points: 56,
      omitted_features: 0, omitted_points: 0,
      cap_applied: false,
    };
    Object.assign(raw.tracks, { counts });
    expect(parseGfwHourlyTrackManifest(raw, "https://cdn.example/global-maritime/gfw-hourly/manifest.json"))
      .toMatchObject({ fullFidelity: true });
    counts.displayed_points = 55;
    expect(parseGfwHourlyTrackManifest(raw, "https://cdn.example/global-maritime/gfw-hourly/manifest.json")).toBeNull();
    counts.displayed_points = 56;
    counts.omitted_points = 1;
    expect(parseGfwHourlyTrackManifest(raw, "https://cdn.example/global-maritime/gfw-hourly/manifest.json")).toBeNull();
  });

  it("daily display_date 不符預期或 overlap 不足時 fail closed", () => {
    expect(parseGfwHourlyTrackCollection(rawCollection(), "2026-08-16")).toBeNull();
    const short = rawCollection();
    short.metadata.overlap.lookback_hours = 2;
    expect(parseGfwHourlyTrackCollection(short, "2026-08-15")).toBeNull();
  });

  it("daily HTTP 暫時失敗不會被永久 cache，下次可重試", async () => {
    const manifest = {
      manifestUrl: "/gfw_hourly_tracks_poc/manifest.json",
      releaseId: "2026-09-01",
      latestCompleteDate: "2026-09-01",
      dateStart: "2026-09-01",
      dateEnd: "2026-09-01",
      generatedAt: null,
      fullFidelity: false,
      days: new Map([["2026-09-01", {
        displayDate: "2026-09-01",
        path: "releases/2026-09-01/days/2026-09-01.geojson",
        bytes: 10,
        features: 0,
        points: 0,
      }]]),
    };
    const emptyDay = {
      type: "FeatureCollection",
      metadata: {
        schema_version: 1,
        display_date: "2026-09-01",
        display_timezone: "UTC",
        overlap: {
          lookback_hours: 3,
          lookahead_hours: 1,
          window_start: "2026-08-31T21:00:00+00:00",
          window_end: "2026-09-02T01:00:00+00:00",
        },
        supported_trail_hours: [0.5, 1, 2, 3],
        interpolation: "linear_between_adjacent_hourly_grid_centers",
        feature_count: 0,
        point_count: 0,
      },
      features: [],
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({ ok: true, json: async () => emptyDay });
    vi.stubGlobal("fetch", fetchMock);

    await expect(loadGfwHourlyTracksDay(manifest, "2026-09-01")).resolves.toBeNull();
    await expect(loadGfwHourlyTracksDay(manifest, "2026-09-01")).resolves.toMatchObject({ displayDate: "2026-09-01" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenLastCalledWith(
      "http://localhost/gfw_hourly_tracks_poc/releases/2026-09-01/days/2026-09-01.geojson",
      { cache: "force-cache" },
    );
  });

  it("時間缺漏、長度錯位、非 UTC 或端點不一致時整份 fail closed", () => {
    const missing = rawCollection();
    delete (missing.features[0]!.properties as Partial<typeof missing.features[0]["properties"]>).observed_times;
    expect(parseGfwHourlyTrackCollection(missing, "2026-08-15")).toBeNull();

    const shifted = rawCollection();
    shifted.features[0]!.properties.observed_times = times.slice(0, 3);
    expect(parseGfwHourlyTrackCollection(shifted, "2026-08-15")).toBeNull();

    const local = rawCollection();
    local.features[0]!.properties.observed_times = [...times.slice(0, 3), "2026-08-15T03:00:00"];
    local.features[0]!.properties.end_at = "2026-08-15T03:00:00";
    expect(parseGfwHourlyTrackCollection(local, "2026-08-15")).toBeNull();

    const wrongEnd = rawCollection();
    wrongEnd.features[0]!.properties.end_at = times[2]!;
    expect(parseGfwHourlyTrackCollection(wrongEnd, "2026-08-15")).toBeNull();
  });

  it("在相鄰觀測之間以時間比例線性內插船頭", () => {
    const parsed = parseGfwHourlyTrackCollection(rawCollection(), "2026-08-15")!;
    const midpoint = gfwHourlyTracksFrame(parsed, Date.parse("2026-08-15T00:30:00Z") / 1000, 2);
    expect((midpoint.lines.features[0]!.geometry as GeoJSON.LineString).coordinates).toEqual([
      [123, 24], [123.05, 24.05],
    ]);
    expect((midpoint.endpoints.features[0]!.geometry as GeoJSON.Point).coordinates).toEqual([123.05, 24.05]);
    expect(midpoint.endpoints.features[0]!.properties).toMatchObject({
      selected_time: "2026-08-15T00:30:00.000Z",
      interpolated: 1,
      endpoint: "selected_time",
      ship_type_bucket: "cargo",
      ship_type_label: "貨船 Cargo",
    });
  });

  it("0.5 小時拖尾依選定時間精確裁切", () => {
    const parsed = parseGfwHourlyTrackCollection(rawCollection(), "2026-08-15")!;
    const frame = gfwHourlyTracksFrame(parsed, Date.parse("2026-08-15T02:30:00Z") / 1000, 0.5);
    expect((frame.lines.features[0]!.geometry as GeoJSON.LineString).coordinates).toEqual([
      [123.2, 24.2], [123.25, 24.25],
    ]);
  });

  it("拖尾起點落在兩觀測之間時也內插裁切", () => {
    const parsed = parseGfwHourlyTrackCollection(rawCollection(), "2026-08-15")!;
    const frame = gfwHourlyTracksFrame(parsed, Date.parse("2026-08-15T02:30:00Z") / 1000, 2);
    expect((frame.lines.features[0]!.geometry as GeoJSON.LineString).coordinates).toEqual([
      [123.05, 24.05], [123.1, 24.1], [123.2, 24.2], [123.25, 24.25],
    ]);
    expect(frame.lines.features[0]!.properties).toMatchObject({
      start_at: "2026-08-15T00:30:00.000Z",
      end_at: "2026-08-15T02:30:00.000Z",
      point_count: 4,
      interpolated: 1,
    });
  });

  it("精確觀測時刻使用原座標，不標成內插", () => {
    const parsed = parseGfwHourlyTrackCollection(rawCollection(), "2026-08-15")!;
    const frame = gfwHourlyTracksFrame(parsed, Date.parse("2026-08-15T02:00:00Z") / 1000, 2);
    expect((frame.endpoints.features[0]!.geometry as GeoJSON.Point).coordinates).toEqual([123.2, 24.2]);
    expect(frame.endpoints.features[0]!.properties).toMatchObject({
      selected_time: "2026-08-15T02:00:00.000Z",
      interpolated: 0,
    });
  });

  it("各 exporter segment 獨立裁線，不跨 gap 補線", () => {
    const raw = rawCollection();
    raw.features = [
      {
        ...raw.features[0]!,
        geometry: { type: "LineString", coordinates: [[123, 24], [123.1, 24.1]] },
        properties: {
          ...raw.features[0]!.properties,
          point_count: 2,
          observed_times: times.slice(0, 2),
          start_at: times[0],
          end_at: times[1],
        },
      },
      {
        ...raw.features[0]!,
        geometry: { type: "LineString", coordinates: [[124, 25], [124.1, 25.1]] },
        properties: {
          ...raw.features[0]!.properties,
          segment_index: 1,
          point_count: 2,
          observed_times: [times[2]!, times[3]!],
          start_at: times[2]!,
          end_at: times[3]!,
        },
      },
    ];
    raw.metadata.feature_count = 2;
    const parsed = parseGfwHourlyTrackCollection(raw, "2026-08-15")!;
    const frame = gfwHourlyTracksFrame(parsed, Date.parse("2026-08-15T02:30:00Z") / 1000, 3);
    expect(frame.lines.features).toHaveLength(2);
    expect((frame.lines.features[0]!.geometry as GeoJSON.LineString).coordinates).toEqual([[123, 24], [123.1, 24.1]]);
    expect((frame.lines.features[1]!.geometry as GeoJSON.LineString).coordinates).toEqual([[124, 25], [124.05, 25.05]]);
    expect(frame.endpoints.features).toHaveLength(1);
  });

  it("同一精確 runtime 座標端點聚合、sqrt count 可供圖層使用，並保留完整多船清單", () => {
    const raw = rawCollection();
    raw.features.push({
      ...raw.features[0]!,
      properties: {
        ...raw.features[0]!.properties, vessel_id: "vessel-2", ship_name: "FISHER", vessel_type: "FISHING",
      },
    });
    raw.metadata.feature_count = 2;
    raw.metadata.point_count = 8;
    const frame = gfwHourlyTracksFrame(
      parseGfwHourlyTrackCollection(raw, "2026-08-15", true)!,
      Date.parse("2026-08-15T02:30:00Z") / 1000,
      0.5,
    );
    expect(frame.endpoints.features).toHaveLength(1);
    expect(frame.endpoints.features[0]!.properties).toMatchObject({ vessel_count: 2, mixed_type: 1, full_fidelity: 1 });
    expect(JSON.parse(String(frame.endpoints.features[0]!.properties?.vessels_json))).toEqual([
      expect.objectContaining({ vessel_id: "vessel-1", ship_name: "TEST SHIP" }),
      expect.objectContaining({ vessel_id: "vessel-2", ship_name: "FISHER" }),
    ]);
  });

  it("不在 segment 首末外外插假船頭，但保留時間視窗內的真實歷史線", () => {
    const parsed = parseGfwHourlyTrackCollection(rawCollection(), "2026-08-15")!;
    const before = gfwHourlyTracksFrame(parsed, Date.parse("2026-08-14T23:30:00Z") / 1000, 3);
    expect(before.lines.features).toHaveLength(0);
    expect(before.endpoints.features).toHaveLength(0);

    const after = gfwHourlyTracksFrame(parsed, Date.parse("2026-08-15T04:00:00Z") / 1000, 3);
    expect(after.lines.features).toHaveLength(1);
    expect(after.endpoints.features).toHaveLength(0);

    const expired = gfwHourlyTracksFrame(parsed, Date.parse("2026-08-15T07:00:01Z") / 1000, 3);
    expect(expired.lines.features).toHaveLength(0);
    expect(expired.endpoints.features).toHaveLength(0);
  });

  it("timeStore unix 秒依 UTC 日切 partition key", () => {
    expect(gfwHourlyTracksUtcDate(Date.parse("2026-08-15T23:59:59Z") / 1000)).toBe("2026-08-15");
    expect(gfwHourlyTracksUtcDate(Date.parse("2026-08-16T00:00:00Z") / 1000)).toBe("2026-08-16");
    expect(gfwHourlyTracksUtcDate(Number.NaN)).toBeNull();
  });
});

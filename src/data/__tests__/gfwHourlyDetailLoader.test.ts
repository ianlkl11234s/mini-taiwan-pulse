import { afterEach, describe, expect, it, vi } from "vitest";
import {
  __testOnly,
  canonicalGfwGridCellId,
  hasVerifiedGfwGridVesselList,
  hydrateGfwGridDetail,
  loadGfwGridCellDetail,
  needsGfwGridDetailHydration,
  setGfwHourlyGridDetailContext,
  setGfwHourlyGridDominantHour,
  gfwDetailBucketForKey,
  hydrateGfwTrackDetail,
  setGfwHourlyTracksDetailContext,
} from "../gfwHourlyDetailLoader";
import { gzipSync } from "node:zlib";
import type { GfwHourlyGridManifest } from "../gfwHourlyGridLoader";
import { parseGfwHourlyGridVessels, serializeGfwHourlyGridVessels } from "../gfwHourlyGridTypes";
import { gfwHourlyTrackFrameEndpoints, gfwHourlyTrackFrameTrail, parseGfwHourlyTrackFrame } from "../gfwHourlyTracksLoader";

const vessels = [{ vessel_id: "v-1", mmsi: "123", ship_name: "ONE", vessel_type: "fishing", flag: "TW" }];
const epoch = Date.parse("2026-08-15T00:00:00Z") / 1000;
const fullMember = {
  vessel_id: "v-1", mmsi: "123", ship_name: "ONE", vessel_type: "fishing", flag: "TW",
  imo: "IMO123", callsign: "CALL", dataset: "public-global-vessel-identity:v4.0", geartype: "TUNA_PURSE_SEINES",
  first_transmission_date: "2024-01-01T00:00:00Z", last_transmission_date: "2026-08-22T00:00:00Z",
  hours: 1, entry_timestamp: "2026-08-21T00:00:00Z", exit_timestamp: "2026-08-21T01:00:00Z",
};

describe("GFW v3 detail/frame contract", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    setGfwHourlyGridDetailContext(null);
    setGfwHourlyTracksDetailContext(null, "formal-v4");
    setGfwHourlyTracksDetailContext(null);
  });
  it("normalized vessel serializer 可回傳 popup parser 所需的 snake_case wire JSON", () => {
    const normalized = [{ vesselId: "v-1", mmsi: "123", shipName: "ONE", vesselType: "fishing", flag: "TW" }];
    expect(JSON.parse(serializeGfwHourlyGridVessels(normalized))).toEqual(vessels);
    expect(parseGfwHourlyGridVessels(serializeGfwHourlyGridVessels(normalized))).toEqual(normalized);
  });

  it("只有完整且船數相符的 inline vessels_json 才跳過 grid sidecar hydrate", () => {
    const base = { vessel_count: 1 };
    expect(hasVerifiedGfwGridVesselList({ ...base, vessels_json: JSON.stringify(vessels) })).toBe(true);
    expect(hasVerifiedGfwGridVesselList({ ...base, vessels_json: "not-json" })).toBe(false);
    expect(hasVerifiedGfwGridVesselList({ ...base, vessels_json: "[]" })).toBe(false);
    expect(hasVerifiedGfwGridVesselList({ vessel_count: 2, vessels_json: JSON.stringify(vessels) })).toBe(false);
    expect(needsGfwGridDetailHydration({ ...base, vessels_json: JSON.stringify(vessels) })).toBe(false);
    expect(needsGfwGridDetailHydration({
      ...base,
      vessels_json: JSON.stringify(vessels),
      geometry_semantics: "inferred_0_01_degree_footprint",
    })).toBe(true);
  });

  it("grid click 將 cell_id、grid_id 或 feature.id 規範為 sidecar key", () => {
    expect(canonicalGfwGridCellId({ cell_id: "cell-primary", grid_id: "cell-secondary" }, "feature-id")).toBe("cell-primary");
    expect(canonicalGfwGridCellId({ grid_id: "cell-secondary" }, "feature-id")).toBe("cell-secondary");
    expect(canonicalGfwGridCellId({}, "feature-id")).toBe("feature-id");
    expect(canonicalGfwGridCellId({ cell_id: "", grid_id: "cell-secondary" }, "feature-id")).toBe("cell-secondary");
    expect(canonicalGfwGridCellId({}, undefined)).toBeNull();
  });

  it("grid bucket 必須和 release/hour/bucket/count/member 全部相符", () => {
    const raw = {
      schema_version: 1, release_id: "2026-08-15", observed_at: "2026-08-15T00:00:00Z", bucket: "a", key: "cell_id",
      entry_count: 1, vessel_count: 1, entries: { "cell-a": { vessel_count: 1, vessels } },
    };
    expect(__testOnly.parseGridEntries(raw, { releaseId: "2026-08-15", observedAt: "2026-08-15T00:00:00Z", bucket: "a" })?.get("cell-a")?.vessels).toHaveLength(1);
    raw.vessel_count = 2;
    expect(__testOnly.parseGridEntries(raw, { releaseId: "2026-08-15", observedAt: "2026-08-15T00:00:00Z", bucket: "a" })).toBeNull();
  });

  it("v4 adaptive shard 僅接受完整 14 欄 member 與自洽 cell/count", () => {
    const raw = {
      schema_version: 1, observed_at: "2026-08-21T00:00:00Z", key: "cell_id",
      entry_count: 1, vessel_count: 1,
      entries: { "cell-a": { vessel_count: 1, members: [fullMember] } },
    };
    const parsed = __testOnly.parseAdaptiveGridEntries(raw, "2026-08-21T00:00:00Z");
    expect(parsed?.get("cell-a")?.vessels[0]).toMatchObject({
      vesselId: "v-1", imo: "IMO123", callsign: "CALL", dataset: "public-global-vessel-identity:v4.0",
      geartype: "TUNA_PURSE_SEINES", hours: 1,
      entryTimestamp: "2026-08-21T00:00:00Z", exitTimestamp: "2026-08-21T01:00:00Z",
    });
    const incomplete = structuredClone(raw);
    delete (incomplete.entries["cell-a"].members[0] as Partial<typeof fullMember>).callsign;
    expect(__testOnly.parseAdaptiveGridEntries(incomplete, "2026-08-21T00:00:00Z")).toBeNull();
    const badCount = structuredClone(raw);
    badCount.vessel_count = 2;
    expect(__testOnly.parseAdaptiveGridEntries(badCount, "2026-08-21T00:00:00Z")).toBeNull();
  });

  it("v4 MVT detail_shard 直讀 adaptive shard；Vite transparent gzip 仍守 manifest bytes 與完整內容契約", async () => {
    const payload = JSON.stringify({
      schema_version: 1, observed_at: "2026-08-21T00:00:00Z", key: "cell_id",
      entry_count: 1, vessel_count: 1,
      entries: { "cell-a": { vessel_count: 1, members: [fullMember] } },
    });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new TextEncoder().encode(payload).buffer,
      headers: new Headers({ "content-encoding": "gzip", "content-length": "321" }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const hour = {
      observedAt: "2026-08-21T00:00:00Z", detailMode: "adaptive-shard" as const,
      detailBuckets: [{
        bucket: "part-0000.json.gz", path: "grid/details/20260821T00Z/part-0000.json.gz",
        sha256: "a".repeat(64), bytes: 321, features: 1,
      }],
    };
    await expect(loadGfwGridCellDetail(
      "/gfw-v4-poc/manifest.json", "2026-08-21", hour, "cell-a", "part-0000.json.gz",
    )).resolves.toMatchObject({ vesselCount: 1 });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost/gfw-v4-poc/grid/details/20260821T00Z/part-0000.json.gz",
      { cache: "force-cache" },
    );
    await expect(loadGfwGridCellDetail(
      "/gfw-v4-poc/manifest.json", "2026-08-21", hour, "cell-a", "../escape.json.gz",
    )).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("v4 ring hit feature 可用主導小時 fallback 載入完整 popup members", async () => {
    const observedAt = "2026-08-21T00:00:00Z";
    const payload = JSON.stringify({
      schema_version: 1, observed_at: observedAt, key: "cell_id",
      entry_count: 1, vessel_count: 1,
      entries: { "cell-a": { vessel_count: 1, members: [fullMember] } },
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new TextEncoder().encode(payload).buffer,
      headers: new Headers({ "content-encoding": "gzip", "content-length": "321" }),
    }));
    setGfwHourlyGridDetailContext({
      manifestUrl: "/gfw-v4-poc/manifest.json",
      releaseId: "2026-08-21",
      fullFidelity: true,
      attribution: { label: "Global Fishing Watch", href: "https://globalfishingwatch.org/" },
      hours: [{
        observedAt,
        detailMode: "adaptive-shard",
        detailBuckets: [{
          bucket: "part-0000.json.gz", path: "grid/details/20260821T00Z/part-0000.json.gz",
          sha256: "a".repeat(64), bytes: 321, features: 1,
        }],
      }],
    } as unknown as GfwHourlyGridManifest);
    setGfwHourlyGridDominantHour(observedAt);
    await expect(hydrateGfwGridDetail({
      cell_id: "cell-a", vessel_count: 1, detail_shard: "part-0000.json.gz",
    })).resolves.toMatchObject({ detail_status: "loaded", vessel_count: 1, full_fidelity: 1 });
  });

  it("grid hydrate loaded 結果可被 popup parser 解析完整船舶清單", () => {
    const props = __testOnly.loadedGfwGridDetailProperties(
      { cell_id: "cell-a", vessel_count: 1 },
      { vesselCount: 1, vessels: parseGfwHourlyGridVessels(vessels)! },
      { label: "Global Fishing Watch", href: "https://globalfishingwatch.org/" },
    );
    expect(props).toMatchObject({ detail_status: "loaded", full_fidelity: 1, vessel_count: 1 });
    expect(parseGfwHourlyGridVessels(props.vessels_json)).toEqual(parseGfwHourlyGridVessels(vessels));
  });

  it("track sidecar 拒絕 point count/time order 不自洽", () => {
    const raw = {
      schema_version: 1, release_id: "2026-08-15", display_date: "2026-08-15", bucket: "b", key: "track_id",
      entry_count: 1, point_count: 2, entries: { "t-1": {
        track_id: "t-1", vessel_id: "v-1", mmsi: "123", ship_name: "ONE", vessel_type: "fishing", flag: "TW",
        start_at: "2026-08-15T00:00:00Z", end_at: "2026-08-15T01:00:00Z", point_count: 2,
        observed_times: ["2026-08-15T00:00:00Z", "2026-08-15T01:00:00Z"],
      } },
    };
    expect(__testOnly.parseTrackEntries(raw, { releaseId: "2026-08-15", displayDate: "2026-08-15", bucket: "b" })?.get("t-1")?.pointCount).toBe(2);
    raw.entries["t-1"].observed_times.reverse();
    expect(__testOnly.parseTrackEntries(raw, { releaseId: "2026-08-15", displayDate: "2026-08-15", bucket: "b" })).toBeNull();
  });

  it("formal track detail uses vessel-bucket plus hash namespace; legacy pure hash stays valid", () => {
    const entry = (bucket: string, path: string) => ({ bucket, path, sha256: "a".repeat(64), bytes: 1, features: 1 });
    const formal = { displayDate: "2026-08-21", detailBuckets: [
      entry("fishing:a", "tracks/fishing/tracks/details/2026-08-21/a.json.gz"),
      entry("cargo:a", "tracks/cargo/tracks/details/2026-08-21/a.json.gz"),
      entry("passenger:a", "tracks/passenger/tracks/details/2026-08-21/a.json.gz"),
    ] };
    expect(__testOnly.selectTrackDetailEntry(formal, "a", "passenger")?.path).toContain("tracks/passenger/");
    expect(__testOnly.selectTrackDetailEntry(formal, "a", "cargo")?.path).toContain("tracks/cargo/");
    expect(__testOnly.selectTrackDetailEntry(formal, "a")).toBeNull();
    const legacy = { displayDate: "2026-08-15", detailBuckets: [entry("a", "tracks/details/a.json.gz")] };
    expect(__testOnly.selectTrackDetailEntry(legacy, "a")?.path).toBe("tracks/details/a.json.gz");
  });

  it("formal Passenger hydrate selects its own same-hash shard and returns complete members", async () => {
    const trackId = "passenger-track";
    const hash = await gfwDetailBucketForKey(trackId);
    expect(hash).toMatch(/^[0-9a-f]$/);
    const payload = new TextEncoder().encode(JSON.stringify({
      schema_version: 1, release_id: "2026-08-21__v4", display_date: "2026-08-21", bucket: hash, key: "track_id", entry_count: 1, point_count: 2,
      entries: { [trackId]: { track_id: trackId, vessel_id: "passenger-vessel", mmsi: "123", ship_name: "P", vessel_type: "PASSENGER", flag: "TW", start_at: "2026-08-21T12:00:00Z", end_at: "2026-08-21T13:00:00Z", point_count: 2, observed_times: ["2026-08-21T12:00:00Z", "2026-08-21T13:00:00Z"] } },
    }));
    const zipped = gzipSync(payload);
    const digest = await crypto.subtle.digest("SHA-256", zipped);
    const sha256 = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
    const passengerPath = `releases/2026-08-21__v4/tracks/passenger/tracks/details/2026-08-21/${hash}.json.gz`;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => zipped.buffer.slice(zipped.byteOffset, zipped.byteOffset + zipped.byteLength), headers: new Headers() }));
    setGfwHourlyTracksDetailContext({ manifestUrl: "/global-maritime/gfw-hourly/v4/manifest.json", releaseId: "2026-08-21__v4", latestCompleteDate: "2026-08-21", dateStart: "2026-08-21", dateEnd: "2026-08-21", generatedAt: null, fullFidelity: true, days: new Map([["2026-08-21", { displayDate: "2026-08-21", path: "", bytes: 0, features: 0, points: 0, format: "pmtiles", detailBuckets: [
      { bucket: `fishing:${hash}`, path: `releases/2026-08-21__v4/tracks/fishing/tracks/details/2026-08-21/${hash}.json.gz`, sha256, bytes: zipped.byteLength, features: 1 },
      { bucket: `cargo:${hash}`, path: `releases/2026-08-21__v4/tracks/cargo/tracks/details/2026-08-21/${hash}.json.gz`, sha256, bytes: zipped.byteLength, features: 1 },
      { bucket: `passenger:${hash}`, path: passengerPath, sha256, bytes: zipped.byteLength, features: 1 },
    ] }]]), attribution: { label: "Global Fishing Watch", href: "https://globalfishingwatch.org/" } } as never, "formal-v4");
    // React keeps both hooks mounted.  The fallback cleanup must not erase the
    // verified formal context that took ownership after v4 became ready.
    setGfwHourlyTracksDetailContext(null);
    await expect(hydrateGfwTrackDetail({ track_id: trackId, track_ids_json: JSON.stringify([trackId]), track_buckets_json: JSON.stringify([[trackId, "passenger"]]), ship_type_bucket: "passenger", vessel_count: 1, display_date: "2026-08-21", selected_time: "2026-08-21T12:30:00Z" })).resolves.toMatchObject({ detail_status: "loaded", vessel_id: "passenger-vessel", vessel_count: 1 });
    expect(fetch).toHaveBeenCalledWith(`http://localhost/global-maritime/gfw-hourly/v4/${passengerPath}`, { cache: "force-cache" });
  });

  it("frame 僅在同 segment 的 to_* 全欄位有效時內插，並保留同座標所有成員", () => {
    const raw = { type: "FeatureCollection", features: [
      { type: "Feature", geometry: { type: "Point", coordinates: [120, 23] }, properties: { track_id: "t-1", vessel_id: "v-1", vessel_type: "fishing", ship_type_bucket: "special", observed_epoch: epoch, to_epoch: epoch + 3600, to_lon: 121, to_lat: 24 } },
      { type: "Feature", geometry: { type: "Point", coordinates: [120.5, 23.5] }, properties: { track_id: "t-2", vessel_id: "v-2", vessel_type: "cargo", observed_epoch: epoch, to_epoch: epoch + 3600, to_lon: 121, to_lat: 24 } },
    ] };
    const nodes = parseGfwHourlyTrackFrame(raw, "2026-08-15T00:00:00Z");
    expect(nodes).not.toBeNull();
    const endpoints = gfwHourlyTrackFrameEndpoints(nodes!, epoch + 3600, true);
    expect(endpoints.features).toHaveLength(1);
    expect(endpoints.features[0]?.properties).toMatchObject({ vessel_count: 2, mixed_type: 1, full_fidelity: 1 });
    expect(endpoints.features[0]?.properties?.ship_type_bucket).toBe("mixed");
    (raw.features[0]!.properties as Record<string, unknown>).to_lon = undefined;
    expect(parseGfwHourlyTrackFrame(raw, "2026-08-15T00:00:00Z")).toBeNull();
  });

  it("半小時 trail 只裁出已發生的 segment，不把無 to_* 的觀測 hold 成未來線", () => {
    const parsed = parseGfwHourlyTrackFrame({ type: "FeatureCollection", features: [
      { type: "Feature", geometry: { type: "Point", coordinates: [120, 23] }, properties: { track_id: "t-1", vessel_id: "v-1", vessel_type: "cargo", ship_type_bucket: "special", observed_epoch: epoch, to_epoch: epoch + 3600, to_lon: 122, to_lat: 25 } },
      { type: "Feature", geometry: { type: "Point", coordinates: [119, 22] }, properties: { track_id: "t-2", vessel_id: "v-2", vessel_type: "fishing", observed_epoch: epoch } },
    ] }, "2026-08-15T00:00:00Z")!;
    const frame = gfwHourlyTrackFrameTrail(new Map([[epoch, parsed]]), epoch + 1800, 0.5, true, "2026-08-15");
    expect(frame.lines.features).toHaveLength(1);
    expect(frame.lines.features[0]?.geometry).toMatchObject({ coordinates: [[120, 23], [121, 24]] });
    // End is clipped at 00:30; no coordinate after selected time appears.
    expect(frame.lines.features[0]?.properties).toMatchObject({ display_date: "2026-08-15", ship_type_bucket: "special" });
    expect(frame.endpoints.features).toHaveLength(1);
  });
});

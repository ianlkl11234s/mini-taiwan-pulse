import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  loadGfwFishingEffortDay,
  loadGfwFishingEffortManifest,
  parseGfwFishingEffortCollection,
  parseGfwFishingEffortManifest,
} from "../gfwFishingEffortLoader";

const DATE = "2026-08-21";
const VERSION = "public-global-fishing-effort:v4.0";
const FEATURE_COUNT = 2_887;

function rawManifest(apparentFishingHours = FEATURE_COUNT) {
  return {
    schema_version: 1,
    release_id: DATE,
    selected_utc_date: DATE,
    generated_at: "2026-08-27T16:58:28.024681+00:00",
    bbox: [115.93462, 20.36314, 134.73486, 36.52495],
    shadow_only: true,
    poc: true,
    production_cutover: false,
    immutable_local_output: true,
    layer_separation: { gfwFishingEffort: "independent_layer_3" },
    fishing_effort: {
      independent_layer: true,
      presence_identity_contract_shared: false,
      dataset_alias: "public-global-fishing-effort:latest",
      date: DATE,
      resolved_dataset_version: VERSION,
      latest_observed_active_date: "2026-08-23",
      finalization_status: "not_provided_by_gfw",
      revision_semantics: "dynamic_api_data_may_be_revised",
      asset: {
        type: "fishing_effort_daily_sample",
        path: `fishing-effort/${DATE}.geojson.gz`,
        bytes: 123,
        sha256: "a".repeat(64),
        features: FEATURE_COUNT,
        apparent_fishing_hours: apparentFishingHours,
      },
    },
  };
}

function rawCollection() {
  const facets = JSON.stringify([{ flag: "CHN", geartype: "FISHING" }]);
  return {
    type: "FeatureCollection",
    metadata: {
      schema_version: 1,
      date: DATE,
      temporal_resolution: "DAILY",
      spatial_resolution: "LOW",
      metric: "apparent_fishing_hours",
      unit: "hours",
      resolved_dataset_version: VERSION,
      latest_observed_active_date: "2026-08-23",
      finalization_status: "not_provided_by_gfw",
      revision_semantics: "dynamic_api_data_may_be_revised",
      latest_available_date: null,
      latest_available_date_status: "not_provided_by_gfw",
      caveat: "Apparent/model-derived and non-realtime; not vessel presence",
      attribution: "Powered by Global Fishing Watch. https://globalfishingwatch.org/",
      source_accessed_at: "2026-08-27T16:25:08.752982+00:00",
      source_response_sha256: "b".repeat(64),
      quality: {
        boundary_overlap_rows: 0,
        exact_duplicate_rows: 0,
        invalid_rows: 0,
        negative_hours_rejected: 0,
        valid_rows: FEATURE_COUNT,
        wrong_day_rows: 0,
      },
    },
    features: Array.from({ length: FEATURE_COUNT }, (_, index) => ({
      type: "Feature",
      id: `effort-${index}`,
      geometry: {
        type: "Polygon",
        coordinates: [[[120, 23], [120.1, 23], [120.1, 23.1], [120, 23.1], [120, 23]]],
      },
      properties: {
        aggregation_facets_json: facets,
        apparent_fishing_hours: 1,
        component_count: 1,
        date: DATE,
        metric_semantics: "apparent_model_derived_fishing_hours",
        resolved_dataset_version: VERSION,
      },
    })),
  };
}

describe("GFW Fishing Effort shadow contract", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("formal release 無法驗證時 fail closed", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("location", { search: "" });
    await expect(loadGfwFishingEffortManifest()).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledWith("/global-maritime/gfw-hourly/v4/manifest.json", { cache: "no-cache" });
  });

  it("只接受獨立 shadow layer 與指定 date/version/latest/finalization/revision 契約", () => {
    expect(parseGfwFishingEffortManifest(rawManifest())?.asset).toMatchObject({
      features: FEATURE_COUNT,
      apparentFishingHours: FEATURE_COUNT,
    });

    const sharedIdentity = structuredClone(rawManifest());
    sharedIdentity.fishing_effort.presence_identity_contract_shared = true;
    expect(parseGfwFishingEffortManifest(sharedIdentity)).toBeNull();

    const finalized = structuredClone(rawManifest());
    finalized.fishing_effort.finalization_status = "finalized";
    expect(parseGfwFishingEffortManifest(finalized)).toBeNull();

    const wrongPath = structuredClone(rawManifest());
    wrongPath.fishing_effort.asset.path = "../outside.geojson.gz";
    expect(parseGfwFishingEffortManifest(wrongPath)).toBeNull();
  });

  it("嚴格驗 2,887 個 LOW 0.1° Polygon、非負 hours、component 與 facets 長度", () => {
    const manifest = parseGfwFishingEffortManifest(rawManifest())!;
    const collection = rawCollection();
    const parsed = parseGfwFishingEffortCollection(collection, manifest);
    expect(parsed?.features).toHaveLength(FEATURE_COUNT);
    expect(parsed?.features[0]?.properties).toMatchObject({
      selected_utc_date: DATE,
      metric: "apparent_fishing_hours",
      unit: "hours",
      dataset_version: VERSION,
      latest_available_date: null,
      latest_available_date_status: "not_provided_by_gfw",
      finalization_status: "not_provided_by_gfw",
      revision_semantics: "dynamic_api_data_may_be_revised",
      attribution: "Powered by Global Fishing Watch. https://globalfishingwatch.org/",
      attribution_href: "https://globalfishingwatch.org/",
      caveat: "Apparent/model-derived and non-realtime; not vessel presence",
    });

    const badFacets = structuredClone(collection);
    badFacets.features[0]!.properties.component_count = 2;
    expect(parseGfwFishingEffortCollection(badFacets, manifest)).toBeNull();

    const negative = structuredClone(collection);
    negative.features[0]!.properties.apparent_fishing_hours = -0.1;
    expect(parseGfwFishingEffortCollection(negative, manifest)).toBeNull();

    const wrongCell = structuredClone(collection);
    wrongCell.features[0]!.geometry.coordinates[0]![1]![0] = 120.2;
    expect(parseGfwFishingEffortCollection(wrongCell, manifest)).toBeNull();

    const missing = structuredClone(collection);
    missing.features.pop();
    expect(parseGfwFishingEffortCollection(missing, manifest)).toBeNull();
  });

  it("先驗 compressed bytes/SHA，再解 gzip JSON", async () => {
    const collection = rawCollection();
    const compressed = gzipSync(JSON.stringify(collection));
    const bytes = compressed.buffer.slice(
      compressed.byteOffset,
      compressed.byteOffset + compressed.byteLength,
    ) as ArrayBuffer;
    const raw = rawManifest();
    raw.fishing_effort.asset.bytes = compressed.byteLength;
    raw.fishing_effort.asset.sha256 = createHash("sha256").update(compressed).digest("hex");
    const fetchMock = vi.fn().mockResolvedValueOnce({ ok: true, arrayBuffer: async () => bytes });
    vi.stubGlobal("fetch", fetchMock);

    const manifest = parseGfwFishingEffortManifest(raw)!;
    await expect(loadGfwFishingEffortDay(manifest)).resolves.toMatchObject({
      type: "FeatureCollection",
      features: expect.any(Array),
    });
    expect(fetchMock).toHaveBeenNthCalledWith(1, "http://localhost/global-maritime/gfw-hourly/v4/fishing-effort/2026-08-21.geojson.gz", { cache: "force-cache" });
  });

  it("compressed size 或 SHA 不符時 fail closed 且不接受 decoded payload", async () => {
    vi.stubEnv("DEV", true);
    const compressed = gzipSync(JSON.stringify(rawCollection()));
    const bytes = compressed.buffer.slice(
      compressed.byteOffset,
      compressed.byteOffset + compressed.byteLength,
    ) as ArrayBuffer;
    const digest = createHash("sha256").update(compressed).digest("hex");
    const parsed = parseGfwFishingEffortManifest(rawManifest())!;
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => bytes });
    vi.stubGlobal("fetch", fetchMock);

    await expect(loadGfwFishingEffortDay({
      ...parsed,
      releaseId: "bad-size",
      asset: { ...parsed.asset, bytes: compressed.byteLength + 1, sha256: digest },
    })).resolves.toBeNull();
    await expect(loadGfwFishingEffortDay({
      ...parsed,
      releaseId: "bad-sha",
      asset: { ...parsed.asset, bytes: compressed.byteLength, sha256: "f".repeat(64) },
    })).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

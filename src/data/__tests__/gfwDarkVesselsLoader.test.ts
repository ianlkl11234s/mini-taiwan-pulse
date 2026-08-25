import { afterEach, describe, expect, it, vi } from "vitest";
import {
  loadGfwDarkVesselsHour,
  parseGfwDarkVesselsHour,
  parseGfwDarkVesselsManifest,
  resolveGfwDarkVesselsManifestUrl,
} from "../gfwDarkVesselsLoader";

const RELEASE = "2026-08-21";
const HOUR = "2026-08-15T00:00:00Z";

function compactHour(observedAt: string): string {
  return `${observedAt.replace(/[-:]/g, "").slice(0, 11)}Z`;
}

function unifiedManifest() {
  const hours = Array.from({ length: 7 * 24 }, (_, index) => {
    const observedAt = new Date(Date.parse(HOUR) + index * 3_600_000)
      .toISOString().replace(".000Z", "Z");
    const compact = compactHour(observedAt);
    return { observedAt, compact };
  });
  return {
    schema_version: 2,
    release_id: RELEASE,
    latest_complete_date: RELEASE,
    date_start: "2026-08-15",
    date_end: RELEASE,
    generated_at: "2026-08-22T02:00:00Z",
    bbox: [122, 23, 133, 35],
    source: {
      dataset_alias: "public-global-presence:latest",
      resolved_dataset_versions: ["public-global-presence:v4.0", "public-global-sar-presence:v4.0"],
    },
    tracks: { days: Array.from({ length: 7 }, (_, index) => {
      const date = new Date(Date.parse("2026-08-15T00:00:00Z") + index * 86_400_000)
        .toISOString().slice(0, 10);
      return {
        display_date: date,
        path: `releases/${RELEASE}/tracks/days/${date}.geojson`,
        sha256: "a".repeat(64), bytes: 1, features: 0, points: 0,
        overlap: { lookback_hours: 3, lookahead_hours: 1 },
      };
    }) },
    grid: { hours: hours.map(({ observedAt, compact }) => ({
      observed_at: observedAt,
      path: `releases/${RELEASE}/grid/hours/${compact}.geojson`,
      sha256: "b".repeat(64), bytes: 1, features: 0, vessel_count: 0,
    })) },
    dark_vessels: {
      latest_complete_date: RELEASE,
      date_start: "2026-08-15",
      date_end: RELEASE,
      hours: hours.map(({ observedAt, compact }, index) => ({
        observed_at: observedAt.replace("Z", "+00:00"),
        path: `releases/${RELEASE}/dark_vessels/hours/${compact}.geojson`,
        sha256: "c".repeat(64), bytes: 10,
        features: index === 0 ? 1 : 0,
        detections: index === 0 ? 2 : 0,
      })),
    },
    retention: { published_releases_kept: 2 },
    cache_contract: {
      root_manifest: "public,max-age=60,s-maxage=60,stale-while-revalidate=300",
      immutable_release: "public,max-age=604800,s-maxage=604800,immutable",
    },
    attribution: { label: "Global Fishing Watch", href: "https://globalfishingwatch.org/" },
  };
}

function validHour() {
  return {
    type: "FeatureCollection",
    metadata: {
      observed_at: HOUR.replace("Z", "+00:00"),
      temporal_resolution: "HOURLY",
      spatial_resolution: "HIGH",
      semantic_label: "SAR detection unmatched to AIS",
      not_proof_of_dark_or_illegal_vessel: true,
      feature_count: 1,
      detection_count: 2,
    },
    features: [{
      type: "Feature",
      geometry: { type: "Point", coordinates: [123.5, 24.5] },
      properties: {
        observed_at: HOUR.replace("Z", "+00:00"),
        detections: 2,
        source_dataset: "public-global-sar-presence:v4.0",
        matched_to_ais: false,
        matching_semantics: "SAR_detection_not_matched_to_AIS",
        coordinate_semantics: "GFW_HIGH_grid_cell_center",
        semantic_label: "SAR detection unmatched to AIS",
        interpretation_note: "Not proof of a dark or illegal vessel.",
      },
    }],
  };
}

describe("GFW SAR unmatched-to-AIS contract", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("dev/production 共用 unified root，production 可選 CDN origin override", () => {
    expect(resolveGfwDarkVesselsManifestUrl("", false))
      .toBe("/global-maritime/gfw-hourly/manifest.json");
    expect(resolveGfwDarkVesselsManifestUrl("https://cdn.example/", false))
      .toBe("https://cdn.example/global-maritime/gfw-hourly/manifest.json");
    expect(resolveGfwDarkVesselsManifestUrl("", true))
      .toBe("/global-maritime/gfw-hourly/manifest.json");
  });

  it("只接受連續 168 小時 dark_vessels 契約並使用獨立 latest date", () => {
    const raw = unifiedManifest();
    const parsed = parseGfwDarkVesselsManifest(raw, "/global-maritime/gfw-hourly/manifest.json");
    expect(parsed?.latestCompleteDate).toBe(RELEASE);
    expect(parsed?.hours.size).toBe(168);
    expect(parsed?.hours.get(HOUR)).toMatchObject({ features: 1, detections: 2 });
    expect(parsed?.hours.get(HOUR)?.observedAt).toBe(HOUR);

    raw.dark_vessels.hours.splice(10, 1);
    expect(parseGfwDarkVesselsManifest(raw, "/global-maritime/gfw-hourly/manifest.json")).toBeNull();
  });

  it("驗證 HIGH 格網中心、SAR unmatched 語意、metadata 與數量", () => {
    expect(parseGfwDarkVesselsHour(validHour(), HOUR)?.features).toHaveLength(1);

    const matched = structuredClone(validHour());
    matched.features[0]!.properties.matched_to_ais = true;
    expect(parseGfwDarkVesselsHour(matched, HOUR)).toBeNull();

    const exactClaim = structuredClone(validHour());
    exactClaim.features[0]!.properties.coordinate_semantics = "exact_SAR_detection";
    expect(parseGfwDarkVesselsHour(exactClaim, HOUR)).toBeNull();

    const badCount = structuredClone(validHour());
    badCount.metadata.detection_count = 3;
    expect(parseGfwDarkVesselsHour(badCount, HOUR)).toBeNull();
  });

  it("空 hour 仍是合法成品", () => {
    const empty = validHour();
    empty.metadata.feature_count = 0;
    empty.metadata.detection_count = 0;
    empty.features = [];
    expect(parseGfwDarkVesselsHour(empty, HOUR)).toEqual({ type: "FeatureCollection", features: [] });
  });

  it("hour 暫時失敗不負向 cache，並相對 manifest origin 載入 immutable asset", async () => {
    const manifest = parseGfwDarkVesselsManifest(
      unifiedManifest(),
      "https://cdn.example/global-maritime/gfw-hourly/manifest.json",
    )!;
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({ ok: true, json: async () => validHour() });
    vi.stubGlobal("fetch", fetchMock);

    await expect(loadGfwDarkVesselsHour(manifest, HOUR)).resolves.toBeNull();
    await expect(loadGfwDarkVesselsHour(manifest, HOUR)).resolves.toMatchObject({ features: [{}] });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenLastCalledWith(
      `https://cdn.example/global-maritime/gfw-hourly/releases/${RELEASE}/dark_vessels/hours/20260815T00Z.geojson`,
      { cache: "force-cache" },
    );
  });
});

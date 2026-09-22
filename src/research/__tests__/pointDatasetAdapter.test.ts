import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { clearPointDatasetCache, loadPointDataset } from "../pointDatasetAdapter";
import { clearPointPartitionCache } from "../pointDatasetPartitions";

const sourceSha256 = "a".repeat(64);
const encoder = new TextEncoder();
const hash = async (value: unknown) => [...new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(JSON.stringify(value))))].map(byte => byte.toString(16).padStart(2, "0")).join("");
const feature = (sourceOrdinal: number, geometry: unknown, code: string | null) => ({ type: "Feature", sourceOrdinal, geometry, properties: { code, nullable: null } });
const collection = (features: unknown[]) => ({ type: "FeatureCollection", features });

async function fixture(includeUnlocated = true) {
  const west = collection([feature(2, { type: "Point", coordinates: [120.1, 23.1] }, "west")]);
  const east = collection([feature(0, { type: "Point", coordinates: [121.1, 24.1] }, "east")]);
  const unlocated = collection([feature(1, null, null)]);
  const bodies = includeUnlocated ? [west, east, unlocated] : [west, east];
  const shards = await Promise.all(bodies.map(async (body, index) => {
    const sha256 = await hash(body); const bytes = encoder.encode(JSON.stringify(body)).byteLength;
    return { body, sha256, bytes, featureCount: 1, bbox: index === 0 ? [120, 23, 120.25, 23.25] : index === 1 ? [121, 24, 121.25, 24.25] : null };
  }));
  const manifest = { schemaVersion: "pulse-point-partitions/1", source: { sha256: sourceSha256, bytes: 999, featureCount: bodies.length, reference: "/education/schools.geojson" }, cellDegrees: 0.25,
    shards: shards.map(({ sha256, bytes, featureCount, bbox }) => ({ path: `${sha256}.geojson`, sha256, bytes, featureCount, bbox })) };
  const manifestSha256 = await hash(manifest);
  const responses = new Map<string, string>([["/education/partitions/manifest.json", JSON.stringify(manifest)], ...shards.map(shard => [`/education/partitions/${shard.sha256}.geojson`, JSON.stringify(shard.body)] as const)]);
  return { manifestSha256, responses };
}

beforeEach(() => { clearPointDatasetCache(); clearPointPartitionCache(); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("point dataset spatial partitions", () => {
  it("returns zero network cost for a warm full-source cache", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(collection([feature(0, { type: "Point", coordinates: [121, 25] }, "one")])), { headers: { "content-type": "application/geo+json" } })));
    const config = { datasetId: "full", url: "/education/full.geojson", idField: "code", safeFields: ["code"] };
    expect(await loadPointDataset(config)).toMatchObject({ requests: 1, downloadedBytes: expect.any(Number), cacheHit: false });
    expect(await loadPointDataset(config)).toMatchObject({ requests: 0, downloadedBytes: 0, cacheHit: true });
  });
  it("selects bbox shards plus the null shard, preserves original identity and keeps null semantics", async () => {
    const data = await fixture(); const fetcher = vi.fn(async (url: string) => new Response(data.responses.get(url), { headers: { "content-type": "application/geo+json" } })); vi.stubGlobal("fetch", fetcher);
    const config = { datasetId: "schools", url: "/education/schools.geojson", idField: "code", safeFields: ["code", "nullable"], spatialPartition: { manifestUrl: "/education/partitions/manifest.json", manifestSha256: data.manifestSha256, sourceSha256 } };
    const first = await loadPointDataset(config, { bbox: [120.05, 23.05, 120.2, 23.2] });
    expect(first.rows).toEqual([expect.objectContaining({ code: "west", nullable: null, record_id: `${sourceSha256}-2` })]);
    expect(first.exclusions).toEqual({ missing_geometry: 1, non_point_geometry: 0, invalid_geometry: 0 });
    expect(first).toMatchObject({ checksumSha256: sourceSha256, requests: 3, cacheHit: false });
    const second = await loadPointDataset(config, { bbox: [121.05, 24.05, 121.2, 24.2] });
    expect(second.rows).toEqual([expect.objectContaining({ code: "east", record_id: `${sourceSha256}-0` })]);
    expect(second).toMatchObject({ downloadedBytes: expect.any(Number), requests: 1, cacheHit: false });
    expect(fetcher).toHaveBeenCalledTimes(4);
  });

  it("shares concurrent immutable asset reads without reusing a bbox snapshot", async () => {
    const data = await fixture(); const fetcher = vi.fn(async (url: string) => new Response(data.responses.get(url), { headers: { "content-type": "application/geo+json" } })); vi.stubGlobal("fetch", fetcher);
    const config = { datasetId: "schools", url: "/education/schools.geojson", idField: "code", safeFields: ["code"], spatialPartition: { manifestUrl: "/education/partitions/manifest.json", manifestSha256: data.manifestSha256, sourceSha256 } };
    const [one, two] = await Promise.all([loadPointDataset(config, { bbox: [120.05, 23.05, 120.2, 23.2] }), loadPointDataset(config, { bbox: [120.05, 23.05, 120.2, 23.2] })]);
    expect(one.rows).toEqual(two.rows); expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it("rejects SHA and selected-shard scope tampering", async () => {
    const data = await fixture();
    vi.stubGlobal("fetch", vi.fn(async (url: string) => new Response(url.includes("manifest") ? "{}" : data.responses.get(url), { headers: { "content-type": "application/geo+json" } })));
    const config = { datasetId: "schools", url: "/education/schools.geojson", idField: "code", safeFields: ["code"], spatialPartition: { manifestUrl: "/education/partitions/manifest.json", manifestSha256: data.manifestSha256, sourceSha256 } };
    await expect(loadPointDataset(config, { bbox: [120.05, 23.05, 120.2, 23.2] })).rejects.toThrow("PARTITION_SHA_MISMATCH");
  });

  it("rejects unsafe manifest paths and accepts an outside bbox as an empty scoped result", async () => {
    const data = await fixture(false); const fetcher = vi.fn(async (url: string) => new Response(data.responses.get(url), { headers: { "content-type": "application/geo+json" } })); vi.stubGlobal("fetch", fetcher);
    const config = { datasetId: "schools", url: "/education/schools.geojson", idField: "code", safeFields: ["code"], spatialPartition: { manifestUrl: "/education/partitions/manifest.json", manifestSha256: data.manifestSha256, sourceSha256 } };
    await expect(loadPointDataset(config, { bbox: [130, 30, 131, 31] })).resolves.toMatchObject({ rows: [], requests: 1 });
    await expect(loadPointDataset({ ...config, spatialPartition: { ...config.spatialPartition, manifestUrl: "/education/partitions/../manifest.json" } }, { bbox: [120, 23, 121, 24] })).rejects.toThrow("INVALID_PARTITION_CONFIG");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("permits the fixed local partition mount while rejecting encoded path escapes", async () => {
    const data = await fixture(false);
    vi.stubGlobal("fetch", vi.fn(async (url: string) => new Response(data.responses.get(url === "/__local-research-point-partitions/schools/manifest.json" ? "/education/partitions/manifest.json" : url), { headers: { "content-type": "application/geo+json" } })));
    const config = { datasetId: "schools", url: "/education/schools.geojson", idField: "code", safeFields: ["code"], spatialPartition: { manifestUrl: "/__local-research-point-partitions/schools/manifest.json", manifestSha256: data.manifestSha256, sourceSha256 } };
    await expect(loadPointDataset(config, { bbox: [130, 30, 131, 31] })).resolves.toMatchObject({ rows: [] });
    await expect(loadPointDataset({ ...config, spatialPartition: { ...config.spatialPartition, manifestUrl: "/__local-research-point-partitions/%2e%2e/manifest.json" } }, { bbox: [130, 30, 131, 31] })).rejects.toThrow("INVALID_PARTITION_CONFIG");
  });

  it("does not begin a partition request when its signal is already aborted", async () => {
    const data = await fixture(); const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    const controller = new AbortController(); controller.abort();
    const config = { datasetId: "schools", url: "/education/schools.geojson", idField: "code", safeFields: ["code"], spatialPartition: { manifestUrl: "/education/partitions/manifest.json", manifestSha256: data.manifestSha256, sourceSha256 } };
    await expect(loadPointDataset(config, { bbox: [120.05, 23.05, 120.2, 23.2], signal: controller.signal })).rejects.toMatchObject({ name: "AbortError" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("aborts the underlying fetch when its last subscriber cancels", async () => {
    const data = await fixture(false); let requestSignal: AbortSignal | undefined;
    vi.stubGlobal("fetch", vi.fn((_url: string, init?: RequestInit) => new Promise<Response>((_resolve, reject) => { requestSignal = init?.signal ?? undefined; requestSignal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true }); })));
    const controller = new AbortController(); const config = { datasetId: "schools", url: "/education/schools.geojson", idField: "code", safeFields: ["code"], spatialPartition: { manifestUrl: "/education/partitions/manifest.json", manifestSha256: data.manifestSha256, sourceSha256 } };
    const pending = loadPointDataset(config, { bbox: [130, 30, 131, 31], signal: controller.signal });
    await Promise.resolve(); controller.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" }); expect(requestSignal?.aborted).toBe(true);
  });

  it("keeps a shared fetch alive while another subscriber remains", async () => {
    const data = await fixture(false); let resolveFetch: ((response: Response) => void) | undefined; let requestSignal: AbortSignal | undefined;
    vi.stubGlobal("fetch", vi.fn((_url: string, init?: RequestInit) => new Promise<Response>(resolve => { requestSignal = init?.signal ?? undefined; resolveFetch = resolve; })));
    const first = new AbortController(), second = new AbortController(); const config = { datasetId: "schools", url: "/education/schools.geojson", idField: "code", safeFields: ["code"], spatialPartition: { manifestUrl: "/education/partitions/manifest.json", manifestSha256: data.manifestSha256, sourceSha256 } };
    const one = loadPointDataset(config, { bbox: [130, 30, 131, 31], signal: first.signal }); const two = loadPointDataset(config, { bbox: [130, 30, 131, 31], signal: second.signal });
    await Promise.resolve(); first.abort(); await expect(one).rejects.toMatchObject({ name: "AbortError" }); expect(requestSignal?.aborted).toBe(false);
    resolveFetch!(new Response(data.responses.get("/education/partitions/manifest.json"), { headers: { "content-type": "application/geo+json" } }));
    await expect(two).resolves.toMatchObject({ rows: [] }); expect(requestSignal?.aborted).toBe(false);
  });

  it("starts a fresh fetch when retrying before an aborted request settles", async () => {
    const data = await fixture(false); let calls = 0;
    vi.stubGlobal("fetch", vi.fn((_url: string, init?: RequestInit) => {
      calls++;
      if (calls === 1) return new Promise<Response>(() => { void init; });
      return Promise.resolve(new Response(data.responses.get("/education/partitions/manifest.json"), { headers: { "content-type": "application/geo+json" } }));
    }));
    const controller = new AbortController(); const config = { datasetId: "schools", url: "/education/schools.geojson", idField: "code", safeFields: ["code"], spatialPartition: { manifestUrl: "/education/partitions/manifest.json", manifestSha256: data.manifestSha256, sourceSha256 } };
    const cancelled = loadPointDataset(config, { bbox: [130, 30, 131, 31], signal: controller.signal });
    await Promise.resolve(); controller.abort(); await expect(cancelled).rejects.toMatchObject({ name: "AbortError" });
    await expect(loadPointDataset(config, { bbox: [130, 30, 131, 31] })).resolves.toMatchObject({ rows: [] });
    expect(calls).toBe(2);
  });

  it("applies one timeout to manifest and shard work together", async () => {
    vi.useFakeTimers(); const data = await fixture();
    vi.stubGlobal("fetch", vi.fn((_url: string, init?: RequestInit) => new Promise<Response>((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true }))));
    const config = { datasetId: "schools", url: "/education/schools.geojson", idField: "code", safeFields: ["code"], spatialPartition: { manifestUrl: "/education/partitions/manifest.json", manifestSha256: data.manifestSha256, sourceSha256 } };
    const pending = loadPointDataset(config, { bbox: [120.05, 23.05, 120.2, 23.2] });
    const assertion = expect(pending).rejects.toThrow("REQUEST_TIMEOUT");
    await vi.advanceTimersByTimeAsync(15_000);
    await assertion;
  });

  it.skipIf(!existsSync("../runtime/point-partitions/schools/manifest.json"))("matches the full schools source for the real bbox without renumbering records", async () => {
    const root = "../runtime/point-partitions/schools";
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      const path = url === "/education/schools.geojson" ? "../runtime/oracle-assets/schools.geojson"
        : url === "/education/point-partitions/schools/manifest.json" ? `${root}/manifest.json`
          : `${root}/${url.slice("/education/point-partitions/schools/".length)}`;
      return new Response(readFileSync(path), { headers: { "content-type": "application/geo+json" } });
    }));
    const fields = ["school_level", "code", "school_name", "city", "district", "address", "phone", "website", "system_type", "region_type"];
    const shared = { datasetId: "schools", url: "/education/schools.geojson", idField: "code", safeFields: fields };
    const bbox: [number, number, number, number] = [120.42, 23.1, 120.66, 23.32];
    const partitioned = await loadPointDataset({ ...shared, spatialPartition: { manifestUrl: "/education/point-partitions/schools/manifest.json", manifestSha256: "a531452a19ddb104634096baf99f13065479630bf6443063602eb9e7999da09b", sourceSha256: "7ab34ec23180077bcd32f4617ff31404f1a21c68706d36b2a74a3c4b079377c3" } }, { bbox });
    const full = await loadPointDataset(shared);
    const expected = full.rows.filter(row => {
      const coordinates = (row.geometry as { coordinates: number[] }).coordinates;
      return coordinates[0]! >= bbox[0] && coordinates[0]! <= bbox[2] && coordinates[1]! >= bbox[1] && coordinates[1]! <= bbox[3];
    });
    const exact = partitioned.rows.filter(row => {
      const coordinates = (row.geometry as { coordinates: number[] }).coordinates;
      return coordinates[0]! >= bbox[0] && coordinates[0]! <= bbox[2] && coordinates[1]! >= bbox[1] && coordinates[1]! <= bbox[3];
    });
    expect(exact).toEqual(expected); expect(exact).toHaveLength(12);
    expect(partitioned.bytes).toBeLessThan(full.bytes);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchJpMedicalJsonAsset, jpMedicalLayerAsset, loadJpMedicalHours, retryJpMedicalCatalog } from "../jpMedicalLoader";

const encoder = new TextEncoder();
async function digest(value: unknown) {
  const bytes = encoder.encode(JSON.stringify(value));
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return { bytes, sha256: [...new Uint8Array(hash)].map((item) => item.toString(16).padStart(2, "0")).join("") };
}
function response(bytes: Uint8Array) { return new Response(bytes, { status: 200 }); }
function stubCatalog(catalog: unknown, current: unknown, bytes: Uint8Array) {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => url.endsWith("current.json") ? Response.json(current) : url.endsWith("catalog.json") ? Response.json(catalog) : response(bytes)));
}

describe("jp medical content-addressed loader", () => {
  beforeEach(() => { retryJpMedicalCatalog(); vi.unstubAllGlobals(); });

  it("resolves current/catalog and verifies a JSON asset bytes and SHA", async () => {
    const aggregate = { type: "FeatureCollection", features: [] }; const asset = await digest(aggregate);
    const catalog = { contract_version: 1, version: "v", layers: [], files: { "aggregates/navii-z6.geojson": { sha256: asset.sha256, bytes: asset.bytes.byteLength } } };
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.endsWith("current.json")) return Response.json({ version: "v", catalog: "releases/v/catalog.json", status: "LOCAL_READY_NOT_DEPLOYED" });
      if (url.endsWith("catalog.json")) return Response.json(catalog);
      return response(asset.bytes);
    }));
    await expect(fetchJpMedicalJsonAsset("aggregates/navii-z6.geojson")).resolves.toEqual(aggregate);
  });

  it("rejects wrong bytes before treating an asset as empty data", async () => {
    const aggregate = { type: "FeatureCollection", features: [] }; const asset = await digest(aggregate);
    const catalog = { contract_version: 1, version: "v", layers: [], files: { "aggregates/navii-z6.geojson": { sha256: asset.sha256, bytes: asset.bytes.byteLength + 1 } } };
    vi.stubGlobal("fetch", vi.fn(async (url: string) => url.endsWith("current.json") ? Response.json({ version: "v", catalog: "releases/v/catalog.json" }) : url.endsWith("catalog.json") ? Response.json(catalog) : response(asset.bytes)));
    await expect(fetchJpMedicalJsonAsset("aggregates/navii-z6.geojson")).rejects.toThrow("bytes");
  });

  it("keeps all original-ID hour rows from the verified bucket envelope", async () => {
    const sourceId = "facility-9";
    const sourceHash = await crypto.subtle.digest("SHA-256", encoder.encode(sourceId));
    const bucket = [...new Uint8Array(sourceHash)][0]!.toString(16).padStart(2, "0");
    const envelope = { bucket, bucket_algorithm: "sha256(source_id UTF-8)[:2]", record_kind: "hospital_hours", rows: [{ ID: sourceId, weekday: "月", hours: "09:00-12:00" }, { ID: sourceId, weekday: "火", hours: "13:00-17:00" }, { ID: "other", weekday: "月" }] };
    const asset = await digest(envelope); const path = `details/hospital_hours/${bucket}.json`;
    const catalog = { contract_version: 1, version: "v", layers: [], files: { [path]: { sha256: asset.sha256, bytes: asset.bytes.byteLength } } };
    vi.stubGlobal("fetch", vi.fn(async (url: string) => url.endsWith("current.json") ? Response.json({ version: "v", catalog: "releases/v/catalog.json" }) : url.endsWith("catalog.json") ? Response.json(catalog) : response(asset.bytes)));
    await expect(loadJpMedicalHours("hospital", sourceId, bucket)).resolves.toEqual(envelope.rows.slice(0, 2));
  });

  it("rejects an asset whose bytes match but SHA-256 does not", async () => {
    const body = { ok: true }; const asset = await digest(body);
    const catalog = { contract_version: 1, version: "v", layers: [], files: { "aggregates/navii-z6.geojson": { sha256: "0".repeat(64), bytes: asset.bytes.byteLength } } };
    stubCatalog(catalog, { version: "v", catalog: "releases/v/catalog.json" }, asset.bytes);
    await expect(fetchJpMedicalJsonAsset("aggregates/navii-z6.geojson")).rejects.toThrow("SHA-256");
  });

  it("rejects a pointer/catalog version or path mismatch before asset fetch", async () => {
    const catalog = { contract_version: 1, version: "catalog-v", layers: [], files: {} };
    stubCatalog(catalog, { version: "pointer-v", catalog: "releases/pointer-v/catalog.json" }, new Uint8Array());
    await expect(fetchJpMedicalJsonAsset("anything.json")).rejects.toThrow("版本不一致");
  });

  it("keeps the legacy z10 gate but rejects an unproven z0 point archive", async () => {
    const path = "points/navii_facilities.pmtiles";
    const files = { [path]: { sha256: "a".repeat(64), bytes: 1 } };
    const current = { version: "v", catalog: "releases/v/catalog.json" };
    stubCatalog({ contract_version: 1, version: "v", files, layers: [{ key: "navii_facilities", pmtiles_path: path, source_layer: "navii_facilities", minimum_point_zoom: 10 }] }, current, new Uint8Array());
    await expect(jpMedicalLayerAsset("navii_facilities")).resolves.toMatchObject({ asset: { minimum_point_zoom: 10 } });

    retryJpMedicalCatalog();
    stubCatalog({ contract_version: 1, version: "v", files, layers: [{ key: "navii_facilities", pmtiles_path: path, source_layer: "navii_facilities", minimum_point_zoom: 0 }] }, current, new Uint8Array());
    await expect(jpMedicalLayerAsset("navii_facilities")).rejects.toThrow("缺少全縮放守恆證據");
  });

  it("accepts a z0 point archive only with explicit no-sampling evidence", async () => {
    const path = "points/h17_services.pmtiles";
    const files = { [path]: { sha256: "b".repeat(64), bytes: 1 } };
    stubCatalog({
      contract_version: 1,
      version: "v",
      files,
      layers: [{
        key: "h17_services", pmtiles_path: path, source_layer: "h17_services",
        minimum_point_zoom: 0, point_sampling: "none", z0_feature_count: 222_194,
      }],
    }, { version: "v", catalog: "releases/v/catalog.json" }, new Uint8Array());
    await expect(jpMedicalLayerAsset("h17_services")).resolves.toMatchObject({
      asset: { minimum_point_zoom: 0, point_sampling: "none", z0_feature_count: 222_194 },
    });
  });

  it("rejects paths not explicitly present in the immutable allowlist", async () => {
    const catalog = { contract_version: 1, version: "v", layers: [], files: {} };
    stubCatalog(catalog, { version: "v", catalog: "releases/v/catalog.json" }, new Uint8Array());
    await expect(fetchJpMedicalJsonAsset("details/hospital_hours/aa.json")).rejects.toThrow("allowlist");
  });

  it("rejects a valid-bucket hours payload with the wrong record kind", async () => {
    const sourceId = "facility-kind";
    const sourceHash = await crypto.subtle.digest("SHA-256", encoder.encode(sourceId));
    const bucket = [...new Uint8Array(sourceHash)][0]!.toString(16).padStart(2, "0");
    const envelope = { bucket, record_kind: "clinic_hours", rows: [{ ID: sourceId }] };
    const asset = await digest(envelope); const path = `details/hospital_hours/${bucket}.json`;
    const catalog = { contract_version: 1, version: "v", layers: [], files: { [path]: { sha256: asset.sha256, bytes: asset.bytes.byteLength } } };
    stubCatalog(catalog, { version: "v", catalog: "releases/v/catalog.json" }, asset.bytes);
    await expect(loadJpMedicalHours("hospital", sourceId, bucket)).rejects.toThrow("格式");
  });

  it("rejects a verified hours envelope whose declared bucket differs from source ID", async () => {
    const sourceId = "facility-bucket";
    const sourceHash = await crypto.subtle.digest("SHA-256", encoder.encode(sourceId));
    const bucket = [...new Uint8Array(sourceHash)][0]!.toString(16).padStart(2, "0");
    const envelope = { bucket: bucket === "00" ? "01" : "00", record_kind: "hospital_hours", rows: [{ ID: sourceId }] };
    const asset = await digest(envelope); const path = `details/hospital_hours/${bucket}.json`;
    const catalog = { contract_version: 1, version: "v", layers: [], files: { [path]: { sha256: asset.sha256, bytes: asset.bytes.byteLength } } };
    stubCatalog(catalog, { version: "v", catalog: "releases/v/catalog.json" }, asset.bytes);
    await expect(loadJpMedicalHours("hospital", sourceId, bucket)).rejects.toThrow("格式");
  });
});

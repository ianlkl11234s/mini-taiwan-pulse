import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchJpWaterGeoJsonAsset, jpWaterAssetUrl, jpWaterPrivatePmtilesAsset, jpWaterPublishedAsset, retryJpWaterPrivateAssets, retryJpWaterRelease } from "../jpWaterLoader";
import { JP_WATER_FACILITY_CATEGORIES, JP_WATER_PRIVATE_ENDPOINTS, JP_WATER_PRIVATE_LAYER_KEYS, jpWaterSelectionIdentity } from "../jpWaterTypes";

const valid = { contract_version: 1, release: "20260918", assets: [{
  key: "jpWaterLakes", format: "geojson", path: "releases/20260918/jpWaterLakes.geojson", bytes: 1,
  sha256: "a".repeat(64), year: "2005", source_url: "https://nlftp.mlit.go.jp/", license: "terms verified", coverage: "Japan", geometry_role: "polygon", status: "published",
}] };
describe("jp water release gate", () => {
  beforeEach(() => { retryJpWaterRelease(); retryJpWaterPrivateAssets(); vi.unstubAllGlobals(); });
  it("only resolves an asset explicitly published in the release allowlist", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json(valid)));
    await expect(jpWaterPublishedAsset("jpWaterLakes")).resolves.toMatchObject({ key: "jpWaterLakes" });
    await expect(jpWaterAssetUrl("jpWaterLakes")).resolves.toContain("releases/20260918/jpWaterLakes.geojson");
  });
  it("rejects HOLD and missing assets before a map hook can treat them as empty", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ ...valid, assets: [{ ...valid.assets[0], status: "HOLD" }] })));
    await expect(jpWaterPublishedAsset("jpWaterLakes")).rejects.toThrow("未發布");
    retryJpWaterRelease();
    vi.stubGlobal("fetch", vi.fn(async () => Response.json(valid)));
    await expect(jpWaterPublishedAsset("jpWaterRivers")).rejects.toThrow("allowlist");
  });
  it("rejects wrong geometry semantics even when a path exists", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ ...valid, assets: [{ ...valid.assets[0], geometry_role: "point" }] })));
    await expect(jpWaterPublishedAsset("jpWaterLakes")).rejects.toThrow("geometry_role");
  });
  it("never promotes KSJ old-agreement vectors into the public allowlist", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ ...valid, assets: [{
      ...valid.assets[0], key: "jpWaterDams", path: "releases/20260918/jpWaterDams.geojson", geometry_role: "point", year: "2014",
    }] })));
    await expect(jpWaterPublishedAsset("jpWaterDams")).rejects.toThrow("公開再散布");
  });
  it("verifies fetched bytes and SHA-256 before parsing a GeoJSON asset", async () => {
    const body = new TextEncoder().encode(JSON.stringify({ type: "FeatureCollection", features: [] }));
    const digest = [...new Uint8Array(await crypto.subtle.digest("SHA-256", body))].map((v) => v.toString(16).padStart(2, "0")).join("");
    const release = { ...valid, assets: [{ ...valid.assets[0], bytes: body.byteLength, sha256: digest }] };
    vi.stubGlobal("fetch", vi.fn(async (url: string) => url.endsWith("release.json") ? Response.json(release) : new Response(body)));
    await expect(fetchJpWaterGeoJsonAsset("jpWaterLakes")).resolves.toMatchObject({ type: "FeatureCollection", features: [] });
  });
  it("returns only the fixed owner-only endpoint and immutable water receipt", () => {
    expect(jpWaterPrivatePmtilesAsset("water")).toEqual({
      archive: "water",
      url: "/api/private-research/jp-water/water",
      bytes: 85597875,
      sha256: "dd82b5f53b95e544182c11400dc6dac17a8455bab150b0509df909c1848737da",
    });
  });
  it("keeps both private archives on exact same-origin API paths", () => {
    expect(JP_WATER_PRIVATE_ENDPOINTS).toEqual({
      water: "/api/private-research/jp-water/water",
      "extra-water": "/api/private-research/jp-water/extra-water",
    });
  });
  it("does not expose a public asset URL or whole-archive fetch path", () => {
    const asset = jpWaterPrivatePmtilesAsset("extra-water");
    expect(asset.url).toBe("/api/private-research/jp-water/extra-water");
    expect(asset.url).not.toMatch(/^https?:\/\//);
    expect(asset.bytes).toBe(31656052);
  });
  it("builds a source-scoped selection identity instead of treating source_id as a cross-source entity id", () => {
    expect(jpWaterSelectionIdentity("jpWaterNilimDams", "42")).toEqual({
      sourceLayer: "nilim",
      assetSha256: "e41775f0ae3d33c04866896b0002002d20338937d11f124c51461017409a5bf9",
      selectionId: "nilim:42:e41775f0ae3d33c04866896b0002002d20338937d11f124c51461017409a5bf9",
    });
    expect(jpWaterSelectionIdentity("jpWaterLakes", "42")).toBeNull();
  });
  it("keeps supply and sewer category fallbacks explicit", () => {
    expect(JP_WATER_FACILITY_CATEGORIES.filter((item) => item.group === "supply").map((item) => item.value)).toContain("unclassified_supply_facility");
    expect(JP_WATER_FACILITY_CATEGORIES.filter((item) => item.group === "sewer").map((item) => item.value)).toEqual([
      "sewer_pump_station", "sewage_treatment_plant", "unclassified_sewer_facility",
    ]);
  });
  it("keeps all eight restricted vectors in the explicit private set", () => {
    expect(JP_WATER_PRIVATE_LAYER_KEYS).toHaveLength(8);
    expect(JP_WATER_PRIVATE_LAYER_KEYS).toContain("jpWaterSupplyFacilities");
    expect(JP_WATER_PRIVATE_LAYER_KEYS).toContain("jpWaterSewerFacilities");
  });
});

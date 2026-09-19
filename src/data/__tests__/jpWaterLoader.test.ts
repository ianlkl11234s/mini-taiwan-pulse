import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchJpWaterGeoJsonAsset, jpWaterAssetUrl, jpWaterPublishedAsset, retryJpWaterRelease } from "../jpWaterLoader";

const valid = { contract_version: 1, release: "20260918", assets: [{
  key: "jpWaterLakes", format: "geojson", path: "releases/20260918/jpWaterLakes.geojson", bytes: 1,
  sha256: "a".repeat(64), year: "2005", source_url: "https://nlftp.mlit.go.jp/", license: "terms verified", coverage: "Japan", geometry_role: "polygon", status: "published",
}] };
describe("jp water release gate", () => {
  beforeEach(() => { retryJpWaterRelease(); vi.unstubAllGlobals(); });
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
});

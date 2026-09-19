import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { queryNearby, clearNearbyDataCache } from "../nearbyData";
import { nearbyGeometry } from "../nearbyOverlay";
const path = fileURLToPath(new URL("../../../public/education/schools.geojson", import.meta.url));
afterEach(() => { clearNearbyDataCache(); vi.unstubAllGlobals(); });
describe("nearby analytical acceptance", () => {
  it.skipIf(!existsSync(path))("Taipei Station 1km matches independent reference, truncates explicitly and reuses the source", async () => {
    const input = readFileSync(path, "utf8");
    const fetcher = vi.fn().mockImplementation(() => Promise.resolve(new Response(input)));
    vi.stubGlobal("fetch", fetcher);
    const full = await queryNearby("schools", { lng: 121.517, lat: 25.0478 }, 1000, 50);
    expect(full.totalMatched).toBe(9); expect(full.returned).toBe(9); expect(full.truncated).toBe(false);
    expect(full.rows[0]?.name).toBe("市立建成國中");
    expect(full.rows[0]?.distanceM).toBeCloseTo(459.2, 3);
    expect(new Set(full.rows.map(row => row.id)).size).toBe(9);
    const capped = await queryNearby("schools", { lng: 121.517, lat: 25.0478 }, 1000, 3);
    expect(capped.totalMatched).toBe(9); expect(capped.returned).toBe(3); expect(capped.truncated).toBe(true);
    expect(nearbyGeometry(capped).features).toHaveLength(1); // Only the radius; original layer points retain their styling
    const empty = await queryNearby("schools", { lng: 123, lat: 25 }, 1000, 50);
    expect(empty.totalMatched).toBe(0); expect(empty.source).not.toBeNull();
    expect(empty.source?.sourceTime).toBe("unknown"); expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("uses unrounded distance for inclusive radius membership", async () => {
    const longitude = 0.001;
    const exactDistance = 6371008.8 * longitude * Math.PI / 180;
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify({type:"FeatureCollection",features:[{type:"Feature",geometry:{type:"Point",coordinates:[longitude,0]},properties:{school_name:"boundary"}}]})))));
    expect((await queryNearby("schools", {lng:0,lat:0},exactDistance,50)).totalMatched).toBe(1);
    expect((await queryNearby("schools", {lng:0,lat:0},exactDistance-0.00001,50)).totalMatched).toBe(0);
  });
});

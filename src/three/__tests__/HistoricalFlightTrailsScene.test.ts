import { describe, expect, it } from "vitest";
import type { HistoricalFlightCollection, HistoricalFlightParams } from "../../data/historicalFlightTrailsTypes";
import { setMercatorEngine } from "../../utils/coordinates";
import { HistoricalFlightTrailsScene } from "../HistoricalFlightTrailsScene";

setMercatorEngine({
  fromLngLat: ([, lat], altitude = 0) => ({
    x: 0, y: lat / 180, z: altitude / 1_000_000,
    meterInMercatorCoordinateUnits: () => 1 / 1_000_000,
  }),
});

const params: HistoricalFlightParams = {
  airport: "RCTP", date: "2026-03-10", opacity: 0.8, width: 2,
  direction: "all", routeScope: "all", altitudeScale: 3,
};

const data = {
  type: "FeatureCollection",
  meta: { country: "TW", airport: "RCTP", date: "2026-03-10", timezone: "Asia/Taipei", coverage: "partial", note: "observed gaps retained" },
  features: [{
    type: "Feature",
    properties: {
      flight_id: "flight-a", callsign: null, flight_number: null, operator: null, aircraft_type: null,
      origin_icao: null, origin_iata: null, dest_icao: null, dest_iata: null,
      dep_time: null, arr_time: null, observed_start: null, observed_end: null,
      roles: ["departure"], route_scope: "cross_border", gap_count: 1, invalid_point_count: 0,
      non_monotonic_count: 0, source_point_count: 5, retained_point_count: 5,
    },
    // Parts represent observed gaps. The renderer displays their direct bridge without
    // dropping source points, while the source gap_count remains on the feature.
    geometry: { type: "MultiLineString", coordinates: [[[121, 25, 0], [122, 26, 6000]], [[179, 20, 1000], [-179, 20, 2000]]] },
  }],
} as HistoricalFlightCollection;

describe("HistoricalFlightTrailsScene", () => {
  it("batches source trajectories with render-only great-circle subdivisions", () => {
    const scene = new HistoricalFlightTrailsScene();
    scene.setParams(params);
    scene.setData(data);
    const geometry = (scene as unknown as { geometry: { getAttribute(name: string): { count: number; getX(index: number): number } } }).geometry;
    // The long observed gap stays a direct logical connection, but is tessellated for globe rendering.
    expect(geometry.getAttribute("position").count).toBeGreaterThan(6);
    expect(geometry.getAttribute("aEcef").count).toBe(geometry.getAttribute("position").count);
    const positions = geometry.getAttribute("position");
    for (let index = 0; index < positions.count; index += 2) {
      expect(Math.abs(positions.getX(index + 1) - positions.getX(index))).toBeLessThan(0.5);
    }
    scene.dispose();
  });

  it("changes filters through visibility attributes while retaining position geometry", () => {
    const scene = new HistoricalFlightTrailsScene();
    scene.setParams(params);
    scene.setData(data);
    const internal = scene as unknown as { geometry: { getAttribute(name: string): { array: ArrayLike<number> } } };
    const positions = internal.geometry.getAttribute("position");
    scene.setParams({ ...params, direction: "arrival" });
    expect(internal.geometry.getAttribute("position")).toBe(positions);
    expect(Array.from(internal.geometry.getAttribute("aHistoricalVisible").array).every((value) => value === 0)).toBe(true);
    scene.dispose();
  });
});

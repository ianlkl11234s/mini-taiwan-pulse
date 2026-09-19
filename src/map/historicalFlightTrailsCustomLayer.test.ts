import { describe, expect, it } from "vitest";
import type { HistoricalFlightCollection, HistoricalFlightParams } from "../data/historicalFlightTrailsTypes";
import { createHistoricalFlightTrailsLayer, historicalFlightTrails3dLayerId } from "./historicalFlightTrailsCustomLayer";

const params = { airport: "RCTP", date: "2026-03-10", opacity: 0.8, width: 1, direction: "all", routeScope: "all", altitudeScale: 3 } as HistoricalFlightParams;
const data = { type: "FeatureCollection", meta: { country: "TW", airport: "RCTP", date: "2026-03-10", timezone: "Asia/Taipei", coverage: "partial", note: "" }, features: [] } as HistoricalFlightCollection;

describe("historical flight trails custom layer", () => {
  it("uses country-scoped static custom-layer ids and exposes update/pick APIs", () => {
    const layer = createHistoricalFlightTrailsLayer("TW", data, params);
    expect(layer.id).toBe("historical-flight-trails-tw-3d");
    expect(historicalFlightTrails3dLayerId("JP")).toBe("historical-flight-trails-jp-3d");
    expect(typeof layer.setData).toBe("function");
    expect(typeof layer.setParams).toBe("function");
    expect(layer.pick(1, 1, 100, 100)).toBeNull();
  });
});

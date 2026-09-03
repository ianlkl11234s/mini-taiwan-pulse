import { describe, expect, it } from "vitest";
// @ts-expect-error — style-spec CJS entry has no exported typings; test-only validator.
import { validate } from "mapbox-gl/dist/style-spec/index.cjs";
import {
  MARINE_OBSERVATION_CLICK_LAYERS,
  MARINE_OBSERVATION_STATUS_STYLES,
  marineObservationCircleLayers,
  marineObservationColorExpression,
  marineObservationMapboxData,
  marineObservationRadiusExpression,
} from "../useMarineObservationLayer";
import { MARINE_OBSERVATION_FRESHNESS_MINUTES } from "../../data/marineObservationLoader";

const EMPTY = { type: "FeatureCollection", features: [] } as const;

describe("marine observation Mapbox layer", () => {
  it("keeps CWA and ISOHE in independent sources and clickable layers", () => {
    const cwa = marineObservationCircleLayers("cwa");
    const isohe = marineObservationCircleLayers("isohe");

    expect(new Set(cwa.map((layer) => layer.source))).toEqual(new Set(["marine-observation-cwa"]));
    expect(new Set(isohe.map((layer) => layer.source))).toEqual(new Set(["marine-observation-isohe"]));
    expect(MARINE_OBSERVATION_CLICK_LAYERS).toEqual([
      "marine-observation-cwa-circle",
      "marine-observation-isohe-circle",
    ]);
  });

  it("uses source-specific freshness thresholds without reading a metric value", () => {
    const cwa = marineObservationColorExpression("cwa");
    const isohe = marineObservationColorExpression("isohe");

    expect(MARINE_OBSERVATION_FRESHNESS_MINUTES.cwa)
      .not.toEqual(MARINE_OBSERVATION_FRESHNESS_MINUTES.isohe);
    expect(JSON.stringify(cwa)).toContain("freshnessStatus");
    expect(JSON.stringify(isohe)).toContain("freshnessStatus");
    expect(JSON.stringify(cwa)).not.toContain("metricCode");
    expect(JSON.stringify(isohe)).not.toContain("metricCode");
    expect(MARINE_OBSERVATION_STATUS_STYLES.fresh.colors.cwa)
      .not.toBe(MARINE_OBSERVATION_STATUS_STYLES.fresh.colors.isohe);
    expect(JSON.stringify(cwa)).toContain('"1"');
    expect(JSON.stringify(cwa)).not.toContain('"0"');
  });

  it("keeps zoom at the top-level interpolate input and passes Mapbox style validation", () => {
    expect(marineObservationRadiusExpression(2)).toEqual([
      "interpolate", ["linear"], ["zoom"],
      5, 4.8,
      8, 7.2,
      12, 10.4,
      16, 14.4,
    ]);

    for (const sourceNetwork of ["cwa", "isohe"] as const) {
      const sourceId = `marine-observation-${sourceNetwork}`;
      for (const layer of marineObservationCircleLayers(sourceNetwork, 0.73)) {
        const errors = (validate({
          version: 8,
          sources: { [sourceId]: { type: "geojson", data: EMPTY } },
          layers: [layer],
        }) as { message: string }[]).map((error) => error.message);
        expect(errors, `${layer.id}: ${errors.join("; ")}`).toEqual([]);
      }
    }
  });

  it("applies and clamps the source-specific opacity parameter", () => {
    const cwaCircle = marineObservationCircleLayers("cwa", 0.73)[1];
    const isoheCircle = marineObservationCircleLayers("isohe", 2)[1];
    const hiddenCircle = marineObservationCircleLayers("cwa", -1)[1];

    expect(cwaCircle?.paint?.["circle-stroke-opacity"]).toBe(0.73);
    expect(JSON.stringify(cwaCircle?.paint?.["circle-opacity"])).toContain("0.73");
    expect(isoheCircle?.paint?.["circle-stroke-opacity"]).toBe(1);
    expect(hiddenCircle?.paint?.["circle-stroke-opacity"]).toBe(0);
  });

  it("serializes nested metrics for reliable popup queries without changing null to zero", () => {
    const data = marineObservationMapboxData({
      type: "FeatureCollection",
      features: [{
        type: "Feature",
        id: "cwa:station-1",
        geometry: { type: "Point", coordinates: [121.5, 25] },
        properties: {
          stationUid: "cwa:station-1",
          sourceNetwork: "cwa",
          sourceStationId: "station-1",
          originOrg: "CWA",
          distributionOrg: "CWA",
          stationType: "marine_station",
          nameZh: "測試站",
          nameEn: "",
          sourceStatus: "active",
          latestSourceStatus: "online",
          latestObservedAt: "2026-08-27T00:00:00Z",
          latestReceivedAt: "2026-08-27T00:05:00Z",
          latestAgeSeconds: null,
          freshnessStatus: "missing",
          metricCount: 1,
          hasCurrentData: true,
          observedElements: ["tide_height"],
          metrics: [{
            metricCode: "tide_height",
            depthKey: "surface",
            valueNumeric: null,
            unitSource: "m",
            unitCanonical: "m",
            verticalDatum: "TWVD2001",
            sourceStatus: null,
            qualityFlags: { valid: false },
            observedAt: "2026-08-27T00:00:00Z",
            receivedAt: "2026-08-27T00:05:00Z",
            ageSeconds: null,
            observationLongitude: null,
            observationLatitude: null,
            hasValue: false,
          }],
          lastSeenAt: "2026-08-27T00:05:00Z",
        },
      }],
    });

    expect(data.features[0]?.properties?.latestAgeSeconds).toBeNull();
    expect(data.features[0]?.properties?.metrics).toContain('"valueNumeric":null');
    expect(data.features[0]?.properties?.metrics).toContain('"verticalDatum":"TWVD2001"');
  });
});

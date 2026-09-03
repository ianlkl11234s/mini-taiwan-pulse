import { afterEach, describe, expect, it, vi } from "vitest";

const { rpcMock } = vi.hoisted(() => ({ rpcMock: vi.fn() }));

vi.mock("../../lib/supabase", () => ({
  supabase: { rpc: rpcMock },
}));

import {
  fetchMarineObservationCurrent,
  fetchMarineObservationStations,
  invalidateMarineObservationCache,
  loadMarineObservationFeatures,
  loadMarineObservationHistory,
  marineObservationFreshness,
} from "../marineObservationLoader";

function stationRow(sourceNetwork: "cwa" | "isohe", stationUid: string) {
  return {
    station_uid: stationUid,
    source_network: sourceNetwork,
    source_station_id: stationUid.split(":")[1],
    origin_org: sourceNetwork === "cwa" ? "CWA" : "港務公司",
    distribution_org: sourceNetwork === "cwa" ? "CWA" : "ISOHE",
    station_type: "fixed",
    name_zh: `${sourceNetwork} station`,
    name_en: null,
    aliases: [],
    longitude: 121.5,
    latitude: 25.1,
    observed_elements: ["sea_level", "water_temperature"],
    source_status: "active",
    location_revision: 1,
    location_updated_at: "2026-08-27T00:00:00Z",
    last_seen_at: "2026-08-27T01:00:00Z",
  };
}

function currentRow(
  sourceNetwork: "cwa" | "isohe",
  stationUid: string,
  metricCode: string,
  value: number | null,
) {
  return {
    station_uid: stationUid,
    source_network: sourceNetwork,
    source_station_id: stationUid.split(":")[1],
    origin_org: sourceNetwork === "cwa" ? "CWA" : "港務公司",
    distribution_org: sourceNetwork === "cwa" ? "CWA" : "ISOHE",
    station_type: "fixed",
    name_zh: `${sourceNetwork} station`,
    longitude: 121.5,
    latitude: 25.1,
    metric_code: metricCode,
    depth_key: "surface",
    value_numeric: value,
    unit_source: "m",
    unit_canonical: "m",
    vertical_datum: "TWVD2001",
    source_status: "active",
    quality_flags: { qc: "passed" },
    observed_at: "2026-08-27T01:00:00Z",
    received_at: "2026-08-27T01:05:00Z",
    age_seconds: 600,
    observation_longitude: 121.5001,
    observation_latitude: 25.1001,
  };
}

afterEach(() => {
  invalidateMarineObservationCache();
  rpcMock.mockReset();
});

describe("marineObservationLoader", () => {
  it("sends the stations/current RPC contract and normalizes snake_case rows", async () => {
    rpcMock.mockImplementation((name: string) => {
      if (name === "get_marine_observation_stations") {
        return Promise.resolve({ data: [stationRow("cwa", "cwa:A1")], error: null });
      }
      if (name === "get_marine_observation_current") {
        return Promise.resolve({
          data: [currentRow("cwa", "cwa:A1", "sea_level", 1.25)],
          error: null,
        });
      }
      throw new Error(`unexpected RPC: ${name}`);
    });

    const bounds = { minLon: 119, minLat: 21, maxLon: 123, maxLat: 26 };
    const stations = await fetchMarineObservationStations("cwa", {
      stationType: "fixed",
      bounds,
      limit: 500,
    });
    const current = await fetchMarineObservationCurrent("cwa", {
      metricCodes: ["sea_level"],
      bounds,
      maxAgeMinutes: 360,
      limit: 1000,
    });

    expect(rpcMock).toHaveBeenCalledWith("get_marine_observation_stations", {
      p_source_network: "cwa",
      p_station_type: "fixed",
      p_min_lon: 119,
      p_min_lat: 21,
      p_max_lon: 123,
      p_max_lat: 26,
      p_limit: 500,
    });
    expect(rpcMock).toHaveBeenCalledWith("get_marine_observation_current", {
      p_source_network: "cwa",
      p_metric_codes: ["sea_level"],
      p_min_lon: 119,
      p_min_lat: 21,
      p_max_lon: 123,
      p_max_lat: 26,
      p_max_age_minutes: 360,
      p_limit: 1000,
    });
    expect(stations[0]).toMatchObject({
      stationUid: "cwa:A1",
      sourceNetwork: "cwa",
      longitude: 121.5,
      observedElements: ["sea_level", "water_temperature"],
    });
    expect(current[0]).toMatchObject({
      stationUid: "cwa:A1",
      metricCode: "sea_level",
      valueNumeric: 1.25,
      verticalDatum: "TWVD2001",
      qualityFlags: { qc: "passed" },
    });
  });

  it("never mixes CWA/ISOHE rows and groups current metrics into one station feature", async () => {
    rpcMock.mockImplementation((name: string) => {
      if (name === "get_marine_observation_stations") {
        return Promise.resolve({
          data: [stationRow("cwa", "cwa:A1"), stationRow("isohe", "isohe:P1")],
          error: null,
        });
      }
      if (name === "get_marine_observation_current") {
        return Promise.resolve({
          data: [
            currentRow("cwa", "cwa:A1", "sea_level", null),
            currentRow("cwa", "cwa:A1", "water_temperature", 26.4),
            currentRow("isohe", "isohe:P1", "wind_speed", 3.2),
          ],
          error: null,
        });
      }
      throw new Error(`unexpected RPC: ${name}`);
    });

    const fc = await loadMarineObservationFeatures("cwa");

    expect(fc.features).toHaveLength(1);
    expect(fc.features[0]?.properties.sourceNetwork).toBe("cwa");
    expect(fc.features[0]?.properties.metrics).toHaveLength(2);
    expect(fc.features[0]?.properties.metrics).toEqual(expect.arrayContaining([
      expect.objectContaining({
        metricCode: "sea_level",
        valueNumeric: null,
        hasValue: false,
        verticalDatum: "TWVD2001",
      }),
      expect.objectContaining({ metricCode: "water_temperature", valueNumeric: 26.4 }),
    ]));
    expect(JSON.stringify(fc)).not.toContain("isohe:P1");
  });

  it("loads history only when explicitly requested and preserves missing/invalid/datum", async () => {
    rpcMock.mockImplementation((name: string) => {
      if (name === "get_marine_observation_stations") {
        return Promise.resolve({ data: [stationRow("cwa", "cwa:A1")], error: null });
      }
      if (name === "get_marine_observation_current") {
        return Promise.resolve({ data: [], error: null });
      }
      if (name === "get_marine_observation_history") {
        return Promise.resolve({
          data: [{
            observed_at: "2026-08-26T02:00:00Z",
            value_numeric: null,
            unit_source: "m",
            unit_canonical: "m",
            vertical_datum: "基隆港基準面",
            is_missing: true,
            is_valid: false,
            missing_reason: "sentinel_-999",
            source_status: "active",
            quality_flags: { rejected: true },
          }],
          error: null,
        });
      }
      throw new Error(`unexpected RPC: ${name}`);
    });

    await loadMarineObservationFeatures("cwa");
    expect(rpcMock).not.toHaveBeenCalledWith(
      "get_marine_observation_history",
      expect.anything(),
    );

    const rows = await loadMarineObservationHistory({
      stationUid: "cwa:A1",
      metricCode: "sea_level",
      from: "2026-08-26T01:00:00Z",
      to: "2026-08-27T01:00:00Z",
    });

    expect(rpcMock).toHaveBeenCalledWith("get_marine_observation_history", {
      p_station_uid: "cwa:A1",
      p_metric_code: "sea_level",
      p_from: "2026-08-26T01:00:00Z",
      p_to: "2026-08-27T01:00:00Z",
      p_depth_key: "surface",
      p_limit: 2000,
    });
    expect(rows).toEqual([{
      observedAt: "2026-08-26T02:00:00Z",
      valueNumeric: null,
      unitSource: "m",
      unitCanonical: "m",
      verticalDatum: "基隆港基準面",
      isMissing: true,
      isValid: false,
      missingReason: "sentinel_-999",
      sourceStatus: "active",
      qualityFlags: { rejected: true },
    }]);
  });

  it("uses source-specific freshness thresholds", () => {
    expect(marineObservationFreshness("cwa", 60 * 60)).toBe("fresh");
    expect(marineObservationFreshness("isohe", 60 * 60)).toBe("delayed");
    expect(marineObservationFreshness("isohe", null)).toBe("missing");
  });
});

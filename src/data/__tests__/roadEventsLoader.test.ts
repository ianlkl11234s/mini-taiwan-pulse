import { describe, expect, it } from "vitest";
import {
  isRoadEventActive,
  roadEventsToGeoJSON,
  type RoadEvent,
} from "../roadEventsLoader";

function event(overrides: Partial<RoadEvent> = {}): RoadEvent {
  return {
    event_id: "event-1",
    source: "live_freeway",
    event_type: 2,
    severity: null,
    road_name: null,
    direction: null,
    start_km: null,
    end_km: null,
    title: null,
    description: null,
    location_other: null,
    blocked_lanes: null,
    geometry: { type: "Point", coordinates: [121.5, 25] },
    matched_section_id: null,
    enrich_status: null,
    start_ts: 1_000,
    end_ts: 2_000,
    last_updated_ts: 1_100,
    ...overrides,
  };
}

describe("road event lifecycle", () => {
  it("uses supplied effective/expire bounds exactly", () => {
    const construction = event({ end_ts: 1_000 + 90 * 24 * 60 * 60, last_updated_ts: 1_010 });
    expect(isRoadEventActive(construction, 999)).toBe(false);
    expect(isRoadEventActive(construction, 1_000)).toBe(true);
    // A source-authoritative long construction must not use a one-hour TTL.
    expect(isRoadEventActive(construction, 1_000 + 30 * 24 * 60 * 60)).toBe(true);
    expect(isRoadEventActive(construction, construction.end_ts!)).toBe(false);
  });

  it("does not convert unknown effective time into an active epoch event", () => {
    expect(isRoadEventActive(event({ start_ts: 0, end_ts: null, last_updated_ts: 1_100 }), 1_200)).toBe(false);
  });

  it("requires a fresh known-source observation when ExpireTime is absent", () => {
    const live = event({ end_ts: null, last_updated_ts: 1_100 });
    expect(isRoadEventActive(live, 1_100 + 20 * 60)).toBe(true);
    expect(isRoadEventActive(live, 1_100 + 20 * 60 + 1)).toBe(false);
    expect(isRoadEventActive(event({ end_ts: null, source: "unknown", last_updated_ts: 1_100 }), 1_101)).toBe(false);
    expect(isRoadEventActive(event({ end_ts: null, last_updated_ts: 0 }), 1_101)).toBe(false);
  });

  it("keeps planned city events through their 12-hour collection cadence", () => {
    const planned = event({ source: "event_city", end_ts: null, last_updated_ts: 1_100 });
    expect(isRoadEventActive(planned, 1_100 + 30 * 60 * 60)).toBe(true);
    expect(isRoadEventActive(planned, 1_100 + 36 * 60 * 60 + 1)).toBe(false);
  });

  it("marks stale and unknown events inactive in the GeoJSON used by the timeStore subscriber", () => {
    const fc = roadEventsToGeoJSON([
      event({ event_id: "fresh", end_ts: null, last_updated_ts: 2_000 }),
      event({ event_id: "stale", end_ts: null, last_updated_ts: 100 }),
      event({ event_id: "unknown-effective", start_ts: 0, end_ts: null, last_updated_ts: 2_000 }),
    ], 2_001);
    expect(fc.features.map((feature) => [feature.properties?.event_id, feature.properties?.active])).toEqual([
      ["fresh", 1],
      ["stale", 0],
      ["unknown-effective", 0],
    ]);
  });
});

import { describe, expect, it } from "vitest";
import {
  isAccidentEvent,
  isRoadEventActive,
  pickPulseEventKeys,
  roadEventAccidentState,
  roadEventsDisplayKey,
  roadEventsToGeoJSON,
  ROAD_EVENT_CLEARED_COLOR,
  ROAD_EVENT_CLEARED_GRACE_SEC,
  ROAD_EVENT_PULSE_MAX,
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

describe("accident emphasis", () => {
  it("classifies accidents by event_type and, for ambiguous types, by text", () => {
    expect(isAccidentEvent(event({ event_type: 3 }))).toBe(true);
    expect(isAccidentEvent(event({ event_type: 1, title: "前方事故，請減速" }))).toBe(true);
    expect(isAccidentEvent(event({ event_type: 1, title: "車多壅塞" }))).toBe(false);
    // 救護類不算事故（站主限定層才凸顯）
    expect(isAccidentEvent(event({ event_type: 8, description: "緊急救護處理中" }))).toBe(false);
    expect(isAccidentEvent(event({ event_type: 1, title: "緊急救護" }))).toBe(false);
    expect(isAccidentEvent(event({ event_type: null, title: "機車車禍" }))).toBe(true);
    expect(isAccidentEvent(event({ event_type: null }))).toBe(false);
    // 施工／災害／活動管制即使文字提到事故也不算
    expect(isAccidentEvent(event({ event_type: 2, title: "事故後路面修補" }))).toBe(false);
    expect(isAccidentEvent(event({ event_type: 7, title: "事故" }))).toBe(false);
    expect(isAccidentEvent(event({ event_type: 5, title: "事故" }))).toBe(false);
  });

  it("is active before expire, cleared for 30 min after, then dropped", () => {
    const e = event({ event_type: 3, start_ts: 1_000, end_ts: 2_000 });
    expect(roadEventAccidentState(e, 1_500)).toBe("active");
    expect(roadEventAccidentState(e, 2_000)).toBe("cleared");
    expect(roadEventAccidentState(e, 2_000 + ROAD_EVENT_CLEARED_GRACE_SEC - 1)).toBe("cleared");
    expect(roadEventAccidentState(e, 2_000 + ROAD_EVENT_CLEARED_GRACE_SEC)).toBeNull();
    expect(roadEventAccidentState(e, 900)).toBeNull();
  });

  it("uses last update + source freshness when TDX gives no ExpireTime", () => {
    const e = event({ event_type: 3, source: "live_freeway", end_ts: null, start_ts: 1_000, last_updated_ts: 5_000 });
    expect(roadEventAccidentState(e, 5_000 + 20 * 60)).toBe("active");
    expect(roadEventAccidentState(e, 5_000 + 20 * 60 + 1)).toBe("cleared");
    // 未知來源、無更新時間：無法判斷結束時刻，不亂畫灰點
    expect(roadEventAccidentState(event({ event_type: 3, source: "unknown", end_ts: null }), 99_999)).toBeNull();
  });

  it("never marks non-accidents as pulse or cleared", () => {
    const work = event({ event_type: 2, start_ts: 1_000, end_ts: 2_000 });
    expect(roadEventAccidentState(work, 1_500)).toBeNull();
    expect(roadEventAccidentState(work, 2_100)).toBeNull();
  });

  it("pulses at most 20 newest active point accidents", () => {
    const events = Array.from({ length: 25 }, (_, i) =>
      event({ event_id: `a${i}`, event_type: 3, start_ts: 1_000 + i, end_ts: 9_000 }));
    events.push(event({ event_id: "line", event_type: 3, start_ts: 5_000, end_ts: 9_000,
      geometry: { type: "LineString", coordinates: [[121, 25], [121.1, 25.1]] } }));
    events.push(event({ event_id: "work", event_type: 2, start_ts: 6_000, end_ts: 9_000 }));
    const keys = pickPulseEventKeys(events, 3_000);
    expect(keys.size).toBe(ROAD_EVENT_PULSE_MAX);
    expect(keys.has("live_freeway|a24")).toBe(true);
    expect(keys.has("live_freeway|a5")).toBe(true);
    expect(keys.has("live_freeway|a4")).toBe(false);
    expect(keys.has("live_freeway|line")).toBe(false);
    expect(keys.has("live_freeway|work")).toBe(false);
  });

  it("writes acc_state/show/pulse and grey colour for cleared accidents", () => {
    const fc = roadEventsToGeoJSON([
      event({ event_id: "now", event_type: 3, start_ts: 1_000, end_ts: 3_000 }),
      event({ event_id: "done", event_type: 3, start_ts: 1_000, end_ts: 1_500 }),
      event({ event_id: "old", event_type: 3, start_ts: 1_000, end_ts: 1_500 - 2 * ROAD_EVENT_CLEARED_GRACE_SEC }),
      event({ event_id: "work", event_type: 2, start_ts: 1_000, end_ts: 3_000 }),
    ], 2_000);
    const by = Object.fromEntries(fc.features.map((f) => [f.properties?.event_id, f.properties]));
    expect(by.now).toMatchObject({ acc_state: 1, show: 1, pulse: 1, active: 1 });
    expect(by.done).toMatchObject({ acc_state: 2, show: 1, pulse: 0, active: 0, color: ROAD_EVENT_CLEARED_COLOR });
    expect(by.old).toMatchObject({ acc_state: 0, show: 0 });
    expect(by.work).toMatchObject({ acc_state: 0, show: 1, pulse: 0 });
  });

  it("display key changes when an accident turns cleared", () => {
    const e = [event({ event_type: 3, start_ts: 1_000, end_ts: 2_000 })];
    expect(roadEventsDisplayKey(e, 1_500)).not.toBe(roadEventsDisplayKey(e, 2_100));
    expect(roadEventsDisplayKey(e, 2_100)).not.toBe("");
    expect(roadEventsDisplayKey(e, 2_000 + ROAD_EVENT_CLEARED_GRACE_SEC)).toBe("");
  });
});

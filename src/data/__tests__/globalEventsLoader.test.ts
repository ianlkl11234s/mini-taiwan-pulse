import { describe, expect, it } from "vitest";
import {
  globalEventsToGeoJSON,
  parseGlobalEventPoint,
  selectGlobalEventPlacesAt,
  type GlobalEventPoint,
} from "../globalEventsLoader";

const AT_10 = "2026-09-03T10:00:00.000Z";
const AT_11 = "2026-09-03T11:00:00.000Z";
const AT_12 = "2026-09-03T12:00:00.000Z";

function point(overrides: Partial<GlobalEventPoint> = {}): GlobalEventPoint {
  return {
    eventId: "event-1",
    versionId: "version-1",
    versionNo: 1,
    publicationNo: 1,
    lifecycleState: "published",
    eventPlaceId: "event-place-1",
    titleZhTw: "跨國事件",
    summaryZhTw: "摘要",
    category: "policy",
    severity: 2,
    confidence: 0.9,
    validFrom: AT_10,
    publishedAt: AT_10,
    explicitValidTo: null,
    displayFrom: AT_10,
    displayTo: AT_11,
    placeKey: "place-1",
    placeName: "甲國",
    countryCode: "AAA",
    admin1: null,
    admin2: null,
    precision: "point",
    locationSource: "geocoded",
    displayPlaceId: "display-place-1",
    locationKind: "country_center",
    isProxy: true,
    representativePrecision: "country",
    proxyForEventPlaceId: "event-place-1",
    locationLineage: "country_center:https://example.test/countries#AAA",
    coordinates: [10, 20],
    ...overrides,
  };
}

describe("Global Events immutable timeline selection", () => {
  it("使用 half-open interval，邊界時切到較高 publication_no 的版本", () => {
    const v1 = point();
    const v2 = point({
      versionId: "version-2",
      versionNo: 2,
      publicationNo: 2,
      displayFrom: AT_11,
      displayTo: null,
    });

    expect(selectGlobalEventPlacesAt([v1, v2], Date.parse(AT_10) / 1000)).toEqual([v1]);
    expect(selectGlobalEventPlacesAt([v1, v2], Date.parse(AT_11) / 1000)).toEqual([v2]);
    expect(selectGlobalEventPlacesAt([v1, v2], Date.parse(AT_12) / 1000)).toEqual([v2]);
  });

  it("保留同一 immutable version 的所有國家落點", () => {
    const greece = point({ eventPlaceId: "greece", displayPlaceId: "greece-center", countryCode: "GRC" });
    const turkey = point({
      eventPlaceId: "turkey",
      displayPlaceId: "turkey-center",
      placeKey: "place-2",
      placeName: "乙國",
      countryCode: "TUR",
      coordinates: [30, 40],
    });

    const selected = selectGlobalEventPlacesAt([greece, turkey], Date.parse(AT_10) / 1000);
    expect(selected.map((event) => event.countryCode)).toEqual(["GRC", "TUR"]);
  });

  it("terminal lifecycle version 成為 winner 後不再顯示舊位置", () => {
    const published = point({ displayTo: null });
    const retracted = point({
      versionId: "version-3",
      versionNo: 3,
      publicationNo: 3,
      lifecycleState: "retracted",
      displayFrom: AT_12,
      displayTo: null,
    });

    expect(selectGlobalEventPlacesAt([published, retracted], Date.parse(AT_12) / 1000)).toEqual([]);
  });
});

describe("Global Events row parsing", () => {
  it("保留 current/window RPC 的 proxy 與 immutable version metadata", () => {
    const parsed = parseGlobalEventPoint({
      event_id: "event-1",
      version_id: "version-2",
      version_no: 2,
      publication_no: 2,
      lifecycle_state: "published",
      event_place_id: "semantic-place",
      display_place_id: "publisher-proxy",
      title_zh_tw: "事件",
      location_kind: "city_center",
      is_proxy: true,
      representative_precision: "city",
      proxy_for_event_place_id: "semantic-place",
      location_lineage: "city_center:https://example.test/cities#TPE",
      display_from: AT_11,
      display_to: null,
      geometry: { type: "Point", coordinates: [121.5654, 25.033] },
    });

    expect(parsed).toMatchObject({
      versionNo: 2,
      publicationNo: 2,
      lifecycleState: "published",
      locationKind: "city_center",
      isProxy: true,
      representativePrecision: "city",
      coordinates: [121.5654, 25.033],
    });
  });

  it("不接受非 Point 或越界座標", () => {
    expect(parseGlobalEventPoint({ geometry: null })).toBeNull();
    expect(parseGlobalEventPoint({ geometry: { type: "Point", coordinates: [181, 25] } })).toBeNull();
    expect(parseGlobalEventPoint({ geometry: { type: "Polygon", coordinates: [] } })).toBeNull();
  });

  it("GeoJSON 保留 display place identity、proxy semantics 與 pulse kind", () => {
    const event = point();
    const fc = globalEventsToGeoJSON(event ? [event] : [], new Map([[event.eventId, "new_event"]]));
    expect(fc.features[0]).toMatchObject({
      id: "display-place-1",
      properties: {
        location_kind: "country_center",
        is_proxy: true,
        representative_precision: "country",
        transition_kind: "new_event",
      },
    });
  });
});

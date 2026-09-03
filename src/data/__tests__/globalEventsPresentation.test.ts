import { describe, expect, it } from "vitest";
import { parseGlobalEventPoint } from "../globalEventsLoader";
import { dedupeGlobalEventPlaces, globalEventAssociationArc, globalEventCandidateLookbackWindow, globalEventRelations, layoutGlobalEventPoints, recentGlobalEventWindow, selectGlobalEventsOverview } from "../globalEventsPresentation";

const point = (event = "e1", country = "TW", coordinates: [number, number] = [121, 25]) => parseGlobalEventPoint({
  event_id: event, version_id: `${event}-v1`, event_place_id: `${event}-${country}`, display_place_id: `${event}-${country}`,
  country_code: country, publication_no: 1, lifecycle_state: "published", geometry: { type: "Point", coordinates },
})!;

describe("Global Events complete situation presentation", () => {
  it("recent seven days is rolling backward from now, not a forward timeline window", () => {
    expect(recentGlobalEventWindow(Date.parse("2026-09-03T10:00:00Z"))).toEqual({
      start: "2026-08-27T10:00:00.000Z", end: "2026-09-03T10:00:00.000Z",
    });
  });

  it("candidate timeline prefetch extends seven days back while fixing end and respecting 31-day RPC limit", () => {
    expect(globalEventCandidateLookbackWindow({ start: "2026-09-02T16:00:00.000Z", end: "2026-09-03T16:00:00.000Z" })).toEqual({
      start: "2026-08-26T16:00:00.000Z", end: "2026-09-03T16:00:00.000Z",
    });
    const bounded = globalEventCandidateLookbackWindow({ start: "2026-08-01T00:00:00Z", end: "2026-09-01T00:00:00Z" });
    expect(Date.parse(bounded.end) - Date.parse(bounded.start)).toBe(31 * 86_400_000);
  });

  it("keeps one latest version and all its countries, suppressing retracted winners", () => {
    const v1 = point();
    const v2 = { ...v1, versionId: "v2", publicationNo: 2 };
    const other = { ...point("e1", "JP", [140, 35]), versionId: "v2", publicationNo: 2 };
    expect(selectGlobalEventsOverview([v1, v2, other, other])).toEqual([v2, other]);
    expect(selectGlobalEventsOverview([v1, { ...v2, lifecycleState: "retracted" }])).toEqual([]);
  });

  it("dedupes the same event/place, never different events at the same representative point", () => {
    const a = point("a");
    const b = point("b");
    expect(dedupeGlobalEventPlaces([a, a, b])).toEqual([a, b]);
    const layout = layoutGlobalEventPoints([a, a, b]);
    expect(layout.points.features).toHaveLength(2);
    expect(layout.anchors.features).toHaveLength(1);
    expect(layout.points.features.map((f) => f.geometry.coordinates)).toEqual([[121, 25], [121, 25]]);
    expect(layout.points.features[0]!.properties?.icon_offset).not.toEqual(layout.points.features[1]!.properties?.icon_offset);
    expect(a.coordinates).toEqual([121, 25]);
    expect(layout.points.features[0]!.properties).toMatchObject({ original_lng: 121, original_lat: 25, display_offset: true });
  });

  it("dedupes the same AI event point despite different evidence-derived place keys, preserving merged provenance", () => {
    const provenance = { aiGroupId: "aigroup_1234567890abcdef12345678", candidateIds: ["a", "b"], sourceUrls: ["https://one.example/news", "https://two.example/news"],
      candidateAssessments: [{ candidateId: "a", title: "事件 A", decision: "drop_noise", taiwanRelationship: "unrelated", taiwanImpact: "無直接影響", reason: "一般事件" },
        { candidateId: "b", title: "事件 B", decision: "keep_watch", taiwanRelationship: "indirect", taiwanImpact: "間接影響", reason: "持續觀察" }] };
    const a = { ...point("same-ai-event"), ...provenance, placeKey: "evidence:a" };
    const b = { ...point("same-ai-event"), ...provenance, placeKey: "evidence:b" };
    const rendered = layoutGlobalEventPoints([a, b]);
    expect(rendered.points.features).toHaveLength(1);
    expect(rendered.anchors.features).toHaveLength(0);
    expect(rendered.points.features[0]?.properties?.candidate_ids).toBe(JSON.stringify(["a", "b"]));
    expect(JSON.parse(String(rendered.points.features[0]?.properties?.candidate_assessments))).toHaveLength(2);
    expect(dedupeGlobalEventPlaces([a, { ...b, eventId: "different-event" }])).toHaveLength(2);
  });

  it("groups crowded points with a count then expands every event", () => {
    const rows = Array.from({ length: 20 }, (_, i) => point(`event-${i}`));
    const collapsed = layoutGlobalEventPoints(rows);
    expect(collapsed.points.features).toHaveLength(0);
    expect(collapsed.clusters.features[0]!.properties?.point_count).toBe(20);
    const key = String(collapsed.clusters.features[0]!.properties?.group_key);
    const expanded = layoutGlobalEventPoints(rows, new Set([key]));
    expect(expanded.points.features).toHaveLength(20);
    expect(new Set(expanded.points.features.map((f) => JSON.stringify(f.properties?.icon_offset))).size).toBe(20);
    expect(expanded.points.features.every((f) => f.geometry.coordinates[0] === 121 && f.geometry.coordinates[1] === 25)).toBe(true);
  });

  it("native offsets compensate severity size while all anchors and relation endpoints stay geographic", () => {
    const rows = [0, 1, 2, 3].map((severity) => ({ ...point(`event-${severity}`), severity }));
    const layout = layoutGlobalEventPoints(rows);
    for (const feature of layout.points.features) {
      const props = feature.properties!;
      const offset = props.icon_offset as number[];
      expect(offset[0]! * Number(props.icon_scale)).toBeCloseTo(Number(props.display_offset_x));
      expect(offset[1]! * Number(props.icon_scale)).toBeCloseTo(Number(props.display_offset_y));
      expect(Math.hypot(Number(props.display_offset_x), Number(props.display_offset_y))).toBeCloseTo(22);
      expect(feature.geometry.coordinates).toEqual([121, 25]);
    }
    expect(layout.anchors.features[0]!.geometry.coordinates).toEqual([121, 25]);
    const relations = globalEventRelations([rows[0]!, point("event-0", "JP", [140, 35])]);
    expect(relations.features[0]!.geometry.coordinates[0]).toEqual([140, 35]);
    expect(relations.features[0]!.geometry.coordinates[32]).toEqual([121, 25]);
  });

  it("association arcs cross the dateline locally with exact endpoints and no long jumps", () => {
    const arc = globalEventAssociationArc([179, 30], [-179, 35]);
    expect(arc[0]).toEqual([179, 30]);
    expect(arc[32]).toEqual([181, 35]);
    for (let i = 1; i < arc.length; i++) expect(Math.abs(arc[i]![0]! - arc[i - 1]![0]!)).toBeLessThan(1);
  });

  it("only connects different countries belonging to the same event, without arrows or order", () => {
    const rows = [point("e1", "TW"), point("e1", "JP", [140, 35]), point("e1", "US", [-120, 40]), point("e2", "CA", [-115, 50])];
    const relations = globalEventRelations(rows);
    expect(relations.features).toHaveLength(2);
    expect(relations.features.every((f) => f.properties?.event_id === "e1")).toBe(true);
    expect(relations.features.every((f) => f.properties?.relation_kind === "association")).toBe(true);
    expect(globalEventRelations([point("a"), point("b", "US")]).features).toHaveLength(0);
  });

  it("draws three relations for four explicit published country centers even when legacy country_code is null", () => {
    const rows = [
      { ...point("middle-east", "IR", [54.931495, 32.166225]), placeName: "伊朗" },
      { ...point("middle-east", "JO", [36.375991, 30.805025]), placeName: "約旦" },
      { ...point("middle-east", "BH", [50.554816, 26.055972]), placeName: "巴林" },
      { ...point("middle-east", "IQ", [43.26181, 33.09403]), placeName: "伊拉克" },
    ].map((row) => ({ ...row, countryCode: null, locationKind: "country_center" as const }));
    expect(globalEventRelations(rows).features).toHaveLength(3);
    expect(globalEventRelations(rows.map((row) => ({ ...row, locationKind: "city_center" }))).features).toHaveLength(0);
  });
});

import { describe, expect, it } from "vitest";
import { parseGlobalEventPoint } from "../globalEventsLoader";
import { filterGlobalEvents, dedupeGlobalEventPlaces, globalEventAssociationArc, globalEventRelations, globalEventStoryLinks, layoutGlobalEventPoints, recentGlobalEventWindow, selectGlobalEventsOverview, summarizeGlobalEventCounts, firstPointFeatureByEvent } from "../globalEventsPresentation";

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
    expect(expanded.clusters.features[0]!.properties).toMatchObject({ point_count: 20, expanded: true });
    expect(layoutGlobalEventPoints(rows, new Set()).points.features).toHaveLength(0);
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

describe("Global Events importance and source-age filters", () => {
  const now = Date.parse("2026-09-10T10:00:00Z") / 1000;
  const row = { ...point(), validFrom: "2026-09-10T09:00:00Z", displayFrom: "2026-09-10T09:30:00Z", severity: 3, category: "disaster" };
  it("uses source age, not a recent AI reassessment, and excludes future/unknown time", () => {
    const old = { ...row, candidateId: "old", validFrom: "2026-09-01T09:00:00Z" };
    expect(filterGlobalEvents([row, old, { ...row, validFrom: null, displayFrom: null },
      { ...row, displayFrom: "2026-09-10T11:00:00Z" }], now, 7)).toEqual([row]);
  });
  it("includes the exact age boundary, excludes just older, and keeps unlocated records", () => {
    const boundary = { ...row, coordinates: null, validFrom: "2026-09-09T10:00:00Z" };
    expect(filterGlobalEvents([boundary, { ...row, validFrom: "2026-09-09T09:59:59Z" }], now, 1)).toEqual([boundary]);
  });
  it("combines category and inclusive severity threshold without converting unknown to zero", () => {
    const unknown = { ...row, severity: null };
    const major = { ...row, severity: 2 };
    expect(filterGlobalEvents([row, unknown, major], now, 1, "disaster", 3)).toEqual([row]);
    expect(filterGlobalEvents([row, major], now, 1, "disaster", 2)).toEqual([row, major]);
    expect(filterGlobalEvents([row], now, 1, "policy", 3)).toEqual([]);
    expect(filterGlobalEvents([unknown], now, 1, "all", 0)).toEqual([unknown]);
    expect(unknown.severity).toBeNull();
  });
  it("Taiwan-only uses structured direct/indirect, never inconsistent explanatory prose", () => {
    const rows = ["direct", "indirect", "none", "unrelated", "unknown", null, undefined].map((taiwanRelationship) => ({
      ...row, taiwanRelationship, taiwanImpactZhTw: "可能影響臺灣",
    }));
    expect(filterGlobalEvents(rows, now, 1, "all", 0, true)).toEqual(rows.slice(0, 2));
    expect(filterGlobalEvents(rows, now, 1, "all", 0, false)).toEqual(rows);
    for (const text of ["無直接關聯。", "模型判斷無臺灣關聯，未提供補充說明。"]) {
      expect(filterGlobalEvents([{ ...row, taiwanImpactZhTw: text }], now, 1, "all", 0, true)).toEqual([]);
    }
  });
  it("uses the chosen rolling duration", () => {
    expect(recentGlobalEventWindow(now * 1000, 1).start).toBe("2026-09-09T10:00:00.000Z");
    expect(recentGlobalEventWindow(now * 1000, 3).start).toBe("2026-09-07T10:00:00.000Z");
  });
});

describe("Global Events possibly-same-story links", () => {
  const story = (event: string, title: string, country: string, coordinates: [number, number], observed = "2026-11-22T10:00:00Z") =>
    ({ ...point(event, country, coordinates), titleZhTw: title, validFrom: observed, countryCodeScheme: "fips10" });

  it("links rewrites of one story within 48 hours, keeping every event and its coordinates", () => {
    const a = story("a", "印尼工廠大火釀7死50失蹤", "ID", [120, -5]);
    const b = story("b", "印尼工廠大火釀3死36失蹤", "ID", [106.8, -6.2], "2026-11-23T02:00:00Z");
    const unrelated = story("c", "加州聖安地列斯斷層附近發生地震", "US", [-120, 36]);
    const links = globalEventStoryLinks([a, b, unrelated]);
    expect([...links.neighbours.get("a") ?? []]).toEqual(["b"]);
    expect([...links.neighbours.get("b") ?? []]).toEqual(["a"]);
    expect(links.neighbours.has("c")).toBe(false);
    expect(links.lines.features).toHaveLength(1);
    expect(links.lines.features[0]!.properties).toMatchObject({ relation_kind: "same_story", event_id: "a", related_event_id: "b" });
    expect(a.coordinates).toEqual([120, -5]);
  });

  it("does not link beyond 48 hours, and draws no zero-length line for a shared coordinate", () => {
    const a = story("a", "尼日利亞渡輪翻覆至少24人死亡", "NI", [8, 10]);
    const late = story("late", "尼日利亞渡輪翻覆至少24人死亡", "NI", [8, 10], "2026-11-25T11:00:00Z");
    const same = story("same", "尼日利亞渡輪翻覆至少24死", "NI", [8, 10]);
    const links = globalEventStoryLinks([a, late, same]);
    expect(links.neighbours.get("a")).toEqual(new Set(["same"]));
    expect(links.neighbours.has("late")).toBe(false);
    expect(links.lines.features).toHaveLength(0);
  });

  it("templated quake headlines in different countries are not the same story", () => {
    const links = globalEventStoryLinks([
      story("mx", "墨西哥奧科辛戈附近發生4.7級地震", "MX", [-92, 17]),
      story("pm", "巴拿馬索納附近發生4.2級地震", "PM", [-81, 8]),
    ]);
    expect(links.neighbours.size).toBe(0);
  });

  it("missing observation time or untitled rows never create links", () => {
    const links = globalEventStoryLinks([
      { ...story("a", "剛果伊波拉疫情失控", "CF", [15, -1]), validFrom: null },
      story("b", "剛果伊波拉疫情失控", "UG", [32, 1]),
    ]);
    expect(links.neighbours.size).toBe(0);
  });

  // 以下樣本取自 2026-11-16～23 實際候選（人工判讀為同一件事換句話說／不同事件）。
  it("links rewordings with similar AI summaries even when titles differ", () => {
    const links = globalEventStoryLinks([
      { ...story("a", "巴士墜入烏塔拉坎德邦深淵，8死26傷", "IN", [79, 30]), summaryZhTw: "印度北阿肯德邦一輛巴士墜入百米深谷，造成8人死亡、26人受傷，救援持續進行。" },
      { ...story("b", "印度北阿肯德邦巴士墜谷，8死26傷", "IN", [78, 30.5]), summaryZhTw: "印度北阿肯德邦巴士墜入深谷，造成8人死亡、26人受傷，救援人員持續搜救。" },
    ]);
    expect(links.related.get("a")?.map((item) => item.eventId)).toEqual(["b"]);
  });

  it("links same-country, same-category reports that share proper names from the source headline", () => {
    const links = globalEventStoryLinks([
      { ...story("a", "川普稱科技中斷為個別事件，籲美民放鬆", "US", [-77, 38]), category: "policy",
        sourceHeadline: "\"These are individual events\": Trump tells Americans to \"relax\" | WJBO" },
      { ...story("b", "特朗普駁斥科技與銀行中斷係網絡攻擊", "US", [-100, 40], "2026-11-22T14:00:00Z"), category: "policy",
        sourceHeadline: "\"These are individual events\": Trump tells Americans to \"relax\" amid outages" },
    ]);
    expect(links.neighbours.get("a")).toEqual(new Set(["b"]));
    expect(links.lines.features).toHaveLength(1);
  });

  it("media-name suffixes and different categories do not count as shared names", () => {
    const links = globalEventStoryLinks([
      { ...story("a", "加州聖安德烈斯斷層附近報告地震", "US", [-120, 36]), category: "disaster", sourceHeadline: "CA Earthquake Reported Near San Andreas Fault | News Radio 570 WWNC" },
      { ...story("b", "白宮稱無網路攻擊證據", "US", [-77, 38]), category: "policy", sourceHeadline: "White House Says No Evidence Of Cyberattack | News Radio 570 WWNC" },
    ]);
    expect(links.neighbours.size).toBe(0);
  });

  it("quakes in one country with different magnitudes are different events", () => {
    const links = globalEventStoryLinks([
      { ...story("a", "日本西南發生5.7級強震，當局籲民眾保持警戒", "JA", [131, 32]), summaryZhTw: "日本西南部發生規模地震，當局呼籲民眾保持警戒並注意餘震。" },
      { ...story("b", "日本立山附近發生規模5.2地震", "JA", [137, 36.5]), summaryZhTw: "日本立山附近發生規模地震，當局呼籲民眾保持警戒並注意餘震。" },
    ]);
    expect(links.neighbours.size).toBe(0);
  });

  it("review L8：整數規模（規模5、6級）的地震也要辨識出規模差異，不因摘要相似而連成同一件事", () => {
    const summaryZhTw = "日本西南部發生地震，當局呼籲民眾保持警戒並注意餘震，目前沒有海嘯威脅。";
    const links = globalEventStoryLinks([
      { ...story("a", "日本西南發生規模5強震，民眾奔逃", "JA", [131, 32]), summaryZhTw },
      { ...story("b", "立山附近規模6地震，當局評估損害", "JA", [137, 36.5]), summaryZhTw },
    ]);
    expect(links.neighbours.size).toBe(0);
  });

  it("review #1193：最大震度4級不是規模，不可讓兩則不同規模的地震因共同震度連成同一件事", () => {
    const summaryZhTw = "日本附近發生地震，當局呼籲民眾保持警戒並注意餘震，目前沒有海嘯威脅。";
    const links = globalEventStoryLinks([
      { ...story("a", "日本附近發生規模5.7地震，最大震度4級", "JA", [131, 32]), summaryZhTw },
      { ...story("b", "日本附近發生規模5.2地震，最大震度4級", "JA", [137, 36.5]), summaryZhTw },
    ]);
    expect(links.neighbours.size).toBe(0);
  });

  it("review L8：同一整數規模與 5.0 寫法一致時仍可連結", () => {
    const summaryZhTw = "日本西南部發生地震，當局呼籲民眾保持警戒並注意餘震，目前沒有海嘯威脅。";
    const links = globalEventStoryLinks([
      { ...story("a", "日本西南發生規模5地震，民眾奔逃", "JA", [131, 32]), summaryZhTw },
      { ...story("b", "日本西南規模5.0地震，民眾奔逃", "JA", [131.1, 32]), summaryZhTw },
    ]);
    expect(links.neighbours.size).toBe(2);
  });

  it("draws at most a few lines per event but lists and highlights every related report", () => {
    const rows = Array.from({ length: 8 }, (_, i) => story(`e${i}`, "印尼工廠大火釀3死36失蹤", "ID", [100 + i, -5]));
    const links = globalEventStoryLinks(rows);
    expect(links.related.get("e0")).toHaveLength(7);
    expect(links.neighbours.get("e0")?.size).toBe(7);
    expect(links.lines.features.length).toBeLessThan(28);
    for (const id of rows.map((row) => row.eventId)) {
      const drawn = links.lines.features.filter((f) => f.properties?.event_id === id || f.properties?.related_event_id === id).length;
      expect(drawn).toBeGreaterThan(0);
    }
  });

  it("shared people / organizations link only when the upstream field exists (sample data)", () => {
    const withEntities = globalEventStoryLinks([
      { ...story("a", "歐盟官員訪問基輔", "UP", [30, 50]), entities: [{ kind: "person", name: "Kaja Kallas" }, { kind: "org", name: "European Commission" }] },
      { ...story("b", "布魯塞爾討論制裁方案", "BE", [4, 50]), entities: [{ kind: "person", name: "Kaja Kallas" }] },
    ]);
    expect(withEntities.entityLinks.get("a")?.get("b")).toEqual(["Kaja Kallas"]);
    expect(withEntities.neighbours.get("b")).toEqual(new Set(["a"]));
    expect(withEntities.related.size).toBe(0);
    const without = globalEventStoryLinks([story("a", "歐盟官員訪問基輔", "UP", [30, 50]), story("b", "布魯塞爾討論制裁方案", "BE", [4, 50])]);
    expect(without.entityLinks.size).toBe(0);
    expect(without.neighbours.size).toBe(0);
  });
});

describe("圖例件數口徑（review L6／L7）", () => {
  const located = (id: string, over: object = {}) => ({ ...point(id), ...over });
  const unlocatedRec = (id: string, over: object = {}) => ({ ...point(id), coordinates: null, ...over });

  it("L6：生命週期已撤回而藏起（有座標）的事件不算「無法定位」", () => {
    const r = summarizeGlobalEventCounts([located("a"), located("b", { mapSuppressed: true }), unlocatedRec("c")], 0);
    expect(r).toMatchObject({ mapped: 1, unlocated: 1 });
  });

  it("L7：隱藏雜訊時只扣掉地圖上的雜訊，未定位的雜訊仍算未定位", () => {
    const r = summarizeGlobalEventCounts([
      located("a", { decision: "drop_noise" }), unlocatedRec("b", { decision: "drop_noise" }), located("c"),
    ], 1);
    expect(r).toMatchObject({ mapped: 1, unlocated: 1 });
  });

  it("沒隱藏雜訊時雜訊照算", () => {
    expect(summarizeGlobalEventCounts([located("a", { decision: "drop_noise" })], 0).mapped).toBe(1);
  });
});

describe("同一事件多個地點的取點（review L9）", () => {
  it("導覽與 popup 查詢都取第一個地點，後面的地點不覆蓋", () => {
    const layout = layoutGlobalEventPoints([point("e1", "JP", [140, 35]), point("e1", "TW", [121, 25])]);
    const fed = firstPointFeatureByEvent(layout.points.features);
    expect(fed.get("e1")?.coords).toEqual([140, 35]);
    expect(fed.get("e1")?.properties.country_code ?? fed.get("e1")?.properties.original_lng).toBeDefined();
  });
});

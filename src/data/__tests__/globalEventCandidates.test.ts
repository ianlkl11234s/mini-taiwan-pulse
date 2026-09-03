import { beforeEach, describe, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("../../lib/supabase", () => ({ supabase: api, supabaseConfigured: true }));
vi.mock("../../lib/loadingRegistry", () => ({ withLoading: (_key: string, _label: string, promise: Promise<unknown>) => promise }));
import { fetchGlobalEventCandidatesWindow, fetchGlobalEventsCurrent, fetchGlobalEventsWindow, parseGlobalEventCandidate, parseGlobalEventPoint, selectGlobalSituationEntries, selectGlobalEventPlacesAt } from "../globalEventsLoader";

const observation = (overrides: Record<string, unknown> = {}) => ({ candidate_id: "c1", observation_sha256: "v1", available_at: "2026-09-01T10:00:00Z", display_from: "2026-09-01T10:00:00Z", display_to: null,
  observed_at: "2026-09-01T09:00:00Z", title_zh_tw: "一般國際事件", assessment_status: "assessed", research_status: "ai_assessed", decision: "drop_noise", taiwan_relationship: "unrelated",
  place_key: "country:TW", name: "臺灣", country_code: "TW", geometry: { type: "Point", coordinates: [121, 25] }, ...overrides });

describe("Global situation candidates are retained independently of Qwen importance", () => {
  beforeEach(() => api.rpc.mockReset());
  it("retains drop_noise, Taiwan-unrelated, and pending unknown-location observations", () => {
    const row = parseGlobalEventCandidate(observation());
    const unknown = parseGlobalEventCandidate(observation({ candidate_id: "unknown", geometry: null, assessment_status: "pending", decision: null }));
    const visible = selectGlobalSituationEntries([], [row, unknown], Date.parse("2026-09-01T11:00:00Z") / 1000);
    expect(visible).toEqual([row, unknown]);
    expect(row.decision).toBe("drop_noise");
    expect(row.taiwanRelationship).toBe("unrelated");
    expect(unknown.coordinates).toBeNull();
  });

  it("never converts null, whitespace, booleans or unknown-location geometry into a map point", () => {
    for (const coordinates of [[null, null], [" ", " "], [false, true], []]) {
      expect(parseGlobalEventCandidate(observation({ geometry: { type: "Point", coordinates } })).coordinates).toBeNull();
      expect(parseGlobalEventPoint({ geometry: { type: "Point", coordinates } })).toBeNull();
    }
    expect(parseGlobalEventCandidate(observation({ location_kind: "unknown" })).coordinates).toBeNull();
  });

  it("retains formal unknown-location events in current and replay lists with real lifecycle intervals", async () => {
    const formal = { event_id: "dunwich", version_id: "v1", publication_no: 1, event_place_id: "unknown-place",
      title_zh_tw: "Dunwich 事件", lifecycle_state: "published", geometry: null, location_kind: "unknown",
      display_from: "2026-09-01T10:00:00Z", display_to: "2026-09-01T12:00:00Z" };
    api.rpc.mockResolvedValueOnce({ data: [formal], error: null }).mockResolvedValueOnce({ data: [formal], error: null });
    const current = await fetchGlobalEventsCurrent();
    const history = await fetchGlobalEventsWindow("2026-09-01T00:00:00Z", "2026-09-02T00:00:00Z");
    expect(current[0]).toMatchObject({ eventId: "dunwich", coordinates: null });
    expect(history[0]).toMatchObject({ eventId: "dunwich", coordinates: null, lifecycleState: "published" });
    const visible = selectGlobalEventPlacesAt(history, Date.parse("2026-09-01T11:00:00Z") / 1000);
    expect(selectGlobalSituationEntries(visible, [], Date.parse("2026-09-01T11:00:00Z") / 1000)).toHaveLength(1);
    expect(visible.filter((row) => row.coordinates !== null)).toHaveLength(0);
    expect(selectGlobalEventPlacesAt(history, Date.parse("2026-09-01T12:00:00Z") / 1000)).toHaveLength(0);
    expect(selectGlobalEventPlacesAt([{ ...history[0]!, lifecycleState: "retracted" }], Date.parse("2026-09-01T11:00:00Z") / 1000)).toHaveLength(0);
  });

  it("consolidates only explicit batch-scoped AI groups while keeping every assessment and source", () => {
    const group = "aigroup_1234567890abcdef12345678";
    const a = parseGlobalEventCandidate(observation({ candidate_id: "a", ai_group_id: group, source_urls: ["https://one.example/news"] }));
    const b = parseGlobalEventCandidate(observation({ candidate_id: "b", ai_group_id: group, decision: "keep_watch", source_urls: ["https://two.example/news"] }));
    const unrelated = parseGlobalEventCandidate(observation({ candidate_id: "other" }));
    const rows = selectGlobalSituationEntries([], [a, b, unrelated], Date.parse("2026-09-01T11:00:00Z") / 1000);
    expect(new Set(rows.map((row) => row.eventId)).size).toBe(2);
    expect(rows[0]?.candidateIds).toEqual(["a", "b"]);
    expect(rows[0]?.sourceUrls).toHaveLength(2);
    expect(rows[0]?.candidateAssessments?.map((item) => item.decision)).toEqual(["drop_noise", "keep_watch"]);
  });

  it("uses immutable available intervals, retaining earlier assessments during scrub", () => {
    const v1 = parseGlobalEventCandidate(observation({ display_to: "2026-09-01T12:00:00Z" }));
    const v2 = parseGlobalEventCandidate(observation({ observation_sha256: "v2", available_at: "2026-09-01T12:00:00Z", display_from: "2026-09-01T12:00:00Z", decision: "keep_core" }));
    expect(selectGlobalSituationEntries([], [v1, v2], Date.parse("2026-09-01T09:59:00Z") / 1000)).toEqual([]);
    expect(selectGlobalSituationEntries([], [v1, v2], Date.parse("2026-09-01T11:00:00Z") / 1000)).toEqual([v1]);
    expect(selectGlobalSituationEntries([], [v1, v2], Date.parse("2026-09-01T12:00:00Z") / 1000)).toEqual([v2]);
  });

  it("suppresses an explicitly linked candidate only while its formal event is visible", () => {
    const row = parseGlobalEventCandidate(observation({ canonical_event_id: "published-event" }));
    const published = parseGlobalEventPoint({ event_id: "published-event", geometry: { type: "Point", coordinates: [120, 25] } })!;
    const now = Date.parse("2026-09-01T11:00:00Z") / 1000;
    expect(selectGlobalSituationEntries([], [row], now)).toEqual([row]);
    expect(selectGlobalSituationEntries([published], [row], now)).toEqual([published]);
  });

  it("loads all keyset pages without importance filters, keeping fixed window bounds", async () => {
    api.rpc.mockResolvedValueOnce({ data: { rows: [observation({ candidate_id: "c1000" })], total_candidates: 1102, has_more: true, next_after_candidate_id: "c1000" }, error: null })
      .mockResolvedValueOnce({ data: { rows: [observation({ candidate_id: "c1102", geometry: null })], total_candidates: 1102, has_more: false }, error: null });
    const result = await fetchGlobalEventCandidatesWindow("2026-08-27T00:00:00Z", "2026-09-02T00:00:00Z");
    expect(result.rows).toHaveLength(2);
    expect(result.totalCandidates).toBe(1102);
    expect(api.rpc).toHaveBeenNthCalledWith(2, "get_global_event_candidates_window", {
      p_window_start: "2026-08-27T00:00:00Z", p_window_end: "2026-09-02T00:00:00.000Z", p_limit_candidates: 200, p_after_candidate_id: "c1000",
    });
  });

  it("fails visibly when pagination cannot advance instead of silently truncating", async () => {
    api.rpc.mockResolvedValue({ data: { rows: [observation()], has_more: true, next_after_candidate_id: "c1" }, error: null });
    await expect(fetchGlobalEventCandidatesWindow("2026-08-28T00:00:00Z", "2026-09-02T00:00:00Z")).rejects.toThrow("pagination did not advance");
  });

  it("does not resurrect a retracted formal event as an AI map point; history before withdrawal remains", () => {
    const row = parseGlobalEventCandidate(observation({ canonical_event_id: "formal", canonical_latest_lifecycle: "retracted", linked_effective_at: "2026-09-01T12:00:00Z" }));
    expect(selectGlobalSituationEntries([], [row], Date.parse("2026-09-01T11:00:00Z") / 1000)[0]?.mapSuppressed).not.toBe(true);
    expect(selectGlobalSituationEntries([], [row], Date.parse("2026-09-01T12:00:00Z") / 1000)[0]?.mapSuppressed).toBe(true);
  });
});

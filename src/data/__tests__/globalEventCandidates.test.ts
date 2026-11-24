import { beforeEach, describe, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("../../lib/supabase", () => ({ supabase: api, supabaseConfigured: true }));
vi.mock("../../lib/loadingRegistry", () => ({ withLoading: (_key: string, _label: string, promise: Promise<unknown>) => promise }));
import { fetchGlobalEventCandidatesWindow, fetchGlobalEventsCurrent, resetGlobalEventMapRpcProbe, fetchGlobalEventsWindow, parseGlobalEventCandidate, parseGlobalEventPoint, selectGlobalSituationEntries, selectGlobalEventPlacesAt } from "../globalEventsLoader";

const observation = (overrides: Record<string, unknown> = {}) => ({ candidate_id: "c1", observation_sha256: "v1", available_at: "2026-09-01T10:00:00Z", display_from: "2026-09-01T10:00:00Z", display_to: null,
  observed_at: "2026-09-01T09:00:00Z", title_zh_tw: "一般國際事件", assessment_status: "assessed", research_status: "ai_assessed", decision: "drop_noise", taiwan_relationship: "unrelated",
  place_key: "country:TW", name: "臺灣", country_code: "TW", geometry: { type: "Point", coordinates: [121, 25] }, ...overrides });

describe("Global situation candidates are retained independently of Qwen importance", () => {
  // 這組驗的是舊 RPC（567 未套用時的退回路徑）；新 RPC 見 globalEventsMapWindow.test.ts。
  beforeEach(() => { api.rpc.mockReset(); resetGlobalEventMapRpcProbe(true); });
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
    expect(result).toMatchObject({ partial: false, continuation: null });
    expect(api.rpc).toHaveBeenNthCalledWith(2, "get_global_event_candidates_window", {
      p_window_start: "2026-08-27T00:00:00Z", p_window_end: "2026-09-02T00:00:00.000Z", p_limit_candidates: 200, p_after_candidate_id: "c1000",
    });
  });

  it("stops at the five-page/1000-row budget and returns the precise continuation cursor", async () => {
    const page = (n: number) => Array.from({ length: 200 }, (_, i) => observation({ candidate_id: `p${n}-${i}` }));
    for (let n = 1; n <= 5; n++) api.rpc.mockResolvedValueOnce({ data: { rows: page(n), total_candidates: 1200, has_more: true, next_after_candidate_id: `after-${n}` }, error: null });
    const result = await fetchGlobalEventCandidatesWindow("2026-08-20T00:00:00Z", "2026-09-02T00:00:00Z");
    expect(api.rpc).toHaveBeenCalledTimes(5);
    expect(result.rows).toHaveLength(1000);
    expect(result).toMatchObject({ totalCandidates: 1200, partial: true, continuation: { afterCandidateId: "after-5", loadedPages: 5, loadedRows: 1000, loadedCandidates: 1000 } });
  });

  it("aborting transport rejects before a follow-up page is requested", async () => {
    const controller = new AbortController();
    const pending = new Promise<never>((_, reject) => controller.signal.addEventListener("abort", () => reject(controller.signal.reason)));
    api.rpc.mockReturnValue({ abortSignal: vi.fn(() => pending) });
    const loading = fetchGlobalEventCandidatesWindow("2026-08-19T00:00:00Z", "2026-09-02T00:00:00Z", controller.signal);
    controller.abort(new DOMException("cancelled", "AbortError"));
    await expect(loading).rejects.toMatchObject({ name: "AbortError" });
    expect(api.rpc).toHaveBeenCalledTimes(1);
  });

  it("fails visibly when pagination cannot advance instead of silently truncating", async () => {
    api.rpc.mockResolvedValue({ data: { rows: [observation()], has_more: true, next_after_candidate_id: "c1" }, error: null });
    await expect(fetchGlobalEventCandidatesWindow("2026-08-28T00:00:00Z", "2026-09-02T00:00:00Z")).rejects.toThrow("pagination did not advance");
  });

  it("rejects an oversized page instead of silently dropping rows behind its cursor", async () => {
    api.rpc.mockResolvedValue({ data: { rows: Array.from({ length: 201 }, (_, i) => observation({ candidate_id: `oversized-${i}` })), has_more: false }, error: null });
    await expect(fetchGlobalEventCandidatesWindow("2026-08-18T00:00:00Z", "2026-09-02T00:00:00Z")).rejects.toThrow("exceeds configured candidate limit");
  });

  it("accepts a full candidate page whose candidates expand into multiple place/version rows", async () => {
    // Production 2026-11-09: 200 candidates in a 24h page came back as 585 rows (one per observation × place).
    const rows = Array.from({ length: 200 }, (_, i) => [0, 1, 2].map((p) => observation({ candidate_id: `multi-${i}`, place_key: `place-${p}` }))).flat();
    api.rpc.mockResolvedValue({ data: { rows, total_candidates: 200, has_more: false }, error: null });
    const result = await fetchGlobalEventCandidatesWindow("2026-08-17T00:00:00Z", "2026-09-02T00:00:00Z");
    expect(result).toMatchObject({ partial: false, totalCandidates: 200 });
    expect(result.rows).toHaveLength(600);
  });

  it("does not resurrect a retracted formal event as an AI map point; history before withdrawal remains", () => {
    const row = parseGlobalEventCandidate(observation({ canonical_event_id: "formal", canonical_latest_lifecycle: "retracted", linked_effective_at: "2026-09-01T12:00:00Z" }));
    expect(selectGlobalSituationEntries([], [row], Date.parse("2026-09-01T11:00:00Z") / 1000)[0]?.mapSuppressed).not.toBe(true);
    expect(selectGlobalSituationEntries([], [row], Date.parse("2026-09-01T12:00:00Z") / 1000)[0]?.mapSuppressed).toBe(true);
  });
});

describe("AI 未判讀（不會再判）的候選有獨立狀態", () => {
  const pending = { assessment_status: "pending", decision: null, title_zh_tw: null };
  it("優先採用 RPC 的 assessment_note（migration 566 之後）", () => {
    expect(parseGlobalEventCandidate(observation({ ...pending, assessment_note: "provider_rejected" })).aiUnassessed).toBe("provider_rejected");
    expect(parseGlobalEventCandidate(observation({ ...pending, assessment_note: "model_failed" })).aiUnassessed).toBe("model_failed");
  });
  it("沒有 assessment_note 時逐字比對 collector 的固定理由句（含 11-24 13:09 舊句）", () => {
    const cases: [string, string][] = [
      ["AI 未判讀：這則新聞沒有通過 AI 服務的自動內容審查，所以沒有 AI 判讀，之後也不會再判；不代表不重要。", "provider_rejected"],
      ["AI 未判讀：多次嘗試都沒有取得有效的 AI 判讀，之後不會再判；不代表不重要。", "model_failed"],
      ["AI 供應商內容審查拒絕判讀（Alibaba data_inspection_failed）；本筆未經 AI 判讀，不代表不相關或不重要。", "provider_rejected"],
    ];
    for (const [reason_zh_tw, expected] of cases) {
      expect(parseGlobalEventCandidate(observation({ ...pending, reason_zh_tw })).aiUnassessed).toBe(expected);
    }
  });
  it("一般待判、已判讀、未知代碼都不是 AI 未判讀", () => {
    expect(parseGlobalEventCandidate(observation(pending)).aiUnassessed).toBeNull();
    expect(parseGlobalEventCandidate(observation({ reason_zh_tw: "AI 未判讀：多次嘗試都沒有取得有效的 AI 判讀，之後不會再判；不代表不重要。" })).aiUnassessed).toBeNull();
    expect(parseGlobalEventCandidate(observation({ ...pending, assessment_note: "something_else", reason_zh_tw: "依據來源判斷" })).aiUnassessed).toBeNull();
  });
});

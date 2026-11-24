import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.hoisted(() => vi.fn());
vi.mock("../../lib/supabase", () => ({ supabase: { rpc }, supabaseConfigured: true }));
vi.mock("../../lib/loadingRegistry", () => ({ withLoading: (_key: string, _label: string, promise: unknown) => promise }));

import { expandGlobalEventMapRow, fetchGlobalEventCandidatesWindow, resetGlobalEventMapRpcProbe } from "../globalEventsLoader";

const query = (result: unknown) => ({ abortSignal: () => Promise.resolve(result), then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve) });
const version = (id: string, extra: Record<string, unknown> = {}) => ({
  candidate_id: id, ai_group_id: null, version_id: "abcdef0123456789", observed_at: "2026-11-20T00:00:00Z",
  available_at: "2026-11-20T01:00:00Z", assessment_status: "assessed", assessed_at: "2026-11-20T01:00:00Z",
  title_zh_tw: "日本地震", source_headline: "Quake", category: "disaster", severity: 3, decision: "keep_core", ...extra,
});

describe("Global Events 地圖用精簡候選視窗（gis-platform 567）", () => {
  beforeEach(() => { rpc.mockReset(); resetGlobalEventMapRpcProbe(); });

  it("攤回每地點一列，沿用原本的欄位語意（概略位置、版本、顯示起點）", () => {
    const rows = expandGlobalEventMapRow(version("cand_1", { places: [
      { k: "p1", n: "Tokyo", cc: "JA", s: "fips10", lk: "city_center", sk: "gdelt_metadata_mention", xy: [139.7, 35.7], u: "https://a.test/1" },
      { k: "p2", n: "Japan", lk: "country_center", xy: [138, 36] },
    ] }));
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ candidate_id: "cand_1", observation_sha256: "abcdef0123456789", display_from: "2026-11-20T01:00:00Z",
      research_status: "ai_assessed", place_key: "p1", country_code_scheme: "fips10", location_kind: "city_center",
      evidence_url: "https://a.test/1", geometry: { type: "Point", coordinates: [139.7, 35.7] } });
    expect(rows[0]).not.toHaveProperty("places");
    expect(expandGlobalEventMapRow(version("cand_2", { places: [] }))[0]).toMatchObject({ place_key: "unknown", location_kind: "unknown", geometry: null });
  });

  it("新 RPC 分頁載完、回報進度，並帶回伺服器端藏掉的雜訊數", async () => {
    rpc.mockReturnValueOnce(query({ data: { format: "map-v1", rows: [version("cand_1", { places: [{ k: "p", lk: "city_center", xy: [1, 2] }] })],
      total_candidates: 2, noise_candidates: 5, has_more: true, next_after_candidate_id: "cand_1" }, error: null }))
      .mockReturnValueOnce(query({ data: { format: "map-v1", rows: [version("cand_2", { places: [] })],
        total_candidates: 2, noise_candidates: 5, has_more: false }, error: null }));
    const progress: number[] = [];
    const result = await fetchGlobalEventCandidatesWindow("2026-11-16T16:00:00Z", "2026-11-23T16:00:00Z", new AbortController().signal,
      { includeNoise: false, onProgress: ({ loadedCandidates }) => progress.push(loadedCandidates) });
    expect(rpc.mock.calls[0]![0]).toBe("get_global_event_candidates_map_window");
    expect(rpc.mock.calls[0]![1]).toMatchObject({ p_limit_candidates: 500, p_include_noise: false, p_after_candidate_id: null });
    expect(rpc.mock.calls[1]![1]).toMatchObject({ p_after_candidate_id: "cand_1" });
    expect(progress).toEqual([1, 2]);
    expect(result).toMatchObject({ totalCandidates: 2, partial: false, noiseCandidates: 5 });
    expect(result.rows.map((row) => row.candidateId)).toEqual(["cand_1", "cand_2"]);
    expect(result.rows[0]!.coordinates).toEqual([1, 2]);
  });

  it("567 還沒套用（找不到函式）時退回舊 RPC，之後不再重試新 RPC", async () => {
    rpc.mockImplementation((name: string) => name === "get_global_event_candidates_map_window"
      ? query({ data: null, error: { code: "PGRST202", message: "Could not find the function public.get_global_event_candidates_map_window" } })
      : query({ data: { rows: [{ candidate_id: "cand_9", observation_sha256: "f".repeat(64), place_key: "unknown", location_kind: "unknown",
        observed_at: "2026-11-20T00:00:00Z", available_at: "2026-11-20T01:00:00Z", source_headline: "x", decision: "drop_noise" }],
      total_candidates: 1, has_more: false }, error: null }));
    const first = await fetchGlobalEventCandidatesWindow("2026-11-16T16:00:00Z", "2026-11-23T16:00:00Z", new AbortController().signal);
    expect(first).toMatchObject({ totalCandidates: 1, noiseCandidates: null });
    expect(first.rows[0]!.decision).toBe("drop_noise");
    await fetchGlobalEventCandidatesWindow("2026-11-15T16:00:00Z", "2026-11-22T16:00:00Z", new AbortController().signal);
    expect(rpc.mock.calls.map((call) => call[0])).toEqual([
      "get_global_event_candidates_map_window", "get_global_event_candidates_window", "get_global_event_candidates_window"]);
  });

  it("567 已套用但函式內部出錯（例如欄位不存在 42703）不當成「未套用」", async () => {
    rpc.mockReturnValue(query({ data: null, error: { code: "42703", message: "column \"x\" does not exist" } }));
    await expect(fetchGlobalEventCandidatesWindow("2026-11-16T16:00:00Z", "2026-11-23T16:00:00Z", new AbortController().signal))
      .rejects.toThrow(/does not exist/);
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("新 RPC 其他錯誤照實丟出，不默默改走舊 RPC", async () => {
    rpc.mockReturnValue(query({ data: null, error: { code: "57014", message: "canceling statement due to statement timeout" } }));
    await expect(fetchGlobalEventCandidatesWindow("2026-11-16T16:00:00Z", "2026-11-23T16:00:00Z", new AbortController().signal))
      .rejects.toThrow(/statement timeout/);
    expect(rpc).toHaveBeenCalledTimes(1);
  });
});

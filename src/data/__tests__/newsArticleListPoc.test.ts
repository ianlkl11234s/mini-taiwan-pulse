import { afterEach, describe, expect, it, vi } from "vitest";

const source = vi.hoisted(() => ({ configured: true, rpc: vi.fn() }));
vi.mock("../../lib/supabase", () => ({
  get supabaseConfigured() { return source.configured; },
  supabase: { rpc: source.rpc },
}));
vi.mock("../../lib/loadingRegistry", () => ({ withLoading: (_id: string, _label: string, promise: Promise<unknown>) => Promise.resolve(promise) }));

import { fetchNewsArticleListPoc, parseNewsArticleListPocRow } from "../newsArticleListPoc";

const valid = {
  article_id: "a-1", title: "示範文章", summary: null, source_name: "中央社", canonical_url: "https://example.com/a-1",
  published_at: "2026-09-28T01:00:00Z", fetched_at: null, article_scope: "foreign", location_status: "accepted",
  location_precision: "country", evidence_text: null, evidence_field: null, location_role: null, geometry_kind: null,
  county: null, township: null, admin_code: null, location_resolver: null, location_method_version: null, location_review_status: null,
  place_name: null, event_occurred_from: null, event_occurred_to: null, event_time_precision: null,
  article_relation_count: "2", event_report_count: null,
  location_candidate_count: 1, accepted_location_count: 1,
};

afterEach(() => { source.configured = true; source.rpc.mockReset(); });

describe("news article location evidence POC contract", () => {
  it("keeps nullable evidence and timestamps null instead of coercing them to zero or text", () => {
    expect(parseNewsArticleListPocRow(valid)).toMatchObject({ summary: null, eventOccurredFrom: null, evidenceText: null, articleRelationCount: 2 });
    expect(parseNewsArticleListPocRow({ ...valid, article_scope: "outside" })).toBeNull();
    expect(parseNewsArticleListPocRow({ ...valid, title: null })).toBeNull();
    expect(parseNewsArticleListPocRow({ ...valid, accepted_location_count: null })).toBeNull();
  });

  it("calls the bounded RPC and validates every returned row", async () => {
    source.rpc.mockResolvedValueOnce({ data: [valid], error: null });
    await expect(fetchNewsArticleListPoc({ day: "2026-09-28", bucket: "foreign", limit: 20, beforePublishedTs: "2026-09-28T02:00:00Z" })).resolves.toHaveLength(1);
    expect(source.rpc).toHaveBeenCalledWith("get_news_articles_poc", {
      p_day: "2026-09-28", p_bucket: "foreign", p_limit: 20, p_before_published_ts: "2026-09-28T02:00:00Z",
    });
    source.rpc.mockResolvedValueOnce({ data: [{ ...valid, article_id: null }], error: null });
    await expect(fetchNewsArticleListPoc({ day: "2026-09-28" })).rejects.toThrow("NEWS_ARTICLE_LIST_POC_INVALID_RPC_RESPONSE");
  });

  it("rejects invalid bounds and an unconfigured source rather than broadening the query", async () => {
    await expect(fetchNewsArticleListPoc({ day: "bad", limit: 1 })).rejects.toThrow("NEWS_ARTICLE_LIST_POC_INVALID_DAY");
    await expect(fetchNewsArticleListPoc({ day: "2026-09-28", limit: 101 })).rejects.toThrow("NEWS_ARTICLE_LIST_POC_INVALID_LIMIT");
    source.configured = false;
    await expect(fetchNewsArticleListPoc({ day: "2026-09-28" })).rejects.toThrow("NEWS_ARTICLE_LIST_POC_SOURCE_NOT_CONFIGURED");
  });
});

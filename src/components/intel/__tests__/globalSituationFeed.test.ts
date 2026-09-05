import { describe, expect, it } from "vitest";
import {
  describeFeedLag,
  isGlobalSituationPublished,
  isGlobalSituationVisible,
  selectGlobalFeedCards,
  toIntelCardEvent,
  UNLOCATED_LABEL,
} from "../GlobalSituationFeed";
import {
  parseGlobalEventCandidate,
  parseGlobalEventRecord,
  type GlobalSituationEntry,
} from "../../../data/globalEventsLoader";
import { globalSituationFeedWindow, dedupeGlobalSituationFeed } from "../../../data/globalSituationFeedLoader";

const OBSERVED = "2026-09-05T03:00:00.000Z";
const OBSERVED_TS = Date.parse(OBSERVED) / 1000;

const published = parseGlobalEventRecord({
  event_id: "evt-published",
  version_id: "ver-1",
  title_zh_tw: "某國大規模停電",
  summary_zh_tw: "全國電網癱瘓。後續影響待評估。",
  category: "disaster",
  severity: 3,
  confidence: 0.9,
  valid_from: "2026-09-05T02:00:00.000Z",
  country_code: "JP",
  name: "東京都",
  geometry: { type: "Point", coordinates: [139.7, 35.7] },
});

function candidate(id: string, decision: string | null, extra: Record<string, unknown> = {}) {
  return parseGlobalEventCandidate({
    candidate_id: id,
    observation_sha256: `sha-${id}`,
    source_headline: `headline ${id}`,
    title_zh_tw: `事件 ${id}`,
    summary_zh_tw: `摘要 ${id}`,
    category: "accident",
    severity: 2,
    confidence: 0.5,
    decision,
    research_status: "ai_assessed",
    observed_at: OBSERVED,
    available_at: "2026-09-05T03:10:00.000Z",
    source_urls: ["https://news.example.com/story/1"],
    country_code: "US",
    name: "New York",
    location_kind: "city_center",
    geometry: { type: "Point", coordinates: [-74, 40.7] },
    ...extra,
  });
}

describe("globalSituationFeedWindow", () => {
  const noon = Date.parse("2026-09-05T04:00:00.000Z"); // 12:00 Asia/Taipei

  it("今天走滾動 24 小時，並對齊到分鐘", () => {
    const window = globalSituationFeedWindow("2026-09-05", noon + 31_123);
    expect(window).toEqual({ start: "2026-09-04T04:00:00.000Z", end: "2026-09-05T04:00:00.000Z" });
    expect(globalSituationFeedWindow("", noon)).toEqual(window);
    // 時間軸推到未來也視為今天，不會憑空造出一個未來窗
    expect(globalSituationFeedWindow("2026-09-30", noon)).toEqual(window);
  });

  it("歷史日期走 Asia/Taipei 當日 [00:00, 24:00)", () => {
    expect(globalSituationFeedWindow("2026-09-01", noon)).toEqual({
      start: "2026-08-31T16:00:00.000Z",
      end: "2026-09-01T16:00:00.000Z",
    });
  });
});

describe("dedupeGlobalSituationFeed", () => {
  it("一個事件一張卡，優先留有座標那筆，撤回／取代的不進 feed", () => {
    const locatedRow = candidate("a", "keep_core");
    const unlocatedSamePlace: GlobalSituationEntry = { ...locatedRow, coordinates: null, eventPlaceId: "other" };
    const suppressed: GlobalSituationEntry = { ...candidate("b", "keep_core"), mapSuppressed: true };
    const rows = dedupeGlobalSituationFeed([unlocatedSamePlace, locatedRow, suppressed]);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.coordinates).toEqual([-74, 40.7]);
  });
});

describe("decision 過濾", () => {
  it("已研究：沒有 candidateId 或 research_status=published", () => {
    expect(isGlobalSituationPublished(published)).toBe(true);
    expect(isGlobalSituationPublished(candidate("a", "drop_noise", { research_status: "published" }))).toBe(true);
    expect(isGlobalSituationPublished(candidate("a", "keep_core"))).toBe(false);
  });

  it("預設只顯示已研究＋keep_core；keep_watch 與未判斷要 toggle；drop_noise 永不顯示", () => {
    const table: Array<[string | null, boolean, boolean]> = [
      // decision, 預設可見, 含觀察中／未判斷可見
      ["keep_core", true, true],
      ["keep_watch", false, true],
      // decision = null（尚未判斷，約佔候選 15%）跟著 toggle 一起進來
      [null, false, true],
      ["drop_noise", false, false],
    ];
    for (const [decision, base, withWatch] of table) {
      const entry = candidate("x", decision);
      expect(isGlobalSituationVisible(entry, false)).toBe(base);
      expect(isGlobalSituationVisible(entry, true)).toBe(withWatch);
    }
    expect(isGlobalSituationVisible(published, false)).toBe(true);
  });
});

describe("toIntelCardEvent", () => {
  it("已研究事件逐欄對映到新聞卡片契約", () => {
    const card = toIntelCardEvent(published)!;
    expect(card.card_key).toBe("evt-published");
    expect(card.scope).toBe("global");
    expect(card.origin_label).toBe("已研究");
    expect(card.title).toBe("某國大規模停電");
    expect(card.summary).toBe("全國電網癱瘓。後續影響待評估。");
    expect(card.category).toBe("disaster");
    expect(card.severity).toBe(3);
    expect(card.confidence).toBe(0.9);
    expect(card.is_event).toBe(true);
    expect(card.gis_relevance).toBe(3);
    expect(card.location_name).toBe("JP · 東京都");
    expect(card.county).toBeUndefined();
    expect(card.published_ts).toBe(Date.parse("2026-09-05T02:00:00.000Z") / 1000);
    // 正式事件 RPC（get_global_event_places_window）沒有 source_urls 欄位
    expect(card.url).toBeNull();
    expect(card.source).toBeNull();
  });

  it("AI 初判：來源網域、事件時間走 observed_at 不走 available_at、分級依 decision", () => {
    const core = toIntelCardEvent(candidate("a", "keep_core"))!;
    expect(core.origin_label).toBe("AI 初判");
    expect(core.card_key).toBe("candidate:a");
    expect(core.url).toBe("https://news.example.com/story/1");
    expect(core.source).toBe("news.example.com");
    expect(core.published_ts).toBe(OBSERVED_TS);
    expect(core.gis_relevance).toBe(3);
    expect(toIntelCardEvent(candidate("b", "keep_watch"))!.gis_relevance).toBe(2);
    expect(toIntelCardEvent(candidate("c", "drop_noise"))!.gis_relevance).toBe(1);
  });

  it("未定位事件標為待定位；沒有可用事件時間就丟棄", () => {
    const unlocated = toIntelCardEvent(candidate("u", "keep_core", { geometry: null, location_kind: "unknown" }))!;
    expect(unlocated.location_name).toBe(UNLOCATED_LABEL);
    expect(toIntelCardEvent(candidate("n", "keep_core", { observed_at: null }))).toBeNull();
  });

  it("沒有中文標題時退回 source_headline，再退回摘要首句", () => {
    const noTitle = candidate("t", "keep_core", { title_zh_tw: null });
    expect(toIntelCardEvent(noTitle)!.title).toBe("headline t");
    const summaryOnly = candidate("s", "keep_core", { title_zh_tw: null, source_headline: null });
    expect(toIntelCardEvent(summaryOnly)!.title).toBe("摘要 s");
  });
});

describe("selectGlobalFeedCards", () => {
  const entries = [
    candidate("core-old", "keep_core", { observed_at: "2026-09-05T00:30:00.000Z" }),
    candidate("core-new", "keep_core", { observed_at: "2026-09-05T03:30:00.000Z" }),
    candidate("watch", "keep_watch"),
    candidate("noise", "drop_noise"),
    published,
  ];
  const endTs = Date.parse("2026-09-05T04:00:00.000Z") / 1000;

  it("RANGE 1H 用前端過濾（以事件時間），並依時間降冪", () => {
    const cards = selectGlobalFeedCards(entries, { includeWatch: false, windowStartTs: endTs - 3600, endTs });
    expect(cards.map((card) => card.card_key)).toEqual(["candidate:core-new"]);
  });

  it("RANGE 24H 收進當天全部已研究＋keep_core，仍排除 keep_watch／drop_noise", () => {
    const cards = selectGlobalFeedCards(entries, { includeWatch: false, windowStartTs: endTs - 86400, endTs });
    expect(cards.map((card) => card.card_key))
      .toEqual(["candidate:core-new", "evt-published", "candidate:core-old"]);
  });

  it("含觀察中／未判斷 toggle 會加入 keep_watch 與 null，drop_noise 仍不出現", () => {
    const withPending = [...entries, candidate("pending", null)];
    const off = selectGlobalFeedCards(withPending, { includeWatch: false, windowStartTs: endTs - 86400, endTs });
    expect(off.map((card) => card.card_key)).not.toContain("candidate:pending");
    const cards = selectGlobalFeedCards(withPending, { includeWatch: true, windowStartTs: endTs - 86400, endTs });
    const keys = cards.map((card) => card.card_key);
    expect(keys).toContain("candidate:watch");
    expect(keys).toContain("candidate:pending");
    expect(keys).not.toContain("candidate:noise");
    expect(cards.map((card) => card.published_ts)).toEqual([...cards.map((card) => card.published_ts)].sort((a, b) => b - a));
  });
});

describe("describeFeedLag", () => {
  it("沒有任何資料就不假裝知道延遲", () => {
    expect(describeFeedLag([])).toBe("近 24 小時尚無已研究或核心事件");
  });

  it("以 available_at 當資料源更新時間，與事件時間的差算出實際落後小時數", () => {
    // observed 03:00Z、available 05:30Z → 台北 13:30，落後約 3 小時（2.5 進位）
    const lagged = candidate("lag", "keep_core", { available_at: "2026-09-05T05:30:00.000Z" });
    expect(describeFeedLag([lagged])).toBe("資料源最新更新：13:30，事件時間落後約 3 小時");
  });

  it("追平後只報更新時間，不硬掛一個落後小時數", () => {
    const caughtUp = candidate("fresh", "keep_core", { available_at: OBSERVED });
    expect(describeFeedLag([caughtUp])).toBe("資料源最新更新：11:00");
  });

  it("正式事件沒有 available_at，退回 display_from／published_at", () => {
    // 真實 RPC（migration 396）一定帶 published_at／display_from，只有 available_at 是候選才有
    const withPublishedAt = parseGlobalEventRecord({
      event_id: "evt-pub-at",
      valid_from: OBSERVED,
      published_at: "2026-09-05T04:00:00.000Z",
      display_from: "2026-09-05T04:00:00.000Z",
      geometry: { type: "Point", coordinates: [1, 2] },
    });
    expect(describeFeedLag([withPublishedAt])).toBe("資料源最新更新：12:00，事件時間落後約 1 小時");
    // 三個欄位都空才說「沒資料」
    expect(describeFeedLag([published])).toBe("近 24 小時尚無已研究或核心事件");
  });
});

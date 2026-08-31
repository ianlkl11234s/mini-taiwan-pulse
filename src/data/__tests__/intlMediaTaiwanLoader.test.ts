import { describe, expect, it } from "vitest";
import { normalizeIntlMediaTaiwanRows } from "../intlMediaTaiwanLoader";

const row = (overrides: Record<string, unknown> = {}) => ({
  id: 42,
  source_id: "example-com",
  source_stream: "gkg",
  source_domain: "example.com",
  source_name: "Example News",
  source_country: "GB",
  source_city: "London",
  source_location_label: "London",
  source_latitude: 51.5072,
  source_longitude: -0.1276,
  source_location_level: "city",
  source_location_method: "outlet_registry",
  source_location_confidence: "verified",
  url: "https://example.com/taiwan-story",
  title_original: "Taiwan story in its original language",
  summary_zh: null,
  published_ts: "2026-08-31T07:15:00Z",
  collected_at: "2026-08-31T07:20:00Z",
  topics: ["外交", "科技", "外交"],
  gkg_themes: ["DIPLOMACY"],
  gkg_locations: [
    {
      location_type: 4,
      name: "Taipei",
      country_code: "TW",
      adm1_code: "TW03",
      latitude: 25.04,
      longitude: 121.53,
      feature_id: "-2637882",
    },
  ],
  importance: 2,
  taiwan_relevance: 3,
  source_kind: "foreign_editorial_media",
  severity_source: "inferred",
  llm_model: "mistralai/mistral-nemo",
  ...overrides,
});

describe("intl media Taiwan RPC contract", () => {
  it("normalizes mentioned places separately from the publisher origin", () => {
    const [item] = normalizeIntlMediaTaiwanRows([row()]);
    expect(item).toMatchObject({
      id: "42",
      sourceName: "Example News",
      sourceCountry: "GB",
      sourceLocation: {
        city: "London",
        country: "GB",
        label: "London",
        latitude: 51.5072,
        longitude: -0.1276,
        level: "city",
        method: "outlet_registry",
        confidence: "verified",
      },
      mentionedLocations: [{
        name: "Taipei",
        countryCode: "TW",
        adm1Code: "TW03",
        latitude: 25.04,
        longitude: 121.53,
        featureId: "-2637882",
        locationType: 4,
      }],
      titleOriginal: "Taiwan story in its original language",
      gdeltRecordedTs: 1_788_160_500,
      topics: ["外交", "科技"],
      importance: 2,
      taiwanRelevance: 3,
      severitySource: "inferred",
    });
    expect(item).not.toHaveProperty("publishedAt");
  });

  it("keeps invalid or one-sided coordinates as a null pair", () => {
    const [item] = normalizeIntlMediaTaiwanRows([row({
      source_latitude: 91,
      source_longitude: -0.1276,
      gkg_locations: [
        { name: "Taipei", latitude: 25.04 },
        { name: "Bad", latitude: 20, longitude: Number.POSITIVE_INFINITY },
      ],
    })]);
    expect(item!.sourceLocation).toMatchObject({ latitude: null, longitude: null });
    expect(item!.mentionedLocations).toEqual([
      expect.objectContaining({ name: "Taipei", latitude: null, longitude: null }),
      expect.objectContaining({ name: "Bad", latitude: null, longitude: null }),
    ]);
  });

  it("normalizes unknown source-location enums conservatively", () => {
    const [item] = normalizeIntlMediaTaiwanRows([row({
      source_location_level: "office",
      source_location_method: "llm_guess",
      source_location_confidence: "certain",
    })]);
    expect(item!.sourceLocation).toMatchObject({ level: null, method: null, confidence: null });
  });

  it("rejects non-editorial rows and invalid required metadata", () => {
    const items = normalizeIntlMediaTaiwanRows([
      row({ id: 1, source_kind: "government_announcement" }),
      row({ id: 2, title_original: "" }),
      row({ id: 3, published_ts: "not-a-time" }),
      row({ id: 4 }),
    ]);
    expect(items.map((item) => item.id)).toEqual(["4"]);
  });

  it("keeps invalid levels null and prevents non-http links from becoming actions", () => {
    const [item] = normalizeIntlMediaTaiwanRows([
      row({ importance: 9, taiwan_relevance: -1, url: "javascript:alert(1)" }),
    ]);
    expect(item).toMatchObject({ importance: null, taiwanRelevance: null, url: null });
  });

  it("sorts by GDELT record timestamp newest first", () => {
    const items = normalizeIntlMediaTaiwanRows([
      row({ id: 1, published_ts: "2026-08-30T00:00:00Z" }),
      row({ id: 2, published_ts: "2026-08-31T00:00:00Z" }),
    ]);
    expect(items.map((item) => item.id)).toEqual(["2", "1"]);
  });
});

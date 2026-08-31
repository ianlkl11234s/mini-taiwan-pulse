import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { IntlMediaCard } from "../IntlMediaCard";
import type { IntlMediaTaiwanItem } from "../../../data/intlMediaTaiwanLoader";

const item: IntlMediaTaiwanItem = {
  id: "42",
  sourceId: "example-com",
  sourceStream: "gkg",
  sourceDomain: "example.com",
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
  sourceName: "Example News",
  url: "https://example.com/story",
  titleOriginal: "Original-language Taiwan headline",
  summaryZh: "這是 AI 產生的中文摘要。",
  gdeltRecordedTs: 1_788_163_200,
  collectedAt: "2026-08-31T07:20:00Z",
  topics: ["外交", "科技"],
  gkgThemes: ["DIPLOMACY"],
  mentionedLocations: [{
    name: "Taipei",
    countryCode: "TW",
    adm1Code: "TW03",
    latitude: 25.04,
    longitude: 121.53,
    featureId: "-2637882",
    locationType: 4,
  }],
  importance: 2,
  taiwanRelevance: 3,
  sourceKind: "foreign_editorial_media",
  severitySource: "inferred",
  llmModel: "mistralai/mistral-nemo",
};

describe("IntlMediaCard", () => {
  it("labels inferred importance and GDELT record time without alert severity language", () => {
    const html = renderToStaticMarkup(createElement(IntlMediaCard, {
      item,
      expanded: true,
      onToggle: () => undefined,
      nowTs: 1_788_163_800,
    }));
    expect(html).toContain("Original-language Taiwan headline");
    expect(html).toContain("AI 推估 · importance 2/3");
    expect(html).toContain("GDELT 收錄");
    expect(html).toContain("GDELT GKG 收錄時間");
    expect(html).toContain("GB");
    expect(html).toContain("媒體來源所在地");
    expect(html).toContain("London（媒體登錄資料）");
    expect(html).toContain("報導提及地點");
    expect(html).toContain("Taipei");
    expect(html).not.toContain("事件地點");
    expect(html).not.toContain("嚴重程度");
    expect(html).not.toContain("發布時間");
  });

  it("labels a country fallback as inferred rather than an exact city", () => {
    const html = renderToStaticMarkup(createElement(IntlMediaCard, {
      item: {
        ...item,
        sourceLocation: {
          city: null,
          country: "US",
          label: "United States",
          latitude: 39.8283,
          longitude: -98.5795,
          level: "country",
          method: "country_registry",
          confidence: "fallback",
        },
      },
      expanded: true,
      onToggle: () => undefined,
      nowTs: 1_788_163_800,
    }));
    expect(html).toContain("媒體來源國家");
    expect(html).toContain("United States（國家代表點推定）");
  });
});

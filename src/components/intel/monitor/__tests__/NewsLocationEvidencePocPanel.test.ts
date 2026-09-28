import { describe, expect, it } from "vitest";
import { partitionNewsScopeListPoc } from "../../NewsScopeListPoc";
import type { NewsArticleListPocRow } from "../../../../data/newsArticleListPoc";

const row = (overrides: Partial<NewsArticleListPocRow>): NewsArticleListPocRow => ({
  articleId: "a", title: "文章", summary: null, sourceName: null, url: null, publishedAt: null, fetchedAt: null,
  placeName: null, eventOccurredFrom: null, eventOccurredTo: null, eventTimePrecision: null,
  locationScope: "foreign", locationStatus: "unresolved", locationPrecision: "country", evidenceText: null,
  evidenceField: null, locationRole: null, geometryKind: null, county: null, township: null, adminCode: null,
  locationResolver: null, locationMethodVersion: null, locationReviewStatus: null, articleRelationCount: null,
  eventReportCount: null, locationCandidateCount: 1, acceptedLocationCount: 0, ...overrides,
});

describe("NewsLocationEvidencePocPanel data boundary", () => {
  it("keeps an unresolved foreign article in both applicable POC sections", () => {
    const sections = partitionNewsScopeListPoc([row({})]);
    expect(sections.map((section) => section.rows.length)).toEqual([1, 0, 1]);
  });
});

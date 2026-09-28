import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { NewsScopeListPoc, partitionNewsScopeListPoc } from "../NewsScopeListPoc";
import type { NewsArticleListPocRow } from "../../../data/newsArticleListPoc";

const article = (overrides: Partial<NewsArticleListPocRow>): NewsArticleListPocRow => ({
  articleId: "a-1", title: "示範文章", summary: null, sourceName: "中央社", url: null,
  publishedAt: "2026-09-28T01:00:00Z", fetchedAt: null, placeName: null, eventOccurredFrom: null, eventOccurredTo: null, eventTimePrecision: null,
  locationScope: "unknown", locationStatus: "unresolved", locationPrecision: "none", evidenceText: null, evidenceField: null, locationRole: null, geometryKind: null,
  county: null, township: null, adminCode: null, locationResolver: null, locationMethodVersion: null, locationReviewStatus: null,
  locationCandidateCount: 0, acceptedLocationCount: 0,
  articleRelationCount: null, eventReportCount: null, ...overrides,
});

describe("NewsScopeListPoc", () => {
  it("uses orthogonal sections: a foreign unresolved row appears in both foreign and unlocated", () => {
    const sections = partitionNewsScopeListPoc([
      article({ articleId: "u" }), article({ articleId: "n", locationScope: "taiwan_national", locationStatus: "accepted", acceptedLocationCount: 1 }),
      article({ articleId: "f", locationScope: "foreign", locationStatus: "unresolved", acceptedLocationCount: 0 }),
      article({ articleId: "local", locationScope: "taiwan_local", locationStatus: "accepted", acceptedLocationCount: 1 }),
    ]);
    expect(sections.map((section) => section.rows.map((row) => row.articleId))).toEqual([["u", "f"], ["n"], ["f"]]);
  });

  it("renders evidence semantics, nullable values, and no confidence percentage", () => {
    const html = renderToStaticMarkup(createElement(NewsScopeListPoc, { articles: [
      article({ locationPrecision: "county", evidenceText: "文中只提到縣市", articleRelationCount: 3 }),
      article({ articleId: "f", title: "海外已定位文章", locationScope: "foreign", locationStatus: "accepted", locationPrecision: "address", acceptedLocationCount: 1 }),
    ] }));
    for (const expected of ["未定位", "全國／多地", "國外", "縣市（非精確點）", "短證據", "同稿候選數", "同事件報導數", "解析方法", "方法版本", "時空相近，不代表同一事件", "展開僅查看證據，不移動地圖", "海外已定位文章"]) {
      expect(html).toContain(expected);
    }
    expect(html).toContain("—");
    expect(html).not.toMatch(/confidence|信心|%/i);
  });
});

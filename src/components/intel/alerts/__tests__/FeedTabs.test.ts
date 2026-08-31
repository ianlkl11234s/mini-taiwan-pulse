import { describe, expect, it } from "vitest";
import { feedTabCount, type FeedTab } from "../FeedTabs";

describe("FeedTabs counts", () => {
  const counts = {
    newsCount: 5,
    internationalCount: 3,
    alertCount: 4,
    alertCountInAll: 2,
  };

  it("gives international media its own tab count", () => {
    expect(feedTabCount("international", counts)).toBe(3);
  });

  it("includes international media in all without changing the full alert tab count", () => {
    expect(feedTabCount("all", counts)).toBe(10);
    expect(feedTabCount("alerts", counts)).toBe(4);
  });

  it("keeps all four tab keys in the public union", () => {
    const tabs: FeedTab[] = ["all", "news", "alerts", "international"];
    expect(tabs).toHaveLength(4);
  });
});

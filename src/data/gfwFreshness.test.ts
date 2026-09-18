import { describe, expect, it } from "vitest";
import { gfwFreshness } from "./gfwFreshness";

const NOW = Date.parse("2026-09-18T12:00:00Z");

describe("GFW release freshness", () => {
  it("keeps the full UTC date and marks old releases stale", () => {
    expect(gfwFreshness("2026-08-21", NOW)).toEqual({
      date: "2026-08-21",
      ageDays: 28,
      status: "stale",
      label: "2026-08-21 UTC（落後 28 天 · STALE／已過期）",
    });
  });

  it("allows the expected five-day GFW source lag without a stale badge", () => {
    expect(gfwFreshness("2026-09-13", NOW).status).toBe("current");
    expect(gfwFreshness("2026-09-13", NOW).label).toBe("2026-09-13 UTC（落後 5 天）");
  });

  it("fails closed for malformed or future dates", () => {
    expect(gfwFreshness("821", NOW).status).toBe("invalid");
    expect(gfwFreshness("2026-09-19", NOW).status).toBe("invalid");
  });
});

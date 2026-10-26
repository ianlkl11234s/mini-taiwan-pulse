import { describe, expect, it } from "vitest";
import { canonicalHrefFor } from "../canonical";

describe("canonicalHrefFor", () => {
  it("英日語版自我指向", () => {
    expect(canonicalHrefFor("?lang=en")).toBe("https://mini-taiwan-pulse.itsmigu.com/?lang=en");
    expect(canonicalHrefFor("?v=1&lang=ja")).toBe("https://mini-taiwan-pulse.itsmigu.com/?lang=ja");
  });
  it("中文、缺值、未知值維持根網址", () => {
    for (const search of ["", "?lang=zh-TW", "?lang=fr", "?foo=1"]) expect(canonicalHrefFor(search)).toBe("https://mini-taiwan-pulse.itsmigu.com/");
  });
});

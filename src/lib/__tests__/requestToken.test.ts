import { describe, expect, it } from "vitest";
import { createRequestToken } from "../requestToken";

describe("createRequestToken", () => {
  it("舊請求在帳號切換（invalidate）或被新請求取代後不再有效", () => {
    const t = createRequestToken();
    const a = t.begin();
    expect(t.isCurrent(a)).toBe(true);
    t.invalidate();
    expect(t.isCurrent(a)).toBe(false);
    const b = t.begin(); const c = t.begin();
    expect(t.isCurrent(b)).toBe(false);
    expect(t.isCurrent(c)).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import { resolveManeuverListScope, SEVERITY_VIEW } from "../maneuverAlertKit";

describe("resolveManeuverListScope", () => {
  it("即時模式：無提示、無時間錨點", () => {
    expect(resolveManeuverListScope(false)).toEqual({ anchorMs: null, notice: null });
  });
  it("歷史模式：提示清單仍為現在近 24 小時，不假造錨點", () => {
    const s = resolveManeuverListScope(true);
    expect(s.anchorMs).toBeNull();
    expect(s.notice).toContain("仍為現在近 24 小時");
  });
});

describe("SEVERITY_VIEW", () => {
  it("四級嚴重度都有中文名", () => {
    expect(Object.values(SEVERITY_VIEW).map((v) => v.zh).sort()).toEqual(["重大", "注意", "例行", "無法判定"].sort());
  });
});

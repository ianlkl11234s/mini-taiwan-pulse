import { describe, expect, it } from "vitest";
import { formatJpWildlifeDuration } from "../jpNatureR2Types";

describe("formatJpWildlifeDuration（鳥獸保護區存続期間補分隔）", () => {
  it("兩個日期黏在一起時補「～」（VPB-5）", () => {
    expect(formatJpWildlifeDuration("2018年10月17日2038年10月16日")).toBe("2018年10月17日～2038年10月16日");
  });
  it("中間有空白也補", () => {
    expect(formatJpWildlifeDuration("2018年1月1日 2038年1月1日")).toBe("2018年1月1日～2038年1月1日");
  });
  it("其他格式原樣回傳", () => {
    expect(formatJpWildlifeDuration("")).toBe("");
    expect(formatJpWildlifeDuration("2018年10月17日～2038年10月16日")).toBe("2018年10月17日～2038年10月16日");
    expect(formatJpWildlifeDuration("無期限")).toBe("無期限");
  });
});

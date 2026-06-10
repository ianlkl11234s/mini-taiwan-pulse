import { describe, it, expect } from "vitest";

// 測試基礎建設 smoke test — 確認 vitest 可跑、tsc -b 可過。
describe("test infra", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });
});

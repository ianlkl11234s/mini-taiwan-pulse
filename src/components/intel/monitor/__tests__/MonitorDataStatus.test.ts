import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { MonitorDataStatus } from "../MonitorDataStatus";

const text = (status: "ready" | "unknown" | "error" | "denied", lastSuccessAt: number | null) => renderToStaticMarkup(createElement(MonitorDataStatus, { label: "來源", query: { status, lastSuccessAt } }));
describe("Monitor resource health", () => {
  it("labels a retained failure separately from an initial failure", () => {
    expect(text("error", 1000)).toContain("保留舊資料，最後成功讀取");
    expect(text("error", null)).not.toContain("保留舊資料");
  });
  it("never labels a denial as a transient failure or a successful read as source freshness", () => {
    expect(text("denied", null)).toContain("無權限讀取");
    expect(text("denied", null)).not.toContain("保留舊資料");
    expect(text("ready", 1000)).toBe("");
    expect(text("unknown", null)).toContain("讀取中");
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// R8-2：手機頂部時間軸條要跟隨底圖主題（#516 只修了底部面板）。
describe("手機時間軸條主題 (R8-2)", () => {
  const app = readFileSync("src/App.tsx", "utf8");
  const start = app.indexOf("Timeline — 時間軸屬地圖控制列");
  const section = app.slice(start, app.indexOf("</div>", app.indexOf("<HistoricalTimeline", start)));

  it("找得到手機時間軸區塊", () => {
    expect(start).toBeGreaterThan(0);
    expect(section).toContain("isMobile={true}");
  });

  it("Live／Historical 時間軸都傳入實際主題，不寫死 true", () => {
    expect(section).not.toContain("isDarkTheme={true}");
    expect(section.match(/isDarkTheme=\{isDarkTheme\}/g)?.length).toBe(2);
  });

  it("外層背景淡色用 LIGHT token，暗色維持 rgba(0,0,0,0.4)", () => {
    expect(section).toContain('isDarkTheme ? "rgba(0,0,0,0.4)" : LIGHT.surfaceStrong');
  });
});

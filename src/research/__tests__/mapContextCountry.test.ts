import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// 國家主體化 PR 4：map_context 回傳面板目前的國家主體（countryStore），讓 Agent 知道使用者正在看哪一國。
// MainMapConnection 是整支連線元件，這裡只釘住 map_context 的回傳物件帶 country，且來源是 countryStore 而非相機中心。
describe("map_context 帶目前國家", () => {
  it("map_context 回傳 country: countryStore.getSnapshot()", () => {
    const source = readFileSync("src/research/MainMapConnection.tsx", "utf8");
    const block = source.slice(source.indexOf('case "map_context": {'), source.indexOf('case "search_layers":'));
    expect(block).toContain("country: countryStore.getSnapshot()");
  });
});

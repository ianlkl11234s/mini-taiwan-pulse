import { describe, expect, it } from "vitest";
import { buildSystemPrompt } from "../systemPrompt";
import type { MapBridge } from "../types";

const bridge = {
  getVisibleLayerKeys: () => [],
  getCamera: () => ({ lng: 121.5, lat: 25.04, zoom: 10 }),
  getCurrentTimeISO: () => "2026-10-15T00:00:00Z",
} as unknown as MapBridge;

describe("對話框回答語言跟著介面語系", () => {
  it("中文介面用繁體中文回答", () => {
    const p = buildSystemPrompt(bridge, "zh-TW");
    expect(p).toContain("請用繁體中文回答");
    expect(p).not.toContain("括號附中文原名");
  });

  it("英文、日文介面改用該語言，並提醒翻譯工具回傳的中文名稱", () => {
    expect(buildSystemPrompt(bridge, "en")).toContain("請用英文（English）回答");
    expect(buildSystemPrompt(bridge, "ja")).toContain("請用日文（日本語）回答");
    expect(buildSystemPrompt(bridge, "en")).toContain("括號附中文原名");
  });

  it("靜態段跨語系相同（prompt cache 不因切換語言失效）", () => {
    const head = (s: string) => s.slice(0, s.indexOf("# 目前地圖現況"));
    expect(head(buildSystemPrompt(bridge, "en"))).toBe(head(buildSystemPrompt(bridge, "zh-TW")));
  });
});

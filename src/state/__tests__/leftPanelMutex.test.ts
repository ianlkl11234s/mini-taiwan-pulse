import { describe, expect, it } from "vitest";
import { leftPanelsToClose, type LeftPanelState } from "../leftPanelMutex";

const closed: LeftPanelState = { agent: false, earthquakeReplay: false, intel: false, satellite: false, member: false };
const state = (open: Partial<LeftPanelState>): LeftPanelState => ({ ...closed, ...open });

describe("leftPanelsToClose（Z1 左側面板一次只開一個）", () => {
  it("地震回放開著時打開 Agent → 關地震回放", () => {
    expect(leftPanelsToClose(state({ earthquakeReplay: true }), state({ earthquakeReplay: true, agent: true }))).toEqual(["earthquakeReplay"]);
  });

  it("Agent 開著時打開地震回放 → 關 Agent", () => {
    expect(leftPanelsToClose(state({ agent: true }), state({ agent: true, earthquakeReplay: true }))).toEqual(["agent"]);
  });

  it("打開即時情報 → 關其他所有開著的左側面板", () => {
    expect(leftPanelsToClose(state({ earthquakeReplay: true, member: true }), state({ earthquakeReplay: true, member: true, intel: true })))
      .toEqual(["earthquakeReplay", "member"]);
  });

  it("只有關閉、沒有新開 → 不動作（避免連鎖觸發）", () => {
    expect(leftPanelsToClose(state({ agent: true, earthquakeReplay: true }), state({ earthquakeReplay: true }))).toEqual([]);
    expect(leftPanelsToClose(closed, closed)).toEqual([]);
  });

  it("同一輪同時打開兩個 → 依固定順序保留第一個", () => {
    expect(leftPanelsToClose(closed, state({ agent: true, earthquakeReplay: true }))).toEqual(["earthquakeReplay"]);
  });
});

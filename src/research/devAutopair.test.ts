import { describe, expect, it } from "vitest";
import { DEV_AUTOPAIR, STANDBY_RENEW_MS, devPanelState, devTabLabel, standbyStep, type Standby } from "./devAutopair";

const status = (pairingId: string, claimed: boolean, approved: boolean, phrase: string | null = null) => ({ pairingId, claimed, approved, deviceLabel: claimed ? "Claude-Local" : null, phrase });

describe("dev autopair", () => {
  it("stays off unless the flag is explicitly set", () => {
    // vitest 不設 VITE_RESEARCH_DEV_AUTOPAIR：預設必須關閉。
    expect(DEV_AUTOPAIR).toBe(false);
  });

  it("derives the same short tab name as the gateway", () => {
    expect(devTabLabel("a3f0c2d1-0000-4000-8000-000000000000")).toBe("A3F");
    expect(devTabLabel("-b-7c9")).toBe("B7C");
  });

  it("standby pairing: create, approve once claimed, renew before expiry", () => {
    const now = 100_000;
    expect(standbyStep(null, null, null, now)).toEqual({ kind: "create" });
    const waiting: Standby = { pairingId: "p1", expiresAt: now + 300_000 };
    expect(standbyStep(waiting, status("p1", false, false), null, now)).toEqual({ kind: "wait" });
    expect(standbyStep(waiting, status("p1", true, false, "ABCD-EFGH"), null, now)).toEqual({ kind: "approve", phrase: "ABCD-EFGH" });
    expect(standbyStep(waiting, status("other", true, false, "ABCD-EFGH"), null, now)).toEqual({ kind: "wait" });
    expect(standbyStep(waiting, status("p1", false, false), null, waiting.expiresAt - STANDBY_RENEW_MS)).toEqual({ kind: "create" });
  });

  it("approved standby is replaced only after a new agent session exchanged it (takeover)", () => {
    const now = 100_000;
    const approved: Standby = { pairingId: "p1", expiresAt: now + 300_000, approvedForSession: "session-old" };
    expect(standbyStep(approved, null, "session-old", now)).toEqual({ kind: "wait" });
    expect(standbyStep(approved, null, null, now)).toEqual({ kind: "wait" });
    expect(standbyStep(approved, null, "session-new", now)).toEqual({ kind: "create" });
    const first: Standby = { ...approved, approvedForSession: null };
    expect(standbyStep(first, null, "session-1", now)).toEqual({ kind: "create" });
  });

  it("panel shows the green connected state with the tab name, otherwise waiting", () => {
    expect(devPanelState("a3f0", true, false)).toMatchObject({ tone: "live", title: "本機免授權・已連線", label: "分頁 A3F" });
    expect(devPanelState("a3f0", false, false)).toMatchObject({ tone: "waiting", title: "等待 Agent 連線", label: "分頁 A3F" });
    expect(devPanelState(null, true, false)).toMatchObject({ tone: "waiting", label: "分頁準備中" });
  });
});

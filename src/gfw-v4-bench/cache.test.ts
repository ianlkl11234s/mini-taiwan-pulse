import { describe, expect, it, vi } from "vitest";
import { DayPackLru, ForegroundRequestGate, adjacentDates } from "./cache";
import type { BenchManifest, TrackPack } from "./types";

const pack = (date: string): TrackPack => ({ displayDate: date, bucket: "cargo", segments: [], pointCount: 0 });

describe("GFW v4 selected-day cache", () => {
  it("retains only 2-3 UTC days and evicts the least recently used day", () => {
    const now = vi.spyOn(performance, "now");
    now.mockReturnValueOnce(1).mockReturnValueOnce(2).mockReturnValueOnce(3).mockReturnValueOnce(4);
    const cache = new DayPackLru(2);
    cache.put("2026-08-19", "cargo", pack("2026-08-19"));
    cache.put("2026-08-20", "cargo", pack("2026-08-20"));
    cache.get("2026-08-19", "cargo");
    cache.put("2026-08-21", "cargo", pack("2026-08-21"));
    expect(cache.dates()).toEqual(["2026-08-19", "2026-08-21"]);
    now.mockRestore();
  });

  it("aborts the stale foreground request before issuing the next one", () => {
    const gate = new ForegroundRequestGate();
    const first = gate.next();
    const second = gate.next();
    expect(first.signal.aborted).toBe(true);
    expect(second.signal.aborted).toBe(false);
  });

  it("prefetches only immediate adjacent indexed days", () => {
    const days = new Map(["2026-08-19", "2026-08-20", "2026-08-21"].map((displayDate) => [displayDate, { displayDate, assets: new Map() }]));
    const manifest = { days } as unknown as BenchManifest;
    expect(adjacentDates(manifest, "2026-08-20")).toEqual(["2026-08-19", "2026-08-21"]);
  });
});

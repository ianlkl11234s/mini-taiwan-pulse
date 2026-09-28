import { describe, expect, it } from "vitest";
import { SELECTION_CLICK_MAX_AGE_MS, lastSelectionClick, recordSelectionClick, selectionRingAccent, selectionRingPosition } from "../selectionRing";

describe("selection ring position", () => {
  const click = { lngLat: [121.5, 25.04] as [number, number], at: 1_000 };

  it("draws nothing without an open docked panel, even right after a click", () => {
    expect(selectionRingPosition(null, click, 1_001)).toBeNull();
  });

  it("prefers the feature's own coords (snapped point or AI marker)", () => {
    expect(selectionRingPosition({ coords: [120.1, 23.9] }, click, 1_001)).toEqual([120.1, 23.9]);
  });

  it("falls back to the last map click for panels without coords (e.g. analysis results)", () => {
    expect(selectionRingPosition({}, click, 1_000 + SELECTION_CLICK_MAX_AGE_MS)).toEqual([121.5, 25.04]);
  });

  it("does not reuse a stale click for a panel opened later without coords", () => {
    expect(selectionRingPosition({}, click, 1_001 + SELECTION_CLICK_MAX_AGE_MS)).toBeNull();
    expect(selectionRingPosition({}, null, 1_001)).toBeNull();
  });

  it("records the latest click from the single map click listener", () => {
    recordSelectionClick([121, 24], 5);
    expect(lastSelectionClick()).toEqual({ lngLat: [121, 24], at: 5 });
  });

  it("uses the dark / light accent from the design sheet", () => {
    expect(selectionRingAccent(true)).toBe("#64aaff");
    expect(selectionRingAccent(false)).toBe("#0b6fd6");
  });
});

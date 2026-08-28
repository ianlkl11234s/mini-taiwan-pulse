import { describe, expect, it } from "vitest";
import type { BenchAssetEntry, BenchManifest } from "../gfw-v4-bench/types";
import {
  isGfwV4ShadowRuntimeEnabled,
  normalizeGfwV4Buckets,
  selectGfwV4ShadowAssets,
} from "./gfwV4ShadowTracksLoader";

describe("gfw v4 shadow loader gates", () => {
  it("requires both DEV and the explicit query flag", () => {
    expect(isGfwV4ShadowRuntimeEnabled(true, "?gfwV4Shadow=1")).toBe(true);
    expect(isGfwV4ShadowRuntimeEnabled(false, "?gfwV4Shadow=1")).toBe(false);
    expect(isGfwV4ShadowRuntimeEnabled(true, "?gfwV4Shadow=0")).toBe(false);
  });

  it("deduplicates buckets in canonical order", () => {
    expect(normalizeGfwV4Buckets(["other", "cargo", "cargo", "fishing"])).toEqual(["cargo", "fishing", "other"]);
  });

  it("selects only enabled bucket assets and fails closed on a missing pack", () => {
    const cargo = { bucket: "cargo" as const, format: "binary" as const, path: "cargo.daypack", bytes: 1, sha256: null };
    const fishing = { bucket: "fishing" as const, format: "binary" as const, path: "fishing.daypack", bytes: 1, sha256: null };
    const manifest: BenchManifest = {
      manifestUrl: "http://localhost/gfw-v4-browser-manifest.json",
      releaseId: "2026-08-21",
      bbox: [115, 20, 135, 37],
      days: new Map([["2026-08-21", {
        displayDate: "2026-08-21",
        assets: new Map<string, BenchAssetEntry>([["cargo|binary", cargo], ["fishing|binary", fishing]]),
      }]]),
    };
    expect(selectGfwV4ShadowAssets(manifest, "2026-08-21", ["fishing"], "binary")).toEqual([fishing]);
    expect(() => selectGfwV4ShadowAssets(manifest, "2026-08-21", ["tanker"], "binary")).toThrow(/missing/);
  });
});

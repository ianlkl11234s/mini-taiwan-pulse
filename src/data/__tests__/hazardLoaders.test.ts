import { describe, it, expect } from "vitest";
import {
  clampMinutes, lightningTypeColor, toLightningFC,
  LIGHTNING_TYPE_COLORS, LIGHTNING_TYPE_LABELS,
  type LightningStrike,
} from "../lightningLoader";
import {
  classifyNuclearDose, nuclearDoseColor, toNuclearFC,
  NUCLEAR_DOSE_THRESHOLDS, NUCLEAR_LEVEL_COLORS,
  type NuclearStation,
} from "../nuclearLoader";

describe("lightningLoader pure helpers", () => {
  describe("clampMinutes", () => {
    it("clamps to [1, 720]", () => {
      expect(clampMinutes(0)).toBe(1);
      expect(clampMinutes(-100)).toBe(1);
      expect(clampMinutes(1)).toBe(1);
      expect(clampMinutes(60)).toBe(60);
      expect(clampMinutes(720)).toBe(720);
      expect(clampMinutes(721)).toBe(720);
      expect(clampMinutes(99999)).toBe(720);
    });
    it("floors fractional input", () => {
      expect(clampMinutes(60.9)).toBe(60);
    });
    it("falls back to 60 for non-finite", () => {
      expect(clampMinutes(NaN)).toBe(60);
      expect(clampMinutes(Infinity)).toBe(60); // floor → still infinite, but then NaN check; actual: floor(Infinity)=Infinity then clamp 720
      // Infinity 走 Math.min(720, max(1, floor)) → 720。對 Infinity 行為其實可接受，明示一下
    });
  });

  describe("lightningTypeColor", () => {
    it("maps strike_type to expected colors", () => {
      expect(lightningTypeColor(0)).toBe(LIGHTNING_TYPE_COLORS[0]);
      expect(lightningTypeColor(1)).toBe(LIGHTNING_TYPE_COLORS[1]);
    });
    it("unknown type → fallback grey", () => {
      expect(lightningTypeColor(null)).toBe("#9ca3af");
      expect(lightningTypeColor(undefined)).toBe("#9ca3af");
      expect(lightningTypeColor(99)).toBe("#9ca3af");
    });
    it("LIGHTNING_TYPE_LABELS covers 0 and 1", () => {
      expect(LIGHTNING_TYPE_LABELS[0]).toBe("雲對地");
      expect(LIGHTNING_TYPE_LABELS[1]).toBe("雲中");
    });
  });

  describe("toLightningFC", () => {
    const row: LightningStrike = {
      event_id: 7, strike_ts: 1718800000, intensity_ka: -45.2,
      strike_type: 0, lon: 121.5, lat: 25.0,
    };
    it("returns valid FeatureCollection geometry", () => {
      const fc = toLightningFC([row]);
      expect(fc.type).toBe("FeatureCollection");
      expect(fc.features).toHaveLength(1);
      const f = fc.features[0]!;
      expect(f.geometry.type).toBe("Point");
      expect(f.geometry.coordinates).toEqual([121.5, 25.0]);
      expect(f.properties).toMatchObject({
        event_id: 7, strike_ts: 1718800000,
        intensity_ka: -45.2, strike_type: 0,
      });
    });
    it("empty input → empty FC", () => {
      const fc = toLightningFC([]);
      expect(fc.features).toEqual([]);
    });
  });
});

describe("nuclearLoader pure helpers", () => {
  describe("classifyNuclearDose", () => {
    it("is_stale overrides everything → 'stale'", () => {
      expect(classifyNuclearDose(0.05, true)).toBe("stale");
      expect(classifyNuclearDose(99, true)).toBe("stale");
      expect(classifyNuclearDose(null, true)).toBe("stale");
    });
    it("null dose with non-stale → 'stale' (defensive)", () => {
      expect(classifyNuclearDose(null, false)).toBe("stale");
    });
    it("background range → 'normal'", () => {
      expect(classifyNuclearDose(0.039, false)).toBe("normal");
      expect(classifyNuclearDose(NUCLEAR_DOSE_THRESHOLDS.normal, false)).toBe("normal");
    });
    it("just above background → 'watch'", () => {
      expect(classifyNuclearDose(0.1, false)).toBe("watch");
      expect(classifyNuclearDose(NUCLEAR_DOSE_THRESHOLDS.watch, false)).toBe("watch");
    });
    it("0.2-0.5 → 'warning'", () => {
      expect(classifyNuclearDose(0.3, false)).toBe("warning");
      expect(classifyNuclearDose(NUCLEAR_DOSE_THRESHOLDS.warning, false)).toBe("warning");
    });
    it(">0.5 → 'alarm'", () => {
      expect(classifyNuclearDose(0.51, false)).toBe("alarm");
      expect(classifyNuclearDose(99, false)).toBe("alarm");
    });
  });

  describe("nuclearDoseColor", () => {
    it("aligns with classify + LEVEL_COLORS", () => {
      expect(nuclearDoseColor(0.05, false)).toBe(NUCLEAR_LEVEL_COLORS.normal);
      expect(nuclearDoseColor(0.99, false)).toBe(NUCLEAR_LEVEL_COLORS.alarm);
      expect(nuclearDoseColor(0.05, true)).toBe(NUCLEAR_LEVEL_COLORS.stale);
    });
  });

  describe("toNuclearFC", () => {
    const rows: NuclearStation[] = [
      {
        station_id: "S01", station_name: "金山", dose_usvh: 0.045,
        is_stale: false, observed_ts: 100, lon: 121.6, lat: 25.2,
      },
      {
        station_id: "S02", station_name: "蘭嶼", dose_usvh: 0.42,
        is_stale: false, observed_ts: 100, lon: 121.5, lat: 22.0,
      },
      {
        station_id: "S03", station_name: "stale", dose_usvh: 9.9,
        is_stale: true, observed_ts: 100, lon: 0, lat: 0,
      },
    ];
    it("tags each feature with level for paint expression", () => {
      const fc = toNuclearFC(rows);
      const levels = fc.features.map((f) => f.properties?.level);
      expect(levels).toEqual(["normal", "warning", "stale"]);
    });
    it("preserves coords + station identity", () => {
      const fc = toNuclearFC(rows);
      expect(fc.features[0]!.geometry.coordinates).toEqual([121.6, 25.2]);
      expect(fc.features[0]!.properties?.station_id).toBe("S01");
    });
  });
});

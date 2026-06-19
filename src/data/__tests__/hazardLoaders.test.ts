import { describe, it, expect } from "vitest";
import {
  clampMinutes, lightningTypeColor, toLightningFC,
  lightningAlpha, toLightningFCAt,
  LIGHTNING_TYPE_COLORS, LIGHTNING_TYPE_LABELS,
  type LightningStrike,
} from "../lightningLoader";
import {
  classifyNuclearDose, nuclearDoseColor, toNuclearFC,
  buildNuclearFCAt,
  NUCLEAR_DOSE_THRESHOLDS, NUCLEAR_LEVEL_COLORS,
  type NuclearStation, type NuclearDay,
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

describe("lightningAlpha fade curve", () => {
  const life = 60; // 60 sec lifetime for easy math
  it("future strike → 0", () => {
    expect(lightningAlpha(100, 99, life)).toBe(0);
  });
  it("just appeared → fades in over fadeInSec", () => {
    expect(lightningAlpha(100, 100, life, 0.5)).toBe(0);     // age 0
    expect(lightningAlpha(100, 100.25, life, 0.5)).toBe(0.5); // age 0.25 / 0.5
    expect(lightningAlpha(100, 100.5, life, 0.5)).toBe(1);   // age 0.5
  });
  it("middle of life → full alpha 1", () => {
    expect(lightningAlpha(100, 110, life)).toBe(1); // age 10s of 60s
    expect(lightningAlpha(100, 130, life)).toBe(1); // age 30s
  });
  it("fade out over last 40% (24s of 60s)", () => {
    // fadeOutStart = life - life*0.4 = 36
    expect(lightningAlpha(100, 136, life)).toBeCloseTo(1, 2);   // 邊界仍 1
    expect(lightningAlpha(100, 148, life)).toBeCloseTo(0.5, 2); // 中段
    expect(lightningAlpha(100, 160, life)).toBe(0);              // age = life
  });
  it("past life → 0", () => {
    expect(lightningAlpha(100, 200, life)).toBe(0);
  });
});

describe("toLightningFCAt", () => {
  const rows: LightningStrike[] = [
    { event_id: 1, strike_ts: 100, intensity_ka: -20, strike_type: 0, lon: 121, lat: 25 },
    { event_id: 2, strike_ts: 150, intensity_ka: -10, strike_type: 1, lon: 121, lat: 25 },
    { event_id: 3, strike_ts: 200, intensity_ka: 5, strike_type: 0, lon: 121, lat: 25 },
  ];
  it("at ts=130, only event 1 visible (event 2 future, event 3 future)", () => {
    const fc = toLightningFCAt(rows, 130, 60);
    expect(fc.features.map((f) => f.properties?.event_id)).toEqual([1]);
    expect(fc.features[0]!.properties?.alpha).toBeGreaterThan(0);
  });
  it("at ts=210, events 1+2+3 may be visible (1 fade out / 2 fade out / 3 fresh)", () => {
    const fc = toLightningFCAt(rows, 210, 120);
    const ids = fc.features.map((f) => f.properties?.event_id);
    // event 1 age=110s, life=120 → still in fade-out band
    // event 2 age=60s → full
    // event 3 age=10s → full
    expect(ids).toEqual([1, 2, 3]);
  });
  it("at ts=500, all events past life → empty FC", () => {
    const fc = toLightningFCAt(rows, 500, 60);
    expect(fc.features).toEqual([]);
  });
});

describe("buildNuclearFCAt", () => {
  const day: NuclearDay = {
    date_key: "2026-06-19",
    stations: [
      {
        station_id: "A", station_name: "A 站", lon: 121.5, lat: 25,
        points: [[100, 0.05], [200, 0.06], [300, 0.07]] as [number, number][],
      },
      {
        station_id: "B", station_name: "B 站", lon: 121.6, lat: 25.1,
        points: [[100, 0.04]] as [number, number][], // 只有早期一筆
      },
    ],
  };

  it("returns empty FC for null day", () => {
    const fc = buildNuclearFCAt(null, 500);
    expect(fc.features).toEqual([]);
  });

  it("at ts=250, A 站取 ts=200 reading (age 50s → normal), B 站取 ts=100 (age 150s → 仍 < 30min)", () => {
    const fc = buildNuclearFCAt(day, 250);
    const a = fc.features.find((f) => f.properties?.station_id === "A");
    const b = fc.features.find((f) => f.properties?.station_id === "B");
    expect(a?.properties?.dose_usvh).toBe(0.06);
    expect(a?.properties?.level).toBe("normal");
    expect(a?.properties?.alpha).toBe(1);
    expect(b?.properties?.dose_usvh).toBe(0.04);
    expect(b?.properties?.is_stale).toBe(false); // 150s < 30min
  });

  it("at ts=100+31*60 (31 min later), B 站 is_stale=true", () => {
    const fc = buildNuclearFCAt(day, 100 + 31 * 60);
    const b = fc.features.find((f) => f.properties?.station_id === "B");
    expect(b?.properties?.is_stale).toBe(true);
    expect(b?.properties?.level).toBe("stale");
    expect(b?.properties?.alpha).toBe(1);
  });

  it("at ts=100+150*60 (150 min later), B 站 alpha 開始 fade (120~240 min 線性)", () => {
    const fc = buildNuclearFCAt(day, 100 + 150 * 60);
    const b = fc.features.find((f) => f.properties?.station_id === "B");
    expect(b!.properties!.alpha as number).toBeCloseTo(1 - 30 / 120, 2); // (150-120)/120 fade
  });

  it("at ts=100+250*60 (>240 min later), B 站從 FC 拿掉", () => {
    const fc = buildNuclearFCAt(day, 100 + 250 * 60);
    const b = fc.features.find((f) => f.properties?.station_id === "B");
    expect(b).toBeUndefined();
  });

  it("at ts=50 (早於所有 reading), 兩站都不渲染", () => {
    const fc = buildNuclearFCAt(day, 50);
    expect(fc.features).toEqual([]);
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

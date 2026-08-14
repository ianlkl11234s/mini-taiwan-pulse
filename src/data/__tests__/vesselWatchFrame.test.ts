/**
 * `vesselAtTime` / `frameToGeoJSON` —— 特殊船舶「隨時間軸移動」的核心。
 *
 * 這裡釘住的是**正確性**而非美觀：AIS 是岸基接收，船離開覆蓋範圍就沒訊號。
 * 實測 3 天視窗有 346 對相鄰點間隔 > 1 小時、最大 67 小時。若照一般插值，
 * 播放時會看到船「緩慢飄過台灣海峽」——一段完全不存在的航程。
 * 因此中斷期間必須停在最後已知點並標記 stale，由呼叫端淡化呈現。
 */
import { describe, it, expect } from "vitest";
import { vesselAtTime, frameToGeoJSON, type VesselWatchTrail } from "../vesselWatchLoader";
import type { TrailPoint } from "../../types";

const T0 = 1_760_000_000;

function trail(path: TrailPoint[], mmsi = "413000001"): VesselWatchTrail {
  return { mmsi, shipName: "TEST SHIP", vesselClass: "中國海警", flag: "CN", confidence: "presumed", path };
}

/** 每 15 分鐘一筆的正常取樣（對齊實測密度） */
const CONTINUOUS: TrailPoint[] = [
  [24.0, 120.0, 0, T0],
  [24.1, 120.1, 0, T0 + 900],
  [24.2, 120.2, 0, T0 + 1800],
];

describe("vesselAtTime — 船隨時間移動", () => {
  it("兩點之間會插值出中間位置（這就是「船會動」）", () => {
    const at = vesselAtTime(trail(CONTINUOUS), T0 + 450, 3600)!;
    expect(at.lat).toBeCloseTo(24.05, 6);
    expect(at.lng).toBeCloseTo(120.05, 6);
    expect(at.stale).toBe(false);
  });

  it("不同時刻回傳不同位置", () => {
    const a = vesselAtTime(trail(CONTINUOUS), T0 + 200, 3600)!;
    const b = vesselAtTime(trail(CONTINUOUS), T0 + 1600, 3600)!;
    expect(a.lat).not.toBeCloseTo(b.lat, 4);
    expect(b.lat).toBeGreaterThan(a.lat);
  });

  it("時間軸還沒走到這艘船第一次出現 → 不顯示（而非提早出現在起點）", () => {
    expect(vesselAtTime(trail(CONTINUOUS), T0 - 60, 3600)).toBeNull();
  });
});

describe("vesselAtTime — 訊號中斷不得虛構航程（核心正確性）", () => {
  /** 兩點相隔 20 小時且距離很遠：實際是失聯後在別處重新出現 */
  const GAPPED: TrailPoint[] = [
    [24.0, 120.0, 0, T0],
    [26.5, 122.5, 0, T0 + 72_000],
  ];

  it("中斷區間內停在最後已知點，不插值飄移", () => {
    const mid = vesselAtTime(trail(GAPPED), T0 + 36_000, 3600)!;
    expect(mid.lat).toBe(24.0);
    expect(mid.lng).toBe(120.0);
    expect(mid.stale).toBe(true);
  });

  it("中斷期間任何時刻都不會出現在兩點之間的海面上", () => {
    for (const frac of [0.25, 0.5, 0.75, 0.99]) {
      const at = vesselAtTime(trail(GAPPED), T0 + 72_000 * frac, 3600)!;
      expect(at.lat).toBe(24.0);
    }
  });

  it("訊號恢復後回到正常（不再 stale）", () => {
    const at = vesselAtTime(trail(GAPPED), T0 + 72_000, 3600)!;
    expect(at.lat).toBe(26.5);
    expect(at.stale).toBe(false);
  });

  it("超過最後一筆但仍在 3 小時內 → 不算失聯", () => {
    const at = vesselAtTime(trail(CONTINUOUS), T0 + 1800 + 3600, 3600)!;
    expect(at.stale).toBe(false);
    expect(at.ageSec).toBe(3600);
  });

  it("超過 3 小時沒回報 → 標記 stale 供前端淡化", () => {
    const at = vesselAtTime(trail(CONTINUOUS), T0 + 1800 + 4 * 3600, 3600)!;
    expect(at.stale).toBe(true);
  });
});

describe("vesselAtTime — 拖尾", () => {
  it("只含視窗內的點，且接上當下插值位置", () => {
    const at = vesselAtTime(trail(CONTINUOUS), T0 + 1800, 1200)!;
    // 視窗 1200 秒 → 只涵蓋 T0+900 與 T0+1800 兩筆，末端再接當下位置
    expect(at.trail.length).toBeGreaterThanOrEqual(2);
    expect(at.trail[0]![1]).toBeCloseTo(24.1, 6);
  });

  it("拖尾不跨越訊號中斷", () => {
    const path: TrailPoint[] = [
      [24.0, 120.0, 0, T0],
      [26.5, 122.5, 0, T0 + 72_000],
      [26.6, 122.6, 0, T0 + 72_900],
    ];
    const at = vesselAtTime(trail(path), T0 + 72_900, 80_000)!;
    // 視窗涵蓋全部三點，但中間有 20 小時斷訊 → 只保留恢復後那一段
    for (const c of at.trail) expect(c[1]).toBeGreaterThan(26.0);
  });
});

describe("frameToGeoJSON", () => {
  it("回傳點與線兩份，properties 帶 stale / age_sec 供 paint 與 popup 用", () => {
    const { points, trails } = frameToGeoJSON([trail(CONTINUOUS)], T0 + 450, 3600);
    expect(points.features).toHaveLength(1);
    const p = points.features[0]!;
    expect(p.geometry.type).toBe("Point");
    expect(p.properties!.stale).toBe(0);
    expect(p.properties!.age_sec).toBe(0);
    expect(p.properties!.class_color).toBeTruthy();
    expect(trails.features.length).toBeLessThanOrEqual(1);
  });

  it("尚未出現的船完全不進畫面", () => {
    const { points } = frameToGeoJSON([trail(CONTINUOUS)], T0 - 1000, 3600);
    expect(points.features).toHaveLength(0);
  });
});

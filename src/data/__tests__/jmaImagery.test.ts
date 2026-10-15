import { describe, expect, it } from "vitest";
import {
  JMA_IMAGERY_MAX_WINDOW_DAYS,
  jmaImageryWindowFor,
  pickJmaImageryFrame,
  rowsToJmaImageryFrames,
  type JmaImageryManifestRow,
} from "../jmaImageryLoader";
import {
  JMA_IMAGERY_PRODUCTS,
  JMA_IMAGERY_RASTER_COLOR_MIX,
  JMA_IMAGERY_RASTER_COLOR_RANGE,
  JMA_IMAGERY_UNCOVERED_COLOR,
  MAPBOX_COLOR_RAMP_RES,
  jmaImageryRasterColor,
  jmaImageryRasterPaint,
  type JmaImageryProduct,
} from "../jmaTypes";

const SNOW = JMA_IMAGERY_PRODUCTS.snow_depth;
const CDN = "https://cdn.example";

function row(validIso: string, over: Partial<JmaImageryManifestRow> = {}): JmaImageryManifestRow {
  return {
    product: "snow_depth", valid_time: validIso, status: "ok",
    image_key: `imagery/jma/snow_depth/${validIso.slice(0, 10).replace(/-/g, "")}/${validIso.slice(11, 19).replace(/:/g, "")}.png`,
    image_bytes: 1000, image_width: 2048, image_height: 1536,
    lon_min: 112.5, lon_max: 157.5, lat_min: 21.9, lat_max: 48.9, encoding: "level_la_v1",
    ...over,
  };
}

function frames(rows: JmaImageryManifestRow[]) {
  return rowsToJmaImageryFrames(rows, CDN).get("snow_depth") ?? [];
}

const ms = (iso: string) => new Date(iso).getTime();

/** raster-color step 表達式 → 給定 raster-value 的輸出（模擬 mapbox step 語意） */
function evalStep(expr: unknown[], value: number): unknown {
  expect(expr[0]).toBe("step");
  let out = expr[2];
  for (let i = 3; i < expr.length; i += 2) {
    if (value >= (expr[i] as number)) out = expr[i + 1];
    else break;
  }
  return out;
}

describe("JMA imagery 選幀", () => {
  const fs = frames([
    row("2026-10-15T00:00:00Z"),
    row("2026-10-15T01:00:00Z"),
    row("2026-10-15T02:00:00Z"),
    // 03:00 缺幀
    row("2026-10-15T04:00:00Z"),
  ]);

  it("回放取 ≤ t 的最晚一幀，URL 由 CDN base + image_key 組成", () => {
    const p = pickJmaImageryFrame(fs, ms("2026-10-15T01:40:00Z"), SNOW, false);
    expect(p.kind).toBe("frame");
    if (p.kind !== "frame") return;
    expect(p.frame.validTimeIso).toBe("2026-10-15T01:00:00Z");
    expect(p.frame.url).toBe(`${CDN}/imagery/jma/snow_depth/20261015/010000.png`);
  });

  it("t 早於第一幀 → 未涵蓋（不退回第一幀）", () => {
    const p = pickJmaImageryFrame(fs, ms("2026-10-14T23:30:00Z"), SNOW, false);
    expect(p).toMatchObject({ kind: "uncovered", reason: "no_frame", frame: null });
  });

  it("缺幀超過 maxStale → 未涵蓋（不沿用舊圖）", () => {
    // 02:00 幀到 03:31 已 91 分 > 90
    const p = pickJmaImageryFrame(fs, ms("2026-10-15T03:31:00Z"), SNOW, false);
    expect(p).toMatchObject({ kind: "uncovered", reason: "stale" });
    expect(pickJmaImageryFrame(fs, ms("2026-10-15T03:29:00Z"), SNOW, false).kind).toBe("frame");
  });

  it("status=missing（image_key NULL）→ 未涵蓋", () => {
    const f = frames([row("2026-10-15T00:00:00Z"), row("2026-10-15T01:00:00Z", { status: "missing", image_key: null })]);
    expect(pickJmaImageryFrame(f, ms("2026-10-15T01:10:00Z"), SNOW, false)).toMatchObject({ kind: "uncovered", reason: "missing" });
  });

  it("encoding 與色票不符 → 未涵蓋", () => {
    const f = frames([row("2026-10-15T00:00:00Z", { encoding: "sst_la_v1" })]);
    expect(pickJmaImageryFrame(f, ms("2026-10-15T00:10:00Z"), SNOW, false)).toMatchObject({ kind: "uncovered", reason: "encoding" });
  });

  it("沒有 CDN base → url 為 null → 未涵蓋", () => {
    const f = rowsToJmaImageryFrames([row("2026-10-15T00:00:00Z")], "").get("snow_depth")!;
    expect(f[0]!.url).toBeNull();
    expect(pickJmaImageryFrame(f, ms("2026-10-15T00:10:00Z"), SNOW, false).kind).toBe("uncovered");
  });

  it("即時模式取最新一幀；最新一幀過舊（collector 停擺）→ 未涵蓋", () => {
    const live = pickJmaImageryFrame(fs, ms("2026-10-15T05:30:00Z"), SNOW, true);
    expect(live.kind).toBe("frame");
    if (live.kind === "frame") expect(live.frame.validTimeIso).toBe("2026-10-15T04:00:00Z");
    expect(pickJmaImageryFrame(fs, ms("2026-10-15T07:01:00Z"), SNOW, true)).toMatchObject({ kind: "uncovered", reason: "stale" });
    expect(pickJmaImageryFrame([], Date.now(), SNOW, true)).toMatchObject({ kind: "uncovered", reason: "no_frame" });
  });

  it("frames 依 valid_time 升序（RPC 亂序也一樣）", () => {
    const f = frames([row("2026-10-15T02:00:00Z"), row("2026-10-15T00:00:00Z")]);
    expect(f.map((x) => x.validTimeIso)).toEqual(["2026-10-15T00:00:00Z", "2026-10-15T02:00:00Z"]);
  });
});

describe("JMA imagery 時間窗", () => {
  it("前推 maxStale，讓台北 00:00 也找得到前一幀；未來不超過 now+1h", () => {
    const now = ms("2026-10-15T12:00:00Z");
    const w = jmaImageryWindowFor(["2026-10-15"], SNOW, now);
    expect(w.sinceIso).toBe(new Date(ms("2026-10-14T16:00:00Z") - 90 * 60_000).toISOString());
    expect(w.untilIso).toBe("2026-10-15T13:00:00.000Z");
    expect(w.stepMinutes).toBe(0);
  });

  it("視窗 7 天仍在 RPC 8 天上限內", () => {
    const keys = ["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04", "2026-10-05", "2026-10-06", "2026-10-07"];
    const w = jmaImageryWindowFor(keys, SNOW, ms("2026-10-15T00:00:00Z"));
    expect(ms(w.untilIso) - ms(w.sinceIso)).toBeLessThan(JMA_IMAGERY_MAX_WINDOW_DAYS * 24 * 3600_000);
  });
});

describe("JMA imagery 色票（raster-color）", () => {
  // data-collectors config/decode_tables/jma/snow_depth.yaml（jma-snow_depth-2026-10-09-provisional）
  const YAML_LEVELS: [number, [number, number, number]][] = [
    [1, [160, 210, 255]], [2, [33, 140, 255]], [3, [0, 65, 255]], [4, [255, 245, 0]],
    [5, [255, 153, 0]], [6, [255, 40, 0]], [7, [180, 0, 104]],
  ];

  it("積雪 7 級與 decode table 一致", () => {
    expect(SNOW.levels.map((l) => [l.level, [...l.rgb]])).toEqual(YAML_LEVELS);
    expect(SNOW.paletteVersion).toBe("jma-snow_depth-2026-10-09-provisional");
  });

  it("L=0 透明、1–7 各級色、8–254 透明、255 未涵蓋灰；門檻在 L−0.5", () => {
    const expr = jmaImageryRasterColor(SNOW);
    expect(evalStep(expr, 0)).toBe("rgba(0, 0, 0, 0)");
    for (const [level, rgb] of YAML_LEVELS) {
      const want = `rgb(${rgb.join(", ")})`;
      expect(evalStep(expr, level)).toBe(want);
      // mapbox 色帶 1024 格 tabulate：整數 L 實際取樣值約 L−0.003 ~ L+0.25
      expect(evalStep(expr, level - 0.01)).toBe(want);
      expect(evalStep(expr, level + 0.3)).toBe(want);
    }
    expect(evalStep(expr, 8)).toBe("rgba(0, 0, 0, 0)");
    expect(evalStep(expr, 254)).toBe("rgba(0, 0, 0, 0)");
    expect(evalStep(expr, 255)).toBe(JMA_IMAGERY_UNCOVERED_COLOR);
  });

  it("paint：補償 mix、range=[0,255]、nearest、無淡入", () => {
    const paint = jmaImageryRasterPaint(SNOW, 0.7);
    expect(paint).toMatchObject({
      "raster-opacity": 0.7, "raster-resampling": "nearest", "raster-fade-duration": 0,
      "raster-color-mix": [...JMA_IMAGERY_RASTER_COLOR_MIX], "raster-color-range": [0, 255],
    });
    expect(JMA_IMAGERY_RASTER_COLOR_MIX[0]).toBeCloseTo(255.747, 3);
  });

  it("模擬 mapbox 3.x 色帶取樣：L=0..255 每一值都落在正確的級（含 255 未涵蓋）", () => {
    // mapbox-gl 3.18 draw_raster：coord = 0.5/RES + (L/255)·mix·CMF·255·(RES−1)/(RES·(max−min))；
    // 色帶第 i 格的值 = min + i·(max−min)/(RES−1)；nearest 取樣。
    const RES = MAPBOX_COLOR_RAMP_RES;
    const CMF = (RES ** 2 - 1) / (255 * RES * (RES + 3));
    const [min, max] = JMA_IMAGERY_RASTER_COLOR_RANGE;
    const mix = JMA_IMAGERY_RASTER_COLOR_MIX[0];
    const expr = jmaImageryRasterColor(SNOW);
    for (let L = 0; L <= 255; L++) {
      const coord = 0.5 / RES + (L / 255) * mix * CMF * 255 * (RES - 1) / (RES * (max - min));
      const texel = Math.min(RES - 1, Math.floor(coord * RES));
      const sampled = min + texel * (max - min) / (RES - 1);
      expect(evalStep(expr, sampled), `L=${L} sampled=${sampled}`).toBe(evalStep(expr, L));
    }
  });

  it("等級不連續的產品：未登記等級畫透明，不沿用上一級顏色", () => {
    const sparse: JmaImageryProduct = {
      ...SNOW, product: "test", levels: [{ level: 2, rgb: [1, 2, 3], label: "a" }, { level: 5, rgb: [4, 5, 6], label: "b" }],
    };
    const expr = jmaImageryRasterColor(sparse);
    expect(evalStep(expr, 1)).toBe("rgba(0, 0, 0, 0)");
    expect(evalStep(expr, 2)).toBe("rgb(1, 2, 3)");
    expect(evalStep(expr, 3)).toBe("rgba(0, 0, 0, 0)");
    expect(evalStep(expr, 5)).toBe("rgb(4, 5, 6)");
    expect(evalStep(expr, 255)).toBe(JMA_IMAGERY_UNCOVERED_COLOR);
  });

  it("sst_la_v1：°C = L/7 − 3 的 stop 換回 L；255 未涵蓋", () => {
    const sst: JmaImageryProduct = {
      product: "sst_him", encoding: "sst_la_v1", paletteVersion: "test", cadenceMin: 1440, maxStaleMin: 2160,
      liveMaxStaleMin: 2880, historyStepMin: 0,
      scalar: { unit: "°C", scale: 1 / 7, offset: -3, stops: [{ value: 0, color: "#000" }, { value: 30, color: "#fff" }] },
    };
    const expr = jmaImageryRasterColor(sst);
    const ramp = evalStep(expr, 100) as unknown[];
    expect(ramp[0]).toBe("interpolate");
    expect(ramp[3]).toBeCloseTo(21); // 0 °C → L = 21
    expect(ramp[5]).toBeCloseTo(231); // 30 °C → L = 231
    expect(evalStep(expr, 255)).toBe(JMA_IMAGERY_UNCOVERED_COLOR);
  });
});

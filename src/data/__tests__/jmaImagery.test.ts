import { describe, expect, it } from "vitest";
import {
  JMA_IMAGERY_MAX_WINDOW_DAYS,
  JMA_IMAGERY_ROWS_PER_CALL,
  jmaImageryInactiveReason,
  jmaImageryWindowChunks,
  jmaImageryWindowFor,
  pickJmaImageryFrame,
  rowsToJmaImageryFrames,
  type JmaImageryManifestRow,
} from "../jmaImageryLoader";
import {
  JMA_IMAGERY_LAYERS,
  JMA_IMAGERY_PRODUCTS,
  JMA_IMAGERY_RASTER_COLOR_MIX,
  JMA_IMAGERY_RASTER_COLOR_RANGE,
  JMA_IMAGERY_UNCOVERED_COLOR,
  MAPBOX_COLOR_RAMP_RES,
  jmaImageryRasterColor,
  jmaImageryRasterPaint,
  jmaImageryValueToLevel,
  type JmaImageryProduct,
} from "../jmaTypes";

const SNOW = JMA_IMAGERY_PRODUCTS.snow_depth;
const CDN = "https://cdn.example";

function row(validIso: string, over: Partial<JmaImageryManifestRow> = {}): JmaImageryManifestRow {
  return {
    product: "snow_depth", valid_time: validIso, status: "ok",
    image_key: `imagery/jma/${over.product ?? "snow_depth"}/${validIso.slice(0, 10).replace(/-/g, "")}/${validIso.slice(11, 19).replace(/:/g, "")}.png`,
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

/** 回放測試固定「現在」在遠未來，避免牆鐘時間落在 liveMaxStaleMin 內而改用即時容忍度。 */
const FAR = Date.parse("2030-01-01T00:00:00Z");

describe("JMA imagery 選幀", () => {
  const fs = frames([
    row("2026-10-15T00:00:00Z"),
    row("2026-10-15T01:00:00Z"),
    row("2026-10-15T02:00:00Z"),
    // 03:00 缺幀
    row("2026-10-15T04:00:00Z"),
  ]);

  it("回放取 ≤ t 的最晚一幀，URL 由 CDN base + image_key 組成", () => {
    const p = pickJmaImageryFrame(fs, ms("2026-10-15T01:40:00Z"), SNOW, false, FAR);
    expect(p.kind).toBe("frame");
    if (p.kind !== "frame") return;
    expect(p.frame.validTimeIso).toBe("2026-10-15T01:00:00Z");
    expect(p.frame.url).toBe(`${CDN}/imagery/jma/snow_depth/20261015/010000.png`);
  });

  it("t 早於第一幀 → 未涵蓋（不退回第一幀）", () => {
    const p = pickJmaImageryFrame(fs, ms("2026-10-14T23:30:00Z"), SNOW, false, FAR);
    expect(p).toMatchObject({ kind: "uncovered", reason: "no_frame", frame: null });
  });

  it("缺幀超過 maxStale → 未涵蓋（不沿用舊圖）", () => {
    // 02:00 幀到 03:31 已 91 分 > 90
    const p = pickJmaImageryFrame(fs, ms("2026-10-15T03:31:00Z"), SNOW, false, FAR);
    expect(p).toMatchObject({ kind: "uncovered", reason: "stale" });
    expect(pickJmaImageryFrame(fs, ms("2026-10-15T03:29:00Z"), SNOW, false, FAR).kind).toBe("frame");
  });

  it("status=missing（image_key NULL）→ 未涵蓋", () => {
    const f = frames([row("2026-10-15T00:00:00Z"), row("2026-10-15T01:00:00Z", { status: "missing", image_key: null })]);
    expect(pickJmaImageryFrame(f, ms("2026-10-15T01:10:00Z"), SNOW, false, FAR)).toMatchObject({ kind: "uncovered", reason: "missing" });
  });

  it("encoding 與色票不符 → 未涵蓋", () => {
    const f = frames([row("2026-10-15T00:00:00Z", { encoding: "sst_la_v1" })]);
    expect(pickJmaImageryFrame(f, ms("2026-10-15T00:10:00Z"), SNOW, false, FAR)).toMatchObject({ kind: "uncovered", reason: "encoding" });
  });

  it("沒有 CDN base → url 為 null → 未涵蓋", () => {
    const f = rowsToJmaImageryFrames([row("2026-10-15T00:00:00Z")], "").get("snow_depth")!;
    expect(f[0]!.url).toBeNull();
    expect(pickJmaImageryFrame(f, ms("2026-10-15T00:10:00Z"), SNOW, false, FAR).kind).toBe("uncovered");
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

describe("JMA imagery 選幀：near-now 只對過去時間成立（F149）", () => {
  it("t 在未來（> now）不套即時容忍度，仍用回放 maxStale", () => {
    const radar = JMA_IMAGERY_PRODUCTS.radar;
    const radarFrames = rowsToJmaImageryFrames([row("2026-10-15T00:00:00Z", { product: "radar" })], CDN).get("radar") ?? [];
    const now = ms("2026-10-15T00:00:00Z");
    // 幀比 t 舊 60 分：已超過 radar.maxStale(15)，但在 liveMaxStale(90) 內
    const past = pickJmaImageryFrame(radarFrames, now + 60 * 60_000, radar, false, now + 60 * 60_000);
    expect(past.kind === "frame").toBe(true); // t == now，視為現在
    const future = pickJmaImageryFrame(radarFrames, now + 60 * 60_000, radar, false, now);
    expect(future).toMatchObject({ kind: "uncovered", reason: "stale" });
  });
});

describe("JMA imagery 時間窗", () => {
  it("前推 maxStale，讓台北 00:00 也找得到前一幀；未來不超過 now+1h", () => {
    const now = ms("2026-10-15T12:00:00Z");
    const w = jmaImageryWindowFor(["2026-10-15"], SNOW, now);
    // F126／F150：前推取 max(回放容忍, 即時容忍)，即時容忍較大時邊界才不漏幀
    expect(SNOW.liveMaxStaleMin).toBeGreaterThan(SNOW.maxStaleMin);
    expect(w.sinceIso).toBe(new Date(ms("2026-10-14T16:00:00Z") - SNOW.liveMaxStaleMin * 60_000).toISOString());
    expect(w.untilIso).toBe("2026-10-15T13:00:00.000Z");
    expect(w.stepMinutes).toBe(0);
  });

  it("radar：前推 90 分（即時容忍）而不是 15 分（F150）", () => {
    const radar = JMA_IMAGERY_PRODUCTS.radar;
    const w = jmaImageryWindowFor(["2026-10-15"], radar, ms("2026-10-15T12:00:00Z"));
    expect(w.sinceIso).toBe(new Date(ms("2026-10-14T16:00:00Z") - 90 * 60_000).toISOString());
  });

  const WEEK = ["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04", "2026-10-05", "2026-10-06", "2026-10-07"];

  it("視窗不在 jmaImageryWindowFor 截 8 天（截掉的會是最近的日子）；分塊後每塊 ≤ 8 天、首尾相接", () => {
    for (const p of Object.values(JMA_IMAGERY_PRODUCTS)) {
      const w = jmaImageryWindowFor(WEEK, p, ms("2026-10-15T00:00:00Z"));
      expect(w.untilIso).toBe("2026-10-07T16:00:00.000Z");
      const chunks = jmaImageryWindowChunks(w, p.cadenceMin);
      expect(chunks[0]!.sinceIso).toBe(w.sinceIso);
      expect(chunks[chunks.length - 1]!.untilIso).toBe(w.untilIso);
      chunks.forEach((c, i) => {
        expect(ms(c.untilIso) - ms(c.sinceIso)).toBeLessThan(JMA_IMAGERY_MAX_WINDOW_DAYS * 24 * 3600_000);
        // 每塊預期列數不超過 PostgREST max-rows 的安全值
        expect((ms(c.untilIso) - ms(c.sinceIso)) / (p.cadenceMin * 60_000)).toBeLessThanOrEqual(JMA_IMAGERY_ROWS_PER_CALL);
        if (i > 0) expect(c.sinceIso).toBe(chunks[i - 1]!.untilIso); // RPC 是 [since, until) 半開區間
      });
    }
    // sst 前推 36h：7 天視窗 + 36h > 8 天 → 必須分成 2 塊
    const sstW = jmaImageryWindowFor(WEEK, JMA_IMAGERY_PRODUCTS.sst_him, ms("2026-10-15T00:00:00Z"));
    expect(jmaImageryWindowChunks(sstW, 1440)).toHaveLength(2);
    // radar 5 分一幀：單日 1 塊（≈291 列），7 天 3 塊
    const radar = JMA_IMAGERY_PRODUCTS.radar;
    expect(jmaImageryWindowChunks(jmaImageryWindowFor(["2026-10-07"], radar, ms("2026-10-15T00:00:00Z")), 5)).toHaveLength(1);
    expect(jmaImageryWindowChunks(jmaImageryWindowFor(WEEK, radar, ms("2026-10-15T00:00:00Z")), 5)).toHaveLength(3);
  });

  it("分塊邊界重複回的同一幀只留一筆", () => {
    const f = frames([row("2026-10-15T00:00:00Z"), row("2026-10-15T01:00:00Z"), row("2026-10-15T01:00:00Z")]);
    expect(f.map((x) => x.validTimeIso)).toEqual(["2026-10-15T00:00:00Z", "2026-10-15T01:00:00Z"]);
  });
});

describe("JMA imagery 產品登記簿", () => {
  it("每個圖層 key 都對到登記簿的 product", () => {
    for (const product of Object.values(JMA_IMAGERY_LAYERS)) expect(JMA_IMAGERY_PRODUCTS[product].product).toBe(product);
    expect(new Set(Object.values(JMA_IMAGERY_LAYERS)).size).toBe(Object.keys(JMA_IMAGERY_PRODUCTS).length);
  });

  it("各產品容忍度（回放／即時，分）", () => {
    const tol = Object.fromEntries(Object.values(JMA_IMAGERY_PRODUCTS).map((p) => [p.product, [p.maxStaleMin, p.liveMaxStaleMin]]));
    expect(tol).toEqual({
      snow_depth: [90, 180], radar: [15, 90], rasrf: [60, 120], risk_land: [60, 150], risk_inund: [60, 150],
      uv_anal: [90, 180], sst_him: [72 * 60, 72 * 60], sea_ice: [72 * 60, 72 * 60], himawari_b13: [90, 180],
      ana_snow_first: [36 * 60, 48 * 60], ana_snow_days: [36 * 60, 48 * 60], ana_rain_days: [36 * 60, 48 * 60],
      ana_risk_land_hours: [36 * 60, 48 * 60], ana_risk_inund_hours: [36 * 60, 48 * 60],
    });
    for (const p of Object.values(JMA_IMAGERY_PRODUCTS)) {
      expect(p.maxStaleMin).toBeGreaterThanOrEqual(p.cadenceMin); // 至少容得下一個發布間隔
      expect(p.liveMaxStaleMin).toBeGreaterThanOrEqual(p.maxStaleMin);
    }
  });

  it("radar 容忍度：缺 2 幀（10 分）仍顯示、缺到 16 分 → 未涵蓋", () => {
    const radar = JMA_IMAGERY_PRODUCTS.radar;
    const f = rowsToJmaImageryFrames([row("2026-10-15T00:00:00Z", { product: "radar" })], CDN).get("radar")!;
    expect(pickJmaImageryFrame(f, ms("2026-10-15T00:14:00Z"), radar, false, FAR).kind).toBe("frame");
    expect(pickJmaImageryFrame(f, ms("2026-10-15T00:16:00Z"), radar, false, FAR)).toMatchObject({ kind: "uncovered", reason: "stale" });
    // 停在今天稍早（離現在 < liveMaxStaleMin）：新幀可能還沒發布，用即時容忍度（collector 每小時整批，實測最舊 66 分）
    const now = ms("2026-10-15T01:10:00Z");
    expect(pickJmaImageryFrame(f, ms("2026-10-15T01:05:00Z"), radar, false, now).kind).toBe("frame");
    expect(pickJmaImageryFrame(f, ms("2026-10-15T01:35:00Z"), radar, false, ms("2026-10-15T01:35:30Z"))).toMatchObject({ kind: "uncovered", reason: "stale" });
  });

  it("uv_anal：JST 06:00–18:59 才發布；其餘 → off_hours（夜間無資料），不是 stale", () => {
    const uv = JMA_IMAGERY_PRODUCTS.uv_anal;
    expect(jmaImageryInactiveReason(uv, ms("2026-10-15T05:59:00+09:00"))).toBe("off_hours");
    expect(jmaImageryInactiveReason(uv, ms("2026-10-15T06:00:00+09:00"))).toBeNull();
    expect(jmaImageryInactiveReason(uv, ms("2026-10-15T18:59:00+09:00"))).toBeNull();
    expect(jmaImageryInactiveReason(uv, ms("2026-10-15T19:00:00+09:00"))).toBe("off_hours");
    const f = rowsToJmaImageryFrames([row("2026-10-15T09:00:00Z", { product: "uv_anal" })], CDN).get("uv_anal")!; // 18:00 JST
    expect(pickJmaImageryFrame(f, ms("2026-10-15T18:40:00+09:00"), uv, false, FAR).kind).toBe("frame");
    expect(pickJmaImageryFrame(f, ms("2026-10-15T22:00:00+09:00"), uv, false, FAR)).toMatchObject({ kind: "uncovered", reason: "off_hours" });
    expect(pickJmaImageryFrame(f, ms("2026-10-15T22:00:00+09:00"), uv, true)).toMatchObject({ kind: "uncovered", reason: "off_hours" });
  });

  it("sea_ice：只有 12–5 月（JST）；6–11 月 → off_season（季外）", () => {
    const ice = JMA_IMAGERY_PRODUCTS.sea_ice;
    expect(jmaImageryInactiveReason(ice, ms("2026-10-15T12:00:00+09:00"))).toBe("off_season");
    expect(jmaImageryInactiveReason(ice, ms("2026-11-30T23:59:00+09:00"))).toBe("off_season");
    expect(jmaImageryInactiveReason(ice, ms("2026-12-01T00:00:00+09:00"))).toBeNull(); // = 11-30T15:00Z
    expect(jmaImageryInactiveReason(ice, ms("2027-05-31T23:00:00+09:00"))).toBeNull();
    expect(jmaImageryInactiveReason(ice, ms("2027-06-01T00:00:00+09:00"))).toBe("off_season");
    expect(pickJmaImageryFrame([], ms("2026-07-01T00:00:00Z"), ice, false, FAR)).toMatchObject({ kind: "uncovered", reason: "off_season" });
  });

  it("sst_him：日檔 valid_time＝該日 00:00 JST（R2 key 日期是 UTC 前一日 150000），上游晚約 1.5 天，72h 內都用這一幀", () => {
    const sst = JMA_IMAGERY_PRODUCTS.sst_him;
    const rows = [row("2026-10-13T15:00:00Z", { product: "sst_him", encoding: "sst_la_v1" })];
    expect(rows[0]!.image_key).toBe("imagery/jma/sst_him/20261013/150000.png"); // 10-14 的檔
    const f = rowsToJmaImageryFrames(rows, CDN).get("sst_him")!;
    expect(pickJmaImageryFrame(f, ms("2026-10-13T23:59:00+09:00"), sst, false, FAR)).toMatchObject({ kind: "uncovered", reason: "no_frame" });
    expect(pickJmaImageryFrame(f, ms("2026-10-14T00:00:00+09:00"), sst, false, FAR).kind).toBe("frame");
    // D 的檔約 D+1 10:30 JST 才出（實測 10-15 檔於 10-16 10:31 JST 發布）→ 停在「今天」時最新一幀常是前一日、甚至前兩日的檔
    expect(pickJmaImageryFrame(f, ms("2026-10-15T15:41:00+09:00"), sst, false, FAR).kind).toBe("frame"); // 回放 39.7h（舊門檻 36h 會判 stale）
    expect(pickJmaImageryFrame(f, ms("2026-10-16T23:59:00+09:00"), sst, false, FAR).kind).toBe("frame"); // 72h 內
    expect(pickJmaImageryFrame(f, ms("2026-10-17T00:01:00+09:00"), sst, false, FAR)).toMatchObject({ kind: "uncovered", reason: "stale" });
    expect(pickJmaImageryFrame(f, ms("2026-10-16T10:00:00+09:00"), sst, true).kind).toBe("frame"); // 即時：D+2 早上新檔未出
    expect(pickJmaImageryFrame(f, ms("2026-10-17T00:01:00+09:00"), sst, true)).toMatchObject({ kind: "uncovered", reason: "stale" });
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

describe("JMA imagery 色票：各產品對 decode table", () => {
  // data-collectors origin/main config/decode_tables/jma/{radar,rasrf}.yaml（PLTE；idx6 以 PLTE (250,245,0) 為準）
  const RAIN: [number, number, number][] = [
    [242, 242, 255], [160, 210, 255], [33, 140, 255], [0, 65, 255], [250, 245, 0], [255, 153, 0], [255, 40, 0], [180, 0, 104],
  ];
  // risk_land.yaml／risk_inund.yaml level 2–5（level 1 白色 = 上游透明，不上色）
  const RISK: [number, [number, number, number]][] = [[2, [242, 231, 0]], [3, [255, 40, 0]], [4, [170, 0, 170]], [5, [12, 0, 12]]];
  // uv_anal.yaml level 1–14（level = UVI + 1）
  const UV: [number, number, number][] = [
    [255, 255, 255], [217, 217, 255], [153, 203, 255], [255, 255, 190], [250, 250, 150], [250, 245, 0], [255, 200, 0],
    [255, 140, 0], [250, 90, 0], [255, 20, 0], [165, 0, 33], [181, 0, 91], [204, 0, 160], [204, 0, 204],
  ];

  it("radar／rasrf 8 級＝PLTE；版本號對 yaml", () => {
    for (const id of ["radar", "rasrf"] as const) {
      const p = JMA_IMAGERY_PRODUCTS[id];
      expect(p.levels.map((l) => [l.level, [...l.rgb]])).toEqual(RAIN.map((rgb, i) => [i + 1, rgb]));
      expect(p.paletteVersion).toBe(`jma-${id}-2026-10-09`);
    }
    expect(JMA_IMAGERY_PRODUCTS.radar.levels[7]!.label).toBe("≥80 mm/h");
    expect(JMA_IMAGERY_PRODUCTS.rasrf.levels[7]!.label).toBe("≥80 mm");
  });

  it("キキクル 2–5 級；level 1 畫透明", () => {
    for (const id of ["risk_land", "risk_inund"] as const) {
      const p = JMA_IMAGERY_PRODUCTS[id];
      expect(p.levels.map((l) => [l.level, [...l.rgb]])).toEqual(RISK);
      expect(p.paletteVersion).toBe(`jma-${id}-2026-10-09-provisional`);
      expect(evalStep(jmaImageryRasterColor(p), 1)).toBe("rgba(0, 0, 0, 0)");
    }
  });

  it("uv_anal 14 級：level = UVI + 1", () => {
    const p = JMA_IMAGERY_PRODUCTS.uv_anal;
    expect(p.levels.map((l) => [l.level, [...l.rgb]])).toEqual(UV.map((rgb, i) => [i + 1, rgb]));
    expect(p.levels[0]!.label).toBe("UVI 0");
    expect(p.levels[13]!.label).toBe("UVI ≥13");
    expect(p.paletteVersion).toBe("jma-uv_anal-2026-10-12");
  });

  it("sea_ice 密接度 2–5（0 開水面透明、1 不存在 → 透明）", () => {
    const p = JMA_IMAGERY_PRODUCTS.sea_ice;
    expect(p.levels.map((l) => l.level)).toEqual([2, 3, 4, 5]);
    const expr = jmaImageryRasterColor(p);
    expect(evalStep(expr, 0)).toBe("rgba(0, 0, 0, 0)");
    expect(evalStep(expr, 1)).toBe("rgba(0, 0, 0, 0)");
    expect(evalStep(expr, 6)).toBe("rgba(0, 0, 0, 0)");
    expect(evalStep(expr, 254)).toBe("rgba(0, 0, 0, 0)");
    expect(evalStep(expr, 255)).toBe(JMA_IMAGERY_UNCOVERED_COLOR);
  });

  it("模擬 mapbox 3.x 色帶取樣：每個離散產品 L=0..255 都落在正確的級", () => {
    const RES = MAPBOX_COLOR_RAMP_RES;
    const CMF = (RES ** 2 - 1) / (255 * RES * (RES + 3));
    const [min, max] = JMA_IMAGERY_RASTER_COLOR_RANGE;
    const mix = JMA_IMAGERY_RASTER_COLOR_MIX[0];
    for (const p of Object.values(JMA_IMAGERY_PRODUCTS)) {
      if (p.encoding !== "level_la_v1") continue;
      const expr = jmaImageryRasterColor(p);
      const registered = new Map(p.levels.map((l) => [l.level, `rgb(${l.rgb.join(", ")})`]));
      for (let L = 0; L <= 255; L++) {
        const coord = 0.5 / RES + (L / 255) * mix * CMF * 255 * (RES - 1) / (RES * (max - min));
        const sampled = min + Math.min(RES - 1, Math.floor(coord * RES)) * (max - min) / (RES - 1);
        const want = L === 255 ? JMA_IMAGERY_UNCOVERED_COLOR : registered.get(L) ?? "rgba(0, 0, 0, 0)";
        expect(evalStep(expr, sampled), `${p.product} L=${L}`).toBe(want);
      }
    }
  });

  it("sst_him：°C ↔ L（L = (℃+3)×7）；stop 嚴格遞增；L=0 海冰色、255 未涵蓋", () => {
    const p = JMA_IMAGERY_PRODUCTS.sst_him;
    expect(p.encoding).toBe("sst_la_v1");
    expect(jmaImageryValueToLevel(p.scalar, 28.6)).toBeCloseTo(221.2, 5);
    expect(jmaImageryValueToLevel(p.scalar, -10)).toBe(1); // clamp
    expect(jmaImageryValueToLevel(p.scalar, 40)).toBe(254);
    const expr = jmaImageryRasterColor(p);
    expect(evalStep(expr, 0)).toBe(p.scalar.zeroColor);
    expect(evalStep(expr, 255)).toBe(JMA_IMAGERY_UNCOVERED_COLOR);
    const ramp = evalStep(expr, 100) as unknown[];
    expect(ramp.slice(0, 2)).toEqual(["interpolate", ["linear"]]);
    const inputs = ramp.slice(3).filter((_, i) => i % 2 === 0) as number[];
    inputs.forEach((v, i) => { if (i > 0) expect(v).toBeGreaterThan(inputs[i - 1]!); });
    expect(inputs[0]).toBeCloseTo(10.5); // −1.5 ℃
    expect(inputs[inputs.length - 1]).toBeCloseTo(234.5); // 30.5 ℃
    // 色帶取自氣象廳日別海面水温圖：27.5 ℃ 紅、5.5 ℃ 青
    expect(p.scalar.stops.find((s) => s.value === 27.5)?.color).toBe("#ff2031");
    expect(p.scalar.stops.find((s) => s.value === 5.5)?.color).toBe("#00c5bd");
  });
});

describe("JMA imagery：ひまわり B13（gray_jpeg_v1）", () => {
  const HW = JMA_IMAGERY_PRODUCTS.himawari_b13;

  it("encoding 依 manifest 分派：.jpg key＋gray_jpeg_v1 → 可選幀；其他 encoding → 未涵蓋", () => {
    const rows = [row("2026-10-15T03:00:00Z", {
      product: "himawari_b13", encoding: "gray_jpeg_v1", image_key: "imagery/jma/himawari_b13/20261015/030000.jpg",
      image_width: 1024, image_height: 768,
    })];
    const f = rowsToJmaImageryFrames(rows, CDN).get("himawari_b13")!;
    const p = pickJmaImageryFrame(f, ms("2026-10-15T04:20:00Z"), HW, false, FAR);
    expect(p.kind).toBe("frame");
    if (p.kind === "frame") expect(p.frame.url).toBe(`${CDN}/imagery/jma/himawari_b13/20261015/030000.jpg`);
    expect(pickJmaImageryFrame(f, ms("2026-10-15T04:31:00Z"), HW, false, FAR)).toMatchObject({ kind: "uncovered", reason: "stale" });
    const wrong = rowsToJmaImageryFrames([{ ...rows[0]!, encoding: "level_la_v1" }], CDN).get("himawari_b13")!;
    expect(pickJmaImageryFrame(wrong, ms("2026-10-15T03:10:00Z"), HW, false, FAR)).toMatchObject({ kind: "uncovered", reason: "encoding" });
  });

  it("raster-color 是灰階 interpolate：暖（暗）透明、冷（亮）白且不透明；沒有 255 缺測灰", () => {
    const expr = jmaImageryRasterColor(HW);
    expect(expr.slice(0, 3)).toEqual(["interpolate", ["linear"], ["raster-value"]]);
    const inputs = expr.slice(3).filter((_, i) => i % 2 === 0) as number[];
    inputs.forEach((v, i) => { if (i > 0) expect(v).toBeGreaterThan(inputs[i - 1]!); });
    expect(expr[4]).toMatch(/, 0\)$/); // 第一個 stop alpha 0（晴空海面約 30–55 低於門檻 → 透明）
    expect(inputs[0]).toBeGreaterThanOrEqual(55);
    expect(expr[expr.length - 2]).toBe(255);
    expect(expr).not.toContain(JMA_IMAGERY_UNCOVERED_COLOR);
  });
});

describe("JMA imagery：分析圖（count_la_v1，契約 §8）", () => {
  const ANA = ["ana_snow_first", "ana_snow_days", "ana_rain_days", "ana_risk_land_hours", "ana_risk_inund_hours"] as const;

  it("五個產品都是 count_la_v1、每日一幀", () => {
    for (const id of ANA) {
      const p: JmaImageryProduct = JMA_IMAGERY_PRODUCTS[id];
      expect(p.encoding).toBe("count_la_v1");
      expect(p.cadenceMin).toBe(1440);
      expect(p.count).toBeDefined();
    }
  });

  it("分級：0 透明、1 起第一級、254 最後一級、255 未涵蓋灰", () => {
    for (const id of ["ana_snow_days", "ana_rain_days", "ana_risk_land_hours", "ana_risk_inund_hours"] as const) {
      const p: JmaImageryProduct = JMA_IMAGERY_PRODUCTS[id];
      const classes = p.count!.classes!;
      const expr = jmaImageryRasterColor(p);
      expect(evalStep(expr, 0)).toBe("rgba(0, 0, 0, 0)");
      expect(evalStep(expr, 0.13)).toBe("rgba(0, 0, 0, 0)"); // raster-value 誤差 ≤0.13
      expect(evalStep(expr, 1)).toBe(`rgb(${classes[0]!.rgb.join(", ")})`);
      expect(evalStep(expr, 254)).toBe(`rgb(${classes[classes.length - 1]!.rgb.join(", ")})`);
      expect(evalStep(expr, 255)).toBe(JMA_IMAGERY_UNCOVERED_COLOR);
      expect(evalStep(expr, 254.87)).toBe(JMA_IMAGERY_UNCOVERED_COLOR);
      // 每個分級下限的整數值落在該級
      classes.forEach((c) => expect(evalStep(expr, c.min)).toBe(`rgb(${c.rgb.join(", ")})`));
    }
  });

  it("時數分級 1、3、6、12、24、48+；雨日數涵蓋 1–31", () => {
    expect(JMA_IMAGERY_PRODUCTS.ana_risk_land_hours.count.classes.map((c) => c.min)).toEqual([1, 3, 6, 12, 24, 48]);
    expect(JMA_IMAGERY_PRODUCTS.ana_risk_inund_hours.count.classes.map((c) => c.label)).toEqual(["1–2", "3–5", "6–11", "12–23", "24–47", "≥48"]);
    const rain = JMA_IMAGERY_PRODUCTS.ana_rain_days.count.classes;
    expect(rain[0]!.min).toBe(1);
    expect(rain[rain.length - 1]!.label.startsWith("≥")).toBe(true);
  });

  it("初雪日：0 透明、日序連續色帶（10/1＝1 起，月初刻度）、255 未涵蓋", () => {
    const p: JmaImageryProduct = JMA_IMAGERY_PRODUCTS.ana_snow_first;
    const ramp = p.count!.ramp!;
    expect(ramp.map((s) => s.label)).toEqual(["10/1", "11/1", "12/1", "1/1", "2/1", "3/1", "4/1", "5/1"]);
    expect(ramp.map((s) => s.value)).toEqual([1, 32, 62, 93, 124, 152, 183, 213]);
    const expr = jmaImageryRasterColor(p);
    expect(evalStep(expr, 0)).toBe("rgba(0, 0, 0, 0)");
    expect((evalStep(expr, 15) as unknown[])[0]).toBe("interpolate");
    expect(evalStep(expr, 255)).toBe(JMA_IMAGERY_UNCOVERED_COLOR);
  });

  it("選幀：當日 00:00 JST 一幀；partial 照畫；超過 36 小時 → 未涵蓋；encoding 不符 → 未涵蓋", () => {
    const p = JMA_IMAGERY_PRODUCTS.ana_rain_days;
    const rows = [
      row("2026-10-13T15:00:00Z", { product: "ana_rain_days", encoding: "count_la_v1", status: "partial", image_key: "imagery/jma/ana_rain_days/20261013/150000.png" }),
      row("2026-10-14T15:00:00Z", { product: "ana_rain_days", encoding: "count_la_v1", status: "partial", image_key: "imagery/jma/ana_rain_days/20261014/150000.png" }),
    ];
    const f = rowsToJmaImageryFrames(rows, CDN).get("ana_rain_days")!;
    // 10-15 12:00 JST → 10-15 那一張
    const noon = pickJmaImageryFrame(f, ms("2026-10-15T03:00:00Z"), p, false, FAR);
    expect(noon.kind).toBe("frame");
    if (noon.kind === "frame") {
      expect(noon.frame.url).toBe(`${CDN}/imagery/jma/ana_rain_days/20261014/150000.png`);
      expect(noon.frame.status).toBe("partial");
    }
    // 10-14 23:59 JST → 10-14 那一張
    const prev = pickJmaImageryFrame(f, ms("2026-10-14T14:59:00Z"), p, false, FAR);
    if (prev.kind === "frame") expect(prev.frame.validTimeIso).toBe("2026-10-13T15:00:00Z");
    else throw new Error("expected frame");
    expect(pickJmaImageryFrame(f, ms("2026-10-16T03:01:00Z"), p, false, FAR)).toMatchObject({ kind: "uncovered", reason: "stale" });
    const wrong = rowsToJmaImageryFrames([{ ...rows[1]!, encoding: "level_la_v1" }], CDN).get("ana_rain_days")!;
    expect(pickJmaImageryFrame(wrong, ms("2026-10-15T03:00:00Z"), p, false, FAR)).toMatchObject({ kind: "uncovered", reason: "encoding" });
  });
});

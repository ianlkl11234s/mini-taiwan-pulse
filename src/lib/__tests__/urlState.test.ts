/**
 * urlState 守門測試（EM 系列）
 *
 * 重點不是 happy path，而是**壞輸入不能白屏**：嵌入碼散落在別人的文章裡，
 * 圖層改名/下架/上鎖之後，舊網址必須安靜降級而不是炸掉整個 iframe。
 */
import { describe, it, expect } from "vitest";
import { parseUrlState, buildUrl, URL_STATE_VERSION } from "../urlState";
import { LAYER_COLORS, GATED_LAYERS } from "../../components/sidebar/layerCatalog";
import type { LayerVisibility } from "../../types";

const V = `v=${URL_STATE_VERSION}`;

describe("parseUrlState — 版本閘門", () => {
  it("缺版本號回空物件", () => {
    expect(parseUrlState("?lng=120&lat=23&z=10")).toEqual({});
  });

  it("版本不符回空物件（未來改 schema 時舊網址不被誤讀）", () => {
    expect(parseUrlState("?v=999&lng=120&lat=23&z=10")).toEqual({});
  });

  it("空字串不 throw", () => {
    expect(parseUrlState("")).toEqual({});
  });

  it("接受有無前導 ? 兩種寫法", () => {
    const a = parseUrlState(`?${V}&lng=120&lat=23&z=10`);
    const b = parseUrlState(`${V}&lng=120&lat=23&z=10`);
    expect(a).toEqual(b);
    expect(a.camera?.center).toEqual([120, 23]);
  });
});

describe("parseUrlState — 相機", () => {
  it("解析完整相機", () => {
    const s = parseUrlState(`?${V}&lng=120.13&lat=23.09&z=11.2&pitch=45&bearing=-20`);
    expect(s.camera).toEqual({ center: [120.13, 23.09], zoom: 11.2, pitch: 45, bearing: -20 });
  });

  it("pitch / bearing 可省略，預設 0", () => {
    const s = parseUrlState(`?${V}&lng=120&lat=23&z=10`);
    expect(s.camera).toEqual({ center: [120, 23], zoom: 10, pitch: 0, bearing: 0 });
  });

  it.each([
    ["經度越界", "lng=999&lat=23&z=10"],
    ["緯度越界", "lng=120&lat=99&z=10"],
    ["zoom 越界", "lng=120&lat=23&z=50"],
    ["zoom 負數", "lng=120&lat=23&z=-1"],
    ["非數字", "lng=abc&lat=23&z=10"],
    ["缺 zoom", "lng=120&lat=23"],
    ["缺經度", "lat=23&z=10"],
  ])("%s → 整組相機 drop（半套相機比沒有更糟）", (_label, qs) => {
    expect(parseUrlState(`?${V}&${qs}`).camera).toBeUndefined();
  });

  it("pitch 越界只 drop pitch，相機其餘保留", () => {
    const s = parseUrlState(`?${V}&lng=120&lat=23&z=10&pitch=200`);
    expect(s.camera?.pitch).toBe(0);
    expect(s.camera?.center).toEqual([120, 23]);
  });

  it("bearing 正規化到 -180~180", () => {
    expect(parseUrlState(`?${V}&lng=120&lat=23&z=10&bearing=370`).camera?.bearing).toBe(10);
    expect(parseUrlState(`?${V}&lng=120&lat=23&z=10&bearing=-370`).camera?.bearing).toBe(-10);
    expect(parseUrlState(`?${V}&lng=120&lat=23&z=10&bearing=360`).camera?.bearing).toBe(0);
  });
});

describe("parseUrlState — 圖層安全過濾", () => {
  it("保留合法圖層", () => {
    const s = parseUrlState(`?${V}&layers=aquaculturePonds,aquacultureZone`);
    expect(s.layers).toEqual(["aquaculturePonds", "aquacultureZone"]);
  });

  it("未知 key 靜默 drop、不影響其他層", () => {
    const s = parseUrlState(`?${V}&layers=aquaculturePonds,notARealLayerKey`);
    expect(s.layers).toEqual(["aquaculturePonds"]);
  });

  it("🔒 gated 圖層一律 drop（owner-only 資料不得經由網址洩漏）", () => {
    const gated = [...GATED_LAYERS][0]!;
    const s = parseUrlState(`?${V}&layers=${gated},aquaculturePonds`);
    expect(s.layers).toEqual(["aquaculturePonds"]);
  });

  it("🔒 全部 32 個 gated key 逐一驗證都被擋", () => {
    for (const key of GATED_LAYERS) {
      const s = parseUrlState(`?${V}&layers=${key}`);
      expect(s.layers, `${key} 不該通過`).toBeUndefined();
    }
  });

  it("allowedLayers 白名單再收一層（/embed 用）", () => {
    const s = parseUrlState(`?${V}&layers=aquaculturePonds,aquacultureZone`, {
      allowedLayers: new Set(["aquaculturePonds"]),
    });
    expect(s.layers).toEqual(["aquaculturePonds"]);
  });

  it("重複 key 去重", () => {
    const s = parseUrlState(`?${V}&layers=aquaculturePonds,aquaculturePonds`);
    expect(s.layers).toEqual(["aquaculturePonds"]);
  });

  it("全部被濾掉時回 undefined 而非空陣列", () => {
    expect(parseUrlState(`?${V}&layers=nope,alsoNope`).layers).toBeUndefined();
  });

  it("測試用的 key 確實存在於 catalog（避免測試自身腐爛）", () => {
    expect(Object.keys(LAYER_COLORS)).toContain("aquaculturePonds");
    expect(Object.keys(LAYER_COLORS)).toContain("aquacultureZone");
  });
});

describe("parseUrlState — overlayParams", () => {
  it("解析 p.* 為數字", () => {
    const s = parseUrlState(`?${V}&p.aquaculturePondsOpacity=0.85&p.someIdx=2`);
    expect(s.params).toEqual({ aquaculturePondsOpacity: 0.85, someIdx: 2 });
  });

  it("非數字的 p.* 被 drop（overlayParams 契約只收數字）", () => {
    const s = parseUrlState(`?${V}&p.good=1&p.bad=abc`);
    expect(s.params).toEqual({ good: 1 });
  });

  it("沒有 p.* 時回 undefined", () => {
    expect(parseUrlState(`?${V}&lng=120&lat=23&z=10`).params).toBeUndefined();
  });

  it("空 key（單一個 'p.'）不收", () => {
    expect(parseUrlState(`?${V}&p.=5`).params).toBeUndefined();
  });
});

describe("parseUrlState — 其他欄位", () => {
  it("date 僅接受 YYYY-MM-DD", () => {
    expect(parseUrlState(`?${V}&date=2026-07-15`).date).toBe("2026-07-15");
    expect(parseUrlState(`?${V}&date=2026/07/15`).date).toBeUndefined();
    expect(parseUrlState(`?${V}&date=notadate`).date).toBeUndefined();
    expect(parseUrlState(`?${V}&date=2026-13-45`).date).toBeUndefined();
  });

  it("theme 僅接受 dark / light", () => {
    expect(parseUrlState(`?${V}&theme=light`).theme).toBe("light");
    expect(parseUrlState(`?${V}&theme=neon`).theme).toBeUndefined();
  });

  it("ui 解析為陣列", () => {
    expect(parseUrlState(`?${V}&ui=legend,attribution`).ui).toEqual(["legend", "attribution"]);
  });
});

describe("buildUrl", () => {
  it("空 state 產出乾淨的版本化網址", () => {
    expect(buildUrl({}, "https://example.com/embed")).toBe(`https://example.com/embed?${V}`);
  });

  it("base 已有 query 時用 & 串接", () => {
    expect(buildUrl({}, "https://example.com/e?x=1")).toBe(`https://example.com/e?x=1&${V}`);
  });

  it("pitch / bearing 為 0 時不寫入（保持網址精簡）", () => {
    const url = buildUrl(
      { camera: { center: [120.13, 23.09], zoom: 11.2, pitch: 0, bearing: 0 } },
      "https://e.com",
    );
    expect(url).not.toContain("pitch");
    expect(url).not.toContain("bearing");
  });

  it("round-trip：parse(build(x)) === x", () => {
    const original = {
      camera: { center: [120.13, 23.09] as [number, number], zoom: 11.2, pitch: 45, bearing: -20 },
      layers: ["aquaculturePonds", "aquacultureZone"] as (keyof LayerVisibility)[],
      params: { aquaculturePondsOpacity: 0.85 },
      date: "2026-07-15",
      theme: "dark" as const,
      ui: ["legend"],
    };
    const url = buildUrl(original, "https://example.com/embed");
    const parsed = parseUrlState(new URL(url).search);
    expect(parsed).toEqual(original);
  });

  it("round-trip 座標精度：4 位小數（~11m）足夠且不放大浮點雜訊", () => {
    const url = buildUrl(
      { camera: { center: [120.123456789, 23.987654321], zoom: 11.23456, pitch: 0, bearing: 0 } },
      "https://e.com",
    );
    const c = parseUrlState(new URL(url).search).camera!;
    expect(c.center).toEqual([120.1235, 23.9877]);
    expect(c.zoom).toBe(11.23);
  });
});

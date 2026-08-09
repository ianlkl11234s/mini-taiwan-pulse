/**
 * urlState 守門測試（EM 系列）
 *
 * 重點不是 happy path，而是**壞輸入不能白屏**：嵌入碼散落在別人的文章裡，
 * 圖層改名/下架/上鎖之後，舊網址必須安靜降級而不是炸掉整個 iframe。
 */
import { describe, it, expect } from "vitest";
import { parseUrlState, buildUrl, URL_STATE_VERSION } from "../urlState";
import { RAIL_CODES, resolveRailCodes } from "../../constants/railLines";
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

  it("🔒 每一個 gated key 逐一驗證都被擋（數量隨 GATED_LAYERS 自動增減）", () => {
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

describe("parseUrlState — style / hour（分享主站畫面用）", () => {
  it("style 接受合法 id", () => {
    expect(parseUrlState(`?${V}&style=satellite`).style).toBe("satellite");
    expect(parseUrlState(`?${V}&style=satellite-streets`).style).toBe("satellite-streets");
    expect(parseUrlState(`?${V}&style=nav-night`).style).toBe("nav-night");
  });

  it("style 格式不合被 drop（消費端 getStyleUrl 另有 fallback）", () => {
    expect(parseUrlState(`?${V}&style=../../etc/passwd`).style).toBeUndefined();
    expect(parseUrlState(`?${V}&style=<script>`).style).toBeUndefined();
    expect(parseUrlState(`?${V}&style=` + "x".repeat(40)).style).toBeUndefined();
  });

  it("h 只收 0–23 整數", () => {
    expect(parseUrlState(`?${V}&h=14`).hour).toBe(14);
    expect(parseUrlState(`?${V}&h=0`).hour).toBe(0);
    expect(parseUrlState(`?${V}&h=23`).hour).toBe(23);
    expect(parseUrlState(`?${V}&h=24`).hour).toBeUndefined();
    expect(parseUrlState(`?${V}&h=-1`).hour).toBeUndefined();
    expect(parseUrlState(`?${V}&h=abc`).hour).toBeUndefined();
  });

  it("h 小數無條件捨去（12.9 → 12）", () => {
    expect(parseUrlState(`?${V}&h=12.9`).hour).toBe(12);
  });
});

describe("parseUrlState — rsys（鐵路營運者／線路過濾）", () => {
  it("單一營運者", () => {
    expect(parseUrlState(`?${V}&rsys=trtc`).railSystems).toEqual(["trtc"]);
  });

  it("多代碼以逗號分隔，保留書寫順序", () => {
    expect(parseUrlState(`?${V}&rsys=trtc,tmrt`).railSystems).toEqual(["trtc", "tmrt"]);
    expect(parseUrlState(`?${V}&rsys=tmrt,trtc`).railSystems).toEqual(["tmrt", "trtc"]);
  });

  it("代碼表裡每個代碼都收得下（營運者級 + 線路級）", () => {
    for (const id of RAIL_CODES) {
      expect(parseUrlState(`?${V}&rsys=${id}`).railSystems).toEqual([id]);
    }
  });

  it("線路級代碼（帶營運者前綴）", () => {
    expect(parseUrlState(`?${V}&rsys=trtc-bl`).railSystems).toEqual(["trtc-bl"]);
    expect(parseUrlState(`?${V}&rsys=trtc-bl,tymc`).railSystems).toEqual(["trtc-bl", "tymc"]);
  });

  it("空白與重複值不影響結果", () => {
    expect(parseUrlState(`?${V}&rsys= trtc , trtc ,tmrt`).railSystems).toEqual(["trtc", "tmrt"]);
  });

  it("未知代碼只 drop 該項，合法的留著（不是整包作廢）", () => {
    expect(parseUrlState(`?${V}&rsys=trtc,nonsense`).railSystems).toEqual(["trtc"]);
    // 未知**線路**同理（trtc-zz 不存在，但 trtc-bl 要活下來）
    expect(parseUrlState(`?${V}&rsys=trtc-zz,trtc-bl`).railSystems).toEqual(["trtc-bl"]);
  });

  it.each([
    ["全部未知", "rsys=nonsense"],
    ["多個未知", "rsys=foo,bar"],
    ["未知線路", "rsys=trtc-zz"],
    ["裸線路碼（沒帶營運者前綴，會撞名故不收）", "rsys=bl"],
    ["貓空纜車（刻意不給代碼）", "rsys=trtc-mk"],
    ["大寫（網址契約一律小寫）", "rsys=TRTC"],
    ["線路碼大寫", "rsys=trtc-BL"],
    ["只有分隔符", "rsys=,,,"],
    ["空值", "rsys="],
  ])("%s → undefined（＝未指定＝顯示全部，不是空白畫面）", (_label, qs) => {
    expect(parseUrlState(`?${V}&${qs}`).railSystems).toBeUndefined();
  });

  it("不帶 rsys 時欄位不存在", () => {
    expect(parseUrlState(`?${V}&layers=rail&date=2026-08-06`).railSystems).toBeUndefined();
  });

  it("向後相容：加了 rsys 之後，舊網址的解析結果不變", () => {
    const legacy = `?${V}&layers=rail&date=2026-08-06&h=8&lng=120.9&lat=23.7&z=7`;
    expect(parseUrlState(legacy)).toEqual({
      camera: { center: [120.9, 23.7], zoom: 7, pitch: 0, bearing: 0 },
      layers: ["rail"],
      date: "2026-08-06",
      hour: 8,
    });
  });

  it("向後相容：升級成營運者／線路代碼後，`rsys=trtc` 的**解析結果**仍是 ['trtc']", () => {
    // 語意（涵蓋範圍）縮小了，但 parse 層沒變 —— 所以不升 URL_STATE_VERSION，
    // 舊嵌入碼不會整組作廢。範圍差異由 resolveRailCodes 表達，見下方 describe。
    expect(parseUrlState(`?${V}&rsys=trtc`)).toEqual({ railSystems: ["trtc"] });
    expect(URL_STATE_VERSION).toBe(1);
  });
});

/** 代碼的**語意**（parse 只管合不合法，收斂成「哪個系統收哪些線」是這裡） */
describe("resolveRailCodes — rsys 代碼語意", () => {
  const lines = (codes: string[], system: string) => {
    const sel = resolveRailCodes(codes)?.get(system as never);
    return sel ? { all: sel.all, lines: [...sel.lineIds].sort() } : null;
  };

  it("未指定 / 空陣列 → null（＝全部，消費端不得當空集合）", () => {
    expect(resolveRailCodes(undefined)).toBeNull();
    expect(resolveRailCodes([])).toBeNull();
  });

  it("撞名：krtc-r（高雄紅線）與 trtc-r（淡水信義線）是不同東西", () => {
    const kr = resolveRailCodes(["krtc-r"])!;
    const tr = resolveRailCodes(["trtc-r"])!;
    expect([...kr.keys()]).toEqual(["krtc"]);
    expect([...tr.keys()]).toEqual(["trtc"]);
    // 兩者的 line_id 都叫 "R"，靠系統前綴才分得開 —— 前綴不是裝飾
    expect(kr.get("krtc")!.lineIds.has("R")).toBe(true);
    expect(tr.get("trtc")!.lineIds.has("R")).toBe(true);
    expect(kr.has("trtc")).toBe(false);
    expect(tr.has("krtc")).toBe(false);
  });

  it("trtc 只剩北捷本體五線（breaking change：不再含機捷與新北四線）", () => {
    expect(lines(["trtc"], "trtc")).toEqual({ all: false, lines: ["BL", "BR", "G", "O", "R"] });
  });

  it("tymc = 機場捷運 A、ntm = 新北四線（都住在 trtc 系統裡）", () => {
    expect(lines(["tymc"], "trtc")).toEqual({ all: false, lines: ["A"] });
    expect(lines(["ntm"], "trtc")).toEqual({ all: false, lines: ["K", "LB", "V", "Y"] });
  });

  it("trtc,tymc,ntm 的聯集 ＝ 舊版 rsys=trtc 的涵蓋範圍（貓空纜車除外）", () => {
    expect(lines(["trtc", "tymc", "ntm"], "trtc")).toEqual({
      all: false,
      lines: ["A", "BL", "BR", "G", "K", "LB", "O", "R", "V", "Y"],
    });
  });

  it("營運者與其線路混用取聯集（trtc,trtc-bl ＝ trtc）", () => {
    expect(lines(["trtc", "trtc-bl"], "trtc")).toEqual(lines(["trtc"], "trtc"));
    expect(lines(["trtc-bl", "tymc"], "trtc")).toEqual({ all: false, lines: ["A", "BL"] });
  });

  it("系統即最細粒度者（tra / thsr / klrt / krtc / tmrt）是 all，不做線路過濾", () => {
    for (const id of ["tra", "thsr", "klrt", "krtc", "tmrt"]) {
      expect(lines([id], id)).toEqual({ all: true, lines: [] });
    }
    // 系統級與其線路混用時，系統級勝出（all 不會被線路收斂回去）
    expect(lines(["krtc-r", "krtc"], "krtc")!.all).toBe(true);
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
      hour: 14,
      style: "satellite",
      theme: "dark" as const,
      ui: ["legend"],
      railSystems: ["trtc", "tmrt"],
    };
    const url = buildUrl(original, "https://example.com/embed");
    const parsed = parseUrlState(new URL(url).search);
    expect(parsed).toEqual(original);
  });

  it("railSystems 對稱輸出成 rsys=（空陣列不寫入）", () => {
    expect(buildUrl({ railSystems: ["trtc"] }, "https://e.com")).toContain("rsys=trtc");
    expect(buildUrl({ railSystems: [] }, "https://e.com")).not.toContain("rsys");
  });

  it("線路級代碼 round-trip（連字號不被編碼成 %2D）", () => {
    const url = buildUrl({ railSystems: ["trtc-bl", "krtc-r"] }, "https://e.com");
    expect(url).toContain("rsys=trtc-bl%2Ckrtc-r");
    expect(parseUrlState(new URL(url).search).railSystems).toEqual(["trtc-bl", "krtc-r"]);
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

describe("網址長度（十幾個圖層會不會太長）", () => {
  it("20 個最長 layer key 仍遠低於 2000 字元的實務安全線", () => {
    const longest = Object.keys(LAYER_COLORS)
      .sort((a, b) => b.length - a.length)
      .slice(0, 20) as (keyof LayerVisibility)[];
    const url = buildUrl(
      {
        camera: { center: [120.13, 23.09], zoom: 11.2, pitch: 0, bearing: 0 },
        layers: longest,
        date: "2026-07-30",
        hour: 14,
        style: "satellite",
      },
      "https://mini-taiwan-pulse.itsmigu.com/",
    );
    expect(url.length).toBeLessThan(1000);
  });
});

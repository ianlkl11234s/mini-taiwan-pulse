import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { GATED_LAYERS, RELEASE_HOLD_LAYERS, THEMES } from "../../components/sidebar/layerCatalog";
import { parseUrlState, URL_STATE_VERSION } from "../../lib/urlState";
import { LAYER_MANIFEST } from "../layerManifest";
import { HISTORICAL_MAP_GROUPS, historicalMapEraOptionZh, historicalMapTileUrl } from "../historicalMapSinica";

// 古地圖（中研院臺灣百年歷史地圖）：2026-11-05 站主限定上線，2026-11-06 使用者決定改為公開。
// 圖磚本來就是公開外部來源，沒有私人 Range API；公開＝拿掉 manifest OWNER_ONLY（GATED_LAYERS 由它派生）。
const KEY = "historicalMapSinica" as const;
const GROUP_KEYS = HISTORICAL_MAP_GROUPS.map((g) => g.key);
const THEME = "歷史底圖 Historical Basemaps";

describe("古地圖：公開", () => {
  it("不在 GATED_LAYERS／RELEASE_HOLD_LAYERS，manifest 沒有 OWNER_ONLY", () => {
    expect(GATED_LAYERS.has(KEY)).toBe(false);
    expect(RELEASE_HOLD_LAYERS.has(KEY)).toBe(false);
    expect(LAYER_MANIFEST[KEY].topics).not.toContain("OWNER_ONLY");
  });

  it("分享網址可還原", () => {
    expect(parseUrlState(`?v=${URL_STATE_VERSION}&layers=${KEY}`).layers).toEqual([KEY]);
  });

  it("歷史底圖主題對所有人顯示：六個歷史地圖層（公開）＋1944 水域（站主限定，非站主上鎖）", () => {
    const theme = THEMES.find((t) => t.title === THEME)!;
    expect(theme.groups.flatMap((g) => g.layers.map((l) => l.key))).toEqual([
      "historicalMapSinica", "historicalMapPostwar", "historicalImagery",
      "historicalBoundaries", "historicalLandUse", "historicalThematic", "water1944Taipei",
    ]);
  });

  it("六層都公開、有 manifest，且分享網址可還原", () => {
    for (const key of GROUP_KEYS) {
      expect(GATED_LAYERS.has(key)).toBe(false);
      expect(RELEASE_HOLD_LAYERS.has(key)).toBe(false);
      expect(LAYER_MANIFEST[key].topics).not.toContain("OWNER_ONLY");
      expect(parseUrlState(`?v=${URL_STATE_VERSION}&layers=${key}`).layers).toEqual([key]);
    }
  });
});

// 年代清單對照 WMTS Capabilities 快照（__fixtures__/historicalWmtsLayers.csv：id,title,lower,upper,format）
const DEFAULT_LOWER = "117.84953432 21.65607265";
const DEFAULT_UPPER = "123.85924109 25.64233621";
function parseCsv(text: string): string[][] {
  return text.trim().split("\n").slice(1).map((line) => {
    const out: string[] = []; let cur = ""; let quoted = false;
    for (const ch of line) {
      if (ch === '"') quoted = !quoted;
      else if (ch === "," && !quoted) { out.push(cur); cur = ""; }
      else cur += ch;
    }
    out.push(cur);
    return out;
  });
}
const CAPS = new Map(parseCsv(readFileSync(new URL("./__fixtures__/historicalWmtsLayers.csv", import.meta.url), "utf8")).map((r) => [r[0]!, r]));

describe("歷史地圖六層：年代清單", () => {
  const allEras = HISTORICAL_MAP_GROUPS.flatMap((g) => g.eras.map((e) => ({ g, e })));

  it("每份清單的層名、value 唯一（跨圖層也不重複），選項文字在圖層內唯一", () => {
    const layers = allEras.map(({ e }) => e.layer);
    const values = allEras.map(({ e }) => e.value);
    expect(new Set(layers).size).toBe(layers.length);
    expect(new Set(values).size).toBe(values.length);
    for (const g of HISTORICAL_MAP_GROUPS) {
      const labels = g.eras.map(historicalMapEraOptionZh);
      expect(new Set(labels).size).toBe(labels.length);
    }
  });

  it("層名存在於 Capabilities，ext 與 Capabilities format 一致，bounds 與宣告範圍一致", () => {
    for (const { e } of allEras) {
      const cap = CAPS.get(e.layer);
      expect(cap, e.layer).toBeDefined();
      expect(e.ext, e.layer).toBe(cap![4] === "jpeg" ? "jpg" : "png");
      const isDefault = cap![2] === DEFAULT_LOWER && cap![3] === DEFAULT_UPPER;
      if (isDefault) expect(e.bounds, e.layer).toBeUndefined();
      else {
        const [w, s] = cap![2]!.split(" ").map(Number); const [ea, n] = cap![3]!.split(" ").map(Number);
        expect(e.bounds, e.layer).toEqual([w, s, ea, n]);
      }
      expect(historicalMapTileUrl(e)).toContain(`img=${e.layer}-${e.ext}-`);
    }
  });

  it("三語標籤齊全，預設值在清單內，既有 value 保留", () => {
    for (const { e } of allEras) {
      for (const t of [e.label, ...(e.scope ? [e.scope] : [])]) expect([t.zh, t.en, t.ja].every((x) => x.trim().length > 0), e.layer).toBe(true);
    }
    for (const g of HISTORICAL_MAP_GROUPS) expect(g.eras.some((e) => e.value === g.defaultValue), g.key).toBe(true);
    expect(HISTORICAL_MAP_GROUPS[0]!.defaultValue).toBe("jm20k-1904");
    const byValue = new Map(allEras.map(({ g, e }) => [e.value, `${g.key}:${e.layer}`]));
    expect(byValue.get("jm20k-1904")).toBe("historicalMapSinica:JM20K_1904");
    expect(byValue.get("jm20k-1921")).toBe("historicalMapSinica:JM20K_1921");
    expect(byValue.get("am25k-1944a")).toBe("historicalMapSinica:AM25K_1944A");
    expect(byValue.get("amcity-1945")).toBe("historicalMapSinica:AMCityPlan_1945");
    expect(byValue.get("am25k-1944")).toBe("historicalImagery:AM25K_1944B");
    expect(byValue.get("corona-1966")).toBe("historicalImagery:Taiwan_Corona_1966");
  });

  it("只有界線路網是疊加層、預設透明度 1；其餘 0.85", () => {
    for (const g of HISTORICAL_MAP_GROUPS) {
      expect(g.overlay).toBe(g.key === "historicalBoundaries");
      expect(g.defaultOpacity).toBe(g.overlay ? 1 : 0.85);
    }
  });

  it("英文／日文的 select 選項翻譯存在 params.json 且與資料檔三語標籤一致", () => {
    const read = (loc: string) => JSON.parse(readFileSync(new URL(`../../i18n/locales/${loc}/params.json`, import.meta.url), "utf8")) as Record<string, string>;
    const en = read("en"); const ja = read("ja");
    for (const { g, e } of allEras) {
      const k = `param.${g.key}.${historicalMapEraOptionZh(e)}`;
      expect(en[k], k).toBe(e.scope ? `${e.label.en} (${e.scope.en})` : e.label.en);
      expect(ja[k], k).toBe(e.scope ? `${e.label.ja}（${e.scope.ja}）` : e.label.ja);
    }
  });
});

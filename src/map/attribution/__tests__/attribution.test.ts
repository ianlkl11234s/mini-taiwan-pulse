import { describe, expect, it } from "vitest";
import { OVERLAY_REGISTRY } from "../../overlayRegistry";
import { addOverlay, setOverlayVisible, type OverlayMap } from "../../overlayManager";
import {
  collectLayerAttributions,
  isBasemapSourceUrl,
  readMapSourceViews,
  type AttributionMapLike,
} from "../mapAttribution";
import {
  groupAttributions,
  OTHER_LICENSE,
  parseAttributionPart,
  parseAttributions,
  splitAttribution,
} from "../attributionParse";

/* eslint-disable @typescript-eslint/no-explicit-any */
/** 最小 stub：同時滿足 overlayManager 的 OverlayMap 與 collector 的 AttributionMapLike。 */
function stubMap(): OverlayMap & AttributionMapLike {
  const sources = new Map<string, any>();
  const layers: any[] = [];
  const layerById = (id: string) => layers.find((l) => l.id === id);
  return {
    getSource: (id) => sources.get(id),
    addSource: (id, spec) => { sources.set(id, { ...spec }); },
    removeSource: (id) => { sources.delete(id); },
    getLayer: (id) => layerById(id),
    addLayer: (layer) => { layers.push({ ...layer, layout: { ...(layer.layout ?? {}) } }); },
    removeLayer: (id) => { const i = layers.findIndex((l) => l.id === id); if (i >= 0) layers.splice(i, 1); },
    getLayoutProperty: (id, name) => layerById(id)?.layout?.[name],
    setLayoutProperty: (id, name, value) => { const l = layerById(id); if (l) l.layout[name] = value; },
    setPaintProperty: () => {},
    // 模擬 Mapbox：getStyle() 回序列化規格（不含事後補在 instance 上的屬性）
    getStyle: () => ({
      sources: Object.fromEntries([...sources].map(([id, s]) => [id, { type: s.type, url: s.url }])),
      layers: layers.map((l) => ({ id: l.id, source: l.source, layout: l.layout })),
    }),
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

const WITH_ATTRIBUTION = OVERLAY_REGISTRY.filter((c) => typeof c.attribution === "string" && c.attribution.trim());

describe("圖層來源收集（不漏顯名）", () => {
  it("registry 有 attribution 的 overlay 不少於 80 筆（防止測試靜默失效）", () => {
    expect(WITH_ATTRIBUTION.length).toBeGreaterThanOrEqual(80);
  });

  it("每個有 attribution 的 OverlayConfig 開啟時都被收集到，且解析後每個片段都在清單內", () => {
    const missing: string[] = [];
    for (const config of WITH_ATTRIBUTION) {
      const map = stubMap();
      addOverlay(map, config, true, {});
      setOverlayVisible(map, config, true, true, {});
      const collected = collectLayerAttributions(readMapSourceViews(map));
      if (!collected.includes(config.attribution!.trim())) {
        missing.push(`${config.id}: not collected`);
        continue;
      }
      const keys = new Set(parseAttributions(collected).map((e) => e.key));
      for (const part of splitAttribution(config.attribution!)) {
        const entry = parseAttributionPart(part);
        if (!entry || !keys.has(entry.key) || !entry.text) missing.push(`${config.id}: part "${part}"`);
      }
    }
    expect(missing).toEqual([]);
  });

  it("圖層關閉（visibility none）時不列入", () => {
    const config = WITH_ATTRIBUTION[0]!;
    const map = stubMap();
    addOverlay(map, config, true, {});
    setOverlayVisible(map, config, false, true, {});
    expect(collectLayerAttributions(readMapSourceViews(map))).toEqual([]);
  });

  it("hook 事後補在 source instance 上的 attribution 也收得到（PMTiles、GFW、JMA 等）", () => {
    const map = stubMap();
    map.addSource("hook-src", { type: "vector" });
    map.addLayer({ id: "hook-layer", type: "line", source: "hook-src" });
    map.getSource("hook-src").attribution = "出典：気象庁（公共データ利用規約1.0）";
    expect(collectLayerAttributions(readMapSourceViews(map))).toEqual(["出典：気象庁（公共データ利用規約1.0）"]);
  });

  it("底圖（mapbox://）來源不進新元件，留給內建版權列", () => {
    expect(isBasemapSourceUrl("mapbox://mapbox.mapbox-streets-v8,mapbox.mapbox-terrain-v2")).toBe(true);
    expect(isBasemapSourceUrl("mapbox://mapbox.mapbox-terrain-dem-v1")).toBe(true);
    expect(isBasemapSourceUrl("./public_life/national_parks.pmtiles")).toBe(false);
    expect(isBasemapSourceUrl(undefined)).toBe(false);
    const views = [
      { id: "composite", url: "mapbox://mapbox.mapbox-streets-v8", attribution: "© Mapbox © OpenStreetMap", used: true },
      { id: "a", attribution: "  經濟部水利署 水門位置 · 政府資料開放授權條款第1版 ", used: true },
      { id: "b", attribution: "經濟部水利署 水門位置 · 政府資料開放授權條款第1版", used: true },
      { id: "c", attribution: "", used: true },
    ];
    expect(collectLayerAttributions(views)).toEqual(["經濟部水利署 水門位置 · 政府資料開放授權條款第1版"]);
  });

  it("registry 圖層的 source 一律不會被誤判成底圖", () => {
    expect(WITH_ATTRIBUTION.filter((c) => isBasemapSourceUrl(c.sourceUrl)).map((c) => c.id)).toEqual([]);
  });
});

describe("attribution 字串解析", () => {
  it("最後一個「 · 」後段是授權：分組並從顯示文字移除；data.gov.tw nid 轉原始頁", () => {
    expect(parseAttributionPart("交通部公路局 省道里程牌（data.gov.tw 7040）· 政府資料開放授權條款第1版")).toEqual({
      key: "交通部公路局 省道里程牌（data.gov.tw 7040）· 政府資料開放授權條款第1版",
      text: "交通部公路局 省道里程牌（data.gov.tw 7040）",
      url: "https://data.gov.tw/dataset/7040",
      license: "政府資料開放授權條款第1版",
    });
  });

  it("授權寫在括號、或「第 1 版」有空格：正規化到同一組，原文保留", () => {
    const e = parseAttributionPart("臺南市政府工務局橋梁檢測資料（政府資料開放授權條款第 1 版）")!;
    expect(e.license).toBe("政府資料開放授權條款第1版");
    expect(e.text).toBe("臺南市政府工務局橋梁檢測資料（政府資料開放授權條款第 1 版）");
    expect(e.url).toBeNull();
  });

  it("後段不是授權（說明文字）時改在全文找授權關鍵字", () => {
    const osm = parseAttributionPart("© OpenStreetMap contributors (ODbL) · 映射密度，不是服務品質、人口覆蓋或道路可達性")!;
    expect(osm.license).toBe("ODbL");
    expect(osm.text).toContain("映射密度");
    expect(parseAttributionPart("© Ookla · Ookla、Speedtest 及相關標誌為 Ookla, LLC 商標 · CC BY-NC-SA 4.0 · 非商業／相同方式分享")!.license).toBe("CC BY-NC-SA 4.0");
    expect(parseAttributionPart("GEBCO 2025 Grid（15″，Public Domain）")!.license).toBe("Public Domain");
    expect(parseAttributionPart("出典：気象庁（公共データ利用規約1.0）")!.license).toBe("公共データ利用規約1.0");
  });

  it("解析不了授權 → 其他，原文顯示", () => {
    const e = parseAttributionPart("衛生福利部疾病管制署 愛滋自我篩檢通路（快照 2026-10-06）")!;
    expect(e.license).toBe(OTHER_LICENSE);
    expect(e.text).toBe("衛生福利部疾病管制署 愛滋自我篩檢通路（快照 2026-10-06）");
  });

  it("多來源字串以「 | 」與「；©」切開", () => {
    expect(splitAttribution("資料來源：內政部全國宗教資訊系統、文化部文化資產局 | © OpenStreetMap contributors (ODbL)")).toEqual([
      "資料來源：內政部全國宗教資訊系統、文化部文化資產局",
      "© OpenStreetMap contributors (ODbL)",
    ]);
    expect(splitAttribution("新北市政府橋梁清冊；© OpenStreetMap contributors (ODbL)")).toEqual([
      "新北市政府橋梁清冊",
      "© OpenStreetMap contributors (ODbL)",
    ]);
  });

  it("HTML 連結：只取文字與 http(s) 網址，不輸出任何標籤", () => {
    const gfw = parseAttributionPart('<a href="https://globalfishingwatch.org/" target="_blank" rel="noopener">Powered by Global Fishing Watch</a>')!;
    expect(gfw).toMatchObject({ text: "Powered by Global Fishing Watch", url: "https://globalfishingwatch.org/" });
    const evil = parseAttributionPart('<a href="javascript:alert(1)">x</a><img src=x onerror="alert(1)"> &amp; y')!;
    expect(evil.url).toBeNull();
    expect(evil.text).toBe("x & y");
    expect(evil.text).not.toMatch(/[<>]/);
  });

  it("去重與分組順序：政府開放資料 → ODbL → 其他具名授權 → 其他", () => {
    const entries = parseAttributions([
      "衛生福利部 某名單",
      "GEBCO 2025 Grid（15″，Public Domain）",
      "© OpenStreetMap contributors (ODbL)",
      "經濟部水利署 水門位置（data.gov.tw 32722）· 政府資料開放授權條款第1版",
      "資料來源：內政部宗教及禮制司 | © OpenStreetMap contributors (ODbL)",
    ]);
    expect(entries).toHaveLength(5);
    expect(groupAttributions(entries).map((g) => g.license)).toEqual([
      "政府資料開放授權條款第1版",
      "ODbL",
      "Public Domain",
      OTHER_LICENSE,
    ]);
  });

  it("registry 全部字串都解析得出非空文字", () => {
    const parts = WITH_ATTRIBUTION.flatMap((c) => splitAttribution(c.attribution!));
    expect(parts.map((p) => parseAttributionPart(p)?.text ?? "").filter((t) => !t)).toEqual([]);
  });
});

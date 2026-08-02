/**
 * Overlay 表達式靜態驗證 —— 用 Mapbox 官方 style-spec validator 掃 OVERLAY_REGISTRY
 * 每一個 layer 的 paint / layout / filter。
 *
 * 為什麼要有這支（2026-08-02 山域事故實例）：
 *   `["*", ["interpolate",["linear"],["zoom"],…], ["step",…]]`
 *   看起來完全合理、tsc 全綠、測試全綠 —— 但 Mapbox 在 addLayer 時**整層拒收**，
 *   圖層在畫面上完全不存在，只在 console 留一行錯誤。這種「壞掉不會叫」的失敗
 *   靠人眼開瀏覽器才發現得了，代價是一次完整的驗收流程。
 *
 * 本測試把那次的 console error 提前到 `pnpm test`。與 layerConsistency 一樣是
 * **掃全集**不是列舉個案：日後新增的每個 layer 自動納入保護，不用改本檔。
 *
 * 驗證方式刻意鏡像 `overlayManager.addOverlay` 的組法（source 型別 / source-layer /
 * layout / filter 的取用順序），確保驗到的就是實際送進 Mapbox 的東西。
 */
import { describe, it, expect } from "vitest";
// @ts-expect-error — style-spec 的 CJS 入口無型別宣告（mapbox-gl 未導出），僅測試用
import { validate } from "mapbox-gl/dist/style-spec/index.cjs";
import { OVERLAY_REGISTRY } from "../overlayRegistry";
import type { OverlayConfig, OverlayLayerSpec } from "../../types";

/** 依 config 決定 source 型別：PMTiles → vector（raster PMTiles 無 sourceLayer → raster） */
function sourceFor(config: OverlayConfig, specType: string): Record<string, unknown> {
  if (config.pmtiles) {
    return specType === "raster"
      ? { type: "raster", tiles: ["https://example.invalid/{z}/{x}/{y}.png"], tileSize: 256 }
      : { type: "vector", tiles: ["https://example.invalid/{z}/{x}/{y}.pbf"] };
  }
  return { type: "geojson", data: { type: "FeatureCollection", features: [] } };
}

/** 組出 addOverlay 實際會送進 map.addLayer 的那個 layer 物件（同 overlayManager 順序） */
function buildLayer(
  config: OverlayConfig,
  spec: OverlayLayerSpec,
  isDark: boolean,
  params: Record<string, number>,
): Record<string, unknown> {
  const filter = typeof spec.filter === "function" ? spec.filter(params) : spec.filter;
  const layout = typeof spec.layout === "function" ? spec.layout(isDark, params) : spec.layout;
  return {
    id: `${config.sourceId}-${spec.suffix}`,
    type: spec.type,
    source: config.sourceId,
    ...(config.pmtiles?.sourceLayer ? { "source-layer": config.pmtiles.sourceLayer } : {}),
    ...(layout ? { layout } : {}),
    ...(spec.minzoom != null ? { minzoom: spec.minzoom } : {}),
    ...(filter ? { filter } : config.filter ? { filter: config.filter } : {}),
    paint: spec.paint(isDark, params),
  };
}

function validateLayer(layer: Record<string, unknown>, source: Record<string, unknown>): string[] {
  const style = {
    version: 8,
    // symbol layer 的 text-field 需要 style 有 glyphs（真實環境由 Mapbox 底圖提供）；
    // 不補這行會對每個 symbol layer 誤報 "requires a style glyphs property"。
    glyphs: "mapbox://fonts/mapbox/{fontstack}/{range}.pbf",
    sources: { [layer.source as string]: source },
    layers: [layer],
  };
  return (validate(style) as { message: string }[]).map((e) => e.message);
}

describe("overlay 表達式（Mapbox style-spec 靜態驗證）", () => {
  // paint/layout/filter 都吃 params；用空物件讓每個 `?? 預設值` 走預設分支。
  // isDark 兩種都驗（不少層的描邊色/對比在兩個分支各寫一份，只驗一邊會漏）。
  const CASES: { label: string; isDark: boolean; params: Record<string, number> }[] = [
    { label: "dark", isDark: true, params: {} },
    { label: "light", isDark: false, params: {} },
  ];

  for (const c of CASES) {
    it(`OVERLAY_REGISTRY 全部 layer 在 ${c.label} 主題下都是合法 style`, () => {
      const broken: string[] = [];
      for (const config of OVERLAY_REGISTRY) {
        for (const spec of config.layers) {
          let layer: Record<string, unknown>;
          try {
            layer = buildLayer(config, spec, c.isDark, c.params);
          } catch (err) {
            broken.push(`${config.id}/${spec.suffix}: paint/filter 函式拋錯 — ${(err as Error).message}`);
            continue;
          }
          for (const msg of validateLayer(layer, sourceFor(config, spec.type))) {
            broken.push(`${config.id}/${spec.suffix}: ${msg}`);
          }
        }
      }
      expect(
        broken,
        `以下 layer 的表達式 Mapbox 不收（addLayer 會整層失敗、畫面上完全不出現，` +
        `只在 console 留錯誤）：\n  ${broken.join("\n  ")}\n` +
        `→ 常見原因：["zoom"] 沒放在最外層 interpolate/step（不能包在 ["*"]、["case"] 裡）`,
      ).toEqual([]);
    });
  }

  it("有 filter 函式的 layer，在各種 params idx 下都產出合法 filter", () => {
    // 分類篩選類 layer（urbanZoning / nonUrbanZoning / mountainRescue / religion…）的 filter
    // 會依 idx 取不同分支，只驗 idx=0 會漏掉「選了某分類才炸」的情況。
    // 掃 0..11 涵蓋目前所有分類表長度（最長 11 = 非都市分區 zone_code）。
    const broken: string[] = [];
    for (const config of OVERLAY_REGISTRY) {
      for (const spec of config.layers) {
        if (typeof spec.filter !== "function") continue;
        for (let idx = 0; idx <= 11; idx++) {
          // 所有 *Idx 參數一起餵同一個值：filter 函式只會挑自己認得的 key
          const params = Object.fromEntries(
            (config.rebuildOnParamChange ?? []).map((k) => [k, idx]),
          );
          const allIdxParams = { ...params, ...idxParamsFor(config, idx) };
          try {
            const filter = spec.filter(allIdxParams);
            const layer = { ...buildLayer(config, spec, true, allIdxParams), filter };
            for (const msg of validateLayer(layer, sourceFor(config, spec.type))) {
              broken.push(`${config.id}/${spec.suffix} idx=${idx}: ${msg}`);
            }
          } catch (err) {
            broken.push(`${config.id}/${spec.suffix} idx=${idx}: filter 拋錯 — ${(err as Error).message}`);
          }
        }
      }
    }
    expect(broken, `filter 表達式不合法：\n  ${broken.join("\n  ")}`).toEqual([]);
  });
});

/**
 * 猜出該 config 可能用到的 *Idx / *CategoryIdx 參數名並全部餵同一個 idx。
 * 命名慣例是 `<layerKey><Something>Idx`（urbanZoningTaipeiCategoryIdx /
 * mountainRescueIncidentsYearIdx / religionTemplesDeityIdx…），這裡窮舉常見後綴即可，
 * 猜不中的 key 只會讓 filter 走預設分支（idx=0），不會誤報。
 */
function idxParamsFor(config: OverlayConfig, idx: number): Record<string, number> {
  const suffixes = [
    "CategoryIdx", "CodeIdx", "YearIdx", "DeityIdx", "RegistryIdx",
    "ModeIdx", "TypeIdx", "HighlightIdx", "ScaleIdx", "ColorModeIdx", "TrajFilterIdx",
  ];
  return Object.fromEntries(suffixes.map((s) => [`${config.id}${s}`, idx]));
}

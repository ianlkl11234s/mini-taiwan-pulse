/**
 * `/embed` 白名單守門（EM-06）
 *
 * 這是**安全與成本的雙重防線**，兩者都不能靠人記得：
 * - gated 圖層外流 = 私人資料洩漏
 * - 動態圖層被嵌 = Supabase egress 由別人的文章流量決定
 *
 * 白名單是從 registry 自動派生的，所以新增圖層不必改測試；
 * 但若有人放寬派生規則，下面的斷言會立刻紅。
 */
import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { OVERLAY_REGISTRY } from "../../map/overlayRegistry";
import { EMBED_CDN_LAYERS, rowsToGeoJSON } from "../dynamicCdnLayers";
import { GATED_LAYERS } from "../../components/sidebar/layerCatalog";
import { EMBED_ALLOWED, EMBED_ALLOWED_CONFIGS, buildEmbedVisibility, configsFor } from "../embedWhitelist";
import type { LayerVisibility } from "../../types";

describe("EMBED_ALLOWED 白名單", () => {
  it("🔒 沒有任何 gated 圖層", () => {
    const leaked = [...GATED_LAYERS].filter((k) => EMBED_ALLOWED.has(k));
    expect(leaked, `gated 圖層外流：${leaked.join(", ")}`).toEqual([]);
  });

  it("💰 dynamicData 圖層只有『已 CDN 化』的例外能進（Supabase egress 仍為零）", () => {
    const dynamic = OVERLAY_REGISTRY.filter((o) => o.dynamicData).map((o) => o.id);
    const leaked = dynamic.filter((id) => EMBED_ALLOWED.has(id) && !(id in EMBED_CDN_LAYERS));
    expect(leaked, `未經 CDN 化的動態圖層外流：${leaked.join(", ")}`).toEqual([]);
  });

  it("💰 每個 EMBED_CDN_LAYERS 都必須有實際的快照檔（否則會靜默留空）", () => {
    // 這道守門是為了擋掉 gasStation 那種坑：loader 改用了 staticRpc，
    // 但 public/static-rpc/ 沒產出對應檔案 → 主站靜默 fallback 打 RPC、embed 則整層空白。
    const missing = Object.entries(EMBED_CDN_LAYERS)
      .filter(([, rpc]) => !existsSync(`public/static-rpc/${rpc}.json`))
      .map(([key, rpc]) => `${key} → ${rpc}.json`);
    expect(missing, `快照檔不存在：${missing.join(", ")}`).toEqual([]);
  });

  it("🔒 CDN 例外清單本身不得含 gated 圖層", () => {
    const bad = Object.keys(EMBED_CDN_LAYERS).filter((k) => GATED_LAYERS.has(k as keyof LayerVisibility));
    expect(bad, `CDN 清單混入 gated：${bad.join(", ")}`).toEqual([]);
  });

  it("白名單非空，且涵蓋主要靜態圖層", () => {
    expect(EMBED_ALLOWED.size).toBeGreaterThan(100);
    expect(EMBED_ALLOWED.has("aquaculturePonds")).toBe(true);
  });

  it("白名單 = registry 扣掉 gated，動態層僅留 CDN 例外（派生規則本身）", () => {
    // 去重：registry 存在「一個 layer id ↔ 多個 config」（propertyValueGrid 的
    // 150m/450m/1.5km 三份 PMTiles 共用同一個 id），EMBED_ALLOWED 是 Set。
    const expected = new Set(
      OVERLAY_REGISTRY
        .filter((o) => (!o.dynamicData || o.id in EMBED_CDN_LAYERS) && !GATED_LAYERS.has(o.id))
        .map((o) => o.id),
    );
    expect([...EMBED_ALLOWED].sort()).toEqual([...expected].sort());
  });

  it("每個白名單 config 都有 sourceUrl（靜態檔一定要有來源）", () => {
    const missing = EMBED_ALLOWED_CONFIGS.filter((o) => !o.sourceUrl).map((o) => o.id);
    expect(missing).toEqual([]);
  });
});

describe("buildEmbedVisibility", () => {
  it("預設全關", () => {
    const v = buildEmbedVisibility([]);
    expect(Object.values(v).some(Boolean)).toBe(false);
  });

  it("只開指定的白名單圖層", () => {
    const v = buildEmbedVisibility(["aquaculturePonds"]);
    expect(v.aquaculturePonds).toBe(true);
    expect(Object.entries(v).filter(([, on]) => on).map(([k]) => k)).toEqual(["aquaculturePonds"]);
  });

  it("🔒 即使被硬塞 gated key 也不會開啟（第二道防線）", () => {
    const gated = [...GATED_LAYERS][0]! as keyof LayerVisibility;
    const v = buildEmbedVisibility([gated, "aquaculturePonds"]);
    expect(v[gated]).toBe(false);
    expect(v.aquaculturePonds).toBe(true);
  });
});

describe("configsFor", () => {
  it("只回傳被要求且在白名單內的 config", () => {
    const configs = configsFor(["aquaculturePonds"]);
    expect(configs.map((c) => c.id)).toEqual(["aquaculturePonds"]);
  });

  it("空輸入回空陣列（不會註冊任何 source）", () => {
    expect(configsFor([])).toEqual([]);
  });

  it("🔒 gated key 不會回傳 config", () => {
    const gated = [...GATED_LAYERS][0]! as keyof LayerVisibility;
    expect(configsFor([gated])).toEqual([]);
  });
});

describe("rowsToGeoJSON（通用 row → GeoJSON）", () => {
  it("lon/lat 轉 Point，properties 全帶", () => {
    const fc = rowsToGeoJSON([{ lon: 121, lat: 25, name: "A", capacity_mw: 3 }]);
    expect(fc.features).toHaveLength(1);
    expect(fc.features[0]!.geometry).toEqual({ type: "Point", coordinates: [121, 25] });
    expect(fc.features[0]!.properties).toEqual({ name: "A", capacity_mw: 3, lon: 121, lat: 25 });
  });

  it("geom_json 優先，且不重複塞進 properties", () => {
    const geom = { type: "Polygon", coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] };
    const fc = rowsToGeoJSON([{ geom_json: geom, zone_name: "Z" }]);
    expect(fc.features[0]!.geometry).toEqual(geom);
    expect(fc.features[0]!.properties).toEqual({ zone_name: "Z" });
  });

  it("缺幾何的 row 被略過，不炸掉整批", () => {
    const fc = rowsToGeoJSON([{ name: "無座標" }, { lon: 121, lat: 25 }, { lon: NaN, lat: 25 }]);
    expect(fc.features).toHaveLength(1);
  });

  it("非陣列輸入回空 FeatureCollection（壞快照不白屏）", () => {
    expect(rowsToGeoJSON(null).features).toEqual([]);
    expect(rowsToGeoJSON({ error: "x" }).features).toEqual([]);
  });

  it("undefined 欄位正規化為 null（Mapbox filter 不吃 undefined）", () => {
    const fc = rowsToGeoJSON([{ lon: 121, lat: 25, name: undefined }]);
    expect(fc.features[0]!.properties!.name).toBeNull();
  });
});

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
import { OVERLAY_REGISTRY } from "../../map/overlayRegistry";
import { GATED_LAYERS } from "../../components/sidebar/layerCatalog";
import { EMBED_ALLOWED, EMBED_ALLOWED_CONFIGS, buildEmbedVisibility, configsFor } from "../embedWhitelist";
import type { LayerVisibility } from "../../types";

describe("EMBED_ALLOWED 白名單", () => {
  it("🔒 沒有任何 gated 圖層", () => {
    const leaked = [...GATED_LAYERS].filter((k) => EMBED_ALLOWED.has(k));
    expect(leaked, `gated 圖層外流：${leaked.join(", ")}`).toEqual([]);
  });

  it("💰 沒有任何 dynamicData 圖層（Supabase egress 歸零）", () => {
    const dynamic = OVERLAY_REGISTRY.filter((o) => o.dynamicData).map((o) => o.id);
    const leaked = dynamic.filter((id) => EMBED_ALLOWED.has(id));
    expect(leaked, `動態圖層外流：${leaked.join(", ")}`).toEqual([]);
  });

  it("白名單非空，且涵蓋主要靜態圖層", () => {
    expect(EMBED_ALLOWED.size).toBeGreaterThan(100);
    expect(EMBED_ALLOWED.has("aquaculturePonds")).toBe(true);
  });

  it("白名單 = registry 扣掉 dynamicData 與 gated（派生規則本身）", () => {
    // 去重：registry 存在「一個 layer id ↔ 多個 config」（propertyValueGrid 的
    // 150m/450m/1.5km 三份 PMTiles 共用同一個 id），EMBED_ALLOWED 是 Set。
    const expected = new Set(
      OVERLAY_REGISTRY
        .filter((o) => !o.dynamicData && !GATED_LAYERS.has(o.id))
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

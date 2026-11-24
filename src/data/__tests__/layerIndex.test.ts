import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LAYER_MANIFEST, MANIFEST_KEYS, manifestColors, manifestIcons, type LayerManifestEntry } from "../layerManifest";
import { INDEXED_LAYER_KEYS, indexLegend, indexPopup, isIndexedKey, layerIndexRow } from "../layerIndex";
import { allLayerKeys, getLayerEntry, layerColorTable, layerCountryOf, layerGatedKeys, layerIconTable, layerIsLive } from "../layerLookup";
import { collectLayerIndex, isForeignEntry, renderLayerIndexModule } from "./layerIndexCodegen";
import { OVERLAY_REGISTRY } from "../../map/overlayRegistry";
import { GIS_LAYERS } from "../../map/gisClickRegistry";
import { GATED_LAYERS, LAYER_COLORS, THEMES } from "../../components/sidebar/layerCatalog";
import { LAYER_ICONS } from "../../components/sidebar/layerIcons";
import { countryForLayerKeys } from "../../research/explorationNavigation";
import { isCountryCode } from "../../constants/countries";
import { layerDataTimeZone } from "../../lib/layerDataTime";
import { DEFAULT_TIME_ZONE } from "../../lib/zonedTime";
import { loadAllPacks } from "../../countries/packs";

// 全部圖層（含延後載入的國家包，B1 P5a）一起驗
await loadAllPacks();

const entries = LAYER_MANIFEST as unknown as Record<string, LayerManifestEntry>;
const foreign = Object.entries(entries).filter(([, e]) => isForeignEntry(e));

describe("layerIndex（外國圖層索引）", () => {
  it("重新生成＝已提交（改了外國 manifest 請跑 npx vite-node scripts/layers/gen-layer-index.ts）", () => {
    const root = join(__dirname, "..", "..", "..");
    expect(readFileSync(join(root, "src/data/layerIndex.generated.ts"), "utf8")).toBe(renderLayerIndexModule());
  });

  it("索引 key 集合＝外國 manifest key 集合（且不含 TW／WORLD／SIM／orphan）", () => {
    expect([...INDEXED_LAYER_KEYS].sort()).toEqual(foreign.map(([k]) => k).sort());
    expect(collectLayerIndex().length).toBe(INDEXED_LAYER_KEYS.length);
    for (const key of INDEXED_LAYER_KEYS) {
      const country = layerIndexRow(key)!.country;
      expect(isCountryCode(country) && country !== "TW", key).toBe(true);
    }
  });

  it("每一列與 manifest 對應欄位一致", () => {
    for (const [key, e] of foreign) {
      const row = layerIndexRow(key)!;
      const x = e as LayerManifestEntry & { dataTimeZone?: string; longTerm?: { kind: string } };
      expect(row.country, key).toBe(e.country);
      expect(row.name, key).toEqual(e.name);
      expect(row.section, key).toEqual(e.section);
      expect(row.color, key).toBe(e.color);
      expect(layerIconTable()[key as never], key).toBe(e.icon);
      expect(!!row.gated, key).toBe(e.topics.includes("OWNER_ONLY"));
      expect(!!row.expandable, key).toBe(!!e.expandable);
      expect(indexPopup(key), key).toEqual(e.popup);
      expect(indexLegend(key), key).toBe(e.legend);
      expect(row.dataTimeZone, key).toBe(x.dataTimeZone);
      expect(row.longTerm, key).toBe(x.longTerm?.kind);
      expect(!!row.live, key).toBe(!x.longTerm && e.topics.includes("即時"));
    }
  });

  it("全域順序：draw＝OVERLAY_REGISTRY 內第一筆序號，click＝GIS_LAYERS 內最前的對應 popup 序號", () => {
    for (const [key, e] of foreign) {
      const row = layerIndexRow(key)!;
      const draw = OVERLAY_REGISTRY.findIndex((c) => c.id === key);
      expect(row.draw, key).toBe(draw >= 0 ? draw : undefined);
      const types = e.popup === null ? [] : Array.isArray(e.popup) ? e.popup : [e.popup];
      const clicks = types.map((t) => GIS_LAYERS.findIndex((g) => g.type === t)).filter((i) => i >= 0);
      expect(row.click, key).toBe(clicks.length ? Math.min(...clicks) : undefined);
    }
  });

  it("同步讀者「本地 manifest＋索引」與直接讀完整 manifest 結果相同", () => {
    expect(layerColorTable()).toEqual(manifestColors());
    expect(Object.keys(layerColorTable())).toEqual(Object.keys(manifestColors()).filter((k) => !isIndexedKey(k)).concat(INDEXED_LAYER_KEYS));
    expect(layerIconTable()).toEqual(manifestIcons());
    for (const k of MANIFEST_KEYS) {
      expect(LAYER_COLORS[k], k).toBe(LAYER_MANIFEST[k].color);
      expect(LAYER_ICONS[k], k).toBe(LAYER_MANIFEST[k].icon);
    }
    expect([...allLayerKeys()].sort()).toEqual([...MANIFEST_KEYS].sort());
    const gated = MANIFEST_KEYS.filter((k) => (LAYER_MANIFEST[k] as LayerManifestEntry).topics.includes("OWNER_ONLY"));
    expect([...layerGatedKeys()].sort()).toEqual([...gated].sort());
    expect([...GATED_LAYERS].sort()).toEqual([...gated].sort());
    for (const k of MANIFEST_KEYS) {
      const e = LAYER_MANIFEST[k] as LayerManifestEntry;
      expect(layerIsLive(k), k).toBe(!e.longTerm && e.topics.includes("即時"));
      expect(layerDataTimeZone(k), k).toBe((e as { dataTimeZone?: string }).dataTimeZone ?? DEFAULT_TIME_ZONE);
    }
  });

  it("countryForLayerKeys：與「走 THEMES」的舊算法一致", () => {
    const old = new Map<string, string>();
    for (const theme of THEMES) for (const g of theme.groups) for (const l of g.layers) {
      const c = (getLayerEntry(l.key) as LayerManifestEntry | undefined)?.country;
      if (isCountryCode(c) && !old.has(l.key)) old.set(l.key, c);
    }
    for (const k of MANIFEST_KEYS) {
      expect(layerCountryOf(k), k).toBe(old.get(k));
      expect(countryForLayerKeys([k]), k).toBe(old.get(k));
    }
  });
});

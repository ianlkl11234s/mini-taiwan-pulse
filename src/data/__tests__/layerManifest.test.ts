/**
 * Layer Manifest 契約測試（AR-22 Phase 1）
 * ══════════════════════════════════════════════════════════════════
 *
 * manifest 有兩種欄位，各需要不同的保護：
 *
 *   已派生（color / icon / label / labelMobile / expandable / gated / upstream）
 *     → 由 layerGoldenSnapshot 保護：改壞了快照立刻紅。
 *
 *   僅宣告（section / dataClass / source / legend / popup / params）
 *     → Phase 3-4 才接線。**在接線之前它們就只是註解** —— 沒人驗證的宣告會在
 *       半年內悄悄爛掉，等到 Phase 3 真的要拿來派生時才發現「宣告跟現況早就對不上」，
 *       那時 manifest 反而變成錯誤來源。
 *
 * 本測試把「僅宣告」欄位逐一釘到現況登記簿上。宣告錯 = 紅。
 * 這樣 Phase 2 批次搬移時可以直接信任這些欄位，不必每批重新人工核對。
 */
import { describe, it, expect } from "vitest";

import {
  LAYER_MANIFEST, MANIFEST_KEYS, type LayerManifestEntry, type LayerSource,
} from "../layerManifest";
import { LAYER_COLORS, THEMES, LAYER_LABELS } from "../../components/sidebar/layerCatalog";
import { LAYER_ICONS } from "../../components/IconRailSidebar";
import { UPSTREAM_REGISTRY } from "../upstreamRegistry";
import { LEGEND_REGISTRY } from "../../components/LegendPanel";
import { HEADER_LABELS } from "../../components/featureInfo/registry";
import { OVERLAY_REGISTRY } from "../../map/overlayRegistry";
import {
  extractGolden, extractGisLayers, extractGisConstRefTypes, extractNonGisFeatureTypes,
  extractCustomHandlerFeatureTypes,
} from "./layerGoldenExtract";

const entries = MANIFEST_KEYS.map(
  (k) => [k, LAYER_MANIFEST[k] as LayerManifestEntry] as const,
);

const golden = extractGolden();
const controls = golden.params as Record<string, { type?: string }[]>;
const gisRows = extractGisLayers() as { layers: string[]; type: string }[];
// GIS_LAYERS 有兩筆 layer id 寫成常數引用（disasterAlert / plaActivity），字面陣列的
// 解析器抓不到 —— 但它們有真的點擊接線。不 union 進來的話，manifest 只能把這兩層
// 宣告成 popup: null（已知為假），Phase 3 派生時會靜默丟掉接線。
//
// 同理還有**完全不經 GIS_LAYERS** 的第三類（`ship` / `waterDam` / `climateField`）：
// 直接 setFeatureInfo。風場／海流的 `climateField` 尤其極端 —— 它是「向量 feature 全部
// 沒命中」時的 fallback，點哪都能讀值，本來就不對應任何 layer id。
//
// 第四類（批 7 廢棄物）連 useMapInteraction 都不進：圖層模組自己
// `map.on("click", layerId, …)`（wasteMapboxLayers 8 個 circle 子層）或 App.tsx 的
// customLayer raycast（6 個 3D 設施 scene）直接 setFeatureInfo。
const gisTypes = new Set([
  ...gisRows.map((r) => r.type),
  ...extractGisConstRefTypes(),
  ...extractNonGisFeatureTypes(),
  ...extractCustomHandlerFeatureTypes(),
]);

function themeLocation(key: string): { theme: string; group: string } | null {
  for (const t of THEMES) {
    for (const g of t.groups) {
      if (g.layers.some((l) => l.key === key)) return { theme: t.title, group: g.title };
    }
  }
  return null;
}

describe("layerManifest 自我一致", () => {
  it("每筆 entry 的 key 欄位與 record key 相同", () => {
    for (const [k, m] of entries) expect(m.key, `entry ${k} 的 key 欄位對不上`).toBe(k);
  });

  it("試點覆蓋 4 種 dataClass（體質各異才有派生機制的驗證價值）", () => {
    const classes = new Set(entries.map(([, m]) => m.dataClass));
    expect([...classes].sort(), "試點若全是同一種體質，Phase 2 批次搬移會每批返工")
      .toEqual(["A", "B", "C", "D"]);
  });
});

describe("layerManifest 已派生欄位真的在驅動下游表", () => {
  it("LAYER_COLORS 的值來自 manifest", () => {
    for (const [k, m] of entries) expect(LAYER_COLORS[k]).toBe(m.color);
  });

  it("LAYER_ICONS 的值來自 manifest（同一個元件參照，不是同名的另一顆）", () => {
    for (const [k, m] of entries) expect(LAYER_ICONS[k]).toBe(m.icon);
  });

  it("THEMES 的 LayerDef 來自 manifest（label / labelMobile / expandable / gated）", () => {
    for (const [k, m] of entries) {
      const def = THEMES.flatMap((t) => t.groups).flatMap((g) => g.layers).find((l) => l.key === k);
      expect(def, `${k} 不在 THEMES 裡`).toBeTruthy();
      expect(def!.label).toBe(m.label);
      expect(def!.labelMobile).toBe(m.labelMobile);
      expect(def!.expandable).toBe(m.expandable);
      expect(def!.gated).toBe(m.gated);
      // LAYER_LABELS 是 THEMES 的 derived 表 —— 一併確認派生鏈沒斷
      expect(LAYER_LABELS[k]).toBe(m.label);
    }
  });

  it("UPSTREAM_REGISTRY 的值來自 manifest", () => {
    for (const [k, m] of entries) expect(UPSTREAM_REGISTRY[k]).toEqual(m.upstream);
  });
});

describe("layerManifest 僅宣告欄位與現況一致（Phase 3-4 接線前的防腐）", () => {
  it("section 宣告 = THEMES 裡的實際位置", () => {
    for (const [k, m] of entries) {
      expect(themeLocation(k), `${k} 的 section 宣告與 THEMES 實際位置不符`)
        .toEqual({ theme: m.section.theme, group: m.section.group });
    }
  });

  it("source + dataClass 宣告 = OVERLAY_REGISTRY 的實際形狀（含同 key 多 config）", () => {
    for (const [k, m] of entries) {
      const configs = OVERLAY_REGISTRY.filter((c) => c.id === k);
      // 同 key 多 config（propertyValueGrid 三尺度）→ source 寫成陣列。單／複數走同一條
      // 比對路徑，差別只在筆數與**逐位對齊**。
      // ⚠️ index 配對不是圖方便：OVERLAY_REGISTRY 的順序決定 layer 疊放，Phase 3 由
      //    manifest 派生 GIS_LAYERS 時又是 first-hit-wins —— 順序 load-bearing，
      //    在這裡一併釘住，重排會紅。
      const sources = Array.isArray(m.source) ? m.source : [m.source];
      expect(sources, `${k} 的 source 陣列不能是空的`).not.toHaveLength(0);

      if (sources.some((s) => s.kind === "custom")) {
        expect(sources, `${k} 宣告 custom source（無 registry entry）就只能有一筆`)
          .toHaveLength(1);
        expect(m.dataClass, `${k} 宣告 custom source 就該是 dataClass D`).toBe("D");
        expect(configs, `${k} 宣告沒有 overlay entry，但 OVERLAY_REGISTRY 裡找得到`)
          .toHaveLength(0);
        continue;
      }

      // 上面的 guard 已排除 custom，這裡只是把它從型別上也拿掉（三個分支共用 sourceId）
      const overlaySources = sources.filter(
        (s): s is Exclude<LayerSource, { kind: "custom" }> => s.kind !== "custom",
      );

      expect(
        configs,
        `${k} 宣告 ${overlaySources.length} 筆 overlay source，OVERLAY_REGISTRY 實際 ${configs.length} 筆`,
      ).toHaveLength(overlaySources.length);

      overlaySources.forEach((src, i) => {
        // 多 config 時把位置寫進訊息，否則三筆一模一樣的錯誤看不出是哪一筆
        const at = overlaySources.length > 1 ? `${k}[${i}]` : k;
        const cfg = configs[i]!;
        expect(cfg.sourceId, `${at} sourceId 宣告錯`).toBe(src.sourceId);

        if (src.kind === "geojson") {
          expect(cfg.sourceUrl).toBe(src.url);
          expect(cfg.pmtiles, `${at} 宣告 geojson 卻有 pmtiles 設定`).toBeUndefined();
          expect(cfg.dynamicData, `${at} 宣告 geojson 卻是 dynamicData`).toBeFalsy();
        } else if (src.kind === "pmtiles") {
          expect(cfg.sourceUrl).toBe(src.url);
          expect(cfg.pmtiles, `${at} 宣告 pmtiles 但 registry 沒設定`).toBeTruthy();
          expect(cfg.pmtiles!.sourceLayer).toBe(src.sourceLayer);
          expect(cfg.pmtiles!.minzoom).toBe(src.minzoom);
          expect(cfg.pmtiles!.maxzoom).toBe(src.maxzoom);
        } else {
          expect(cfg.dynamicData, `${at} 宣告 supabase 但 registry 沒設 dynamicData`).toBe(true);
          expect(cfg.sourceUrl, `${at} 的 fallbackUrl 宣告錯`).toBe(src.fallbackUrl);
        }
      });

      // dataClass 只有一個值，但陣列各元素的 kind **不保證同質**
      // （`waterReservoirs` = pmtiles 水庫面 + geojson 壩體點）→ 由 kind 集合按
      // 「上線路徑最重」的 precedence 算期望值：pmtiles(B) ＞ supabase(C) ＞ geojson(A)。
      // 同質 entry 的期望值與逐筆斷言時逐字相同（強度零損失），混合才走 precedence。
      const CLASS_PRECEDENCE = ["pmtiles", "supabase", "geojson"] as const;
      const kinds = new Set(overlaySources.map((s) => s.kind));
      const heaviest = CLASS_PRECEDENCE.find((kind) => kinds.has(kind))!;
      expect(
        m.dataClass,
        `${k} 的 source kind 是 {${[...kinds].join(",")}}，dataClass 應為最重路徑 ${heaviest}`,
      ).toBe({ geojson: "A", pmtiles: "B", supabase: "C" }[heaviest]);
    }
  });

  it("legend 宣告 = LEGEND_REGISTRY 的實際覆蓋（null 代表有意識地不需要圖例）", () => {
    const covered = new Set(LEGEND_REGISTRY.flatMap((e) => e.keys as string[]));
    for (const [k, m] of entries) {
      if (m.legend === null) {
        expect(covered.has(k), `${k} 宣告不需要圖例，但 LEGEND_REGISTRY 有覆蓋它`).toBe(false);
      } else {
        expect(covered.has(k), `${k} 宣告了 legend "${m.legend}"，但 LEGEND_REGISTRY 沒覆蓋它`)
          .toBe(true);
      }
    }
  });

  it("同一個 legend id 的 key 必須落在 LEGEND_REGISTRY 的同一筆 entry（共用即共用）", () => {
    const byLegendId = new Map<string, string[]>();
    for (const [k, m] of entries) {
      if (m.legend === null) continue;
      byLegendId.set(m.legend, [...(byLegendId.get(m.legend) ?? []), k]);
    }
    for (const [id, keys] of byLegendId) {
      const owning = LEGEND_REGISTRY.filter((e) => keys.some((k) => (e.keys as string[]).includes(k)));
      expect(owning, `legend id "${id}" 的 key 散落在多筆 LEGEND_REGISTRY entry`).toHaveLength(1);
    }
  });

  it("popup 宣告 = HEADER_LABELS / GIS_LAYERS 的實際接線（含 key ≠ layerType 的情形）", () => {
    for (const [k, m] of entries) {
      if (m.popup === null) {
        expect(gisTypes.has(k), `${k} 宣告沒有 popup，但 GIS_LAYERS 有它的條目`).toBe(false);
        continue;
      }
      // 一個 key 對多個 layerType（earthquakeReplay 的測站點 + 鄉鎮面）→ 陣列。
      // 單／複數走同一條比對路徑，差別只在筆數與下面的順序斷言。
      const types = Array.isArray(m.popup) ? m.popup : [m.popup];
      expect(types, `${k} 的 popup 陣列不能是空的`).not.toHaveLength(0);
      expect(new Set(types).size, `${k} 的 popup 陣列有重複的 layerType`).toBe(types.length);

      for (const t of types) {
        expect(t in HEADER_LABELS, `${k} 的 popup layerType "${t}" 不在 HEADER_LABELS`).toBe(true);
        expect(gisTypes.has(t), `${k} 的 popup layerType "${t}" 在 GIS_LAYERS 找不到條目`).toBe(true);
      }

      // ⚠️ 多 layerType 時順序 load-bearing：GIS_LAYERS 是 first-hit-wins，點層在前、
      //    大面積面層刻意置末（earthquakeReplay 兩筆相隔近 200 列）。宣告順序必須與
      //    GIS_LAYERS 的出現順序一致，重排會靜默改掉「點下去命中哪一層」。
      if (types.length > 1) {
        const at = types.map((t) => gisRows.findIndex((r) => r.type === t));
        expect(
          at.every((i, n) => n === 0 || (i > (at[n - 1] as number) && i >= 0)),
          `${k} 的 popup 陣列順序與 GIS_LAYERS 出現順序不符（實際位置 ${at.join(",")}）`,
        ).toBe(true);
      }
    }
  });

  it("params 宣告 = useTransportParams 實際回傳的控件數與型別序列", () => {
    for (const [k, m] of entries) {
      const actual = controls[k] ?? [];
      if (m.params === null) {
        expect(actual, `${k} 宣告沒有控件，實際卻有 ${actual.length} 個`).toHaveLength(0);
        continue;
      }
      expect(actual.length, `${k} 控件數宣告 ${m.params.count}、實際 ${actual.length}`)
        .toBe(m.params.count);
      // SliderConfig 的 type 是 optional（省略即 slider）→ 正規化後再比
      expect(actual.map((c) => c.type ?? "slider"), `${k} 控件型別序列宣告錯`)
        .toEqual(m.params.kinds);
    }
  });
});

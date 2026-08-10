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
  LAYER_MANIFEST, MANIFEST_KEYS, type LayerManifestEntry,
} from "../layerManifest";
import { LAYER_COLORS, THEMES, LAYER_LABELS } from "../../components/sidebar/layerCatalog";
import { LAYER_ICONS } from "../../components/IconRailSidebar";
import { UPSTREAM_REGISTRY } from "../upstreamRegistry";
import { LEGEND_REGISTRY } from "../../components/LegendPanel";
import { HEADER_LABELS } from "../../components/featureInfo/registry";
import { OVERLAY_REGISTRY } from "../../map/overlayRegistry";
import { extractGolden, extractGisLayers } from "./layerGoldenExtract";

const entries = MANIFEST_KEYS.map(
  (k) => [k, LAYER_MANIFEST[k] as LayerManifestEntry] as const,
);

const golden = extractGolden();
const controls = golden.params as Record<string, { type?: string }[]>;
const gisRows = extractGisLayers() as { layers: string[]; type: string }[];
const gisTypes = new Set(gisRows.map((r) => r.type));

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

  it("source + dataClass 宣告 = OVERLAY_REGISTRY 的實際形狀", () => {
    for (const [k, m] of entries) {
      const configs = OVERLAY_REGISTRY.filter((c) => c.id === k);

      if (m.source.kind === "custom") {
        expect(m.dataClass, `${k} 宣告 custom source 就該是 dataClass D`).toBe("D");
        expect(configs, `${k} 宣告沒有 overlay entry，但 OVERLAY_REGISTRY 裡找得到`)
          .toHaveLength(0);
        continue;
      }

      expect(configs, `${k} 宣告有 overlay source，OVERLAY_REGISTRY 卻沒有對應 entry`)
        .toHaveLength(1);
      const cfg = configs[0]!;
      expect(cfg.sourceId, `${k} sourceId 宣告錯`).toBe(m.source.sourceId);

      if (m.source.kind === "geojson") {
        expect(m.dataClass).toBe("A");
        expect(cfg.sourceUrl).toBe(m.source.url);
        expect(cfg.pmtiles, `${k} 宣告 geojson 卻有 pmtiles 設定`).toBeUndefined();
        expect(cfg.dynamicData, `${k} 宣告 geojson 卻是 dynamicData`).toBeFalsy();
      } else if (m.source.kind === "pmtiles") {
        expect(m.dataClass).toBe("B");
        expect(cfg.sourceUrl).toBe(m.source.url);
        expect(cfg.pmtiles, `${k} 宣告 pmtiles 但 registry 沒設定`).toBeTruthy();
        expect(cfg.pmtiles!.sourceLayer).toBe(m.source.sourceLayer);
        expect(cfg.pmtiles!.minzoom).toBe(m.source.minzoom);
        expect(cfg.pmtiles!.maxzoom).toBe(m.source.maxzoom);
      } else {
        expect(m.dataClass).toBe("C");
        expect(cfg.dynamicData, `${k} 宣告 supabase 但 registry 沒設 dynamicData`).toBe(true);
        expect(cfg.sourceUrl, `${k} 的 fallbackUrl 宣告錯`).toBe(m.source.fallbackUrl);
      }
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
      expect(m.popup in HEADER_LABELS, `${k} 的 popup layerType "${m.popup}" 不在 HEADER_LABELS`)
        .toBe(true);
      expect(gisTypes.has(m.popup), `${k} 的 popup layerType "${m.popup}" 在 GIS_LAYERS 找不到條目`)
        .toBe(true);
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

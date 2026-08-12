/**
 * Layer Manifest 契約測試（AR-22 Phase 1）
 * ══════════════════════════════════════════════════════════════════
 *
 * manifest 有兩種欄位，各需要不同的保護：
 *
 *   已派生（color / icon / label / labelMobile / expandable / gated / upstream）
 *     → 由**本檔下方「已派生欄位真的在驅動下游表」那組斷言**保護：
 *       manifest 的值與 LAYER_COLORS / LAYER_ICONS / THEMES / UPSTREAM_REGISTRY
 *       逐 key 相等，改壞任一邊立刻紅。
 *       ⚠️ AR-22 Phase 4 前這句寫的是「由 layerGoldenSnapshot 保護」——
 *       那 9 個 section 已於 Phase 4 移出 fixture，理由正是「本檔已經逐 key 焊死，
 *       凍第二份只是每加一層就得重跑 REGEN 的 churn」（見 layerGoldenExtract.ts
 *       的 FIXTURE_SECTIONS）。**保護沒有減少，是去掉了重複的那一份。**
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
import { legendKeys } from "../legendGroups";
import { HEADER_LABELS } from "../../components/featureInfo/registry";
import { OVERLAY_REGISTRY } from "../../map/overlayRegistry";
import { GIS_LAYERS } from "../../map/gisClickRegistry";
import { isMigratedParamsKey } from "../layerParamsSpec";
import {
  extractGolden, extractNonGisFeatureTypes, extractCustomHandlerFeatureTypes,
} from "./layerGoldenExtract";

const entries = MANIFEST_KEYS.map(
  (k) => [k, LAYER_MANIFEST[k] as LayerManifestEntry] as const,
);

const golden = extractGolden();
const controls = golden.params as Record<string, { type?: string }[]>;
// Phase 4b 起是 **runtime 真值**：GIS_LAYERS 從 useMapInteraction 的區域常數提升成
// `map/gisClickRegistry.ts` 的模組級 export。原本的兩支文字解析器
// （`extractGisLayers` 只吃字面陣列 235 筆 ＋ `extractGisConstRefTypes` 補那 2 筆
// 常數引用的 type）一併退役 —— 237 筆全在同一個真值來源裡，補丁沒有存在理由了。
const gisRows: { layers: string[]; type: string }[] = GIS_LAYERS;
// **完全不經 GIS_LAYERS** 的第二類（`ship` / `waterDam` / `climateField`）：直接
// setFeatureInfo。風場／海流的 `climateField` 尤其極端 —— 它是「向量 feature 全部
// 沒命中」時的 fallback，點哪都能讀值，本來就不對應任何 layer id。
//
// 第三類（批 7 廢棄物）連 useMapInteraction 都不進：圖層模組自己
// `map.on("click", layerId, …)`（wasteMapboxLayers 8 個 circle 子層）或 App.tsx 的
// customLayer raycast（6 個 3D 設施 scene）直接 setFeatureInfo。
// 這兩類沒有登記簿可提升 → 仍是原始碼文字解析，**刻意保留**。
const gisTypes = new Set([
  ...gisRows.map((r) => r.type),
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
      if (m.section === null) {
        // orphan：沒有 LayerDef 可派生。label 一族在型別上就是 never（寫了 tsc 紅），
        // 這裡釘的是**反方向** —— THEMES 真的查無此 key，派生鏈也沒偷偷生出 label 來。
        expect(def, `${k} 宣告 section: null（orphan），THEMES 裡卻有它的 LayerDef`).toBeUndefined();
        expect(LAYER_LABELS[k], `${k} 宣告 orphan，LAYER_LABELS 卻有它`).toBeUndefined();
        continue;
      }
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
  it("section 宣告 = THEMES 裡的實際位置（null ⇔ orphan，THEMES 查無此 key）", () => {
    for (const [k, m] of entries) {
      // 雙向：宣告 null 就必須真的不在 THEMES，宣告座標就必須座標一致。
      // 只驗單邊的話，「把還在 THEMES 的層宣告成 orphan」會靜默過關 —— 那等於
      // 讓它從 sidebar 派生鏈裡消失（Phase 3 依 section 派生 THEMES 時整層不見）。
      if (m.section === null) {
        expect(themeLocation(k), `${k} 宣告 section: null（orphan），THEMES 裡卻找得到它`)
          .toBeNull();
        continue;
      }
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

  /**
   * ⚠️ AR-22 Phase 4b：`LEGEND_REGISTRY` 的 `keys` 改由 manifest 反查派生
   * （`data/legendGroups.ts` 的 `legendKeys()`），本組斷言隨之改形。
   *
   * ── 消失的兩條 & 取代它們的結構 ────────────────────────────────
   *   1. 「legend 宣告 ⇔ LEGEND_REGISTRY 實際覆蓋」的**逐 key 覆蓋對帳**：
   *      派生後兩邊同源，恆等成立，留著是永遠綠的裝飾。取代它的是下面
   *      「id 存在性」—— 覆蓋不會錯了，會錯的是「宣告了一個沒人渲染的 id」。
   *   2. 「同一個 legend id 的 key 必須落在同一筆 entry」：**由結構取代**。
   *      派生後同 id 的 key 拿到的就是同一個陣列，散落在多筆 entry 在物理上
   *      不可能發生。那個失敗模式唯一的殘留形式是「兩筆 entry 用同一個 id」
   *      —— 它們會拿到同一份成員名單、同時渲染兩份圖例。所以下面補了
   *      **id 唯一性**斷言，它就是舊測試的結構化替身。
   *
   * ── ⚠️ 誠實記錄派生的代價（SSOT 的本質，不是可修的缺陷）──────────
   *   manifest 的 legend id 填錯，從「測試會紅」變成「**自我實現**」：
   *   把某層的 legend 填成 `"fireStations"`，它就真的會跟消防栓共用那份圖例，
   *   兩邊一致所以不紅。派生前之所以擋得住，是因為 LegendPanel 手寫的那份
   *   `keys` 是**獨立的第二份證詞**；收成一份 SSOT 就沒有第二份可對質了。
   *   換到的是「不會再有兩份不同步」與「新增一層只寫一處」。
   *   守得住的剩下：id 存不存在、entry 有沒有成員、id 唯不唯一 —— 全在下面。
   */
  it("legend 宣告的 id 都有對應的 LEGEND_REGISTRY entry（宣告了卻沒人渲染 = 圖例不會出現）", () => {
    const registryIds = new Set(LEGEND_REGISTRY.map((e) => e.id));
    for (const [k, m] of entries) {
      if (m.legend === null) continue;
      expect(
        registryIds.has(m.legend),
        `${k} 宣告了 legend "${m.legend}"，但 LEGEND_REGISTRY 沒有這個 id 的 entry —— ` +
        "該層開啟時圖例面板不會出現任何東西（鐵則 2 靜默失效）",
      ).toBe(true);
    }
  });

  it("LEGEND_REGISTRY 每筆 entry 至少有一個 manifest 成員（零成員 = 死 entry）", () => {
    // 反方向：派生後「沒有 key 宣告這個 id」的 entry 會拿到空陣列 →
    // `keys.some(...)` 恆 false → 那份圖例元件永遠不顯示，而且不會有任何錯誤。
    // 呼叫的是**面板實際在用的那支** `legendKeys()`，不是測試裡重建一份。
    const dead = LEGEND_REGISTRY.filter((e) => legendKeys(e.id).length === 0).map((e) => e.id);
    expect(
      dead,
      "這些 LEGEND_REGISTRY entry 的 id 沒有任何 manifest key 宣告 → 永遠不顯示。" +
      "要嘛該刪，要嘛某層的 manifest legend 欄位填錯／漏填",
    ).toEqual([]);
  });

  it("LEGEND_REGISTRY 的 id 不重複（同 id 兩筆 = 同一群 key 渲染出兩份圖例）", () => {
    const seen = new Map<string, number>();
    for (const e of LEGEND_REGISTRY) seen.set(e.id, (seen.get(e.id) ?? 0) + 1);
    const dups = [...seen].filter(([, n]) => n > 1).map(([id, n]) => `${id}×${n}`);
    expect(dups, "重複的 legend id —— 兩筆 entry 會拿到同一份成員名單，圖例面板出現兩次")
      .toEqual([]);
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

  /**
   * ⚠️ AR-22 Phase 4b 新增 —— 上一條是「manifest → 接線」，本條是**反方向**。
   *
   * 只驗單邊的話，「接線表裡多出一個沒人宣告的 layerType」會靜默過關：那條接線
   * 點得出 popup，manifest 卻查無此事 —— 資料源瀏覽器 / BYOK 對話讀 manifest 就會
   * 少講一層，而且沒有任何測試會叫。GIS_LAYERS 提升成模組級 export（runtime 真值）
   * 之後這條才做得到：文字解析時代拿不到常數引用那兩筆的完整內容。
   *
   * ⚠️ **不去重**：`powerPlant` 8 個 row 是六份不同 RPC ＋ 兩個 Phase 8 SSOT entry
   * 共用一個 panel（各自獨立的 sourceId 與 layer id）。本條只問「這個 type 有沒有
   * 被宣告」，多對一是既有語意，不是要修的東西（批 8 交接第 2 點）。
   */
  it("GIS_LAYERS 每個 layerType 都有 manifest key 宣告它（反向：接線不能沒人認領）", () => {
    const declared = new Set<string>();
    for (const [, m] of entries) {
      if (m.popup === null) continue;
      for (const t of Array.isArray(m.popup) ? m.popup : [m.popup]) declared.add(t);
    }
    const orphanTypes = [...new Set(gisRows.map((r) => r.type))]
      .filter((t) => !declared.has(t)).sort();
    expect(
      orphanTypes,
      "這些 layerType 在 gisClickRegistry 有點擊接線，卻沒有任何 manifest key 的 popup " +
      "宣告它 —— 要嘛接線該刪，要嘛某層的 popup 宣告漏了",
    ).toEqual([]);
  });

  /**
   * ⚠️ AR-22 Phase 4 新增 —— 「有意識地沒有控件」的**唯一表達**是 manifest 的
   * `params: null`（P4 前它同時寄生在 `useLayerParamsRuntime` 的
   * `case "x": return []` 字面上，由 `paramsCaseKeys()` 正則掃出來，那條路已退役）。
   *
   * 這條把兩份 SSOT 焊起來：**形狀**在 manifest、**內容**在 `LAYER_PARAMS_SPEC`。
   * 新層只寫了規格沒進 manifest（或反之）→ 立刻紅，不必等控件數對不上才發現。
   */
  it("params 是否為 null ⇔ LAYER_PARAMS_SPEC 有沒有宣告（雙軌收束後的單一表達）", () => {
    for (const [k, m] of entries) {
      expect(
        isMigratedParamsKey(k),
        m.params === null
          ? `${k} 的 manifest 宣告 params: null（有意沒有控件），LAYER_PARAMS_SPEC 卻宣告了規格`
          : `${k} 的 manifest 宣告了 params，LAYER_PARAMS_SPEC 卻查無規格 —— ` +
            "控件不會出現在面板上（規則 §4a 鐵則 1）",
      ).toBe(m.params !== null);
    }
  });

  it("params 宣告 = useLayerParamsRuntime 實際回傳的控件數與型別序列", () => {
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

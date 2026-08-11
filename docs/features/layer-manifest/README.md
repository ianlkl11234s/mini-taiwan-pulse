# Layer Manifest（AR-22）

> **Slug**：`layer-manifest`
> **狀態**：dev（Phase 0-1 完成，Phase 2 待派工）
> **相關 PR**：待開
> **地基**：AR-21 visibility store（PR #129，`src/state/layerVisibilityStore.ts`）

## 一句話說明

把 348 個 layer 散在 5、6 張登記簿裡的**同一份事實**（叫什麼、什麼顏色、哪顆 icon、
資料從哪來、屬於哪個主題）收成單一 manifest，讓「新增一層要碰 14 檔約 21 處」裡的
登記簿類觸點全部由 manifest 派生。

## 為什麼要做

`docs/development-rules.md` §4 的完整觸點表列了 20 個觸點。2026-08-10 稽核用 3 個真實
commit 實測（落雷單層 11 檔 29 hunk／殯葬 5 層 14 檔／教育 16 層同 14 檔），發現舊版
「7 步」漏了 7 個觸點——**新人照舊表做必漏**。

其中約一半是純登記：同一份事實被抄進多張表，抄漏就漂移。而且危險的不是「編不過」
（tsc 會擋），是**編得過但值悄悄不一樣**——少一個 `labelMobile`、icon 換了一顆、
popup 的 layerType 跟 key 不同名沒對上。這些不報錯，只在瀏覽器上「看起來怪怪的」。

## 五個 Phase

| Phase | 內容 | 狀態 |
|---|---|---|
| **0** | 黃金快照護欄：348 key × 12 張登記簿凍結成 committed fixture ＋ 突變自測 | ✅ `8abbd97` |
| **1** | manifest schema（`LayerManifestEntry`）＋ 5 試點層搬移 ＋ 4 張表雙軌派生 | ✅ `574c3a6` `5dc9230` |
| **2** | 批次搬移剩下 343 層（8 批，見 [backlog.md](./backlog.md)） | 🔄 批 1（25 層）✅ `cc64857`…`1aa3d6b`；批 2（28 層）✅ `5d33117`…`b292d21`；批 3（33 層）✅ `b506144` `97b6d62`；批 4（46 層 ＋ 拍板② schema 擴充）✅ `15b9756`…`e73f677`；批 5（40 層 ＋ popup 陣列 schema）✅ `410cac7`…`61eb3e9`；批 6-8 待派工（Phase 2 已搬 172/343，manifest 共 **177 entry**） |
| **3** | legend / popup 接線派生化（觸點 #13 #15 #16 改讀 manifest） | ⬜ |
| **4** | params 派生化（`useTransportParams` 的 case 由 manifest spec 產生）＋ `/new-layer` 改成只寫 manifest | ⬜ |

Phase 4 完成後，新增一層的登記工作 = **只改 manifest 一處**，其餘由派生產生；
剩下的觸點都是實質邏輯（loader / hook / paint / legend 元件 / popup 元件）。

## 關鍵檔案

| 用途 | 路徑 |
|---|---|
| Manifest SSOT | `src/data/layerManifest.ts` |
| 黃金快照抽取器（測試 + dump 腳本共用） | `src/data/__tests__/layerGoldenExtract.ts` |
| 黃金快照護欄（23 tests） | `src/data/__tests__/layerGoldenSnapshot.test.ts` |
| 黃金 fixture（1.35 MB，57,589 行） | `src/data/__tests__/__fixtures__/layer-golden.json` |
| Manifest 契約測試（12 tests） | `src/data/__tests__/layerManifest.test.ts` |
| 重新產生 fixture | `scripts/preprocess/dump-layer-golden.ts` |

派生接線落在：`src/components/sidebar/layerCatalog.ts`（colors + THEMES）、
`src/components/IconRailSidebar.tsx`（icons）、`src/data/upstreamRegistry.ts`（upstream）。

### popup 宣告的三個真值來源（批 4 起）

`GIS_LAYERS` 一張表**不足以**判斷一層有沒有 popup，抽取器因此有三支：

| 解析器 | 涵蓋 | 為什麼需要 |
|---|---|---|
| `extractGisLayers` | 字面 `{ layers: [...], type }` | 主要來源（也進 fixture） |
| `extractGisConstRefTypes` | layer id 寫成常數引用那幾筆 | regex 要求字面陣列，抓不到（批 1） |
| `extractNonGisFeatureTypes` | **完全不經 GIS_LAYERS** 的 `setFeatureInfo` | `climateField` 是「沒命中任何 feature」的 fallback，不對應任何 layer id（批 4） |

**「查不到 → 填 null」是錯的捷徑**：三者聯集才是「這個 layerType 真的有接線」。
dataClass D 的層更要逐層打開 hook / factory 看它 `addLayer` 了什麼 id。

⚠️ **反方向也有陷阱（批 5）**：`HEADER_LABELS` 有條目**不代表**有 popup ——
那張表是 BYOK chat bridge 能標的 layerType 全集，`hillshade` 在裡面卻沒有任何
`GIS_LAYERS` 條目。兩個方向都只能靠「讀 hook 的 addLayer id 再對 GIS_LAYERS」。

`popup` 欄位也支援**一個 key 對多個 layerType**（陣列，批 5 為 `earthquakeReplay`
擴充）—— 同一個 toggle 建出的多個 layer 各自有 panel 時用它，順序＝GIS_LAYERS
出現序，但**不取代** Phase 3 要加的 `clickPriority`（兩者相隔可能很遠）。

## 雙軌派生機制

手寫表改成 `Omit<Record<keyof LayerVisibility, T>, ManifestKey>`，再與 manifest 分片
spread merge 成完整的 `Record<keyof LayerVisibility, T>`。tsc 三個方向都擋：

- 漏掉任一「還沒搬」的 key → TS2739 缺屬性
- 已搬進 manifest 的 key 還留在手寫表 → excess property 報錯
- manifest 刪 entry → 合成表缺 key 報錯

**刻意不用「全量手寫表被 merge 蓋過」**——那樣測試也會綠，但登記沒真搬走，會留下
「改 manifest 畫面沒反應」的暗雷。

`LAYER_MANIFEST` 用 `satisfies` 而非型別標註：標註會丟掉 key 的 literal 型別，
`ManifestKey` 退化成 348 key 全集，上面三道護欄整個失效。

## 5 試點層與挑選理由

刻意挑**體質各異**的 5 層，讓派生機制先撞過所有形狀，Phase 2 批次搬移才不會每批返工。

| key | dataClass | 為什麼挑它 |
|---|---|---|
| `cctv` | A 靜態 GeoJSON | 最單純基準：legend 獨佔、popup 與 key 同名、無 labelMobile |
| `newsEvents` | C 動態 | `dynamicData: true`；popup layerType `newsEvent` **與 key 不同名**，正是要收編的漂移點 |
| `urbanZoningTaipei` | B PMTiles | polygon 切片；有 `labelMobile`；legend 與 `urbanZoningNewTaipei` **共用**一個元件 |
| `rail` | D 前端自繪 | Three.js，**沒有 OVERLAY_REGISTRY entry**、沒有 popup → 逼 `source` 欄位處理 `kind: "custom"` |
| `pollutionFacility` | B PMTiles | 控件密度最高（8 個，slider/select/toggle 三型齊）＋ `upstream.processing` 欄位 |

## 等價證明

Phase 1 的硬驗收：搬移後**黃金快照 fixture 一位元未動**、23 條測試全綠 = 5 層零失真。

`npx tsc -b` 0 error｜`npx vitest run` 508 passed（基準 473 → +23 黃金 +12 契約）。

## 相關 backlog / 歷次改動 / 資料契約

[backlog.md](./backlog.md)｜[changelog.md](./changelog.md)｜[handoff.md](./handoff.md)

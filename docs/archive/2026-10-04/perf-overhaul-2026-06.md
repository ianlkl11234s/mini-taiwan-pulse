# 效能與架構體檢 — 2026-06-10

> 一次完整的效能 + 維護性改造：13 個 commit（`ac8bb79`..`210356e`），
> 全程行為不變（Playwright A/B 驗證）、每步獨立 commit 可單獨 revert。
> 起因：「農田 + 河川 + 堤防 + 渠道一開，地圖移動就卡」。

## TL;DR

| 面向 | 改造前 | 改造後 |
|---|---|---|
| 水利/林業大檔 | 9 個 GeoJSON 全量載入（共 ~400MB） | PMTiles 按需切片（實傳依視窗，個位數 MB） |
| Slider 拖動 | 全 registry × 全 layer × 全 paint key 重設 | diff 式，只動真正改變的 key |
| Timeline 快速滾日期 | 每跨一天 6~10 個 RPC 齊發 | leading+trailing debounce，只載停下那天 |
| 重複 toggle 圖層 | 每次重打 Supabase | 18 個 fetch 套 TTL 快取 |
| 測試 | 無 | vitest，51 tests（含 3 組 ratchet 守門） |
| FeatureInfoPanel | 2,569 行 god file | 83 行外殼 + 12 個 domain 檔 + registry |
| 新增 layer 接線 | ~13 個檔案觸點，靠記憶 | 各 concern 一行 registry，漏接測試會 fail |

---

## 1. 大檔 → PMTiles（HTTP Range Request 按需載入）

| 檔案 | 原 GeoJSON | PMTiles | 備註 |
|---|---|---|---|
| water_rivers | 16MB | 6.5MB | line，glow 三層 |
| water_river_polygons | 11MB | 4.8MB | ⚠️ 見下方 tippecanoe 坑 |
| water_canals | 6.8MB | 4.6MB | 29,469 條，t 屬性 3 色 match |
| water_levees | 1.9MB | 1.6MB | status 屬性 case expression |
| water_reservoirs | 19MB | **401KB** | 可點擊（popup 驗證 OK） |
| water_flood_extreme | **80MB** | 17MB | depth_class 5 級分色 |
| national_forest_compartments | **219MB**（已佚失） | 5.5MB | 林班；修復本體 |
| forest_reserve | 45MB | 1.9MB | 「種類」13 類 match 保留 |
| forest_roads | 16MB | 1.2MB | 可點擊 line |

接線方式：`OverlayConfig` 新增 `pmtiles: { sourceLayer, minzoom, maxzoom }`
欄位，`overlayManager.addOverlay` 自動走 `pmtile-source`。PMTiles SourceType
註冊收斂到 `src/map/pmtilesSourceType.ts`（原本 agriculture / fire / medical
三份重複 + 隱性註冊順序耦合）。

### ⚠️ tippecanoe 轉檔坑（重要）

- **polygon 必加 `--no-tiny-polygon-reduction`**：預設會把低 zoom 下小於
  1px 的 polygon 換成「占位小方塊」，13k 河道面 → 整島實心色塊。
- **polygon 不要用 `--coalesce-densest-as-needed`**（會合併成大色塊）；
  用 `--drop-smallest-as-needed`。line 才用 `--drop-densest-as-needed`。
- 屬性預設全保留；可點擊圖層轉換後務必驗 popup 欄位。

### 部署契約

- `public/geo/water_*.pmtiles` → S3 扁平（upload/pull glob 已補）
- `deploy-assets/forestry/` 鏡像子前綴（**pull 腳本與 nginx `/forestry/`
  route 是 2026-06-10 才補的** — 上傳端 6/7 就有、拉取端漏寫，
  容器上 forestry 大檔一直 404，這就是「林班資料不見」的根因之二）
- 舊 GeoJSON 仍留在 S3，revert 對應 commit 即可完整回退

## 2. 渲染層

- **diff 式 paint 更新**（`overlayPaintDiff.ts`）：快照比對，params 沒變
  = 0 次 Mapbox API call；`rebuildOnParamChange` 圖層只在 paint 真的變了
  才 remove/addLayer。
- GeoJSON source 補 `tolerance: 1.2`（頂點數降數倍、1.2px 誤差不可見）、
  純 line/fill source `buffer: 128→64`。

## 3. 資料層

- `src/lib/loaderCache.ts`：`cachedOnce` / `cachedByKey` / `keyedThunkCache`
  （in-flight 去重 + TTL + 失敗自清 + LRU）。慣例：歷史靜態 15min、
  *Latest 5min、per-day 時序 10min。
- `src/state/dateNotifier.ts`：日期通知 debounce — 單次切日零延遲，
  快速 scrub 只通知最後停下的日期。
- **RPC 實測教訓**（詳見 `supabase_rpc_audit.md` 2026-06-10 追記）：
  被點名的「慢 RPC」實測全 < 31ms — pre-aggregate 已到位，audit 推測
  ≠ 實測；優化重心是 payload × 重複抓取（前端快取），不是 SQL 改寫。

## 4. 架構收斂（新增 layer 的接線地圖）

| Concern | 接線位置 | 守門 |
|---|---|---|
| Sidebar + 顏色 | `layerCatalog.ts`（LAYER_COLORS + SECTIONS） | tsc TS2739 + ratchet |
| 預設可見性 | 自動派生；預設開才加 `useLayerVisibility.ts` 的 `DEFAULT_ON` | — |
| 參數 slider | `useTransportParams.ts` 加 case | ratchet |
| 圖例 | `LegendPanel.tsx` 寫元件 + `LEGEND_REGISTRY` 一行 | ratchet |
| Click popup | `featureInfo/` domain 檔寫元件 + `registry.tsx` 兩行 | registry 測試 |
| Timeline 切片圖層 | 用 `hooks/factories/timelineSliceLayer.ts`，別複製 hook | — |

有意識的決定：**不做單一 mega-descriptor** — layerCatalog 已是 sidebar
真實來源，再建平行 descriptor 會製造雙真實來源；改用 per-concern registry
+ ratchet 測試達到同樣的「一行接線、漏接即 fail」。

ratchet 規則：`npm test` 的 `layerConsistency` / `featureInfoRegistry`
兩個方向都會 fail —— 新 layer 漏接線 fail、補了線沒從 baseline 移除也
fail。baseline 同時是待還債清單（目前 legend 84、params 4、無 panel 3）。

## 5. 測試基建

```bash
npx tsc -b      # 必跑（commit 前）
npm test        # vitest，51 tests
npm run build   # production 健檢
```

dev 模式下 `window.__map` 有 map instance（`MapView.tsx`），E2E 可
`__map.jumpTo()` 固定相機做決定性 A/B 截圖。

## 6. 已知未做（後續）

- baseline 欠帳：84 個 layer 無圖例（多數為單色層、屬合法豁免，但未逐一覆核）
- `groundwaterWell` / `iotWraRiver` / `iotWraStructure` 自始無 popup panel
- wasteScheduleNote 無 opacity slider（ShaderMaterial 裝飾特效，有意識豁免）
- medICUBeds Phase 3 渲染未實作（sidebar toggle 已暫時移除）
- 三本柱 / AQI hook 群尚未收斂進 factory（相似度 80~90%）

# 視覺化函式庫 — 待辦（2026-09-29）

定案與規格看 [DECISIONS.md](DECISIONS.md)、[PLAN.md](PLAN.md)；這裡只放延後項目。
路徑前綴：`mini/` 為本 repo，`mcp/` 為 MCP repo（正式路徑 `.worktrees/analysis-prod/mcp`）。

## 1. 呼吸脈衝 R2

- **現況**：DECISIONS §2 M8 定案 R2（呼吸光暈 2.4s、同時 ≤20 個、減少動態時靜止外圈），但尚未實作。
- **為什麼延後**：規格限定「只給即時／進行中」的點，倉庫結果目前沒有任何欄位能標記某筆是即時資料；沒有這個標記就只能對所有點發光，違反規格。
- **下一步**：先在結果契約定義「即時／進行中」標記（由誰判定、時效多久算即時），再接渲染。
- **相關檔案**：`mini/docs/features/viz-library/DECISIONS.md`（§2 M8、§5 選取圈與脈衝區分）、`mini/src/research/warehouseResultStyle.ts`、`mcp/src/warehouse/resultStyle.ts`；即時標記的來源欄位待定位。

## 2. 合併三份重複 sparkline

- **現況**：三個元件各自手刻迷你折線。
- **為什麼延後**：屬 UI 統一範圍，UI session 施工中，避免衝突（DECISIONS §6 末）。
- **下一步**：UI 統一收尾後，抽成一個共用 SVG 元件（遵守 §6「X 共通前提」：不引套件、台灣時間、缺資料斷線），三處改用它。
- **相關檔案**：`mini/src/components/TimeseriesSparkline.tsx`、`mini/src/components/intel/monitor/PressureRing.tsx`、`mini/src/components/intel/alerts/AlertBoard.tsx`；UI 統一見 `mini/docs/features/ui-consistency-audit-20260927/`。

## 3. 新聞 `published_ts` 時區查證

- **現況**：題庫用 `date_trunc('week', published_ts)` 直接分週，沒有轉時區。
- **為什麼延後**：還沒查證這個欄位存的是 UTC 還是台灣時間；若是 UTC，週一 00:00–08:00 的新聞會被算進前一週，Q19（新聞連續週數）、Q28（海巡船隻×新聞共現）的期望值都可能偏。
- **下一步**：抽幾筆原始新聞比對來源發布時間，確認時區；是 UTC 就改成台灣時間分週並重算兩題期望值。
- **相關檔案**：`mcp/src/warehouse/questionBank.ts`（`Q19-news-persistence`、`Q28-ccg-vessel-news-cooccurrence`、`Q28_WEEKLY_GRID_CTE`）、`mini/.agents/skills/pulse-gis-analyst/references/recipes/news-persistence.md`、`event-context-timeseries.md`。

## 4. 食品價格指數原料查證

- **現況**：分析卡發布白名單把 `ds_food_prices_food_price_index` 排除（授權文字雖是 OGDL 衍生，但原料未逐一查證，2026-09-28 使用者決定暫不公開）。
- **為什麼延後**：指數由多個原始來源合成，要逐一確認每個來源的授權才能開放。
- **下一步**：列出指數的原料來源與各自授權；全部可再散布就從排除清單移除並重建白名單。
- **相關檔案**：`mcp/scripts/build-publish-allowlist.mts`、`mcp/src/warehouse/publishAllowlist.json`、`mcp/src/warehouse/publishGate.test.ts`。

## 5. 倉庫長期存放 Google geocode 座標

- **現況**：21 個資料集的座標來自 Google 地理編碼，發布閘門一律擋下（DECISIONS §6.1）；但這些座標仍長期存在分析倉庫。
- **為什麼延後**：需要法務面判讀。Google Maps Platform 條款 §6.3.1 只允許暫存（30 天），長期保存是否違約尚未查證。
- **下一步**：查證條款適用範圍；若不允許，改成定期過期重查，或改用可長期保存的地理編碼來源（TGOS 等）。
- **相關檔案**：`mcp/src/warehouse/publishLicense.ts`（`GOOGLE_GEOCODE_DATASET_IDS`）、`mcp/scripts/build-publish-allowlist.mts`、`mcp/src/research/googleGeocoder.ts`。

## 6. `allDescriptors()` 無快取

- **現況**：每次呼叫都重建全部 descriptor 並逐一 `assertDatasetDescriptor`；空查詢搜尋時成本約為「圖層數 × descriptor 數」。
- **為什麼延後**：目前數量下還沒造成可感延遲；函式註解刻意寫明「不跨呼叫快取」，改之前要確認沒有依賴每次重讀的行為。
- **下一步**：量測搜尋與 `registeredDatasetsForLayer` 的實際耗時；需要時改成註冊表變動才失效的快取，或先建 layerKey → descriptor 索引。
- **相關檔案**：`mini/src/research/researchDatasets.ts`（`allDescriptors`、`registeredDatasetSnapshot`、`registeredDatasetsForLayer`）。

## 7. 統計指標缺中文名稱欄位

- **現況**：分析卡圖例標題由 `legendTitleFor()` 決定，指標名不含中文就退回「指標值」；實際上靠 Agent 手填 `legendTitle`。
- **為什麼延後**：要在統計指標目錄加欄位，牽涉上游資料契約。
- **下一步**：在統計指標描述補中文名稱欄位（上游先動），卡片與圖例優先讀它，Agent 手填只作覆寫。
- **相關檔案**：`mcp/src/warehouse/cardPayload.ts`（`legendTitleFor`、`legendTitle`）、`mcp/src/research/server.ts`；指標目錄來源待定位。

## 8. 分析卡 v1 不支援的樣式與村里層級

- **現況**：v1 只支援縣市／鄉鎮的分區著色與立體柱、排名結果、點位（比例符號或無樣式）；compare、heatmap、grid、flow、bivariate、isochrone 與村里層級都回 `CARD_*` 錯誤。
- **為什麼延後**：每種樣式的 4:5 卡片版面與圖例要各自設計；村里面數量大，卡片摘要的大小上限（32 KB）與面形狀來源要另外處理。
- **下一步**：依使用頻率排序，先補 compare 與 isochrone（DECISIONS §4 已有 popup 規格）；村里另評估形狀引用方式。
- **相關檔案**：`mcp/src/warehouse/cardPayload.ts`（檔頭支援範圍、`CARD_VILLAGE_UNSUPPORTED`）、`mini/docs/features/viz-library/DECISIONS.md` §6、§6.1。

## 9. 立體柱預設高度偏尖

- **現況**：立體柱預設 `maxHeightM` 3000 公尺，最大值直接對應 3000 公尺高；格子小（例如 H3 細格）時柱子細而高，看起來像針。
- **為什麼延後**：要先決定高度該依什麼縮放（格子邊長、畫面範圍或縮放層級），不是單純改常數。
- **下一步**：用幾種格子大小截圖比較，定出依格子大小或結果範圍自動調整的規則，寫回規格檔。
- **相關檔案**：`mcp/src/warehouse/vizSpec.json`（`extrusion.maxHeightM`）、`mcp/src/warehouse/resultStyle.ts`（`EXTRUSION_DEFAULTS`）、`mini/src/research/contracts/viz-spec.json`、`mini/src/research/warehouseResultStyle.ts`。

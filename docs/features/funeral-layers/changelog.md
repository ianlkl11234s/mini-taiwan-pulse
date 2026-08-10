# Changelog — 殯葬 Funeral

> 逐 PR 變更紀錄。最新在上。

---

## 2026-08-06 — PR #110 `28df1a8`（rebase merge，直接進 master）

**上游 `is_active` 規則修正 → 同步靜態檔與所有寫死的數字。**

上游寫匯入腳本時發現 29 筆 `operator_uid` 撞號，追下去不是重複資料，是**同一家業者遷址的
新舊兩筆登記**（例：統編 45442023 天昕禮儀社，苗栗「遷他縣市」＋新竹「核准設立」）。
連帶揭露 `is_active` 漏判「遷他縣市」：那 26 筆舊登記被當成營業中，前端會在**舊縣市的舊地址
畫出幽靈點**，同一統編同時出現在新舊兩地，看起來像兩家在營業。

- `public/funeral/funeral_operators.geojson` 換新版：仍營業 4,595 → **4,569**、
  已失效 1,638 → **1,664**（「申覆（辯）期」4 筆維持 active，還沒確定廢止）
- 三個 label 改字：`已歇業` → **`已失效`** —— 這桶含 歇業／撤銷／解散／廢止／停業／遷他縣市
  六種狀態，遷他縣市是「遷走了」不是「收了」，講成歇業會誤導
- 同步 9 處寫死數字：`funeralTypes.ts`（label + 檔頭）、`types/index.ts`、`LegendPanel`、
  `layerCatalog`（labelMobile）、`funeralPanels`、`overlayRegistry`、`useTransportParams` ×2、
  `upstreamRegistry`
- `handoff.md` 觸發點表補一條「`is_active` 規則變動 → 同步改 UI label」——
  原表只想到「欄位/值變動」，沒想到**規則本身會變**
- **不受影響已驗證**：`funeral_operators_density.json`（source 是 `moi_7053`，與商工登記不同源）、
  設施與兩個墓區面檔皆 byte 相同

⚠️ 這類漂移**沒有測試會擋**：契約 ratchet 只守欄位型別與分類值，不守筆數，
label 寫錯畫面照樣正常。只能靠上游改規則時人工同步。

---

## 2026-08-05 — PR #107 `29a2664`（merge commit，保留 5 個分項 commit）

- 新增「殯葬 Funeral」主題群（第 37 主題，插在 宗教 Religion 與 觀光 Tourism 之間），5 層：
  `funeralFacilities` / `funeralOperators` / `funeralOperatorDensity` / `cemeteryOsm` / `cemeteryZoning`
- **A／B／C 三源分開不整合**（用戶拍板）：官方名冊點 / OSM 墓區面 / 都計法定用地面，
  各自獨立 toggle；圖例在 B+C 同開時說明「實際使用 vs 法定劃設」的差異
- `funeralFacilities`：`facility_type` 6 類分色 + 類型 select（7 選項，走原生 dropdown）
- `funeralOperators`：`entity_type` 2 類分色；**營業狀態預設「仍營業」**（idx 0），
  切「全部」才含 1,638 筆已歇業（2026-08-06 上游修正 is_active 後改為 4,569 / 1,664）
- **`precision` 誠實處理**：概略座標（`parcel_centroid` 1,576 + `approximate` 429，佔設施 42%）
  popup 加註「位置為概略值」+ 新增「定位精度」三態 filter（全部／僅精確定位／僅概略座標）
- `funeralOperatorDensity`：**無幾何**（5.1 KB 數值表換掉 48.9 MB 附幾何版），
  join `base_map/township_boundary.pmtiles` 走 `promoteId: TOWNCODE` + feature-state。
  通用 registry 路徑不支援 promoteId → 專屬 hook `useFuneralDensityLayer`
- `cemeteryOsm`：PMTiles fill+line；**ODbL 標示**在圖例與 popup 兩處
- `cemeteryZoning`：`zone_label` 9 種原始值歸 3 群分色；圖例註明「僅臺北 12＋新北 102 面，
  其他 20 縣市空白是正常的」
- 新 SSOT `src/data/funeralTypes.ts`；新 `src/data/funeralDensityLoader.ts`（含 loadingRegistry）；
  新 `src/components/featureInfo/funeralPanels.tsx`（5 panel）
- 部署：`nginx.conf` 加 `location /funeral/`、pull/upload 腳本加 funeral 前綴
  （5 檔 5.77MB 全進 git 走 dist，S3 前綴保留同構以備日後大檔）
- 測試 ratchet：`staticDataContract` 加 3 檔硬依賴欄位契約（含 `is_active` 的 boolean 型別）、
  `classificationCoverage` 加 `facility_type` / `zone_label` 分類覆蓋
- 端到端驗收（agent-browser localhost:3721）：5 層渲染、is_active 預設過濾、精度 filter、
  density feature-state join（69/71 有值，缺的 2 區確為 0 家）、4 種 popup、圖例 ODbL 全數通過

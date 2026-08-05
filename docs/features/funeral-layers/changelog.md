# Changelog — 殯葬 Funeral

> 逐 PR 變更紀錄。最新在上。

---

## 2026-08-05 — PR #（待補） `（待補 squash hash）`

- 新增「殯葬 Funeral」主題群（第 37 主題，插在 宗教 Religion 與 觀光 Tourism 之間），5 層：
  `funeralFacilities` / `funeralOperators` / `funeralOperatorDensity` / `cemeteryOsm` / `cemeteryZoning`
- **A／B／C 三源分開不整合**（用戶拍板）：官方名冊點 / OSM 墓區面 / 都計法定用地面，
  各自獨立 toggle；圖例在 B+C 同開時說明「實際使用 vs 法定劃設」的差異
- `funeralFacilities`：`facility_type` 6 類分色 + 類型 select（7 選項，走原生 dropdown）
- `funeralOperators`：`entity_type` 2 類分色；**營業狀態預設「仍營業」**（idx 0），
  切「全部」才含 1,638 筆已歇業
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

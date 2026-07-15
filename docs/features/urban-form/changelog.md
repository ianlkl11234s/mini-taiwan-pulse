# Changelog — 都市形態 Urban Form

> 逐 PR 變更紀錄。最新在上。

格式：
```
## YYYY-MM-DD — PR #NN <squash commit hash>
- <what changed>
- <why (optional)>
- <breaking? migration needed?>
```

---

## 2026-07-15 — PR #待開 `待 squash`（都市紋理網格）

- 新增 `urbanFormGrid` 圖層：全台 500m 都市紋理網格（145,119 格），合成建物量體統計與
  樹冠灰綠比為六指標 choropleth
- 六種顯示模式：棟數密度（OrRd）/ 平均高度（RdYlBu）/ 總量體（PuRd）/ 建蔽率（YlOrBr）/
  樹冠覆蓋（Greens）/ 灰綠指數（BrBG diverging，預設模式）
- `bld_count`/`avg_height`/`total_vol`/`built_pct` 四個建物衍生欄位 =0（無建物）的格用
  opacity 淡出，避免多數 cell（median 皆 0）蓋掉底圖
- 單一 `fill` sublayer，不設 `rebuildOnParamChange`（同 streetTreesTaipei3epoch 的
  paint-function 機制，setPaintProperty 直接 diff 套用新 step expression）
- 資料源：taipei-gis-analytics `docs/handoff/urban-form-grid.md`；CC BY-NC 4.0 雙署名
  （GlobalBuildingAtlas + Meta/WRI），圖例已掛
- Breaking：無（純新增）

## 2026-07-15 — PR #待開 `待 squash`

- 新增 `buildingsGba` 圖層：全台 3D 建物輪廓（GBA + OSM 融合，152 萬棟本島）
- 三種顯示模式：高度 6 級分級（fill）/ 資料來源二色（fill）/ 3D 立體（fill-extrusion，沿用高度色階）
- 高度門檻篩選 slider（≥ X 公尺，走 `filter` 而非 opacity 歸零，因 fill-extrusion-opacity 不支援 data-driven）
- 資料源：taipei-gis-analytics `docs/handoff/gba_canopy_frontend.md`；CC BY-NC 4.0，圖例已掛署名
- 架構調整：`OverlayLayerSpec.filter` 擴充為可函式化（供 rebuildOnParamChange 把即時 params 烤進 filter literal）
- Breaking：無（純新增；`overlayManager.ts` 的 filter 解析為向下相容擴充，既有 layer 行為不變，
  overlayManager.test.ts 18 項測試維持全綠）

## 2026-07-15（晚）zoom 範圍擴展 + 分區搬移
- 建物 PMTiles 上游重切 z13–16 → z8–16（z13+ 磚 MD5 不變；z8–12 tiny-polygon 合併紋理），檔案 139.8MB → 185.5MB
- overlayRegistry：pmtiles minzoom 13→8；extrusion sublayer 鎖 minzoom 13；3D 模式 z<13 fill zoom-step 平面後備
- 建物輪廓自「都市開放空間」移至「底圖 Base Map → 建成環境」（用戶回饋：靜態環境脈絡屬底圖性質）

## 2026-07-15（深夜）分類重組（用戶回饋：機能導向拆分）
- 解散「都市開放空間」大雜燴群組：公園 → 運動休閒（原「運動」改名，公園群組，未來健身器材進此）；
  都市紋理網格 → 新頂層「都市分析 Urban Analysis」（未來熱島效應、風廊等交叉分析進此）；
  餘 6 樹木層收斂為「都市樹木 Urban Trees」留環境氣候

## 2026-07-16 shipped
- PR #71 squash merge 進 master：`18d24c7`（7 commits：建物層/網格層/label/底圖搬移/z8 擴展/分類重組）
- S3 deploy-assets 上傳：buildings_3d_taiwan.pmtiles (185.5MB, z8-16) + urban_form_grid_500m.pmtiles (15.2MB)

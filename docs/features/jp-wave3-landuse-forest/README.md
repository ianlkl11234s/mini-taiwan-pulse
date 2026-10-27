# 日本第三波圖層（jp-wave3-landuse-forest）

> **狀態**：本機完成（2026-10-26，分支 `feat/jp-wave3-landuse-forest`，未 push、未開 PR）；S3 上傳待合併 develop。
> **上游契約**：`taipei-gis-analytics/docs/handoff/jp-wave3-landuse-forest.md`（欄位定義見同 repo `docs/data-catalog/world/<dataset_id>.md`；上游 PR analytics #226、#227）。

## 一句話說明

日本分頁新增 2 個靜態 PMTiles 面圖層：用途地域（102,244 面，13 類）、国有林（116,747 面，僅國有林）；預設 off。

## 圖層與 runtime 路徑

| layer key | 位置 | PMTiles | 供應 | 型別／色票 SSOT |
|---|---|---|---|---|
| `jpZoningUseDistricts`（用途地域） | 底圖 › 土地使用分區 Zoning（建成環境之後） | `public/world/jp_zoning_use_districts.pmtiles`，59,542,328 B，z8–14，SHA-256 前 12 碼 `3cab9ffe0c6e` | **S3 deploy-assets/world/**（gitignore） | `src/data/jpZoningUseDistrictTypes.ts` |
| `jpNationalForests`（国有林） | 林業 › 分區（樹冠高度之前） | `public/world/jp_national_forests.pmtiles`，107,681,111 B，z8–13（z14 起 overzoom），SHA-256 前 12 碼 `45d19fe32538` | **S3 deploy-assets/world/**（gitignore） | `src/data/jpNationalForestTypes.ts` |

- hook：`src/hooks/useJp{ZoningUseDistricts,NationalForests}Layer.ts`；host：`japanHosts.tsx`；popup：`japanPanels.tsx`；圖例：`legend/civicServiceLegends.tsx`。PMTiles URL 帶 `?v=<sha256 前 12 碼>`，上游重產同名檔時 hook 內的 `FILE` 要跟著改。兩層 minzoom 8。

## 樣式與控制項

- **用途地域**：配色沿用台灣 `urbanZoningTypes` 的錨定色（住居黃 `#f2c94c`、商業紅 `#eb5757`、工業紫 `#9b6dd6`、田園住居用台灣農業色 `#b5cc6a`），同系各類只依混白比例區分，不新增色相；面透明度走 `coverage` 階。控制項：透明度、「用途分類」（全部／住居系／商業系／工業系／13 類單選；tile 沒有 `youto_group`，大類用 `youto_code` 範圍篩選）。
- **国有林**：`function_type_en` 6 類沿用台灣保安林的語意色（水源涵養天藍、土砂褐、氣象害黃綠、自然維持綠、森林空間利用紫、快適環境粉），空白＝中性灰；面透明度走 `coverage` 階。控制項：透明度。
- popup 自掛出典，兩層已登記 `FOOTER_SELF_MANAGED_LAYER_TYPES`。保安林、保護林名稱 en／ja 介面仍顯示日文原名（官方用語）。

## 資料語意（必保留，圖例與 popup 都有寫）

- **用途地域**：「－」（該市町村無決定，169 個）不畫、不標未涵蓋；只有兵庫縣猪名川町、宮崎縣延岡市（非公開）未涵蓋；都市計畫區域外沒有面是正常的；容積率、建蔽率空值寫「未記載」不是 0；田園住居地域全國僅 1 面，圖例仍列滿 13 類；僅供參考、範圍概略、非最新、各市資料時點不同。
- **国有林**：僅國有林（約占全國森林三成），民有林不在內，空白處不代表沒有森林；每個面是合併分類面不是小班；保護林「非公表」者屬性空白，不等於不是保護林；JGD2000 轉 WGS84 未做地殼變動補正（東北可能差數公尺）。
- 出典：
  - 用途地域：出典：国土数値情報（都市計画決定情報）（国土交通省）を加工して作成（CC BY 4.0／PDL1.0）
  - 国有林：出典：林野庁「国有林GISデータ（2024（令和6）年度版）」（G空間情報センター）を加工して作成（公共データ利用規約 第1.0版）

## 供應與發版

兩個檔都 >25MB：已寫進 `.gitignore`（單一檔名）與 `scripts/deploy/upload-deploy-assets.sh` 的 world allowlist；**合併 develop 時上傳 S3 `deploy-assets/world/`**（已寫進 CHANGELOG）。

## 反向連結

analytics handoff：`taipei-gis-analytics/docs/handoff/jp-wave3-landuse-forest.md`。

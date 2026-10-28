# 日本第四波圖層（jp-wave4-welfare-roads-terrain）

> **狀態**：本機完成（2026-10-27，分支 `feat/jp-wave4`，未 push、未開 PR）；S3 上傳待合併 develop。
> **上游**：`taipei-gis-analytics` 分支 jp-wave4 的 `docs/data-catalog/world/{jp_welfare_facilities,jp_major_roads,jp_expressways}.md` 與 `pipelines/world/<id>/README.md`。地理院地形兩層是外部官方圖磚，沒有上游資料集。

## 一句話說明

日本分頁新增 6 個 manifest key：福祉兩層（共用一份 PMTiles）、主要道路、高速道路（線＋IC 點）、地理院陰影起伏圖與色別標高圖；全部預設 off。

## 圖層與 runtime 路徑

| layer key | 位置 | 資料 | 供應 | 型別／色票 SSOT |
|---|---|---|---|---|
| `jpWelfareDisability`（障礙福祉設施） | 社福長照 › 住宿照顧 | `public/world/jp_welfare_facilities.pmtiles`（56,944,133 B，z5–14，`?v=db5cbd38ce48`），filter `major=disability` | **S3 deploy-assets/world/**（gitignore） | `src/data/jpWelfareFacilityTypes.ts` |
| `jpWelfareChild`（兒童福祉設施） | 社福長照 › 長照與托育 | 同上，filter `major=child` | 同上 | 同上 |
| `jpMajorRoads`（主要道路） | 交通 › 路網 | `public/world/jp_major_roads.pmtiles`（141,914,253 B，z6–13，`?v=c5921aa49cee`） | **S3 deploy-assets/world/**（gitignore） | `src/data/jpRoadTypes.ts` |
| `jpExpressways`（高速道路） | 交通 › 路網 | `public/world/jp_expressways.pmtiles`（5,763,099 B，z5–13，`?v=b74bad90ddf0`；layer `jp_expressways` 線＋`jp_expressway_junctions` 點） | git-track | `src/data/jpRoadTypes.ts` |
| `jpGsiHillshade`（陰影起伏圖） | 底圖 › 地形 | `https://cyberjapandata.gsi.go.jp/xyz/hillshademap/{z}/{x}/{y}.png`，ZL2–16 | 外部直連 | `src/hooks/useJpGsiTerrainLayers.ts` |
| `jpGsiRelief`（色別標高圖） | 底圖 › 地形 | `https://cyberjapandata.gsi.go.jp/xyz/relief/{z}/{x}/{y}.png`，ZL5–15 | 外部直連 | 同上 |

- hook：`useJpWelfareFacilitiesLayer.ts`（一支 hook 依 key 呼叫兩次，共用 source、各自 circle＋heatmap）、`useJpMajorRoadsLayer.ts`、`useJpExpresswaysLayer.ts`、`useJpGsiTerrainLayers.ts`；host：`japanHosts.tsx`；popup：`japanPanels.tsx`；圖例：福祉在 `civicServiceLegends.tsx`、道路在 `transportLegends.tsx`、地形在 `urbanFormLegends.tsx`。
- 地理院 ZL 依 https://maps.gsi.go.jp/development/ichiran.html（2026-10-27 查）。raster 插在底圖第一個 symbol 圖層下，不蓋地名也不蓋 overlay。

## 樣式與控制項

- **福祉**：中分類多（兒童 16 類），依性質分 7 個色組（入所・養護紅、保育橙、發展支援紫、社區據點綠、助產・家庭支援・居住粉、服務事業所藍、其他灰），同組同色、圖例逐組列出所含中分類。點 M 階、R5 熱區（出點前）。控制項：熱區色盤、透明度、大小、「設施類別」（全部／類組／中分類單選）、「定位精度」（預設 1–3；全部含 4–5 代表點）。
- **主要道路**：高速綠／國道紅／都道府縣道橙，線寬依等級對應 L-1 強調／標準／細（資料編碼寬度），`line-sort-key` 高速 > 國道 > 縣道。有料**不另編碼樣式**（L-2 虛線不含此語意），只在 popup 與「只看有料道路」篩選。控制項：透明度、「道路分類」。
- **高速道路**：路線種別 5 色（＋其他灰），暫定供用同色混白 50%（不用虛線）；線寬 L-1 強調。IC／JCT 點 4 色，z9 起、M 階。控制項：透明度、「路線種別」（只篩線）。
- **地理院地形**：只有透明度（RASTER 0.7，0.3–1）；`popup: null`（已上色 PNG，無 feature），已登記 NO_POPUP_LEDGER 與 layerUxPolicy 基線。

## 資料語意（必保留，圖例與 popup 都有寫）

- **福祉**：自治體清單加工、可能非最新；某縣某中分類 0 筆＝自治體未提供或非公開，不等於沒有；位置正確度 4–5 是市町村／縣代表點（2,736 筆，同點堆疊），預設不畫；`license_note` 非空才在 popup 顯示；表中沒列條件的縣不代表明示可商用；個人保育者名稱在 tile 已遮蔽。出典：国土数値情報（福祉施設データ）（国土交通省）を加工して作成。
- **主要道路**：不含市町村道，不可算密度、可達性或里程；線段在 mesh／屬性邊界切斷；z6–8 只有國道與高速；與高速道路層重疊，擇一開。出典：国土数値情報（道路データ）（国土交通省）を加工して作成。
- **高速道路**：2025-12-31 現況；接合部種別沒有 SA/PA，`attached_to_sa_pa` 33 點不是完整清單；接合部所屬路線是空間推導；`lanes` null 寫「未記載」。出典：国土数値情報（高速道路時系列データ）（国土交通省）を加工して作成。
- **地理院**：出典「国土地理院」（連到一覧頁）；色別標高圖另附「海域部は海上保安庁海洋情報部の資料を使用して作成」（一覧頁對段彩陰影図要求，色別標高図條目也列此句，保守標示）；色別標高圖顏色非精確數值。

## 供應與發版

`jp_welfare_facilities`、`jp_major_roads` 已寫進 `.gitignore` 與 `scripts/deploy/upload-deploy-assets.sh` 的 world allowlist；**合併 develop 時上傳 S3 `deploy-assets/world/`**（已寫進 CHANGELOG）。`jp_expressways.pmtiles` git-track。

## 未決

- 主站 CSP 轉 enforcing 前，`img-src`／`connect-src` 要確認涵蓋 `cyberjapandata.gsi.go.jp`（目前 Report-Only 的 img-src 是 `https:`，不擋）。
- 有料道路是否要另外的視覺編碼（目前只在 popup／篩選）。
- 市町村道未收（全收粗估超過 1GB）：等 Zeabur 搬遷、大檔改放 R2 後再另開一層，見 BACKLOG `JPRD-1`。

# Changelog

## 2026-09-17 — 安全整合 PR #255

- 保留復原提交 `656e6cbe`、`0ddd5fdc`、`e08be17a`。
- 以 merge commit 整合 master `e58d4208`，保留日本醫療與珊瑚的平行變更；743 個 manifest keys。
- 正式 CDN readback 仍為 3,590 selectors，manifest SHA `d8aefb0375568a57126283e7fbd3901ee0c46cbb25c68af2c12647a14d35165a`。
- Production 預設不顯示未發布的 188 個比較指標；資料發布後以 `VITE_STATISTICS_COMPARISONS_ENABLED=true` 啟用。DEV 保留全部本地指標，教育 12 個視圖及原始統計在 production 保留。
- 本 PR 不上傳 CDN 或改寫 current.json。PR：https://github.com/ianlkl11234s/mini-taiwan-pulse/pull/255；merge SHA 以 GitHub PR 與本地同步 receipt 為準。

### 合併前驗證

- 最新 master 整合後：前端 1,426 passed／4 skipped；珊瑚後端 19 passed。
- Production build 通過（正式 CDN、比較開關 false），僅既有 chunk size 警告。
- Production browser：國小學生 22/22，醫院病床 159/368 PARTIAL；未發布比較選項未出現，console errors 0。
- 新證據：`evidence/pr-255/`；先前 DEV 全功能與手機證據仍在 recovery 目錄。

## 2026-09-17 — 正式環境啟用

- CDN 新 manifest `8e4511ef4627d6a511b8208e05ab6cd2787e2319df17252c749d01e0005f5efe` 已公開，244 新 selectors 與 256 次正式 loader 驗證通過。
- Docker build stage 明確接收 `VITE_STATISTICS_COMPARISONS_ENABLED`，預設仍為 false；正式服務設定為 true 後重新建置。
- 關閉時設定 false 並重建即可回復原始量顯示，CDN immutable 資料不需刪除。

## 2026-09-17 — 統計清單 UI 一致性

- 整合群組沿用共用滑動 toggle，取代文字開／關按鈕；桌面保留既有主題配色。
- 桌面與手機 sidebar 的圖層名稱保持主要文字色，不再依關閉狀態變灰或降低透明度；淺色主題仍使用對應文字色。
- 驗證：TypeScript、production build 與 git diff --check 通過；本地 browser 確認關閉的高中學生端與醫院病床文字均為 rgb(255, 255, 255)，群組 toggle 為 28×16 且保留 switch 狀態語意。
- 資料契約、選項、年份與 CDN 資料不變。

## 2026-09-17 — 統計主題 icon 與數值色階（PR #258 追加）

- 為統計清單建立集中視覺規則；學校／老師／學生、醫院／病床／醫事人力、住宅、交通、農林漁牧依內容選擇 icon，取代大量共用的 Recycle／Layers。
- 主題色用於 icon 與啟用列邊框，名稱仍使用主文字色；toggle 保留一致的顯示狀態語意。手機統計清單同樣使用 icon 與滑動 toggle。
- 地圖與圖例共用 statisticsRenderRecipe 的 ColorBrewer 順序色階（淺→深＝低→高）。教育增減採 PuOr，棕色負值、紫色非負值，0 為分界，並非好壞評分。
- 保留所有原始分級門檻、年份、來源、單位、零值、灰色缺值與斜線遮蔽。沒有修改資料包或 CDN，也沒有按當次資料自動重算分級。
- 犯罪統計仍使用獨立 renderer 的既有紅色順序色階；邊界參考層維持既有樣式。
- 方法來源：[ColorBrewer 色階類型](https://colorbrewer2.org/learnmore/schemes_full.html)、[Matplotlib 明度與色階](https://matplotlib.org/stable/users/explain/colors/colormaps.html)。明度與模擬色覺驗證不代表所有視覺障礙使用者皆能完全辨識；圖例數字與文字仍為必要提示。
- 驗收完成：1463 passed／4 skipped、build 通過；4 組色覺模擬檢查通過；桌面醫療與教育增減、手機住宅比例和統計全關通過。完整證據見 `evidence/ui-visuals-20260917/README.md`。

## 2026-09-17 — 統計維護規則與資料來源總覽（PR #258 追加）

- 新增 `docs/statistics-layer-guidelines.md`，由 development-rules 與 feature README 導引；整理統計語意、來源、分母、年份、geometry、缺值、icon、配色、toggle、手機、CDN 及驗收規則。
- 將資料來源總覽的同步補齊列為新增／整合／修改統計圖層的必要交付。
- 修正 feature README 仍稱比較功能未發布的歷史敘述，分開記錄 PR #256 發布與 PR #258 待合併的 UI 修改。
- 資料來源總覽搜尋／清單／總數遵守比較功能啟用 gate，保留其他圖層搜尋；同名指標顯示縣市／鄉鎮層級。
- 來源卡使用中文名稱與本地統計定義，即使 catalog 空白仍可閱讀；按需經既有 hash-validating loader 讀取已發布的 source、機關、授權、期間、安全連結、衍生公式與分子分母來源。固定學制入口明示為預設指標，不改變地圖 visibility。
- 驗收：1467 passed／4 skipped；真實 browser 確認公車比例分子分母與 SEGIS 來源、教育部來源、鄉鎮住宅比例同層級名稱，來源卡手機無水平溢出。

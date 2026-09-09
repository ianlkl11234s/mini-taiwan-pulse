# 統計圖層施工與交付

2026-09-06：統計 PR #219 已合併；已依使用者正式 DB／merge 授權套用 migration407、匯入並發布 8 指標／14 releases／1,346 values。152 missing 保留原值；anon catalog、逐版 values/sources/geometry RPC 回讀完成。會員整合版 PR #220；排程尚未啟用。

## 已完成

獨立 Statistics 入口沿用 Layers 大分組／小分組／圖層、toggle、展開與 All Off。icon 使用 Layers 加統計徽章。共用 recipe、store、loader、renderer 支援 8 個統計指標、14 版本，涵蓋縣市與鄉鎮市區；期別、來源、opacity、legend、popup 與缺值可呈現。深色文字與年份選單對比已修正。

犯罪圖層為既有獨立 PMTiles 路徑；已補齊 368 鄉鎮圖磚，zoom 5 起可用，完整重載後 zoom 6.8 可見填色。

首個交通 slice 為「航港局獎補助金額（受補助對象所在地）」（data.gov.tw 43445）：dataset `maritime_bureau_subsidy_county`、indicator `maritime_bureau_recipient_county_subsidy_twd`、county／TWD。預設由公開且可解析的 release 自動選最新期別與基金，不保留可被撤回的 opaque release ID；年／月／機關或基金選擇器只從公開 release 清單解析的實際組合產生，不會組出不存在的 dimensions。資料依受補助對象所在地彙總，絕非工程地、港口投資地或最終受益地；`PARTIAL` coverage、unallocated 金額與 missing 均會明示，missing 不等於 0。此 layer 需要 platform 408 的 `get_stat_health` 才呈現 coverage/reconciliation。

## 2026-09-07 transport delivery

本輪 33 個新增交通統計指標已完成 Pulse 登錄；本次範圍含臺北自行車 5 項（110 年、臺北 12 區 township）、A1 事故 3 項（114 年）、CAA 各機場所在地活動 3 項（115 年 7 月）與桃園機場所在地旅客活動 4 項（2022 年）。全部預設關閉；開啟後才載入，資料篩選 `<details>` 預設關閉，並與 source disclosure 獨立。

CAA `caa_airport_activity_county_33238` 使用 v4 三個 release suffix `152b35d71cab`／`f3d8707e7740`／`b53d2f849a96`；桃園 `taoyuan_airport_passengers_county_32997` 使用 v3 四個 suffix `98c10b4dc1a8`／`e978ed456827`／`93ef361ca2f6`／`3fea2b07f916`。數值、單位、期別與 coverage/reconciliation 維持 analytics manifest；計數為官方 CAA／TPE，落界使用已保存 mixed-source reference snapshot，逐筆點位上游未保存，不能表述為純官方點位。

### PR checklist

- [x] `npx tsc -b`
- [x] focused statistics／layer manifest／golden tests
- [x] release selector 僅接受 analytics manifest 的最新 immutable IDs 與 dimensions
- [x] 本地 browser：single/overlap、bus15/22、A1 21/22、mobile390×844自行車12區填色；filters/source獨立收合、opacity鍵盤操作。
- 完整正式站 acceptance 依跨 repo closeout，不以 unit tests 代替。
- [x] Production 資料：SQL 逐 release＋HTTPS dataset representative values/sources/health readback。
- 正式 frontend deployment／browser 最終證據見 [跨 repo closeout](https://github.com/ianlkl11234s/taipei-gis-analytics/blob/master/docs/topic-research/regional_statistics/transport-production-closeout-20260907.md)。

## 新增統計圖層

1. Analytics 依 long-term-plan.md 與 onboarding-template.md 確認來源、授權、期別、單位與行政區層級。
2. 沿用 regional_statistics bundle contract，新增來源 adapter，保留 raw receipt、checksum、processing、coverage 與缺值。
3. Platform 註冊 geometry 版本、匯入資料版本並逐筆回讀；再以 `scripts/statistics/export_r2_cdn.py` 產出完整 public snapshot，先 dry-run 驗 count，獲發布授權後才 `--upload`。
4. 前端新增 regionalStatisticsRecipes 與 layerManifest／layerParamsSpec，使用既有統計 UI 與 renderer；runtime 固定讀 R2 CDN，再跑測試與瀏覽器驗收。

正式與本機預設讀 `https://data.itsmigu.com/statistics/v1`；需要替代 origin 時設定 `VITE_STATISTICS_CDN_BASE`。前端沒有 Supabase fallback，CDN pointer／manifest／artifact 不完整時應顯示 ERROR，避免 CDN 事故放大成 DB 流量。publisher 會從既有 public resource 驗 SHA 後將 geometry 原 bytes 一併鏡像至 R2，前端也只讀版本根目錄內的 content-hashed geometry。DEV 農業 preview 仍須同時符合 DEV 與 `VITE_AGRI_STATISTICS_PREVIEW=true`，不進 production。

2026-09-10 已正式發布 `regional-statistics-cdn-v1`：66 indicators、476 releases、3,174 exact selectors、4 geometry manifests；current 指向 manifest SHA-256 `83e3c0635218f3d4c2a5b3dc4d8c9cb16f6e69831c47da64205e40b418aa6278`。公開 CDN 已回讀 current／manifest／代表 artifact／geometry 的 HTTP 200、CORS、bytes 與 SHA-256。Cloudflare `cache-static-assets` 只納入 `/statistics/v1/manifests/`、`artifacts/`、`geometries/` 三個 immutable 前綴，代表 artifact 與 45 MB township geometry 均實測由 MISS 轉 HIT；`current.json` 刻意維持 `max-age=60`／`DYNAMIC`，避免 immutable 規則把 pointer 凍結成長 TTL。

Analytics 文件：docs/topic-research/regional_statistics/long-term-plan.md、onboarding-template.md、commit-map.md。

## 版本與回滾

PR 保留 loader／UI／犯罪修正等原子提交；移除共用功能需先回滾其依賴。Git 不會撤回資料庫內容。正式排程、伺服器端分享期別與任意色階編輯仍待後續施工。

## 正式發布證據

[statistics-production.json](../../audit/foundation-2026-09-06/evidence/statistics-production.json) 記錄每個 release 回讀與 geometry SHA。先全部以 draft 匯入並驗 count，當時 public releases=0，再於交易內發布14版。私人 lineage 不開放給 anon。歷史期別保持原意，參考行政區幾何不能作歷史邊界或面積密度趨勢推論。排程尚未啟用；目前 refresh runner 只支援 waste，其他指標暫採人工檢查新版來源後不可變匯入。

## 2026-09-07 近期收整與新增資料入口

42 個統計指標的匿名 catalog 本次回讀為 HTTP 200／OK（這不是逐版 values 全驗收）。正式交通批次沿用上方 production closeout；不要引用 overnight 舊分支的「尚未套用 migration」覆蓋此狀態。

新增題目沿用同一條鏈：**analytics source adapter → immutable bundle/manifest → platform import/public contract → R2 immutable snapshot → Pulse recipe/既有 renderer**。一般新增來源不另建 API、另一套統計 panel、獨立 polling 或另一份行政區 geometry；只有單位、層級或資料契約確實不同時才擴充共用契約。

每份新資料需留下原始下載＋receipt、來源與授權、解析程式版本、觀測期別、單位／分母、行政區／boundary version、release ID、checksum、missing/suppressed/unallocated 與 coverage。不能把引用邊界當成歷史實際邊界，也不能把缺值補零。

S3 封存需包含 raw、processed bundle、manifest、geometry；依內容 hash 保存、驗讀後才標已備份。封存位置與 R2 runtime 供應路徑分開；前端只讀 R2 公開 snapshot 與 geometry resource。私人來源路徑不能進入 sources 或 artifact。2026-09-08 已完成 [核定範圍的 S3 封存與驗讀](../../audit/recent-delivery-2026-09-07/README.md)：日本／統計合計 731 個來源檔案、700 個去重資料物件。這是一次性封存證據，不代表未來新增來源已自動封存或已發布到 R2。

本批 loader 已共用經 SHA-256 校驗的 immutable geometry，避免疊多項指標時反覆下載和解析同一邊界；觀測值每次獨立 join，快取不共享指標數值。

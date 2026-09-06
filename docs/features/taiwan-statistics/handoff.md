# 統計圖層施工與交付

2026-09-06：統計 PR #219 已合併；已依使用者正式 DB／merge 授權套用 migration407、匯入並發布 8 指標／14 releases／1,346 values。152 missing 保留原值；anon catalog、逐版 values/sources/geometry RPC 回讀完成。會員整合版 PR #220；排程尚未啟用。

## 已完成

獨立 Statistics 入口沿用 Layers 大分組／小分組／圖層、toggle、展開與 All Off。icon 使用 Layers 加統計徽章。共用 recipe、store、loader、renderer 支援 8 個統計指標、14 版本，涵蓋縣市與鄉鎮市區；期別、來源、opacity、legend、popup 與缺值可呈現。深色文字與年份選單對比已修正。

犯罪圖層為既有獨立 PMTiles 路徑；已補齊 368 鄉鎮圖磚，zoom 5 起可用，完整重載後 zoom 6.8 可見填色。

首個交通 slice 為「航港局獎補助金額（受補助對象所在地）」（data.gov.tw 43445）：dataset `maritime_bureau_subsidy_county`、indicator `maritime_bureau_recipient_county_subsidy_twd`、county／TWD。預設由公開且可解析的 release 自動選最新期別與基金，不保留可被撤回的 opaque release ID；年／月／機關或基金選擇器只從公開 release 清單解析的實際組合產生，不會組出不存在的 dimensions。資料依受補助對象所在地彙總，絕非工程地、港口投資地或最終受益地；`PARTIAL` coverage、unallocated 金額與 missing 均會明示，missing 不等於 0。此 layer 需要 platform 408 的 `get_stat_health` 才呈現 coverage/reconciliation。

## 2026-09-07 transport release candidate（未發布）

本輪 33 個新增交通統計指標已完成 Pulse 登錄；本次範圍含臺北自行車 5 項（110 年、臺北 12 區 township）、A1 事故 3 項（114 年）、CAA 各機場所在地活動 3 項（115 年 7 月）與桃園機場所在地旅客活動 4 項（2022 年）。全部預設關閉；開啟後才載入，資料篩選 `<details>` 預設關閉，並與 source disclosure 獨立。

CAA `caa_airport_activity_county_33238` 使用 v4 三個 release suffix `152b35d71cab`／`f3d8707e7740`／`b53d2f849a96`；桃園 `taoyuan_airport_passengers_county_32997` 使用 v3 四個 suffix `98c10b4dc1a8`／`e978ed456827`／`93ef361ca2f6`／`3fea2b07f916`。數值、單位、期別與 coverage/reconciliation 維持 analytics manifest；計數為官方 CAA／TPE，落界使用已保存 mixed-source reference snapshot，逐筆點位上游未保存，不能表述為純官方點位。

### PR checklist

- [x] `npx tsc -b`
- [x] focused statistics／layer manifest／golden tests
- [x] release selector 僅接受 analytics manifest 的最新 immutable IDs 與 dimensions
- [ ] Browser：All Off 後逐層開啟、legend、popup、opacity、default-closed filters/source disclosure
- [ ] Production：RPC/readback、deploy 與 production browser evidence

## 新增統計圖層

1. Analytics 依 long-term-plan.md 與 onboarding-template.md 確認來源、授權、期別、單位與行政區層級。
2. 沿用 regional_statistics bundle contract，新增來源 adapter，保留 raw receipt、checksum、processing、coverage 與缺值。
3. Platform 註冊 geometry 版本、匯入資料版本並逐筆回讀；本機預覽與 production 分別驗收。
4. 前端新增 regionalStatisticsRecipes 與 layerManifest／layerParamsSpec，使用既有統計 UI 與 renderer，再跑測試與瀏覽器驗收。

本機 VITE_STATISTICS_API_URL=http://localhost:3735；未設定時預設 Supabase public RPC。正式環境使用 Supabase public RPC，不設定 local API override。public/statistics 的縣市與鄉鎮 geometry 已入版控；已比對正式站與固定 commit raw URL 的 SHA-256；DB manifest 使用固定 commit URL（22 縣市／368 鄉鎮），避免覆蓋已發布幾何版本。

Analytics 文件：docs/topic-research/regional_statistics/long-term-plan.md、onboarding-template.md、commit-map.md。

## 版本與回滾

PR 保留 loader／UI／犯罪修正等原子提交；移除共用功能需先回滾其依賴。Git 不會撤回資料庫內容。正式排程、伺服器端分享期別與任意色階編輯仍待後續施工。

## 正式發布證據

[statistics-production.json](../../audit/foundation-2026-09-06/evidence/statistics-production.json) 記錄每個 release 回讀與 geometry SHA。先全部以 draft 匯入並驗 count，當時 public releases=0，再於交易內發布14版。私人 lineage 不開放給 anon。歷史期別保持原意，參考行政區幾何不能作歷史邊界或面積密度趨勢推論。排程尚未啟用；目前 refresh runner 只支援 waste，其他指標暫採人工檢查新版來源後不可變匯入。

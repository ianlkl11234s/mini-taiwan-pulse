# Changelog

## 2026-09-15 本地接線（未提交、未發布）

- 教育11、醫療長照16、住宅18，共45個配方及416 exact selectors接入既有Statistics。
- 增量資料僅走opt-in DEV dataset路由，既有CDN與完整snapshot不變。
- values/sources/health共用完整selector；未知social release即使呼叫者允許fallback仍拒絕。
- 地圖與圖例共用固定分級；重複門檻保留最後可達顏色、去除空區間，不修改上游JSON。修復安寧床位與護理列示人力無法render。
- 社會統計tooltip使用配方中文名稱，保留null、0、原始-、PARTIAL與STALE。
- 桌面45層、手機三主題與特例驗收證據保存在evidence/。

## 後續授權：本地原子提交

- `d94149d5` 配方與色階工具。
- `3d393b7f` 完整接線與增量路由。
- 文件及原始驗收證據獨立提交；未push或發布。

## 正式發布完成

- analytics #88、platform #109/#110、frontend #248 皆一般 merge commit。
- 414 releases / 13,716 values 匯入；R2全量3590 selectors，既有3174不變。
- 1364 tests passed / 4 skipped、tsc/build通過；公開HTTP416與正式桌面45層、手機三主題驗收通過。
- 詳見 [production-release](./production-release.md)。

## 統計分頁分類修正

- Layers 改依 STATISTICS_DATA_THEMES 排除統計主題，修正只比對英文 Statistics 字尾而漏掉中文住宅、教育、醫療及農林漁牧主題的問題。
- Statistics 的住宅 18 層與全部統計 key 保留；一般行政邊界與犯罪圖層保留原入口。
- 5 項分類測試、TypeScript/build 通過。真實本地 browser：Layers 搜尋住宅總數無結果，Statistics 仍完整顯示住宅 18 層。
- 手機原本為單一合併目錄，沒有獨立 Statistics 分頁；本次修正桌面分頁分類。

## 醫院統計群組控制（2026-09-15）

- 醫院家數保留獨立入口；醫院病床收納全部、急性、加護、安寧；醫院人力收納醫事人員總計、西醫師、護理師。桌面與手機共用控制。
- 類型切換使用原始 key 與相同期別 exact selector，保留透明度，遵守單一／重疊模式；舊網址與搜尋保留。切換指標清除舊 popup。
- 本次為呈現收納，未新增人均、面積或可達性推算；既有縣市每萬人口指標維持獨立來源定義。
- 本地：1371 tests passed、4 skipped；TypeScript/build 通過。真實 browser 驗證 2024 加護病床年份／圖例／中山區100床 popup、2025西醫師，以及390×844手機護理師切換和群組關閉／重開；桌面 All Off 保留一般圖層。
- 發布狀態與 PR 於完成後補記。

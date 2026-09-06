# Changelog

## 2026-09-07 — transport statistics delivery

- 新增本輪 33 個交通統計指標的前端登錄；其中本次完成的四組為臺北自行車 5 項（township）、A1 事故 3 項、CAA 各機場所在地活動 3 項、桃園機場所在地旅客活動 4 項。每一層沿用 regional statistics runtime，含預設關閉 toggle、展開後才顯示的資料篩選、health／coverage／unallocated、legend、popup 與 opacity。
- 篩選選項只由各 dataset 的 immutable release 白名單及完整 dimensions 派生；不會拼湊不存在的 period 或 source field。臺北自行車保留 110 年臺北 12 區 township 層級，A1 僅指當場或 24 小時內死亡事故類別，桃園總計不與入境／出境／過境重加。
- `maritime_bureau_subsidy_county` 移除會被撤回的硬編碼預設 release ID；由公開、可解析的 release 自動選最新期別與基金，使用者手動選擇仍不會被 fallback 覆寫。
- CAA `v4` 與桃園機場 `v3` release 已改用 analytics manifest 的最新 suffix。統計值仍來自官方 CAA／TPE；機場落界使用已保存的 mixed-source reference snapshot，逐筆點位上游未保存，因此不聲稱點位為純官方。
- Production 資料已完成 immutable 匯入與 SQL／HTTPS anon readback；全 foundation 為 426 public releases，舊資料保留。客運維度修正為 source_field，避免 health 正常但 values 為空。
- 手機 bottom sheet 接入 StatisticsDetails，詳情按鈕具可存取名稱且不再被圖例遮擋；filters/source 預設獨立收合，coverage 區分縣市與鄉鎮市區。自行車 v5 引用 verified township_reference_20260626_v1，僅 code identity join。
- 正式部署與 browser 證據統一記於 [跨 repo production closeout](https://github.com/ianlkl11234s/taipei-gis-analytics/blob/master/docs/topic-research/regional_statistics/transport-production-closeout-20260907.md)，不能由資料庫完成推論前端已部署。

## 2026-09-06 — statistics foundation PR

新增獨立統計入口、共用面量圖流程、8 指標 14 版本本地接線；修正深色文字與犯罪圖磚 zoom 範圍。PR 尚待合併，遠端資料庫尚未套用。

## 2026-09-06 production foundation

- migration407、8指標／14版本／1346筆已正式發布，152 missing保留；anon逐版RPC與geometry雜湊回讀完成。
- 與會員PR220整合；統計搜尋可收藏。自動refresh排程與會員場景的統計期別同步未包含。

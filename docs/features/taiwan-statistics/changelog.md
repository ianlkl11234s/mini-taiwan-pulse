# Changelog

## 2026-09-07 — transport statistics release candidate（本地）

- 新增本輪 33 個交通統計指標的前端登錄；其中本次完成的四組為臺北自行車 5 項（township）、A1 事故 3 項、CAA 各機場所在地活動 3 項、桃園機場所在地旅客活動 4 項。每一層沿用 regional statistics runtime，含預設關閉 toggle、展開後才顯示的資料篩選、health／coverage／unallocated、legend、popup 與 opacity。
- 篩選選項只由各 dataset 的 immutable release 白名單及完整 dimensions 派生；不會拼湊不存在的 period 或 source field。臺北自行車保留 110 年臺北 12 區 township 層級，A1 僅指當場或 24 小時內死亡事故類別，桃園總計不與入境／出境／過境重加。
- `maritime_bureau_subsidy_county` 移除會被撤回的硬編碼預設 release ID；由公開、可解析的 release 自動選最新期別與基金，使用者手動選擇仍不會被 fallback 覆寫。
- CAA `v4` 與桃園機場 `v3` release 已改用 analytics manifest 的最新 suffix。統計值仍來自官方 CAA／TPE；機場落界使用已保存的 mixed-source reference snapshot，逐筆點位上游未保存，因此不聲稱點位為純官方。
- **尚未宣稱 live**：本地 TypeScript 與 focused tests 已通過；production RPC/readback、部署與 browser All Off 單層驗收仍待主 agent 完成。

## 2026-09-06 — statistics foundation PR

新增獨立統計入口、共用面量圖流程、8 指標 14 版本本地接線；修正深色文字與犯罪圖磚 zoom 範圍。PR 尚待合併，遠端資料庫尚未套用。

## 2026-09-06 production foundation

- migration407、8指標／14版本／1346筆已正式發布，152 missing保留；anon逐版RPC與geometry雜湊回讀完成。
- 與會員PR220整合；統計搜尋可收藏。自動refresh排程與會員場景的統計期別同步未包含。

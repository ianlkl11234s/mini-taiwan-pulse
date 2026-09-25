# 全圖層空間分析覆蓋：新 session 接手點

2026-09-25。先讀本頁，再讀 [P0–P7 施工計畫](./all-layer-spatial-coverage-execution-plan-20260925.md) 的當前片；需要逐層證據時才讀 [十層試跑](./ten-layer-spatial-trial-20260925.md)、[最新台帳](./analysis-coverage-20260925.json) 與 [原始 596 層名單](./unknown-layer-queue-20260925.csv)。歷史總計畫是 [plan.md](./plan.md)；不要把過夜 N0–N6 舊快照覆寫為現在成果。

## 目標與已接受決策

目標是使用者點一個位置後，Agent 可以對合法且有完整原表的 Point、Line、Polygon、格網和時序資料做有界空間分析，按類別回答並顯示在地圖上。按**共同原始資料家族**接入，不為 595 個圖層各寫一套 reader；地圖 PMTiles 不是完整分析原表。每層要能回答「可分析什麼／缺什麼」，不強求 778 層全變可做空間運算。保留來源、license/access、觀測與取得時間、缺值／抑制／零值、geometry role/precision、截斷與距離定義；權限或同版不明時 fail closed。

## 目前 repo 與完成證據

工作目錄：`/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/mini-taiwan-pulse/.worktrees/research-streamline/mini`；branch `codex/research-streamline-20260922`，本頁建立前 HEAD `c01064ad`，當時 `git status --short` 為空。原 checkout 有其他工作，禁止清理；MCP/Gateway 隔離 worktrees 位於同一 `research-streamline/` 下，使用前重新查狀態與 origin。

可重跑台帳現況：778 manifest layers、85 datasets、78 queryable layer mappings、105 個另外列的 metadata GeoJSON candidates、**595 unknown/unavailable**（594 缺 reader／descriptor、1 query disabled）。595 是 layer 數，不是獨立來源數。原本 596 中 `agriPOI` 已接成 839 個固定 SHA Point 的 reader；埔里 `[120.965,23.968]` 10 km 直線環域正常 Codex→MCP→Gateway→browser 查得 10 筆、`ready` revision 57、map readback 10 features／1 source／1 layer，目視可見。埔里另從**本機原表**算出南投縣界和一條林道，但兩者尚未經產品全鏈；勿稱三來源都已上線。

十層試跑的另九層是來源／阻礙診斷，未接成通用查詢。`agriPOI` 官方 177246 列 331、現有合併檔只有 330，缺一筆原因未查，不能稱原始三表完整。S3／Supabase 當前遠端版本與權限未實讀驗證。上片 focused tests 2/2、`npm run build`（含 `tsc -b`）通過；前夜完整 1,974 tests 是較早收據，非上片後回歸。近期 commits：`f6a6cad2` reader、`42354fd3` 十層報告／台帳、`f1ae05ef` 596 CSV、`c01064ad` P0–P7 計畫。沒有 push、PR、merge 或部署。

## 下一個明確動作

從 P0 開始：先查 git status、服務 3734/8794、正常配對 session/tool catalog；不重做已通過的 `agriPOI` 查詢。對 595 unknown 與 105 metadata candidates 歸併真正 source family，依本地 analytics manifest/catalog/processed 和必要的遠端 receipt 分辨來源可用性、同版、授權、幾何與主 blocker，更新**新日期**台帳，不覆寫 2026-09-25 快照。先交一批有證據的家族對帳及家族總數，再依計畫 P1 縣市界 Polygon、P2 林道 Line、P3 公司點分片、P4 多類別附近查詢；每片小範圍、獨立 oracle、新地點／變體、focused tests、tsc/build、正常 MCP→Gateway→browser ready/readback、原子 commit。若 source/權限/同版缺證據，標 HOLD 並移到下一個可做家族。

授權邊界沿用本 session：可在隔離 worktrees 做可逆本地施工、測試與原子 commit；保護原 checkout／配對，不清 storage、不重置他人工作，不擴大付費 provider 呼叫，不 push、PR、merge、部署。主 agent 決策整合；Terra/Luna 僅明確有界任務。舊的過夜 heartbeat 已於 08:00 暫停，不要因新 session 自行重啟排程。

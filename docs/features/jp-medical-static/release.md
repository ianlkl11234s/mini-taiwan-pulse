# 日本醫療第一批發布紀錄

2026-09-15：使用者已授權接上既有發布流程、上傳、正式網站驗收。本檔依實際證據更新；上線成功不能只由 build 推定。

## 範圍與基底

- 發布 worktree：`/private/tmp/pulse-jp-medical-release-20260915`，branch `feat/jp-medical-static-release`，基底 `0f86b926316e30663acc96e5c27088a2b630c912`。
- 原本地 worktree `/private/tmp/pulse-jp-medical-20260913`、原 checkout 及其平行修改保留。
- 資料版本 `d6f57fb991d7c714950fd6f334151ca9f4e6f27a887d2a0410e75b6b2223535a`。
- Exact allowlist 781 objects／1,640,390,952 bytes；Navii、H17、A38 only。無疫情、raw、private、代表人、後續年度／區域統計。
- Navii 206,043 來源列／189,800 可繪製／16,243 缺座標，2026-06-01；H17 222,615 來源列／222,194 可繪製服務登記／416 非空間／5 隔離，2026-07-09；A38 2020 歷史分割面，不能當即時資料或唯一圈數。

## 執行與驗收

| 層級 | 結果與證據 |
|---|---|
| 上傳前 S3 | current 不存在，`release/preflight.json` |
| 本地整合 | TypeScript PASS；160 test files，1,365 PASS／3 skipped；build PASS（既有 large chunk warning） |
| 發布保護測試 | Python 9 PASS：順序、失敗不動 current、immutable conflict、路徑拒絕、完整成功安裝、中途壞 SHA 保留 current；部署契約 19 PASS |
| 既有層保留 | Golden 494 原 entries 完全保留；加 3 medical → 497 |
| 本地 browser | 新整合 worktree 單層醫療／全國聚合／圖例／來源日期；桌機東京 z16 宮内庁病院按需 24 列 hours；桌機與 390×844 screenshot 見 release/；完整功能尺度先前矩陣見 acceptance.md |
| S3 | PASS：781／781，1,640,390,952 bytes，2026-09-15 07:43:51 UTC 完成；逐檔完整 GET 驗 SHA/bytes/content-type/cache，current 最後；receipt：`release/s3-publication-receipt.json` |
| Git PR／merge | PR [#247](https://github.com/ianlkl11234s/mini-taiwan-pulse/pull/247)，code commit `e4db9e45b350cea09217b756e0bce05e6ba8f097`；CI test PASS；待 S3 完成再合併 |
| Zeabur deployment | 尚待執行 |
| 正式 HTTP／browser | 尚待執行；發布前 curl 200／browser 可開啟；Python urllib 曾 403，不當作網站故障 |
| 本地 nginx runtime | 實際 nginx 設定 syntax PASS，獨立 port 3740 的 19 個 MIME/cache/SHA/Range 檢查 PASS，見 `release/local-nginx-http.json`；測完已停止 |
| 本地 Docker runtime | not run：Docker daemon 未啟動；正式容器行為另以網站驗收 |
| 實體手機 | not run；390×844 是 browser viewport，非實機 |

## 发布與回復

`publish-jp-medical-assets.py --root public/jp-medical --plan docs/features/jp-medical-static/payload-publication-plan.json --env-file .env --receipt <path>` 預設 dry-run；`--apply` 依使用者授權執行。immutable 檔完整成功後依序 catalog → manifest → current。不同的既有 current 要以讀回 hash 或 ETag 作 CAS 條件。

正常 GitHub Flow：feature PR → squash master → Zeabur。資料安裝由既有 pull 執行，不新增排程。回復以 revert 本次 feature commit 復原前端接線；既有 immutable 物件保留，不刪除／不原地改寫。如有上一版醫療，可受控 CAS 回復舊 pointer；本次初版沒有上一版醫療 pointer。

來源 analytics 已取得資料仍在獨立 worktree，沒有把整個研究分支合併；本次發布凍結的 allowlist 產物與前端。固定 catalog 內 LOCAL_READY_NOT_DEPLOYED 代表產製時狀態，receipt／deployment／HTTP 是發布證據。

# GFW freshness audit — 2026-09-18

## 結論

UI 中看到的 `821` 是 `2026-08-21` 的日期縮寫，不是 821 筆資料。
Production publisher 有每日於 08:30 Asia/Taipei 啟動，但 2026-08-27 之後的
schema-v3 發布大多因 production image 缺少 `tippecanoe` 與 `pmtiles`
executable 而失敗。因此資料並非正常持續更新。

## Read-only production evidence

| 項目 | 2026-09-18 結果 |
|---|---|
| Canonical root | HTTP 200；schema 2；release/latest complete `2026-08-20`；window `2026-08-14..20` |
| v3 shadow root | HTTP 200；schema 3；release/latest complete `2026-08-21`；window `2026-08-15..21`；`full_fidelity=true` |
| Formal v4 root | HTTP 404；尚未上線 |
| Publish health RPC | latest attempt `failed`；current successful release `2026-08-21`；root age 約 549 小時 |
| 2026-09-18 ledger | release candidate `2026-09-13`；failed；`tippecanoe and pmtiles executables are required for browser assets` |
| Legacy daily Presence | production collector flag 為 disabled；舊 snapshot 不再作為 freshness 來源 |

Ledger 存在一筆 2026-09-02 開始、仍標記 `running` 的歷史記錄；後續每日的
failed run 證明 scheduler 未停，但該孤兒狀態不能當作成功發布。

## Repair and UI boundary

- Collector hotfix: [gis-data-collectors PR #90](https://github.com/ianlkl11234s/gis-data-collectors/pull/90),
  ordinary merge commit `3518569e7af5d3992a58a451c81c66067543d96a`.
- Zeabur auto deployment `6aacbed40f50de6ff52c2be2` finished at
  `2026-09-18T04:38:09Z` with status `RUNNING` from that exact merge commit.
- Hotfix 只安裝 pinned Linux toolchain，並讓 browser-asset code 由 `PATH` 解析；
  不帶入未合併的 v4 實驗分支。
- 本次沒有手動重跑 publisher、改 schedule、改 credential 或改 root manifest。
- Pulse UI 一律顯示完整 `YYYY-MM-DD UTC`、距今日數與
  `DELAYED` / `STALE`；舊版 daily Presence 明確標為 historical。

## Remaining gate

Hotfix deployment `RUNNING` 只證明新 image 已啟動，不等於新 GFW release 已發布。
publisher 是固定時間 job，deployment 不會立即補跑。hotfix 在 2026-09-18 12:38
Asia/Taipei 才完成部署，因此第一個有效驗證時點是 2026-09-19 08:30 例行排程後。

2026-09-18 15:05 Asia/Taipei 再次 read-only 回讀：canonical 仍為 schema 2／
`2026-08-20`、v3 shadow 仍為 schema 3 full-fidelity／`2026-08-21`、v4 仍 HTTP 404；
這個結果符合「排程尚未執行」，不能判定 hotfix 成功或失敗。

排程後仍需 read-only 驗證：

1. ledger 新 run 是 `succeeded`；
2. v3 shadow root 的 full date 往前移動；
3. immutable assets 的 SHA/bytes/Range 回讀通過；
4. Pulse production 顯示同一個新日期，且不再標為 stale。

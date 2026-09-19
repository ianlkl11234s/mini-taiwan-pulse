# Collector live follow-up（2026-09-18）

唯讀 Zeabur `service-69a654b207e6de1869bf57b5` / `environment-69a654b28ca26dea02bdb5f7` exec；未讀 env/secret，未執行 archive/cleanup。

## Receipt

- 共享 `/data` filesystem：157G、125G used、25G available、84%；collector `/data` 目錄本身 `du -sh` 為 69G。兩者是不同量，不能把 filesystem 用量當此 collector 目錄用量；`du` 一級：bus 14G、GFW spool 12G、road_congestion 7.7G、CWA marine 6.7G、bus_intercity 4.8G、satellite 4.1G、global_events 4.0G、YouBike 4.0G。
- GFW spool：10 個 run directories，合計約 12G；日期/狀態目錄含 `work/ais/*.points.ndjson`、`work/sar/*.sar-unmatched.ndjson`、`hourly-grid.sqlite3`、`spool.json`。未見 verified archive receipt，不能安全刪除。
- CWA marine：`latest.json` 27M；`2026/` 約 6.7G，檔案日期摘要為 `2026/09/16` 95、`09/17` 96、`09/18` 66 個檔。只看到本地 raw，未取得 archive SHA/bytes/readback 證據，不能清理。
- runtime commit：此次 service exec 的 `/app` 非 git checkout，未取得 commit；不宣稱 deployed revision。

## GFW spool eligibility（只列狀態，不刪）

`spool.json` keys/values：2026-08-20 failed（run `cb91c8e2…`）、08-28 running（run `11d3ee46…`）、09-06 failed（`a6393f80…`）、09-07 failed（`854da5ae…`）、09-08 failed（`f67da90b…`）、09-09 failed（`47e8638c…`）、09-10 failed（`0061470e…`）、09-11 failed（`62742fc3…`）、09-12 failed（`e9561d25…`）、09-13 failed（`e80691f5…`）。這些是唯一 10 個 run；failed runs 僅有 error/failed_at/release_id/retention_days，running run 僅有 started_at/release_id/retention_days_after_failure，沒有 published/ledger reference key。

- **立即 eligible：0**。running 必須保留；failed 雖可依 `retention_days` 後進入候選，仍缺 exact ledger/manifest 對帳，不能在本次直接列可刪。
- **ineligible：10/10**，原因是未證明 release manifest／ledger 已完成且未被 current/rollback 引用。既有規則要求逐一列 manifest keys、不得 broad-prefix cleanup（`data-collectors/docs/GFW_HOURLY_FULL_FIDELITY.md:86-94`）；publisher 也以 `published_releases[].object_keys` 做精確清理（`scripts/gfw_hourly_release.py:726-780`）。

## 結論

舊報告的 68G 是 `/data` 目錄量；本次同一 service 目錄量為 69G，filesystem 則另為 125G used／25G free，不能混比。GFW 12G 目前 0 個可立即回收；CWA 6.7G 仍需 raw archive readback／保留契約後才能列候選。下一步只需逐 run ledger/manifest 對帳與明確 retention gate，不執行 broad cleanup。

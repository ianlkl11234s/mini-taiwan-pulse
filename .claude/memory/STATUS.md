# Status

**最後更新**：2026-09-20（Historical Flight Trails `20260919-v2` production 全鏈完成，可安全封存）

> 本檔只保留目前 touched scope、release truth、邊界與下一棒；歷史過程在 git、feature 文件與 `REFLECTIONS.md`。

## Scope ledger

| repo / system | current truth |
|---|---|
| **mini-taiwan-pulse** | Runtime/date release PR **#316** merged（`9b6e9d88`）；production evidence PR **#317** merged（`092caec4`）。本收尾由 PR **#318** 承載，分支 `docs/historical-flight-trails-v2-wrap-up`；主 checkout 的平行 dirty files 未碰。 |
| **plan-art** | 只讀來源 `dist/tracks/airports` 與 `public/airport-points.geojson`；沒有新的 FR24 抓取或付費 API 呼叫。 |
| **S3 deploy-assets** | `flight-trails/manifest.json` 指向 immutable `20260919-v2`；124 GeoJSON + manifest 共 125 objects／137,272,025 bytes，逐物件 readback 通過。 |
| **Zeabur** | Runtime deployment `6aae9e2f`（`9b6e9d88`）完成；docs/evidence deployment `6aaea179`（`092caec4`）為 `RUNNING`。 |
| **Production browser** | 台灣全部機場預設 02/20；02/20、02/24、02/18 都完成載入，3D 藍白航跡可見、無點 marker，console error／warning 為 0，最後恢復 02/20。 |

## Release truth matrix

| release unit | build | contract/wire | stage | upload | readback | pull | deploy | HTTP | browser |
|---|---|---|---|---|---|---|---|---|---|
| Historical Flight Trails `20260919-v2` | done：tsc、build、223 test files／1,690 tests + exporter 12 tests | done：manifest／loader／3D custom layer；PR#316 | done：129 selectors、124 partial assets、5 unavailable | done：124 immutable assets + pointer-last manifest | done：125 objects bytes／SHA／MIME／cache | done：release-first、manifest atomic replace | done：`6aae9e2f`；後續 docs deployment `6aaea179` RUNNING | done：manifest SHA `80e648b9…` + 桃園三日期／羽田02/18 | done：三日期、預設、3D、無點 marker、console 0/0 |

## Blockers / next-session entry

- **本 release 無 blocker，可安全封存。**
- 不阻擋封存的獨立後續：
  - 實體手機效能尚未驗收；桌面 production browser 不取代真機。
  - 來源 `license_status=unverified`；不得把已發布技術事實解讀成公開展示授權已確認。
  - 現有樣本皆為 `partial` 或 `unavailable`；恆春三日皆缺，02/18 另缺望安、蘭嶼。
  - AR-14/15 只剩 ship／bus 靜態成品包，與已完成的 flight slice 分開。
- 若未來重開本 feature：
  - repo／入口：`mini-taiwan-pulse/docs/features/historical-flight-trails/handoff.md`
  - 第一個步驟：先讀 production manifest 與 feature backlog，再確認需求是資料補抓、授權或真機效能。
  - 驗收：保留 source／render geometry、日期、coverage、missingness 與 S3→deploy→HTTP→browser 證據分格。

## Verification boundaries

- 台灣有 17 個 selector，不代表每個日期 17 場都有可繪資產：02/20 與 02/24 為 16/17，02/18 為 14/17。
- 日本 02/18 的 78/78 只指 `airport-points` 來源清單，不等於日本所有登記飛行場或逐航班完整。
- 同航班觀測缺口依使用者指定直接連線；球面細分是 render-only geometry，不是新增觀測點。
- 「不增加資料庫負擔」只指本 historical layer runtime：browser 讀同源靜態資產，沒有 Supabase／FR24 fallback；不代表整站不使用 Supabase。
- 舊 `20260918-v1` 保留為 immutable rollback release，沒有覆寫或刪除。

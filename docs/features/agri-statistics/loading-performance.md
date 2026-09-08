# Statistics 載入改善與正式資料落點

2026-09-08。本次只做本地效能修改／測試／browser 驗收，未 commit、push、merge、部署或上傳資料。工作分支 `codex/statistics-loading-performance-20260908`，基底 `30e48cfe`；與基準 `db7dc1c8` 的兩個 Statistics loader/cache 檔內容相同。

## 正式資料需要放哪裡

| 資料 | 既有正式落點／入口 | 本批尚需處理 |
|---|---|---|
| datasets、indicators | Supabase `reference.stat_datasets`、`reference.stat_indicators`；`gis-platform/scripts/statistics/import_bundle.py` | 僅匯入交付白名單 bundles |
| releases、lineage、發布事件 | `metadata.stat_releases`、`metadata.stat_lineage`、`metadata.stat_publication_events` | 校驗 immutable hash、發布後匿名 RPC readback |
| observations | `spatial.stat_values` | 維持 exact dimensions、缺值；不複製兩個既有圖層的資料 |
| boundary GeoJSON | 公開 S3/CDN URL；`scripts/statistics/register_geometry.py` 登記至 `spatial.stat_area_sets`／`spatial.stat_area_members` | URL 與 SHA 對齊，再由 `get_stat_geometry_manifest` 提供前端；未確認可直接使用的 bucket/prefix，不猜目的路徑 |
| 畜禽 sidecar | 需先補 platform importer/schema/public values 契約，或提供可透過 values 還原的 immutable provenance | 現有 importer 只接受 observation 五欄與四種 status，不能原樣承載 source_status/source_token；直接丟棄 sidecar 不符合交付 |

不需把 tar.gz 放進 frontend Git 或把本地 Python preview 上 production。現有 importer 的 `--apply`／`--publish` 是遠端寫入／發布步驟，本次未執行。此處根據本地程式碼確認承載位置，不將舊 foundation 文件視為目前整個 production 的部署狀態。

## 找到的瓶頸與本地修改

- 鄉鎮 boundary 51,289,454 bytes，縣市14,719,725 bytes。舊快取超過8 MiB單檔就淘汰，兩者都無法留住；相同 geometry 的 logical boundary aliases 也分開快取。
- `statisticsGeometryCache.ts` 改成64 MiB**總 raw-byte 預算**的 LRU；保留 pending entry 上限、SHA校驗、失敗淘汰與 caller abort。相同 resource/SHA/level/code/name mapping 共用解析後 geometry，呼叫者的 manifest/version 仍分開驗證與揭露。
- raw-byte 預算是資產大小的計帳方式，**不等於 JavaScript heap 上限**。解析後座標與 Mapbox worker 仍占記憶體；沒有宣稱實體手機容量已驗證。
- `regionalStatisticsLoader.ts` 將 catalog/releases 平行取用；release 驗證後 values、geometry、sources、health 平行載入。分頁仍依 offset 順序，所有證據都通過才回傳完整結果。不快取可撤回的 releases／values／health。

## 真實資料量測

以修改前 `db7dc1c8` 的 loader/cache 副本與修改後版本，對相同 localhost preview／bundles 執行 Node/Vitest probe。這是 loader 時間，**不含 Mapbox rendering**，也不代表 production 網路速度。

| 操作 | 修改前 | 修改後 |
|---|---:|---:|
| 首次水田 loader | 1,030 ms | 911 ms |
| 切旱田 loader | 706 ms | 88 ms |
| 回水田 loader | 704 ms | 32 ms |
| 三次操作 boundary 下載 | 3次／153,868,362 bytes | 1次／51,289,454 bytes |

原始逐請求資料見 [loading-performance.json](./evidence/loading-performance.json)，probe 原始碼見 [probe](./evidence/loading-performance-probe.ts.txt)。重現時從基準 commit 匯出兩檔為暫存 `statisticsPerfBaselineLoader.ts`／`statisticsPerfBaselineCache.ts`，將舊 loader 的 cache import 改指暫存檔，將 probe 放入 `src/data/__tests__` 並對 localhost 3743/3744 執行；完成刪除三個暫存檔。本次已清除，不加入一般 CI。

CUA實際畫面單次樣本（包括automation click/scroll/wait開銷）：水田首次到LOADING消失5.05→3.23秒；切旱田4.43→4.24秒。畫面仍需Mapbox處理大GeoJSON，不能把loader的88ms說成整個畫面88ms。後續大幅降低首次下載／渲染，應在上游產生可驗證的顯示用邊界（拓撲保留簡化或分片），保留原始geometry與版本，重新登記SHA；本次未自行改圖形或替換正式檔。

## 驗收

- `npm run build`（含tsc -b）通過。
- 完整Vitest：154 files，1,324 passed、3 skipped；包含平行請求、等待health、SHA錯誤、完整分頁、快取淘汰、abort與exact selector測試。
- 桌面水田／旱田地圖與tooltip；北斗鎮水田478.23公頃，統計11501與圖形1140318揭露保留。
- 國土利用→畜禽alias切换正確；鹿36 observed、113 suppressed、219 not_reported，STALE/PARTIAL。
- 手機390×844通霄鎮顯示suppressed／`*`與斜線，tooltip版本仍為`township_reference_20260626_v1`；clientWidth/scrollWidth皆390。這是viewport模擬，不是實體手機容量或FPS驗收。
- 本次範圍是Statistics共用載入路徑，尚未逐一量測其他即時GIS圖層。

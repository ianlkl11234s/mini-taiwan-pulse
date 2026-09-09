# Statistics 載入改善與正式資料落點

2026-09-08。載入改善已由 PR #233 合併並部署；正式資料與 source semantics 由 platform PR #102 發布，catalog 索引改善由 PR #103 套用。下方 localhost 前後量測保留為歷史基準。

正式 catalog 資料庫執行時間由 12,325.914 ms 降至 354.851 ms；匿名 HTTP 全流程單次樣本 1,097 ms。這不是整張地圖的渲染時間。索引前後 catalog 回應相同，803 個 release hashes 與 ACL 維持一致，見 [index-receipt.json](./evidence/index-receipt.json)。

## 正式資料需要放哪裡

| 資料 | 正式落點／結果 |
|---|---|
| datasets、indicators、releases、observations | 既有 Supabase Statistics tables；50 releases 已公開，exact dimensions 保留 |
| 畜禽 sidecar | importer 寫入 observation 的 source_status/source_token，values RPC 原樣回傳 |
| boundary GeoJSON | 既有部署資產 mirror 的 `/geo/` URL，manifest SHA 與匿名下載一致；未修改座標 |
| geometry 對應 | 新增必要 logical aliases；既有 county／township manifests 保留 |

2026-09-10 起，上表 Supabase 是發布來源而非 browser runtime。`gis-platform/scripts/statistics/export_r2_cdn.py` 從 read-only、anon 可見的同一 public contract 組出完整 R2 snapshot，並在不改 geometry bytes 的前提下驗原 SHA 後鏡像；前端只讀 `current.json`、content-hashed manifest/artifact/geometry。新增 Statistics 指標也必須走此路徑，無 Supabase fallback。

正式鄉鎮資產正規化後 45,242,401 bytes（未簡化座標），SHA 見 [geometry-upload.json](./evidence/geometry-upload.json)。不需將 tar.gz 加入 frontend Git；正式服務不依賴 Python preview。

## 找到的瓶頸與本地修改

- 鄉鎮 boundary 51,289,454 bytes，縣市14,719,725 bytes。舊快取超過8 MiB單檔就淘汰，兩者都無法留住；相同 geometry 的 logical boundary aliases 也分開快取。
- `statisticsGeometryCache.ts` 改成64 MiB**總 raw-byte 預算**的 LRU；保留 pending entry 上限、SHA校驗、失敗淘汰與 caller abort。相同 resource/SHA/level/code/name mapping 共用解析後 geometry，呼叫者的 manifest/version 仍分開驗證與揭露。
- raw-byte 預算是資產大小的計帳方式，**不等於 JavaScript heap 上限**。解析後座標與 Mapbox worker 仍占記憶體；沒有宣稱實體手機容量已驗證。
- `regionalStatisticsLoader.ts` 共用短 TTL manifest 與 content-hashed artifact；同 selector 的 store 載入也會去重。每個 artifact 必須含完整 observations，所有 values、source、health、geometry SHA 證據都通過才回傳，不會轉回 Supabase 分頁補讀。

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

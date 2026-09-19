> **Terra 執行指南：[terra-runbook.md](terra-runbook.md)**。下列快照是實際狀態；全國大量下載已依使用者要求停止。

> **2026-09-20 發布完成 checkpoint**：上游 analytics PR #100 與前端 PR #320 均已 ordinary merge；前端 merge commit `a15db13726fc4743472286662bdf8ef81ef13c50` 的 CI 與 Zeabur CD 成功。已用有界 publisher 將 catalog 實際引用的 38 個 content-addressed PMTiles（23,181,378 bytes）與最後切換的 catalog（28,655 bytes）寫入 runtime S3，合計 23,210,033 bytes／39 objects；每個 immutable object 均以完整 GET 重算 SHA/bytes 並驗證 content type/cache。正式站 catalog 回 200 JSON 且 SHA-256 為 `691006268a7de079eed3f607390dcb5c5f8bf71ab43abbd6cbc4d3cd84199a8b`；抽樣 immutable PMTiles 回 Range 206、127 bytes、正確 `PMTiles` header 與一年 immutable cache。production browser 已驗證名古屋 z15 單棟、z10 摘要 grid，以及東京樹冠取值。證據見 `release/20260920-s3-publication.json` 與 `release/20260920-production-acceptance.json`。原始 PLATEAU archives 是另一組已驗證的 S3 Deep Archive，不會由一般 browser 載入。全國擴展維持暫停，剩餘工作只留 backlog。

> **2026-09-19 本地前端安裝與 browser checkpoint（E 的小批驗證）**：`install-jp-height-national.py` 已改為自動發現標準 mesh manifest，只接受 `complete` + S3 `DEEP_ARCHIVE` + raw/GeoJSON 已刪除的分片；不調高 25 MiB/5 MiB/150 MB/2 MB 預算。本地 catalog 現有 16 區（5 個舊 ROI + 11 個標準 mesh）、38 個內容尋址 PMTiles，catalog 28,655 bytes，被 catalog 引用的資產合計 23,181,378 bytes（約 22.1 MiB）；無 raw/GeoJSON/observations 進入 runtime bundle。38 個 PMTiles 均重算 SHA 並通過 `pmtiles verify`。`public/jp-heights` 整體仍約 67 MB，因尚保留既有 legacy 路徑的重複檔；本輪未破壞性刪除這些未提交資產，也不把 67 MB 當成未來 CDN 必須上傳的 manifest 範圍。
>
> 遠景驗收曾發現舊 overview 只包 5 ROI，會讓新 mesh 在 z10 無內容。現已在 overview asset 明記 `regionIds`；runtime 僅對這 5 區以 overview 取代分區 grid，新 mesh 則同視野按需掛載自己的 grid。名古屋 z10 實際同時掛 overview + `mesh-23100-52366700` grid 且看得到摘要；z15 看得到單棟輪廓。京都、仙台 z15 亦分別掛載正確 mesh；移到無覆蓋海域 active source 回到0。全日本 z5 時建物 source 維持4個（overview + 3 mesh），其他8個未掛載分片在圖例明示要求放大，不把缺片當無建物。popup 已精簡保留高度、區域/mesh、來源年、高度方法、輪廓方法、授權與來源；高度缺值仍顯示 2D 未提供，不當 0。
>
> 驗證：installer pytest 3 passed；publisher unit tests 3 passed；frontend full suite 230 files passed／1 skipped、1,718 tests passed／8 skipped；`npx tsc -b` 與 `npm run build` passed；本地 HTTP catalog 200 JSON，PMTiles Range 206；browser 如上通過。前端 feature commit `8a9ee162` 已建立並 ordinary merge 最新 `origin/master`（`f9fde021`）；runtime S3 upload/readback、PR #320 ordinary merge、CD 與 production 驗收均已完成。

> **2026-09-19 大都會小批增量**：另完成名古屋 `52366700`（2022，1,748 棟）、京都 `52353680`（2025，2,634 棟）、仙台 `57403710`（2024，1,186 棟）三個市中心完整 mesh。新增 detail + grid 為 545,948 bytes，稽核 observations zstd 249,523 bytes；178,400,203 raw bytes 封存為 16,009,205 bytes S3 `DEEP_ARCHIVE`，逐物件驗證後已刪本機 raw/GeoJSON。6 個 PMTiles 均通過 `pmtiles verify`。全國建物 plan 現為 11 complete／37,993 pending。這些新 PMTiles 仍是本機上游成品，尚未上傳 runtime CDN、安裝分層 catalog 或做 browser 驗收。

> **2026-09-19 四國＋東京橫濱小批已完成（尚未安裝前端）**：新完成德島 `51340484`、高松 `51344013`、松山 `50326601`、高知 `50332472`、東京千代田 `53394630`，加上既有橫濱 `53391531`，共 6 個完整 mesh、13,446 個建物輪廓。近看 detail + 遠看 grid 共 1,329,794 bytes（約 1.27 MiB）；稽核 observation zstd 另 603,382 bytes，不必給一般 browser 載入。12 個 PMTiles 均通過 `pmtiles verify`，上游 focused pytest 51 passed。每區 raw 皆先上傳 S3 `DEEP_ARCHIVE`，核對 ContentLength、SHA metadata、S3 checksum 與 storage class 後才刪本機 raw/GeoJSON；6 區 490,826,948 raw bytes 封存後為 41,186,781 bytes。冷封存不是 CDN；這批尚未公開上傳、層級 catalog 接線、browser 驗收、部署或發布。計畫狀態為 8 complete／37,996 pending，不代表日本全國完成。詳見上游 `docs/handoff/jp-height-mesh-campaign.md`。

> **歷史 C checkpoint，已由上段取代**：2026-09-19 當時上游完成橫濱 `53391531`、松本 `54372787`、更別 `63437175`，合計 4,959 個輪廓；3 份 detail+grid PMTiles 合計 494,924 bytes。公開 detail 只留 `height`/`geometry_method`，`source_id` 留在稽核 observations；grid 只留中位數、P90、建物數、缺值數與格網尺寸。當時 raw 尚未封存；現已依上段 S3 回條門檻完成。

> **2026-09-18 本輪 A/B checkpoint（尚未全國完成）**：A 已修建物／樹冠 runner 的 resume、SHA、timeout、鎖、明確 retry、磁碟與進度狀態；上游 focused pytest 43 passed。B 僅處理兩個 overview shards：`overview-129-28`（resume，1,029 valid pixels，PMTiles 6,505 bytes）及 `overview-129-29`（新完成，145 valid pixels，PMTiles 4,327 bytes）。目前 overview 為 17 `complete`、1 `empty_checked`、108 `pending`；detail 5,026 `pending`。`overview-129-29` 曾因 sandbox DNS 失敗，精確記為 `failed` 後以 `--retry-shard` 成功重試，沒有當 EMPTY。磁碟只剩約 18 GiB（15 GiB reserve），停止開新 shard；C/D/E、installer、browser 與發布皆未執行。恢復前先讀本段及 upstream `docs/handoff/jp-height-national-canopy.md`，並重新檢查 `df -h`。

> **2026-09-18 使用者要求暫停、換模型。先讀本段；尚未完成全國覆蓋。**

## 全國擴展暫停接手點

- 永久 worktree：本 repo 與 `taipei-gis-analytics` 各自 `.worktrees/jp-height-layers-20260918`；branch `codex/jp-height-layers-20260918`。勿 reset/clean/stash。analytics PR #100、前端 PR #320、runtime S3、Zeabur CD 與 production 驗收均完成；後續全國擴展須重新授權才恢復。
- 全國大量下載仍停止；本輪驗收用 3747 預覽已關閉。恢復前另行確認是否還有舊 3746 preview，不要重複啟動同 port。
- 本地已安裝並驗證 5 個舊 ROI + 11 個標準 mesh，catalog 引用 38 個 PMTiles／23,181,378 bytes；仍只是部分 mesh，不代表城市全域或日本全國。
- 上游 `data/jp-heights/national/canopy-v2/jobplan.json`：最新已記錄 overview 17 complete、1 empty_checked、108 pending；detail 5,026 pending。尚未完成全國 canopy overview 合併與發布驗收。
- 全國建物清單 `data/jp-heights/national/building-mesh-plan.json`：303 城市、38,004 mesh；未回傳 02321/13421/21201。目前 11 complete／37,993 pending；清單本身仍只是 metadata inventory，不是已完成全國下載。
- 日本界線 `national/boundary/japan.geojson` 來自 geoBoundaries gbOpen / MLIT N03 2022，CC BY4；缺值、界線外及來源未覆蓋不得當0。

### 本輪未完成工作

上游 `pipelines/jp_heights/national_canopy.py` 已加原子 checkpoint、SHA、鎖、15 GiB 磁碟保留、20分鐘批次與程序群 timeout。`canopy.py` 支援日本 cutline / EMPTY。`merge_canopy_overview.py` 只做過語法檢查，尚未合併126片；先補 review（合併使用 height.tif 的完整性）再跑。

Terra 的 `national_mesh_buildings.py`、`tests/test_jp_mesh_campaign.py`、`docs/handoff/jp-height-mesh-campaign.md` 在執行中被中斷；先讀現檔與 git diff，核對 HEAD/大小/tile/timeout/resume 檢查與實際產物，勿假設三城市下載已完成。

前端新增 canopyOverview catalog、依視野掛載及只取樣 mounted source；最新 focused 3 files / 16 tests 通過，但本輪未跑完整 build/tsc/browser。installer 已可讀 overview manifest，尚未安裝新全國 overview。來源上限仍建物4、樹冠2、合計6；遠近互斥與離區 removeSource 必須保留。

### 換模型後下一步

1. 先核對兩 worktree 的 diff 與上述 jobplan；保留其他工作。
2. 檢閱未完成 mesh runner，跑 focused tests；全國 canopy executor 的修正亦需補驗證。
3. 使用上游 `/opt/homebrew/bin/python3 -m pipelines.jp_heights.national_canopy --help` 查現有 CLI，分批恢復 overview（每批最多2），磁碟低於15 GiB停止。不要一次下載全部原始 CityGML。
4. 126片皆 complete/empty_checked 才合併 overview、SHA/bytes/Range 驗證、安裝前端；再跑 build、東京→大阪→北海道移動與來源回收 browser 驗收。detail 與全國建物另依資源預算分批。

紀錄：`/tmp/jp-canopy-overview-campaign.log`；上游 `docs/handoff/jp-height-national-canopy.md`、`jp-height-mesh-campaign.md`；前端 `national-runtime-plan.md`。暫存 log 不是唯一進度來源，jobplan/manifest 才是恢復依據。

---

> 最新進度：見 [日本跨區第一批](national-expansion.md)。下文保留前階段紀錄；動態 catalog 與五區資料已取代固定東京 pilot 管理。

# 日本高度圖層交接

## 已實作與來源

前端永久 worktree：`mini-taiwan-pulse/.worktrees/jp-height-layers-20260918`。
上游永久 worktree：`taipei-gis-analytics/.worktrees/jp-height-layers-20260918`。

上游 SSOT（均在上述 analytics worktree）：

- `docs/handoff/jp-height-buildings.md`：PLATEAU CityGML 新宿区2025，resource metadata CC BY4.0。
- `docs/handoff/jp-height-canopy.md`：Meta/WRI CHMv2 2026，CC BY4.0。

| 圖層 | Artifact | 契約 |
|---|---|---|
| jpBuildingHeight | jp-heights/buildings.pmtiles | vector `buildings`，z12–16，LOD0 RoofEdge polygon/multipolygon，height:number/null、source/source_year/height_method/source_id |
| jpCanopyHeight | jp-heights/canopy.pmtiles | PNG 512px，z9–12，RGBA 公尺值；R=G=B=height，A nodata mask |

建物 13,629 個輪廓；13,222 有高度，407 缺值。屋頂輪廓保留中庭孔洞與跨 ROI 建物的完整 geometry；不可當作嚴格切齊 ROI 的地面 footprint。高度不是海拔；來源年份不是即時建成現況。

Canopy bbox [139.55,35.60,139.90,35.85]，1,205,456 有效像素；值域1–31m。原始來源四塊經降採樣聚合至19.109m projected pixel，來源0依契約視為nodata，非0m森林。

## 本地重現

1. 在上游執行 buildings.py（`--bbox 139.69 35.68 139.72 35.70 --city-code 13104`）與 canopy.py（`--bbox 139.55 35.60 139.90 35.85`）。詳細依賴與 offline rebuild 見上游 handoff。
2. 在前端執行：

```sh
python3 scripts/preprocess/install-jp-height-local.py '/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/taipei-gis-analytics/.worktrees/jp-height-layers-20260918/data/jp-heights'
npm run dev -- --host 127.0.0.1 --port 3746 --strictPort
```

3. 開 [新宿建物](http://127.0.0.1:3746/?v=1&lng=139.703&lat=35.691&z=15&layers=jpBuildingHeight&sm=single&style=dark) 或 [東京樹冠](http://127.0.0.1:3746/?v=1&lng=139.705&lat=35.687&z=14&layers=jpCanopyHeight&sm=single&style=dark)。日本→高度與地表，點圖層名稱展開 opacity／2D–3D 控制。
4. 日本 rail 的既有行為會 flyTo 全國；單棟建物要 z13+（z4–12為摘要網格），樹冠 z9+，使用以上深連結直接定位。

## 發布與擴展計畫

- 本地 DEV 才列出兩層；PROD 暫以既有 localResearchGroup 隱藏，避免資產未發布先出現空 toggle。
- `.gitignore` 排除 payload，Vite strip 避免打包進 app；nginx `/jp-heights/` 從 `/data` 供應，缺檔404。
- upload/pull 腳本已接六個 exact filenames，但本次未執行上傳／同步／部署。發布前須先核对 manifest SHA/bytes、安裝圖磚與 HTTP206，再解除 PROD gate，完成 production browser 驗收。
- 全日本：PLATEAU 依城市／年度／來源分批，CHMv2 依 bbox/quadkey 分片；先建立 coverage catalog 與 immutable version paths，再讓前端依可見區域挑檔。缺覆蓋不等於零建物／零樹冠。完整全國資料尚未生成。
- GBA 作為其他城市備选需獨立考量 CC BY-NC/ODbL，不與 PLATEAU 混成一套無差別高度。

未 commit/push/PR/merge/deploy；工作樹保留本次修改與本地成果。


## 2026-09-18 多尺度與資源管理

計畫見 [resource-plan](resource-plan.md)。新增 upstream `docs/handoff/jp-height-grid.md` 與 `pipelines/jp_heights/grid.py`：真實既有 ROI 離線產生 10km/1km/250m，對應 z4–7/8–10/11–12，z13+ 回個別輪廓。摘要使用 `height_median` 上色，popup 提供 P90/count/missing；同一 layer toggle。

Grid source-layer=`building_grid`，檔案 `building_grid.pmtiles` 和 `building-grid-manifest.json`；10,398 bytes，最大壓縮 tile 2,871 bytes；SHA `11371f83d16f8ebb649a8f494705f8e9b1d45ade053dc4ad0f68aa31c3c632d8`。三尺度各自 13,629 輪廓；2/12/113 cells。

主站 JP source 按縮放、toggle 與有資料範圍掛載，離區先刪 layer 再 removeSource；moveend 合併等待200ms。建物網格與詳細互斥，單一東京分片搭配樹冠最多2個活躍來源。此版本是固定 pilot registry，尚非全國動態 catalog；擴充城市前必須保留有界選取規則，不能直接把所有城市加進 registry。

安裝工具在讀取payload前檢查每檔大小：building/canopy ≤25MB，grid ≤5MB，grid壓縮tile≤512KB；checksum通過才複製。這是本地供應鏈預算，不是瀏覽器RAM保證。PMTiles按Range取磚；HTTP cache和引擎回收時機由瀏覽器管理。全日本最大密度、長時間heap/GPU、手機實機仍待後續壓測。

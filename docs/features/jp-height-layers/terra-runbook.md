# Terra 接手：日本高度全國擴展

狀態：2026-09-18 A 已完成、B 已留下低磁碟 checkpoint；這份文件只交接，不代表可無界重啟下載。下一位模型先讀本文件及 handoff.md 頂端快照；後者下半部為歷史紀錄，不能拿東京 pilot 設定覆蓋目前五區 catalog。

本輪實際證據：上游 focused pytest 43 passed；`overview-129-28`（resume）和 `overview-129-29`（新產物）已驗證。overview 狀態為 17 complete／1 empty_checked／108 pending；detail 5,026 pending。兩 shard 有效像素增量 1,174、PMTiles 10,832 bytes、intermediate rasters 2,138 bytes。磁碟約 18 GiB，距 15 GiB reserve 僅約 3 GiB，停止後續 B 批次；C、D、E 仍受「B overview 全數 complete/empty_checked」及儲存預算阻擋。`overview-129-29` 的 DNS failed evidence 保留在 jobplan，後來以精確 `--retry-shard` 成功；不可重建整份 plan 掩蓋它。

## 目標與完成定義

在永久 worktree 延續 JP 建物高度及樹冠高度：近看輪廓、遠看有明確解析度的摘要，移動不累積來源。全國指「全日本可取得且授權明確的來源範圍」，不保證每處皆有高度。PLATEAU 未提供、API 未回傳、處理失敗與來源 nodata 分開記錄。不得以建物樓層推算高度補空值，也不得把 FootPrint 說成 RoofEdge。

完成分階段回報：A runner 可安全重跑；B 全國 canopy overview；C 建物三城市小批驗證；D 有界全國建物與 detail campaign；E 安裝與瀏覽器驗收。B 完成不代表 D 完成。遇到資源上限留下可續接 checkpoint，報告剩餘量，不宣稱全國完成。

## 工作位置與授權

```sh
export JP_F='/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/mini-taiwan-pulse/.worktrees/jp-height-layers-20260918'
export JP_U='/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/taipei-gis-analytics/.worktrees/jp-height-layers-20260918'
git -C "$JP_F" status --short
git -C "$JP_U" status --short
git -C "$JP_F" branch --show-current
git -C "$JP_U" branch --show-current
df -h "$JP_U"
```

兩者預期分支 codex/jp-height-layers-20260918。先讀各 repo 的 AGENTS.md / CLAUDE.md；前端接線按 layer-onboarding 驗收。勿新建另一套 worktree、reset、clean、stash 或改動原 checkout。所有先前工作未提交，不能把未知 dirty 檔視為自己所有。沿用本地開發授權；commit/push/發布/上傳/排程沒有本次授權。不要讀 .env 值。preview 3746 保留，勿啟動第二個相同 port。

## 固定預算（不得直接調高來通過）

| 範圍 | 上限 / 行為 |
| --- | --- |
| 磁碟 | 每批前及處理中保留至少15 GiB；不足停止新工作 |
| canopy | 每次最多2 shards、批次20分鐘；先 overview 再 detail |
| building | 每次最多3 meshes；先選3個不同非 pilot 城市各1片 |
| 原始 GML | 每mesh 250 MiB；HEAD 缺長度仍須串流 byte cap |
| 輸出 | detail/canopy 每檔25 MiB、grid5 MiB、壓縮tile512 KiB |
| 前端 | 同時最多4 building/grid +2 canopy，總6；probe cache最多2 |
| catalog | 目前5000 regions /2MB；installer目前整批150MB |

本機不能假設能放全國最終產物。小批實測每片 retained bytes、峰值磁碟與時間，乘以剩餘數並清楚標為估計；超出可用磁碟時停止擴批，先提出持久儲存方案。只清理 runner 自己的可重建暫存，保留已驗證成果及 receipts。不要直接把38,004 meshes或5,026 canopy detail塞進 root catalog。

## A：先修 runner，不能直接大量跑

上游檔案：pipelines/jp_heights/{national_mesh_buildings,national_canopy,canopy,merge_canopy_overview}.py。現有測試在 tests/test_jp_*.py。

2026-09-18 重新閱讀現檔確認的 mesh runner 缺口：

- run() 遇 checkpoint complete 直接回傳，未檢驗 PMTiles bytes/SHA、receipt、observations。補驗證；缺檔或遭改寫不得跳過。
- selected() 只讀 plan pending，但成功未同步 plan，容易每次選回同批；建立單一可恢復狀態來源，包含 running/failed/hold/complete。重跑能選到下一批，failed 要明確重試，HOLD 不自動繞過。
- shutil.disk_usage(OUT) 前尚未保證 OUT 存在，首次執行要可用。
- 尚無整批20分鐘 deadline、子程序群取消清理與鎖；採 canopy runner 的方向並補 SIGTERM/KeyboardInterrupt 清理，避免停止父程序仍下載。
- 尚無 HEAD 預檢與512 KiB tile檢驗。HEAD只是估算，串流上限才是防護；輸出先暫存、驗證後原子完成 checkpoint。
- counts 目前只有輸出 features / valid heights。另記來源 Building 數、無可用 geometry 數、缺高度數、重複與無 source_id 數。缺 ID 不得全部以 None 去重；保留不確定性與 mesh/來源鍵。
- valid_license() 現在是字串包含判斷，確認實際 metadata 的授權欄位/網址，未知或混合授權維持 HOLD。

Canopy runner 已有 SHA/鎖/timeout，但仍需測試：中斷 running 可恢復、SHA錯誤拒絕、EMPTY不當0、timeout清子程序、磁碟不足不開始。failed 不會被 execute 自動選取；檢查錯因後只重設特定失敗 shard，不能重建整份進度掩蓋錯誤。merge 使用 height.tif，而目前驗證以 PMTiles 為主：補中間 raster SHA 或從可驗證產物重建。canopy EMPTY resume 的來源 index SHA 亦須一致。

必測反例：完成標記但檔案損毀、首次空目錄、跑第二批不重複第一批、超長度/無 Content-Length、子程序 timeout、缺 geometry/ID、高度 null、授權未知。用小 fixture/mocked network；不可把 mock 通過說成實際下載驗收。

```sh
cd "$JP_U"
/opt/homebrew/bin/python3 -m pytest tests/test_jp_mesh_campaign.py tests/test_jp_national_canopy.py tests/test_jp_height_canopy.py tests/test_jp_height_buildings.py tests/test_jp_height_grid.py -q
```

若缺 pytest，先檢查 repo 既有環境，勿全域升級套件。上次 canopy 4個 unittest、mesh2個 pytest僅為舊版局部證據，不涵蓋上述缺口。

## B：恢復 overview（A過關且使用者已要求繼續後）

快照：126片中15 complete、1 empty_checked、1 running、109 pending；detail5026皆pending。以實際 jobplan 為準。running=overview-129-28 是中斷標記，需驗證恢復。

```sh
cd "$JP_U"
/opt/homebrew/bin/python3 -m pipelines.jp_heights.national_canopy --run --level overview --max-shards 2
```

每批讀 jobplan，彙總 complete/empty_checked/failed/running/pending、新增有效覆蓋、disk free；有失敗先處理，勿開無界 shell loop。126片都 complete/empty_checked，且 checksum/來源/界線一致後才合併：

```sh
/opt/homebrew/bin/python3 -m pipelines.jp_heights.merge_canopy_overview
```

合併程式只做過語法檢查，先完成 A 的 raster 完整性修正。overview 約1222.99m projected pixels；detail約19.109m；CHMv2 release2026不是觀測日期。overview有效像素平均不是最高樹高；圖例、popup必須顯示解析度和估算語意。

## C、D：建物與 detail 擴展

先从 building-mesh-plan.json 選三個不同非 pilot 城市，每城一mesh，確認 metadata license 後使用：

```sh
cd "$JP_U"
# 將 CITY_CODE 換成 plan 裡實際選定的 city_code
/opt/homebrew/bin/python3 -m pipelines.jp_heights.national_mesh_buildings --city-code CITY_CODE --max-meshes 1
# dry selection 正確且 A 已過關，才執行
/opt/homebrew/bin/python3 -m pipelines.jp_heights.national_mesh_buildings --city-code CITY_CODE --max-meshes 1 --run
```

原始1.49TB是完整CityGML各類物件套件，不能當 building-only bytes。現有清單303cities/38004meshes，02321、13421、21201未回傳，保留 pending investigation。不要重新研究所有來源；先讀上游 national-source-options / mesh-campaign 文件與現有 metadata cache。

每片存來源 URL/年份/授權、實際geometry方法、height方法、bytes/SHA、bbox、counts與可供彙總的 observation。對跨mesh ID去重需帶來源版本/城市範圍；中位數/P90不能取各mesh中位數平均，必須從去重 observation 重新計算。遠景網格是顯示摘要，不宣稱分析用人口或建物密度。

優化順序：先可靠resume和有界下載，再精簡重複metadata及geometry，最後空間分組PMTiles與分層index。保留現有 height/source_id/必要feature geometry差異，共用授權/年份放catalog，不能刪光來源追溯。全國 root→regional index 是待實作，不是現成能力；詳見 national-runtime-plan.md。維持5000/2MB防護，超過時先做分層index的驗證/abort/LRU，勿放寬上限。

## E：安裝與驗收

installer 目前只支援固定五區，加可選單一 canopyOverview；不是全國mesh installer。先擴充manifest驅動與分層catalog，維持每檔/每tile防護。現有 overview 安裝入口：

```sh
cd "$JP_F"
python3 scripts/preprocess/install-jp-height-national.py --analytics-root "$JP_U"
npx vitest run src/data/__tests__/jpHeightCatalog.test.ts src/data/__tests__/jpHeightTypes.test.ts src/data/__tests__/jpHeightFeatureMetadata.test.ts src/data/__tests__/jpCanopyProbeBounds.test.ts src/map/__tests__/jpHeightLifecycle.test.ts src/hooks/__tests__/useMapInteraction.test.ts src/components/sidebar/__tests__/layerConsistency.test.ts --silent
npx tsc -b
npm run build
```

檢查 installer 實際參數/輸入與新契約一致才跑，先保存原catalog作可復原備份。不可在缺新asset時宣告來源完成；先寫不可變assets/index，最後原子換root catalog。HTTP實際Range需206且bytes正確，200不能代替。

Browser 驗收：東京→大阪→北海道→福岡→那霸反覆移動至少3輪；記錄每站active source、loading結束、請求bytes與錯誤。z4/8/12/12.5/13/15各看遠近切換，尤其Mapbox PMTiles roundZoom的12.5邊界；切style、快速移動、全部關閉後JP source應0且loading清空。超過4/2片必須有完整parent或可讀的需縮小視野提示，不能靜默缺片。coarse/detail未同時mounted時probe只讀當下mounted source；detail邊界空白不可偷偷回傳未顯示overview值。

source cap不是記憶體保證。若可取得heap/GPU/network，記錄移動三輪後是否持续累積；缺工具就標未驗證，不編數字。需另做手機實機；桌面測試不得宣称手機安全。測試/產物SHA/HTTP/browser/production分欄回報，production本次未授權。

## 分工與停止方式

Terra可以順序完成，不必為分流而分流。若委派：Luna只盤點特定manifest/metadata；Terra worker只改明確指定的 upstream或frontend文件；同檔不可平行改，worker不得再委派。主模型整合契約與驗收，不讓worker自行調高budget。

使用者要求暫停：停止派工、鎖定本次PID/PGID、終止自有子程序群、確認沒有殘留下載；勿廣泛pkill或關Vite。先前人工暫停留下running狀態是可恢復證據。每個里程碑更新 handoff.md 頂端：完成數/有效覆蓋增量、產物bytes、已跑測試、未過關項、下一條指令。不得僅說「全國支援完成」。

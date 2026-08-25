# Backlog

## GFW trajectory POC

- [x] 對 bbox `122.43400, 23.22953, 132.85274, 34.35812` 完成 `2026-08-15..21` 的 `HOURLY` / `HIGH` probe；16/16 tiles、1,426,361 rows、57,726 vessels、2 duplicates、0 invalid。
- [x] 完成 local-only browser POC：依船分組、切斷 >2h gap / >80kt 跳點，popup/legend 明示格網化近似路徑，且未與 AISStream 跨約 96 小時 gap 連線。
- [x] 確認 `GFW_ACCESS_TOKEN` 只在 backend 環境取用；frontend/artifact credential scan 無 token，GeoJSON gitignored 且 production build 移除；raw archive 維持 disabled。
- [x] 已補 API probe、browser 畫面／popup／console 與本機狀態證據；仍未寫 production DB、未部署。
- [x] exporter schema v2 補 `observed_times` 一對一時間契約；主站新增 `gfwHourlyTracks`，支援全域時間軸、0.5/1/2/3h 短拖尾、Ships 六類分色、segment 內線性內插 endpoint、最新完整 UTC 日通知、popup/legend/loading 與 fail-closed parser。
- [x] 航跡載入改為 root manifest → selected UTC daily partition；每次重開層 refresh manifest，daily 以 release+date cache，失敗不負向 cache，快速跨日以 request generation 防 stale response，超出 days 時 fail closed 清空。
- [x] 航跡動畫改為 100ms timeline tick；只在同 segment 相鄰觀測內線性內插 endpoint 與拖尾起點，runtime properties 明示 `selected_time` / `interpolated`。
- [x] 重新產生 schema v2 本機 artifact；frontend parser 實測讀取 989 tracks，2026-08-21 23:00 UTC／12h frame 得到 727 lines、645 exact-observation endpoints。
- [x] 完成主站 browser 的 300x 非整點播放、線性內插 endpoint popup 與 console 驗收；00:32 顯示 `interpolated=1` 語意且無 error/warning。
- [x] Production frontend 改讀同域 unified v2 root，tracks 單 UTC 日、grid/dark exact UTC hour lazy-load；快速拖曳不會被 stale response 覆蓋，失敗檔不做負向 cache。
- [x] S3/frontend volume 供應接線：release 先 sync、root manifest 最後原子切換；container 預設每 6h re-sync，nginx 分別給 root 60s/SWR300 與 release 7d immutable。
- [ ] 下一次 probe 在 metadata 加入完整 API fetch、finalize 與 total wall time；本次只留有 finalize 69.27 秒，不能拿來推算全球總時間。

## GFW hourly grid POC

- [x] 重新取得完整 7 日 HOURLY/HIGH rows，輸出 168 個 UTC hour partitions；不從 989 段抽樣軌跡反推時間。
- [x] 依 `observed_hour + grid_lon + grid_lat` 聚合，保留 distinct `vessel_count` 與完整 members；2 boundary duplicates 已去重。
- [x] 接入主站世界／全球海事圖層與全域時間軸；同 hour 不重抓，跨 hour exact match，缺資料 fail closed。
- [x] 完成比例圓、count label、opacity、legend、全船 popup、loading、attribution 與 manifest/golden registrations。
- [x] frontend production 供應契約：object storage/CDN unified manifest + exact-hour assets，local 579 MiB POC 不進 dist。
- [ ] 完成 production 真實 release 的線上 CDN/browser 驗收、license、retention 與 egress gate。

## Regional production

- [ ] 將 POC 框選範圍固定切片，建立序列 queue、rate-limit header ledger、`429` backoff 與 `524` / `last-report` recovery。
- [ ] 建立 per-dataset/per-tile 完整日 frontier、每日增量、遲到 overlap window 與 immutable `dataset_version/date/tile_id` partitions。
- [ ] 以 `source_dataset_id + vessel_id + observed_hour + grid_lon + grid_lat` 去重，預產 per-vessel/per-day segmented `LineString`，不在 browser 即時處理全區資料。
- [ ] 建立 production DB/RPC 與 viewport/time/zoom/limit contract，完成 migration、RLS/GRANT、retention、rollback、RPC 效能與 browser 驗收。
- [ ] 完成 GFW license / noncommercial use / attribution / raw retention 條款審查後，才能開 production collector 或 raw archive。

## Global scale

- [ ] 設計具版本的全球 tile catalog：比較固定經緯度 tiles、等面積 tiles 與緯度帶調整寬度，定義 canonical boundary ownership。
- [ ] 建立 overview/detail 雙層：全球簡化/密度總覽與依 viewport/time 載入的 hourly detail。
- [ ] 評估 object storage + CDN + PMTiles/vector tiles，以 immutable cache key/manifest 發佈，不將全球細節經單一 RPC 一次下載。
- [ ] GFW 航跡採 overview/detail 雙通道：PMTiles 只承擔簡化幾何，完整 identities／members 以 hour+cell/vessel detail sidecar 或 thin RPC 取得。
- [ ] 建立全球容量/成本 gate：API 每日/每月額度、report wall time、raw/processed storage、DB/CDN egress、tile build time、browser memory/FPS。
- [ ] 以 POC → regional production → global 分階段啟用；每階段分開報告 API、archive、DB/RPC、browser、deploy 與 license 證據。

## Other maritime layers

- [ ] 以每日 job 實際產出 GFW current snapshot，驗證 license/noncommercial 權限與 retry；本機 token 不代表 production job 已啟用。
- [x] 新增獨立 `gfwDarkVessels`：SAR unmatched exact-hour lazy load、比例圓、popup/legend/通知與 fail-closed 語意契約；預設 off。
- [ ] 完成 `gfwDarkVessels` 線上正 detection 畫面/browser 驗收；0-feature hour 不能解讀為沒有暗船。GFW `gaps` 仍待獨立設計。
- [ ] 針對 AISStream 選取的 MMSI 接 `get_aisstream_vessel_trail`，明確標示取樣間隔與缺訊，不做平滑插值。
- [ ] 在 production RPC / browser 上分別驗證兩層的 viewport bounds、3000 筆上限、空結果與 loading timeout。

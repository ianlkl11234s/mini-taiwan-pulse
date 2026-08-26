# Global Maritime 全球海事

## 目的

## Current full-fidelity release status (2026-08-26)

- 程式、focused tests 與 production build 已完成；platform migration **376** 與 audit migration **377** 已套用 production。
- v3 shadow release 已完成 production S3/Supabase audit：S3 root 為 schema 3/full_fidelity、
  release 2026-08-21，root bytes/hash 一致；Supabase run e00 succeeded/is_current schema 3 shadow，
  3,311 assets/counters 一致；full S3 HEAD audit 3,311/3,311，missing/head_errors/bytes/SHA mismatches 均為 0、timed_out=false。
- **push、deploy 與 browser 驗收仍未完成**；canonical v2 **未切換**
  （S3 canonical v2 release 2026-08-20 保持不變），仍是唯一可宣稱的 rollback path。
- 生成計數：1,426,359 points、226,830 features、64,051 vessels、168,936 segments、
  57,894 singleton nodes、1,105,448 grid cells、SAR 0，asset 約 995 MB。

這些計數是 release contract 接受的資料，不是「海上所有船」。GFW HOURLY/HIGH 是
每小時格網中心；grid polygon 是推定 footprint，trail 的線性內插僅限同一有效相鄰
segment，均不得冒充原始 AIS 精確軌跡或官方格界。

世界 tab 的五個獨立船舶視圖：

- `aisstreamVessels`：AISStream 最近 30 分鐘船位，視 viewport 查詢；適合觀察目前可見的 AIS 回報。
- `gfwVesselPresence`：Global Fishing Watch 每日／延遲 vessel presence，與 AISStream 分開呈現；不是即時 AIS，也不是暗船清單。現有 production layer 仍是 current circle contract，本次另作一個本機歷史路徑 POC。
- gfwHourlyGrid：canonical v2 仍是目前路徑；v3 shadow 為 PMTiles polygon H/H+1 cross-fade 與 lazy 完整 member detail，full audit 已通過，仍待 deploy/browser gate。
- gfwHourlyTracks：canonical v2 仍是目前路徑；v3 shadow 用 hourly frame 建構 0.5/1/2/3 小時真實裁切拖尾（預設 0.5 小時），不顯示整日 edge 當作 timeline trail，full audit 已通過，仍待 deploy/browser gate。
- `gfwDarkVessels`：GFW SAR 偵測中未與 AIS 匹配的獨立時間軸圖層；位置是 HIGH grid cell center，不是精確 SAR 座標，也不是違法、暗船或刻意關 AIS 認定。

四層預設關閉，避免訪客一進站即發 RPC 或下載 release assets。透明度、圖例、popup、點選與 loading 均分開；前端只讀 public RPC／已發佈 release artifact，不直接讀 live table；本機 POC 僅在明確 opt-in 時使用。

## RPC contract

| layer | RPC | freshness | query |
|---|---|---|---|
| AISStream | `public.get_aisstream_vessels_current` | 30 分鐘內（contract cap） | viewport bounds，limit 3000 |
| GFW | `public.get_gfw_vessel_presence_current` | 最多 7 日（daily snapshot） | viewport bounds，limit 3000 |

來源、`provider`、品質欄位與 attribution 保留在 GeoJSON properties；不得把兩源 union 成一個「總船數」。

## 可信度與限制

- AISStream 的點代表可收到的 AIS 訊息，不代表海上所有船；目的地是船方自報。
- GFW presence 是延遲產品。`HOURLY` / `HIGH` 只能表示每船每小時所在的高解析格網中心，可連成大尺度近似路徑，但不是原始 AIS 經緯度、分鐘級航跡或真實航道。
- `gfwHourlyGrid` 生產環境依 UTC exact hour 只 lazy-load 一檔，不在兩個小時間插值。
- `gfwHourlyTracks` 生產環境依 UTC 日只 lazy-load 一檔；目前 exporter 仍為 cap 抽樣，不是框內全部船。每個頂點的 `observed_times` 必須和座標一對一、明確 UTC、嚴格遞增，否則整份 fail closed。
- `gfwDarkVessels` 使用 SAR `matched=false` 資料；同框七日可能是 0 detections，空圖層只代表 GFW 未回傳 unmatched detection，不代表海上沒有未開 AIS 的船。
- AISStream trail 需要逐船呼叫 trail RPC 與額外的選取／採樣策略，尚未接入，避免把點連成不具資料支持的連續航跡。

## GFW 歷史路徑 POC（2026-08-25）

以下是 capped local POC 的歷史證據，**不是** 2026-08-26 full-fidelity v3 shadow
release 或 production acceptance；以本文件開頭的 current status 與 995 MB release
metrics 為準。

本次 POC 使用用戶框選範圍：

```text
122.43400, 23.22953, 132.85274, 34.35812
```

契約如下：

- GFW `HOURLY` + `HIGH`，載入「最新可用完整日往回 7 日」；實際可用 frontier 以 API 回應為準，不在前端猜測。
- 依 `vesselId` 與小時排序，只連接時間連續且速度合理的格網中心；缺訊、跨日或不合理跳點要切斷 `LineString`。
- GFW 最後歷史點與 AISStream 目前船位之間存在約 96 小時的產品延遲；不跨這段 gap 畫線、不內插為觀測值。
- `GFW_ACCESS_TOKEN` 只能留在 `data-collectors` backend 環境，不得加入 `VITE_*`、前端 bundle、browser request 或 commit。
- POC 是 **local-only**：未寫入 production DB、未改 production RPC、未部署；raw archive 仍為 **disabled**。

### 本次實測證據

- 日期：`2026-08-15` 至 `2026-08-21`（UTC 完整日）；dataset `public-global-presence:v4.0`。
- 16/16 個 3° tiles 成功，16 個 HTTP 200 report；無 `429`、`524`、retry 或 API error。因中途把 finalize 改為 disk-backed 後 resume，已知本機 POST 共 17 次。
- 1,426,361 筆 normalized rows、57,726 艘候選船、2 筆 tile-boundary duplicates、0 invalid rows。
- 建立 168,936 個候選 segments；schema v2 本機 artifact 依 150,000 points cap 顯示 989 艘／989 段，加入逐頂點 `observed_times` 後為 8,687,132 bytes。
- finalize 實測 69.27 秒、peak RSS 約 435 MiB；首次 probe 未保存完整 API wall time，全球容量試算前必須補上 end-to-end timing。
- 本機 `bbox.html` 已驗證日期、統計、軌跡、端點、popup、toggle、attribution，browser console 0 error；production build 會主動移除此 POC GeoJSON。

## GFW 小時格網主站 POC（2026-08-25）

本節 579 MiB 數字是舊 local POC，非目前 full S3/Supabase audit 已完成、
但仍待 deploy/browser gate 的 v3 shadow release。

- 入口：主站 `世界 World → 全球海事 Global Maritime → GFW 小時船舶網格`；預設關閉。
- 使用主時間軸選擇 2026-08-15～21；前端以 250ms 訂閱，但只有 UTC 整點改變才換檔。
- 168 個小時、1,426,359 筆去重 presence、1,105,448 個 hour-grid features；2 duplicates、0 invalid、0 same-vessel-hour position conflicts。
- 本機輸出約 579 MiB；每次只載一個小時，最大單檔約 5.03 MB。資料 gitignored，production build 會移除整個 POC 目錄。
- 同格船舶沒有被丟失：每格一個 feature，`vessel_count` 等於 `vessels_json` members 數；點擊後以可捲動清單顯示船名、vessel ID、MMSI、類型與旗國。

## GFW 抽樣近似航跡主站 POC（2026-08-25）

本節描述 canonical v2/capped history；v3 shadow 的 full-fidelity frame/detail delivery
尚未 deploy 或 browser acceptance，不能以本段舊 browser POC 代替。

- 入口：`世界 World → 全球海事 Global Maritime → GFW 抽樣近似航跡`；預設關閉。
- 視覺沿用既有 Ships 六類色票：貨船、油輪、客船、漁船、作業／拖船、其他；航跡線與船頭同色，popup 同時保留 GFW 原始船種。
- 每次開啟圖層且 manifest 契約載入成功後，底部短暫通知會顯示 `latest_complete_date` 的最新完整 UTC 日，並明示非即時；不以 `generated_at` 代替資料日期。
- Production 與 Vite dev 預設都先載入同源 unified root manifest；DEV 由 `/global-maritime/gfw-hourly` proxy 轉送 production origin。只有 `VITE_GFW_HOURLY_USE_LOCAL_POC=true` 才使用 tracks/grid local POC adapter。每次開層都 no-cache refresh manifest，時間軸只載入選定 UTC 日的單檔。日檔含 3h lookback 與 1h lookahead，足以支援最長 3h 拖尾與跨日內插；不再一次載入七日整包。

### GFW 航跡 CDN 讀取契約

- S3 key prefix：`deploy-assets/global-maritime/gfw-hourly/`；public CDN path：`/global-maritime/gfw-hourly/`。
- Production 預設同域 `/global-maritime/gfw-hourly/manifest.json`；`VITE_GLOBAL_MARITIME_CDN_BASE` 僅是 production 可選 origin override，不需要 Zeabur 額外 env。Vite dev 固定同源 URL，由 `/global-maritime/gfw-hourly` proxy 讀 production release，刻意忽略該 override 以避免 CORS；只有 `VITE_GFW_HOURLY_USE_LOCAL_POC=true` 才使用 `/gfw_hourly_tracks_poc/manifest.json` 與 `/gfw_hourly_grid_poc/manifest.json`。`gis-up` 若要與目前 v3 production path 對齊，必須明確設 `VITE_GFW_HOURLY_V3_SHADOW_ENABLED=true`；未設仍是 canonical root。
- Unified v2 root 以 `tracks.days[]` / `grid.hours[]` / `dark_vessels.hours[]` 分開索引。各 `path` 依 manifest URL origin 解析，對應 `releases/<release_id>/tracks/days/...`、`grid/hours/...` 與 `dark_vessels/hours/...`。
- Cache-Control 邊界：root `manifest.json` 為 `public,max-age=60,s-maxage=60,stale-while-revalidate=300`；`releases/<release_id>/...` 為 `public,max-age=604800,s-maxage=604800,immutable`（7 日，與 release retention 一致）。前端也分別使用 fetch `cache: "no-cache"` 與 `cache: "force-cache"`。
- `public/gfw_hourly_tracks_poc.geojson` 與 `public/gfw_hourly_tracks_poc/` 都是 localhost 驗收產物，同時 gitignore 且由 Vite closeBundle strip，不可進 production dist。
- 使用 exporter schema v2：每條 `LineString` 的 `observed_times` 與 coordinates 一對一；缺欄、長度錯位、非 UTC、非遞增或 start/end 不一致時整份拒收。
- 全域時間軸以 100ms throttled tick 更新；相鄰 hourly observations 之間按時間比例做線性經緯度內插，可選 0.5/1/2/3 小時拖尾，預設 0.5 小時。
- 拖尾起點落在兩次觀測之間時也會內插裁切，避免視窗邊界每小時跳動。前端仍只在 exporter 已建立的單一 segment 裡裁線，不跨 >2h gap／>80kt 跳點，不在 segment 首末之外外插假船頭。
- line／endpoint 可點，popup properties 帶 `selected_time` 與 `interpolated`；內插座標只是動畫估計，不冒充 GFW 實際觀測。
- 本輪先完成內容與契約，維持 GeoJSON；PMTiles／viewport-aware overview/detail 留待效能階段。

## SAR 未匹配 AIS 圖層

`public-global-sar-presence:v4.0` 的 live schema probe 已成功，並確認即使某小時 0 detections 也會產生合法空 artifact。因此主站正式提供「GFW SAR 未匹配 AIS」獨立 toggle，預設關閉。圈點大小依 detections，popup 顯示 UTC、source 與固定風險提示；座標是 GFW HIGH grid cell center，不是精確 SAR detection location。本層不與 AIS presence 合併，也不把 unmatched 解讀為暗船、違法或確認關 AIS。

## 上游 handoff

- `gis-platform/migrations/371_aisstream_gfw_independent_contract.sql`：已完整套用至 production，是既有 RPC 與 quality/age 欄位 SSOT；full-fidelity migration 376 與 audit migration 377 亦已套用 production，S3/Supabase full audit（3,311/3,311 HEAD）已完成。
- AISStream：production 已有 9 個相關 tables、5 個 RPCs、cron 與 retention；feed healthy，S3 cold archive 已以 read-only 證據驗證。
- GFW：production tables/RPC 已存在。`GFW_ACCESS_TOKEN` 已放在本機 collector 環境用於 POC，不代表 production collector 已啟用，也不代表 production snapshot 已產生。後續快照仍需保持原始 dataset/license/noncommercial caveat。

## 驗收

```bash
npx tsc -b
npm test -- --runInBand
```

上述 production 證據是 backend read-only 驗證，不等於 PostgREST 公開 RPC 回應或 browser 真實點位驗證。AISStream 仍需透過 PostgREST/browser 確認 viewport、popup、attribution 與 freshness；GFW 歷史路徑亦要分開報告 API probe、本機 browser POC、production DB/RPC 與部署四種證據。

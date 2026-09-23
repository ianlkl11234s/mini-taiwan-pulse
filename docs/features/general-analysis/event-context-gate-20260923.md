# N04 事件背景來源關卡（2026-09-23）

> 2026-09-23 現況校正：本文件為早期候選gate；歷史115064背景join及browser已完成，最新見 acceptance-N03-N04.md 的原始邊界重驗。未完成的是fresh feed與完整生命週期，不能沿用下方早期未接線狀態作為現況。

目前狀態：固定歷史事件 115064 的背景分析與 browser 已通過；近期 occurrence window 已接線。來源更新／撤回狀態與即時完整性仍 unknown，生命週期驗收 PARTIAL。下文為早期候選紀錄，最新證據見 acceptance-D01-D03-20260923.md。

## 唯一推薦候選：CWA 國內地震回放

選 `earthquakeReplay`／`earthquake`，因為現有 reader 同時保留穩定 `event_id`、事件發生時間與震央座標，且可沿同一事件追到觀測明細：

| 項目 | 現有證據 | N04 判定 |
|---|---|---|
| 事件 reader | `src/data/earthquakeReplayLoader.ts`：`fetchReplayEvents()` 呼叫 `supabase.rpc("earthquake_replay_events")`；`fetchReplayDetail()` 依 resolved key 等值讀測站、鄉鎮震度、shakemap grid、moment tensor | 已接線 |
| 時間 | RPC row 的 `occurred_at`；明細另有 `town_origin_time`、`grid_event_time`、`tensor_origin_utc` | 有事件時間；觀測／發布時間仍須在案例 receipt 分列 |
| geometry | `epicenter_lng/lat` 為事件震央 actual Point；測站為 actual Point；grid 為觀測格網；鄉鎮面由同版 PMTiles boundary + resolved intensity join | 震央／測站可做 exact point context；鄉鎮面語意是觀測震度，不是事件影響因果 |
| access | Supabase RPC／table，loader 全部有 loading、cache、錯誤傳遞；另有 bounded probe readback | connected reader；非固定 artifact |
| freshness／coverage | handoff 記錄 2026-07-30 事件自動入庫；上線前事件可能缺 town/grid，且資料庫保留政策未在本 repo 固定 | 不得稱 current 或完整歷史 |

最小可重用接線：先讀 `fetchReplayEvents()`，由回傳清單選一個明確 `event_id`（保存事件 row receipt），再呼叫 `fetchReplayDetail(event)`；將震央 Point 作為事件中心，背景只接已通過來源契約的學校／醫院／行政統計。這條鏈不應從顯示 layer 反推資料，也不應把 town/grid 缺席補成零。

### 已有 bounded live readback

`../runtime/earthquake-replay-probe.json`（2026-09-22T15:29:15Z，`supabase:public.earthquake_replay_events`，`queryLimit=10`，643 ms）已讀回 10 rows。唯一推薦案例固定為 probe 首筆 `event_id=115064`：`occurred_at=2026-09-21T21:16:13Z`、M4.2、depth 7.5 km、actual epicenter `[120.54,23.21]`、26 stations、`has_town=true`、`has_grid=false`、`has_tensor=true`。probe 保留 source raw null／缺席狀態；這 10 rows 是 bounded window，不能宣稱完整歷史 catalog，也尚未證明 `fetchReplayDetail(115064)` 與設施／行政背景 join 全部成功。

因此這條鏈已可作下一步 live/readback 案例，不能作今日完整 N04 acceptance；deterministic replay 仍需 immutable artifact 或保存完整 receipt contract。

## 其他候選與排除

| 候選 | 現有來源／時間／geometry | 排除原因 |
|---|---|---|
| A1 即時事故 | `src/data/a1AccidentRealtimeLoader.ts`；`get_a1_accidents_by_bbox`；`occurred_at` + `lat/lon` actual Point | 30 天 rolling RPC，沒有固定歷史 snapshot／fixture；不適合 replay |
| 交通事故年度點位 | manifest `trafficAccidentYearly` 指向 `traffic_accident_yearly_20260626.geojson`，事件點位有年度語意 | 本工作樹沒有該 asset；不能把 manifest registration 當可讀證據，且年度點位的事件時間粒度需回到來源 receipt |
| 道路事件 | `src/data/roadEventsLoader.ts`；`get_road_events_day(date)`；`effective_ts/expire_ts/last_updated_ts` + GeoJSON geometry | 動態日查詢；未找到固定 replay artifact；geometry 可為點／線／面混合，尚未接通通用 typed event adapter |
| `tw-news-events` | `src/research/researchDatasets.ts` 的 `news-event-rpc-v1`；`published_at`；township cluster proxy Point 或 null | proxy geometry、`occurred_at` 為 null、spatialAnalysisEligible=false；不可做精確事件附近距離／affected context |

## proxy 事件的合法背景範圍

`tw-news-events` 仍可回答：某個來源描述的 township cluster 在某發布時間窗有哪些新聞事件、來源／相關度／嚴重度／事件分類，以及與該行政背景資料的並列閱讀。可再以使用者明示的行政區或獨立固定中心查詢設施／統計，清楚標成「同時段背景」。

它不能回答：事件到某設施的精確距離、事件真正發生點周圍 N 公尺、受影響範圍、道路／河川穿越，或由新聞 proxy 推論因果。缺座標、過期、撤稿與未取得都必須保留為缺口／狀態，不得以 township center、發布時間或最後快取冒充事件位置／發生時間。

## 放行條件

1. 從 `fetchReplayEvents()` 選定一個仍可取得的歷史 `event_id`，保存 row、取得時間、來源版本與 coverage receipt。
2. `fetchReplayDetail()` 成功讀回 actual 震央與明細；對缺 town/grid/tensor 保留明確 missing，而非補零。
3. 以同一事件中心接至少一種已驗證設施與一份同版行政背景，分列事件發生時間、資料觀測時間、取得時間、背景資料期別。
4. 完成 typed analysis／browser ready-readback；fixture、live reader、網站呈現三種證據分開記錄。

本輪沒有新增抓取、付費 provider、adapter 或 shared code。

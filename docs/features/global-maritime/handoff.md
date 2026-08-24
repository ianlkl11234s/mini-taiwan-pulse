# Global Maritime handoff

## Downstream contract

`mini-taiwan-pulse` 已接好兩個獨立 source/layer，但資料生命週期仍由上游 repo 負責：

| source | owner | required contract | cadence |
|---|---|---|---|
| AISStream | `data-collectors` | `AISSTREAM_API_KEY`、常駐 WebSocket、S3 cold archive（無 expiration） | live ingest |
| GFW | `data-collectors` | `GFW_ACCESS_TOKEN`、每日 snapshot、原始 dataset/license/noncommercial metadata | daily |
| public RPC | `gis-platform` | migration `371_aisstream_gfw_independent_contract.sql` | frontend read |

前端只呼叫：

- `public.get_aisstream_vessels_current(p_min_lon, p_min_lat, p_max_lon, p_max_lat, p_max_age_minutes, p_limit)`
- `public.get_gfw_vessel_presence_current(p_min_lon, p_min_lat, p_max_lon, p_max_lat, p_max_age_days, p_limit)`

兩個 RPC 必須維持 provider/quality/freshness 欄位，且不可在 SQL 或 collector 端把 AISStream 與 GFW union 成同一資料源。前端依 viewport 查詢，limit 目前為 3000。

## Hard dependencies

### AISStream

必須存在且可轉成有效資料的欄位：

`provider`, `mmsi`, `ship_name`, `ship_type`, `imo`, `call_sign`, `destination`, `nav_status`, `speed_knots`, `course_over_ground`, `true_heading`, `longitude`, `latitude`, `observed_at`, `received_at`, `age_seconds`, `position_quality`, `quality_flags`, `coverage_zone`。

`longitude` / `latitude` 非數字會被前端 loader 丟棄。`destination` 是船方自報，popup 不得當作已驗證目的地。

### GFW

必須存在且可轉成有效資料的欄位：

`provider`, `vessel_id`, `mmsi`, `ship_name`, `vessel_type`, `flag`, `longitude`, `latitude`, `source_snapshot_date`, `observed_at`, `received_at`, `age_hours`, `presence_quality`, `quality_flags`, `source_dataset_id`。

沒有 `GFW_ACCESS_TOKEN` 或 snapshot 尚未產生時，RPC/loader 可回空集合；不得用空集合冒充「沒有船」，也不得把 presence 推論為 dark vessel。

## Cross-repo references

- Platform contract：`../../../gis-platform/migrations/371_aisstream_gfw_independent_contract.sql`
- Platform source catalog / lifecycle：`../../api-platforms/`、`../../DATA_LIFECYCLE.md`
- Collector handoff：`../../../data-collectors` 的 AISStream/GFW collector 文件與 S3 cold archive policy
- UI implementation：`src/data/globalMaritimeLoader.ts`、`src/hooks/useGlobalMaritimeLayers.ts`

## Production evidence boundary (2026-08-24)

- migration 371 已完整套用至 production。
- AISStream 的 9 個相關 tables、5 個 RPCs、cron 與 retention 已存在；feed healthy，archive 已以 backend read-only 證據驗證。
- GFW tables/RPC 已存在，但 `GFW_ACCESS_TOKEN` 尚未就緒，token gate 下 collector runs 為 0，尚無 snapshot 可做資料驗收。
- 本次證據不包含 PostgREST 公開 RPC 回應或 browser 真實點位驗證。

## Remaining PostgREST/browser acceptance

1. 先透過 production PostgREST 分別驗證 AISStream 與 GFW 的 bounds、limit、空資料與 freshness；GFW 須等 token gate 解除且 snapshot 產生後才能完成。
2. 開啟 AISStream，確認 cyan circle、MMSI popup、30 分鐘 age 與 attribution。
3. 開啟 GFW，確認 amber circle、snapshot date、daily/延遲文案與 attribution。
4. 切換底圖，確認 `style.load` 後兩個 source/layer 重新建立並重新餵資料。
5. 若要接 AIS trail，另立選取 MMSI 的請求策略；不可把 current 點位直接連成連續航跡。

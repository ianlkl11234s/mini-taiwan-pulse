# Handoff

## Backend contract

- Migration SSOT：`../gis-platform/migrations/378_marine_observation_core.sql`
- Collector：`../data-collectors/collectors/cwa_marine_observation.py`
- Collector：`../data-collectors/collectors/isohe_port_marine.py`

前端只呼叫 production 已公開的三個 `public` RPC：

- `get_marine_observation_stations`
- `get_marine_observation_current`
- `get_marine_observation_history`

## Hard dependencies

- `source_network` 必須保留為 `cwa` 或 `isohe`，不可在前端合併。
- Station identity 使用 `station_uid`，current rows 依此組成單一站點 feature。
- `value_numeric` 的 null／missing／invalid 語意不可轉成 0。
- `vertical_datum`、`depth_key`、`quality_flags` 必須原樣保留供 popup/history 使用。
- History 時窗不得超過 31 天，前端目前只提供 24 小時與 7 天。

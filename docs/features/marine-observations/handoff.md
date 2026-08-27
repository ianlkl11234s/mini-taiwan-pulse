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

## Local checkpoint

- Repo：`mini-taiwan-pulse`
- Branch：`codex/marine-observations-cwa-isohe`
- Intended base：`origin/master@019f7f8`
- Commits：`84a175b`（完整 vertical slice）、`542a7d0`（popup viewport overflow）
- Worktree：`/private/tmp/mini-taiwan-pulse-marine-observations`

| build | contract/wire | stage | upload | readback | pull | deploy | HTTP | browser |
|---|---|---|---|---|---|---|---|---|---|
| done：tsc/unit/build | done：loader/layer/popup/registry | N/A | not run | done：production RPC 兩來源非零 | N/A | not run | done：localhost 3721 | done：兩層、popup/history、overflow |

## Next session entry

- Blocker：尚未取得 push、PR、merge 或 deploy 授權；正式站尚無此功能。
- 第一個動作：重新確認 branch 對 `origin/master` 的 ahead/behind，取得 owner 授權後才 push 明確 refspec。
- 驗收條件：CI 通過，正式站可獨立開關 CWA／ISOHE，popup/history 成功且 console/network 無 RPC 或 Mapbox 錯誤。

# Earthquake Replay — 跨 repo handoff（反向引用）

> 資料側 SSOT：`../../../../taipei-gis-analytics/docs/handoff/earthquake-replay.md`（2026-07-31 已修正 town join 約定）

## 跨 repo 對照

| Repo | 內容 | Commit/PR |
|---|---|---|
| data-collectors | `earthquake_town_intensity.py`（CWA E-A0015-005）+ `earthquake_shakemap_grid.py`（NCDR EQ1），15min cycle，Zeabur | PR #40（2026-07-29 上線） |
| gis-platform | mig 321 六表 + mig 324 `earthquake_replay_events()` 清單 RPC | PR #43 / PR #45 |
| taipei-gis-analytics | handoff 文件 + api-platforms/{cwa,tecdc,ncdr} + systems/seismic_tic.md | PR #28 + f935e95（handoff 修正） |
| mini-taiwan-pulse | 本 feature（前端全部） | feat/earthquake-replay PR |

## 上游查證結論（2026-07-31，實查 collector 程式碼 + DB）

1. **pipeline 自動累積已實證**：115053（07-30 台東成功 M4.7）零人工介入、發震後 10~24 分鐘自動進庫（town+grid+tensor 全到）。
2. **上線前事件永久缺 town+grid**：CWA/NCDR 源頭是「只留最新一次」的無狀態快照，07-29 上線前的事件（如 115051 雙溪 M5.6）已被覆寫、**不可回補**。非深源問題、非 bug。
3. **town origin_time 有初報/修訂 1 秒漂移**（115053 實測）：mig 324 用 ±5s 窗吸收並回傳 resolved key，前端等值查詢即可。

## 前端硬依賴（上游改動時要跟）

- RPC `earthquake_replay_events()` 的 signature（resolved key 欄位名）
- 四張明細表欄位：station_obs（epicenter_distance_km/intensity_value/pga_int）、town_intensity（town_code/intensity_value）、shakemap_grid（lon/lat/intensity + partial index `intensity > 0`）、moment_tensor（strike/dip/rake ×2 + solution_type）
- `township_boundary.pmtiles` 的 source-layer 名 `township_boundary` 與 `TOWNCODE` 屬性（8 碼格式）
